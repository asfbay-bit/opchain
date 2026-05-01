import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { capture, hashDistinctId } from "../src/lib/analytics.js";

describe("hashDistinctId", () => {
  it("is stable across calls", async () => {
    const a = await hashDistinctId("alice@example.com");
    const b = await hashDistinctId("alice@example.com");
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });

  it("normalizes case + whitespace", async () => {
    const a = await hashDistinctId("Alice@Example.COM");
    const b = await hashDistinctId("  alice@example.com  ");
    expect(a).toBe(b);
  });

  it("different emails produce different ids", async () => {
    const a = await hashDistinctId("alice@example.com");
    const b = await hashDistinctId("bob@example.com");
    expect(a).not.toBe(b);
  });
});

describe("capture — PostHog wrapper", () => {
  let fetchMock;

  beforeEach(() => {
    fetchMock = vi.fn().mockResolvedValue(new Response("ok", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("no-op when POSTHOG_PROJECT_API_KEY is unset", async () => {
    await capture({}, { distinctId: "abc", event: "e", properties: {} });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("POSTs to /capture/ with the expected shape", async () => {
    await capture(
      { POSTHOG_PROJECT_API_KEY: "phc_xyz", POSTHOG_HOST: "https://eu.i.posthog.com" },
      { distinctId: "abc", event: "notify_submitted", properties: { foo: 1 } },
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://eu.i.posthog.com/capture/");
    expect(init.method).toBe("POST");
    const body = JSON.parse(init.body);
    expect(body.api_key).toBe("phc_xyz");
    expect(body.event).toBe("notify_submitted");
    expect(body.distinct_id).toBe("abc");
    expect(body.properties.foo).toBe(1);
    expect(body.properties.$lib).toBe("opchain-worker");
  });

  it("strips trailing slash from POSTHOG_HOST", async () => {
    await capture(
      { POSTHOG_PROJECT_API_KEY: "phc_xyz", POSTHOG_HOST: "https://app.posthog.com/" },
      { distinctId: "abc", event: "e", properties: {} },
    );
    const [url] = fetchMock.mock.calls[0];
    expect(url).toBe("https://app.posthog.com/capture/");
  });

  it("swallows fetch errors", async () => {
    fetchMock.mockRejectedValueOnce(new Error("boom"));
    await expect(
      capture(
        { POSTHOG_PROJECT_API_KEY: "phc_xyz" },
        { distinctId: "abc", event: "e", properties: {} },
      ),
    ).resolves.toBeUndefined();
  });

  it("swallows non-2xx responses", async () => {
    fetchMock.mockResolvedValueOnce(new Response("err", { status: 500 }));
    await expect(
      capture(
        { POSTHOG_PROJECT_API_KEY: "phc_xyz" },
        { distinctId: "abc", event: "e", properties: {} },
      ),
    ).resolves.toBeUndefined();
  });
});

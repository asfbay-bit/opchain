import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import worker from "../src/index.js";

function envWith(overrides = {}) {
  return {
    LINEAR_API_KEY: "lin_test_key",
    ASSETS: { async fetch() { return new Response("", { status: 200 }); } },
    ...overrides,
  };
}

describe("GET /api/flags/public", () => {
  beforeEach(() => { vi.unstubAllGlobals(); });
  afterEach(() => { vi.unstubAllGlobals(); });

  it("returns the public-flag map with all defaults", async () => {
    const res = await worker.fetch(
      new Request("https://opchain.dev/api/flags/public"),
      envWith(),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.flags).toBeTypeOf("object");
    expect(body.flags["site.feature.feedback-widget"]).toBe(true);
    expect(body.flags["site.feature.demo-page"]).toBe(true);
    // Server-only flags must not leak into the public payload.
    expect(body.flags["site.ops.api-feedback.kill"]).toBeUndefined();
    expect(body.flags["platform.security.csp-strict"]).toBeUndefined();
  });

  it("sets oc_id cookie when missing and reuses it when present", async () => {
    const res1 = await worker.fetch(
      new Request("https://opchain.dev/api/flags/public"),
      envWith(),
    );
    const setCookie = res1.headers.get("Set-Cookie");
    expect(setCookie).toMatch(/^oc_id=/);
    expect(setCookie).toMatch(/SameSite=Lax/);
    expect(setCookie).toMatch(/Secure/);

    const res2 = await worker.fetch(
      new Request("https://opchain.dev/api/flags/public", {
        headers: { Cookie: "oc_id=existing-id-123" },
      }),
      envWith(),
    );
    expect(res2.headers.get("Set-Cookie")).toBeNull();
  });

  it("respects env override on a public flag", async () => {
    const res = await worker.fetch(
      new Request("https://opchain.dev/api/flags/public"),
      envWith({ FLAG_SITE_FEATURE_FEEDBACK_WIDGET: "false" }),
    );
    const body = await res.json();
    expect(body.flags["site.feature.feedback-widget"]).toBe(false);
  });

  it("private cache header so PoP doesn't share across visitors", async () => {
    const res = await worker.fetch(
      new Request("https://opchain.dev/api/flags/public"),
      envWith(),
    );
    expect(res.headers.get("Cache-Control")).toContain("private");
  });
});

describe("GET /api/health — flag summary", () => {
  it("default health response stays minimal", async () => {
    const res = await worker.fetch(
      new Request("https://opchain.dev/api/health"),
      envWith(),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.flags).toBeUndefined();
  });

  it("includes flag-overrides summary when api-health.detailed is on", async () => {
    const res = await worker.fetch(
      new Request("https://opchain.dev/api/health"),
      envWith({
        FLAG_SITE_OPS_API_HEALTH_DETAILED: "true",
        FLAG_SITE_OPS_API_FEEDBACK_KILL: "true",
      }),
    );
    const body = await res.json();
    expect(body.flags).toBeTypeOf("object");
    expect(body.flags.count).toBeGreaterThan(0);
    expect(body.flags.overrides["site.ops.api-feedback.kill"]).toBe(true);
  });
});

describe("POST /api/notify — kill switch", () => {
  it("503s when site.ops.api-notify.kill is on", async () => {
    const res = await worker.fetch(
      new Request("https://opchain.dev/api/notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "x@example.com", source: "install" }),
      }),
      envWith({ FLAG_SITE_OPS_API_NOTIFY_KILL: "true" }),
    );
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.code).toBe("paused");
  });
});

describe("POST /api/feedback — flag-driven dry-run", () => {
  it("dry-runs when the api-feedback kill flag is on (replaces FEEDBACK_DRY_RUN)", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const res = await worker.fetch(
      new Request("https://opchain.dev/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "bug", title: "via flag" }),
      }),
      envWith({ FLAG_SITE_OPS_API_FEEDBACK_KILL: "true", LINEAR_API_KEY: undefined }),
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.dryRun).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { evalFlag, evalFlags } from "../src/lib/flags/eval.js";
import { getDefault } from "../src/lib/flags/registry.js";

beforeEach(() => {
  vi.unstubAllGlobals();
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe("evalFlag — defaults", () => {
  it("returns the registry default when env + posthog are unset", async () => {
    const env = {}; // no POSTHOG_PROJECT_API_KEY
    const ctx = {};
    const v = await evalFlag("site.feature.feedback-widget", { env, ctx });
    expect(v).toBe(getDefault("site.feature.feedback-widget"));
    expect(v).toBe(true);
  });

  it("returns false default for ops kill switches", async () => {
    const v = await evalFlag("site.ops.api-feedback.kill", { env: {}, ctx: {} });
    expect(v).toBe(false);
  });

  it("throws on unknown flag names", async () => {
    await expect(evalFlag("nope.nope", { env: {}, ctx: {} })).rejects.toThrow(/unknown flag/);
  });
});

describe("evalFlag — env override", () => {
  it("FLAG_<UPPER_SNAKE> wins over the registry default", async () => {
    const env = { FLAG_SITE_OPS_API_FEEDBACK_KILL: "true" };
    const v = await evalFlag("site.ops.api-feedback.kill", { env, ctx: {} });
    expect(v).toBe(true);
  });

  it("accepts true/false/1/0", async () => {
    const cases = [
      ["true", true], ["1", true], ["false", false], ["0", false],
    ];
    for (const [raw, expected] of cases) {
      const env = { FLAG_SITE_FEATURE_FEEDBACK_WIDGET: raw };
      const v = await evalFlag("site.feature.feedback-widget", { env, ctx: {} });
      expect(v).toBe(expected);
    }
  });

  it("env override wins even when PostHog is configured", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ featureFlags: { "site.feature.feedback-widget": false } })),
    );
    vi.stubGlobal("fetch", fetchMock);
    const env = {
      POSTHOG_PROJECT_API_KEY: "phc_test",
      FLAG_SITE_FEATURE_FEEDBACK_WIDGET: "true",
    };
    const v = await evalFlag("site.feature.feedback-widget", {
      env, ctx: {}, distinctId: "abc",
    });
    expect(v).toBe(true);
    // Env override short-circuits — no PostHog round trip needed.
  });

  it("ignores env override that fails type coercion", async () => {
    const env = { FLAG_SITE_FEATURE_FEEDBACK_WIDGET: "maybe" };
    const v = await evalFlag("site.feature.feedback-widget", { env, ctx: {} });
    expect(v).toBe(true); // falls back to default
  });
});

describe("evalFlag — PostHog", () => {
  it("uses the PostHog value when no env override is set", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({
        featureFlags: { "site.ui.header.beta-banner": true },
      })),
    );
    vi.stubGlobal("fetch", fetchMock);
    const env = { POSTHOG_PROJECT_API_KEY: "phc_test" };
    const ctx = {};
    const v = await evalFlag("site.ui.header.beta-banner", {
      env, ctx, distinctId: "user-1",
    });
    expect(v).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toContain("/decide");
  });

  it("falls back to default when PostHog returns no entry for the flag", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ featureFlags: {} })),
    );
    vi.stubGlobal("fetch", fetchMock);
    const env = { POSTHOG_PROJECT_API_KEY: "phc_test" };
    const v = await evalFlag("site.feature.feedback-widget", {
      env, ctx: {}, distinctId: "user-1",
    });
    expect(v).toBe(true);
  });

  it("falls back to default on PostHog network error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    const env = { POSTHOG_PROJECT_API_KEY: "phc_test" };
    const v = await evalFlag("site.feature.feedback-widget", {
      env, ctx: {}, distinctId: "user-1",
    });
    expect(v).toBe(true);
  });

  it("falls back to default on PostHog non-2xx", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      new Response("nope", { status: 500 }),
    ));
    const env = { POSTHOG_PROJECT_API_KEY: "phc_test" };
    const v = await evalFlag("site.feature.feedback-widget", {
      env, ctx: {}, distinctId: "user-1",
    });
    expect(v).toBe(true);
  });

  it("memoises the decide call per ctx across multiple flag lookups", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ featureFlags: {} })),
    );
    vi.stubGlobal("fetch", fetchMock);
    const env = { POSTHOG_PROJECT_API_KEY: "phc_test" };
    const ctx = {};
    await evalFlag("site.feature.feedback-widget", { env, ctx, distinctId: "x" });
    await evalFlag("site.ui.header.beta-banner", { env, ctx, distinctId: "x" });
    await evalFlag("site.feature.demo-page", { env, ctx, distinctId: "x" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("evalFlags — batch", () => {
  it("returns a value for each requested flag", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({
        featureFlags: { "site.feature.demo-page": false },
      })),
    );
    vi.stubGlobal("fetch", fetchMock);
    const env = { POSTHOG_PROJECT_API_KEY: "phc_test" };
    const out = await evalFlags(
      ["site.feature.demo-page", "site.feature.feedback-widget"],
      { env, ctx: {}, distinctId: "u" },
    );
    expect(out["site.feature.demo-page"]).toBe(false);
    expect(out["site.feature.feedback-widget"]).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

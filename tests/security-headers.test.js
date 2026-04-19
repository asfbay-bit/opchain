import { describe, expect, it } from "vitest";
import worker from "../src/index.js";

function makeEnv(overrides = {}) {
  return {
    LINEAR_API_KEY: "test",
    ANTHROPIC_API_KEY: "test",
    DEPLOY_API_TOKEN: "test-secret",
    ASSETS: {
      async fetch() {
        return new Response("<!doctype html><html></html>", {
          status: 200,
          headers: { "Content-Type": "text/html; charset=utf-8" },
        });
      },
    },
    DATA: { async get() { return null; }, async put() {} },
    ...overrides,
  };
}

describe("security headers — HTML responses", () => {
  it("stamps the full set on the homepage", async () => {
    const res = await worker.fetch(new Request("https://opchain.dev/"), makeEnv());
    expect(res.status).toBe(200);
    expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(res.headers.get("Strict-Transport-Security")).toMatch(/max-age=31536000/);
    expect(res.headers.get("X-Frame-Options")).toBe("DENY");
    expect(res.headers.get("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
    expect(res.headers.get("Permissions-Policy")).toMatch(/camera=\(\)/);
    const csp = res.headers.get("Content-Security-Policy");
    expect(csp).toBeTruthy();
    expect(csp).toMatch(/default-src 'self'/);
    expect(csp).toMatch(/frame-ancestors 'none'/);
    expect(csp).toMatch(/connect-src [^;]*https:\/\/\*\.i\.posthog\.com/);
    // The Worker proxies Anthropic — the browser never connects to it.
    expect(csp).not.toMatch(/api\.anthropic\.com/);
    // Cloudflare Web Analytics beacon script + reporting endpoint.
    expect(csp).toMatch(/script-src [^;]*static\.cloudflareinsights\.com/);
    expect(csp).toMatch(/connect-src [^;]*cloudflareinsights\.com/);
  });
});

describe("security headers — JSON API responses", () => {
  it("stamps the baseline but not CSP", async () => {
    const res = await worker.fetch(new Request("https://opchain.dev/api/health"), makeEnv());
    expect(res.status).toBe(200);
    expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(res.headers.get("Strict-Transport-Security")).toMatch(/max-age=/);
    expect(res.headers.get("X-Frame-Options")).toBe("DENY");
    expect(res.headers.get("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
    expect(res.headers.get("Content-Security-Policy")).toBeNull();
  });

  it("stamps the baseline on 400s too", async () => {
    const res = await worker.fetch(
      new Request("https://opchain.dev/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      }),
      makeEnv(),
    );
    expect(res.status).toBe(400);
    expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(res.headers.get("X-Frame-Options")).toBe("DENY");
  });

  it("stamps the baseline on OPTIONS preflight", async () => {
    const res = await worker.fetch(
      new Request("https://opchain.dev/api/feedback", {
        method: "OPTIONS",
        headers: { Origin: "https://opchain.dev" },
      }),
      makeEnv(),
    );
    expect(res.status).toBe(204);
    expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
  });
});

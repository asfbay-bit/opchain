import { describe, expect, it } from "vitest";
import worker from "../src/index.js";

function req(url, init) {
  return new Request(url, init);
}

function envWithout(...keys) {
  const base = {
    LINEAR_API_KEY: "test",
    ANTHROPIC_API_KEY: "test",
    DEPLOY_API_TOKEN: "test-secret",
    ASSETS: {
      async fetch() {
        return new Response("asset-stub", { status: 200 });
      },
    },
    DATA: {
      async get() {
        return null;
      },
      async put() {},
    },
  };
  for (const k of keys) delete base[k];
  return base;
}

describe("GET /api/health", () => {
  it("returns 200 with an ok flag and a version string", async () => {
    const res = await worker.fetch(req("https://opchain.dev/api/health"), envWithout());
    expect(res.status).toBe(200);
    expect(res.headers.get("X-Opchain-Version")).toBe("test");
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.service).toBe("opchain-dev");
    expect(typeof body.version).toBe("string");
  });
});

describe("fail-closed when DEPLOY_API_TOKEN is unset", () => {
  it("refuses to sign tokens on /api/try/start", async () => {
    const res = await worker.fetch(
      req("https://opchain.dev/api/try/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "alice@example.com" }),
      }),
      envWithout("DEPLOY_API_TOKEN"),
    );
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.error).toMatch(/not configured/i);
  });

  it("refuses to verify tokens on /api/try/chat", async () => {
    const res = await worker.fetch(
      req("https://opchain.dev/api/try/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          skill: "app-architect",
          messages: [{ role: "user", content: "hi" }],
          session_token: "anything:here:anything",
        }),
      }),
      envWithout("DEPLOY_API_TOKEN"),
    );
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.error).toMatch(/not configured/i);
  });
});

import { describe, expect, it } from "vitest";
import worker from "../src/index.js";

function req(url, init) {
  return new Request(url, init);
}

function env() {
  return {
    LINEAR_API_KEY: "test",
    ASSETS: {
      async fetch() {
        return new Response("asset-stub", { status: 200 });
      },
    },
  };
}

describe("GET /api/health", () => {
  it("returns 200 with an ok flag and a version string", async () => {
    const res = await worker.fetch(req("https://opchain.dev/api/health"), env());
    expect(res.status).toBe(200);
    expect(res.headers.get("X-Opchain-Version")).toBe("test");
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.service).toBe("opchain-dev");
    expect(typeof body.version).toBe("string");
  });
});

describe("/api/try/* removed", () => {
  it("returns 410 Gone for /api/try/start", async () => {
    const res = await worker.fetch(
      req("https://opchain.dev/api/try/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "alice@example.com" }),
      }),
      env(),
    );
    expect(res.status).toBe(410);
    const body = await res.json();
    expect(body.error).toMatch(/removed/i);
  });

  it("returns 410 Gone for /api/try/chat", async () => {
    const res = await worker.fetch(
      req("https://opchain.dev/api/try/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ skill: "app-architect", messages: [] }),
      }),
      env(),
    );
    expect(res.status).toBe(410);
  });
});

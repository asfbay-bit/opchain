import { describe, expect, it } from "vitest";
import worker from "../src/index.js";

function req(url, init) {
  return new Request(url, init);
}

function makeEnv(overrides = {}) {
  return {
    LINEAR_API_KEY: "test",
    ANTHROPIC_API_KEY: "test",
    DEPLOY_API_TOKEN: "test-secret",
    ASSETS: { async fetch() { return new Response("", { status: 200 }); } },
    DATA: { async get() { return null; }, async put() {} },
    ...overrides,
  };
}

describe("Zod — /api/try/start", () => {
  it("400 on missing email", async () => {
    const res = await worker.fetch(
      req("https://opchain.dev/api/try/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      }),
      makeEnv(),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe("invalid_body");
    expect(Array.isArray(body.issues)).toBe(true);
  });

  it("400 on malformed email", async () => {
    const res = await worker.fetch(
      req("https://opchain.dev/api/try/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "not-an-email" }),
      }),
      makeEnv(),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe("invalid_body");
  });

  it("400 on invalid JSON", async () => {
    const res = await worker.fetch(
      req("https://opchain.dev/api/try/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{not json",
      }),
      makeEnv(),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe("invalid_json");
  });

  it("stamps a request id on every response", async () => {
    const res = await worker.fetch(
      req("https://opchain.dev/api/try/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{",
      }),
      makeEnv(),
    );
    expect(res.headers.get("X-Opchain-Request-Id")).toMatch(/[0-9a-f-]{36}/i);
  });
});

describe("Zod — /api/try/chat", () => {
  it("400 on missing messages", async () => {
    const res = await worker.fetch(
      req("https://opchain.dev/api/try/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_token: "a".repeat(40), skill: "app-architect" }),
      }),
      makeEnv(),
    );
    expect(res.status).toBe(400);
  });

  it("400 on bad role", async () => {
    const res = await worker.fetch(
      req("https://opchain.dev/api/try/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_token: "a".repeat(40),
          skill: "app-architect",
          messages: [{ role: "system", content: "hi" }],
        }),
      }),
      makeEnv(),
    );
    expect(res.status).toBe(400);
  });
});

describe("Zod — /api/feedback", () => {
  it("400 on missing title", async () => {
    const res = await worker.fetch(
      req("https://opchain.dev/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "bug" }),
      }),
      makeEnv(),
    );
    expect(res.status).toBe(400);
  });

  it("400 on unknown type", async () => {
    const res = await worker.fetch(
      req("https://opchain.dev/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "chore", title: "hello" }),
      }),
      makeEnv(),
    );
    expect(res.status).toBe(400);
  });
});

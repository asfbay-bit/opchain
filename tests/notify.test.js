import { describe, expect, it, beforeEach } from "vitest";
import worker from "../src/index.js";

function req(url, init) {
  return new Request(url, init);
}

function makeKv() {
  const store = new Map();
  return {
    store,
    async get(key) { return store.get(key) ?? null; },
    async put(key, value, _opts) { store.set(key, value); },
  };
}

function envWith(overrides = {}) {
  return {
    LINEAR_API_KEY: "test",
    ASSETS: { async fetch() { return new Response("", { status: 200 }); } },
    ...overrides,
  };
}

describe("POST /api/notify", () => {
  it("400s when email is missing", async () => {
    const res = await worker.fetch(
      req("https://opchain.dev/api/notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      }),
      envWith({ NOTIFY: makeKv() }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe("invalid_body");
  });

  it("400s when email is not a valid email", async () => {
    const res = await worker.fetch(
      req("https://opchain.dev/api/notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "not-an-email" }),
      }),
      envWith({ NOTIFY: makeKv() }),
    );
    expect(res.status).toBe(400);
  });

  it("200s and persists to KV when email is valid", async () => {
    const kv = makeKv();
    const res = await worker.fetch(
      req("https://opchain.dev/api/notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "alice@example.com",
          role: "engineer",
          teamSize: "2-5",
          building: "internal tool",
          source: "skill-download",
        }),
      }),
      envWith({ NOTIFY: kv }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);

    // The lead key uses sha256(email.lower()).
    const leadKeys = [...kv.store.keys()].filter((k) => k.startsWith("lead:"));
    expect(leadKeys).toHaveLength(1);
    const persisted = JSON.parse(kv.store.get(leadKeys[0]));
    expect(persisted.email).toBe("alice@example.com");
    expect(persisted.role).toBe("engineer");
    expect(persisted.teamSize).toBe("2-5");
    expect(persisted.building).toBe("internal tool");
    expect(persisted.source).toBe("skill-download");
  });

  it("accepts the submission and 200s when NOTIFY KV isn't bound", async () => {
    const res = await worker.fetch(
      req("https://opchain.dev/api/notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "bob@example.com" }),
      }),
      envWith(),
    );
    expect(res.status).toBe(200);
  });

  it("rate-limits per IP after the configured threshold", async () => {
    const kv = makeKv();
    const env = envWith({ NOTIFY: kv });
    const headers = {
      "Content-Type": "application/json",
      "CF-Connecting-IP": "203.0.113.7",
    };
    const body = JSON.stringify({ email: "spam@example.com" });

    // 3 allowed, 4th rate-limited (NOTIFY_RATELIMIT_MAX = 3).
    for (let i = 0; i < 3; i++) {
      const res = await worker.fetch(
        req("https://opchain.dev/api/notify", { method: "POST", headers, body }),
        env,
      );
      expect(res.status).toBe(200);
    }
    const fourth = await worker.fetch(
      req("https://opchain.dev/api/notify", { method: "POST", headers, body }),
      env,
    );
    expect(fourth.status).toBe(429);
    const j = await fourth.json();
    expect(j.code).toBe("rate_limited");
  });

  it("400s on unknown role enum", async () => {
    const res = await worker.fetch(
      req("https://opchain.dev/api/notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "alice@example.com", role: "wizard" }),
      }),
      envWith({ NOTIFY: makeKv() }),
    );
    expect(res.status).toBe(400);
  });
});

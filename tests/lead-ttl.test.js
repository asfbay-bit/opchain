import { describe, expect, it, vi } from "vitest";
import worker from "../src/index.js";

function makeEnv(kv, extras = {}) {
  return {
    LINEAR_API_KEY: "test",
    ANTHROPIC_API_KEY: "test",
    DEPLOY_API_TOKEN: "test-secret",
    ASSETS: { async fetch() { return new Response("", { status: 200 }); } },
    DATA: kv,
    ...extras,
  };
}

function memKv() {
  const store = new Map();
  const puts = [];
  return {
    store, puts,
    async get(k) { return store.has(k) ? store.get(k) : null; },
    async put(k, v, opts) {
      puts.push({ key: k, value: v, opts });
      store.set(k, v);
    },
  };
}

async function start(env, email = "ttl@example.com") {
  return worker.fetch(
    new Request("https://opchain.dev/api/try/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    }),
    env,
    { waitUntil() {} },
  );
}

describe("LEAD_TTL_DAYS env", () => {
  it("defaults lead TTL to 365 days", async () => {
    const kv = memKv();
    const res = await start(makeEnv(kv));
    expect(res.status).toBe(200);
    const leadPut = kv.puts.find((p) => p.key.startsWith("opchain-leads:"));
    expect(leadPut).toBeTruthy();
    expect(leadPut.opts?.expirationTtl).toBe(365 * 86400);
  });

  it("honors a smaller override", async () => {
    const kv = memKv();
    const res = await start(makeEnv(kv, { LEAD_TTL_DAYS: "30" }));
    expect(res.status).toBe(200);
    const leadPut = kv.puts.find((p) => p.key.startsWith("opchain-leads:"));
    expect(leadPut.opts?.expirationTtl).toBe(30 * 86400);
  });

  it("falls back to default on non-numeric LEAD_TTL_DAYS", async () => {
    const kv = memKv();
    const res = await start(makeEnv(kv, { LEAD_TTL_DAYS: "garbage" }), "fallback@example.com");
    expect(res.status).toBe(200);
    const leadPut = kv.puts.find((p) => p.key.startsWith("opchain-leads:"));
    expect(leadPut.opts?.expirationTtl).toBe(365 * 86400);
  });
});

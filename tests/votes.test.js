import { describe, expect, it } from "vitest";
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
    ASSETS: { async fetch() { return new Response("", { status: 200 }); } },
    ...overrides,
  };
}

describe("POST /api/votes/:id — ID validation", () => {
  // The current Linear team prefix is ADEV-. The previous regex was hardcoded
  // to OPCHN- and rejected every real identifier, which silently broke the
  // entire roadmap voting feature. The generalized regex accepts any 2-8
  // uppercase-letter team prefix.
  it.each([
    ["ADEV-330", "current team prefix"],
    ["OPCHN-217", "legacy team prefix still accepted"],
    ["LIN-1", "short team prefix"],
    ["ABCDEFGH-999999", "max length on both sides"],
  ])("accepts %s (%s)", async (id) => {
    const res = await worker.fetch(
      req(`https://opchain.dev/api/votes/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      }),
      envWith({ NOTIFY: makeKv() }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.count).toBe(1);
  });

  // Note: the handler upcases `id` before validation, so lowercase prefixes
  // pass (covered by a separate test below). And an empty id collapses to
  // `/api/votes/` which falls out of the regex-matched route entirely, so
  // it's not a vote-handler concern.
  it.each([
    ["A-330", "prefix too short (1 char)"],
    ["ABCDEFGHI-330", "prefix too long (9 chars)"],
    ["ADEV-", "no number"],
    ["ADEV-1234567", "number too long"],
    ["ADEV_330", "wrong separator"],
    ["ADEV-330; DROP TABLE", "injection attempt"],
  ])("400s on invalid id %s (%s)", async (id) => {
    const res = await worker.fetch(
      req(`https://opchain.dev/api/votes/${encodeURIComponent(id)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      }),
      envWith({ NOTIFY: makeKv() }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe("invalid_id");
  });
});

describe("POST /api/votes/:id — counter + per-IP/day dedup", () => {
  it("increments the counter and stores it under vote-count:<id>", async () => {
    const kv = makeKv();
    const res = await worker.fetch(
      req("https://opchain.dev/api/votes/ADEV-330", {
        method: "POST",
        headers: { "Content-Type": "application/json", "CF-Connecting-IP": "1.2.3.4" },
        body: "{}",
      }),
      envWith({ NOTIFY: kv }),
    );
    expect(res.status).toBe(200);
    expect((await res.json()).count).toBe(1);
    expect(kv.store.get("vote-count:ADEV-330")).toBe("1");
  });

  it("returns alreadyVoted=true on a second vote from the same IP same day", async () => {
    const kv = makeKv();
    const env = envWith({ NOTIFY: kv });

    const first = await worker.fetch(
      req("https://opchain.dev/api/votes/ADEV-330", {
        method: "POST",
        headers: { "Content-Type": "application/json", "CF-Connecting-IP": "1.2.3.4" },
        body: "{}",
      }),
      env,
    );
    expect((await first.json()).count).toBe(1);

    const second = await worker.fetch(
      req("https://opchain.dev/api/votes/ADEV-330", {
        method: "POST",
        headers: { "Content-Type": "application/json", "CF-Connecting-IP": "1.2.3.4" },
        body: "{}",
      }),
      env,
    );
    expect(second.status).toBe(200);
    const body = await second.json();
    expect(body.alreadyVoted).toBe(true);
    expect(body.count).toBe(1);
  });

  it("503s when NOTIFY KV binding is missing", async () => {
    const res = await worker.fetch(
      req("https://opchain.dev/api/votes/ADEV-330", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      }),
      envWith({}),
    );
    expect(res.status).toBe(503);
    expect((await res.json()).code).toBe("kv_not_configured");
  });

  it("uppercases the id before validation, so lowercase URLs still match", async () => {
    const kv = makeKv();
    const res = await worker.fetch(
      req("https://opchain.dev/api/votes/adev-330", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      }),
      envWith({ NOTIFY: kv }),
    );
    expect(res.status).toBe(200);
    expect(kv.store.get("vote-count:ADEV-330")).toBe("1");
  });
});

describe("GET /api/votes — batched counts", () => {
  it("returns counts for valid ids and 0 for unknowns", async () => {
    const kv = makeKv();
    kv.store.set("vote-count:ADEV-330", "5");
    kv.store.set("vote-count:ADEV-345", "2");
    const res = await worker.fetch(
      req("https://opchain.dev/api/votes?ids=ADEV-330,ADEV-345,ADEV-999"),
      envWith({ NOTIFY: kv }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.counts).toEqual({
      "ADEV-330": 5,
      "ADEV-345": 2,
      "ADEV-999": 0,
    });
  });

  it("silently drops invalid ids from the batch instead of 400ing", async () => {
    const kv = makeKv();
    kv.store.set("vote-count:ADEV-330", "3");
    const res = await worker.fetch(
      req("https://opchain.dev/api/votes?ids=ADEV-330,invalid;injection,abc-def"),
      envWith({ NOTIFY: kv }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.counts).toEqual({ "ADEV-330": 3 });
  });

  it("returns empty counts when NOTIFY is unbound", async () => {
    const res = await worker.fetch(
      req("https://opchain.dev/api/votes?ids=ADEV-330"),
      envWith({}),
    );
    expect(res.status).toBe(200);
    expect((await res.json()).counts).toEqual({});
  });
});

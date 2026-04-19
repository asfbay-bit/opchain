import { describe, expect, it } from "vitest";
import {
  readIpWindow, writeIpWindow,
  readEmailUsage, writeEmailUsage,
  readLead, writeLeadIfNew,
  KEYS,
} from "../src/lib/kv.js";

function memKv() {
  const store = new Map();
  return {
    store,
    async get(k) { return store.has(k) ? store.get(k) : null; },
    async put(k, v /* , opts */) { store.set(k, v); },
    async delete(k) { store.delete(k); },
  };
}

describe("KV keys", () => {
  it("normalize email to lowercase", () => {
    expect(KEYS.email("Alice@Example.COM")).toBe("opchain-try-email:alice@example.com");
    expect(KEYS.lead("Alice@Example.COM")).toBe("opchain-leads:alice@example.com");
    expect(KEYS.ip("1.2.3.4")).toBe("opchain-try-ip:1.2.3.4");
  });
});

describe("IP window", () => {
  it("fresh window returns count 0", async () => {
    const kv = memKv();
    const w = await readIpWindow(kv, "9.9.9.9", 3600);
    expect(w.count).toBe(0);
    expect(typeof w.start).toBe("number");
  });

  it("write+read round-trip preserves count", async () => {
    const kv = memKv();
    const now = Math.floor(Date.now() / 1000);
    await writeIpWindow(kv, "1.1.1.1", 3600, { count: 3, start: now });
    const w = await readIpWindow(kv, "1.1.1.1", 3600);
    expect(w.count).toBe(3);
    expect(w.start).toBe(now);
  });

  it("stale window is discarded", async () => {
    const kv = memKv();
    const stale = Math.floor(Date.now() / 1000) - 99999;
    await writeIpWindow(kv, "1.1.1.1", 3600, { count: 99, start: stale });
    const w = await readIpWindow(kv, "1.1.1.1", 3600);
    expect(w.count).toBe(0);
  });

  it("malformed JSON treated as fresh window", async () => {
    const kv = memKv();
    kv.store.set(KEYS.ip("2.2.2.2"), "{{not-json");
    const w = await readIpWindow(kv, "2.2.2.2", 3600);
    expect(w.count).toBe(0);
  });
});

describe("Email usage", () => {
  it("starts at 0, writes then reads", async () => {
    const kv = memKv();
    expect((await readEmailUsage(kv, "a@b.com")).count).toBe(0);
    await writeEmailUsage(kv, "a@b.com", 86400, { count: 2 });
    expect((await readEmailUsage(kv, "a@b.com")).count).toBe(2);
  });

  it("key is case-insensitive", async () => {
    const kv = memKv();
    await writeEmailUsage(kv, "Mixed@Case.com", 86400, { count: 4 });
    expect((await readEmailUsage(kv, "mixed@case.COM")).count).toBe(4);
  });
});

describe("Lead write-once", () => {
  it("first write stores, second is a no-op", async () => {
    const kv = memKv();
    expect(await writeLeadIfNew(kv, "z@x.com", "tryit", 3600)).toBe(true);
    const first = await readLead(kv, "z@x.com");
    expect(first.source).toBe("tryit");
    // Second call returns false, doesn't overwrite.
    expect(await writeLeadIfNew(kv, "z@x.com", "another-source", 3600)).toBe(false);
    const second = await readLead(kv, "z@x.com");
    expect(second.source).toBe("tryit");
  });
});

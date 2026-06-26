import { describe, expect, it } from "vitest";
import worker from "../src/index.js";

function makeKv() {
  const store = new Map();
  return {
    store,
    async get(key) { return store.get(key) ?? null; },
    async put(key, value) { store.set(key, value); },
  };
}

// ASSETS stub: serves a fake SKILL.md for /docs/<id>/SKILL.md, 404s otherwise.
function envWith(overrides = {}) {
  return {
    ASSETS: {
      async fetch(req) {
        const u = new URL(req.url);
        if (u.pathname.startsWith("/docs/") && u.pathname.endsWith("/SKILL.md")) {
          return new Response(`# ${u.pathname}\nstub skill body`, { status: 200 });
        }
        return new Response("", { status: 404 });
      },
    },
    NOTIFY: makeKv(),
    ...overrides,
  };
}

function post(body, env = envWith()) {
  return worker.fetch(
    new Request("https://opchain.dev/mcp", {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "https://opchain.dev" },
      body: JSON.stringify(body),
    }),
    env,
    { waitUntil() {} },
  );
}

const rpc = (method, params, id = 1) => ({ jsonrpc: "2.0", id, method, params });

describe("POST /mcp", () => {
  it("initialize identifies the server as opchain", async () => {
    const res = await post(rpc("initialize", { protocolVersion: "2025-06-18" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.result.serverInfo.name).toBe("opchain");
    expect(body.result.serverInfo.version).toBe("test"); // __OPCHAIN_VERSION__ define
  });

  it("list_skills returns the full generated catalog (all 27 skills)", async () => {
    const res = await post(rpc("tools/call", { name: "list_skills" }));
    const body = await res.json();
    const parsed = JSON.parse(body.result.content[0].text);
    // 18 v1.4-era skills + 4 v1.5 AI-native skills (oc-claude-api,
    // oc-rag-forge, oc-agent-forge, oc-prompt-ops) + 2 v1.6 instrumentation
    // skills (oc-cost-ops, oc-telemetry-ops) + 3 v1.7 "Seams & Signals"
    // skills (oc-signal-forge, oc-modularize-ops, oc-fleet-ops).
    expect(parsed.skills.length).toBe(27);
    expect(parsed.skills.map((s) => s.id)).toContain("oc-release-ops");
    expect(parsed.skills.map((s) => s.id)).toContain("oc-claude-api");
    expect(parsed.skills.map((s) => s.id)).toContain("oc-cost-ops");
    expect(parsed.skills.map((s) => s.id)).toContain("oc-telemetry-ops");
    expect(parsed.skills.map((s) => s.id)).toContain("oc-signal-forge");
    expect(parsed.skills.map((s) => s.id)).toContain("oc-modularize-ops");
    expect(parsed.skills.map((s) => s.id)).toContain("oc-fleet-ops");
  });

  it("get_skill streams the SKILL.md from the ASSETS binding", async () => {
    const res = await post(rpc("tools/call", { name: "get_skill", arguments: { id: "oc-git-ops" } }));
    const body = await res.json();
    expect(body.result.content[0].text).toContain("/docs/oc-git-ops/SKILL.md");
  });

  it("checkpoints persist in KV across calls", async () => {
    const env = envWith();
    await post(rpc("tools/call", {
      name: "write_checkpoint",
      arguments: { skill: "oc-app-architect", sessionId: "s1", checkpoint: { phase: "spec" } },
    }), env);
    const res = await post(rpc("tools/call", {
      name: "read_checkpoint",
      arguments: { skill: "oc-app-architect", sessionId: "s1" },
    }), env);
    const body = await res.json();
    expect(JSON.parse(body.result.content[0].text).checkpoint).toEqual({ phase: "spec" });
    // Stored under a namespaced key so it can't collide with lead/vote keys.
    expect([...env.NOTIFY.store.keys()][0]).toBe("mcp-checkpoint:s1:oc-app-architect");
  });

  it("a notification (no id) gets 202 with no body", async () => {
    const res = await post({ jsonrpc: "2.0", method: "notifications/initialized" });
    expect(res.status).toBe(202);
    expect(await res.text()).toBe("");
  });

  it("a JSON-RPC batch returns an array of responses", async () => {
    const res = await post([rpc("ping", {}, 1), rpc("tools/list", {}, 2)]);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body).toHaveLength(2);
  });

  it("malformed JSON → 400 parse error", async () => {
    const res = await worker.fetch(
      new Request("https://opchain.dev/mcp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{not json",
      }),
      envWith(),
      { waitUntil() {} },
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe(-32700);
  });

  it("GET /mcp → 405 (POST-only transport)", async () => {
    const res = await worker.fetch(
      new Request("https://opchain.dev/mcp", { method: "GET" }),
      envWith(),
      { waitUntil() {} },
    );
    expect(res.status).toBe(405);
    expect(res.headers.get("Allow")).toContain("POST");
  });

  it("OPTIONS /mcp → 204 preflight", async () => {
    const res = await worker.fetch(
      new Request("https://opchain.dev/mcp", { method: "OPTIONS", headers: { Origin: "https://opchain.dev" } }),
      envWith(),
      { waitUntil() {} },
    );
    expect(res.status).toBe(204);
  });

  it("the api-mcp kill switch returns 503", async () => {
    const res = await post(rpc("initialize"), envWith({ FLAG_SITE_OPS_API_MCP_KILL: "true" }));
    expect(res.status).toBe(503);
  });
});

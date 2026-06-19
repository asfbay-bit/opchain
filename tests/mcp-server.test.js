import { describe, expect, it } from "vitest";
import { createMcpServer, ERR } from "../src/lib/mcp/server.js";

// Minimal fixture catalog — keeps the unit tests independent of the generated
// src/generated/mcp-catalog.json (that's covered by the Worker integration test).
const catalog = {
  orchestrator: "# Orchestrator Protocol\nRead this first.",
  skills: [
    {
      id: "oc-app-architect",
      name: "oc-app-architect",
      displayName: "OC · App Architect",
      shortDesc: "Idea → ship in one skill.",
      description: "Unified app development. build me an app, I have an app idea.",
      phases: ["plan", "build"],
      triAgent: true,
      commands: ["/oc-app", "/oc-discover", "/oc-build"],
      version: "1.4.0",
    },
    {
      id: "oc-git-ops",
      name: "oc-git-ops",
      displayName: "OC · Git Ops",
      shortDesc: "Branch, commit, PR, sync.",
      description: "Git workflow: commit, push, PR.",
      phases: ["build"],
      triAgent: false,
      commands: ["/oc-git", "/oc-git-sync"],
      version: "1.3.0",
    },
    {
      id: "oc-orchestrator",
      name: "oc-orchestrator",
      displayName: "OC · Orchestrator",
      shortDesc: "Router.",
      description: "Pipeline coordinator.",
      phases: ["foundation"],
      triAgent: false,
      commands: ["/oc-ops"],
      version: "1.3.0",
    },
  ],
};

const bodies = { "oc-app-architect": "# oc-app-architect\nfull instructions here" };

function makeServer() {
  const store = new Map();
  return createMcpServer({
    catalog,
    serverVersion: "test-1.6",
    loadBody: async (id) => bodies[id] ?? null,
    checkpoints: {
      async read(skill, session) {
        return store.get(`${session}:${skill}`) ?? null;
      },
      async write(skill, session, data) {
        store.set(`${session}:${skill}`, data);
      },
    },
  });
}

const rpc = (method, params, id = 1) => ({ jsonrpc: "2.0", id, method, params });

async function callTool(server, name, args) {
  const res = await server.handle(rpc("tools/call", { name, arguments: args }));
  return res.result;
}

describe("MCP server — lifecycle", () => {
  it("initialize advertises tools/prompts/resources and identifies as opchain", async () => {
    const server = makeServer();
    const res = await server.handle(rpc("initialize", { protocolVersion: "2025-06-18" }));
    expect(res.jsonrpc).toBe("2.0");
    expect(res.result.serverInfo).toEqual({ name: "opchain", version: "test-1.6" });
    expect(res.result.capabilities).toEqual({ tools: {}, prompts: {}, resources: {} });
    expect(res.result.protocolVersion).toBe("2025-06-18");
  });

  it("notifications (no id) get no response", async () => {
    const server = makeServer();
    const res = await server.handle({ jsonrpc: "2.0", method: "notifications/initialized" });
    expect(res).toBeNull();
  });

  it("ping returns an empty result", async () => {
    const server = makeServer();
    const res = await server.handle(rpc("ping"));
    expect(res.result).toEqual({});
  });

  it("unknown method → -32601", async () => {
    const server = makeServer();
    const res = await server.handle(rpc("does/not/exist"));
    expect(res.error.code).toBe(ERR.METHOD_NOT_FOUND);
  });

  it("malformed envelope → -32600", async () => {
    const server = makeServer();
    const res = await server.handle({ id: 9, method: "ping" }); // missing jsonrpc
    expect(res.error.code).toBe(ERR.INVALID_REQUEST);
  });
});

describe("MCP server — tools", () => {
  it("tools/list exposes the six opchain tools", async () => {
    const server = makeServer();
    const res = await server.handle(rpc("tools/list"));
    const names = res.result.tools.map((t) => t.name).sort();
    expect(names).toEqual(
      ["get_orchestrator", "get_skill", "list_skills", "read_checkpoint", "route", "write_checkpoint"],
    );
    for (const t of res.result.tools) expect(t.inputSchema.type).toBe("object");
  });

  it("list_skills returns the catalog", async () => {
    const server = makeServer();
    const result = await callTool(server, "list_skills");
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.skills).toHaveLength(3);
    expect(parsed.skills[0].id).toBe("oc-app-architect");
  });

  it("route resolves an /oc-* command to its declaring skill", async () => {
    const server = makeServer();
    const r = JSON.parse((await callTool(server, "route", { query: "/oc-git-sync ADEV-12" })).content[0].text);
    expect(r.skill).toBe("oc-git-ops");
    expect(r.matchedCommand).toBe("/oc-git-sync");
    expect(r.confident).toBe(true);
  });

  it("route resolves a natural-language request via the intent table", async () => {
    const server = makeServer();
    const r = JSON.parse((await callTool(server, "route", { query: "build me an app" })).content[0].text);
    expect(r.skill).toBe("oc-app-architect");
  });

  it("route falls back to the orchestrator when nothing matches", async () => {
    const server = makeServer();
    const r = JSON.parse((await callTool(server, "route", { query: "zzzzz qqqq" })).content[0].text);
    expect(r.skill).toBe("oc-orchestrator");
    expect(r.confident).toBe(false);
  });

  it("get_skill returns the SKILL.md body", async () => {
    const server = makeServer();
    const result = await callTool(server, "get_skill", { id: "oc-app-architect" });
    expect(result.content[0].text).toContain("full instructions here");
    expect(result.isError).toBeUndefined();
  });

  it("get_skill on an unknown id is a tool error, not a crash", async () => {
    const server = makeServer();
    const result = await callTool(server, "get_skill", { id: "oc-nope" });
    expect(result.isError).toBe(true);
  });

  it("get_orchestrator returns the shared protocol", async () => {
    const server = makeServer();
    const result = await callTool(server, "get_orchestrator");
    expect(result.content[0].text).toContain("Orchestrator Protocol");
  });

  it("checkpoint round-trips through the store", async () => {
    const server = makeServer();
    const writeRes = await callTool(server, "write_checkpoint", {
      skill: "oc-app-architect",
      sessionId: "proj-x",
      checkpoint: { phase: "build", step: "sprint-2" },
    });
    expect(JSON.parse(writeRes.content[0].text).ok).toBe(true);

    const readRes = await callTool(server, "read_checkpoint", { skill: "oc-app-architect", sessionId: "proj-x" });
    expect(JSON.parse(readRes.content[0].text).checkpoint).toEqual({ phase: "build", step: "sprint-2" });
  });

  it("read_checkpoint for an unwritten skill returns null", async () => {
    const server = makeServer();
    const res = await callTool(server, "read_checkpoint", { skill: "oc-git-ops" });
    expect(JSON.parse(res.content[0].text).checkpoint).toBeNull();
  });

  it("unknown tool → -32602", async () => {
    const server = makeServer();
    const res = await server.handle(rpc("tools/call", { name: "frobnicate", arguments: {} }));
    expect(res.error.code).toBe(ERR.INVALID_PARAMS);
  });
});

describe("MCP server — prompts", () => {
  it("prompts/list surfaces one prompt per /oc-* command", async () => {
    const server = makeServer();
    const res = await server.handle(rpc("prompts/list"));
    const names = res.result.prompts.map((p) => p.name);
    expect(names).toContain("oc-discover");
    expect(names).toContain("oc-git-sync");
    for (const p of res.result.prompts) expect(Array.isArray(p.arguments)).toBe(true);
  });

  it("prompts/get returns instructions that load the owning skill", async () => {
    const server = makeServer();
    const res = await server.handle(rpc("prompts/get", { name: "oc-discover", arguments: { args: "a todo app" } }));
    const text = res.result.messages[0].content.text;
    expect(text).toContain("oc-app-architect");
    expect(text).toContain("a todo app");
  });

  it("prompts/get on an unknown prompt → error", async () => {
    const server = makeServer();
    const res = await server.handle(rpc("prompts/get", { name: "oc-nope" }));
    expect(res.error.code).toBe(ERR.INVALID_PARAMS);
  });
});

describe("MCP server — resources", () => {
  it("resources/list includes the orchestrator and one per skill", async () => {
    const server = makeServer();
    const res = await server.handle(rpc("resources/list"));
    const uris = res.result.resources.map((r) => r.uri);
    expect(uris).toContain("opchain://orchestrator");
    expect(uris).toContain("opchain://skill/oc-app-architect");
  });

  it("resources/read returns skill bodies and the orchestrator", async () => {
    const server = makeServer();
    const orch = await server.handle(rpc("resources/read", { uri: "opchain://orchestrator" }));
    expect(orch.result.contents[0].text).toContain("Orchestrator Protocol");

    const skill = await server.handle(rpc("resources/read", { uri: "opchain://skill/oc-app-architect" }));
    expect(skill.result.contents[0].text).toContain("full instructions here");
  });

  it("resources/read on an unknown uri → error", async () => {
    const server = makeServer();
    const res = await server.handle(rpc("resources/read", { uri: "opchain://skill/nope" }));
    expect(res.error.code).toBe(ERR.INVALID_PARAMS);
  });
});

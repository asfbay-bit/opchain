import { describe, expect, it } from "vitest";
import worker from "../src/index.js";
import realCatalog from "../src/generated/mcp-catalog.json" with { type: "json" };
import {
  DISCOVERY_PATHS,
  buildAiCatalog,
  buildMcpCard,
  buildLlmsTxt,
  buildSkillsJson,
} from "../src/lib/discovery.js";

// Small deterministic fixture; the builders are pure functions of it.
const catalog = {
  skills: [
    {
      id: "oc-app-architect",
      displayName: "OC · App Architect",
      shortDesc: "Idea → spec → design → build → launch.",
      description: "Unified app development. Use for /oc-app. Trigger liberally.",
      phases: ["plan", "build"],
      triAgent: true,
      commands: ["/oc-app", "/oc-build"],
      version: "1.4.3",
    },
    {
      id: "oc-deploy-ops",
      displayName: "OC · Deploy Ops",
      shortDesc: "Audit gate → staging → production.",
      description: "Deployment pipeline.",
      phases: ["build"],
      triAgent: false,
      commands: ["/oc-deploy"],
      version: "1.4.3",
    },
  ],
  orchestrator: "# Orchestrator Protocol\n",
};

const ORIGIN = "https://opchain.dev";

describe("buildAiCatalog (ARD manifest)", () => {
  const cat = buildAiCatalog({ catalog, origin: ORIGIN, version: "abc123" });

  it("declares the ARD spec version and a did:web publisher identity", () => {
    expect(cat.specVersion).toBe("1.0");
    expect(cat.host.identifier).toBe("did:web:opchain.dev");
    expect(cat.host.documentationUrl).toBe(ORIGIN);
  });

  it("exposes a single MCP-server entry whose url resolves to the server card", () => {
    expect(cat.entries).toHaveLength(1);
    const [entry] = cat.entries;
    expect(entry.type).toBe("application/mcp-server-card+json");
    expect(entry.url).toBe(`${ORIGIN}${DISCOVERY_PATHS.mcpCard}`);
    expect(entry.identifier).toMatch(/^urn:air:opchain:mcp:/);
    expect(entry.version).toBe("abc123");
  });

  it("surfaces every skill id as a capability and ships 2-5 intent queries", () => {
    const [entry] = cat.entries;
    expect(entry.capabilities).toEqual(["oc-app-architect", "oc-deploy-ops"]);
    expect(entry.representativeQueries.length).toBeGreaterThanOrEqual(2);
    expect(entry.representativeQueries.length).toBeLessThanOrEqual(5);
  });

  it("self-describes per origin (staging advertises staging)", () => {
    const staging = buildAiCatalog({ catalog, origin: "https://staging.opchain.dev/" });
    expect(staging.entries[0].url).toBe("https://staging.opchain.dev/.well-known/mcp.json");
  });
});

describe("buildMcpCard", () => {
  it("describes how to connect over MCP and lists tools without drift", () => {
    const tools = [{ name: "list_skills", description: "List skills" }];
    const card = buildMcpCard({ catalog, origin: ORIGIN, version: "v1", tools });
    expect(card.endpoint).toBe(`${ORIGIN}/mcp`);
    expect(card.transport).toBe("streamable-http");
    expect(card.tools).toEqual([{ name: "list_skills", description: "List skills" }]);
    expect(card.skills).toEqual(["oc-app-architect", "oc-deploy-ops"]);
  });
});

describe("buildLlmsTxt", () => {
  const txt = buildLlmsTxt({ catalog, origin: ORIGIN });

  it("is a Markdown index that links each skill's raw SKILL.md", () => {
    expect(txt.startsWith("# opchain")).toBe(true);
    expect(txt).toContain("](https://opchain.dev/docs/oc-app-architect/SKILL.md)");
    expect(txt).toContain("OC · Deploy Ops");
    expect(txt).toContain(`${ORIGIN}/mcp`);
  });
});

describe("buildSkillsJson", () => {
  it("is a full JSON catalog with resolvable per-skill URLs", () => {
    const data = buildSkillsJson({ catalog, origin: ORIGIN, version: "v1" });
    expect(data.count).toBe(2);
    expect(data.mcp.endpoint).toBe(`${ORIGIN}/mcp`);
    const app = data.skills.find((s) => s.id === "oc-app-architect");
    expect(app.url).toBe(`${ORIGIN}/skills/oc-app-architect`);
    expect(app.doc).toBe(`${ORIGIN}/docs/oc-app-architect/SKILL.md`);
    expect(app.bundle).toBe(`${ORIGIN}/skills/oc-app-architect.zip`);
  });

  it("exposes the lockstep catalog semver for update checks", () => {
    const data = buildSkillsJson({ catalog, origin: ORIGIN, version: "v1" });
    // `version` is the build SHA; `catalogVersion` is the skill-release semver
    // that installed copies compare against their SKILL.md frontmatter.
    expect(data.catalogVersion).toBe("1.4.3");
    const empty = buildSkillsJson({ catalog: { skills: [] }, origin: ORIGIN });
    expect(empty.catalogVersion).toBeNull();
  });
});

// ── Worker route integration (uses the real generated mcp-catalog.json) ──────
function env() {
  return {
    ASSETS: { async fetch() { return new Response("", { status: 404 }); } },
  };
}
function get(path) {
  return worker.fetch(new Request(`https://opchain.dev${path}`, { method: "GET" }), env(), {
    waitUntil() {},
  });
}

describe("discovery routes", () => {
  it("GET /.well-known/ai-catalog.json → ARD manifest, CORS-open, cached", async () => {
    const res = await get(DISCOVERY_PATHS.aiCatalog);
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toMatch(/application\/json/);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(res.headers.get("Cache-Control")).toMatch(/max-age/);
    const body = await res.json();
    expect(body.specVersion).toBe("1.0");
    // Every shipped skill is advertised as a capability (count tracks the
    // real catalog so adding skills doesn't break this test).
    expect(body.entries[0].capabilities.length).toBe(realCatalog.skills.length);
  });

  it("GET /.well-known/mcp.json → server card with the real tool set", async () => {
    const res = await get(DISCOVERY_PATHS.mcpCard);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.endpoint).toBe("https://opchain.dev/mcp");
    expect(body.tools.map((t) => t.name)).toContain("list_skills");
    expect(body.tools.map((t) => t.name)).toContain("route");
  });

  it("GET /skills.json → full catalog of every shipped skill", async () => {
    const res = await get(DISCOVERY_PATHS.skills);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.count).toBe(realCatalog.skills.length);
    expect(body.skills.map((s) => s.id)).toContain("oc-release-ops");
    expect(body.catalogVersion).toBe(realCatalog.skills[0].version);
  });

  it("GET /llms.txt → text/plain Markdown index", async () => {
    const res = await get(DISCOVERY_PATHS.llms);
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toMatch(/text\/plain/);
    expect(await res.text()).toContain("# opchain");
  });
});

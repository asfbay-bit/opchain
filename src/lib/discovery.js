// Agentic-discovery surface for opchain.
//
// Builds the machine-readable "front door" that lets AI agents and registries
// FIND the opchain MCP server, not just call it once they already know it:
//
//   • ai-catalog.json  — Agentic Resource Discovery (ARD) manifest. The ARD
//                        spec (Google / Microsoft / Hugging Face, 2026-06) has
//                        a domain publish /.well-known/ai-catalog.json listing
//                        the MCP servers / agents / tools it offers, so
//                        registries crawl it and agents resolve it by intent.
//   • mcp.json         — an MCP server card the ai-catalog entry points at:
//                        how to connect (endpoint, transport, tools).
//   • llms.txt         — the llms.txt convention: a curated Markdown index of
//                        the best content for a model to read.
//   • skills.json      — a plain JSON catalog of every skill for agents that
//                        don't speak MCP.
//
// All four are derived from the SAME src/generated/mcp-catalog.json the MCP
// server itself serves, so they can never drift from the skills opchain ships.
// Pure functions of their inputs (catalog + origin + version) → trivially
// unit-testable, and self-describing per request origin (staging advertises
// staging, prod advertises prod).

// Canonical paths, shared by the Worker router and the tests.
export const DISCOVERY_PATHS = {
  aiCatalog: "/.well-known/ai-catalog.json",
  mcpCard: "/.well-known/mcp.json",
  llms: "/llms.txt",
  skills: "/skills.json",
  mcp: "/mcp",
};

const ARD_SPEC_VERSION = "1.0";
// MCP protocol revision the server speaks. Keep in sync with PROTOCOL_VERSION
// in src/lib/mcp/server.js.
const MCP_PROTOCOL_VERSION = "2025-06-18";
const PUBLISHER = "opchain";

const SUITE_DESCRIPTION =
  "opchain is a set of interconnected Claude Code / MCP skills that form a software-development " +
  "pipeline: concept → spec → design → build → ship → operate. Each skill is a SKILL.md the model " +
  "reads and follows; together they chain through a shared checkpoint protocol.";

// Natural-language phrases that map to the pipeline's most common entry points.
// ARD registries index these so an agent searching by intent resolves opchain.
const REPRESENTATIVE_QUERIES = [
  "build me an app from an idea",
  "what tech stack should I use",
  "audit my code for security issues before I ship",
  "deploy this to production",
  "set up monitoring and alerting for my app",
];

function base(origin) {
  return String(origin || "https://opchain.dev").replace(/\/+$/, "");
}

function shortDescOf(skill) {
  if (skill.shortDesc) return skill.shortDesc;
  const d = (skill.description || "").trim();
  if (!d) return "";
  // First sentence, trimmed to keep the index scannable.
  const firstSentence = d.split(/(?<=\.)\s/)[0];
  return firstSentence.length > 160 ? `${firstSentence.slice(0, 157)}…` : firstSentence;
}

/**
 * ARD manifest for /.well-known/ai-catalog.json. One entry: the hosted MCP
 * server, with every skill id surfaced as a `capability` for intent indexing
 * and a `url` that resolves to the MCP server card.
 */
export function buildAiCatalog({ catalog, origin, version = "dev" } = {}) {
  const b = base(origin);
  const skills = catalog?.skills ?? [];
  return {
    specVersion: ARD_SPEC_VERSION,
    host: {
      displayName: "opchain",
      // did:web ties the publisher identity to control of opchain.dev (HTTPS).
      // A signed /.well-known/did.json is the verification follow-up.
      identifier: "did:web:opchain.dev",
      documentationUrl: b,
      logoUrl: `${b}/favicon.svg`,
    },
    entries: [
      {
        identifier: `urn:air:${PUBLISHER}:mcp:opchain-skills`,
        displayName: "opchain — Claude Code dev-pipeline skills",
        type: "application/mcp-server-card+json",
        url: `${b}${DISCOVERY_PATHS.mcpCard}`,
        description: `${SUITE_DESCRIPTION} Exposed over MCP at ${b}${DISCOVERY_PATHS.mcp}: ${skills.length} skills, intent routing, the shared orchestrator protocol, and per-session checkpoints.`,
        tags: ["claude-code", "mcp", "agent-skills", "software-development", "devops", "ai-agents"],
        capabilities: skills.map((s) => s.id),
        representativeQueries: REPRESENTATIVE_QUERIES,
        version,
      },
    ],
  };
}

/**
 * MCP server card for /.well-known/mcp.json — the descriptor the ARD entry's
 * `url` resolves to. Tells a registry/agent how to connect and what's inside.
 * `tools` comes from the live MCP server instance so the card never drifts.
 */
export function buildMcpCard({ catalog, origin, version = "dev", tools = [] } = {}) {
  const b = base(origin);
  const skills = catalog?.skills ?? [];
  return {
    name: "opchain",
    version,
    description: SUITE_DESCRIPTION,
    protocol: "mcp",
    protocolVersion: MCP_PROTOCOL_VERSION,
    transport: "streamable-http",
    endpoint: `${b}${DISCOVERY_PATHS.mcp}`,
    documentationUrl: b,
    capabilities: { tools: {}, prompts: {}, resources: {} },
    tools: tools.map((t) => ({ name: t.name, description: t.description })),
    skills: skills.map((s) => s.id),
  };
}

/**
 * llms.txt — Markdown index. Links each skill to its raw SKILL.md (the model's
 * own copy, served from /docs/<id>/) plus the key human + machine entry points.
 */
export function buildLlmsTxt({ catalog, origin } = {}) {
  const b = base(origin);
  const skills = catalog?.skills ?? [];
  const lines = [
    "# opchain",
    "",
    `> ${SUITE_DESCRIPTION}`,
    "",
    `Install the skills into \`.claude/skills/\`, or point any MCP client (Codex, Claude Desktop, …) at the hosted server at ${b}${DISCOVERY_PATHS.mcp}.`,
    "",
    "## Skills",
    "",
  ];
  for (const s of skills) {
    const desc = shortDescOf(s);
    lines.push(`- [${s.displayName}](${b}/docs/${s.id}/SKILL.md): ${desc}`);
  }
  lines.push(
    "",
    "## Docs",
    "",
    `- [Skill catalog (JSON)](${b}${DISCOVERY_PATHS.skills}): machine-readable list of every skill`,
    `- [MCP server card](${b}${DISCOVERY_PATHS.mcpCard}): how to connect over MCP`,
    `- [Architecture](${b}/architecture): how the skills chain into a pipeline`,
    `- [Install guide](${b}/install): drop-in install + MCP setup`,
    `- [Skill bundle (zip)](${b}/opchain-skills.zip): every skill in one download`,
    "",
  );
  return lines.join("\n");
}

/**
 * skills.json — plain JSON catalog for agents that don't speak MCP. Full skill
 * metadata plus resolvable doc / page / bundle URLs for each.
 */
export function buildSkillsJson({ catalog, origin, version = "dev" } = {}) {
  const b = base(origin);
  const skills = catalog?.skills ?? [];
  return {
    name: "opchain",
    version,
    // Skills version in lockstep (skills/CHANGELOG.md), so the catalog semver
    // is any skill's version. Unlike `version` (build SHA, not orderable),
    // this is what installed copies compare against their local SKILL.md
    // frontmatter to detect an available update.
    catalogVersion: skills[0]?.version ?? null,
    description: SUITE_DESCRIPTION,
    mcp: { endpoint: `${b}${DISCOVERY_PATHS.mcp}`, card: `${b}${DISCOVERY_PATHS.mcpCard}` },
    install: { bundle: `${b}/opchain-skills.zip`, guide: `${b}/install` },
    count: skills.length,
    skills: skills.map((s) => ({
      id: s.id,
      displayName: s.displayName,
      shortDesc: s.shortDesc,
      description: s.description,
      phases: s.phases,
      triAgent: s.triAgent,
      commands: s.commands,
      version: s.version,
      url: `${b}/skills/${s.id}`,
      doc: `${b}/docs/${s.id}/SKILL.md`,
      bundle: `${b}/skills/${s.id}.zip`,
    })),
  };
}

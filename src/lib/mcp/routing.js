// Intent → skill routing for the opchain MCP server.
//
// Claude Code auto-discovers skills and triggers them on their `description`.
// Codex (and other MCP clients) instead ask the server "which skill handles
// this?" via the `route` tool. This module reproduces the orchestrator's Smart
// Routing table (skills/orchestrator.md §4) deterministically:
//
//   1. An exact /oc-* command resolves to the skill that declares it.
//   2. Otherwise a natural-language request is matched against the intent
//      table below (mirrors the documented routing rules).
//   3. No match → oc-orchestrator, which interviews the user and dispatches.

// Natural-language hints, mirroring skills/orchestrator.md §4 "Smart Routing
// Table". First match wins, so order matters (most specific first).
const INTENT_HINTS = [
  { re: /\b(document|reverse[- ]?spec|backfill spec|specs? from code|existing codebase)\b/, skill: "oc-reverse-spec", phase: "/oc-rev-spec" },
  { re: /\b(what stack|which stack|tech stack|framework comparison|what should i build with)\b/, skill: "oc-stack-forge", phase: "/oc-stack-decide" },
  { re: /\b(pre[- ]?commit|before i commit|lint and test|sanity check|quick check)\b/, skill: "oc-bug-check", phase: "/oc-bugcheck" },
  { re: /\b(threat model|owasp|attack surface|hardening|security posture|soc2|pen ?test|is this secure)\b/, skill: "oc-security-auditor", phase: "/oc-security" },
  { re: /\b(audit|review this code|find bugs|code review|what'?s wrong with this code)\b/, skill: "oc-code-auditor", phase: "/oc-audit" },
  { re: /\b(dashboard|data ?viz|kpi|bi design|analytics ui|monitoring dashboard|dense (data|information))\b/, skill: "oc-dash-forge", phase: "/oc-dash-forge" },
  { re: /\b(ux|design (review|iteration)|component library|accessibility|is the ui consistent)\b/, skill: "oc-ux-engineer", phase: "/oc-uxe" },
  { re: /\b(design (our|the|an?) api|openapi|graphql schema|versioning strategy|generate (an )?sdk|deprecate endpoint)\b/, skill: "oc-api-dev", phase: "/oc-api design" },
  { re: /\b(connect to|webhook|oauth|integration|integrate|third[- ]?party api)\b/, skill: "oc-integrations-engineer", phase: "/oc-integrate" },
  { re: /\b(migrate|migration|upgrade to|refactor to|swap|platform move|breaking changes?|deprecation)\b/, skill: "oc-migration-ops", phase: "/oc-migrate" },
  { re: /\b(load test|can this handle more users|performance|perf budget|caching strategy|capacity)\b/, skill: "oc-scale-ops", phase: "/oc-scale" },
  { re: /\b(monitor|uptime|error tracking|alerting|observability|incident|on[- ]?call|runbook|slo|sli|status page)\b/, skill: "oc-monitoring-ops", phase: "/oc-monitor" },
  { re: /\b(cut a release|ship v?\d|tag the release|draft the changelog|version bump|what'?s in this release)\b/, skill: "oc-release-ops", phase: "/oc-release plan" },
  { re: /\b(deploy|ship it|push to production|staging|rollback|go live)\b/, skill: "oc-deploy-ops", phase: "/oc-deploy staging" },
  { re: /\b(commit|push to git|create a pr|sync to repo|open a pull request)\b/, skill: "oc-git-ops", phase: "/oc-git-sync" },
  { re: /\b(build me an app|i have an idea|app idea|new project|spec|design|build (an?|the) )\b/, skill: "oc-app-architect", phase: "/oc-discover" },
  { re: /\b(status|where did i leave off|what should i (do|work on)|which project|show me everything)\b/, skill: "oc-orchestrator", phase: "/oc-ops status" },
];

const DEFAULT_SKILL = "oc-orchestrator";

/** Strip leading slash and surrounding whitespace; lower-case. */
function normalizeCommand(token) {
  return token.trim().replace(/^\//, "").toLowerCase();
}

/**
 * Build a `command verb → skill id` index from the catalog. Each skill's
 * frontmatter `commands` array (e.g. ["/oc-git", "/oc-git-sync"]) is the
 * source of truth — no hand-maintained second copy.
 */
export function buildCommandIndex(catalog) {
  const index = new Map();
  for (const skill of catalog.skills ?? []) {
    for (const cmd of skill.commands ?? []) {
      const verb = normalizeCommand(String(cmd).split(/\s+/)[0]);
      if (verb && !index.has(verb)) index.set(verb, skill.id);
    }
  }
  return index;
}

/**
 * Resolve a request to a skill.
 *
 * @param {string} query - an /oc-* command or a free-text request.
 * @param {{skills: Array}} catalog
 * @returns {{ skill: string, phase: string|null, matchedCommand: string|null, reason: string, confident: boolean }}
 */
export function route(query, catalog) {
  const raw = String(query ?? "").trim();
  const index = buildCommandIndex(catalog);

  // 1. Exact /oc-* command. Accept the first whitespace-delimited token so
  //    "/oc-git-sync ADEV-12" still resolves on the verb.
  const firstToken = raw.split(/\s+/)[0] || "";
  if (firstToken.startsWith("/") || index.has(normalizeCommand(firstToken))) {
    const verb = normalizeCommand(firstToken);
    const skill = index.get(verb);
    if (skill) {
      return {
        skill,
        phase: raw.startsWith("/") ? raw : `/${raw}`,
        matchedCommand: `/${verb}`,
        reason: `'/${verb}' is declared by ${skill}.`,
        confident: true,
      };
    }
  }

  // 2. Natural-language intent table.
  const lower = raw.toLowerCase();
  for (const hint of INTENT_HINTS) {
    if (hint.re.test(lower)) {
      return {
        skill: hint.skill,
        phase: hint.phase,
        matchedCommand: null,
        reason: `Matched the routing rule for ${hint.skill}.`,
        confident: true,
      };
    }
  }

  // 3. Fallback — the orchestrator interviews the user and dispatches.
  return {
    skill: DEFAULT_SKILL,
    phase: "/oc-ops",
    matchedCommand: null,
    reason: "No specific rule matched; oc-orchestrator will route from a one-line intake.",
    confident: false,
  };
}

// Pure functions extracted from validate-pm-mcp.mjs so they can be unit-tested
// directly without subprocess fixtures. The CLI wrapper imports these and
// translates results into stdout / exit code.

export const PM_AWARE_SKILLS = [
  "integrations-engineer",
  "app-architect",
  "git-ops",
  "deploy-ops",
  "monitoring-ops",
];

export const ALLOWED_PROVIDERS = new Set(["linear", "jira", "github-issues"]);

export const TOOL_REGISTRY = {
  linear: new Set([
    "mcp__claude_ai_Linear__get_issue",
    "mcp__claude_ai_Linear__list_issues",
    "mcp__claude_ai_Linear__list_comments",
    "mcp__claude_ai_Linear__save_comment",
    "mcp__claude_ai_Linear__save_issue",
    "mcp__claude_ai_Linear__list_issue_statuses",
    "mcp__claude_ai_Linear__get_team",
    "mcp__claude_ai_Linear__get_project",
  ]),
  "github-issues": new Set([
    "mcp__mcp-server-github__issue_read",
    "mcp__mcp-server-github__list_issues",
    "mcp__mcp-server-github__add_issue_comment",
    "mcp__mcp-server-github__issue_write",
  ]),
  jira: new Set([
    "mcp__atlassian__jira_get_issue",
    "mcp__atlassian__jira_search",
    "mcp__atlassian__jira_get_comments",
    "mcp__atlassian__jira_add_comment",
    "mcp__atlassian__jira_create_issue",
    "mcp__atlassian__jira_transition_issue",
    "mcp__atlassian__jira_get_transitions",
    "mcp__atlassian__jira_get_project",
  ]),
};

const ALL_REGISTRY_TOOLS = new Set(
  Object.values(TOOL_REGISTRY).flatMap((s) => [...s]),
);

// Shallow YAML parser for .opchain/pm.yaml.
// Handles top-level scalars, single-level nested maps, and bracketed flow
// arrays (`labels_default: [a, b]`). pm.yaml is well-structured and small;
// this avoids pulling in a yaml dependency for one consumer.
export function parseShallowYaml(src) {
  const out = {};
  let currentBlock = null;
  for (const raw of src.split("\n")) {
    const line = raw.replace(/#.*$/, "").trimEnd();
    if (!line.trim()) continue;

    const top = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*:\s*(.*)$/);
    if (top) {
      const [, key, valRaw] = top;
      const val = valRaw.trim();
      if (val === "") {
        out[key] = {};
        currentBlock = key;
      } else if (val.startsWith("[") && val.endsWith("]")) {
        out[key] = val
          .slice(1, -1)
          .split(",")
          .map((s) => s.trim().replace(/^["']|["']$/g, ""))
          .filter(Boolean);
        currentBlock = null;
      } else {
        out[key] = val.replace(/^["']|["']$/g, "");
        currentBlock = null;
      }
      continue;
    }

    const nested = line.match(/^\s+([A-Za-z_][A-Za-z0-9_-]*)\s*:\s*(.*)$/);
    if (nested && currentBlock && typeof out[currentBlock] === "object" && !Array.isArray(out[currentBlock])) {
      const [, key, valRaw] = nested;
      out[currentBlock][key] = valRaw.trim().replace(/^["']|["']$/g, "");
    }
  }
  return out;
}

export function checkSkillFile(id, text) {
  const errors = [];
  if (!/^##\s+PM-Tool MCP Integration/m.test(text)) {
    errors.push(`${id}: missing section anchor "## PM-Tool MCP Integration"`);
  }
  const placeholderHits = text.match(/mcp\.<provider>\./g);
  if (placeholderHits) {
    errors.push(
      `${id}: found ${placeholderHits.length} legacy placeholder(s) ` +
      `\`mcp.<provider>.\` — replace with concrete registry tool names ` +
      `or cite the protocol doc by reference.`,
    );
  }
  if (!text.includes("pm-mcp-protocol.md")) {
    errors.push(
      `${id}: PM-Tool MCP Integration section must cite ` +
      `integrations-engineer/references/pm-mcp-protocol.md`,
    );
  }
  return errors;
}

export function checkToolNames(id, text) {
  const errors = [];
  const warnings = [];
  const seen = new Set(text.match(/mcp__[A-Za-z0-9_-]+__[A-Za-z0-9_-]+/g) || []);
  for (const name of seen) {
    if (ALL_REGISTRY_TOOLS.has(name)) continue;
    if (name.startsWith("mcp__atlassian__")) {
      warnings.push(
        `${id}: Jira tool name not in registry: ${name} (Atlassian MCP surface is still stabilising)`,
      );
      continue;
    }
    errors.push(`${id}: tool name not in any provider's registry: ${name}`);
  }
  return { errors, warnings };
}

export function checkPmYaml(text) {
  const errors = [];
  let parsed;
  try {
    parsed = parseShallowYaml(text);
  } catch (e) {
    errors.push(`.opchain/pm.yaml parse error: ${e.message}`);
    return { errors, parsed: null };
  }

  for (const k of ["provider", "team_or_project", "issue_types", "states"]) {
    if (!(k in parsed)) errors.push(`.opchain/pm.yaml missing required key \`${k}\``);
  }

  if (parsed.provider && !ALLOWED_PROVIDERS.has(parsed.provider)) {
    errors.push(
      `.opchain/pm.yaml provider must be one of ${[...ALLOWED_PROVIDERS].join(", ")} ` +
      `(got "${parsed.provider}")`,
    );
  }

  const states = parsed.states || {};
  for (const required of ["in_progress", "in_review", "done"]) {
    if (!(required in states)) {
      errors.push(`.opchain/pm.yaml states.${required} is required`);
    }
  }

  return { errors, parsed };
}

// Sprint 1 / v1.3: tests for the PM-MCP validator.
// Covers the pure-function check layer (scripts/lib/pm-mcp-checks.mjs) and a
// happy-path subprocess test for the CLI wrapper (matches the
// catalog-generator pattern).

import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  ALLOWED_PROVIDERS,
  TOOL_REGISTRY,
  checkPmYaml,
  checkSkillFile,
  checkToolNames,
  parseShallowYaml,
} from "../scripts/lib/pm-mcp-checks.mjs";

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..");

describe("parseShallowYaml", () => {
  it("parses scalars, nested maps, and bracketed arrays", () => {
    const src = `provider: linear
team_or_project: ADEV
issue_types:
  feature: Feature
  bug: Bug
states:
  in_progress: "In Progress"
  in_review: In Review
  done: Done
labels_default: [opchain, agent-driven]
mcp_server: linear`;
    const out = parseShallowYaml(src);
    expect(out.provider).toBe("linear");
    expect(out.team_or_project).toBe("ADEV");
    expect(out.issue_types).toEqual({ feature: "Feature", bug: "Bug" });
    expect(out.states.in_progress).toBe("In Progress");
    expect(out.states.in_review).toBe("In Review");
    expect(out.labels_default).toEqual(["opchain", "agent-driven"]);
  });

  it("ignores comments and blank lines", () => {
    const src = `# leading comment
provider: linear   # trailing
\n
team_or_project: PLAT`;
    const out = parseShallowYaml(src);
    expect(out.provider).toBe("linear");
    expect(out.team_or_project).toBe("PLAT");
  });
});

describe("checkPmYaml", () => {
  const valid = `provider: linear
team_or_project: ADEV
issue_types:
  feature: Feature
states:
  in_progress: "In Progress"
  in_review: "In Review"
  done: Done`;

  it("passes a well-formed pm.yaml", () => {
    const { errors } = checkPmYaml(valid);
    expect(errors).toEqual([]);
  });

  it("flags an unknown provider", () => {
    const src = valid.replace("provider: linear", "provider: trello");
    const { errors } = checkPmYaml(src);
    expect(errors.some((e) => e.includes("provider must be one of"))).toBe(true);
  });

  it("flags missing top-level keys", () => {
    const src = `provider: linear
team_or_project: ADEV`;
    const { errors } = checkPmYaml(src);
    expect(errors.some((e) => e.includes("`issue_types`"))).toBe(true);
    expect(errors.some((e) => e.includes("`states`"))).toBe(true);
  });

  it("flags missing core states", () => {
    const src = `provider: linear
team_or_project: ADEV
issue_types:
  feature: Feature
states:
  in_progress: "In Progress"`;
    const { errors } = checkPmYaml(src);
    expect(errors.some((e) => e.includes("states.in_review"))).toBe(true);
    expect(errors.some((e) => e.includes("states.done"))).toBe(true);
  });
});

describe("checkSkillFile", () => {
  const validBody = `# Some Skill

## PM-Tool MCP Integration (v1.3+)

See [pm-mcp-protocol.md](../integrations-engineer/references/pm-mcp-protocol.md).

Calls \`mcp__claude_ai_Linear__get_issue\` with retry per protocol §2.`;

  it("passes a compliant body", () => {
    expect(checkSkillFile("test-skill", validBody)).toEqual([]);
  });

  it("flags missing section anchor", () => {
    const body = validBody.replace("## PM-Tool MCP Integration (v1.3+)", "## Other Section");
    const errs = checkSkillFile("test-skill", body);
    expect(errs.some((e) => e.includes("missing section anchor"))).toBe(true);
  });

  it("flags legacy mcp.<provider>. placeholder", () => {
    const body = validBody + "\n\nLegacy: `mcp.<provider>.get_issue`.";
    const errs = checkSkillFile("test-skill", body);
    expect(errs.some((e) => e.includes("legacy placeholder"))).toBe(true);
  });

  it("flags missing protocol-doc citation", () => {
    const body = validBody.replace(/pm-mcp-protocol\.md/g, "some-other-doc.md");
    const errs = checkSkillFile("test-skill", body);
    expect(errs.some((e) => e.includes("must cite"))).toBe(true);
  });
});

describe("checkToolNames", () => {
  it("accepts every name from the registry across all providers", () => {
    const allTools = Object.values(TOOL_REGISTRY).flatMap((s) => [...s]);
    const body = allTools.map((n) => `\`${n}\``).join(" ");
    const { errors, warnings } = checkToolNames("test-skill", body);
    expect(errors).toEqual([]);
    expect(warnings).toEqual([]);
  });

  it("flags a non-registry mcp__ name as an error", () => {
    const { errors } = checkToolNames("test-skill", "`mcp__claude_ai_Linear__nonsense_tool`");
    expect(errors.length).toBe(1);
    expect(errors[0]).toContain("not in any provider's registry");
  });

  it("warns (does not error) on Atlassian-shape names not yet in the registry", () => {
    const { errors, warnings } = checkToolNames(
      "test-skill",
      "`mcp__atlassian__jira_future_method`",
    );
    expect(errors).toEqual([]);
    expect(warnings.length).toBe(1);
    expect(warnings[0]).toContain("still stabilising");
  });

  it("ignores text without any mcp__ patterns", () => {
    const { errors, warnings } = checkToolNames("test-skill", "Just some prose without tools.");
    expect(errors).toEqual([]);
    expect(warnings).toEqual([]);
  });
});

describe("registry consistency", () => {
  it("ALLOWED_PROVIDERS matches TOOL_REGISTRY keys", () => {
    expect(new Set(Object.keys(TOOL_REGISTRY))).toEqual(ALLOWED_PROVIDERS);
  });
});

describe("validate-pm-mcp CLI", () => {
  it("exits 0 against the live repo state", () => {
    const result = spawnSync(
      "node",
      [join(ROOT, "scripts", "validate-pm-mcp.mjs")],
      { cwd: ROOT, encoding: "utf8" },
    );
    const detail = `stdout:\n${result.stdout}\nstderr:\n${result.stderr}`;
    expect(result.status, `validator exited non-zero — ${detail}`).toBe(0);
    expect(result.stdout).toContain("validate-pm-mcp: OK");
  });
});

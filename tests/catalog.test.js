import { describe, expect, it } from "vitest";
import {
  SKILL_NAMES,
  SKILL_PROMPTS,
  VALID_SKILLS,
} from "../src/generated/skill-prompts.js";

// These assertions protect the invariants the rest of the codebase assumes.
// scripts/gen-skills-catalog.mjs is the only thing that should generate the
// file under test; editing it by hand is a mistake.
//
// The skill lists below are hardcoded on purpose: any add/remove/rename of
// a skill should fail this test, forcing the author to update CLAUDE.md and
// any other places the list is documented. If you're here because the build
// fails after adding a skill — good, that's the point. Update both lists.

describe("generated skill catalog", () => {
  it("lists all 16 skills in SKILL_NAMES", () => {
    expect(Object.keys(SKILL_NAMES).sort()).toEqual([
      "api-dev",
      "app-architect",
      "bug-check",
      "checkpoint-protocol",
      "code-auditor",
      "dash-forge",
      "deploy-ops",
      "git-ops",
      "integrations-engineer",
      "migration-ops",
      "monitoring-ops",
      "orchestrator",
      "reverse-spec",
      "scale-ops",
      "security-auditor",
      "stack-forge",
      "ux-engineer",
    ]);
  });

  it("exposes 14 tryable skills (checkpoint-protocol + security-auditor excluded)", () => {
    expect(VALID_SKILLS.sort()).toEqual([
      "api-dev",
      "app-architect",
      "bug-check",
      "code-auditor",
      "dash-forge",
      "deploy-ops",
      "git-ops",
      "integrations-engineer",
      "migration-ops",
      "monitoring-ops",
      "orchestrator",
      "reverse-spec",
      "scale-ops",
      "stack-forge",
      "ux-engineer",
    ]);
    expect(VALID_SKILLS).not.toContain("checkpoint-protocol");
    expect(VALID_SKILLS).not.toContain("security-auditor");
  });

  it("every VALID_SKILL has a SKILL_PROMPTS entry", () => {
    for (const id of VALID_SKILLS) {
      expect(SKILL_PROMPTS[id]).toBeDefined();
      expect(SKILL_PROMPTS[id].length).toBeGreaterThan(50);
    }
  });

  it("interpolates the MAX_EXCHANGES placeholder — prompts contain `5 exchanges`", () => {
    for (const id of VALID_SKILLS) {
      expect(SKILL_PROMPTS[id]).toMatch(/5 exchanges/);
      expect(SKILL_PROMPTS[id]).not.toMatch(/\{\{maxExchanges\}\}/);
    }
  });

  it("every VALID_SKILL has a display name", () => {
    for (const id of VALID_SKILLS) {
      expect(SKILL_NAMES[id]).toBeDefined();
      expect(SKILL_NAMES[id].length).toBeGreaterThan(0);
    }
  });
});

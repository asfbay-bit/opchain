import { describe, expect, it } from "vitest";
import {
  SKILL_NAMES,
  SKILL_PROMPTS,
  VALID_SKILLS,
} from "../src/generated/skill-prompts.js";

// These assertions protect the invariants the rest of the codebase assumes.
// scripts/gen-skills-catalog.mjs is the only thing that should generate the
// file under test; editing it by hand is a mistake.

describe("generated skill catalog", () => {
  it("lists all 10 skills in SKILL_NAMES", () => {
    expect(Object.keys(SKILL_NAMES).sort()).toEqual([
      "app-architect",
      "checkpoint-protocol",
      "code-auditor",
      "deploy-ops",
      "git-ops",
      "integrations-engineer",
      "reverse-spec",
      "scale-ops",
      "stack-forge",
      "ux-engineer",
    ]);
  });

  it("exposes 9 tryable skills (checkpoint-protocol is excluded)", () => {
    expect(VALID_SKILLS.sort()).toEqual([
      "app-architect",
      "code-auditor",
      "deploy-ops",
      "git-ops",
      "integrations-engineer",
      "reverse-spec",
      "scale-ops",
      "stack-forge",
      "ux-engineer",
    ]);
    expect(VALID_SKILLS).not.toContain("checkpoint-protocol");
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

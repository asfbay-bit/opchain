// Validates the dogfooding eval set at prompts/opchain-eval/ (the worked
// example for oc-prompt-ops /oc-prompt eval). This is the "parses cleanly +
// stays consistent with the real catalog" guard the v1.5 Sprint 3 plan calls
// for — it does NOT run an LLM (routing is non-deterministic); it asserts the
// set is well-formed and that every expected route points at a real skill and
// a registered command verb, so the set can't silently rot.

import { describe, it, expect } from "vitest";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import yaml from "js-yaml";
import { isKnown } from "../src/lib/flags/registry.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const EVAL_DIR = join(ROOT, "prompts", "opchain-eval");
const SKILLS_DIR = join(ROOT, "skills");

function readJsonl(file) {
  return readFileSync(join(EVAL_DIR, file), "utf8")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l, i) => {
      try {
        return JSON.parse(l);
      } catch (err) {
        throw new Error(`${file} line ${i + 1} is not valid JSON: ${err.message}`);
      }
    });
}

const inputs = readJsonl("inputs.jsonl");
const expected = readJsonl("expected.jsonl");
const config = yaml.load(readFileSync(join(EVAL_DIR, "eval.yaml"), "utf8"));

const skillDirs = new Set(
  readdirSync(SKILLS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory() && existsSync(join(SKILLS_DIR, d.name, "SKILL.md")))
    .map((d) => d.name),
);

const VALID_MODES = new Set(["exact", "contains", "llm_judge"]);

// The routing answer is graded `contains: all: [<skill>, <command>]`. Pull the
// skill token (a real skills/<id>) and the command token (a "/verb") out of the
// `all` array so we can assert both point at something real.
function routeTargets(expectObj) {
  const all = expectObj?.all ?? [];
  return {
    skill: all.find((t) => skillDirs.has(t)),
    command: all.find((t) => typeof t === "string" && t.startsWith("/")),
  };
}

describe("prompts/opchain-eval — dataset integrity", () => {
  it("has at least 10 cases (a meaningful regression set)", () => {
    expect(inputs.length).toBeGreaterThanOrEqual(10);
  });

  it("every input has a unique id and a non-empty input string", () => {
    const ids = new Set();
    for (const row of inputs) {
      expect(typeof row.id).toBe("string");
      expect(row.id.length).toBeGreaterThan(0);
      expect(ids.has(row.id), `duplicate input id ${row.id}`).toBe(false);
      ids.add(row.id);
      expect(typeof row.input).toBe("string");
      expect(row.input.trim().length).toBeGreaterThan(0);
    }
  });

  it("inputs and expected join 1:1 on id", () => {
    const inIds = inputs.map((r) => r.id).sort();
    const exIds = expected.map((r) => r.id).sort();
    expect(exIds).toEqual(inIds);
  });
});

describe("prompts/opchain-eval — expected routes point at real skills + commands", () => {
  for (const row of expected) {
    it(`${row.id} has a valid grader and routes to a real skill + registered command`, () => {
      expect(row.expect, `${row.id} missing expect block`).toBeDefined();
      expect(VALID_MODES.has(row.expect.mode), `${row.id} bad mode ${row.expect.mode}`).toBe(true);
      const { skill, command } = routeTargets(row.expect);
      expect(skill, `${row.id} expect.all names no real skill`).toBeDefined();
      expect(command, `${row.id} expect.all names no /command`).toBeDefined();
      const verb = command.replace(/^\//, "").split(/\s+/, 1)[0];
      expect(
        isKnown(`skills.command.${verb}.enabled`),
        `command /${verb} has no registry flag`,
      ).toBe(true);
    });
  }
});

describe("prompts/opchain-eval — eval.yaml", () => {
  it("parses and declares the canonical grading + thresholds", () => {
    expect(config.prompt).toBe("opchain-routing");
    expect(VALID_MODES.has(config.grading.default_mode)).toBe(true);
  });

  it("declares sane pass + regression thresholds", () => {
    expect(config.thresholds.pass_rate).toBeGreaterThan(0);
    expect(config.thresholds.pass_rate).toBeLessThanOrEqual(1);
    expect(config.thresholds.regression_epsilon).toBeGreaterThan(0);
  });
});

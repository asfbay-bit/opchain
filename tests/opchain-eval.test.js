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
    it(`${row.id} routes to a real skill and a registered command`, () => {
      expect(skillDirs.has(row.skill), `unknown skill ${row.skill}`).toBe(true);
      // command is "/verb" or "/verb subcommand" — the flag tracks the verb.
      expect(typeof row.command).toBe("string");
      expect(row.command.startsWith("/")).toBe(true);
      const verb = row.command.replace(/^\//, "").split(/\s+/, 1)[0];
      expect(
        isKnown(`skills.command.${verb}.enabled`),
        `command /${verb} has no registry flag`,
      ).toBe(true);
    });
  }
});

describe("prompts/opchain-eval — eval.yaml rubric", () => {
  it("parses and declares the expected dataset wiring", () => {
    expect(config.name).toBe("opchain-routing");
    expect(config.dataset.inputs).toBe("inputs.jsonl");
    expect(config.dataset.expected).toBe("expected.jsonl");
    expect(config.dataset.join_on).toBe("id");
  });

  it("rubric fields all exist on every expected record and weights sum to 1", () => {
    const fields = config.rubric.map((r) => r.field);
    for (const row of expected) {
      for (const f of fields) {
        expect(row[f], `expected.${row.id} missing rubric field ${f}`).toBeDefined();
      }
    }
    const sum = config.rubric.reduce((a, r) => a + r.weight, 0);
    expect(Math.abs(sum - 1)).toBeLessThan(1e-9);
  });

  it("declares sane pass thresholds and a drift baseline", () => {
    expect(config.scoring.case_pass).toBeGreaterThan(0);
    expect(config.scoring.case_pass).toBeLessThanOrEqual(1);
    expect(config.scoring.suite_pass).toBeGreaterThan(0);
    expect(config.scoring.suite_pass).toBeLessThanOrEqual(1);
    expect(config.baseline.regression_delta).toBeGreaterThan(0);
  });
});

/**
 * Validates that the skill-catalog generator rejects SKILL.md frontmatter
 * referencing unknown flags. We do this by spawning the script against a
 * temp skills/ tree that includes one bad fixture, then asserting the
 * error message points at the offender.
 */
import { describe, it, expect } from "vitest";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, cpSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

function runValidator(skillsDir) {
  // The script reads from <ROOT>/skills, so we shim by symlinking from a
  // temp working directory that contains scripts/ + src/ + node_modules/
  // pointers and the test skills/ tree.
  const work = mkdtempSync(join(tmpdir(), "opchain-flags-skills-"));
  try {
    cpSync(join(ROOT, "scripts"), join(work, "scripts"), { recursive: true });
    cpSync(join(ROOT, "src"),     join(work, "src"),     { recursive: true });
    cpSync(join(ROOT, "node_modules"), join(work, "node_modules"), {
      recursive: true, dereference: false, errorOnExist: false,
    });
    cpSync(join(ROOT, "package.json"), join(work, "package.json"));
    cpSync(skillsDir, join(work, "skills"), { recursive: true });
    return spawnSync("node", ["scripts/gen-skills-catalog.mjs"], {
      cwd: work,
      encoding: "utf8",
    });
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

function makeFixture({ extraSkills = {} } = {}) {
  const dir = mkdtempSync(join(tmpdir(), "opchain-skills-fixture-"));
  // oc-checkpoint-protocol is required by the validator
  mkdirSync(join(dir, "oc-checkpoint-protocol"), { recursive: true });
  writeFileSync(
    join(dir, "oc-checkpoint-protocol", "SKILL.md"),
    [
      "---",
      "name: oc-checkpoint-protocol",
      "displayName: Checkpoint Protocol",
      "version: 1.0.0",
      "shortDesc: Cross-skill protocol for session persistence.",
      "phases: [foundation]",
      "triAgent: false",
      "commands: []",
      "description: Cross-skill protocol for session persistence.",
      "---",
      "",
      "# oc-checkpoint-protocol",
      "",
    ].join("\n"),
  );
  for (const [id, body] of Object.entries(extraSkills)) {
    mkdirSync(join(dir, id), { recursive: true });
    writeFileSync(join(dir, id, "SKILL.md"), body);
  }
  return dir;
}

describe("gen-skills-catalog — flag validation", () => {
  it("passes with a clean fixture", () => {
    const dir = makeFixture();
    try {
      const r = runValidator(dir);
      expect(r.status).toBe(0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("rejects flags.required references to unknown flags", () => {
    const dir = makeFixture({
      extraSkills: {
        "demo-skill": [
          "---",
          "name: demo-skill",
          "displayName: Demo",
          "version: 0.1.0",
          "shortDesc: A test skill.",
          "phases: [build]",
          "triAgent: false",
          "commands: []",
          "description: A test skill.",
          "flags:",
          "  required:",
          "    - skills.does-not.exist",
          "---",
          "",
        ].join("\n"),
      },
    });
    try {
      const r = runValidator(dir);
      expect(r.status).not.toBe(0);
      expect(r.stderr).toMatch(/unknown flag/);
      expect(r.stderr).toMatch(/skills\.does-not\.exist/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("rejects command verbs that lack a registered flag", () => {
    const dir = makeFixture({
      extraSkills: {
        "demo-skill": [
          "---",
          "name: demo-skill",
          "displayName: Demo",
          "version: 0.1.0",
          "shortDesc: A test skill.",
          "phases: [build]",
          "triAgent: false",
          "commands:",
          "  - /this-verb-is-not-registered",
          "description: A test skill.",
          "---",
          "",
        ].join("\n"),
      },
    });
    try {
      const r = runValidator(dir);
      expect(r.status).not.toBe(0);
      expect(r.stderr).toMatch(/skills\.command\.this-verb-is-not-registered\.enabled/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

#!/usr/bin/env node
// Validates skills/<id>/SKILL.md frontmatter at build time.
//
// Earlier this script also generated src/generated/skill-prompts.js for the
// worker's Try-It chat. The Try-It chat was removed in `claude/remove-try-it`,
// so the only remaining job is to assert end-to-end invariants — surfacing
// frontmatter errors here gives the build a clear message instead of a silent
// downstream mismatch in the Astro content collection.
//
// Astro reads skills/ directly via site/src/content.config.ts; this script
// is the equivalent guard for everything that runs *outside* the site build
// (the Worker, e2e tests, deploy pipeline).

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import matter from "gray-matter";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SKILLS_DIR = join(ROOT, "skills");

const VALID_PHASES = new Set(["foundation", "plan", "build"]);
const REQUIRED_FIELDS = [
  "name",
  "displayName",
  "version",
  "shortDesc",
  "phases",
  "triAgent",
  "commands",
  "description",
];

function listSkillDirs() {
  return readdirSync(SKILLS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .filter((name) => existsSync(join(SKILLS_DIR, name, "SKILL.md")))
    .sort();
}

function validateSkill(id) {
  const skillPath = join(SKILLS_DIR, id, "SKILL.md");
  const raw = readFileSync(skillPath, "utf8");
  const { data } = matter(raw);

  for (const field of REQUIRED_FIELDS) {
    if (!(field in data)) {
      throw new Error(`skills/${id}/SKILL.md: missing required frontmatter field \`${field}\``);
    }
  }
  if (data.name !== id) {
    throw new Error(
      `skills/${id}/SKILL.md: frontmatter \`name: ${data.name}\` does not match directory name \`${id}\``,
    );
  }
  if (!Array.isArray(data.phases) || data.phases.length === 0) {
    throw new Error(`skills/${id}/SKILL.md: \`phases\` must be a non-empty array`);
  }
  for (const p of data.phases) {
    if (!VALID_PHASES.has(p)) {
      throw new Error(
        `skills/${id}/SKILL.md: unknown phase \`${p}\` (valid: ${[...VALID_PHASES].join(", ")})`,
      );
    }
  }
  if (typeof data.triAgent !== "boolean") {
    throw new Error(`skills/${id}/SKILL.md: \`triAgent\` must be a boolean`);
  }
  if (!Array.isArray(data.commands)) {
    throw new Error(`skills/${id}/SKILL.md: \`commands\` must be an array (use [] for none)`);
  }
  return data;
}

function main() {
  const ids = listSkillDirs();
  if (ids.length === 0) {
    throw new Error("no skills/ directories with a SKILL.md found");
  }
  ids.map(validateSkill);

  // Invariant: the foundational protocol skill must always be present.
  if (!ids.includes("checkpoint-protocol")) {
    throw new Error("invariant: skills/checkpoint-protocol must exist");
  }

  console.log(`✓ skill catalog validated: ${ids.length} skills`);
}

main();

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
import { FLAGS, isKnown as isKnownFlag } from "../src/lib/flags/registry.js";

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
  validateSkillFlags(id, data);
  validateSkillCommands(id, data);
  return data;
}

function validateSkillFlags(id, data) {
  const flags = data.flags;
  if (flags === undefined || flags === null) return;
  if (typeof flags !== "object") {
    throw new Error(`skills/${id}/SKILL.md: \`flags\` must be an object`);
  }
  if (flags.required !== undefined) {
    if (!Array.isArray(flags.required)) {
      throw new Error(`skills/${id}/SKILL.md: \`flags.required\` must be an array`);
    }
    for (const name of flags.required) {
      if (typeof name !== "string") {
        throw new Error(`skills/${id}/SKILL.md: \`flags.required[]\` entries must be strings`);
      }
      if (!isKnownFlag(name)) {
        throw new Error(
          `skills/${id}/SKILL.md: flags.required references unknown flag \`${name}\` ` +
          `(register it in src/lib/flags/registry.js first)`,
        );
      }
    }
  }
  if (flags.exposes !== undefined) {
    if (!Array.isArray(flags.exposes)) {
      throw new Error(`skills/${id}/SKILL.md: \`flags.exposes\` must be an array`);
    }
    for (const entry of flags.exposes) {
      if (!entry || typeof entry !== "object") {
        throw new Error(`skills/${id}/SKILL.md: each \`flags.exposes\` entry must be an object`);
      }
      if (typeof entry.name !== "string") {
        throw new Error(`skills/${id}/SKILL.md: \`flags.exposes[].name\` is required`);
      }
      if (!isKnownFlag(entry.name)) {
        throw new Error(
          `skills/${id}/SKILL.md: flags.exposes references unknown flag \`${entry.name}\` ` +
          `(register it in src/lib/flags/registry.js first)`,
        );
      }
      const def = FLAGS[entry.name];
      if (typeof entry.default !== def.type) {
        throw new Error(
          `skills/${id}/SKILL.md: flags.exposes[${entry.name}].default is ` +
          `${typeof entry.default}, expected ${def.type}`,
        );
      }
    }
  }
}

function validateSkillCommands(id, data) {
  // Commands surface as `/<verb>` or `/<verb> <subcommand>`. The flag tracks
  // the verb only — subcommands inherit the parent's gate. Examples:
  //   "/api"          → skills.command.api.enabled
  //   "/api design"   → skills.command.api.enabled (same flag)
  //   "/migrate plan" → skills.command.migrate.enabled
  const seen = new Set();
  for (const cmd of data.commands) {
    if (typeof cmd !== "string") continue;
    const verb = cmd.replace(/^\//, "").split(/\s+/, 1)[0];
    if (!verb || seen.has(verb)) continue;
    seen.add(verb);
    const flagName = `skills.command.${verb}.enabled`;
    if (!isKnownFlag(flagName)) {
      throw new Error(
        `skills/${id}/SKILL.md: command verb \`/${verb}\` has no flag in the registry ` +
        `(add ${flagName} to src/lib/flags/registry.js)`,
      );
    }
  }
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

#!/usr/bin/env node
// validate-pm-mcp.mjs — Sprint 1 of opchain v1.3.
//
// Gates the build against drift in the PM-MCP integration. Pure check logic
// is in scripts/lib/pm-mcp-checks.mjs (importable for unit tests); this CLI
// wrapper reads files, dispatches checks, and translates results into
// stdout + exit code.

import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  PM_AWARE_SKILLS,
  checkPmYaml,
  checkSkillFile,
  checkToolNames,
} from "./lib/pm-mcp-checks.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SKILLS_DIR = join(ROOT, "skills");
const PM_YAML = join(ROOT, ".opchain", "pm.yaml");

const errors = [];
const warnings = [];

// ── pm.yaml ───────────────────────────────────────────────────────────────
let provider = "<unknown>";
if (!existsSync(PM_YAML)) {
  errors.push(`.opchain/pm.yaml not found — required for v1.3 PM-MCP integration`);
} else {
  const { errors: yamlErrs, parsed } = checkPmYaml(readFileSync(PM_YAML, "utf8"));
  errors.push(...yamlErrs);
  if (parsed?.provider) provider = parsed.provider;
}

// ── Each PM-aware SKILL.md ────────────────────────────────────────────────
for (const id of PM_AWARE_SKILLS) {
  const path = join(SKILLS_DIR, id, "SKILL.md");
  if (!existsSync(path)) {
    errors.push(`${id}: SKILL.md not found at ${path}`);
    continue;
  }
  const text = readFileSync(path, "utf8");
  errors.push(...checkSkillFile(id, text));
  const { errors: toolErrs, warnings: toolWarns } = checkToolNames(id, text);
  errors.push(...toolErrs);
  warnings.push(...toolWarns);
}

if (warnings.length) {
  console.warn(`validate-pm-mcp: ${warnings.length} warning(s):`);
  for (const w of warnings) console.warn(`  ⚠ ${w}`);
}

if (errors.length) {
  console.error(`validate-pm-mcp: ${errors.length} error(s):`);
  for (const e of errors) console.error(`  ✖ ${e}`);
  process.exit(1);
}

console.log(
  `validate-pm-mcp: OK — ${PM_AWARE_SKILLS.length} skills validated, ` +
  `provider=${provider}, ${warnings.length} warning(s)`,
);

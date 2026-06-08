#!/usr/bin/env node
// Generates src/generated/mcp-catalog.json — the data the opchain MCP server
// (src/lib/mcp/) serves to Codex and any other MCP client.
//
// Metadata only: id + the frontmatter fields used by list_skills / route /
// prompts. Full SKILL.md *bodies* are not bundled here — the Worker streams
// them from the ASSETS binding (public/docs/<id>/SKILL.md, produced by
// sync-docs.sh) and the local stdio server reads skills/<id>/SKILL.md from
// disk. The shared orchestrator protocol (skills/orchestrator.md) IS bundled,
// once, because it is not part of the synced public docs.
//
// Mirrors the src/generated/*.json precedent: tracked in git, regenerated in
// prebuild + pretest, imported by the Worker with `import ... with {type:json}`.
// Output is deterministic (skills sorted by id, no timestamps) so regenerating
// never produces a spurious diff.

import { existsSync, readFileSync, readdirSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import matter from "gray-matter";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SKILLS_DIR = join(ROOT, "skills");

function listSkillDirs(skillsDir) {
  return readdirSync(skillsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .filter((name) => existsSync(join(skillsDir, name, "SKILL.md")))
    .sort();
}

/**
 * Build the in-memory catalog from a skills/ directory. Shared by this
 * generator (writes the JSON the Worker imports) and mcp/local-server.mjs
 * (builds it live from disk), so the two transports can never disagree on
 * what the catalog looks like.
 */
export function buildCatalog(skillsDir = SKILLS_DIR) {
  const skills = listSkillDirs(skillsDir).map((id) => {
    const { data } = matter(readFileSync(join(skillsDir, id, "SKILL.md"), "utf8"));
    return {
      id,
      name: data.name ?? id,
      displayName: data.displayName ?? data.name ?? id,
      shortDesc: typeof data.shortDesc === "string" ? data.shortDesc : "",
      description: typeof data.description === "string" ? data.description.trim() : "",
      phases: Array.isArray(data.phases) ? data.phases : [],
      triAgent: data.triAgent === true,
      commands: Array.isArray(data.commands) ? data.commands.filter((c) => typeof c === "string") : [],
      version: data.version != null ? String(data.version) : "",
    };
  });

  const orchestratorPath = join(skillsDir, "orchestrator.md");
  const orchestrator = existsSync(orchestratorPath) ? readFileSync(orchestratorPath, "utf8") : "";

  return { skills, orchestrator };
}

function main() {
  const catalog = buildCatalog();
  if (catalog.skills.length === 0) {
    throw new Error("gen-mcp-catalog: no skills/ directories with a SKILL.md found");
  }
  const outDir = join(ROOT, "src", "generated");
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, "mcp-catalog.json"), JSON.stringify(catalog, null, 2) + "\n");
  console.log(`✓ mcp catalog generated: ${catalog.skills.length} skills`);
}

// Run only when invoked directly (not when imported by the local server).
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main();
}

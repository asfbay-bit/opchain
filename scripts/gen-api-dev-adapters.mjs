#!/usr/bin/env node
/**
 * Codegen: read skills/stack-forge/packs/<id>/pack.yml for every
 * kind=language pack → emit src/generated/api-dev-adapters.json with
 * the per-language scaffold metadata api-dev needs at runtime
 * (testRunner, buildCmd, lintCmd, langRef path).
 *
 * This is v1.4 PR 3's build-time half of the hybrid driver semantics:
 * deploy-ops dispatches at runtime (small lookup via
 * src/lib/pack-dispatch.js), api-dev codegens richer per-language
 * scaffold modules at build time so the Designer/Builder/Conformance
 * loop has a typed view of which commands to template into generated
 * code.
 *
 * Runs in prebuild AFTER gen-stack-packs (so the pack contract is
 * already validated) and BEFORE gen-flags (so the flag registry can
 * still synthesize coverage flags). The output is consumed by
 * api-dev's per-language scaffolding logic; tests pin the shape so
 * accidental drift in pack.yml shows up as a test failure.
 *
 * Like gen-stack-packs.mjs, this script is hand-rolled (no ajv) to
 * keep prebuild zero-dep beyond js-yaml.
 */

import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import yaml from "js-yaml";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
// Env overrides let tests point at fixture trees. Build-time runs leave them
// unset and use the real repo paths.
const PACKS_DIR = process.env.OPCHAIN_PACKS_DIR ?? join(ROOT, "skills", "stack-forge", "packs");
const OUT_DIR = process.env.OPCHAIN_OUT_DIR ?? join(ROOT, "src", "generated");
const OUT_FILE = join(OUT_DIR, "api-dev-adapters.json");

function listLanguagePacks() {
  if (!existsSync(PACKS_DIR)) return [];
  const dirs = readdirSync(PACKS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .filter((name) => existsSync(join(PACKS_DIR, name, "pack.yml")));

  const out = [];
  for (const id of dirs) {
    const file = join(PACKS_DIR, id, "pack.yml");
    const data = yaml.load(readFileSync(file, "utf8"));
    if (data && data.kind === "language") {
      out.push({ id, data });
    }
  }
  return out.sort((a, b) => a.id.localeCompare(b.id));
}

function buildAdapter({ id, data }) {
  // Required by the schema for kind=language packs; gen-stack-packs has
  // already enforced this, so a missing field here is a programmer
  // error and worth crashing on.
  if (typeof data.testRunner !== "string" || data.testRunner.length === 0) {
    throw new Error(`pack "${id}": kind=language pack is missing testRunner (gen-stack-packs should have caught this)`);
  }

  return {
    id: data.id,
    displayName: data.displayName ?? data.id,
    status: data.status,
    testRunner: data.testRunner,
    buildCmd: data.buildCmd ?? null,
    lintCmd: data.lintCmd ?? null,
    langRef: data.langRef ?? null,
  };
}

function main() {
  const packs = listLanguagePacks();
  const adapters = packs.map(buildAdapter);

  mkdirSync(OUT_DIR, { recursive: true });
  const body = JSON.stringify(adapters, null, 2) + "\n";
  writeFileSync(OUT_FILE, body, "utf8");

  console.log(`✓ api-dev adapters generated: ${adapters.length} language pack(s)`);
}

main();

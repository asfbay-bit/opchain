#!/usr/bin/env node
/**
 * Codegen: read skills/stack-forge/packs/<id>/pack.yml → emit
 * src/generated/packs-catalog.json — a sorted, typed list of pack
 * records consumed by the site's /coverage page at build time.
 *
 * gen-stack-packs.mjs already emits coverage-flags.json (the
 * registry-facing shape: id/kind/status/displayName). This script
 * emits a richer record per pack so the /coverage page can render
 * testRunner / buildCmd / lintCmd for languages, the underlying
 * language for frameworks, mobilePlatform + defaultPlatform for
 * mobile packs, etc. — without making the site depend on js-yaml.
 *
 * Runs in prebuild AFTER gen-stack-packs (so the pack contract is
 * already validated) and AFTER gen-api-dev-adapters (so the two
 * site-facing artifacts settle in the same prebuild pass). Output
 * committed as a baseline matching the coverage-flags.json
 * convention; CI overwrites on every build.
 */

import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import yaml from "js-yaml";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PACKS_DIR = process.env.OPCHAIN_PACKS_DIR ?? join(ROOT, "skills", "oc-stack-forge", "packs");
const OUT_DIR = process.env.OPCHAIN_OUT_DIR ?? join(ROOT, "src", "generated");
const OUT_FILE = join(OUT_DIR, "packs-catalog.json");

// Whitelist of fields the catalog surfaces. Any field present in pack.yml
// but absent from this list is intentionally NOT emitted (e.g. ref-doc
// paths, which are not URL-resolvable from the site).
const SURFACED_FIELDS = new Set([
  "id", "displayName", "kind", "status", "since",
  "language", "frameworks",
  "testRunner", "buildCmd", "lintCmd",
  "mobilePlatform",
  "defaultPlatform", "supportedPlatforms",
  "deprecated",
]);

function listPackIds() {
  if (!existsSync(PACKS_DIR)) return [];
  return readdirSync(PACKS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .filter((id) => existsSync(join(PACKS_DIR, id, "pack.yml")))
    .sort();
}

function loadPack(id) {
  const file = join(PACKS_DIR, id, "pack.yml");
  const data = yaml.load(readFileSync(file, "utf8"));
  const out = {};
  for (const [k, v] of Object.entries(data)) {
    if (SURFACED_FIELDS.has(k)) out[k] = v;
  }
  // displayName fallback matches gen-stack-packs.mjs's
  // synthesizeCoverageFlags — keep the two artifacts in sync.
  if (out.displayName === undefined) out.displayName = id;
  return out;
}

function main() {
  const packs = listPackIds().map(loadPack);
  packs.sort((a, b) => (a.displayName ?? a.id).localeCompare(b.displayName ?? b.id));

  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(OUT_FILE, JSON.stringify(packs, null, 2) + "\n", "utf8");
  console.log(`✓ packs catalog generated: ${packs.length} pack(s)`);
}

main();

#!/usr/bin/env node
/**
 * Codegen: read skills/stack-forge/packs/<id>/pack.yml → validate against
 * the contract in skills/stack-forge/packs/_schema.json → emit
 * src/generated/coverage-flags.json.
 *
 * This is the first step of prebuild. It runs BEFORE gen-flags so that
 * src/lib/flags/registry.js can import the generated coverage-flags JSON
 * and synthesize one flag per language/framework/mobile pack.
 *
 * The validator is hand-rolled (no ajv) to keep the prebuild zero-dep
 * beyond what's already in package.json. `_schema.json` is the human-
 * readable spec and is also consumable by yaml-language-server for
 * editor autocomplete in pack.yml.
 *
 * Coverage-flag synthesis rules (must mirror src/lib/flags/registry.js):
 *   - kind ∈ {language, framework, mobile, vector-db} → emit a flag
 *   - kind ∈ {deploy-target}                          → no flag (sub-selection only)
 *   - flag default = (status === 'stable')
 */

import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import yaml from "js-yaml";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
// Env overrides exist so tests can point the script at a fixture tree without
// shimming the whole repo. Build-time runs leave them unset and use the real
// project paths.
const PACKS_DIR = process.env.OPCHAIN_PACKS_DIR ?? join(ROOT, "skills", "oc-stack-forge", "packs");
const OUT_DIR = process.env.OPCHAIN_OUT_DIR ?? join(ROOT, "src", "generated");
const OUT_FILE = join(OUT_DIR, "coverage-flags.json");

const KINDS = new Set(["language", "framework", "deploy-target", "mobile", "vector-db"]);
const STATUSES = new Set(["stable", "beta", "experimental", "deprecated"]);
const MOBILE_PLATFORMS = new Set(["ios", "android", "flutter", "react-native"]);
const COVERAGE_KINDS = new Set(["language", "framework", "mobile", "vector-db"]);

const ID_RE = /^[a-z][a-z0-9-]*$/;
const SEMVER_RE = /^\d+\.\d+\.\d+$/;
const REF_PATH_RE = /^[a-zA-Z0-9_./-]+\.md$/;

const REF_FIELDS = ["langRef", "frameworkRef", "deployRef", "testRef", "mobileRef", "vectorRef"];
const REF_SOFT_BYTES = 50 * 1024;
const REF_HARD_BYTES = 100 * 1024;

const ALLOWED_FIELDS = new Set([
  "id", "displayName", "kind", "status", "since",
  "language", "frameworks", "testRunner", "buildCmd", "lintCmd",
  "defaultPlatform", "supportedPlatforms", "mobilePlatform",
  "langRef", "frameworkRef", "deployRef", "testRef", "mobileRef", "vectorRef",
  "deprecated",
]);

const DEPRECATED_ALLOWED_FIELDS = new Set(["since", "replacement", "notes"]);

class PackError extends Error {
  constructor(packId, msg) {
    super(packId ? `pack "${packId}": ${msg}` : msg);
    this.packId = packId;
  }
}

function listPackDirs() {
  if (!existsSync(PACKS_DIR)) return [];
  return readdirSync(PACKS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .filter((name) => existsSync(join(PACKS_DIR, name, "pack.yml")))
    .sort();
}

function loadPack(id) {
  const file = join(PACKS_DIR, id, "pack.yml");
  const raw = readFileSync(file, "utf8");
  let data;
  try {
    data = yaml.load(raw);
  } catch (err) {
    throw new PackError(id, `pack.yml is not valid YAML: ${err.message}`);
  }
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new PackError(id, "pack.yml must contain a YAML object at the root");
  }
  return { id, file, data };
}

function validatePack({ id, data }) {
  if (data.id !== id) {
    throw new PackError(id, `pack.yml \`id: ${data.id}\` does not match directory name`);
  }
  for (const key of Object.keys(data)) {
    if (!ALLOWED_FIELDS.has(key)) {
      throw new PackError(id, `unknown field \`${key}\` (allowed: ${[...ALLOWED_FIELDS].join(", ")})`);
    }
  }

  // Required scalars.
  if (typeof data.id !== "string" || !ID_RE.test(data.id)) {
    throw new PackError(id, `id must match /${ID_RE.source}/`);
  }
  if (data.id.length < 2 || data.id.length > 40) {
    throw new PackError(id, `id length must be 2..40 (got ${data.id.length})`);
  }
  if (typeof data.kind !== "string" || !KINDS.has(data.kind)) {
    throw new PackError(id, `kind must be one of ${[...KINDS].join("|")}`);
  }
  if (typeof data.status !== "string" || !STATUSES.has(data.status)) {
    throw new PackError(id, `status must be one of ${[...STATUSES].join("|")}`);
  }
  if (typeof data.since !== "string" || !SEMVER_RE.test(data.since)) {
    throw new PackError(id, `since must be semver (e.g. "1.4.0")`);
  }

  if (data.displayName !== undefined) {
    if (typeof data.displayName !== "string") {
      throw new PackError(id, `displayName must be a string`);
    }
    if (data.displayName.length < 1 || data.displayName.length > 60) {
      throw new PackError(id, `displayName length must be 1..60`);
    }
  }

  // Conditional requirements.
  if (data.kind === "framework" && typeof data.language !== "string") {
    throw new PackError(id, `kind=framework requires language (pack id of the underlying language)`);
  }
  if (data.kind === "language" && (typeof data.testRunner !== "string" || data.testRunner.length === 0)) {
    throw new PackError(id, `kind=language requires testRunner`);
  }
  if (data.kind === "mobile" && (typeof data.mobilePlatform !== "string" || !MOBILE_PLATFORMS.has(data.mobilePlatform))) {
    throw new PackError(id, `kind=mobile requires mobilePlatform ∈ ${[...MOBILE_PLATFORMS].join("|")}`);
  }
  if (data.status === "deprecated") {
    if (!data.deprecated || typeof data.deprecated !== "object") {
      throw new PackError(id, `status=deprecated requires a deprecated block`);
    }
  }

  // Cross-pack references — shape only (existence checked in graph pass).
  if (data.language !== undefined && (typeof data.language !== "string" || !ID_RE.test(data.language))) {
    throw new PackError(id, `language must be a pack id matching /${ID_RE.source}/`);
  }
  if (data.frameworks !== undefined) {
    if (!Array.isArray(data.frameworks)) throw new PackError(id, `frameworks must be an array`);
    const seen = new Set();
    for (const fw of data.frameworks) {
      if (typeof fw !== "string" || !ID_RE.test(fw)) {
        throw new PackError(id, `frameworks[] entries must be pack ids matching /${ID_RE.source}/`);
      }
      if (seen.has(fw)) throw new PackError(id, `frameworks contains duplicate \`${fw}\``);
      seen.add(fw);
    }
  }
  if (data.defaultPlatform !== undefined && (typeof data.defaultPlatform !== "string" || !ID_RE.test(data.defaultPlatform))) {
    throw new PackError(id, `defaultPlatform must be a pack id`);
  }
  if (data.supportedPlatforms !== undefined) {
    if (!Array.isArray(data.supportedPlatforms)) throw new PackError(id, `supportedPlatforms must be an array`);
    const seen = new Set();
    for (const p of data.supportedPlatforms) {
      if (typeof p !== "string" || !ID_RE.test(p)) {
        throw new PackError(id, `supportedPlatforms[] entries must be pack ids`);
      }
      if (seen.has(p)) throw new PackError(id, `supportedPlatforms contains duplicate \`${p}\``);
      seen.add(p);
    }
  }
  if (data.defaultPlatform !== undefined && data.supportedPlatforms !== undefined) {
    if (!data.supportedPlatforms.includes(data.defaultPlatform)) {
      throw new PackError(id, `defaultPlatform \`${data.defaultPlatform}\` must be a member of supportedPlatforms`);
    }
  }

  for (const ref of REF_FIELDS) {
    if (data[ref] !== undefined) {
      if (typeof data[ref] !== "string" || !REF_PATH_RE.test(data[ref])) {
        throw new PackError(id, `${ref} must be a relative .md path matching /${REF_PATH_RE.source}/`);
      }
    }
  }

  if (data.deprecated !== undefined) {
    const d = data.deprecated;
    if (!d || typeof d !== "object" || Array.isArray(d)) {
      throw new PackError(id, `deprecated must be an object`);
    }
    for (const k of Object.keys(d)) {
      if (!DEPRECATED_ALLOWED_FIELDS.has(k)) {
        throw new PackError(id, `deprecated.${k} is not allowed (allowed: ${[...DEPRECATED_ALLOWED_FIELDS].join(", ")})`);
      }
    }
    if (typeof d.since !== "string" || !SEMVER_RE.test(d.since)) {
      throw new PackError(id, `deprecated.since must be semver`);
    }
    if (typeof d.replacement !== "string" || !ID_RE.test(d.replacement)) {
      throw new PackError(id, `deprecated.replacement must be a pack id`);
    }
    if (d.notes !== undefined && typeof d.notes !== "string") {
      throw new PackError(id, `deprecated.notes must be a string`);
    }
  }
}

function checkRefFiles({ id, file, data }, warnings) {
  const packDir = dirname(file);
  for (const ref of REF_FIELDS) {
    const p = data[ref];
    if (p === undefined) continue;
    const abs = join(packDir, p);
    if (!existsSync(abs)) {
      throw new PackError(id, `${ref} → \`${p}\` does not exist (looked at ${relative(ROOT, abs)})`);
    }
    const size = statSync(abs).size;
    if (size > REF_HARD_BYTES) {
      throw new PackError(id, `${ref} → \`${p}\` is ${size} bytes; hard cap is ${REF_HARD_BYTES} bytes`);
    }
    if (size > REF_SOFT_BYTES) {
      warnings.push(`${id}: ${ref} → \`${p}\` is ${size} bytes; soft cap is ${REF_SOFT_BYTES} bytes (consider trimming)`);
    }
  }
}

function buildGraph(packs) {
  const byId = new Map();
  for (const pack of packs) {
    if (byId.has(pack.data.id)) {
      throw new PackError(pack.data.id, `duplicate pack id (also defined elsewhere)`);
    }
    byId.set(pack.data.id, pack);
  }

  // Resolve and validate references.
  for (const pack of packs) {
    const { id, data } = pack;
    const refs = [];
    if (data.language) refs.push(["language", data.language]);
    if (Array.isArray(data.frameworks)) for (const fw of data.frameworks) refs.push(["frameworks", fw]);
    if (data.defaultPlatform) refs.push(["defaultPlatform", data.defaultPlatform]);
    if (Array.isArray(data.supportedPlatforms)) for (const p of data.supportedPlatforms) refs.push(["supportedPlatforms", p]);
    if (data.deprecated?.replacement) refs.push(["deprecated.replacement", data.deprecated.replacement]);

    for (const [field, refId] of refs) {
      const target = byId.get(refId);
      if (!target) {
        throw new PackError(id, `${field} references missing pack \`${refId}\``);
      }
      // Kind compatibility.
      const k = target.data.kind;
      if ((field === "language") && k !== "language") {
        throw new PackError(id, `${field} → \`${refId}\` must be kind=language (got ${k})`);
      }
      if (field === "frameworks" && k !== "framework") {
        throw new PackError(id, `${field} → \`${refId}\` must be kind=framework (got ${k})`);
      }
      if ((field === "defaultPlatform" || field === "supportedPlatforms") && k !== "deploy-target") {
        throw new PackError(id, `${field} → \`${refId}\` must be kind=deploy-target (got ${k})`);
      }
      if (field === "deprecated.replacement" && target.data.status === "deprecated") {
        throw new PackError(id, `deprecated.replacement → \`${refId}\` is itself deprecated`);
      }
    }
  }

  // Bidirectional consistency: framework ↔ language frameworks list.
  for (const pack of packs) {
    const { id, data } = pack;
    if (data.kind === "framework" && data.language) {
      const lang = byId.get(data.language);
      const list = Array.isArray(lang.data.frameworks) ? lang.data.frameworks : [];
      if (!list.includes(id)) {
        throw new PackError(id, `kind=framework with language=\`${data.language}\`, but that language pack's frameworks list does not include \`${id}\``);
      }
    }
    if (data.kind === "language" && Array.isArray(data.frameworks)) {
      for (const fw of data.frameworks) {
        const fwPack = byId.get(fw);
        if (fwPack.data.language !== id) {
          throw new PackError(id, `frameworks[\`${fw}\`] does not point back: that framework's language=\`${fwPack.data.language}\` (expected \`${id}\`)`);
        }
      }
    }
  }

  return byId;
}

function synthesizeCoverageFlags(packs) {
  return packs
    .filter((p) => COVERAGE_KINDS.has(p.data.kind))
    .map((p) => ({
      id: p.data.id,
      kind: p.data.kind,
      status: p.data.status,
      displayName: p.data.displayName ?? p.data.id,
    }));
}

function emit(coverageFlags) {
  mkdirSync(OUT_DIR, { recursive: true });
  const body = JSON.stringify(coverageFlags, null, 2) + "\n";
  writeFileSync(OUT_FILE, body, "utf8");
}

function main() {
  const ids = listPackDirs();
  const packs = ids.map(loadPack);

  const warnings = [];
  for (const pack of packs) {
    validatePack(pack);
    checkRefFiles(pack, warnings);
  }
  buildGraph(packs);

  const coverage = synthesizeCoverageFlags(packs);
  emit(coverage);

  for (const w of warnings) console.warn(`⚠  ${w}`);
  console.log(`✓ stack-forge packs validated: ${ids.length} pack(s), ${coverage.length} coverage flag(s)`);
}

main();

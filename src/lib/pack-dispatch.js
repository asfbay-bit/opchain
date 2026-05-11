/**
 * Runtime pack-aware dispatch — v1.4 PR 3 (ADEV-330).
 *
 * Three skills consume stack-forge packs at runtime:
 *
 *   - deploy-ops calls `getDispatchTarget(packId)` to decide which
 *     provider-section of its SKILL.md applies (Render vs Heroku vs
 *     Cloudflare vs Fly.io vs Shuttle). Default is null while
 *     deploy-target packs are still pending — PR 7 (ADEV-337) lands
 *     the hosting adapters and wires the supportedPlatforms graph.
 *
 *   - stack-forge calls `dispatchMobile(packId)` to render a release
 *     checklist instead of executing commands for kind=mobile packs.
 *     The iOS pack lands in PR 6 (ADEV-336); the dispatch logic +
 *     tests ride along here so PR 6 can stay narrow.
 *
 *   - api-dev consumes the BUILD-TIME codegen output in
 *     src/generated/api-dev-adapters.json — that file is the typed
 *     view of per-language scaffold metadata. api-dev does not need
 *     this runtime module; it imports the generated JSON directly.
 *
 * Design constraints:
 *   - Zero deps beyond Node stdlib + js-yaml (matches gen-stack-packs).
 *   - All file paths overridable via OPCHAIN_PACKS_DIR for tests.
 *   - Pure functions: every helper takes its data as input or reads
 *     from disk once via a cached loader. No global state outside the
 *     module-scope cache.
 *   - Returns null / explicit error structures for "pack missing" or
 *     "wrong kind" — callers decide whether to throw or fall back.
 */

import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import yaml from "js-yaml";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

function packsDir() {
  // Read on every call so tests can flip OPCHAIN_PACKS_DIR per case
  // without restarting the module. Production callers hit the same env
  // var once at startup so the cost is one process.env lookup.
  return process.env.OPCHAIN_PACKS_DIR ?? join(ROOT, "skills", "stack-forge", "packs");
}

const ID_RE = /^[a-z][a-z0-9-]*$/;

/**
 * Load and parse a pack.yml by id. Returns the parsed data object
 * (matching the schema's allowed-fields set) or null if the pack
 * does not exist.
 *
 * Throws on YAML parse errors or id-pattern violation — those are
 * programmer errors, not "pack missing".
 */
export function getLanguagePack(id) {
  if (typeof id !== "string" || !ID_RE.test(id)) {
    throw new Error(`pack-dispatch: invalid pack id "${id}"`);
  }
  const file = join(packsDir(), id, "pack.yml");
  if (!existsSync(file)) return null;
  const data = yaml.load(readFileSync(file, "utf8"));
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error(`pack-dispatch: pack "${id}" pack.yml did not parse to an object`);
  }
  return data;
}

/**
 * Resolve the deploy-target hint for a pack. deploy-ops calls this
 * when choosing which provider-section of its SKILL.md applies.
 *
 * Returns:
 *   { defaultPlatform, supportedPlatforms } when the pack declares them.
 *   { defaultPlatform: null, supportedPlatforms: [] } when the pack exists
 *     but does not declare platforms (true for the 5 language packs in
 *     PR 2 — deploy-target packs land in PR 7).
 *   null when the pack does not exist.
 *
 * Callers should treat null + empty-platforms identically: fall back to
 * the SKILL.md's hardcoded provider matrix.
 */
export function getDispatchTarget(packId) {
  const pack = getLanguagePack(packId);
  if (!pack) return null;
  return {
    defaultPlatform: typeof pack.defaultPlatform === "string" ? pack.defaultPlatform : null,
    supportedPlatforms: Array.isArray(pack.supportedPlatforms) ? [...pack.supportedPlatforms] : [],
  };
}

/**
 * Dispatch for kind=mobile packs. stack-forge calls this to render
 * a release checklist instead of executing commands — mobile deploys
 * are App Store / Play Store / TestFlight reviews, not `git push`.
 *
 * Returns:
 *   { kind: "mobile", platform, displayName, mobileRef, releaseChecklist }
 *     for a valid mobile pack.
 *   { kind: "not-mobile", actualKind } when the pack exists but isn't
 *     kind=mobile — callers should fall back to the regular dispatcher.
 *   null when the pack does not exist.
 *
 * The releaseChecklist string is the user-facing dispatch envelope —
 * stack-forge's SKILL.md renders it verbatim so the agent doesn't
 * accidentally try to run a deploy command.
 */
export function dispatchMobile(packId) {
  const pack = getLanguagePack(packId);
  if (!pack) return null;
  if (pack.kind !== "mobile") {
    return { kind: "not-mobile", actualKind: pack.kind };
  }
  return {
    kind: "mobile",
    platform: pack.mobilePlatform,
    displayName: pack.displayName ?? pack.id,
    mobileRef: pack.mobileRef ?? null,
    releaseChecklist:
      `${pack.displayName ?? pack.id} (${pack.mobilePlatform}) — checklist-driven, not automated. ` +
      `stack-forge will render the release checklist from ${pack.mobileRef ?? "the pack's mobileRef"} ` +
      `rather than executing commands. App Store / Play Store review windows are the gate.`,
  };
}

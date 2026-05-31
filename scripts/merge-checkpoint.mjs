#!/usr/bin/env node
/**
 * Git merge driver for .checkpoints/<skill>.checkpoint.json.
 *
 * Two branches that ran /bugcheck (or any skill that bumps a checkpoint)
 * will both have rewritten `updated_at` and `skill_state.last_run.at`
 * even when their real diffs don't overlap. The default text driver
 * sees those lines as conflicts on every PR — historically 2-4 false
 * conflicts per merge. This driver:
 *
 *   1. Parses base/ours/theirs as JSON.
 *   2. Recursively 3-way merges. base==ours → take theirs; base==theirs
 *      → take ours; both sides identical → use it.
 *   3. For telemetry-only fields (`updated_at`, `skill_state.last_run`,
 *      `.run_history`, `.streak`, `.bypasses`, `.carried_debt`), if the
 *      recursive merge would conflict, take whichever side has the
 *      newer top-level `updated_at`. Telemetry is per-run scratch — it
 *      doesn't deserve a manual resolution.
 *   4. Anything else that conflicts is a *real* content collision
 *      (two sessions edited the same `progress_summary`, `next_actions`,
 *      etc.). Fall back to `git merge-file` so the reviewer gets normal
 *      <<<<<<< markers and exit non-zero.
 *
 * Invoked from .gitattributes:
 *   .checkpoints/*.checkpoint.json merge=opchain-checkpoint
 * with driver registered by `scripts/install-git-drivers.mjs` as:
 *   node scripts/merge-checkpoint.mjs %O %A %B %P
 *
 * Exit codes: 0 = merged cleanly; 1 = real conflict, %A has markers.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const [, , basePath, oursPath, theirsPath, displayPath = oursPath] = process.argv;

function tryReadJSON(p) {
  try { return JSON.parse(readFileSync(p, "utf8")); }
  catch { return undefined; }
}

const base = tryReadJSON(basePath);
const ours = tryReadJSON(oursPath);
const theirs = tryReadJSON(theirsPath);

// If any side won't parse as JSON, we can't reason about it structurally.
// Hand off to the default textual merge so the user can fix it by hand.
if (ours === undefined || theirs === undefined) {
  fallbackTextualMerge();
  process.exit(1);
}

const TELEMETRY_PATHS = new Set([
  "updated_at",
  "skill_state.last_run",
  "skill_state.run_history",
  "skill_state.streak",
  "skill_state.bypasses",
  "skill_state.carried_debt",
]);

function isObject(v) {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function deepEqual(a, b) {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (a === null || b === null) return false;
  if (Array.isArray(a)) {
    if (!Array.isArray(b) || a.length !== b.length) return false;
    return a.every((v, i) => deepEqual(v, b[i]));
  }
  if (typeof a === "object") {
    const ak = Object.keys(a);
    const bk = Object.keys(b);
    if (ak.length !== bk.length) return false;
    return ak.every((k) => deepEqual(a[k], b[k]));
  }
  return false;
}

function newerSideByUpdatedAt() {
  const o = Date.parse(ours?.updated_at ?? "");
  const t = Date.parse(theirs?.updated_at ?? "");
  if (Number.isNaN(o) && Number.isNaN(t)) return "ours";
  if (Number.isNaN(o)) return "theirs";
  if (Number.isNaN(t)) return "ours";
  return o >= t ? "ours" : "theirs";
}

const newerSide = newerSideByUpdatedAt();
const conflicts = [];

function isTelemetryPath(path) {
  if (TELEMETRY_PATHS.has(path)) return true;
  for (const p of TELEMETRY_PATHS) {
    if (path.startsWith(p + ".")) return true;
  }
  return false;
}

function mergeNode(baseV, oursV, theirsV, path) {
  if (deepEqual(oursV, theirsV)) return oursV;

  // Telemetry — take the newer side wholesale, even if both diverged
  // from base. Two pre-commit runs racing on `last_run` is not a
  // semantic conflict.
  if (isTelemetryPath(path)) {
    return newerSide === "ours" ? oursV : theirsV;
  }

  if (deepEqual(baseV, oursV)) return theirsV;
  if (deepEqual(baseV, theirsV)) return oursV;

  if (isObject(oursV) && isObject(theirsV)) {
    const baseObj = isObject(baseV) ? baseV : {};
    const out = {};
    const keys = new Set([
      ...Object.keys(baseObj),
      ...Object.keys(oursV),
      ...Object.keys(theirsV),
    ]);
    for (const k of keys) {
      const childPath = path ? `${path}.${k}` : k;
      const merged = mergeNode(baseObj[k], oursV[k], theirsV[k], childPath);
      if (merged !== undefined) out[k] = merged;
    }
    return out;
  }

  conflicts.push(path);
  return newerSide === "ours" ? oursV : theirsV;
}

const result = mergeNode(base ?? {}, ours, theirs, "");

if (conflicts.length) {
  process.stderr.write(
    `opchain-checkpoint merge: real content conflict(s) in ${displayPath}:\n  ` +
      conflicts.join("\n  ") +
      "\nLeaving standard conflict markers — resolve by hand.\n",
  );
  fallbackTextualMerge();
  process.exit(1);
}

writeFileSync(oursPath, JSON.stringify(result, null, 2) + "\n");
process.exit(0);

function fallbackTextualMerge() {
  // `git merge-file` writes markers in place and exits with the conflict
  // count (or -1 on error). We don't care about its exit code — we're
  // already going to exit 1; we just need the markers on disk so the
  // reviewer sees the standard UX.
  spawnSync(
    "git",
    ["merge-file", "-L", "ours", "-L", "base", "-L", "theirs", oursPath, basePath, theirsPath],
    { stdio: "inherit" },
  );
}

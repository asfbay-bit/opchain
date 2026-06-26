#!/usr/bin/env node
/**
 * Telemetry CLI — opt-in, local-first usage metering for the opchain skills
 * pipeline. Backs the /oc-telemetry skill (skills/oc-telemetry-ops).
 *
 * The store is a single local SQLite file at <repo>/.checkpoints/usage.sqlite,
 * **gitignored** (unlike the tracked .checkpoint.json files). It records *that*
 * a skill/phase ran and what it cost — never *what* was in the prompt. The
 * privacy guarantee is structural: prompt text, file paths, project names, and
 * any user identifier are NOT columns, so they cannot be recorded.
 *
 * Subcommands:
 *   enable                 Opt in — create the store + schema if absent, mint a
 *                          random machine-local handle, set
 *                          telemetry_handle.enabled = true in the checkpoint.
 *   disable                Opt out — set enabled = false; metering stops at once.
 *                          The local store is KEPT (deleting it is your call).
 *   status                 Show consent state, store path, handle, row count.
 *   record [--flags]       Append one metered run. NO-OP unless enabled
 *                          (the "opt-out → zero writes" guarantee).
 *
 * Design notes:
 *   - Pure Node, zero deps. Uses node:sqlite (built into Node 22) so there is no
 *     better-sqlite3 / native-addon install step — matches the repo's
 *     "scripts are pure Node, no deps" stance (see scripts/checkpoint.mjs).
 *   - Consent is the checkpoint's telemetry_handle.enabled, NOT the presence of
 *     the store or the field. enable/disable/record all read it; record refuses
 *     to write when it is anything other than `true`.
 *   - The handle (telemetry_handle.id) is a random, machine-local id minted at
 *     enable time. It is never derived from any user identity and is never
 *     exported. Re-enabling from off mints a fresh handle (a new local grouping),
 *     matching references/privacy-consent.md.
 */

import { DatabaseSync } from "node:sqlite";
import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DIR = join(ROOT, ".checkpoints");
const SINK_REL = ".checkpoints/usage.sqlite";
const SINK = join(ROOT, SINK_REL);
const CHECKPOINT = join(DIR, "oc-telemetry-ops.checkpoint.json");
const SCHEMA_VERSION = "1.1";

// ── SQLite schema (mirrors skills/oc-telemetry-ops/references/local-metering.md) ──
// No table stores prompt text, file contents, file paths, or any user identifier.
const SCHEMA = `
CREATE TABLE IF NOT EXISTS runs (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  handle        TEXT NOT NULL,      -- anonymous local id (telemetry_handle.id), NOT user-derived
  skill         TEXT NOT NULL,      -- e.g. "oc-app-architect"
  phase         TEXT,               -- e.g. "build", "spec" (skill-defined; nullable)
  command       TEXT,               -- the verb only, e.g. "/oc-build" (no args)
  model_tier    TEXT,               -- "haiku" | "sonnet" | "opus" | "fable" (tier, not full id)
  cost_usd      REAL,               -- attributed by oc-cost-ops (nullable if not costed)
  input_tokens  INTEGER,            -- counts only, never content
  output_tokens INTEGER,
  outcome       TEXT,               -- "pass" | "fail" | "complete" | null
  started_at    TEXT NOT NULL,      -- ISO-8601 UTC
  duration_ms   INTEGER
);

CREATE TABLE IF NOT EXISTS events (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id     INTEGER NOT NULL REFERENCES runs(id),
  kind       TEXT NOT NULL,         -- "eval" | "gate" | "sprint" | ...
  label      TEXT,                  -- short, non-identifying (e.g. "sprint-2")
  score      REAL,                  -- eval score if applicable (rubric-relative)
  at         TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_runs_skill   ON runs(skill);
CREATE INDEX IF NOT EXISTS idx_runs_started ON runs(started_at);
`;

const nowISO = () => new Date().toISOString();
const mintHandle = () => `anon-${randomBytes(4).toString("hex")}`;

function openStore() {
  if (!existsSync(DIR)) mkdirSync(DIR, { recursive: true });
  const db = new DatabaseSync(SINK);
  db.exec(SCHEMA);
  return db;
}

function readCheckpoint() {
  if (!existsSync(CHECKPOINT)) return null;
  return JSON.parse(readFileSync(CHECKPOINT, "utf8"));
}

function scaffold() {
  const now = nowISO();
  return {
    protocol_version: SCHEMA_VERSION,
    skill: "oc-telemetry-ops",
    project: "opchain.dev",
    project_dir: ROOT,
    created_at: now,
    updated_at: now,
    phase: "build",
    step: "scaffolded",
    status: "in_progress",
    progress_summary: "Telemetry checkpoint scaffolded; metering not yet enabled.",
    next_actions: ["Run /oc-telemetry enable to opt in to local metering."],
  };
}

function writeCheckpoint(data) {
  if (!existsSync(DIR)) mkdirSync(DIR, { recursive: true });
  data.protocol_version = SCHEMA_VERSION;
  data.updated_at = nowISO();
  writeFileSync(CHECKPOINT, JSON.stringify(data, null, 2) + "\n");
}

function isEnabled(cp) {
  const th = cp?.telemetry_handle;
  return !!th && typeof th === "object" && th.enabled === true;
}

// ── enable ─────────────────────────────────────────────────────────────────
function cmdEnable() {
  const db = openStore(); // create file + schema if absent
  db.close();

  const cp = readCheckpoint() ?? scaffold();
  const already = isEnabled(cp);
  // Re-enabling from off starts a fresh local grouping (new handle); an
  // already-enabled store keeps its handle. References/privacy-consent.md.
  const prev = cp.telemetry_handle && typeof cp.telemetry_handle === "object"
    ? cp.telemetry_handle
    : {};
  const id = already && typeof prev.id === "string" ? prev.id : mintHandle();
  const since = already && prev.since ? prev.since : nowISO();

  cp.telemetry_handle = { enabled: true, id, sink: SINK_REL, since };
  cp.phase = "build";
  cp.step = "metering-enabled";
  cp.status = "in_progress";
  cp.progress_summary =
    "Opt-in local metering is ENABLED. Skill/phase runs are recorded to " +
    `${SINK_REL} (gitignored, content-free). Only an anonymized aggregate ` +
    "ever leaves the machine, and only on explicit /oc-telemetry export.";
  cp.next_actions = [
    "Let the pipeline run — metered rows accumulate in .checkpoints/usage.sqlite.",
    "Run /oc-telemetry aggregate once there's data to roll up.",
    "Run /oc-telemetry export to emit the anonymized /dashboard aggregate.",
  ];
  writeCheckpoint(cp);

  console.log("✓ telemetry ENABLED");
  console.log(`  store:  ${SINK_REL}  (created${already ? " earlier" : ""}, gitignored)`);
  console.log(`  handle: ${id}  (random, machine-local, never exported)`);
  console.log(`  since:  ${since}`);
  console.log(`  consent: telemetry_handle.enabled = true in ${rel(CHECKPOINT)}`);
  return 0;
}

// ── disable ────────────────────────────────────────────────────────────────
function cmdDisable() {
  const cp = readCheckpoint();
  if (!cp || !cp.telemetry_handle) {
    console.log("• telemetry is already OFF (no telemetry_handle).");
    return 0;
  }
  const th = typeof cp.telemetry_handle === "object" ? cp.telemetry_handle : {};
  cp.telemetry_handle = { ...th, enabled: false };
  cp.step = "metering-disabled";
  cp.progress_summary =
    "Opt-in metering is DISABLED. No further runs are recorded. The local " +
    `store ${SINK_REL} is kept as-is — deleting it is your call.`;
  cp.next_actions = ["Re-run /oc-telemetry enable to resume metering (mints a fresh handle)."];
  writeCheckpoint(cp);
  console.log("✓ telemetry DISABLED — metering stopped; local store kept.");
  return 0;
}

// ── status ─────────────────────────────────────────────────────────────────
function cmdStatus() {
  const cp = readCheckpoint();
  const enabled = isEnabled(cp);
  const th = cp?.telemetry_handle;
  console.log(`telemetry: ${enabled ? "ENABLED ✅" : "OFF ⬜"}`);
  if (th && typeof th === "object") {
    console.log(`  handle: ${th.id ?? "(none)"}`);
    console.log(`  since:  ${th.since ?? "(n/a)"}`);
  }
  console.log(`  store:  ${SINK_REL} ${existsSync(SINK) ? "(present)" : "(absent)"}`);
  if (existsSync(SINK)) {
    const db = new DatabaseSync(SINK, { readOnly: true });
    const { n } = db.prepare("SELECT COUNT(*) AS n FROM runs").get();
    db.close();
    console.log(`  rows:   ${n} metered run${n === 1 ? "" : "s"}`);
  }
  return 0;
}

// ── record (the metering write path; NO-OP unless enabled) ───────────────────
function cmdRecord(flags) {
  const cp = readCheckpoint();
  if (!isEnabled(cp)) {
    // The "opt-out → zero writes" guarantee: disabled/absent telemetry records
    // nothing. Exit 0 — a skipped write is not an error.
    if (flags.verbose) console.log("• telemetry OFF — no row written.");
    return 0;
  }
  const handle = cp.telemetry_handle.id;
  if (!flags.skill) {
    console.error("record: --skill is required");
    return 1;
  }
  const db = openStore();
  const stmt = db.prepare(
    `INSERT INTO runs
      (handle, skill, phase, command, model_tier, cost_usd, input_tokens, output_tokens, outcome, started_at, duration_ms)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  stmt.run(
    handle,
    flags.skill,
    flags.phase ?? null,
    flags.command ?? null,
    flags.tier ?? null,
    flags.cost != null ? Number(flags.cost) : null,
    flags.in != null ? Number(flags.in) : null,
    flags.out != null ? Number(flags.out) : null,
    flags.outcome ?? null,
    flags.at ?? nowISO(),
    flags.duration != null ? Number(flags.duration) : null
  );
  db.close();
  console.log(`✓ recorded run: ${flags.skill}${flags.phase ? `/${flags.phase}` : ""}`);
  return 0;
}

function rel(p) {
  return p.startsWith(ROOT) ? p.slice(ROOT.length + 1) : p;
}

function parseFlags(argv) {
  const flags = {};
  for (const a of argv) {
    const m = /^--([^=]+)(?:=(.*))?$/.exec(a);
    if (m) flags[m[1]] = m[2] === undefined ? true : m[2];
  }
  return flags;
}

function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  const flags = parseFlags(rest);
  switch (cmd) {
    case "enable":  return cmdEnable();
    case "disable": return cmdDisable();
    case "status":
    case undefined: return cmdStatus();
    case "record":  return cmdRecord(flags);
    default:
      console.error(`unknown command: ${cmd}`);
      console.error("usage: telemetry <enable|disable|status|record>");
      return 1;
  }
}

process.exit(main());

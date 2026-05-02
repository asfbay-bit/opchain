#!/usr/bin/env node
/**
 * Checkpoint CLI — read, validate, and update opchain skill checkpoints.
 *
 * Files live at <repo>/.checkpoints/<skill>.checkpoint.json and are
 * tracked in git as living "session state docs". See
 * .checkpoints/README.md for the schema.
 *
 * Subcommands:
 *   status                            Print a markdown summary of every checkpoint.
 *   validate                          Exit 0 if all checkpoints satisfy the schema, 1 otherwise.
 *   update <skill> [--field=value...] Read existing checkpoint (or scaffold), apply updates,
 *                                     stamp updated_at, validate, write.
 *
 * Design notes:
 *   - Pure Node, zero deps. Validator is hand-rolled against the schema
 *     in this file (mirrors .checkpoints/README.md). Adding ajv would
 *     pull in a sub-tree we don't need for ~200 lines of validation.
 *   - `status` is the canonical session-resume command. CLAUDE.md tells
 *     the next session to run it on boot.
 *   - `update` is the convenience that lets the assistant edit fields
 *     without hand-writing JSON; it's optional — any checkpoint can also
 *     be edited directly. Validator runs after every update.
 */

import { readdirSync, readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join, basename } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const DIR  = join(ROOT, ".checkpoints");

/** Required + optional field shape. Mirrors .checkpoints/README.md. */
const REQUIRED = [
  "protocol_version",
  "skill",
  "project",
  "project_dir",
  "created_at",
  "updated_at",
  "phase",
  "step",
  "status",
  "progress_summary",
];
const STATUS_ENUM = ["in_progress", "blocked", "complete", "failed"];
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/;

function listCheckpoints() {
  if (!existsSync(DIR)) return [];
  return readdirSync(DIR)
    .filter((f) => f.endsWith(".checkpoint.json"))
    .sort()
    .map((f) => join(DIR, f));
}

function readCheckpoint(path) {
  const raw = readFileSync(path, "utf8");
  try { return { path, data: JSON.parse(raw) }; }
  catch (err) { throw new Error(`${path}: invalid JSON — ${err.message}`); }
}

/** Returns array of error strings; empty array = valid. */
function validate(path, data) {
  const errors = [];
  const file = basename(path);

  for (const k of REQUIRED) {
    if (data[k] === undefined || data[k] === null || data[k] === "") {
      errors.push(`missing required field "${k}"`);
    }
  }
  if (data.protocol_version && data.protocol_version !== "1.0") {
    errors.push(`protocol_version must be "1.0" (got ${JSON.stringify(data.protocol_version)})`);
  }
  if (data.status && !STATUS_ENUM.includes(data.status)) {
    errors.push(`status must be one of ${STATUS_ENUM.join("|")} (got "${data.status}")`);
  }
  if (data.created_at && !ISO.test(data.created_at)) errors.push(`created_at must be ISO-8601 UTC`);
  if (data.updated_at && !ISO.test(data.updated_at)) errors.push(`updated_at must be ISO-8601 UTC`);

  // Filename-skill consistency: foo.checkpoint.json must own skill="foo".
  if (data.skill) {
    const expected = `${data.skill}.checkpoint.json`;
    if (file !== expected) errors.push(`filename ${file} does not match skill="${data.skill}" (expected ${expected})`);
  }

  // Status enum on each progress_table row, if present.
  if (Array.isArray(data.progress_table)) {
    const ROW_STATUS = ["complete", "in_progress", "not_started", "blocked", "failed"];
    data.progress_table.forEach((row, i) => {
      if (!row || typeof row !== "object") {
        errors.push(`progress_table[${i}] must be an object`);
        return;
      }
      for (const k of ["id", "label", "status"]) {
        if (!row[k]) errors.push(`progress_table[${i}].${k} required`);
      }
      if (row.status && !ROW_STATUS.includes(row.status)) {
        errors.push(`progress_table[${i}].status must be one of ${ROW_STATUS.join("|")}`);
      }
    });
  }

  // Optional: blockers shape.
  if (Array.isArray(data.blockers)) {
    data.blockers.forEach((b, i) => {
      if (!b.id || !b.description) errors.push(`blockers[${i}] needs at least id + description`);
    });
  }

  return errors;
}

function cmdValidate() {
  const paths = listCheckpoints();
  if (paths.length === 0) {
    console.log("(no checkpoints found in .checkpoints/)");
    return 0;
  }
  let bad = 0;
  for (const p of paths) {
    let cp;
    try { cp = readCheckpoint(p); }
    catch (e) { console.error(`✗ ${basename(p)}\n    ${e.message}`); bad++; continue; }
    const errs = validate(p, cp.data);
    if (errs.length === 0) console.log(`✓ ${basename(p)}`);
    else { console.error(`✗ ${basename(p)}`); errs.forEach((e) => console.error(`    ${e}`)); bad++; }
  }
  if (bad > 0) {
    console.error(`\n${bad} checkpoint(s) failed validation.`);
    return 1;
  }
  console.log(`\nAll ${paths.length} checkpoint(s) valid.`);
  return 0;
}

function cmdStatus() {
  const paths = listCheckpoints();
  if (paths.length === 0) {
    console.log("(no checkpoints found in .checkpoints/)");
    return 0;
  }
  console.log("# Session state\n");
  console.log("| Skill | Phase | Step | Status | Updated |");
  console.log("|---|---|---|---|---|");
  for (const p of paths) {
    let cp;
    try { cp = readCheckpoint(p); }
    catch { console.log(`| ${basename(p)} | _invalid JSON_ | — | — | — |`); continue; }
    const d = cp.data;
    const updated = d.updated_at ? d.updated_at.replace("T", " ").replace("Z", " UTC") : "—";
    console.log(`| ${d.skill || "?"} | ${d.phase || "?"} | ${d.step || "?"} | ${d.status || "?"} | ${updated} |`);
  }
  console.log();
  for (const p of paths) {
    let cp;
    try { cp = readCheckpoint(p); } catch { continue; }
    const d = cp.data;
    console.log(`## ${d.skill || basename(p)}`);
    console.log(d.progress_summary || "_no summary_");
    if (Array.isArray(d.next_actions) && d.next_actions.length > 0) {
      console.log("\n**Next actions:**");
      d.next_actions.forEach((a, i) => console.log(`${i + 1}. ${a}`));
    }
    if (Array.isArray(d.blockers) && d.blockers.length > 0) {
      console.log("\n**Blockers:**");
      d.blockers.forEach((b) => console.log(`- ${b.id}: ${b.description}`));
    }
    console.log();
  }
  return 0;
}

/**
 * Apply --key=value updates to an object. Supports dotted paths for
 * nested fields: --context_primer.key_decisions+="a new decision".
 *
 * Operators:
 *   --key=value     Replace string/scalar value.
 *   --key+=value    Append to an array (creates if missing).
 *   --key:json=...  Parse the value as JSON (objects, arrays, etc.).
 */
function applyUpdates(obj, args) {
  for (const arg of args) {
    if (!arg.startsWith("--")) continue;
    const eq = arg.indexOf("=");
    if (eq < 0) continue;
    const lhsRaw = arg.slice(2, eq);
    let value = arg.slice(eq + 1);
    let isAppend = false;
    let isJson = false;
    let lhs = lhsRaw;
    if (lhs.endsWith("+")) { isAppend = true; lhs = lhs.slice(0, -1); }
    if (lhs.endsWith(":json")) { isJson = true; lhs = lhs.slice(0, -5); }
    if (isJson) {
      try { value = JSON.parse(value); }
      catch (err) { throw new Error(`failed to parse --${lhsRaw}=... as JSON: ${err.message}`); }
    }
    const path = lhs.split(".");
    let cur = obj;
    for (let i = 0; i < path.length - 1; i++) {
      const k = path[i];
      if (cur[k] === undefined || cur[k] === null) cur[k] = {};
      cur = cur[k];
    }
    const tail = path[path.length - 1];
    if (isAppend) {
      if (!Array.isArray(cur[tail])) cur[tail] = [];
      cur[tail].push(value);
    } else {
      cur[tail] = value;
    }
  }
}

function cmdUpdate(skill, rest) {
  if (!skill) {
    console.error("usage: checkpoint update <skill> [--field=value ...]");
    return 1;
  }
  if (!existsSync(DIR)) mkdirSync(DIR, { recursive: true });
  const path = join(DIR, `${skill}.checkpoint.json`);

  let data;
  if (existsSync(path)) {
    data = readCheckpoint(path).data;
  } else {
    // Scaffold a minimal checkpoint so update can create from nothing.
    const now = new Date().toISOString();
    data = {
      protocol_version: "1.0",
      skill,
      project: "opchain.dev",
      project_dir: ROOT,
      created_at: now,
      updated_at: now,
      phase: "init",
      step: "scaffolded",
      status: "in_progress",
      progress_summary: `Checkpoint scaffolded for ${skill}.`,
    };
  }

  applyUpdates(data, rest);
  data.updated_at = new Date().toISOString();

  const errs = validate(path, data);
  if (errs.length > 0) {
    console.error(`✗ ${basename(path)} — would fail validation:`);
    errs.forEach((e) => console.error(`    ${e}`));
    return 1;
  }
  writeFileSync(path, JSON.stringify(data, null, 2) + "\n");
  console.log(`✓ wrote ${basename(path)}`);
  return 0;
}

const [, , cmd, ...rest] = process.argv;
let code = 0;
switch (cmd) {
  case "validate": code = cmdValidate(); break;
  case "status":   code = cmdStatus(); break;
  case "update":   code = cmdUpdate(rest[0], rest.slice(1)); break;
  default:
    console.error("usage: checkpoint <validate|status|update>");
    console.error("  validate                            — validate every .checkpoint.json");
    console.error("  status                              — print a session-resume summary");
    console.error("  update <skill> [--field=value ...]  — apply field updates and stamp updated_at");
    code = 1;
}
process.exit(code);

#!/usr/bin/env node
/**
 * scripts/deploy.mjs — single entry point for `npm run deploy` and
 * `npm run deploy:staging`.
 *
 * Why this wrapper exists: it loads `.dev.vars` into the build env so the
 * same vars the Worker uses at runtime are available at build time, and it
 * inlines the PUBLIC_POSTHOG_* build-time envs that client analytics needs.
 *
 * History: this wrapper used to also assert LINEAR_API_KEY and set
 * OPCHAIN_REQUIRE_LINEAR=1, because `/changelog` was driven by a build-time
 * Linear pull (scripts/gen-roadmap.mjs) and a missing/unreachable key would
 * silently ship an empty roadmap. The roadmap is now hand-maintained in
 * site/src/data/roadmap-static.ts, so the Linear pull is no longer on the
 * deploy path and Linear being down can't break a deploy. That gate was
 * removed (2026-06-19); see CLAUDE.md → Deploy flow.
 *
 * This wrapper:
 *   1. Loads `.dev.vars` into process.env.
 *   2. Plumbs the inlined PUBLIC_POSTHOG_* build-time envs (formerly
 *      baked into the npm script).
 *   3. Runs `npm run prebuild` then `wrangler deploy [--env staging]`,
 *      forwarding their exit codes.
 *
 * Local dev (`npm run dev`) is unaffected — wrangler reads .dev.vars
 * on its own there.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT  = path.resolve(path.dirname(__filename), "..");
const DEV_VARS   = path.join(REPO_ROOT, ".dev.vars");

const STAGING = process.argv.includes("--staging");
const TARGET  = STAGING ? "staging" : "production";

function loadDevVars() {
  if (!fs.existsSync(DEV_VARS)) return { loaded: 0, source: null };
  const content = fs.readFileSync(DEV_VARS, "utf8");
  let loaded = 0;
  for (const rawLine of content.split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    // Don't override env already exported in the parent shell —
    // shell wins so a developer can override a stale .dev.vars
    // without editing the file.
    if (key && process.env[key] === undefined) {
      process.env[key] = value;
      loaded += 1;
    }
  }
  return { loaded, source: DEV_VARS };
}

function run(cmd, args) {
  console.log(`\n[deploy:${TARGET}] $ ${cmd} ${args.join(" ")}`);
  const result = spawnSync(cmd, args, {
    stdio: "inherit",
    env: process.env,
    cwd: REPO_ROOT,
    shell: process.platform === "win32",
  });
  if (result.status !== 0) {
    console.error(
      `\n[deploy:${TARGET}] ${cmd} exited with status ${result.status ?? "unknown"}`,
    );
    process.exit(result.status ?? 1);
  }
}

/** Capture stdout of a command, or null if it fails. Never throws. */
function capture(cmd, args) {
  const r = spawnSync(cmd, args, { cwd: REPO_ROOT, encoding: "utf8" });
  return r.status === 0 ? (r.stdout || "").trim() : null;
}

/**
 * Staging must be reachable from `main`.
 *
 * CLAUDE.md has said so in prose since the 2026-05-13 deploy gap, when staging
 * sat on 7303ab6 — a feature-branch SHA not on main — while prod ran 6 days
 * stale. Prose did not hold it: nothing in this file checked the branch until
 * now. The point of staging is "what production is about to become"; a staging
 * deploy from an unmerged branch silently breaks the "I looked at staging, it's
 * safe to ship" gate, because what you looked at is not what ships.
 *
 * Escape hatch is deliberate and loud: OPCHAIN_ALLOW_OFF_MAIN_STAGING=1.
 */
function assertStagingFromMain() {
  if (!STAGING) return;

  if (process.env.OPCHAIN_ALLOW_OFF_MAIN_STAGING === "1") {
    console.warn(
      `[deploy:${TARGET}] ⚠ OPCHAIN_ALLOW_OFF_MAIN_STAGING=1 — skipping the ` +
        `staging-from-main check. staging.opchain.dev will NOT be a faithful ` +
        `preview of production.`,
    );
    return;
  }

  // Fetch so origin/main is current; a stale ref would fail an honest deploy.
  const fetched = capture("git", ["fetch", "origin", "main", "--quiet"]) !== null;
  if (!fetched) {
    console.warn(
      `[deploy:${TARGET}] ⚠ could not fetch origin/main — checking against the ` +
        `local ref, which may be behind.`,
    );
  }

  const head = capture("git", ["rev-parse", "HEAD"]);
  if (!head) {
    console.error(`[deploy:${TARGET}] ✗ not a git repo (or git unavailable) — refusing to deploy staging.`);
    process.exit(1);
  }

  const onMain =
    spawnSync("git", ["merge-base", "--is-ancestor", "HEAD", "origin/main"], {
      cwd: REPO_ROOT,
    }).status === 0;

  if (!onMain) {
    const branch = capture("git", ["rev-parse", "--abbrev-ref", "HEAD"]) || "(detached)";
    const subject = capture("git", ["log", "-1", "--format=%s", "HEAD"]) || "";
    console.error(
      `\n[deploy:${TARGET}] ✗ REFUSING: HEAD is not reachable from origin/main.\n` +
        `\n    branch:  ${branch}` +
        `\n    HEAD:    ${head.slice(0, 12)}  ${subject}\n` +
        `\nStaging must come from main so it is a faithful preview of what production` +
        `\nis about to become. Deploying a branch SHA leaves staging on a commit that` +
        `\nisn't reachable from main and breaks the pre-ship review gate.` +
        `\n(This is the 2026-05-13 failure mode — see CLAUDE.md § Deployment.)\n` +
        `\nDo this instead:` +
        `\n    git checkout main && git pull && npm run deploy:staging\n` +
        `\nIf you genuinely need a branch preview, say so out loud:` +
        `\n    OPCHAIN_ALLOW_OFF_MAIN_STAGING=1 npm run deploy:staging\n`,
    );
    process.exit(1);
  }

  console.log(`[deploy:${TARGET}] ✓ HEAD is reachable from origin/main`);
}

assertStagingFromMain();

const { loaded, source } = loadDevVars();
if (source) {
  console.log(`[deploy:${TARGET}] loaded ${loaded} var(s) from ${path.relative(REPO_ROOT, source)}`);
}

process.env.PUBLIC_POSTHOG_KEY = "phc_m4mpaJBA3EsEFRiGeVQWESFX8pz6CtS6B8y85Va6rmJV";
process.env.PUBLIC_POSTHOG_HOST = STAGING
  ? "https://t.staging.opchain.dev"
  : "https://t.opchain.dev";

console.log(`[deploy:${TARGET}] preflight ok`);

run("npm", ["run", "prebuild"]);
run("npx", STAGING ? ["wrangler", "deploy", "--env", "staging"] : ["wrangler", "deploy"]);

console.log(`\n[deploy:${TARGET}] done.`);

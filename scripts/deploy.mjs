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

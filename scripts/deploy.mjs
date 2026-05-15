#!/usr/bin/env node
/**
 * scripts/deploy.mjs — single entry point for `npm run deploy` and
 * `npm run deploy:staging`.
 *
 * Why this wrapper exists: PR #231 fixed the *symptom* of the empty
 * /changelog roadmap (don't leak the build-note to visitors), but the
 * underlying class of bug — a build-time secret silently absent when
 * `npm run deploy` runs — is still possible without something
 * front-loading the check. Without LINEAR_API_KEY, gen-roadmap.mjs
 * gracefully degrades to writing an empty roadmap and the build keeps
 * going, so deploys ship an empty timeline with no warning.
 *
 * This wrapper:
 *   1. Loads `.dev.vars` into process.env so the same secret the
 *      Worker uses at runtime is available at build time too.
 *   2. Asserts LINEAR_API_KEY is set; exits non-zero with a clear
 *      remediation message if not.
 *   3. Sets OPCHAIN_REQUIRE_LINEAR=1 so gen-roadmap.mjs also fails
 *      loud if anyone bypasses the wrapper.
 *   4. Plumbs the inlined PUBLIC_POSTHOG_* build-time envs (formerly
 *      baked into the npm script).
 *   5. Runs `npm run prebuild` then `wrangler deploy [--env staging]`,
 *      forwarding their exit codes.
 *
 * Local dev (`npm run dev`) is unaffected — wrangler reads .dev.vars
 * on its own there, and the prebuild's gen-roadmap step still
 * gracefully degrades when LINEAR_API_KEY isn't present.
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

function abortMissing(missing) {
  const list = missing.join(", ");
  console.error(
    `\n[deploy:${TARGET}] aborting — required build-time env var(s) missing: ${list}\n` +
      `\n` +
      `  Why this matters:\n` +
      `    LINEAR_API_KEY is read by scripts/gen-roadmap.mjs during prebuild\n` +
      `    to pull the public /changelog roadmap from Linear. Without it the\n` +
      `    build silently writes an empty roadmap and ships a "No roadmap\n` +
      `    items published yet" timeline to visitors.\n` +
      `\n` +
      `  Fix one of:\n` +
      `    1. Add LINEAR_API_KEY=lin_api_… to .dev.vars (gitignored).\n` +
      `       See .env.example for the full template.\n` +
      `    2. Export it in this shell: export LINEAR_API_KEY=lin_api_…\n` +
      `       Then re-run npm run deploy${STAGING ? ":staging" : ""}.\n` +
      `\n` +
      `  The .dev.vars approach is preferred — it survives new shells and\n` +
      `  matches how wrangler dev sources the same secret at runtime.\n`,
  );
  process.exit(1);
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

const required = ["LINEAR_API_KEY"];
const missing = required.filter((k) => !process.env[k]);
if (missing.length) abortMissing(missing);

process.env.OPCHAIN_REQUIRE_LINEAR = "1";
process.env.PUBLIC_POSTHOG_KEY = "phc_m4mpaJBA3EsEFRiGeVQWESFX8pz6CtS6B8y85Va6rmJV";
process.env.PUBLIC_POSTHOG_HOST = STAGING
  ? "https://t.staging.opchain.dev"
  : "https://t.opchain.dev";

console.log(`[deploy:${TARGET}] preflight ok — LINEAR_API_KEY present, OPCHAIN_REQUIRE_LINEAR=1`);

run("npm", ["run", "prebuild"]);
run("npx", STAGING ? ["wrangler", "deploy", "--env", "staging"] : ["wrangler", "deploy"]);

console.log(`\n[deploy:${TARGET}] done.`);

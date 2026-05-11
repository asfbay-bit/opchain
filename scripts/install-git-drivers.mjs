#!/usr/bin/env node
/**
 * Registers per-clone git merge drivers used by .gitattributes.
 *
 * Runs from `npm prepare`, so it executes after `npm install` on a
 * fresh clone (the standard Husky-style pattern). Git merge drivers
 * have to live in `.git/config` — they can't be shared via committed
 * files — so this is the one bit of bootstrapping we have to repeat
 * per checkout. Idempotent: safe to re-run.
 *
 * Silent skip when:
 *   - not in a git working tree (e.g. npm install from a tarball)
 *   - `git` binary missing
 *   - $OPCHAIN_SKIP_GIT_DRIVERS=1 (CI escape hatch)
 */

import { spawnSync } from "node:child_process";

if (process.env.OPCHAIN_SKIP_GIT_DRIVERS === "1") process.exit(0);

const inRepo = spawnSync("git", ["rev-parse", "--git-dir"], { stdio: "ignore" });
if (inRepo.status !== 0) process.exit(0);

const drivers = [
  {
    name: "opchain-checkpoint",
    description: "Auto-resolve telemetry conflicts in .checkpoints/*.checkpoint.json",
    driver: "node scripts/merge-checkpoint.mjs %O %A %B %P",
    recursive: "binary",
  },
];

for (const d of drivers) {
  setConfig(`merge.${d.name}.name`, d.description);
  setConfig(`merge.${d.name}.driver`, d.driver);
  setConfig(`merge.${d.name}.recursive`, d.recursive);
}

function setConfig(key, value) {
  const r = spawnSync("git", ["config", key, value], { stdio: "inherit" });
  if (r.status !== 0) {
    process.stderr.write(`install-git-drivers: failed to set ${key}\n`);
    process.exit(1);
  }
}

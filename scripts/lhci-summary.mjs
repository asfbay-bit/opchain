#!/usr/bin/env node
// Reads .lighthouseci/manifest.json and prints a markdown table of median
// category scores per URL. Used by the Lighthouse workflow to post a PR
// comment so threshold calibration is data-driven.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const manifestPath = resolve(process.argv[2] ?? ".lighthouseci/manifest.json");
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));

const byUrl = {};
for (const run of manifest) (byUrl[run.url] ??= []).push(run.summary);

const cats = ["performance", "accessibility", "best-practices", "seo"];
const median = (a) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];
const runsPerUrl = manifest.length / Object.keys(byUrl).length;

let out = `## LHCI scores (median of ${runsPerUrl} runs)\n\n`;
out += "| Route | Perf | A11y | Best | SEO |\n|---|---|---|---|---|\n";
for (const url of Object.keys(byUrl)) {
  const path = new URL(url).pathname || "/";
  const row = cats.map((c) => median(byUrl[url].map((s) => s[c])).toFixed(2));
  out += `| \`${path}\` | ${row.join(" | ")} |\n`;
}
process.stdout.write(out);

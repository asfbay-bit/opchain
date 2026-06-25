#!/usr/bin/env node
// check-release-surfaces.mjs
//
// Guards against the recurring "we shipped vN but the site still says vN-1"
// drift. Reads every LIVE-CLAIM site surface (the ones that assert what's
// currently live in prod) and asserts they all agree on the same release line.
// The canonical value is Header's CURRENT_RELEASE; every other surface must
// match it. See skills/oc-release-ops/references/site-release-surfaces.md.
//
// This does NOT decide what the release *should* be — only that the surfaces are
// consistent with each other. Run after a release cut (and in CI) so a
// half-finished bump fails loudly instead of shipping a lying header.
//
// Run:        node scripts/check-release-surfaces.mjs
// Exit:       0 if consistent, 1 on any mismatch.

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const p = (rel) => join(ROOT, rel);

// Each probe pulls the major release line ("v1.6") from one live-claim surface.
const PROBES = [
  {
    label: "Header CURRENT_RELEASE",
    file: "site/src/components/Header.astro",
    re: /const CURRENT_RELEASE\s*=\s*"(v\d+\.\d+)"/,
  },
  {
    label: "Header CURRENT_RELEASE_HREF",
    file: "site/src/components/Header.astro",
    re: /const CURRENT_RELEASE_HREF\s*=\s*"\/changelog#v(\d+)-(\d+)"/,
    join: (m) => `v${m[1]}.${m[2]}`,
  },
  {
    label: "homepage release bar (shipped)",
    file: "site/src/pages/index.astro",
    re: /<span class="rb-tag">(v\d+\.\d+) · shipped<\/span>/,
  },
  {
    label: "homepage stat chip",
    file: "site/src/pages/index.astro",
    re: /<span class="stat-num">(v\d+\.\d+)<\/span>/,
  },
  {
    label: "changelog Just-Released hero (open)",
    file: "site/src/pages/changelog.astro",
    re: /hero-card--released is-open"\s+id="v(\d+)-(\d+)"/,
    join: (m) => `v${m[1]}.${m[2]}`,
  },
  {
    label: "styleguide version Badge",
    file: "site/src/pages/styleguide.astro",
    re: /<Badge[^>]*>(v\d+\.\d+)\.\d+<\/Badge>/,
  },
];

function probe({ label, file, re, join: j }) {
  let text;
  try {
    text = readFileSync(p(file), "utf8");
  } catch {
    return { label, file, value: null, error: "file not found" };
  }
  const m = text.match(re);
  if (!m) return { label, file, value: null, error: "pattern not found" };
  return { label, file, value: j ? j(m) : m[1] };
}

export function checkReleaseSurfaces() {
  const results = PROBES.map(probe);
  const header = results.find((r) => r.label === "Header CURRENT_RELEASE");
  const expected = header?.value ?? null;
  const errors = [];

  if (!expected) {
    errors.push("could not read Header CURRENT_RELEASE — the canonical release value");
  }
  for (const r of results) {
    if (r.error) {
      errors.push(`${r.label} (${r.file}): ${r.error}`);
    } else if (expected && r.value !== expected) {
      errors.push(`${r.label} (${r.file}): says ${r.value}, expected ${expected}`);
    }
  }
  return { ok: errors.length === 0, expected, results, errors };
}

// CLI
if (import.meta.url === `file://${process.argv[1]}`) {
  const { ok, expected, results, errors } = checkReleaseSurfaces();
  console.log("RELEASE SURFACE CHECK");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  for (const r of results) {
    console.log(`  ${r.error ? "✗" : r.value === expected ? "✓" : "✗"} ${r.label}: ${r.value ?? `(${r.error})`}`);
  }
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  if (ok) {
    console.log(`✓ all live-claim surfaces agree on ${expected}`);
    process.exit(0);
  }
  console.error(`✗ release-surface drift:\n  - ${errors.join("\n  - ")}`);
  console.error("\nFix per skills/oc-release-ops/references/site-release-surfaces.md (live-claim surfaces L1–L7).");
  process.exit(1);
}

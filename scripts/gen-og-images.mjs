#!/usr/bin/env node
/**
 * Generates branded 1200×630 OpenGraph share cards for each top-level route.
 * Outputs PNGs to site/public/og/ — Astro copies them into dist on build.
 *
 * Uses sharp (globally available in dev env) to rasterize SVG → PNG.
 * Run: node scripts/gen-og-images.mjs
 */

import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import sharp from "sharp";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "site", "public", "og");

const ROUTES = [
  {
    file: "home.png",
    headline: "skills that ship.",
    tagline: "A connected suite of Claude Code skills for the full dev pipeline.",
  },
  {
    file: "skills.png",
    headline: "every skill, filterable.",
    tagline: "Browse, filter, and install the complete opchain catalog.",
  },
  {
    file: "architecture.png",
    headline: "how skills chain.",
    tagline: "The opchain pipeline: concept → spec → build → deploy.",
  },
  {
    file: "install.png",
    headline: "three ways to install.",
    tagline: "Add opchain skills to Claude Code in minutes.",
  },
  {
    file: "demo.png",
    headline: "watch a finished run.",
    tagline: "See opchain build a real app from scratch.",
  },
  {
    file: "privacy.png",
    headline: "privacy.",
    tagline: "opchain.dev data practices.",
  },
];

// Chosen to balance large-text legibility with line-length for the longest
// headline ("every skill, filterable." — 24 chars). At 68px with Liberation
// Sans Bold (~0.54em avg width), that headline is ~880px, well within the
// 1056px usable area (1200 - 2×72).
const HEADLINE_SIZE = 68;

function card({ headline, tagline }) {
  return `<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <!-- Ember glow — bottom-right -->
    <radialGradient id="gr" cx="95%" cy="85%" r="45%" gradientUnits="objectBoundingBox">
      <stop offset="0%"   stop-color="#e05c18" stop-opacity="0.18"/>
      <stop offset="100%" stop-color="#1c1710" stop-opacity="0"/>
    </radialGradient>
    <!-- Subtle top-left warmth -->
    <radialGradient id="gl" cx="0%" cy="0%" r="35%" gradientUnits="objectBoundingBox">
      <stop offset="0%"   stop-color="#e05c18" stop-opacity="0.07"/>
      <stop offset="100%" stop-color="#1c1710" stop-opacity="0"/>
    </radialGradient>
  </defs>

  <!-- Base -->
  <rect width="1200" height="630" fill="#1c1710"/>
  <rect width="1200" height="630" fill="url(#gr)"/>
  <rect width="1200" height="630" fill="url(#gl)"/>

  <!-- Left accent bar -->
  <rect x="0" y="0" width="5" height="630" fill="#e05c18"/>

  <!-- Wordmark -->
  <text
    x="72" y="88"
    font-family="Liberation Sans, DejaVu Sans, Arial, sans-serif"
    font-size="20"
    font-weight="bold"
    fill="#e05c18"
    letter-spacing="5"
  >OPCHAIN</text>

  <!-- Headline -->
  <text
    x="72" y="318"
    font-family="Liberation Sans, DejaVu Sans, Arial, sans-serif"
    font-size="${HEADLINE_SIZE}"
    font-weight="bold"
    fill="#e8dfd0"
  >${headline}</text>

  <!-- Tagline -->
  <text
    x="72" y="390"
    font-family="Liberation Sans, DejaVu Sans, Arial, sans-serif"
    font-size="26"
    font-weight="normal"
    fill="#c4b89e"
  >${tagline}</text>

  <!-- Bottom accent line -->
  <rect x="72" y="574" width="260" height="3" fill="#e05c18" opacity="0.7"/>

  <!-- URL -->
  <text
    x="1128" y="594"
    font-family="Liberation Sans, DejaVu Sans, Arial, sans-serif"
    font-size="18"
    font-weight="normal"
    fill="#5a5040"
    text-anchor="end"
  >opchain.dev</text>
</svg>`;
}

for (const route of ROUTES) {
  const svg = card(route);
  const outPath = join(OUT, route.file);
  await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toFile(outPath);
  const { size } = await import("node:fs").then((fs) => fs.promises.stat(outPath));
  console.log(`  ✓ ${route.file.padEnd(22)} ${Math.round(size / 1024)}KB`);
}

console.log(`\nGenerated ${ROUTES.length} OG cards → site/public/og/`);

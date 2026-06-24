#!/usr/bin/env node
/**
 * Generates branded 1200×630 OpenGraph share cards for each top-level route.
 * Outputs PNGs to site/public/og/ — Astro copies them into dist on build.
 *
 * Uses sharp (globally available in dev env) to rasterize SVG → PNG.
 * Run: node scripts/gen-og-images.mjs
 */

import { writeFileSync, readdirSync, readFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import sharp from "sharp";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "site", "public", "og");
const BLOG_SRC = join(ROOT, "site", "src", "blog");
const BLOG_OUT = join(OUT, "blog");

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
  {
    file: "blog.png",
    headline: "notes from the pipeline.",
    tagline: "Deep-dives, opinions, playbooks, and releases — building, as a discipline.",
  },
  // Per-skill cards for the v1.5 AI-native skills (B-03 backlog).
  {
    file: "skills-oc-claude-api.png",
    headline: "claude-api.",
    tagline: "Model routing, prompt caching, tool use, migration playbooks.",
  },
  {
    file: "skills-oc-rag-forge.png",
    headline: "rag-forge.",
    tagline: "Vector DB, embeddings, chunking, retrieval eval — tri-agent.",
  },
  {
    file: "skills-oc-agent-forge.png",
    headline: "agent-forge.",
    tagline: "Agent SDK topology, tool budgets, harness loops, agent eval.",
  },
  {
    file: "skills-oc-prompt-ops.png",
    headline: "prompt-ops.",
    tagline: "Prompts as code — versioned, eval-gated, drift-detected.",
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

console.log(`\nGenerated ${ROUTES.length} route OG cards → site/public/og/`);

// ────────────────────────────────────────────────────────────────────────
// Per-post blog cards. One 1200×630 PNG per published post at
// site/public/og/blog/<slug>.png, wired through [slug].astro's ogImage. The
// post title is word-wrapped; the pillar shows as an accent eyebrow. Keeps
// the same brand template as the route cards (no extra deps — still SVG →
// sharp). Regenerated on every build, so titles never drift from the cards.

// XML-escape for SVG text nodes.
function esc(s) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Greedy word-wrap into lines of at most `maxChars` characters.
function wrapText(text, maxChars) {
  const words = text.split(/\s+/);
  const lines = [];
  let line = "";
  for (const w of words) {
    if (line && (line + " " + w).length > maxChars) {
      lines.push(line);
      line = w;
    } else {
      line = line ? line + " " + w : w;
    }
  }
  if (line) lines.push(line);
  return lines;
}

// Minimal frontmatter reader — pulls the quoted `title`, the bare `pillar`,
// and `draft` from the leading `---` block. Avoids a YAML dependency; the
// blog frontmatter is controlled and simple (no multiline title values).
function readFrontmatter(raw) {
  const m = raw.match(/^---\s*\n([\s\S]*?)\n---/);
  if (!m) return {};
  const block = m[1];
  const title = block.match(/^title:\s*["']?(.*?)["']?\s*$/m)?.[1];
  const pillar = block.match(/^pillar:\s*["']?([a-z]+)["']?\s*$/m)?.[1];
  const draft = /^draft:\s*true\s*$/m.test(block);
  return { title, pillar, draft };
}

const PILLAR_LABEL = {
  engineering: "Engineering",
  opinion: "Opinion",
  playbook: "Playbook",
  release: "Release",
};

function blogCard({ title, pillar }) {
  const lines = wrapText(title, 28).slice(0, 4);
  const fontSize = lines.length > 3 ? 46 : 56;
  const lineHeight = fontSize + 12;
  // Vertically center the title block around y=320.
  const startY = 320 - ((lines.length - 1) * lineHeight) / 2;
  const eyebrow = (PILLAR_LABEL[pillar] ?? "Notes").toUpperCase() + " · BLOG";
  const titleSpans = lines
    .map(
      (ln, i) =>
        `  <text x="72" y="${startY + i * lineHeight}" font-family="Liberation Sans, DejaVu Sans, Arial, sans-serif" font-size="${fontSize}" font-weight="bold" fill="#e8dfd0">${esc(ln)}</text>`,
    )
    .join("\n");

  return `<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="gr" cx="95%" cy="85%" r="45%" gradientUnits="objectBoundingBox">
      <stop offset="0%"   stop-color="#e05c18" stop-opacity="0.18"/>
      <stop offset="100%" stop-color="#1c1710" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="gl" cx="0%" cy="0%" r="35%" gradientUnits="objectBoundingBox">
      <stop offset="0%"   stop-color="#e05c18" stop-opacity="0.07"/>
      <stop offset="100%" stop-color="#1c1710" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="1200" height="630" fill="#1c1710"/>
  <rect width="1200" height="630" fill="url(#gr)"/>
  <rect width="1200" height="630" fill="url(#gl)"/>
  <rect x="0" y="0" width="5" height="630" fill="#e05c18"/>
  <text x="72" y="88" font-family="Liberation Sans, DejaVu Sans, Arial, sans-serif" font-size="20" font-weight="bold" fill="#e05c18" letter-spacing="5">OPCHAIN</text>
  <text x="72" y="174" font-family="Liberation Sans, DejaVu Sans, Arial, sans-serif" font-size="22" font-weight="bold" fill="#c4742a" letter-spacing="3">${esc(eyebrow)}</text>
${titleSpans}
  <rect x="72" y="574" width="260" height="3" fill="#e05c18" opacity="0.7"/>
  <text x="1128" y="594" font-family="Liberation Sans, DejaVu Sans, Arial, sans-serif" font-size="18" font-weight="normal" fill="#5a5040" text-anchor="end">opchain.dev/blog</text>
</svg>`;
}

mkdirSync(BLOG_OUT, { recursive: true });
const postFiles = readdirSync(BLOG_SRC).filter((f) => f.endsWith(".md"));
let blogCount = 0;
for (const file of postFiles) {
  const { title, pillar, draft } = readFrontmatter(readFileSync(join(BLOG_SRC, file), "utf8"));
  if (!title || draft) continue;
  const slug = file.replace(/\.md$/, "");
  const outPath = join(BLOG_OUT, `${slug}.png`);
  await sharp(Buffer.from(blogCard({ title, pillar })))
    .png({ compressionLevel: 9 })
    .toFile(outPath);
  blogCount++;
}

console.log(`Generated ${blogCount} blog post OG cards → site/public/og/blog/`);
console.log(`\nDone: ${ROUTES.length} route + ${blogCount} blog cards.`);

#!/usr/bin/env node
/**
 * Sprint 7c — Add `nonce="__OPCHAIN_NONCE__"` to every <script> tag in the
 * built HTML. The Worker (src/index.js) substitutes the placeholder with a
 * per-request nonce on every HTML response, and matches it in the CSP header.
 *
 * Idempotent: scripts that already carry a nonce attribute are left alone.
 *
 * Runs from `scripts/build-site.sh` after `cp -R dist → public`.
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import url from "node:url";

const PLACEHOLDER = "__OPCHAIN_NONCE__";
const ROOT = path.resolve(url.fileURLToPath(new URL(".", import.meta.url)), "..");
const PUBLIC_DIR = path.join(ROOT, "public");

async function* walkHtml(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      // Skip generated assets where injection would be wasteful or harmful.
      if (e.name === "docs" || e.name === "_astro") continue;
      yield* walkHtml(full);
    } else if (e.isFile() && e.name.endsWith(".html")) {
      yield full;
    }
  }
}

function injectNonce(html) {
  // Match opening <script ...> tags. Skip ones that already carry a nonce.
  // Self-closing isn't valid for <script> in HTML5, so the regex is simple.
  return html.replace(/<script\b([^>]*)>/g, (match, attrs) => {
    if (/\bnonce\s*=/i.test(attrs)) return match;
    return `<script nonce="${PLACEHOLDER}"${attrs}>`;
  });
}

async function main() {
  let touched = 0;
  let scripts = 0;
  for await (const file of walkHtml(PUBLIC_DIR)) {
    const before = await fs.readFile(file, "utf8");
    const after = injectNonce(before);
    if (after !== before) {
      await fs.writeFile(file, after);
      touched++;
      const added = (after.match(new RegExp(PLACEHOLDER, "g")) || []).length
                  - (before.match(new RegExp(PLACEHOLDER, "g")) || []).length;
      scripts += added;
    }
  }
  console.log(`[inject-nonce] stamped ${scripts} <script> tag(s) across ${touched} HTML file(s)`);
}

main().catch((err) => {
  console.error("[inject-nonce] failed:", err);
  process.exit(1);
});

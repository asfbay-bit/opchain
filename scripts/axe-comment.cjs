// Builds a markdown body listing axe violations found across the
// Playwright e2e run. Mirrors scripts/lhci-comment.cjs in shape so the
// surface area for PR comments stays uniform.
//
// Reads attachments written by routes.spec.ts via testInfo.attach():
//   site/test-results/<test-id>/axe-violations-<slug>.json
// Each file is the raw `violations` array from @axe-core/playwright.

const fs = require("node:fs");
const path = require("node:path");

const VIOLATION_FILENAME = /^axe-violations-(.+)\.json$/;
const NODE_LIMIT = 5;

function findViolationFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  const stack = [dir];
  while (stack.length > 0) {
    const cur = stack.pop();
    for (const ent of fs.readdirSync(cur, { withFileTypes: true })) {
      const p = path.join(cur, ent.name);
      if (ent.isDirectory()) stack.push(p);
      else if (VIOLATION_FILENAME.test(ent.name)) out.push(p);
    }
  }
  return out;
}

function slugToRoute(slug) {
  if (slug === "root") return "/";
  return "/" + slug.replace(/_/g, "/");
}

function buildComment(dir) {
  const files = findViolationFiles(dir);
  if (files.length === 0) return null;

  // Each test's attachment is a snapshot of that single test run. If the same
  // route's axe test ran more than once (retries, sharding) we'd see duplicates;
  // dedupe by route.
  const byRoute = new Map();
  for (const file of files) {
    const match = path.basename(file).match(VIOLATION_FILENAME);
    if (!match) continue;
    const route = slugToRoute(match[1]);
    if (byRoute.has(route)) continue;
    byRoute.set(route, JSON.parse(fs.readFileSync(file, "utf8")));
  }

  let body = "## Axe violations\n\n";
  body += "Surfaced from `routes.spec.ts` axe attachments. To resolve each: ";
  body += "either fix in source or add to `disabledRules` in `routes.spec.ts` ";
  body += "with a one-line reason.\n";

  for (const route of [...byRoute.keys()].sort()) {
    body += `\n### \`${route}\`\n`;
    const violations = byRoute.get(route);
    if (violations.length === 0) {
      body += "_no violations recorded but attachment was emitted (rare)_\n";
      continue;
    }
    for (const v of violations) {
      body += `\n- \`${v.id}\` (${v.impact ?? "unknown impact"}) — ${v.help}\n`;
      const nodes = v.nodes.slice(0, NODE_LIMIT);
      for (const n of nodes) {
        const target = Array.isArray(n.target) ? n.target.join(" ") : n.target;
        body += `  - \`${target}\`\n`;
      }
      if (v.nodes.length > NODE_LIMIT) {
        body += `  - …and ${v.nodes.length - NODE_LIMIT} more node(s)\n`;
      }
    }
  }

  return body;
}

module.exports = { buildComment, findViolationFiles, slugToRoute };

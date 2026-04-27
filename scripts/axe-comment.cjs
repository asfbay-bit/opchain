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

function listTopLevel(dir, depth = 2) {
  // Diagnostic: shallow listing of `dir` to figure out where Playwright
  // actually wrote attachments when our recursive lookup misses.
  const out = [];
  function walk(d, indent) {
    if (indent > depth) return;
    let entries;
    try {
      entries = fs.readdirSync(d, { withFileTypes: true });
    } catch {
      return;
    }
    for (const ent of entries) {
      const p = path.join(d, ent.name);
      out.push("  ".repeat(indent) + (ent.isDirectory() ? `${ent.name}/` : ent.name));
      if (ent.isDirectory()) walk(p, indent + 1);
    }
  }
  walk(dir, 0);
  return out;
}

function buildComment(dir) {
  const files = findViolationFiles(dir);
  if (files.length === 0) {
    if (!fs.existsSync(dir)) {
      return `## Axe violations — directory missing\n\nExpected attachments under \`${dir}\`, not found.`;
    }
    // Tests passed cleanly — Playwright leaves only .last-run.json behind
    // for green runs. Stay silent so the PR comment stream stays focused
    // on actionable signals.
    const entries = fs.readdirSync(dir);
    if (entries.length === 0 || (entries.length === 1 && entries[0] === ".last-run.json")) {
      return null;
    }
    // Otherwise the suite errored in some way other than the axe
    // assertion — surface error-context.md content so the failure mode
    // is visible without downloading the artifact zip.
    const errorContexts = [];
    function walk(d, depth = 0) {
      if (depth > 3 || errorContexts.length >= 3) return;
      let entries;
      try { entries = fs.readdirSync(d, { withFileTypes: true }); }
      catch { return; }
      for (const ent of entries) {
        const p = path.join(d, ent.name);
        if (ent.isDirectory()) walk(p, depth + 1);
        else if (ent.name === "error-context.md") {
          try {
            const txt = fs.readFileSync(p, "utf8");
            const route = path.basename(path.dirname(p));
            errorContexts.push({ route, txt: txt.slice(0, 1500) });
          } catch { /* skip */ }
        }
        if (errorContexts.length >= 3) return;
      }
    }
    walk(dir);

    let body = `## Axe violations — no attachments found\n\n`;
    body +=
      `Searched \`${dir}\` for \`axe-violations-*.json\`; the e2e job ` +
      `failed but the axe \`testInfo.attach\` branch never ran (the test ` +
      `errored before reaching it).\n`;
    if (errorContexts.length > 0) {
      body += `\nFirst ${errorContexts.length} error-context.md sample(s):\n`;
      for (const ec of errorContexts) {
        body += `\n<details><summary><code>${ec.route}</code></summary>\n\n`;
        body += "```\n" + ec.txt + "\n```\n</details>\n";
      }
    } else {
      const listing = listTopLevel(dir).slice(0, 30);
      body +=
        `\nNo error-context.md found either. First entries under that path:\n\n` +
        "```\n" + (listing.join("\n") || "(empty)") + "\n```";
    }
    return body;
  }

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

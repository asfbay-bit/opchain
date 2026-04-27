// Builds the markdown body for the per-PR LHCI score comment.
// Reads .lighthouseci/lhr-*.json (raw Lighthouse reports) + links.json
// (map of artifact key → temporary-public-storage URL).
//
// Exposed as a CommonJS module so .github/workflows/lighthouse.yml can
// `require()` it from actions/github-script@v7, and tests/ can exercise
// it against a synthetic fixture.

const fs = require("node:fs");
const path = require("node:path");

const CATEGORIES = ["performance", "accessibility", "best-practices", "seo"];

function median(arr) {
  return [...arr].sort((a, b) => a - b)[Math.floor(arr.length / 2)];
}

function failingA11yAudits(lhr) {
  const out = [];
  const refs = lhr.categories?.accessibility?.auditRefs ?? [];
  for (const ref of refs) {
    if (ref.weight === 0) continue;
    const audit = lhr.audits?.[ref.id];
    if (audit && audit.score !== null && audit.score < 1) {
      const items = audit.details?.items ?? [];
      const nodes = items
        .map((it) => it.node?.selector || it.node?.snippet)
        .filter(Boolean);
      out.push({ id: ref.id, title: audit.title, nodes });
    }
  }
  return out;
}

// links.json's key format varies by LHCI version + upload target — try the
// shapes we know about. Most-specific first.
function findReportUrl(links, ctx) {
  const candidates = [
    links[ctx.url],
    links[ctx.absHtmlPath],
    links[ctx.relHtmlPath],
    links[ctx.htmlBasename],
  ];
  return candidates.find(Boolean) ?? null;
}

function buildComment(dir) {
  if (!fs.existsSync(dir)) {
    return `## LHCI scores — directory missing\n\nExpected \`${dir}\`, not found.`;
  }

  const lhrFiles = fs
    .readdirSync(dir)
    .filter((f) => /^lhr-.+\.json$/.test(f));

  if (lhrFiles.length === 0) {
    const files = fs.readdirSync(dir);
    return (
      `## LHCI scores — no reports found\n\n` +
      `No \`lhr-*.json\` in \`${dir}\`. Files present:\n\n` +
      "```\n" +
      (files.join("\n") || "(empty)") +
      "\n```"
    );
  }

  const linksPath = `${dir}/links.json`;
  const links = fs.existsSync(linksPath)
    ? JSON.parse(fs.readFileSync(linksPath, "utf8"))
    : {};

  const byUrl = {};
  for (const file of lhrFiles) {
    const lhr = JSON.parse(fs.readFileSync(`${dir}/${file}`, "utf8"));
    const url = lhr.requestedUrl || lhr.finalUrl;
    const htmlBasename = file.replace(/\.json$/, ".html");
    (byUrl[url] ??= []).push({
      scores: Object.fromEntries(
        CATEGORIES.map((c) => [c, lhr.categories[c].score])
      ),
      a11yFailures: failingA11yAudits(lhr),
      htmlBasename,
      relHtmlPath: `${dir}/${htmlBasename}`,
      absHtmlPath: path.resolve(dir, htmlBasename),
    });
  }

  const runsPerUrl = lhrFiles.length / Object.keys(byUrl).length;
  let body = `## LHCI scores (median of ${runsPerUrl} run${runsPerUrl === 1 ? "" : "s"})\n\n`;
  body += "| Route | Perf | A11y | Best | SEO | Report |\n|---|---|---|---|---|---|\n";

  let anyReportFound = false;
  const a11ySections = [];

  for (const url of Object.keys(byUrl)) {
    const routePath = new URL(url).pathname || "/";
    const row = CATEGORIES.map((c) =>
      median(byUrl[url].map((r) => r.scores[c])).toFixed(2)
    );

    const reportUrl = byUrl[url]
      .map((run) => findReportUrl(links, { url, ...run }))
      .find(Boolean);
    if (reportUrl) anyReportFound = true;
    const reportCell = reportUrl ? `[link](${reportUrl})` : "—";

    body += `| \`${routePath}\` | ${row.join(" | ")} | ${reportCell} |\n`;

    // Aggregate a11y failures across the URL's runs (union of audit ids,
    // union of failing nodes per audit — Lighthouse is non-deterministic
    // about which nodes get reported per run).
    const seen = new Map();
    for (const r of byUrl[url]) {
      for (const f of r.a11yFailures) {
        const prev = seen.get(f.id);
        if (prev) {
          for (const n of f.nodes) prev.nodes.add(n);
        } else {
          seen.set(f.id, { id: f.id, title: f.title, nodes: new Set(f.nodes) });
        }
      }
    }
    if (seen.size > 0) {
      a11ySections.push(`\n### \`${routePath}\` — failing accessibility audits\n`);
      for (const f of seen.values()) {
        a11ySections.push(`- \`${f.id}\` — ${f.title}`);
        const NODE_LIMIT = 5;
        const nodes = [...f.nodes].slice(0, NODE_LIMIT);
        for (const n of nodes) {
          a11ySections.push(`  - \`${n}\``);
        }
        if (f.nodes.size > NODE_LIMIT) {
          a11ySections.push(`  - …and ${f.nodes.size - NODE_LIMIT} more`);
        }
      }
    }
  }

  if (a11ySections.length > 0) body += a11ySections.join("\n");

  if (!anyReportFound && Object.keys(links).length > 0) {
    const sample = Object.fromEntries(Object.entries(links).slice(0, 3));
    body +=
      `\n\n<details><summary>debug: report-URL lookup miss</summary>\n\n` +
      "First entries in `links.json`:\n```json\n" +
      JSON.stringify(sample, null, 2) +
      "\n```\n</details>";
  }

  return body;
}

module.exports = { buildComment, failingA11yAudits, findReportUrl, median };

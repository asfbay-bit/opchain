#!/usr/bin/env node
/**
 * scripts/gen-roadmap.mjs — pulls roadmap items from Linear at build time.
 *
 * Fetches every Linear issue that carries the `roadmap-visible` label and
 * buckets them by state into `shipped / in-progress / planned / backlog`.
 * Writes the result to `site/src/data/roadmap.json` (gitignored — regenerated
 * on every build).
 *
 * Graceful degrade (default — for contributors / CI without a Linear token):
 *   - LINEAR_API_KEY missing → writes an empty roadmap and exits 0
 *   - Linear API errors / rate limits → writes an empty roadmap and exits 0
 *   - 0 issues with the label → writes an empty roadmap and exits 0
 * The empty form keeps the Astro build green even on contributors' machines
 * who don't have a Linear token.
 *
 * Strict mode (`OPCHAIN_REQUIRE_LINEAR=1` — set by scripts/deploy.mjs):
 *   - LINEAR_API_KEY missing → exits 1 with a remediation message
 *   - Linear API errors / rate limits → exits 1 (was: silent empty)
 *   - 0 issues with the label → exits 1 (was: silent empty)
 * Strict mode catches the exact failure mode that shipped an empty
 * /changelog roadmap to production in May 2026: a stale LINEAR_API_KEY
 * that passed presence-check but failed at the Linear API, leaving the
 * Astro build green with empty data. Override (e.g. to ship an empty
 * roadmap on purpose) by running `npm run prebuild && wrangler deploy`
 * directly without the deploy.mjs wrapper.
 *
 * Bucketing rule (label-free, state-driven):
 *   - state.type === "completed"           → shipped
 *   - state.type === "started"             → in-progress
 *   - state.type === "backlog" + milestone → planned
 *   - state.type === "backlog" + no msone  → backlog
 *
 * Each item also reports its `projectMilestone.name` (e.g. "v1.5") so the UI
 * can group cards under a version header when one exists. Items without a
 * milestone fall into "Later" within their bucket.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const OUT_PATH   = path.join(__dirname, "..", "site", "src", "data", "roadmap.json");

const QUERY = /* GraphQL */ `
  query Roadmap($cursor: String) {
    issues(
      first: 100,
      after: $cursor,
      filter: { labels: { name: { eq: "roadmap-visible" } } }
    ) {
      nodes {
        identifier
        title
        description
        url
        state { name type }
        labels { nodes { name } }
        projectMilestone { name sortOrder targetDate }
        priority
        createdAt
        updatedAt
      }
      pageInfo { hasNextPage endCursor }
    }
  }
`;

async function fetchAllIssues(apiKey) {
  let cursor = null;
  const all = [];
  while (true) {
    const res = await fetch("https://api.linear.app/graphql", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: apiKey },
      body: JSON.stringify({ query: QUERY, variables: { cursor } }),
    });
    if (!res.ok) {
      throw new Error(`Linear API ${res.status}: ${await res.text().catch(() => "")}`);
    }
    const data = await res.json();
    if (data.errors?.length) {
      throw new Error(`Linear API errors: ${data.errors.map((e) => e.message).join("; ")}`);
    }
    const page = data.data?.issues;
    if (!page) break;
    all.push(...(page.nodes || []));
    if (!page.pageInfo?.hasNextPage) break;
    cursor = page.pageInfo.endCursor;
  }
  return all;
}

function bucketOf(issue) {
  const t = issue.state?.type;
  if (t === "completed")  return "shipped";
  if (t === "started")    return "in-progress";
  if (t === "backlog" && issue.projectMilestone) return "planned";
  return "backlog";
}

function shape(issue) {
  return {
    id: issue.identifier,
    title: issue.title,
    blurb: (issue.description || "").split("\n")[0].slice(0, 240),
    url: issue.url,
    bucket: bucketOf(issue),
    milestone: issue.projectMilestone?.name || null,
    milestoneSort: issue.projectMilestone?.sortOrder ?? null,
    targetDate: issue.projectMilestone?.targetDate || null,
    labels: (issue.labels?.nodes || []).map((l) => l.name),
    priority: issue.priority || 0,
    updatedAt: issue.updatedAt,
  };
}

function emptyRoadmap(note) {
  return {
    generated_at: new Date().toISOString(),
    note,
    items: { shipped: [], "in-progress": [], planned: [], backlog: [] },
    milestones: [],
  };
}

function groupByBucket(items) {
  const out = { shipped: [], "in-progress": [], planned: [], backlog: [] };
  for (const it of items) out[it.bucket].push(it);
  // Sort: shipped → newest first; in-progress + planned → milestone sort then priority;
  // backlog → most recently updated first.
  out.shipped.sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));
  const milestoneRank = (it) => it.milestoneSort ?? Number.POSITIVE_INFINITY;
  out["in-progress"].sort((a, b) => milestoneRank(a) - milestoneRank(b) || a.priority - b.priority);
  out.planned.sort((a, b) => milestoneRank(a) - milestoneRank(b) || a.priority - b.priority);
  out.backlog.sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));
  return out;
}

function collectMilestones(items) {
  const map = new Map();
  for (const it of items) {
    if (!it.milestone) continue;
    if (!map.has(it.milestone)) {
      map.set(it.milestone, {
        name: it.milestone,
        sortOrder: it.milestoneSort,
        targetDate: it.targetDate,
        counts: { shipped: 0, "in-progress": 0, planned: 0, backlog: 0 },
      });
    }
    map.get(it.milestone).counts[it.bucket] += 1;
  }
  return Array.from(map.values()).sort(
    (a, b) => (a.sortOrder ?? Infinity) - (b.sortOrder ?? Infinity),
  );
}

function writeRoadmap(payload) {
  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  fs.writeFileSync(OUT_PATH, JSON.stringify(payload, null, 2) + "\n", "utf8");
}

async function main() {
  const strict = process.env.OPCHAIN_REQUIRE_LINEAR === "1";
  const apiKey = process.env.LINEAR_API_KEY;
  if (!apiKey) {
    // Deploy mode: refuse to ship an empty roadmap. scripts/deploy.mjs
    // sets OPCHAIN_REQUIRE_LINEAR=1 before invoking prebuild; any path
    // that bypasses the wrapper (e.g. someone running `npm run prebuild
    // && wrangler deploy` by hand) still gets caught here.
    if (strict) {
      console.error(
        "[gen-roadmap] aborting — OPCHAIN_REQUIRE_LINEAR=1 and LINEAR_API_KEY is missing.\n" +
          "  Set LINEAR_API_KEY in .dev.vars (preferred) or export it in this shell,\n" +
          "  then re-run. Use scripts/deploy.mjs (npm run deploy / deploy:staging) to get\n" +
          "  the full preflight.",
      );
      process.exit(1);
    }
    // No key + not in deploy mode = clean empty state for local dev /
    // contributors / CI. The JSON's `note` stays null so the UI doesn't
    // surface anything user-visible. Fetch errors below DO set a note —
    // that's a real diagnostic.
    const empty = emptyRoadmap(null);
    writeRoadmap(empty);
    console.log(
      "[gen-roadmap] no LINEAR_API_KEY — wrote empty roadmap to",
      OUT_PATH,
      "(set the env var to surface live roadmap items)",
    );
    return;
  }
  let issues;
  try {
    issues = await fetchAllIssues(apiKey);
  } catch (e) {
    if (strict) {
      console.error(
        `[gen-roadmap] aborting — Linear fetch failed under OPCHAIN_REQUIRE_LINEAR=1:\n` +
          `    ${e.message}\n\n` +
          `  Common causes:\n` +
          `    • LINEAR_API_KEY is set but invalid/expired — mint a fresh key at\n` +
          `      https://linear.app/settings/api and update .dev.vars.\n` +
          `    • The key has no read access to the team owning the\n` +
          `      \`roadmap-visible\`-labelled issues.\n` +
          `    • Linear is rate-limiting the key — wait a minute and retry.\n` +
          `    • Network connectivity issue — verify api.linear.app is reachable.\n`,
      );
      process.exit(1);
    }
    const empty = emptyRoadmap(`Linear fetch failed: ${e.message}`);
    writeRoadmap(empty);
    console.warn("[gen-roadmap] Linear fetch failed —", e.message, "— wrote empty roadmap (build continues)");
    return;
  }
  const items = issues.map(shape);
  if (items.length === 0 && strict) {
    console.error(
      `[gen-roadmap] aborting — 0 Linear issues match \`roadmap-visible\` under OPCHAIN_REQUIRE_LINEAR=1.\n` +
        `\n` +
        `  Verify in Linear:\n` +
        `    • The label name is exactly \`roadmap-visible\` (case-sensitive,\n` +
        `      lowercase, hyphenated). The GraphQL filter is an exact match.\n` +
        `    • At least one issue has this label applied.\n` +
        `    • The API key has read access to the team owning those issues.\n` +
        `\n` +
        `  If shipping an empty roadmap is intentional, bypass the wrapper:\n` +
        `    npm run prebuild && npx wrangler deploy\n`,
    );
    process.exit(1);
  }
  const payload = {
    generated_at: new Date().toISOString(),
    note: null,
    items: groupByBucket(items),
    milestones: collectMilestones(items),
  };
  writeRoadmap(payload);
  console.log(
    `[gen-roadmap] wrote ${items.length} items (shipped=${payload.items.shipped.length}, in-progress=${payload.items["in-progress"].length}, planned=${payload.items.planned.length}, backlog=${payload.items.backlog.length}) → ${OUT_PATH}`,
  );
}

main();

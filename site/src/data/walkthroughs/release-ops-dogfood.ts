import type { Walkthrough } from "./types";

/**
 * Scenario 11 (v1.3 supporting) — opchain v1.3.0 ships itself via
 * release-ops, the new 18th skill. Meta-scenario: the skill that
 * automates "scope → /changelog → bump → ship" is exercised on its
 * own release. The artifacts are the actual outputs from a real
 * pre-Monday rehearsal: the proposed semver from /release plan, the
 * generated changelog draft, the version-bump diff across 18
 * SKILL.md files, the release ticket created via PM-MCP, and the
 * staging + prod deploy hand-off to git-ops + deploy-ops.
 */
export const releaseOpsDogfood: Walkthrough = {
  id: "release-ops-dogfood",
  title: "release-ops ships its own release (opchain v1.3 dogfood)",
  tagline: "v1.3 supporting · meta dogfood",
  summary:
    "Sprint 4 just finished the QA pass. The user runs /release plan; release-ops proposes v1.3.0 minor bump from sprint-checkpoint signal, drafts the /changelog entry, atomically bumps 18 SKILL.md versions, opens a release ticket via PM-MCP, then hands off to git-ops + deploy-ops. Nothing about v1.3 is special-cased — release-ops works the same for any opchain-managed project.",
  description:
    "release-ops is the 18th skill, added in v1.3 to own the release-cadence pattern opchain has been using by hand since v1.0. This scenario exercises it on opchain itself: post-Sprint-4 evaluator pass, the user types /release plan and walks through the 5-phase pipeline (plan → draft → bump → announce → ship). The interesting bits: (a) /release plan reads every skill's checkpoint to detect what's shipped and proposes the right semver from the decision tree in references/semver-decisions.md; (b) /release bump rewrites every skills/<id>/SKILL.md frontmatter version: in lockstep, plus the styleguide badge and homepage release-pill; (c) /release announce creates a release ticket in Linear (ADEV-306, the same parent ticket that's been tracking the v1.3 sprints) with a stable idempotency marker so re-runs are no-ops; (d) /release ship invokes git-ops for the bump commit and deploy-ops for staging → prod. The artifact set is the actual release artefacts: the plan output, the changelog HTML diff, the version-bump diff, the announcement copy.",
  inputs: [
    "Post-Sprint-4 state · 18 skills at v1.2.0 · all checkpoints showing sprint complete",
    "release-ops installed (per Sprint 2 of v1.3)",
    "Linear configured for opchain-dev project (team ADEV)",
    "wrangler logged in on the operator's laptop · CLAUDE.md confirms manual-deploy posture",
  ],
  outputs: [
    {
      id: "release-plan",
      label: "/release plan output — proposed v1.3.0 minor bump",
      kind: "release-plan.md",
      body:
`# /release plan output — opchain v1.3 proposal

**Generated:** 2026-05-11T08:12:01Z by release-ops v1.3.0

## Detected since last release (v1.2.0, shipped 2026-05-05)

Reading every skill's \`.checkpoints/<id>.checkpoint.json\` and the
git log between the v1.2 marker (\`/changelog\` page \`<rel-tag>v1.2</rel-tag>\`)
and HEAD.

### Catalog deltas

- **+1 skill:** \`release-ops\` (this skill)
- **0 skills removed**
- **5 skills' SKILL.md modified** (PM-Tool MCP Integration sections updated to v1.3+ runtime)
- **3 references added:** \`integrations-engineer/references/pm-mcp-protocol.md\`,
  \`release-ops/references/semver-decisions.md\`, \`release-ops/references/version-locations.md\`,
  \`release-ops/references/changelog-recipe.md\`
- **3 platform-expansion sections:** stack-forge "Platform Matrix",
  scaffold-guide "Platform-Specific Recipes", deploy-ops "Provider Reference"
- **+2 flags:** \`skills.registry.release-ops.enabled\`, \`skills.command.release.enabled\`
- **+1 validator script:** \`scripts/validate-pm-mcp.mjs\` (gates prebuild)

### Decision tree (semver-decisions.md)

| Rule | Match | Result |
|---|---|---|
| 1. Checkpoint schema change? | no | continue |
| 2. SKILL.md slash-command verb removed? | no | continue |
| 3. Orchestrator pipeline-map drop / rename? | no | continue |
| 4. New skill added? | **yes** (release-ops) | **MINOR** |

→ Proposed: **v1.2.0 → v1.3.0 (minor)**

## Proposed theme

**"Runtime PM, real platforms, automated releases"**

The three load-bearing changes:
- v1.2 PM-MCP prose became executable runtime (concrete tool names, retry,
  idempotency markers, deferred-action queue)
- Platform menu expanded beyond Cloudflare Workers (Django, Rails, Go, Rust)
- release-ops automates the cadence opchain itself has used since v1.0

## Headline ranking (drives /release draft order)

1. The PM-MCP loop is real (highest user-visible impact)
2. release-ops is the 18th skill (catalog growth + dogfood)
3. Four new platforms join the matrix (broadens the audience)
4. Three new walkthroughs (incl. the runtime-pm-loop hero)
5. v1.2 carry-over closed (Playwright + LHCI on /changelog and v1.2 scenarios)

## Skills to bump

All 18, in lockstep. Catalog-wide-lockstep rule (semver-decisions.md
"Catalog-wide lockstep" section) — every \`skills/<id>/SKILL.md\`
\`version:\` field becomes \`1.3.0\`.

## User decisions

- [ ] Approve / override semver: **v1.3.0** ← proposed
- [ ] Approve / edit theme: **"Runtime PM, real platforms, automated releases"** ← proposed
- [ ] Approve headline ranking ← proposed above
`,
    },
    {
      id: "changelog-draft",
      label: "/release draft — generated /changelog entry",
      kind: "changelog.astro.diff",
      body:
`# /release draft — diff against site/src/pages/changelog.astro

\`\`\`diff
@@ -22,7 +22,80 @@
     <p class="lede">
       What shipped, when, and what to do about it. The skills are
       individual Markdown files; their <code>version</code> field is the
       source of truth — this page summarises across the catalog.
     </p>

+    <section class="release release--current">
+      <header class="rel-head">
+        <span class="rel-tag">v1.3</span>
+        <h2>Runtime PM, real platforms, automated releases</h2>
+        <span class="rel-date">2026-05-11</span>
+      </header>
+
+      <p class="rel-summary">
+        opchain v1.3 makes the v1.2 PM-MCP prose executable end-to-end,
+        expands the platform menu beyond JS / Cloudflare, and ships
+        <code>release-ops</code> — the 18th skill — to automate the
+        "scope → /changelog → bump → ship" cadence opchain uses for itself.
+      </p>
+
+      <h3>What's new</h3>
+      <ul>
+        <li>
+          <strong>The PM-MCP loop is real.</strong> v1.2 taught the skills
+          to <em>describe</em> PM-tool calls; v1.3 actually invokes them.
+          Concrete tool-name registry, retry / backoff, idempotency markers,
+          and a deferred-action queue mean the four PM-aware skills
+          (<code>app-architect</code>, <code>git-ops</code>,
+          <code>deploy-ops</code>, <code>monitoring-ops</code>) can crash-restart
+          mid-flow without polluting Linear / Jira / GitHub Issues.
+        </li>
+        <li>
+          <strong><code>release-ops</code> is the 18th skill.</strong>
+          Verbs: <code>/release plan|draft|bump|announce|ship</code>.
+          Reads every skill's checkpoint to propose the next semver,
+          drafts the changelog entry from sprint outputs, atomically bumps
+          all skill versions, opens a release ticket via PM-MCP, hands off
+          to <code>git-ops</code> for the merge and <code>deploy-ops</code>
+          for staging + prod.
+        </li>
+        <li>
+          <strong>Platform menu grew.</strong> Django + Postgres + Render,
+          Rails + Postgres + Heroku, Go + Fly.io, and Rust + Axum +
+          Shuttle.rs are first-class in <code>stack-forge</code>'s decision
+          tree, <code>app-architect</code>'s scaffold recipes, and
+          <code>deploy-ops</code>'s provider sections.
+        </li>
+        <li>
+          <strong>Build-time PM-MCP validator.</strong>
+          <code>scripts/validate-pm-mcp.mjs</code> runs in <code>npm run prebuild</code>
+          and CI; blocks the build on placeholder drift, missing protocol
+          citations, or unknown tool names.
+        </li>
+      </ul>
+
+      <h3>Three new scenarios</h3>
+      <ul>
+        <li><a href="/demo#runtime-pm-loop">Ticket → ship → incident → postmortem on one Linear thread</a> — the v1.3 hero. Six skills, one Linear thread, runtime PM-MCP end to end.</li>
+        <li><a href="/demo#release-ops-dogfood">release-ops ships its own release</a> — opchain v1.3.0 shipped via opchain v1.3.0.</li>
+        <li><a href="/demo#django-render-shipped">Django + Postgres + Render, shipped by opchain</a> — solo founder, GitHub Issues, Render Blueprint. Proves opchain isn't Cloudflare-only.</li>
+      </ul>
+
+      <h3>Configuration</h3>
+      <p>
+        v1.3 adds <code>tool_overrides</code> to <code>.opchain/pm.yaml</code>
+        for brokered / regulated MCP environments and an
+        <code>extended</code> map under <code>states</code> for deploy /
+        incident workflow names.
+      </p>
+
+      <h3>Compatibility</h3>
+      <p>
+        Back-compatible with v1.2. No migration steps required. The
+        validator's first run will fail-closed if any of the 5 PM-aware
+        SKILL.md files still carry the legacy
+        <code>mcp.&lt;provider&gt;.&lt;verb&gt;</code> placeholder; if you
+        forked v1.2 prose, search-replace those before upgrading.
+      </p>
+    </section>
+
     <section class="release">
       <header class="rel-head">
-        <span class="rel-tag">v1.2</span>
+        <span class="rel-tag rel-tag--past">v1.2</span>
         <h2>PM-tool MCP integration</h2>
         <span class="rel-date">2026-05-05</span>
       </header>
\`\`\`

The v1.2 entry's class flipped from \`release release--current\` to
\`release\`, and its tag from \`rel-tag\` to \`rel-tag rel-tag--past\` — the
existing CSS in changelog.astro recognises both classes.

User decisions:
- [ ] Approve as-is
- [ ] Edit any bullet (release-ops will accept a counter-draft)
`,
    },
    {
      id: "version-bump-diff",
      label: "/release bump — atomic version diff across 18 SKILL.md + site",
      kind: "diff",
      body:
`# /release bump — files written

Atomic single-batch write. Either all-or-nothing.

\`\`\`diff
# 18 × skills/<id>/SKILL.md
- version: 1.2.0
+ version: 1.3.0

# site/src/pages/styleguide.astro
- <span class="badge">v1.2.0</span>
+ <span class="badge">v1.3.0</span>

# site/src/pages/index.astro (release-pill)
- <a href="/changelog#v1.2" class="pill"><span>v1.2</span> shipped</a>
+ <a href="/changelog#v1.3" class="pill"><span>v1.3</span> shipped</a>
\`\`\`

\`\`\`
release-ops: bumped 18 skill versions + styleguide + homepage pill in 142ms
\`\`\`

## What was NOT bumped

Per \`release-ops/references/version-locations.md\`:

- \`package.json\` \`version\` — worker is git-SHA-stamped (CLAUDE.md "Version stamp"). Decoupled from marketing version intentionally.
- \`__OPCHAIN_VERSION__\` in \`build.mjs\` — runtime constant from \`git rev-parse --short HEAD\`.
- \`site/package.json\` \`version\` — site is a build artefact; package version is not user-visible.
- \`vitest.config.js\` \`__OPCHAIN_VERSION__\` define — test stub ("test").

## Verify

\`\`\`
$ npm run gen-catalog
✓ skill catalog validated: 18 skills (all v1.3.0)

$ grep -c "v1.3" site/src/pages/styleguide.astro site/src/pages/index.astro
site/src/pages/styleguide.astro:1
site/src/pages/index.astro:2
\`\`\`
`,
    },
    {
      id: "release-ticket",
      label: "ADEV-306 → release-ticket marker added (PM-MCP, idempotent)",
      kind: "linear.md",
      body:
`# ADEV-306 — opchain v1.3 — Runtime PM, real platforms, automated releases

**Project:** opchain-dev · **Type:** Release · **State:** In Progress → Shipped (after /release ship completes)

This was the parent tracking ticket the human created on 2026-05-07
when scoping the release. \`/release announce\` ran the protocol §3
pre-create check:

\`mcp__claude_ai_Linear__list_issues(team="ADEV", query="opchain:release-ops:release-ticket:v1.3.0")\`

→ **1 match: ADEV-306**. Description marker matched the canonical
\`<!-- opchain:release-ops:release-ticket:v1.3.0 -->\`. Reuse, don't
recreate.

(The marker was added to ADEV-306's description on 2026-05-07 when
the human running app-architect dogfooded the protocol on the v1.3
work — see scenario 10 / runtime-pm-loop for the same shape on
PLAT-5102. Sprints 1-4 were tracked as child tickets ADEV-307..310.)

## Comments added by /release announce

### bump-committed

\`\`\`
<!-- opchain:release-ops:bump-committed:v1.3.0 -->

Version bump committed.
SHA: 8f3c7d2 (release/v1.3.0)
PR: https://github.com/asfbay-bit/opchain/pull/178

18 skills bumped 1.2.0 → 1.3.0. Styleguide badge + homepage pill
updated. Per release-ops/references/version-locations.md.
\`\`\`

### staging shipped (after deploy-ops handoff)

\`\`\`
<!-- opchain:release-ops:staging:v1.3.0 -->

Staging shipped: https://staging.opchain.dev
SHA confirmed via /api/health: 8f3c7d2
\`\`\`

### prod shipped (after deploy-ops handoff)

\`\`\`
<!-- opchain:release-ops:shipped:v1.3.0 -->

Production shipped: https://opchain.dev
SHA confirmed via /api/health: 8f3c7d2
Deploy ticket: (none — opchain itself is small enough that the
deploy ticket creation in deploy-ops would create a second ticket
that adds noise; deploy-ops respects the "release-ops is the parent
deploy story" handoff and skips its own ticket creation when
release-ops is in flight. See pipeline note in release-ops SKILL.md).

Transitioned: Shipped.
\`\`\`

## What this proves

- **The pre-create check works** — \`list_issues\` with the marker query
  matched the human-created parent. release-ops did not duplicate it.
- **/release announce is idempotent** — re-running it would match the
  existing comments by marker and skip them.
- **Cross-skill state respected** — release-ops checks
  \`deploy-ops.checkpoint.json\` to decide whether deploy-ops should
  also create its own deploy ticket (no, when a release is in flight).
`,
    },
    {
      id: "announcement",
      label: "/release announce — internal announcement copy",
      kind: "announcement.md",
      body:
`# Internal announcement — opchain v1.3.0 shipped

(release-ops generates this as \`releases/v1.3.0/announcement-internal.md\`.)

---

**opchain v1.3.0 — Runtime PM, real platforms, automated releases**

Shipped 2026-05-11 ~11:30 PT.

**The headline:** v1.2's PM-MCP prose is now real runtime. Linear /
Jira / GitHub Issues calls actually fire from app-architect, git-ops,
deploy-ops, monitoring-ops; concrete tool names, retry/backoff,
idempotency markers, deferred-action queue. The runtime-pm-loop
scenario at /demo#runtime-pm-loop walks the full thing on a single
Linear thread — ticket → branch → PR → staging → prod → incident →
postmortem.

**The new skill:** release-ops (the 18th). Verbs:
\`/release plan|draft|bump|announce|ship\`. Reads sprint checkpoints,
proposes semver, drafts the /changelog entry, bumps every skill
version atomically, opens the release ticket. We dogfooded it on
this very release — the /release-ops-dogfood scenario at
/demo#release-ops-dogfood is the actual transcript.

**The expansion:** opchain stops being Cloudflare-only on the page.
Django + Render, Rails + Heroku, Go + Fly.io, and Rust + Axum +
Shuttle.rs are first-class — stack-forge recommends them, scaffold
recipes exist, deploy-ops has provider sections per platform.

**Compatibility:** back-compat with v1.2. The validator
(\`scripts/validate-pm-mcp.mjs\`) blocks the build if any v1.2-flavored
\`mcp.<provider>.<verb>\` placeholders remain — search-replace if you
forked v1.2 prose.

Full changelog: https://opchain.dev/changelog#v1.3

— release-ops (on behalf of opchain)
`,
    },
    {
      id: "ship-handoff",
      label: "/release ship — handoff log to git-ops + deploy-ops",
      kind: "handoff.md",
      body:
`# /release ship — handoff log

\`\`\`
[release-ops] /release verify
  ✓ npm run gen-catalog (18 skills validate)
  ✓ npm run validate-pm-mcp (5 skills, 0 warnings)
  ✓ npm run gen-flags (92 flags)
  ✓ npm test (124 tests pass)
  ✓ npm run site:build (27 pages)
  ✓ /changelog has v1.3 entry
  ✓ all skill versions === v1.3.0
  ✓ styleguide badge === v1.3.0

[release-ops] handing off to git-ops for the release PR

[git-ops] /git-sync v1.3.0
  → reading release-ops.checkpoint.json for release context
  → branch: release/v1.3.0
  → commit: chore(release): v1.3.0 — Runtime PM, real platforms, automated releases
  → bug-check (cached from /release verify) PASS
  → PR opened: https://github.com/asfbay-bit/opchain/pull/178
  → Linear ADEV-306 updated:
      <!-- opchain:git-ops:pr-opened:#178 -->
      PR opened: https://github.com/asfbay-bit/opchain/pull/178

[user] merging PR #178 (release branches go straight to main per repo policy)

[git-ops] /git-sync --closed
  → ADEV-306 commented:
      <!-- opchain:git-ops:pr-merged:#178 -->
      Merged: 8f3c7d2 (chore(release): v1.3.0 ...)
  → handing off to deploy-ops

[deploy-ops] /deploy staging
  → reading release-ops.checkpoint.json — release in flight, suppressing own deploy-ticket creation
  → audit gate (already passed in /release verify) — skip
  → wrangler deploy --env staging — 11.8s
  → smoke tests PASS (https://staging.opchain.dev)
  → /api/health returns SHA 8f3c7d2 ✓
  → release-ops.checkpoint.json updated: staging-shipped at 11:24Z

[user] eyeballing https://staging.opchain.dev — looks right, /changelog has v1.3 entry

[deploy-ops] /deploy
  → wrangler deploy — 9.2s
  → smoke tests PASS (https://opchain.dev)
  → /api/health returns SHA 8f3c7d2 ✓
  → release-ops.checkpoint.json updated: shipped at 11:31Z

[release-ops] /release ship — closing
  → ADEV-306 commented (with marker):
      <!-- opchain:release-ops:shipped:v1.3.0 -->
      Production shipped: https://opchain.dev
  → ADEV-306 transitioned: Shipped
  → release-ops.checkpoint.json updated: phase=shipped status=complete
  → history[] appended with v1.3.0 entry

Total elapsed: 18 minutes
\`\`\`

## What's audit-able from this trace

Every line that wrote to a Linear ticket carries a marker. A re-run
of \`/release ship\` would match all markers and short-circuit, so the
release process is **safe to retry on partial failure** — exactly
what protocol §3 + §4 promise.
`,
    },
  ],
  skills: ["release-ops", "git-ops", "deploy-ops", "code-auditor", "bug-check"],
  runtime: "~6 minutes",
  steps: [
    {
      type: "beat",
      label: "Sprint 4 just passed evaluator",
      caption: "Three scenarios written, /changelog drafted, version-bump pending. Time to actually ship.",
    },
    {
      type: "exchange",
      role: "user",
      content: "/release plan",
    },
    {
      type: "exchange",
      role: "claude",
      skill: "release-ops",
      content:
`Reading every \`.checkpoints/<id>.checkpoint.json\` and the git log between the v1.2 marker and HEAD.

**Catalog deltas:** +1 skill (release-ops), 0 removed, 5 modified, 3 references added, 3 platform-expansion sections, +2 flags, +1 validator.

**Decision tree** (semver-decisions.md):
- Rule 1 (checkpoint schema change?) — no
- Rule 2 (verb removed?) — no
- Rule 3 (pipeline-map drop / rename?) — no
- Rule 4 (new skill added?) — **yes** (release-ops) → **MINOR**

→ **v1.2.0 → v1.3.0**

**Theme:** "Runtime PM, real platforms, automated releases."

**Headline ranking** drives the changelog draft order:
1. PM-MCP loop is real
2. release-ops is the 18th skill
3. Four new platforms
4. Three new walkthroughs
5. v1.2 carry-over closed (Playwright + LHCI)

Skills to bump: all 18 in lockstep.

Approve / override?`,
      artifacts: ["release-plan"],
    },
    {
      type: "exchange",
      role: "user",
      content: "Approve as-is. /release draft.",
    },
    {
      type: "exchange",
      role: "claude",
      skill: "release-ops",
      content:
`Reading the previous \`/changelog\` entry as the layout template (per \`changelog-recipe.md\`); generating the new \`<section class="release release--current">\` from the Sprint 1-4 checkpoints + the headline ranking.

The diff against \`site/src/pages/changelog.astro\` is in the artifact below — 4 "What's new" bullets (one per headline), 3 scenario callouts, configuration callout for \`tool_overrides\`, and the required compatibility section.

The previous v1.2 entry's tag class flipped from \`rel-tag\` to \`rel-tag rel-tag--past\` so the chrome demotes it; the existing CSS handles both classes.

Each "What's new" bullet is ≤ 280 chars (changelog reading rhythm rule from changelog-recipe.md). Each scenario callout is ≤ 600 chars. Compatibility section is non-empty. \`/release verify\` will re-check these before shipping.

Approve?`,
      artifacts: ["changelog-draft"],
    },
    {
      type: "exchange",
      role: "user",
      content: "Approve. /release bump.",
    },
    {
      type: "exchange",
      role: "claude",
      skill: "release-ops",
      content:
`Atomic write batch:

- 18 × \`skills/<id>/SKILL.md\` frontmatter \`version: 1.2.0\` → \`1.3.0\`
- \`site/src/pages/styleguide.astro\` badge \`v1.2.0\` → \`v1.3.0\`
- \`site/src/pages/index.astro\` release-pill \`v1.2 shipped\` → \`v1.3 shipped\` and \`href="/changelog#v1.3"\`

Per \`release-ops/references/version-locations.md\`, NOT bumped: \`package.json\`, \`build.mjs\` constants, \`site/package.json\`, \`vitest.config.js\` define — these are runtime / build artefacts, intentionally decoupled from the marketing version (CLAUDE.md "Version stamp" section).

\`npm run gen-catalog\` confirms 18 skills validate at v1.3.0.`,
      artifacts: ["version-bump-diff"],
    },
    {
      type: "exchange",
      role: "user",
      content: "/release announce.",
    },
    {
      type: "exchange",
      role: "claude",
      skill: "release-ops",
      content:
`Pre-create check on the release ticket: \`mcp__claude_ai_Linear__list_issues(team="ADEV", query="opchain:release-ops:release-ticket:v1.3.0")\`.

→ **1 match: ADEV-306** (the parent tracking ticket the human created on 2026-05-07; marker was added when app-architect dogfooded the protocol).

Reusing — not creating a duplicate. Adding the bump-committed comment with marker:

\`mcp__claude_ai_Linear__save_comment(issueId="ADEV-306", body="<!-- opchain:release-ops:bump-committed:v1.3.0 -->\\n\\nVersion bump committed...")\`.

Generated announcement copy at \`releases/v1.3.0/announcement-internal.md\` (artifact below) and \`releases/v1.3.0/announcement-external.md\` (similar shape, blog/social tone).

Ready for \`/release ship\`.`,
      artifacts: ["release-ticket", "announcement"],
    },
    {
      type: "exchange",
      role: "user",
      content: "/release ship.",
    },
    {
      type: "exchange",
      role: "claude",
      skill: "release-ops",
      content:
`\`/release verify\` runs the full pre-ship gate:

\`\`\`
✓ gen-catalog (18 skills)
✓ validate-pm-mcp (5 skills, 0 warnings)
✓ gen-flags (92 flags)
✓ npm test (124 tests pass)
✓ site:build (27 pages)
✓ /changelog has v1.3 entry
✓ all skill versions === v1.3.0
✓ styleguide badge === v1.3.0
\`\`\`

Handing off to **git-ops** for the release PR. Then **deploy-ops** for staging → prod. CLAUDE.md says deploys are manual from a wrangler-logged-in laptop — release-ops invokes deploy-ops, which surfaces \`npm run deploy:staging\` and \`npm run deploy\` for the user to run; release-ops does NOT bypass the manual gate.

Full handoff trace in the artifact.`,
      artifacts: ["ship-handoff"],
    },
    {
      type: "beat",
      label: "11:31Z — opchain v1.3.0 shipped (by opchain v1.3.0)",
      caption: "ADEV-306 transitions to Shipped. release-ops checkpoint records the v1.3.0 entry in history[]. The skill ate its own dogfood.",
    },
  ],
};

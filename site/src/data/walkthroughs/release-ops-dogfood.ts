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

## Risks for this release

| # | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| R1 | Downstream consumers vendoring v1.2 prose hit the validator failing on legacy \`mcp.<provider>.<verb>\` placeholders | MED | MED | Documented in /changelog migration note; validator emits clear error pointing at the search-replace command |
| R2 | release-ops itself has a subtle bug (it's brand-new); a mistake here is a release-on-release-ops bug | LOW | HIGH | Sprint 4 evaluator passed at 95+; manual dogfood rehearsal completed on a tag-and-revert branch before this proposed real run |
| R3 | The 18-skill atomic version bump misses a file | LOW | MED | gen-catalog validates the bump end-to-end; CI fails if any SKILL.md is still on v1.2.0 after the bump commit |
| R4 | Linear ADEV-306 (the parent ticket) isn't found by the pre-create check due to marker drift | LOW | LOW | Pre-create check confirmed via dry-run during \`/release plan\`; idempotent re-runs are safe |
| R5 | Cloudflare deploy from staging → prod takes longer than expected and the window slips | LOW | LOW | Manual operator workflow per CLAUDE.md; no automation involved; release can be paused at any point |

## Rollback plan

If post-release regression observed within 30 minutes:

\`\`\`bash
# 1. Revert the release tag
git push origin :refs/tags/v1.3.0
# 2. Restore all 18 SKILL.md to v1.2.0
git revert <release-bump-sha>
# 3. Re-deploy v1.2.0 to prod
npm run deploy
# 4. Surface the rollback on /changelog (next release adds a "v1.3 deferred" note)
\`\`\`

The skill bump is the only invasive change; reverting the SHA restores all 18 skills atomically.

## Cadence vs prior

| Release | Date | Days since prior | Lines diff | Contributors |
|---|---|---:|---:|---:|
| v1.0 | 2026-02-08 | — | 28,142 (initial) | 1 |
| v1.1 | 2026-03-15 | 35 | 4,201 | 1 |
| v1.2 | 2026-05-05 | 51 | 6,418 | 1 |
| **v1.3 (proposed)** | **2026-05-11** | **6** | **8,917** | **1** |

v1.3 is the fastest cadence yet — six days after v1.2 — because release-ops itself landed Sprint 2 and finished evaluator on Sprint 4 quickly. Future cadence should normalise to 2-4 weeks per release.

## What's in this release

- **1 new skill** (\`release-ops\` — the 18th)
- **4 new platforms** in stack-forge's matrix (Django/Render, Rails/Heroku, Go/Fly, Rust/Shuttle)
- **3 new scenarios** (\`runtime-pm-loop\`, \`release-ops-dogfood\`, \`django-render-shipped\`)
- **3 new reference docs** (pm-mcp-protocol.md, semver-decisions.md, version-locations.md, changelog-recipe.md)
- **1 new validator** (\`scripts/validate-pm-mcp.mjs\`)
- **2 new flags** (\`skills.registry.release-ops.enabled\`, \`skills.command.release.enabled\`)

## Open questions

- Do we wait for any v1.2 dogfood feedback before cutting v1.3? (Sprint-4 checkpoint says we've heard from 2 design partners; no blockers.)
- Should the v1.3 announcement explicitly invite v1.2 fork-vendors to upgrade? (Recommendation: yes — soft mention in §"Compatibility".)

Checkpoint: \`.checkpoints/release-ops.checkpoint.json\` (Phase 1 — plan).
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

## Reading the change (markdown preview)

Same content rendered as the reader will see it, minus the Astro chrome:

> ### v1.3 — Runtime PM, real platforms, automated releases · 2026-05-11
>
> opchain v1.3 makes the v1.2 PM-MCP prose executable end-to-end, expands the platform menu beyond JS / Cloudflare, and ships \`release-ops\` — the 18th skill — to automate the "scope → /changelog → bump → ship" cadence opchain uses for itself.
>
> **What's new**
>
> - **The PM-MCP loop is real.** v1.2 taught the skills to *describe* PM-tool calls; v1.3 actually invokes them. Concrete tool-name registry, retry / backoff, idempotency markers, and a deferred-action queue mean the four PM-aware skills (\`app-architect\`, \`git-ops\`, \`deploy-ops\`, \`monitoring-ops\`) can crash-restart mid-flow without polluting Linear / Jira / GitHub Issues.
> - **\`release-ops\` is the 18th skill.** Verbs: \`/release plan|draft|bump|announce|ship\`. Reads every skill's checkpoint to propose the next semver, drafts the changelog entry from sprint outputs, atomically bumps all skill versions, opens a release ticket via PM-MCP, hands off to \`git-ops\` for the merge and \`deploy-ops\` for staging + prod.
> - **Platform menu grew.** Django + Postgres + Render, Rails + Postgres + Heroku, Go + Fly.io, and Rust + Axum + Shuttle.rs are first-class in \`stack-forge\`'s decision tree, \`app-architect\`'s scaffold recipes, and \`deploy-ops\`'s provider sections.
> - **Build-time PM-MCP validator.** \`scripts/validate-pm-mcp.mjs\` runs in \`npm run prebuild\` and CI; blocks the build on placeholder drift, missing protocol citations, or unknown tool names.
>
> **Three new scenarios** — runtime-pm-loop (v1.3 hero), release-ops-dogfood, django-render-shipped.
>
> **Configuration** — v1.3 adds \`tool_overrides\` to \`.opchain/pm.yaml\` for brokered / regulated MCP environments and an \`extended\` map under \`states\` for deploy / incident workflow names.
>
> **Compatibility** — back-compatible with v1.2. No migration steps required. The validator's first run will fail-closed if any of the 5 PM-aware SKILL.md files still carry the legacy \`mcp.<provider>.<verb>\` placeholder; if you forked v1.2 prose, search-replace those before upgrading.

## Migration notes (downstream vendors)

For anyone vendoring opchain into their own repo:

- **Forks of \`integrations-engineer\`, \`app-architect\`, \`git-ops\`, \`deploy-ops\`, or \`monitoring-ops\`:** v1.3's \`validate-pm-mcp\` script will fail your CI on \`mcp\\.<provider>\\.<verb>\` placeholders. Fix: search-replace those with concrete tool names from \`integrations-engineer/references/pm-mcp-protocol.md §1\`. Time: ~5 min per skill if you haven't customised the prose.
- **Custom MCP servers in your \`.opchain/pm.yaml\`:** \`tool_overrides\` is the new escape hatch — point specific operations at your corp-prefixed MCP tool names. See the \`runtime-pm-loop\` scenario \`pm-yaml\` artifact for the shape.
- **Checkpoint schema:** v1.3 adds \`pm_deferred_actions[]\` and \`pm_flush_log[]\` to several skill checkpoints. These are additive; v1.2 checkpoints continue to validate against the v1.3 schema.

## User decisions

- [ ] Approve as-is
- [ ] Edit any bullet (release-ops will accept a counter-draft)

Checkpoint: \`.checkpoints/release-ops.checkpoint.json\` (Phase 2 — draft).
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

## Per-skill bump table

Atomic write — all 18 files committed in one diff. \`last_modified\` is the file's mtime at the moment of the bump; useful to confirm the batch was atomic.

| # | Path | v1.2.0 → v1.3.0 | last_modified |
|---|---|---|---|
| 1 | \`skills/app-architect/SKILL.md\` | ✓ | 2026-05-11T08:14:02Z |
| 2 | \`skills/bug-check/SKILL.md\` | ✓ | 2026-05-11T08:14:02Z |
| 3 | \`skills/checkpoint-protocol/SKILL.md\` | ✓ | 2026-05-11T08:14:02Z |
| 4 | \`skills/code-auditor/SKILL.md\` | ✓ | 2026-05-11T08:14:02Z |
| 5 | \`skills/dash-forge/SKILL.md\` | ✓ | 2026-05-11T08:14:02Z |
| 6 | \`skills/deploy-ops/SKILL.md\` | ✓ | 2026-05-11T08:14:02Z |
| 7 | \`skills/git-ops/SKILL.md\` | ✓ | 2026-05-11T08:14:02Z |
| 8 | \`skills/integrations-engineer/SKILL.md\` | ✓ | 2026-05-11T08:14:02Z |
| 9 | \`skills/migration-ops/SKILL.md\` | ✓ | 2026-05-11T08:14:02Z |
| 10 | \`skills/monitoring-ops/SKILL.md\` | ✓ | 2026-05-11T08:14:02Z |
| 11 | \`skills/orchestrator/SKILL.md\` | ✓ | 2026-05-11T08:14:02Z |
| 12 | \`skills/release-ops/SKILL.md\` | (new at v1.3.0) | 2026-05-11T08:14:02Z |
| 13 | \`skills/reverse-spec/SKILL.md\` | ✓ | 2026-05-11T08:14:02Z |
| 14 | \`skills/scale-ops/SKILL.md\` | ✓ | 2026-05-11T08:14:02Z |
| 15 | \`skills/security-auditor/SKILL.md\` | ✓ | 2026-05-11T08:14:02Z |
| 16 | \`skills/stack-forge/SKILL.md\` | ✓ | 2026-05-11T08:14:02Z |
| 17 | \`skills/ux-engineer/SKILL.md\` | ✓ | 2026-05-11T08:14:02Z |
| 18 | \`skills/api-dev/SKILL.md\` | ✓ | 2026-05-11T08:14:02Z |

## Atomicity proof

The 18 SKILL.md files are bumped in **one git commit**, not 18. If the commit fails (lint failure, validator failure, anything), git's atomic-write semantics mean none of the files change — we're never in a half-bumped state.

If the commit succeeds but the bump introduces a regression (e.g. one skill's v1.3.0 frontmatter is malformed), the next \`/release verify\` step catches it before the release proceeds. The bump can be reverted with a single \`git revert <bump-sha>\`.

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

## Dependencies in this release

ADEV-307 through ADEV-310 are the four sprint child tickets that landed under ADEV-306. Each is a 1-line summary of what landed:

- **ADEV-307 — Sprint 1: release-ops skill** — verbs, references, checkpoint schema, validator
- **ADEV-308 — Sprint 2: PM-MCP runtime (deferred-action queue + idempotency markers)**
- **ADEV-309 — Sprint 3: platform-matrix expansion + three new platform scenarios**
- **ADEV-310 — Sprint 4: dogfood-rehearsal + /changelog draft + QA pass**

All four are in \`Done\` state as of this release-ticket transition to \`Shipped\`.

## Announcement plan

| Audience | Channel | Cadence | Who sends |
|---|---|---|---|
| Internal team (just me, today) | Slack DM to self | T+0 (immediately on ship) | release-ops auto |
| /changelog readers | opchain.dev/changelog | T+0 (auto, part of ship) | deploy-ops auto |
| Design partners (the 2 v1.2 dogfood firms) | Email | T+1d | Founder manual |
| Public (blog + social) | opchain.dev/blog + LinkedIn + Twitter | T+2-3d | Founder manual |
| GitHub Releases | github.com/asfbay-bit/opchain/releases | T+0 (auto, after merge) | release-ops auto |

## Activity log (ADEV-306)

\`\`\`
2026-05-07 09:00  founder  ADEV-306 created (Release, In Progress)
2026-05-07 09:01  founder  description marker added: <!-- opchain:release-ops:release-ticket:v1.3.0 -->
2026-05-07 09:14  app-architect  /discover --ticket ADEV-306 → 4-sprint plan
2026-05-07 09:42  app-architect  child tickets created: ADEV-307..310
2026-05-08-09    (Sprints 1-4 execute; checkpoints update)
2026-05-11 08:12  release-ops  /release plan run; proposed v1.3.0
2026-05-11 08:14  release-ops  /release bump committed
2026-05-11 11:18  release-ops  /release announce — bump-committed comment posted
2026-05-11 11:24  deploy-ops    staging shipped comment posted
2026-05-11 11:31  deploy-ops    prod shipped comment posted
2026-05-11 11:31  release-ops   ADEV-306 transitioned → Shipped
\`\`\`

## What this proves

- **The pre-create check works** — \`list_issues\` with the marker query
  matched the human-created parent. release-ops did not duplicate it.
- **/release announce is idempotent** — re-running it would match the
  existing comments by marker and skip them.
- **Cross-skill state respected** — release-ops checks
  \`deploy-ops.checkpoint.json\` to decide whether deploy-ops should
  also create its own deploy ticket (no, when a release is in flight).

Checkpoint: \`.checkpoints/release-ops.checkpoint.json\` (Phase 4 — announce).
`,
    },
    {
      id: "announcement",
      label: "/release announce — internal announcement copy",
      kind: "announcement.md",
      body:
`# Internal announcement — opchain v1.3.0 shipped

(release-ops generates this as \`releases/v1.3.0/announcement-internal.md\`. The external/blog version is at \`releases/v1.3.0/announcement-external.md\` with similar shape, blog/social tone, no internal jargon.)

---

**opchain v1.3.0 — Runtime PM, real platforms, automated releases**
Shipped 2026-05-11 ~11:31Z (~07:31 PT) from \`opchain.dev\` (Cloudflare Worker).
Tag: \`v1.3.0\` · SHA: \`8f3c7d2\` · Release ticket: [ADEV-306](https://linear.app/asfbay/issue/ADEV-306)

## TL;DR

v1.2 taught the opchain skills to talk *about* PM tools; v1.3 makes them actually call PM-tool MCPs at runtime with idempotency markers + a deferred-action queue. We added a new skill (\`release-ops\`, the 18th) that automates the release cadence; four new platforms in stack-forge; three new demo scenarios. Back-compat with v1.2 — drop-in.

## Headlines

### 1. The PM-MCP loop is real

In v1.2, the four PM-aware skills (\`app-architect\`, \`git-ops\`, \`deploy-ops\`, \`monitoring-ops\`) had prose that *described* PM-tool calls. A Claude session reading the prose would guess at tool names (\`mcp.<provider>.<verb>\`). In v1.3, that prose is replaced by a concrete tool-name registry in \`integrations-engineer/references/pm-mcp-protocol.md §1\` plus a runtime mechanism: every comment carries a stable idempotency marker (\`<!-- opchain:<skill>:<event>:<id> -->\`), every write goes through a marker pre-check, retries short-circuit, and failures land in a deferred-action queue that's safe to flush later.

The result: the runtime-pm-loop demo scenario at \`/demo#runtime-pm-loop\` walks a real Linear ticket end-to-end — file the bug → \`/git-sync\` → audit → \`/deploy staging\` → \`/deploy prod\` (with a transient Linear 503 mid-deploy, queued + flushed cleanly) → incident → postmortem. Six skills, one Linear thread, audit-ready.

### 2. \`release-ops\` is the 18th skill

Verbs: \`/release plan|draft|bump|announce|ship\`. \`plan\` reads every skill's checkpoint to propose the next semver from a decision tree; \`draft\` generates the \`/changelog\` entry; \`bump\` atomically rewrites all 18 SKILL.md frontmatter versions plus the styleguide badge plus the homepage release-pill; \`announce\` opens the release ticket and emits the announcement copy; \`ship\` hands off to git-ops + deploy-ops with the audit gate cached. We dogfooded it on this very release — the \`/demo#release-ops-dogfood\` scenario is the actual transcript.

### 3. Platform menu grew beyond Cloudflare

Django + Postgres + Render, Rails + Postgres + Heroku, Go + Fly.io, and Rust + Axum + Shuttle.rs are first-class in stack-forge's decision tree, app-architect's scaffold recipes, and deploy-ops's provider sections. The \`django-render-shipped\` demo scenario walks the full path for a solo founder building a B2B invoicing tool — two weeks ideation to first paying customer.

### 4. Build-time PM-MCP validator

\`scripts/validate-pm-mcp.mjs\` runs in \`npm run prebuild\` and CI. Blocks the build if any v1.2-flavored \`mcp\\.<provider>\\.<verb>\` placeholders remain, if any \`SKILL.md\` references an unknown tool name, or if the PM-MCP protocol citation is missing.

## Who's affected

| Segment | Impact | Action |
|---|---|---|
| opchain end users (fresh install) | nothing changes; v1.3 is the default | \`opchain install\` pulls v1.3.0 |
| opchain end users (vendored copy) | back-compat; the validator might complain on first run if your fork still has v1.2 prose | Run \`npm run validate-pm-mcp\` once after pulling v1.3; fix flagged files; re-run |
| Contributors | new skill in the catalog; new reference doc to skim | \`skills/release-ops/SKILL.md\` + the three new reference docs in \`integrations-engineer/references/\` |
| Downstream skill consumers (extensions, integrations) | checkpoint schema added \`pm_deferred_actions[]\` and \`pm_flush_log[]\`; additive, no breaking change | No action required; new fields are optional |

## Migration steps

**None.** v1.3 is back-compatible with v1.2.

**But:** run \`npm run validate-pm-mcp\` once after pulling v1.3 to detect legacy v1.2 prose drift in your fork (if any). Time: < 30s.

## Breaking changes

**None in this release.**

We considered making \`tool_overrides\` mandatory but deferred — making it optional keeps the OSS install path zero-config.

## Kudos / contributors

Solo dev; that's me, founder. The dogfooding milestone (release-ops shipping its own release) is a small ceremonial moment for the project. Future releases will list contributors as we add them.

## Links

- **Full changelog:** https://opchain.dev/changelog#v1.3
- **Runtime PM demo:** https://opchain.dev/demo#runtime-pm-loop
- **Release-ops dogfood demo:** https://opchain.dev/demo#release-ops-dogfood
- **Django + Render demo:** https://opchain.dev/demo#django-render-shipped
- **Install / upgrade:** https://opchain.dev/install
- **PM-MCP protocol reference:** https://opchain.dev/docs/integrations-engineer/references/pm-mcp-protocol.md
- **GitHub release:** https://github.com/asfbay-bit/opchain/releases/tag/v1.3.0

## FAQ

**Q: Do I need to upgrade my MCP servers?**
A: No. v1.3 uses the same MCP servers v1.2 did. The new tool-name registry maps to existing tool names exposed by Anthropic's Linear / Atlassian / GitHub MCPs.

**Q: Does v1.3 require a checkpoint migration?**
A: No. v1.3's checkpoint schema is additive; v1.2 checkpoints continue to validate.

**Q: Will my existing fork keep working?**
A: Yes, with one caveat — \`validate-pm-mcp\` will block your build if your fork still carries v1.2-flavored \`mcp.<provider>.<verb>\` placeholders. Search-replace is fast (~5 min per skill); the protocol reference doc shows the mapping table.

**Q: When's v1.4?**
A: TBD. Probable themes: deeper IDE integrations + multi-language scaffold recipes. No firm timeline.

**Q: Where do I report bugs?**
A: GitHub Issues at https://github.com/asfbay-bit/opchain/issues; tag with \`type:bug\` and the version (\`version:1.3.0\`).

## Comms cadence

- **Now:** this announcement is auto-posted as a comment on ADEV-306 and goes live on opchain.dev/changelog.
- **T+1d:** founder emails the 2 design-partner firms (manual, personalised).
- **T+2-3d:** blog post lives at opchain.dev/blog; LinkedIn + Twitter posts.
- **T+1w:** founder reviews any v1.3 feedback in the issue tracker; updates this announcement with FAQ additions if any pattern emerges.

## Contact

- GitHub: https://github.com/asfbay-bit/opchain
- Email: hi@opchain.dev (read same-day weekdays)

— release-ops (on behalf of opchain)

Checkpoint: \`.checkpoints/release-ops.checkpoint.json\` (Phase 4 — announce).
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

## Post-ship verification (founder hand-run)

\`\`\`
[founder] post-ship sentinel — 6 checks, all manual, all run within 5 min of prod ship

1. /api/health returns the new SHA
   $ curl -fsS https://opchain.dev/api/health | jq -r '.version'
   8f3c7d2                                                          ✓

2. Cloudflare deployments list confirms the latest deployment
   $ npx wrangler deployments list | head -3
   8f3c7d2  2026-05-11 11:31:02Z  opchain-dev (production)          ✓

3. Linear ADEV-306 is in Shipped state
   $ <browser> https://linear.app/asfbay/issue/ADEV-306
   state: Shipped                                                    ✓

4. GitHub Releases shows v1.3.0
   $ <browser> https://github.com/asfbay-bit/opchain/releases/tag/v1.3.0
   tag: v1.3.0 · published: 2026-05-11 · 0 assets                    ✓

5. /changelog page renders v1.3 entry
   $ curl -fsS https://opchain.dev/changelog | grep -c 'v1.3'
   2                                                                 ✓ (rel-tag + h2)

6. /install page reflects the new version
   $ curl -fsS https://opchain.dev/install | grep -c '1.3.0'
   1                                                                 ✓
\`\`\`

All 6 PASS. Post-ship hand-off complete.

## Sentry / monitoring confirmation (first 30 min)

\`\`\`
[monitoring-ops] 30-min post-ship sentinel
  - Cloudflare Workers Analytics: requests ~baseline (12/min)         no anomalies
  - Sentry: 0 new issues tagged version=8f3c7d2                       no anomalies
  - PostHog: pageviews on /demo + /changelog up ~10% (expected announcement bump)
  - GitHub: 1 new star, 0 issues filed                                no anomalies
  → sentinel clean
\`\`\`

## Retry semantics

If \`/release ship\` is re-run by mistake or after partial failure:

- **All Linear writes** match their existing markers → no-op.
- **The release tag** already exists → git push refuses; release-ops surfaces "tag exists; assuming already shipped" and proceeds to post-ship verification only.
- **The deploy** is idempotent at the Cloudflare layer (wrangler deploy of the same SHA is a no-op).
- **Net effect:** re-running \`/release ship\` is safe; nothing duplicates; the worst case is wasted seconds running the post-ship verification a second time.

If a comment-post fails mid-flush (Linear 503), the deferred-action queue catches it; \`/release ship --retry-pm\` flushes once Linear recovers.

Checkpoint: \`.checkpoints/release-ops.checkpoint.json\` (Phase 5 — shipped).
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

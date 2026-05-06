import type { Walkthrough } from "./types";

/**
 * Scenario 9 (v1.2 hero) — "OnRamp", a Series B SaaS, uses Linear as their PM
 * tool. A backend engineer pulls Linear ticket PLAT-4471 and rides the
 * v1.2 PM-MCP pipeline end-to-end: app-architect reads the ticket and
 * drafts the sprint, git-ops opens the PR with the ticket linked,
 * deploy-ops creates a deploy ticket and transitions it through the
 * environments, monitoring-ops opens an incident ticket the next day
 * when an alert fires. Jira + GitHub Issues are called out in the
 * config artifact as drop-in alternatives.
 */
export const pmPipelineLinear: Walkthrough = {
  id: "pm-pipeline-linear",
  title: "Run a Linear ticket end-to-end through the v1.2 pipeline",
  tagline: "PM-aware pipeline, Linear-led",
  summary:
    "v1.2 hero scenario: app-architect reads PLAT-4471 from Linear, drafts a sprint, git-ops links the PR back to the ticket, deploy-ops auto-creates a deploy ticket, monitoring-ops opens an incident ticket the next morning when an alert fires.",
  description:
    "OnRamp is a Series B SaaS startup with ~30 engineers; their PM tool is Linear. A backend engineer named Sam picks up PLAT-4471 (\"Add CSV export to /api/customers\") and rides the v1.2 PM-MCP pipeline from ticket → ship → first incident. The v1.2 release wires the opchain skills into the PM-tool MCPs Anthropic ships with Claude Code: app-architect /discover and /roadmap consume tickets and write sprints back; git-ops shapes branch + commit + PR from the ticket; deploy-ops creates deploy tickets per environment; monitoring-ops opens incident tickets when alerts fire. Linear is the named tool here; the same flow runs against Jira (Atlassian MCP) or GitHub Issues with a one-line config change. The artifact set is a complete Linear timeline that traces a single piece of work from \"someone filed a ticket\" to \"prod is healthy after a tiny incident.\"",
  inputs: [
    "Series B SaaS · ~30 engineers · existing repo · Linear as system-of-record",
    "Linear ticket PLAT-4471 · \"Add CSV export to /api/customers\" · estimate: 2",
    "Standard opchain stack already wired (app-architect, git-ops, code-auditor, deploy-ops, monitoring-ops, all v1.2)",
    "Linear MCP server configured · `.opchain/pm.yaml` present at repo root",
  ],
  outputs: [
    {
      id: "pm-config",
      label: "`.opchain/pm.yaml` for Linear (with Jira / GitHub Issues alts)",
      kind: "config.yaml",
      body:
`# .opchain/pm.yaml — OnRamp's Linear configuration

provider: linear
team_or_project: PLAT
mcp_server: linear        # name of the configured MCP in claude-code's mcp.json

issue_types:
  feature:  Feature
  bug:      Bug
  chore:    Chore
  deploy:   Deploy        # used by deploy-ops
  incident: Incident      # used by monitoring-ops

states:
  in_progress: "In Progress"
  in_review:   "In Review"
  done:        "Done"
  blocked:     "Blocked"
  staging_verified: "Staging verified"
  shipped:     "Shipped"
  rolled_back: "Rolled back"
  resolved_pending_postmortem: "Resolved (PM pending)"

labels_default: [opchain, agent-driven]

remediation_owners:
  backend:  sam
  frontend: priya
  data:     yusuf
  infra:    vee

create_child_tickets: true   # app-architect /roadmap creates one child per sprint

# ──────────────────────────────────────────────────────────
# Drop-in for Jira (Atlassian MCP):
#
#   provider: jira
#   team_or_project: PLAT          # the Jira project key
#   mcp_server: jira-cloud
#   issue_types:
#     feature:  Story
#     bug:      Bug
#     chore:    Task
#     deploy:   Task
#     incident: Incident
#   states:
#     in_progress: "In Progress"
#     in_review:   "In Review"
#     done:        "Done"
#     ...
#
# Drop-in for GitHub Issues:
#
#   provider: github-issues
#   team_or_project: onramp-inc/platform   # owner/repo
#   mcp_server: github
#   issue_types:                  # GH labels for issue-type discrimination
#     feature:  type:feature
#     bug:      type:bug
#     deploy:   type:deploy
#     incident: type:incident
#   states:                       # GH issue state model is binary; states map to labels
#     in_progress: "status:in-progress"
#     in_review:   "status:in-review"
#     done:        closed         # the literal "closed" state, not a label
# ──────────────────────────────────────────────────────────
`,
    },
    {
      id: "ticket-detail",
      label: "PLAT-4471 — the source ticket",
      kind: "linear.md",
      body:
`# PLAT-4471 — Add CSV export to /api/customers

**Project:** Platform · **Type:** Feature · **State:** Todo · **Priority:** Medium · **Estimate:** 2 · **Reporter:** ana@onramp · **Assignee:** sam@onramp

## Description

Customer success has been asking for a "Download as CSV" button on the
customer-list view. Right now they screenshot the table and paste into
Sheets — that doesn't scale past ~50 rows.

We have \`/api/customers\` already (returns JSON, paginated). Add a
matching \`/api/customers.csv\` endpoint that streams the same data as
RFC 4180 CSV, respecting the same query filters.

## Acceptance criteria

- [ ] \`GET /api/customers.csv\` returns \`text/csv; charset=utf-8\`.
- [ ] Same query params as \`/api/customers\` (\`?status=&plan=&q=\`) work.
- [ ] BOM prefix for Excel-on-Windows compatibility (we have one user
      who can't open BOM-less files).
- [ ] Stream response (don't buffer all rows in memory — some accounts
      have ~150k customers).
- [ ] Auth + tenant isolation matches \`/api/customers\` exactly.
- [ ] Filename: \`customers-{tenant-slug}-{yyyy-mm-dd}.csv\`.

## Out of scope

- The "Download" button in the UI — that's PLAT-4472.
- Excel (.xlsx) export — premium-only feature, separate decision.

## Comments

**ana** · 3d ago
> Mostly just a happy-path thing. The hard part is the streaming so we
> don't OOM the worker on the big-tenant accounts.

**sam** · 1d ago
> Picking this up. Will swing through the full opchain pipeline.
`,
    },
    {
      id: "linked-pr",
      label: "PR description — auto-shaped from PLAT-4471",
      kind: "pr.md",
      body:
`# feat(api): add CSV export to /api/customers

> Auto-generated by opchain git-ops v1.2 from Linear ticket
> [PLAT-4471](https://linear.app/onramp/issue/PLAT-4471).

**Linked ticket:** [PLAT-4471 — Add CSV export to /api/customers](https://linear.app/onramp/issue/PLAT-4471)

## What

Adds \`GET /api/customers.csv\` returning RFC 4180 CSV. Streams row-by-row
through the existing tenant-scoped query, respects the same filters
(\`?status=&plan=&q=\`), prefixes a UTF-8 BOM, and downloads as
\`customers-{tenant-slug}-{yyyy-mm-dd}.csv\`.

## Why

Customer success uses the customer list daily and copy-pastes into
Sheets. Past ~50 rows that flow falls apart.

## How

- \`src/api/customers.csv.ts\` — new handler. Reuses
  \`getCustomersForTenant({ filters })\` (same function the JSON endpoint
  uses) but passes a \`stream: true\` option so we don't buffer.
- \`src/lib/csv.ts\` — new file. RFC 4180-compliant escaper +
  \`Response\` wrapping a \`ReadableStream\`. ~80 LOC.
- \`tests/api/customers.csv.spec.ts\` — 6 tests:
  - happy path returns 200 + correct content-type + filename header
  - filters narrow rows
  - BOM prefix present
  - escapes commas, quotes, newlines correctly
  - returns 401 unauthenticated, 403 cross-tenant
  - streams a 100k-row tenant without > 64 MB heap (smoke test)

## Test plan (verified by Evaluator round 1)

- [x] Unit tests pass (7 new, 0 changed, 0 deleted)
- [x] Integration test against the seeded \`big-tenant\` (108k rows) —
      heap stable at 38 MB peak.
- [x] code-auditor pass (Grade A; no findings).
- [x] bug-check pre-commit pass (type / lint / build / dep / secret).
- [x] Manual: \`curl -H "Authorization: ..." 'https://staging.../api/customers.csv?status=active'\`
      returns the expected stream.

## Out of scope (PLAT-4472 owns)

- The "Download as CSV" UI button.

---

🤖 Refs: PLAT-4471 · Sprint plan: Linear PLAT-4471/sprint-1 · Auditor: A · bug-check: PASS
`,
    },
    {
      id: "deploy-ticket",
      label: "PLAT-4485 — auto-created deploy ticket",
      kind: "linear.md",
      body:
`# PLAT-4485 — Deploy: 2026-05-04 · staging → prod (1 ticket)

**Project:** Platform · **Type:** Deploy · **State:** Shipped · **Reporter:** opchain-deploy-ops · **Auto-created**

## Description

Auto-generated by opchain deploy-ops v1.2.

**Range:** \`a8a254c..7ea6bf2\` (2 commits)
**Audit gate:** PASS — code-auditor grade A; security-auditor PASS; bug-check PASS
**Linked tickets (1):**
- [PLAT-4471 — Add CSV export to /api/customers](https://linear.app/onramp/issue/PLAT-4471)

## Timeline

\`\`\`
14:02:11  staging deploy started      → state: in_progress
14:02:48  staging deploy succeeded    (37s)
14:03:02  smoke tests passed           → state: staging_verified
14:09:30  prod deploy approved (sam)
14:09:51  prod deploy started
14:10:33  prod deploy succeeded        (42s)
14:10:51  smoke tests passed
14:11:02  prod live (X-Opchain-Version: 7ea6bf2)  → state: shipped
\`\`\`

## Comments (auto-generated)

**opchain-deploy-ops** · 14:03:02
> Smoke tests passed against staging.opchain.dev. Audit gate clean.
> Awaiting human approval for prod.

**opchain-deploy-ops** · 14:10:51
> Prod deployed: \`7ea6bf2\`. Smoke tests pass. Linked tickets transitioned
> to "Shipped" with the prod URL.

**sam** · 14:11:14
> Looks clean. Watching dashboards for the next 30 min.
`,
    },
    {
      id: "incident-ticket",
      label: "PLAT-4503 — auto-opened incident ticket (next morning)",
      kind: "linear.md",
      body:
`# PLAT-4503 — Incident: customers.csv p95 latency · 2026-05-05 09:14 UTC

**Project:** Platform · **Type:** Incident · **Severity:** SEV-3 · **State:** Resolved (PM pending) · **Reporter:** opchain-monitoring-ops · **Auto-created**

## Description

Auto-generated by opchain monitoring-ops v1.2.

**Alert:** \`customers_csv_p95_latency_high\`
**Fired at:** 2026-05-05T09:14:33Z
**Service:** \`api/customers.csv\` (new endpoint, shipped 18h ago)
**Symptoms (top 3 from alert payload):**
- p95 latency: 4.2s (threshold: 1.5s)
- p99 latency: 11.8s (threshold: 5.0s)
- error rate: 0.0% (no errors, just slow)

**Runbook:** [api-latency-investigation](https://docs.onramp/runbooks/api-latency-investigation)
**On-call:** sam@onramp (PagerDuty: ack at 09:15:11)
**Recent deploys (last 24h):**
- [PLAT-4485 — Deploy 2026-05-04 14:10:51Z](https://linear.app/onramp/issue/PLAT-4485) — included PLAT-4471 (\`/api/customers.csv\`)

**Likely culprit:** the deploy 18h ago is the most recent change touching this surface.

## Comments (auto-generated)

**opchain-monitoring-ops** · 09:14:33
> Alert \`customers_csv_p95_latency_high\` fired. Linked likely-culprit
> deploy: PLAT-4485 (introduced \`/api/customers.csv\`). On-call: sam.

**sam (via PagerDuty)** · 09:15:11
> Acknowledged. Looking now.

**sam** · 09:24:08
> Found it. Big-tenant \`acme\` has 142k customers; the streaming is
> doing a per-row Postgres roundtrip because the cursor isn't using the
> proper \`STREAM\` option. Fix is one config flag on the cursor.

**opchain-monitoring-ops** · 09:31:50
> Alert auto-resolved at 09:30:14 (back to baseline). Total impact: 16 min.
> Transitioning to \`Resolved (PM pending)\`. Awaiting postmortem.

**sam** · 11:48:00
> Postmortem published: docs/postmortems/2026-05-05-customers-csv-latency.md.
> Action items filed as sub-tickets.

## Sub-tickets (auto-created remediation)

- PLAT-4504 — Fix Postgres cursor to use STREAM option (assignee: sam)
- PLAT-4505 — Add latency budget alert at 800ms warning threshold (assignee: vee)
- PLAT-4506 — Add big-tenant load-test fixture to CI (assignee: yusuf)

## Linked

- caused-by: [PLAT-4471 — Add CSV export to /api/customers](https://linear.app/onramp/issue/PLAT-4471)
- triggered-from: [PLAT-4485 — Deploy 2026-05-04](https://linear.app/onramp/issue/PLAT-4485)
`,
    },
    {
      id: "end-to-end-trace",
      label: "Linear timeline — the full thread",
      kind: "trace.md",
      body:
`# PLAT-4471 — Linear timeline (across the v1.2 pipeline)

A single human-readable view of every state change, comment, and
linked-ticket creation between Linear and the opchain skills, top to
bottom. This is what the audit log looks like to a curious team member
two weeks later.

\`\`\`
day -1
  ana          PLAT-4471 created (Todo, Medium, est 2)
  ana          PLAT-4471 #comment "Mostly just a happy-path thing..."

day 0
  sam          PLAT-4471 self-assigned
  sam          PLAT-4471 #comment "Picking this up. Will swing through the full opchain pipeline."

  -- engineer prompt: "/discover --ticket PLAT-4471"
  app-architect MCP linear.get_issue("PLAT-4471")
  app-architect /discover ran (8 questions, 5 pre-filled from ticket body)
  app-architect /spec produced (1 file: this is an existing project; only the new endpoint)
  app-architect /roadmap produced sprint plan (1 sprint, 1 deliverable)
  app-architect MCP linear.add_comment("PLAT-4471", "Sprint 1: ...")
  app-architect MCP linear.create_issue (sub-issue PLAT-4471/sprint-1, parent=PLAT-4471)
  app-architect /build started
  app-architect Generator wrote handler + helper + tests
  app-architect Evaluator round 1: PASS (Functionality 9, Completeness 9, Code 8, UX n/a)

  -- engineer prompt: "/git-sync"
  git-ops      MCP linear.get_issue("PLAT-4471")  (refresh: state was "Todo", now "In Progress")
  git-ops      branch: feat/PLAT-4471-add-csv-export-customers
  git-ops      commit: feat(api): add CSV export to /api/customers
                       Refs: PLAT-4471
  git-ops      PR opened (gh): #2208
  git-ops      MCP linear.add_comment("PLAT-4471", "PR opened: github.com/onramp-inc/platform/pull/2208")
  git-ops      MCP linear.save_issue("PLAT-4471", state="In Review")

  bug-check    PASS (1.4s)
  code-auditor /audit pre-deploy
  code-auditor MCP linear.add_comment("PLAT-4471", "Auditor: Grade A; no findings.")

  -- 14:02:11
  deploy-ops   /deploy staging
  deploy-ops   MCP linear.create_issue ("Deploy 2026-05-04 staging", parent=PLAT-4471) → PLAT-4485
  deploy-ops   staging deploy started
  deploy-ops   staging deploy succeeded (37s)
  deploy-ops   smoke tests passed
  deploy-ops   MCP linear.add_comment("PLAT-4485", "Smoke tests passed against staging.")
  deploy-ops   MCP linear.save_issue("PLAT-4485", state="Staging verified")

  -- 14:09:30
  sam          /deploy prod (approved)
  deploy-ops   prod deploy started → succeeded (42s)
  deploy-ops   smoke tests passed
  deploy-ops   MCP linear.add_comment("PLAT-4485", "Prod deployed: 7ea6bf2.")
  deploy-ops   MCP linear.save_issue("PLAT-4485", state="Shipped")
  deploy-ops   MCP linear.add_comment("PLAT-4471", "Shipped to prod via deploy PLAT-4485.")
  deploy-ops   MCP linear.save_issue("PLAT-4471", state="Done")

day +1 (next morning)
  -- 09:14:33 alert fires
  monitoring-ops alert "customers_csv_p95_latency_high" SEV-3
  monitoring-ops MCP linear.create_issue (Incident, parent-relation=PLAT-4485) → PLAT-4503
  monitoring-ops PagerDuty page → sam
  -- 09:15:11
  sam            ack via PagerDuty (auto-mirrored to PLAT-4503)
  -- 09:30:14 alert auto-resolves
  monitoring-ops MCP linear.add_comment("PLAT-4503", "Alert auto-resolved (16 min).")
  monitoring-ops MCP linear.save_issue("PLAT-4503", state="Resolved (PM pending)")
  -- 11:48:00
  sam            postmortem published
  monitoring-ops MCP linear.create_issue x3 (sub-tickets PLAT-4504/4505/4506)
  monitoring-ops MCP linear.add_comment("PLAT-4503", "Postmortem published; 3 sub-tickets filed.")
  monitoring-ops MCP linear.save_issue("PLAT-4503", state="Done")
\`\`\`

## What just happened

One ticket, one engineer, one calendar day from "I'll pick this up"
to "shipped, incident handled, action items filed." The PM tool is
the thread: every artifact, every state change, every alert is on
the same Linear surface, browseable by anyone who searches for
PLAT-4471.

If OnRamp ran on Jira instead, the same flow runs against the
Atlassian MCP with the config drop-in shown in the \`pm-config\`
artifact. If OnRamp used GitHub Issues, the same flow runs against
the GitHub MCP with the issue-type-as-label mapping. v1.2's job is
to make the PM tool the single thread of execution, not to lock
anyone into a specific vendor.

## What changed in v1.2

| Skill | v1.1 behaviour | v1.2 behaviour |
|---|---|---|
| app-architect | /discover asked everything from scratch | /discover --ticket pre-fills from PM context; /roadmap creates child tickets per sprint |
| git-ops | branch + commit + PR from prompt only | shaped from the linked ticket; transitions ticket on PR open / merge |
| code-auditor | findings recorded in checkpoint | also commented on the linked PM ticket |
| deploy-ops | per-environment deploy | also creates a deploy ticket linked to every commit's tickets; transitions per env |
| monitoring-ops | alert → PagerDuty | also opens an incident ticket linked to the most recent deploy ticket |

The skill prose for each (in \`skills/<name>/SKILL.md\`) covers the
detection patterns, the failure modes, and the audit-pipeline
expectations for regulated environments.
`,
    },
  ],
  skills: ["app-architect", "git-ops", "deploy-ops", "monitoring-ops", "code-auditor", "integrations-engineer"],
  runtime: "≈ 9 exchanges",
  steps: [
    { type: "beat", label: "01 · Read the ticket", caption: "app-architect /discover pre-fills from Linear", skills: ["app-architect"] },

    {
      type: "exchange", role: "user",
      content: `/discover --ticket PLAT-4471`
    },
    {
      type: "exchange", role: "claude", skill: "app-architect",
      content:
`v1.2 PM-aware mode active. Reading the ticket through the configured Linear MCP.

\`\`\`
mcp.linear.get_issue("PLAT-4471") → 200 (1.1KB)
  title:       Add CSV export to /api/customers
  state:       Todo
  priority:    Medium
  assignee:    sam@onramp
  labels:      []
  description: 412 chars
  comments:    2 (ana, sam)
\`\`\`

Discovery shape — 8 standard questions; 5 pre-filled from the ticket:

- ✅ **Problem:** customer success copy-pastes the customer list into Sheets; that flow falls apart past ~50 rows. *(from ticket body)*
- ✅ **Users:** customer success ICs. *(from ticket body)*
- ✅ **Surface:** new endpoint \`GET /api/customers.csv\` matching the existing JSON endpoint. *(from ticket body)*
- ✅ **Acceptance criteria:** RFC 4180, BOM, streaming, auth + tenant match, specific filename. *(from ticket AC checklist)*
- ✅ **Out of scope:** the UI button (PLAT-4472), Excel export. *(from ticket body)*

Three questions remaining for you:

1. The ticket says "stream so we don't OOM the worker." Acceptable to use the same \`getCustomersForTenant({ stream: true })\` pattern we used for the audit-log export six months ago, or do you want a fresh approach?
2. CSV escaping — RFC 4180 strictly, or do we need to handle Excel quirks beyond the BOM (e.g. Excel's stub UTF-16 detection)?
3. Filename: any time-zone preference for the date, or stick with UTC?`,
      artifacts: ["pm-config", "ticket-detail"],
    },
    {
      type: "exchange", role: "user",
      content: `1. Yes, reuse the audit-log streaming pattern. 2. RFC 4180 only; the one Excel user just needs the BOM. 3. UTC is fine.`
    },
    {
      type: "exchange", role: "claude", skill: "app-architect",
      content:
`Spec produced (1 file: \`spec/plat-4471/00-overview.md\` — existing project; only the new endpoint). Sprint plan: 1 sprint, 1 deliverable, ~3 hours of build time.

Writing back to Linear:

\`\`\`
mcp.linear.add_comment("PLAT-4471",
  body="Sprint 1 — Add CSV export to /api/customers
        Deliverables:
          - GET /api/customers.csv handler (streaming)
          - csv RFC-4180 helper
          - 6 tests covering happy + error paths
        Definition of done:
          - acceptance criteria all checked
          - code-auditor Grade A or better
          - bug-check PASS
        Estimated effort: 3h
        Generated by app-architect /roadmap.")

mcp.linear.create_issue(
  parent="PLAT-4471",
  title="Sprint 1: CSV export endpoint",
  type="Chore",
  labels=["opchain", "agent-driven", "sprint"]
) → PLAT-4471/sprint-1
\`\`\`

Sprint plan approved? \`/build\` will start the Generator → Evaluator loop. Or \`/contract\` to negotiate the sprint-1 contract first.`,
    },

    { type: "beat", label: "02 · Build → audit → PR", caption: "build loop + git-ops shapes the PR from the ticket", skills: ["app-architect", "code-auditor", "git-ops"] },

    {
      type: "exchange", role: "user",
      content: `/build, then /git-sync when it passes.`
    },
    {
      type: "exchange", role: "claude", skill: "app-architect",
      content:
`\`/build\` — Generator → Evaluator loop:

\`\`\`
Generator (round 1)
  files written:
    src/api/customers.csv.ts            (handler, 64 LOC)
    src/lib/csv.ts                      (helper, 78 LOC)
    tests/api/customers.csv.spec.ts     (6 tests)
  build:                                 PASS
  unit tests:                            7 passed (1 pre-existing + 6 new)

Evaluator round 1
  Functionality:        9/10  — endpoint streams; BOM correct; filters work
  Feature Completeness: 9/10  — every AC checked
  Code Quality:         8/10  — solid; minor: csv.ts could be 30 LOC shorter
  Visual/UX:            n/a   — not a UI sprint
  → PASS
\`\`\`

Sprint passed in one round. Handing off to git-ops.`,
    },
    {
      type: "exchange", role: "claude", skill: "git-ops",
      content:
`v1.2 PM-aware: the prompt's \`/git-sync\` follows a recently-touched ticket, so I'll re-read it.

\`\`\`
mcp.linear.get_issue("PLAT-4471") → 200
  state:    Todo  → about to transition
\`\`\`

Branch + commit + PR shaped from the ticket:

\`\`\`
branch:  feat/PLAT-4471-add-csv-export-customers
commit:  feat(api): add CSV export to /api/customers

         Adds GET /api/customers.csv returning RFC 4180 CSV...
         Refs: PLAT-4471

PR #2208 opened on github.com/onramp-inc/platform.
\`\`\`

Writing back to Linear:

\`\`\`
mcp.linear.add_comment("PLAT-4471",
  body="PR opened: github.com/onramp-inc/platform/pull/2208")
mcp.linear.save_issue("PLAT-4471", state="In Review")
\`\`\`

Auto-invoking **bug-check** before any merge action; running **code-auditor /audit pre-deploy** in parallel since the deploy gate will demand it.`,
      artifacts: ["linked-pr"],
    },
    {
      type: "exchange", role: "claude", skill: "code-auditor",
      content:
`code-auditor /audit pre-deploy on PR #2208.

\`\`\`
Files reviewed: 3
Findings:       0 blocking, 1 advisory ("csv.ts could be ~30 LOC shorter using a generator")
Tests:          7 passed
Coverage:       full on new code
Grade:          A
\`\`\`

v1.2: posting back to Linear.

\`\`\`
mcp.linear.add_comment("PLAT-4471",
  body="Auditor: Grade A. 0 blocking, 1 advisory.
        Advisory: csv.ts is functional but could be ~30 LOC shorter via a generator.
        Not a blocker; left for a future cleanup pass.")
\`\`\`

Bug-check returned PASS (1.4s). The PR is mergeable; deploy-ops can take over.`
    },

    { type: "beat", label: "03 · Deploy", caption: "deploy-ops creates the deploy ticket and threads through environments", skills: ["deploy-ops"] },

    {
      type: "exchange", role: "claude", skill: "deploy-ops",
      content:
`v1.2: \`/deploy staging\` walks the commit range, collects ticket refs, and creates the deploy ticket before doing anything else.

\`\`\`
range:           a8a254c..7ea6bf2  (2 commits)
linked tickets:  PLAT-4471
audit gate:      PASS
bug-check:       PASS

mcp.linear.create_issue(
  type="Deploy",
  title="Deploy 2026-05-04 14:02 — staging → prod (1 ticket)",
  parent_relations=["PLAT-4471"],
  labels=["opchain", "agent-driven", "deploy"]
) → PLAT-4485

→ wrangler deploy --env staging
✓ deployed in 37s
✓ smoke tests passed

mcp.linear.add_comment("PLAT-4485",
  body="Smoke tests passed against staging.opchain.dev. Audit gate clean. Awaiting human approval for prod.")
mcp.linear.save_issue("PLAT-4485", state="Staging verified")
\`\`\`

Prod gate is open when you're ready.`,
    },
    {
      type: "exchange", role: "user",
      content: `Approve. /deploy prod`
    },
    {
      type: "exchange", role: "claude", skill: "deploy-ops",
      content:
`\`\`\`
→ wrangler deploy
✓ deployed in 42s
✓ smoke tests passed
✓ prod headers: X-Opchain-Version: 7ea6bf2

mcp.linear.add_comment("PLAT-4485",
  body="Prod deployed: 7ea6bf2. Smoke tests pass.")
mcp.linear.save_issue("PLAT-4485", state="Shipped")

mcp.linear.add_comment("PLAT-4471",
  body="Shipped to prod via deploy PLAT-4485.")
mcp.linear.save_issue("PLAT-4471", state="Done")
\`\`\`

\`PLAT-4471\` is closed; \`PLAT-4485\` is the deploy record. Deploy time start-to-prod was 8 min, including the human approval pause. monitoring-ops is watching the relevant SLO dashboards.`,
      artifacts: ["deploy-ticket"],
    },

    { type: "beat", label: "04 · Incident the next morning", caption: "monitoring-ops opens an incident ticket linked to the deploy", skills: ["monitoring-ops"] },

    {
      type: "exchange", role: "claude", skill: "monitoring-ops",
      content:
`v1.2: alert \`customers_csv_p95_latency_high\` (SEV-3) fired at 09:14:33 UTC. Looking up the runbook + most recent deploy.

\`\`\`
recent deploys (last 24h): PLAT-4485 (introduced /api/customers.csv, 18h ago) ← likely culprit
on-call: sam@onramp
runbook: docs/runbooks/api-latency-investigation

mcp.linear.create_issue(
  type="Incident",
  title="Incident: customers.csv p95 latency · 2026-05-05 09:14 UTC",
  body=<<the runbook + symptoms + likely-culprit body>>,
  parent_relations=["PLAT-4485"],
  labels=["opchain", "agent-driven", "incident", "service:api/customers.csv", "severity:SEV-3"]
) → PLAT-4503

→ pagerduty page sam
\`\`\`

The on-call and the relevant deploy are both linked. Paging sam now.`,
    },
    {
      type: "exchange", role: "claude", skill: "monitoring-ops",
      content:
`Alert auto-resolved at 09:30:14 (16 min impact). sam published the postmortem at 11:48; three remediation sub-tickets auto-filed.

\`\`\`
mcp.linear.add_comment("PLAT-4503",
  body="Alert auto-resolved (16 min). Transitioning to Resolved (PM pending).")
mcp.linear.save_issue("PLAT-4503", state="Resolved (PM pending)")

mcp.linear.create_issue x3 (sub-tickets, parent=PLAT-4503):
  PLAT-4504  Fix Postgres cursor STREAM option       (assignee: sam)
  PLAT-4505  Add latency budget alert at 800ms warn  (assignee: vee)
  PLAT-4506  Add big-tenant load-test fixture        (assignee: yusuf)

mcp.linear.add_comment("PLAT-4503",
  body="Postmortem published; 3 sub-tickets filed.")
mcp.linear.save_issue("PLAT-4503", state="Done")
\`\`\`

The whole thread — feature ticket, sprint child, PR, deploy ticket, incident ticket, three remediation sub-tickets — lives in Linear under \`PLAT-4471\`. Anyone searching for it two weeks later sees the full audit trail without leaving the PM tool.`,
      artifacts: ["incident-ticket", "end-to-end-trace"],
    },
  ],
};

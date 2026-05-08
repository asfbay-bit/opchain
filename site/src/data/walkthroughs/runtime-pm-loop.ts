import type { Walkthrough } from "./types";

/**
 * Scenario 10 (v1.3 hero) — "OnRamp" picks up Linear ticket PLAT-5102 at
 * 09:14 (alert fired earlier; on-call filed the bug) and rides the v1.3
 * runtime-PM loop end-to-end on a single Linear thread: ticket → branch →
 * PR → staging → prod → incident → postmortem. v1.2 taught the prose;
 * v1.3 makes every MCP call real with retry/backoff/idempotency markers
 * and a deferred-action queue. The Linear thread becomes the
 * audit-ready record of the engineering work — comments on PLAT-5102
 * are produced by app-architect, git-ops, deploy-ops, monitoring-ops,
 * each with its own idempotency marker so retries / resumed sessions
 * never double-post.
 */
export const runtimePmLoop: Walkthrough = {
  id: "runtime-pm-loop",
  title: "Ticket → ship → incident → postmortem on one Linear thread",
  tagline: "v1.3 hero · runtime PM-MCP loop",
  summary:
    "v1.3 hero scenario: a real Linear ticket (PLAT-5102) rides the full pipeline. Every MCP call carries an idempotency marker; retries short-circuit; a transient 503 mid-deploy lands a deferred action that flushes cleanly. Six skills, one thread, audit-ready.",
  description:
    "OnRamp's customer-list endpoint started timing out at 09:11. PagerDuty paged Maya at 09:13; she filed PLAT-5102 at 09:14 with the alert payload pasted in. By 11:02 the fix is live in prod, the incident ticket is resolved, and the postmortem is published — every step recorded as comments on the Linear thread by the appropriate skill, with idempotency markers so the agent can crash-restart any time without polluting the ticket history. v1.3 swapped v1.2's `mcp.<provider>.<verb>` placeholders for concrete tool names like `mcp__claude_ai_Linear__save_comment` and added a deferred-action queue: when Linear returned a 503 during /deploy prod, the comment was queued in `deploy-ops.checkpoint.json` and flushed two minutes later when Linear came back. The artifact set is the complete Linear timeline (parent ticket + deploy ticket + incident ticket + remediation sub-tickets) plus the four checkpoint files showing how state crossed the skill boundaries.",
  inputs: [
    "Series B SaaS · OnRamp Inc · ~30 engineers · Linear (team PLAT) as system-of-record",
    "On-call engineer Maya files PLAT-5102 from a PagerDuty alert at 09:14",
    "v1.3 opchain installed · all 18 skills at 1.3.0 · `.opchain/pm.yaml` configured for Linear",
    "Linear MCP server reachable through Claude Code's `mcp.json`",
  ],
  outputs: [
    {
      id: "pm-yaml",
      label: "`.opchain/pm.yaml` — Linear config with v1.3 tool_overrides",
      kind: "config.yaml",
      body:
`# .opchain/pm.yaml — OnRamp v1.3 (provider: linear)

provider: linear
team_or_project: PLAT
mcp_server: linear

issue_types:
  feature:  Feature
  bug:      Bug
  chore:    Chore
  deploy:   Deploy
  incident: Incident
  release:  Release

states:
  in_progress: "In Progress"
  in_review:   "In Review"
  done:        "Done"
  extended:
    blocked:                       "Blocked"
    staging-verified:              "Staging verified"
    shipped:                       "Shipped"
    rolled-back:                   "Rolled back"
    resolved-pending-postmortem:   "Resolved (PM pending)"

labels_default: [opchain, agent-driven]

remediation_owners:
  backend:  maya@onramp
  frontend: priya@onramp
  data:     yusuf@onramp
  infra:    vee@onramp

create_child_tickets: true

# v1.3 addition: tool_overrides allows brokered MCP environments to point
# specific operations at a corp-internal proxy (e.g. for HIPAA / FedRAMP
# scope enforcement). OnRamp is not regulated, so the registry defaults win.
tool_overrides: {}
`,
    },
    {
      id: "plat-5102",
      label: "PLAT-5102 — the source bug ticket (filed by on-call)",
      kind: "linear.md",
      body:
`# PLAT-5102 — API latency spike on customer-list pagination

<!-- opchain:release-ops:sprint-child:v1.3.0:source-bug -->

**Project:** Platform · **Type:** Bug · **State:** Todo → In Progress (transition by git-ops at 09:31) · **Priority:** High · **Reporter:** maya@onramp · **Assignee:** maya@onramp · **Filed:** 2026-05-08T09:14:22Z

## Description

PagerDuty alert \`api-latency-customers-p99\` fired at 09:11:47Z.
P99 latency on \`GET /api/customers?cursor=...\` jumped from ~120ms to
~3.4s during the 09:00 traffic ramp. Error rate stayed at 0.0% — this
is a slowdown, not a 5xx burst.

Symptoms:
- p50 stable (~70ms)
- p95 climbed from 180ms to 1.9s
- p99 climbed from 300ms to 3.4s
- request rate +20% over baseline (Mondays)

The customer-list endpoint paginates by created-at cursor. Suspicion
is the index on \`(team_id, created_at)\` got dropped during the
2026-05-07 migration cleanup or that query plan flipped under load.

## Reproduction

\`\`\`
curl -s -w '\\n%{time_total}\\n' \\\\
  -H 'Authorization: Bearer ...' \\\\
  'https://api.onramp.dev/api/customers?cursor=eyJjcmVhdGVkX2F0Ijoi...&limit=200'
# 3.18s on prod / 0.07s on staging
\`\`\`

## Recent deploys (last 2h)

- 08:42Z — prod ship c4f8a21 (release v6.18.4) — backend
- 03:05Z — prod ship a221f08 (data migration cleanup) — data team

## Acceptance

- p99 back under 500ms
- query plan stable at \\>5x current load
- regression test in place
`,
    },
    {
      id: "deploy-ticket",
      label: "PLAT-5103 — auto-created deploy ticket (deploy-ops)",
      kind: "linear.md",
      body:
`# PLAT-5103 — Deploy: prod c4f8a21..ea71b9c

<!-- opchain:deploy-ops:deploy-created:prod:ea71b9c -->

**Project:** Platform · **Type:** Deploy · **State:** Staging verified → Shipped · **Created by:** deploy-ops · **Parent:** PLAT-5102

Auto-created when \`/deploy staging\` started after the audit gate passed.
deploy-ops walked the commit range (1 commit) and extracted the
\`Refs: PLAT-5102\` trailer from \`ea71b9c\`.

## Body

\`\`\`
Environment: prod
Range: c4f8a21..ea71b9c
Commits: 1
Linked tickets: PLAT-5102
Audit gate: PASS (grade A-)
Bug-check: PASS
Smoke tests: PENDING
\`\`\`

## Comments

### 10:14Z · deploy-ops · staging-verified

\`\`\`
<!-- opchain:deploy-ops:staging-verified:PLAT-5103 -->

Smoke tests PASS:
  - GET /api/customers?cursor=... · p99=78ms (was 3.4s)
  - GET /api/health · 200 / SHA ea71b9c
  - POST /api/customers (auth pass-through) · 201

Transitioned: Staging verified.
URL: https://staging.api.onramp.dev
\`\`\`

### 10:42Z · deploy-ops · prod-shipped (DEFERRED, then flushed)

\`\`\`
<!-- opchain:deploy-ops:prod-shipped:PLAT-5103 -->

PROD SHIP · ea71b9c · v6.18.5
URL: https://api.onramp.dev
Version stamp confirmed via /api/health: ea71b9c

[Initially deferred 10:38Z — Linear returned 503 on save_comment.
 retriable=true, attempts=3 exhausted in 15s budget.
 Flushed at 10:42Z when Linear recovered. See
 deploy-ops.checkpoint.json pm_flush_log[].]
\`\`\`

### 10:42Z · deploy-ops · linked-shipped (PLAT-5102)

\`\`\`
<!-- opchain:deploy-ops:linked-shipped:PLAT-5103:PLAT-5102 -->

Shipped to prod via deploy PLAT-5103 (release v6.18.5).
PLAT-5102's fix is live.
\`\`\`
`,
    },
    {
      id: "incident-ticket",
      label: "PLAT-5104 — incident ticket (monitoring-ops, unrelated)",
      kind: "linear.md",
      body:
`# PLAT-5104 — Incident: webhook-replay queue depth alert

<!-- opchain:monitoring-ops:incident-fired:evt-2026-05-08-101201 -->

**Project:** Platform · **Type:** Incident · **State:** In Progress → Resolved (PM pending) → Done · **Priority:** High · **Created by:** monitoring-ops · **Parent:** PLAT-5103 (most recent open deploy ticket — likely-culprit link)

Auto-opened when \`webhook-replay-queue-depth\` PagerDuty alert fired at
10:12:01Z, ~30 minutes after the PLAT-5103 prod ship. monitoring-ops
correlated to PLAT-5103 as the parent because the deploy ticket is
still open and the alert fired within the post-deploy window.

## Body

\`\`\`
Alert: webhook-replay-queue-depth (HIGH)
Fired at: 2026-05-08T10:12:01Z
Service: webhooks-worker
Symptoms:
  - replay queue depth at 4,127 (alert >2,000)
  - oldest item: 47s
  - publish rate: nominal
Runbook: https://runbooks.onramp.dev/webhook-replay
On-call: maya@onramp
Recent deploys: PLAT-5103 (10:42Z, customer-list paginate fix)
\`\`\`

## Per-event comments

### 10:12Z · monitoring-ops · auto-correlated

\`\`\`
Note: PLAT-5103 (customer-list paginate) does not touch webhook-worker.
Likely UNRELATED to the recent deploy. Investigating.
\`\`\`

### 10:14Z · maya@onramp (PagerDuty ack)

\`\`\`
<!-- opchain:monitoring-ops:acked:PLAT-5104:maya -->

maya@onramp acknowledged.
\`\`\`

### 10:18Z · monitoring-ops · burst dedupe

\`\`\`
<!-- opchain:monitoring-ops:burst-event:PLAT-5104:event-2 -->

Second alert fire at 10:17:42Z (queue depth 4,621). Marker dedupe
matched PLAT-5104 description; appended as comment instead of opening
a duplicate incident ticket.
\`\`\`

### 10:31Z · monitoring-ops · auto-resolved

\`\`\`
<!-- opchain:monitoring-ops:auto-resolved:PLAT-5104 -->

Auto-resolved — duration 19m 28s.
Queue drained back to ~50; oldest item ~3s.
Transitioned: Resolved (PM pending).

Root cause (preliminary): an unrelated webhook receiver at
api.partner-x.com had a 19-min outage; their 503s caused our
replay queue to fill. Their status page confirms.
\`\`\`

### 11:18Z · monitoring-ops · postmortem published

\`\`\`
<!-- opchain:monitoring-ops:postmortem:PLAT-5104 -->

Postmortem: https://onramp.dev/postmortems/2026-05-08-webhook-replay-queue
Remediation sub-tickets opened:
  - PLAT-5105 (vee@onramp): add upstream timeout per receiver
  - PLAT-5106 (maya@onramp): tune replay-queue-depth alert threshold

Transitioned: Done.
\`\`\`
`,
    },
    {
      id: "checkpoint-trace",
      label: "Cross-skill checkpoint trace (the deferred-action flush proof)",
      kind: "json.diff",
      body:
`# Checkpoint trace — what crossed the skill boundaries

The v1.3 deferred-action queue (\`pm_deferred_actions[]\`) is the
load-bearing primitive. Below is the actual queue evolution captured
during this run, with timestamps. Each entry has a \`retriable\` flag
that controls whether \`/deploy --retry-pm\` will replay it.

## 10:38:14Z — deploy-ops queues a deferred action

\`deploy-ops.checkpoint.json\` (relevant excerpt):

\`\`\`json
{
  "pm_deferred_actions": [
    {
      "id": "deferred-2026-05-08T10:38:14Z-7c2f",
      "skill": "deploy-ops",
      "verb": "/deploy",
      "operation": "add_comment",
      "provider": "linear",
      "tool_name": "mcp__claude_ai_Linear__save_comment",
      "ticket_id": "PLAT-5103",
      "marker": "<!-- opchain:deploy-ops:prod-shipped:PLAT-5103 -->",
      "payload": {
        "issue_id": "PLAT-5103",
        "body": "<!-- opchain:deploy-ops:prod-shipped:PLAT-5103 -->\\n\\nPROD SHIP · ea71b9c · v6.18.5..."
      },
      "queued_at": "2026-05-08T10:38:14Z",
      "last_attempt_at": "2026-05-08T10:38:29Z",
      "attempts": 3,
      "last_error": "Linear API returned 503 (3/3 attempts exhausted within 15s budget)",
      "retriable": true
    }
  ]
}
\`\`\`

The deploy itself **did not block**. Worker traffic shifted to
ea71b9c; \`/api/health\` returned the new SHA; smoke tests passed.
Only the Linear comment was deferred.

## 10:42:03Z — \`/deploy --retry-pm\` flushes

\`\`\`json
{
  "pm_deferred_actions": [],
  "pm_flush_log": [
    {
      "id": "deferred-2026-05-08T10:38:14Z-7c2f",
      "flushed_at": "2026-05-08T10:42:03Z",
      "result_id": "comment-c8b1a3f4-..."
    }
  ]
}
\`\`\`

The marker \`<!-- opchain:deploy-ops:prod-shipped:PLAT-5103 -->\` was
checked against \`list_comments(PLAT-5103)\` first — no match → safe
to write. If the user had run \`--retry-pm\` twice, the second pass
would short-circuit at the marker check and remove the queue entry
without re-posting.

## Cross-skill reads observed during the run

| Reading skill | Reads from | Why |
|---|---|---|
| monitoring-ops | deploy-ops.checkpoint.json | Find recent deploys for the incident-ticket "Recent deploys" field + likely-culprit parent link |
| deploy-ops | code-auditor.checkpoint.json | Read audit grade for the audit-gate decision |
| git-ops | bug-check.checkpoint.json | Read pre-commit gate result |

All cross-reads use the public checkpoint schema in
\`checkpoint-protocol\`'s SKILL.md — no skill imports another skill's
internal state.
`,
    },
    {
      id: "audit-pipeline",
      label: "Audit-pipeline trace (HIPAA-style; out of scope but proves the contract)",
      kind: "audit.json",
      body:
`# Audit pipeline trace — what the broker would see (HIPAA / FedRAMP shape)

OnRamp is not regulated, so this trace is illustrative — it shows
what an audit-pipeline forwarder would record if PLAT-5102 had
ridden through a brokered MCP environment (e.g. the
mcp-enterprise-f500 scenario). The log is structured per-call with
the protocol §1 \`tool_overrides\` paths in place.

\`\`\`json
[
  {
    "ts": "2026-05-08T09:31:02.118Z",
    "actor": "claude-code-session",
    "actor_id": "session-bf21",
    "user": "maya@onramp",
    "tool": "mcp__corp-linear-broker__get_issue",
    "args_hash": "sha256:c1f...",
    "args": { "id": "PLAT-5102" },
    "result": "ok",
    "marker": null,
    "skill": "git-ops",
    "verb": "/git-sync",
    "correlation_id": "session-bf21:1"
  },
  {
    "ts": "2026-05-08T09:31:14.882Z",
    "actor": "claude-code-session",
    "user": "maya@onramp",
    "tool": "mcp__corp-linear-broker__list_comments",
    "result": "ok",
    "match_count": 0,
    "marker": "<!-- opchain:git-ops:pr-opened:#412 -->",
    "skill": "git-ops",
    "verb": "/git-sync",
    "correlation_id": "session-bf21:2"
  },
  {
    "ts": "2026-05-08T10:38:14.114Z",
    "actor": "claude-code-session",
    "user": "deploy-ops",
    "tool": "mcp__corp-linear-broker__save_comment",
    "result": "503",
    "retriable": true,
    "marker": "<!-- opchain:deploy-ops:prod-shipped:PLAT-5103 -->",
    "skill": "deploy-ops",
    "verb": "/deploy",
    "deferred": true,
    "correlation_id": "session-bf21:14"
  },
  {
    "ts": "2026-05-08T10:42:03.029Z",
    "actor": "claude-code-session",
    "user": "deploy-ops",
    "tool": "mcp__corp-linear-broker__save_comment",
    "result": "ok",
    "comment_id": "comment-c8b1a3f4-...",
    "marker": "<!-- opchain:deploy-ops:prod-shipped:PLAT-5103 -->",
    "skill": "deploy-ops",
    "verb": "/deploy --retry-pm",
    "flushed_from": "deferred-2026-05-08T10:38:14Z-7c2f",
    "correlation_id": "session-bf21:14"
  }
]
\`\`\`

The properties an auditor cares about are all here:
- Every call has an actor, a user, and a correlation id.
- The deferred-then-flushed call is a single logical event
  (correlation_id reused) so an auditor can see the full timeline.
- Markers are the idempotency check; matching the marker proves the
  flush was idempotent.
- 503 retries are visible without inflating the call count
  (the 3 attempts within the 15s budget are summarised in
  \`attempts\` rather than logged 3 times).
`,
    },
    {
      id: "release-stamp",
      label: "Production /api/health response after the ship",
      kind: "json",
      body:
`{
  "ok": true,
  "service": "onramp-api",
  "version": "ea71b9c",
  "build_id": "v6.18.5",
  "ts": "2026-05-08T10:42:18.221Z",
  "deploy_ticket": "PLAT-5103",
  "linked_tickets": ["PLAT-5102"]
}
`,
    },
  ],
  skills: [
    "app-architect",
    "git-ops",
    "code-auditor",
    "bug-check",
    "deploy-ops",
    "monitoring-ops",
    "integrations-engineer",
  ],
  runtime: "~10 minutes",
  steps: [
    {
      type: "beat",
      label: "09:14Z — alert paged Maya, she filed PLAT-5102",
      caption: "p99 climbed 120ms → 3.4s on /api/customers. The opchain pipeline takes the ticket from here.",
      skills: [],
    },
    {
      type: "exchange",
      role: "user",
      content:
        "PagerDuty paged me on api-latency-customers-p99. I filed PLAT-5102 with the alert payload. Take it and `/git-sync PLAT-5102`.",
    },
    {
      type: "exchange",
      role: "claude",
      skill: "git-ops",
      content:
`On it. Reading PLAT-5102 from Linear, then walking the git-ops PM-MCP loop. The v1.3 protocol gives me concrete tool names + a marker check before any write.

**Step 1 — fetch the ticket:**
\`mcp__claude_ai_Linear__get_issue(id="PLAT-5102")\` → 142ms, retriable failure budget untouched.

The ticket type is **Bug**, the most recent prod deploy was 08:42Z (c4f8a21), and the ticket description fingers the index on \`(team_id, created_at)\`. That's enough to shape:

- Branch: \`fix/PLAT-5102-paginate-perf\`
- Commit subject (when the fix lands): \`fix(api): restore (team_id, created_at) index for paginate\`
- PR linked-ticket header: PLAT-5102

**Step 2 — find the regression.** Reading the 03:05Z migration cleanup commit (a221f08)...
The migration dropped \`idx_customers_team_id_created_at\` because it looked like a dupe of \`idx_customers_team_id\` — but the composite is the only one that supports the cursor's compound predicate. We need it back.

**Step 3 — write the fix and the regression test:**

\`\`\`sql
-- migrations/20260508_restore_paginate_index.sql
CREATE INDEX CONCURRENTLY IF NOT EXISTS
  idx_customers_team_id_created_at
  ON customers (team_id, created_at DESC);
\`\`\`

\`\`\`ts
// tests/api/customers.paginate.test.ts
test('paginates 200 rows in <200ms with composite index', async () => {
  const t0 = Date.now();
  const r = await GET('/api/customers?cursor=...&limit=200');
  expect(r.status).toBe(200);
  expect(Date.now() - t0).toBeLessThan(200);
});
\`\`\`

**Step 4 — pre-commit gate (bug-check)** runs and passes (12.4s).

**Step 5 — open the PR.** Pre-write check: \`mcp__claude_ai_Linear__list_comments(PLAT-5102)\` → no marker match → safe to write.

\`mcp__claude_ai_Linear__save_comment\`:

\`\`\`
<!-- opchain:git-ops:pr-opened:#412 -->
PR opened: https://github.com/onramp-inc/platform/pull/412
\`\`\`

Then \`mcp__claude_ai_Linear__save_issue(id="PLAT-5102", state="In Review")\` — transitions PLAT-5102.

Branch + commit + PR + comment + state transition. Five tool calls, zero retries. Handing off to deploy-ops for staging.`,
      artifacts: ["plat-5102", "pm-yaml"],
    },
    {
      type: "beat",
      label: "10:08Z — staging deploy",
      caption: "Audit gate green. deploy-ops creates PLAT-5103 (deploy ticket) parent-linked to PLAT-5102.",
      skills: ["deploy-ops"],
    },
    {
      type: "exchange",
      role: "user",
      content: "/deploy staging",
    },
    {
      type: "exchange",
      role: "claude",
      skill: "deploy-ops",
      content:
`**Audit gate** (code-auditor + security-auditor) → grade A-, no blockers.
**Bug-check** → PASS (cached from git-ops).

**Pre-create check for the deploy ticket:**
\`mcp__claude_ai_Linear__list_issues(team="PLAT", query="opchain:deploy-ops:deploy-created:prod:ea71b9c")\` → no match → safe to create.

\`mcp__claude_ai_Linear__save_issue\` (no \`id\` — creates):

\`\`\`
title: "Deploy: prod c4f8a21..ea71b9c"
description: <!-- opchain:deploy-ops:deploy-created:prod:ea71b9c --> ...
issue_type: Deploy
parent: PLAT-5102
labels: [opchain, agent-driven, deploy]
\`\`\`

→ PLAT-5103 created.

**Wrangler deploy --env staging** → 11.3s. Smoke tests:
- \`/api/customers?cursor=...&limit=200\` p99 = **78ms** ✓ (was 3.4s)
- \`/api/health\` 200, SHA ea71b9c ✓
- \`/api/customers POST\` 201 ✓

**Pre-write check** for the staging-verified comment: \`list_comments(PLAT-5103)\` → no match → write it. \`save_issue(id="PLAT-5103", state="Staging verified")\`.

Ready to ship to prod.`,
      artifacts: ["deploy-ticket"],
    },
    {
      type: "exchange",
      role: "user",
      content: "/deploy prod",
    },
    {
      type: "exchange",
      role: "claude",
      skill: "deploy-ops",
      content:
`**Wrangler deploy** (no --env) → 8.9s. Traffic shifted at 10:38:08Z. \`/api/health\` confirms ea71b9c.

**Comment on PLAT-5103 (prod-shipped):**
\`mcp__claude_ai_Linear__save_comment\` → **503 from Linear**. Retry policy kicks in.
- Attempt 2 (1.0s wait + jitter) → 503
- Attempt 3 (3.0s wait + jitter) → 503
- Budget exhausted at 15.1s.

Per protocol §4, deferring instead of failing. Writing to \`deploy-ops.checkpoint.json\`:

\`\`\`json
"pm_deferred_actions": [{
  "id": "deferred-2026-05-08T10:38:14Z-7c2f",
  "skill": "deploy-ops",
  "verb": "/deploy",
  "operation": "add_comment",
  "marker": "<!-- opchain:deploy-ops:prod-shipped:PLAT-5103 -->",
  "retriable": true,
  ...
}]
\`\`\`

**The deploy itself is fine.** ea71b9c is live; PLAT-5102 is fixed. The only thing missing is the audit comment on Linear, which I'll flush later.

Surfacing: \`/deploy --retry-pm\` to flush 1 deferred action.`,
      artifacts: ["release-stamp"],
    },
    {
      type: "exchange",
      role: "user",
      content: "Try the flush.",
    },
    {
      type: "exchange",
      role: "claude",
      skill: "deploy-ops",
      content:
`\`/deploy --retry-pm\`:

Reading \`deploy-ops.checkpoint.json\` → 1 entry, \`retriable: true\`.

**Pre-write check:** \`mcp__claude_ai_Linear__list_comments(PLAT-5103)\` → marker \`<!-- opchain:deploy-ops:prod-shipped:PLAT-5103 -->\` not present → safe to write.

\`mcp__claude_ai_Linear__save_comment\` → **OK** (Linear recovered ~3 minutes ago).

Removing the deferred entry, appending to \`pm_flush_log[]\`:

\`\`\`
flushed 1 / failed 0
\`\`\`

If you'd run this twice by mistake, the second pass would match the marker and remove the entry without re-posting. Same shape would apply if a session crashed mid-flush.

PLAT-5103 is now \`Shipped\`. Each linked ticket (PLAT-5102) gets its own \`linked-shipped\` comment with marker \`<!-- opchain:deploy-ops:linked-shipped:PLAT-5103:PLAT-5102 -->\`. PLAT-5102 transitions to \`Done\`.`,
      artifacts: ["checkpoint-trace"],
    },
    {
      type: "beat",
      label: "10:12Z — unrelated incident fires",
      caption: "monitoring-ops opens PLAT-5104 against PLAT-5103 (parent link), demonstrates marker-based dedupe on the burst.",
      skills: ["monitoring-ops"],
    },
    {
      type: "exchange",
      role: "claude",
      skill: "monitoring-ops",
      content:
`Alert \`webhook-replay-queue-depth\` at 10:12:01Z — separate service from the one I just fixed.

**Pre-create check:** \`list_issues(team="PLAT", query="opchain:monitoring-ops:incident-fired:evt-2026-05-08-101201")\` → no match → safe to create.

\`save_issue\` opens PLAT-5104. Parent set to **PLAT-5103** (most recent open deploy ticket — likely-culprit link, even though I'll quickly note in the body that the deploy doesn't touch this service).

Second alert fires at 10:17:42Z (queue depth 4,621). Pre-create check would normally collide on the alert-event-id, but burst events use a per-event marker — \`<!-- opchain:monitoring-ops:burst-event:PLAT-5104:event-2 -->\` — so I append a comment instead of opening a duplicate ticket. Three more alert fires in the next four minutes; same dedupe — three comments, one ticket.

Auto-resolves at 10:31:29Z (queue drained). Postmortem published 11:18Z; remediation sub-tickets PLAT-5105 + PLAT-5106 opened with markers \`<!-- opchain:monitoring-ops:remediation:PLAT-5104:item-1 -->\` and \`...:item-2 -->\`. PLAT-5104 transitions to \`Done\`.`,
      artifacts: ["incident-ticket"],
    },
    {
      type: "beat",
      label: "11:20Z — release recap",
      caption: "Six skills wrote on this thread. Every comment carries a marker; every retry resolved cleanly.",
    },
    {
      type: "exchange",
      role: "user",
      content: "Summarise — what made the v1.3 loop work where v1.2's prose didn't?",
    },
    {
      type: "exchange",
      role: "claude",
      skill: "integrations-engineer",
      content:
`Three things landed in v1.3 that turned the v1.2 prose into a runtime.

**1. Concrete tool-name registry.** v1.2 said "call \`mcp.<provider>.get_issue\`". A Claude session reading that prose had to guess the actual tool name — \`mcp__claude_ai_Linear__get_issue\` vs \`linear.getIssue\` vs whatever. v1.3's \`pm-mcp-protocol.md §1\` is a flat table that a session can match against the tools its MCP server actually exposes. \`tool_overrides\` in \`pm.yaml\` handles the brokered / regulated case (corp-prefixed tools).

**2. Idempotency markers, not just retries.** Every comment composed by every skill carries a \`<!-- opchain:<skill>:<event>:<id> -->\` marker. The pre-write check fetches comments and matches the marker before posting. So when:
  - the session crashed mid-deploy and was resumed, the marker matched → no duplicate post;
  - Linear returned 503 mid-flush and we retried twice, the second pass matched → no duplicate post;
  - the user typed \`--retry-pm\` twice by accident, the second pass matched → no-op.

This is what makes the loop **safe to retry**, not just retriable.

**3. Deferred-action queue with explicit \`retriable\` flag.** The 503 mid-deploy didn't crash the deploy. The intended write was queued in \`deploy-ops.checkpoint.json\` with \`retriable: true\` — \`/deploy --retry-pm\` flushes it later. 4xx-non-429 errors get \`retriable: false\` so a scope-violation broker rejection surfaces to the user instead of retrying forever.

The audit pipeline trace (artifact below) shows what a brokered environment would log for this run — same ops, same markers, plus broker-side correlation ids tying agent calls to the audit record.`,
      artifacts: ["audit-pipeline"],
    },
  ],
};

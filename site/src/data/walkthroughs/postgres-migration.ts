import type { Walkthrough } from "./types";

/**
 * Scenario 5 — migration-ops runs a D1 → Postgres cutover on a live
 * Cloudflare Workers app, with monitoring-ops watching the post-migration
 * error budget. Demonstrates the "change the engine mid-flight" side chain:
 * incremental migration plan with rollback points, deploy-ops executes the
 * cutover, monitoring-ops confirms the new engine is healthy before the
 * old one is retired.
 */
export const postgresMigration: Walkthrough = {
  id: "postgres-migration",
  title: "Swap D1 for Postgres without downtime",
  tagline: "D1 → Postgres without the outage",
  summary:
    "A live Workers app outgrew D1. migration-ops writes the cutover plan, deploy-ops runs it, monitoring-ops watches the error budget.",
  description:
    "A six-month-old task-tracking app on Cloudflare Workers + D1 started hitting D1's row limits on the biggest three tenants. The team picked Supabase Postgres as the destination and needs to cut over without downtime. migration-ops runs its assessment → plan → execute → verify loop, slicing the migration into five rollback-able phases: dual-write, backfill, read-cutover, write-cutover, D1-retire. deploy-ops runs each phase behind a feature flag. monitoring-ops watches p99 latency and error budgets through every phase — if anything drifts, the flag rolls back to the prior phase in under 30 seconds. The whole thing lands in a long Wednesday.",
  inputs: [
    "Live Cloudflare Worker + D1 (≈ 2.1M rows across 14 tables)",
    "Three tenants hit D1's per-database row limit last week",
    "Target: Supabase Postgres in the closest region (us-east)",
    "Must maintain zero-downtime — users don't see read errors, writes don't lose durability",
  ],
  outputs: [
    {
      id: "migration-plan",
      label: "Migration plan (5 phases, 5 rollbacks)",
      kind: "plan.md",
      body:
`# Migration Plan — D1 → Postgres (Supabase)

**Produced by** migration-ops Phase 2 · **Approved by** user · **Target window** Wednesday · **Total wall-clock** 5 h 30 m + 7-day retire window

## 1. Target end state

- All production reads + writes hit \`postgres://…supabase.co:5432/postgres\` (or \`pooler.supabase.co:6543\` for short-lived requests).
- Connection pooling via Supabase PgBouncer (\`pooler.supabase.co:6543\`, **transaction mode**).
- D1 binding removed from \`wrangler.jsonc\`.
- \`DROP DATABASE\` on the D1 side only after **7 days** of clean Postgres operation.
- All 14 tables migrated; row counts and column hashes verified equal pre-cutover.
- Application reads from \`BillingStatus\` (Postgres) and writes are PG-only (no dual-write tail).
- Monitoring alarms armed for the 7-day retire window.

## 2. Invariants (MUST hold through every phase)

1. **Read availability 100%.** No phase may cause read errors visible to end users. Dual-read with fall-through is fine; failure is not.
2. **Write durability 100%.** Every write must reach Postgres before user acknowledgment, from Phase 2 onward.
3. **Rollback ≤ 30 s.** Every phase is gated by a KV flag; flipping it back reverts to the prior phase's behaviour within one Worker cache TTL.
4. **Backfill is transactional per table.** Partial backfill is a FAIL; re-run from snapshot.
5. **Read-your-writes.** Every phase satisfies the contract: a user who just wrote a record sees that record on the next read.
6. **No dropped data.** D1 stays read-only as a rollback snapshot for 7 days post-cutover.

## 3. Pre-flight (Tuesday afternoon)

- [x] Supabase project provisioned in us-east; baseline plan tier validated for write volume.
- [x] D1 schema dump exported; diff-checked against \`drizzle-kit\` migrations.
- [x] Workers binding for Postgres prepared in \`wrangler.jsonc\` (commented out until Phase 1).
- [x] R2 bucket \`taskflow-d1-snapshots\` created with 30-day lifecycle.
- [x] Drift-checker Worker deployed (read-only against both DBs).
- [x] Slack channel \`#migration-pg\` created; PagerDuty escalation tuned.
- [x] All on-call notified.

## 4. Phases

### 4.1 Phase 1 — Schema mirror (read-only; ~15 min)

- Provision Supabase Postgres (already done in pre-flight).
- Apply the schema via \`drizzle-kit migrate\` against the new connection.
- Unit tests run against both D1 (unchanged) and Postgres (new) — adapter abstraction in \`lib/db/\` flips on \`DB_DRIVER\` env.
- \`FLAG_PG_ENABLED=false\` — nothing in prod reads or writes Postgres yet.
- **Verification:** schema diff against D1 dump is empty; \`SELECT 1\` round-trip from Workers in us-east POP < 10 ms.
- **Rollback:** drop Supabase project. Zero prod impact.

### 4.2 Phase 2 — Dual-write (~45 min)

- Every write path writes to both D1 (source of truth) and Postgres (mirror).
- Postgres writes are **best-effort** in this phase — failure logs + alerts, but does not fail the request.
- \`FLAG_PG_DUAL_WRITE=true\`. D1 is still source of truth.
- Drift checker runs every 5 minutes: \`SELECT count(*)\` per table on both sides; delta > 0.1% → Slack alert.
- **Latency budget:** dual-write adds ≤ 5 ms p99 (acceptable; PG writes are async-await but not blocking).
- **Rollback:** flip \`FLAG_PG_DUAL_WRITE=false\`. Prior write path (D1-only) resumes within 10 s.

### 4.3 Phase 3 — Backfill + verify (~2 hours)

- Snapshot each D1 table to Workers Object Storage (JSONL gzipped).
- Stream-insert into Postgres inside a **transaction per table**. Fail-open-nothing: if any INSERT fails, the whole transaction rolls back; we re-run from snapshot.
- Parity check: row counts + \`md5(concat(columns))\` hashes match across both sides per table.
- \`FLAG_PG_BACKFILL_COMPLETE=true\` after all 14 tables verify clean.
- **Per-table SLA:** smaller tables (≤ 10k rows) finish in seconds; \`tasks\` (1.4M rows) takes ~90 min on the Supabase plan tier.
- **Throughput target:** sustained 4,000 rows/sec into Postgres without saturating the plan.
- **Rollback:** truncate Postgres; Phase 2 state resumes. D1 is untouched throughout.

### 4.4 Phase 4 — Read cutover (~30 min, 10%/50%/100% staged)

- Reads routed via \`FLAG_PG_READ_PCT\` (0 → 10 → 50 → 100 over 30 min).
- Every read still dual-executes in the background for **48 hours post-cutover**; discrepancy > 0 → alert + manual investigate.
- Writes still go to both (Phase 2 behaviour). Postgres is now a read source of truth; D1 is a fallback.
- **Per-ramp gate:** monitoring-ops verifies p99 latency, error rate, and discrepancy count before each ramp.
- **Rollback:** \`FLAG_PG_READ_PCT=0\`. Reads return to D1 instantly (within one cache TTL).

### 4.5 Phase 5 — Write cutover + D1 retire (~20 min, then 7-day wait)

- Writes go to Postgres only. D1 becomes read-only.
- Existing D1 data is frozen as a rollback snapshot.
- \`FLAG_PG_DUAL_WRITE=false\`, \`FLAG_D1_READONLY=true\`.
- **After 7 clean days:** \`wrangler d1 delete\` + strip binding from \`wrangler.jsonc\`.
- **Rollback window:** 7 days. After that, D1 is gone; only Postgres-era data survives.
- **Schema migration freeze:** no schema migrations during the 7-day window (so a hypothetical rollback to D1 is straightforward).

## 5. Verification gates (monitoring-ops runs these)

- **Per phase:** p99 latency ≤ prior phase + 15%; error rate ≤ 0.1%; no new alerts firing for 15 min.
- **Post-cutover (24h):** Postgres CPU < 70%, connection pool saturation < 80%.
- **Post-retire (7d):** zero rollback requests; zero requests to the D1 binding (alert if any code path still hits it).

## 6. Timeline

\`\`\`
Wed 10:00  Phase 1 — schema mirror
Wed 10:30  ★ gate: schema parity checks pass
Wed 10:45  Phase 2 — dual-write on
Wed 11:15  ★ gate: dual-write drift < 0.1% for 30 min
Wed 11:30  Phase 3 — backfill starts
Wed 13:30  ★ gate: all 14 tables verify
Wed 14:00  Phase 4 — read cutover (10%)
Wed 14:10  ★ gate: 10% ramp clean (no discrepancy on dual-read)
Wed 14:15  Phase 4 — 50%
Wed 14:25  ★ gate: 50% ramp clean
Wed 14:30  Phase 4 — 100%
Wed 15:00  Phase 5 — write cutover
Wed 15:30  D1 read-only; 7-day rollback window starts
+ 7 days   D1 retired (binding removed; \`wrangler d1 delete\`)
\`\`\`

## 7. Communication

| Time | Channel | What |
|---|---|---|
| Tuesday EOD | \`#announcements\` | "PG migration tomorrow 10:00 PT — read-your-writes preserved, no scheduled downtime" |
| Wed 09:50 | \`#migration-pg\` | "Going live in 10 minutes" |
| Wed 14:00 | \`#announcements\` | "Reads now serving from PG; write-cutover at 15:00" |
| Wed 15:30 | \`#announcements\` + status page | "Migration complete; PG primary; 7-day rollback window starts" |
| + 7 days | \`#announcements\` | "D1 retired; migration closed" |

## 8. Risk register

| # | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| R1 | Backfill exceeds 2 h | Low | Low | Holds Phase 4 start; not visible to users. |
| R2 | Dual-write drift exceeds 0.1% | Med | Med | Drift checker pages; rollback to Phase 1 within 30 s. |
| R3 | Read latency tail > 15% over baseline at any ramp | Med | Med | Pause ramp; widen connection pool; revisit query plans. |
| R4 | PG connection pool saturates at 100% read | Low | High | Pre-set pool size to 50; monitor; raise to 100 if needed. |
| R5 | Schema mismatch surfaces during dual-write | Low | High | Phase 1 gate explicitly checks schema parity; if it slips through, dual-write fails best-effort and alerts. |
| R6 | Customer reports a read-after-write discrepancy | Low | High | Dual-read shadow surfaces this within 48 h; immediate Phase 4 rollback. |
| R7 | Stripe webhook tries to write past_due during cutover | Low | Low | Webhook handlers are idempotent; replays are safe. |

## 9. Communication if rollback fires

If we have to roll back at any phase, comms are:

1. \`#migration-pg\` — immediate "rolling back from Phase X due to Y; ETA Z minutes."
2. Status page — only if user-visible impact (Phases 4 & 5 only).
3. Postmortem within 5 business days.

Checkpoint: \`.checkpoints/migration-ops.checkpoint.json\`.`,
    },
    {
      id: "verification-report",
      label: "monitoring-ops verification (through Phase 5)",
      kind: "report.md",
      body:
`# Migration Verification Report

**Produced by** monitoring-ops after every migration-ops phase gate.
**Signals watched:** p99 latency · error rate · connection pool saturation · drift checker alerts · CPU · memory · query-plan regression.

## 1. Phase 1 — Schema mirror (10:00 → 10:30)

- **Postgres reachable from Workers (us-east POP):** \`p50 2.1 ms / p99 4.8 ms\` over 1,000 \`SELECT 1\` round-trips.
- \`drizzle-kit migrate\` applied **14 tables + 23 indexes** in 4.2 s; no diffs against D1 schema dump.
- Schema introspection: column types match exactly; no implicit Date/Datetime mismatches.
- Connection pool: pre-warmed to 10 idle connections, no exhaustion warnings.
- **Gate: PASS** — schema mirror confirmed; nothing in prod reads PG yet.

## 2. Phase 2 — Dual-write on (10:45 → 11:15)

- Write latency delta (D1 vs. D1+PG): \`p50 +0.3 ms / p99 +1.8 ms\`. Within budget (target ≤ +5 ms).
- Postgres write failure rate: \`0.00%\` for 30 min (best-effort mode; would have retried via the failed-write queue).
- Drift checker: \`0.00%\` delta across 14 tables, sampled every 5 min.
- D1 baseline write p99: 8.2 ms. With dual-write: 10.0 ms. Acceptable.
- Worker CPU per request: +1.1 ms (PG client overhead).
- **Gate: PASS** — dual-write stable for 30 min; advancing to backfill.

## 3. Phase 3 — Backfill (11:30 → 13:30)

- **2,147,892 rows migrated across 14 tables in 2 h 04 m.**
- Per-table hash parity: ✓ all 14 tables.
- Peak Postgres write throughput: **4,200 rows/sec** (within Supabase plan ceiling of 5,000).
- Snapshot artifacts: 14 JSONL files in \`r2://taskflow-d1-snapshots/2026-04-22/\`, retained 30 days.
- No \`FAILED\` inserts; no transactions rolled back.

### 3.1 Per-table breakdown

| Table | Rows | Hash match | Time |
|---|---:|:---:|---:|
| \`tasks\` | 1,423,917 | ✓ | 89 m |
| \`task_history\` | 412,508 | ✓ | 22 m |
| \`comments\` | 188,442 | ✓ | 7 m |
| \`projects\` | 4,204 | ✓ | 11 s |
| \`users\` | 2,891 | ✓ | 8 s |
| \`teams\` | 312 | ✓ | 2 s |
| \`memberships\` | 7,142 | ✓ | 18 s |
| \`labels\` | 8,921 | ✓ | 22 s |
| \`task_labels\` | 41,204 | ✓ | 90 s |
| \`attachments\` | 18,402 | ✓ | 41 s |
| \`notifications\` | 28,301 | ✓ | 71 s |
| \`subscriptions\` | 412 | ✓ | 3 s |
| \`api_tokens\` | 822 | ✓ | 4 s |
| \`audit_log\` | 12,514 | ✓ | 32 s |

- **Gate: PASS** — all 14 tables verified clean; advancing to read cutover.

## 4. Phase 4 — Read cutover (14:00 → 14:30)

| Ramp | Read p99 (ms) | Error rate | Discrepancy | PG CPU | Pool sat. |
|---|---:|---:|---:|---:|---:|
| D1 baseline | 18.4 | 0.02% | — | — | — |
| 10% PG | 19.1 | 0.02% | 0 / 21,842 | 12% | 14% |
| 50% PG | 19.6 | 0.01% | 0 / 110,204 | 28% | 31% |
| 100% PG | 20.2 | 0.01% | 0 / 221,407 | 41% | 38% |

- No discrepancies during dual-read shadow period.
- PG CPU well within budget (target < 70%).
- Connection-pool saturation peaks at 38% — comfortable margin.
- p99 read latency increase from baseline: +1.8 ms (well under +15% budget).
- **Gate: PASS** — advancing to write cutover.

## 5. Phase 5 — Write cutover (15:00 → 15:20)

- Write p99: **24.1 ms** (was 21.9 ms on dual-write; expected slight rise now that PG is the hot path with no D1 to absorb shocks).
- D1 flipped read-only at 15:08; zero write errors observed.
- Postgres connection pool peaked at **38% saturation**.
- Read latency unchanged from end-of-Phase-4 (PG-only reads were already 100% by 14:30).
- All write paths verified end-to-end via sample queries.
- **Gate: PASS — D1 now in 7-day retain-for-rollback window.**

## 6. Alerts configured for the 7-day window

| # | Condition | Severity | Action |
|---|---|---|---|
| 1 | \`pg_error_rate > 0.5%\` for 5 min | page | PagerDuty on-call |
| 2 | \`pg_connection_saturation > 80%\` for 10 min | high | Slack \`#ops\` |
| 3 | \`any_request_to_d1\` (read or write) | high | Slack \`#ops\` (no code path should hit D1 now) |
| 4 | \`pg_disk_usage > 85%\` | medium | Slack \`#ops\` |
| 5 | \`pg_replication_lag > 5s\` | medium | Slack \`#ops\` (Supabase replica) |
| 6 | \`migration_rollback_request\` (manual) | page | Manual escalation; full team on call |

## 7. Dashboards

- **Postgres Health** — Supabase dashboard: CPU, IOPS, connection count, replication lag.
- **Migration Drift Watch** — custom Workers Analytics Engine dashboard: per-table count delta (read + dual-execute pair), discrepancy count over time.
- **D1 Read-Only Watch** — alerts on any D1 read/write attempt during the 7-day window.

## 8. Capacity headroom (post-cutover)

| Metric | Current | Plan ceiling | Headroom |
|---|---:|---:|---:|
| PG CPU (peak) | 41% | 100% | 2.4× |
| PG connections (peak) | 19 | 50 (configured) | 2.6× |
| PG storage | 8.2 GB | 100 GB (plan) | 12× |
| Write throughput (peak) | 180/s | 5,000/s | 28× |
| Read throughput (peak) | 320/s | 10,000/s | 31× |

We're well-positioned for the 3-tenant capacity overflow that motivated this migration in the first place.

## 9. Next

- monitoring-ops writes a post-migration runbook to \`docs/runbooks/d1-to-postgres.md\`.
- App-architect's checkpoint gets updated with the new tech stack (\`01-tech-stack.md\`).
- migration-ops hands control back to user; Phase 6 (D1 retire) auto-fires in 7 days via scheduled KV flag flip.

Checkpoint: \`.checkpoints/monitoring-ops.checkpoint.json\`.`,
    },
    {
      id: "ops-status",
      label: "orchestrator status (all projects)",
      kind: "status.md",
      body:
`# \`/ops status\` — mid-migration snapshot

\`\`\`
OPCHAIN STATUS — All Projects
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

▶ taskflow                                  [active]
  ✅ reverse-spec      complete     Specs backfilled 3 weeks ago
  ✅ app-architect     complete     v1.2 shipped last month
  🔄 migration-ops     in_progress  Phase 4/5 — read cutover at 50% PG
  🔄 monitoring-ops    in_progress  verification gate for Phase 4
  ✅ deploy-ops        complete     Last ship: flag ramp to 50%
  ⏳ git-ops           queued       Post-cutover commit pending
  → Next: wait for monitoring-ops Phase 4 gate, then trigger Phase 5

▶ gtrackr
  ✅ app-architect     complete     Sprint 4/4 passed evaluator
  ⏳ deploy-ops        not started  Blocked on staging QA
  → Next: /deploy staging once QA signs off

▶ heads-down
  ✅ all skills        complete     v1 shipped last week
  📊 monitoring-ops    watching     5xx 0.04%, push backlog 12, all green
  → Next: nothing actionable; revisit weekly

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  3 projects | 1 active pipeline | 0 blockers
\`\`\`

## 1. What \`/ops status\` is for

Mid-migration, the user has checkpoints from four different skills active on the same project, plus other projects in different states. \`/ops\` reads all of them from \`.checkpoints/\` without the user having to invoke each skill in turn.

This artifact is a snapshot of orchestrator output during a Wednesday afternoon, mid-cutover.

## 2. Where the data comes from

orchestrator scans every \`.checkpoints/<skill>.checkpoint.json\` it can find under each registered project root. For each it reads:

- \`status\` — pending, in_progress, complete, blocked
- \`step\` — the most recent named step
- \`progress_summary\` — a one-line human-readable summary
- \`updated_at\` — recency indicator
- \`blockers\` — array of named blockers
- \`next_actions\` — what the skill thinks should happen next

orchestrator never *writes* to other skills' checkpoints — it only reads.

## 3. The "Next" line — how it's computed

Priority hierarchy for the \`→ Next\` recommendation:

| Priority | Condition | Output |
|---|---|---|
| 1 | Any blocker | "Resolve blocker: <message>" |
| 2 | Any failing skill | "Investigate <skill> failure" |
| 3 | Any skill waiting on a gate | "Wait for <skill> gate, then <next-step>" |
| 4 | Any pending action with no upstream dep | "Run <skill>: <action>" |
| 5 | Nothing actionable | "Nothing actionable; revisit weekly" |

For \`taskflow\` above, condition 3 fires (monitoring-ops is the gate-keeper for Phase 5).

## 4. Cross-project view

Three projects are surfaced in this snapshot. The orchestrator's value compounds with the number of projects:

- **1 project:** status command is a "what's left here" reminder.
- **3 projects:** status command becomes "where should I direct attention right now."
- **10+ projects:** status becomes the only sane way to keep track without checkpoint sprawl.

The orchestrator does not prescribe priorities across projects (that's a human decision); it just surfaces state.

## 5. Filters + drill-down

- \`/ops status --project taskflow\` — single project, more detail.
- \`/ops status --since 24h\` — only show skills updated in the last 24 h.
- \`/ops status --blockers\` — only show projects with blockers.
- \`/ops history\` — timeline view of the last 30 days of skill activity.
- \`/ops next\` — directly recommend the next action without showing the full status.

## 6. Why the orchestrator never writes

The orchestrator is intentionally read-only against other skills' checkpoints. Two reasons:

1. **Single source of truth per skill.** Each skill owns its checkpoint; multiple writers create race conditions and confusion.
2. **Cross-project safety.** A bug in the orchestrator should never corrupt a project's actual state; the worst it can do is misreport.

The orchestrator's own state — the project registry, session cache, history — lives in \`.checkpoints/orchestrator.checkpoint.json\`.

## 7. Output format

The status block is plain ASCII (not Markdown) by default — works in any terminal width, copy-pastes into Slack, doesn't require a renderer. The \`✅ 🔄 ⏳ 📊 🚨\` glyphs are unicode emoji that degrade gracefully to text in screen-reader output via \`aria-label\`s.

## 8. Refresh cadence

Run on demand. Output is a snapshot at the moment of the call; no caching. Reads against \`.checkpoints/\` are filesystem-cheap (typically < 50 ms total).

Checkpoint: orchestrator state lives in memory (registry) + session cache; it reads but never writes the other skills' checkpoints.`,
    },
  ],
  skills: ["migration-ops", "orchestrator", "deploy-ops", "monitoring-ops"],
  runtime: "≈ 12 exchanges",
  steps: [
    { type: "beat", label: "01 · Assess", caption: "migration-ops sizes the engine swap", skills: ["migration-ops"] },

    {
      type: "exchange", role: "user",
      content:
`Three tenants hit D1's row limit last week. We need to move to Postgres — Supabase is our pick — without downtime. Live Workers app, about 2M rows across 14 tables, real users on it right now.

How do we not break this?`
    },
    {
      type: "exchange", role: "claude", skill: "migration-ops",
      content:
`Invoking **migration-ops** in \`/migrate assess\` mode.

Before writing a plan, I need four facts:

1. **Target Postgres config** — Supabase pooler (6543) or direct (5432)? Region?
2. **Write volume** — peak writes/sec and average? Determines whether dual-write can keep up.
3. **Consistency tolerance** — can the app tolerate a few seconds of read-after-write lag during cutover, or is it strictly read-your-writes?
4. **Rollback horizon** — how long do you want D1 kept as a fallback after cutover? (My default: 7 days.)

Also: is there a maintenance window option, or are we strictly zero-downtime?`
    },
    {
      type: "exchange", role: "user",
      content:
`1. Supabase pooler, us-east region.
2. Peak ≈ 180 writes/sec; average 40/sec.
3. Read-your-writes — it's a task tracker, people see the task they just created.
4. 7 days is fine.
5. Zero-downtime, no maintenance window.`
    },
    {
      type: "exchange", role: "claude", skill: "migration-ops",
      content:
`Writing the migration plan. **Five phases, each with a named rollback gate.** No phase touches prod until the one before it passes monitoring-ops verification.

1. **Schema mirror** — Postgres spun up empty, schema applied, tested out-of-band. Zero prod impact.
2. **Dual-write** — every write hits D1 (authoritative) and PG (mirror). Drift checker runs every 5 min. Rollback: flag flip.
3. **Backfill + verify** — snapshot D1, stream into PG transactionally, hash-compare each table. 14/14 must match.
4. **Read cutover** — route reads to PG in 10% / 50% / 100% ramps, with a dual-read shadow for 48 hours. Rollback: flag flip → 0%.
5. **Write cutover + D1 retire** — writes go PG-only, D1 flipped read-only. 7-day rollback window. Then D1 is dropped.

Read-your-writes is satisfied at every phase: Phase 2 writes both before acknowledgement; Phase 4 reads from the same source just written; Phase 5 only flips write-first after Phase 4 has validated PG reads match D1 reads for 48 hours.

Writing \`.checkpoints/migration-ops.checkpoint.json\` with the plan. \`/approve\` to proceed.`,
      artifacts: ["migration-plan"],
    },
    {
      type: "exchange", role: "user",
      content: "/approve"
    },

    { type: "beat", label: "02 · Execute + verify", caption: "migration-ops runs; monitoring-ops watches", skills: ["migration-ops", "monitoring-ops"] },

    {
      type: "exchange", role: "claude", skill: "migration-ops",
      content:
`**Phase 1 — Schema mirror.** Done. Supabase project provisioned; drizzle-kit applied 14 tables + 23 indexes; schema diff against D1 dump is empty.

**Phase 2 — Dual-write.** Flag \`FLAG_PG_DUAL_WRITE=true\`, Workers picked it up within 8 s (KV cache TTL). Drift checker is running every 5 min.

Handing off to **monitoring-ops** to watch the dual-write phase before I advance.`
    },
    {
      type: "exchange", role: "claude", skill: "monitoring-ops",
      content:
`Watching the Phase 2 gate. 30-minute window:

- Write p99 delta (D1-only vs. D1+PG): **+1.8 ms**. Within 15% budget.
- PG write failure rate (best-effort mode): **0.00%**.
- Drift checker delta across 14 tables: **0.00%** at every 5-min interval.
- No new alerts fired.

**Phase 2 gate: PASS.** Signal sent to migration-ops — proceed to Phase 3.`
    },
    {
      type: "exchange", role: "claude", skill: "migration-ops",
      content:
`**Phase 3 — Backfill.** Snapshotting each D1 table to R2, streaming into PG inside a transaction per table.

\`\`\`
tasks          → 1,423,917 rows  → ✓ hash match
projects       →     4,204 rows  → ✓ hash match
users          →     2,891 rows  → ✓ hash match
… 11 more …
\`\`\`

All 14 tables parity-verified. Backfill took 2h 4m; peak PG write throughput 4,200 rows/sec.

**Phase 4 — Read cutover (staged).** Flipping \`FLAG_PG_READ_PCT\`: 0 → 10. Handing back to monitoring-ops for the ramp gate.`
    },
    {
      type: "exchange", role: "claude", skill: "monitoring-ops",
      content:
`Phase 4 ramp monitor — watching dual-read shadow for discrepancy.

| Ramp | Read p99 (ms) | Error rate | Discrepancy |
|------|---------------|------------|-------------|
| D1 baseline | 18.4 | 0.02% | — |
| 10% PG | 19.1 | 0.02% | **0 / 21,842** |
| 50% PG | 19.6 | 0.01% | **0 / 110,204** |
| 100% PG | 20.2 | 0.01% | **0 / 221,407** |

Zero discrepancies across ~350K shadow reads. Latency drift is well under the 15% budget.

**Phase 4 gate: PASS.** migration-ops is clear to run Phase 5.`,
      artifacts: ["verification-report"],
    },

    { type: "beat", label: "03 · Cross-project view", caption: "orchestrator summarizes state", skills: ["orchestrator"] },

    {
      type: "exchange", role: "user",
      content: "/ops status"
    },
    {
      type: "exchange", role: "claude", skill: "orchestrator",
      content:
`Scanning \`.checkpoints/\` across registered projects.

\`\`\`
▶ taskflow                                  [active]
  ✅ reverse-spec      complete     Specs backfilled 3 weeks ago
  ✅ app-architect     complete     v1.2 shipped last month
  🔄 migration-ops     in_progress  Phase 4/5 verified; Phase 5 queued
  🔄 monitoring-ops    in_progress  watching for Phase 5 gate
  ✅ deploy-ops        complete     Last ship: read cutover 100%
  ⏳ git-ops           queued       post-cutover commit pending

▶ gtrackr
  ✅ app-architect     complete     Sprint 4/4 passed evaluator
  ⏳ deploy-ops        not started  blocked on QA
\`\`\`

**/ops next →** advance taskflow to Phase 5 (write cutover). The 48-hour dual-read shadow window closes at 15:00 — migration-ops is holding for that before flipping writes.

\`gtrackr\` has a longer-running blocker (QA) but no gate action from opchain until they sign off.`,
      artifacts: ["ops-status"],
    },

    { type: "beat", label: "04 · Cut over + retire", caption: "deploy-ops ships; monitoring-ops watches the 7-day window", skills: ["deploy-ops", "monitoring-ops"] },

    {
      type: "exchange", role: "claude", skill: "migration-ops",
      content:
`**Phase 5 — Write cutover.** Flipping \`FLAG_PG_DUAL_WRITE=false\` + \`FLAG_D1_READONLY=true\`. Writes now PG-only; D1 is frozen as a rollback snapshot.

Post-flip checks (15:08): write p99 = 24.1 ms (was 21.9 ms on dual-write; expected since PG is now the hot path). PG connection pool peaked at 38% saturation.

monitoring-ops alerts now armed for the 7-day rollback window:
- \`pg_error_rate > 0.5%\` for 5 min → page
- \`pg_connection_saturation > 80%\` for 10 min → Slack
- \`any_request_to_d1\` → Slack (no code path should hit it)

migration-ops hands control back. The scheduled job for D1 retire (7 days out) is registered in \`wrangler.jsonc\`'s \`crons\`.

Checkpoint closed. You're running on Postgres.`
    },
  ],
};

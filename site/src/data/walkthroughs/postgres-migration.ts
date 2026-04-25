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

**Produced by** migration-ops Phase 2 · **Approved by** user

## Target end state

- All production reads + writes hit \`postgres://…supabase.co:5432/postgres\`
- Connection pooling via Supabase PgBouncer (\`pooler.supabase.co:6543\`, transaction mode)
- D1 binding removed from \`wrangler.jsonc\`
- \`DROP DATABASE\` on the D1 side only after 7 days of clean Postgres operation

## Invariants (MUST hold through every phase)

1. **Read availability 100%.** No phase may cause read errors visible to end users. Dual-read with fall-through is fine; failure is not.
2. **Write durability 100%.** Every write must reach Postgres before user acknowledgment, from Phase 2 onward.
3. **Rollback ≤ 30 s.** Every phase is gated by a KV flag; flipping it back reverts to the prior phase's behavior within one Worker cache TTL.
4. **Backfill is transactional per table.** Partial backfill is a FAIL; re-run from snapshot.

## Phases

### Phase 1 — Schema mirror (read-only; ~15 min)

- Provision Supabase Postgres, apply the schema via \`drizzle-kit migrate\`.
- Unit tests run against both D1 (unchanged) and Postgres (new).
- \`FLAG_PG_ENABLED=false\` — nothing in prod reads Postgres yet.
- **Rollback:** drop Supabase project. Zero prod impact.

### Phase 2 — Dual-write (~45 min)

- Every write path writes to both D1 (source of truth) and Postgres (mirror).
- Postgres writes are **best-effort** in this phase — failure logs + alerts, but does not fail the request.
- \`FLAG_PG_DUAL_WRITE=true\`. D1 is still source of truth.
- Drift checker runs every 5 minutes: \`SELECT count(*)\` per table on both sides; delta > 0.1% → Slack alert.
- **Rollback:** flip \`FLAG_PG_DUAL_WRITE=false\`. Prior write path (D1-only) resumes within 10 s.

### Phase 3 — Backfill + verify (~2 hours)

- Snapshot each D1 table to Workers Object Storage (JSONL).
- Stream-insert into Postgres inside a transaction per table. Fail-open-nothing: if any INSERT fails, the whole transaction rolls back.
- Parity check: row counts + \`md5(concat(columns))\` hashes match across both sides per table.
- \`FLAG_PG_BACKFILL_COMPLETE=true\` after all 14 tables verify clean.
- **Rollback:** truncate Postgres; Phase 2 state resumes. D1 is untouched throughout.

### Phase 4 — Read cutover (~30 min, 10%/50%/100% staged)

- Reads routed via \`FLAG_PG_READ_PCT\` (0 → 10 → 50 → 100 over 30 min).
- Every read still dual-executes in the background for 48 hours post-cutover; discrepancy > 0 → alert.
- Writes still go to both (Phase 2 behavior). Postgres is now a read source of truth; D1 is a fallback.
- **Rollback:** \`FLAG_PG_READ_PCT=0\`. Reads return to D1 instantly.

### Phase 5 — Write cutover + D1 retire (~20 min, then 7-day wait)

- Writes go to Postgres only. D1 becomes read-only.
- Existing D1 data is frozen as a rollback snapshot.
- \`FLAG_PG_DUAL_WRITE=false\`, \`FLAG_D1_READONLY=true\`.
- **After 7 clean days:** \`wrangler d1 delete\` + strip binding from \`wrangler.jsonc\`.
- **Rollback window:** 7 days. After that, D1 is gone; only Postgres-era data survives.

## Verification gates (monitoring-ops runs these)

- **Per phase:** p99 latency ≤ prior phase + 15%; error rate ≤ 0.1%; no new alerts firing for 15 min.
- **Post-cutover (24h):** Postgres CPU < 70%, connection pool saturation < 80%.
- **Post-retire (7d):** zero rollback requests.

## Timeline

\`\`\`
Wed 10:00  Phase 1 — schema mirror
Wed 10:30  ★ gate: schema parity checks pass
Wed 10:45  Phase 2 — dual-write on
Wed 11:15  ★ gate: dual-write drift < 0.1% for 30 min
Wed 11:30  Phase 3 — backfill starts
Wed 13:30  ★ gate: all 14 tables verify
Wed 14:00  Phase 4 — read cutover (10%)
Wed 14:30  Phase 4 — 100%
Wed 15:00  Phase 5 — write cutover
Wed 15:30  D1 read-only; 7-day rollback window starts
+7 days    D1 retired
\`\`\`

Checkpoint: \`.checkpoints/migration-ops.checkpoint.json\`.`,
    },
    {
      id: "verification-report",
      label: "monitoring-ops verification (through Phase 5)",
      kind: "report.md",
      body:
`# Migration Verification Report

**Produced by** monitoring-ops after every migration-ops phase gate.
**Signals watched:** p99 latency · error rate · connection pool saturation · drift checker alerts.

## Phase 1 — Schema mirror (10:00 → 10:30)

- Postgres reachable from Workers (us-east POP): \`p50 2.1 ms / p99 4.8 ms\`.
- \`drizzle-kit migrate\` applied 14 tables + 23 indexes; no diffs against D1 schema dump.
- **Gate: PASS.**

## Phase 2 — Dual-write on (10:45 → 11:15)

- Write latency delta (D1 vs. D1+PG): \`p50 +0.3 ms / p99 +1.8 ms\`. Within budget.
- Postgres write failure rate: \`0.00%\` for 30 min (best-effort mode; would have retried).
- Drift checker: \`0.00%\` delta across 14 tables after 30 min.
- **Gate: PASS.**

## Phase 3 — Backfill (11:30 → 13:30)

- 2,147,892 rows migrated across 14 tables in 2h 04m.
- Per-table hash parity: ✓ ✓ ✓ ✓ ✓ ✓ ✓ ✓ ✓ ✓ ✓ ✓ ✓ ✓ (14/14).
- Peak Postgres write throughput: 4,200 rows/sec (within Supabase plan).
- No \`FAILED\` inserts; no transactions rolled back.
- **Gate: PASS.**

## Phase 4 — Read cutover (14:00 → 14:30)

| Ramp | Read p99 (ms) | Error rate | Discrepancy |
|------|---------------|------------|-------------|
| D1 baseline | 18.4 | 0.02% | — |
| 10% PG | 19.1 | 0.02% | 0 / 21,842 |
| 50% PG | 19.6 | 0.01% | 0 / 110,204 |
| 100% PG | 20.2 | 0.01% | 0 / 221,407 |

- No discrepancies during dual-read shadow period.
- **Gate: PASS.**

## Phase 5 — Write cutover (15:00 → 15:20)

- Write p99: 24.1 ms (was 21.9 ms on dual-write; expected slight drop now that D1 is skipped on the cold path but PG is hotter).
- D1 flipped read-only at 15:08; zero write errors observed.
- Postgres connection pool peaked at 38% saturation.
- **Gate: PASS. D1 now in 7-day retain-for-rollback window.**

## Alerts configured for the 7-day window

1. \`pg_error_rate > 0.5%\` for 5 min → page the on-call.
2. \`pg_connection_saturation > 80%\` for 10 min → Slack alert.
3. \`any_request_to_d1\` → Slack alert (no code path should hit D1 now).

## Next

- monitoring-ops writes a post-migration runbook to \`docs/runbooks/d1-to-postgres.md\`.
- App-architect's checkpoint gets updated with the new tech stack (01-tech-stack.md).
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

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  2 projects | 1 active pipeline | 0 blockers
\`\`\`

## Why the orchestrator is useful here

Mid-migration, the user has checkpoints from four different skills active on the same project, plus another project in a different state. \`/ops\` reads all of them from \`.checkpoints/\` without the user having to invoke each skill in turn. The "Next" line is computed from the priority hierarchy:

1. Any blocker → surface first (there are none).
2. Any failing skill → surface next (none).
3. Any skill waiting on a gate → surface that (monitoring-ops Phase 4 gate).

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

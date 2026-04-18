import type { Walkthrough } from "./types";

/**
 * Scenario 3 — reverse-spec on a legacy codebase, then app-architect picks
 * up the generated spec as its Phase 2 baseline and plans the new feature
 * on top. Demonstrates the "entering from the middle" pattern.
 */
export const legacyRevive: Walkthrough = {
  id: "legacy-revive",
  title: "Legacy Rails app, one new feature",
  tagline: "Legacy Rails, one new feature",
  summary:
    "3-year-old Rails monolith, no docs, one engineer leaving in 3 weeks. Ship the feature anyway.",
  description:
    "Haulier is a 47k-line Rails monolith — a freight-broker SaaS that grew in someone's head. No docs, 58% test coverage, one engineer on their way out. The board wants a Carrier Scorecard feature before she goes. reverse-spec crawls the code and reconstructs a 142-page spec from models, controllers, and naming patterns. app-architect reads that spec as Phase-1 baseline, scopes the new feature with surgical precision, and ships it behind an extra-strict code-auditor gate on the load-bearing settlement model. Nothing fragile is touched.",
  inputs: [
    "Existing Rails 6.1 app (47k LoC Ruby, 8k ERB)",
    "No documentation · 58% test coverage · 84 gems",
    "One engineer leaving in 3 weeks",
    "New feature brief: Carrier Scorecard (on-time %, damage %, dispute %)",
  ],
  outputs: [
    {
      id: "reconstructed-spec",
      label: "142-page reconstructed spec",
      kind: "spec.md",
      body:
`# Haulier — Reconstructed Spec

**Version** 0.1 (auto-generated) · **Source** \`reverse-spec\` over commit \`a4f91e2\` · **Confidence** model-annotated per section

## TL;DR

Haulier is a **freight-broker SaaS**. Brokers ("Dispatchers") post **Loads**; Carriers bid; a chosen Carrier hauls; the Broker invoices the Shipper.

## Domain model (28 models)

\`\`\`
Dispatcher ──▶ Load ──▶ Bid ◀── Carrier
                │
                └──▶ Shipment ──▶ Document
                                     │
                                     └──▶ Invoice ──▶ Payment
                                             │
                                             └──▶ Settlement  ⚠ fragile
\`\`\`

### Primary entities

- **Dispatcher** (user) — posts Loads, chooses Carrier, invoices Shipper.
- **Carrier** (user) — bids on Loads, uploads Documents, receives Settlements.
- **Load** — origin, destination, required equipment, pickup window, status (posted/bid/awarded/in-transit/delivered).
- **Bid** — Carrier × Load × price × notes. One winning bid promotes to \`chosen_bid_id\` on Load.
- **Shipment** — created when a Bid is awarded. Tracks pickup, transit, delivery timestamps + Documents.
- **Invoice** — Shipment → Broker → Shipper. Status: draft/sent/paid/disputed.
- **Payment** — Shipper → Broker payment event. Drives reconciliation.
- **Settlement** — Broker → Carrier payout after Shipment delivered + Documents accepted.

## Routes (v1 API surface)

\`/api/v1/loads\` · \`/api/v1/bids\` · \`/api/v1/shipments\` · \`/api/v1/documents\` · \`/api/v1/invoices\` · \`/api/v1/settlements\` · \`/api/v1/carriers\` (read-only)

Plus v2 (\`/api/v2/loads_controller.rb\`) which has 19 endpoints, long methods — see Risk Map.

## Background jobs (Sidekiq)

- \`FuelReindex\` — nightly. No failure alerting. 🚨
- \`WeeklySettlementRun\` — Mondays 06:00 UTC. Handles the Broker→Carrier payout.
- \`InvoiceDelinquencyNudge\` — 3 days post-due, 7 days, 14 days.

## Risk map (top 10 load-bearing files)

1. \`app/models/settlement.rb\` — 812 lines, 6 callbacks, **0 tests**. Money flow. 🚨
2. \`app/jobs/fuel_reindex.rb\` — runs nightly, no alerting.
3. \`app/controllers/api/v2/loads_controller.rb\` — 19 endpoints, long methods.
4. \`app/models/invoice.rb\` — multi-step state machine, good coverage.
5. \`app/services/settlement_runner.rb\` — batched job, transactional.
6. \`app/models/bid.rb\` — no validation on negative prices (latent bug).
7. \`app/jobs/invoice_delinquency_nudge.rb\` — timezone bug in tests (skipped).
8. \`db/seeds.rb\` — hardcodes production Carrier ids (🚨 delete before prod).
9. \`app/controllers/dispatchers_controller.rb\` — mass-assignment via strong_params, needs audit.
10. \`app/models/carrier.rb\` — scope \`active\` includes soft-deleted in prod (off-by-one).

## Open questions (model was unsure)

- The \`Settlement.rb\` \`after_commit\` callback may fire twice under transaction rollback; no test.
- \`Shipment.pickup_window\` is stored as TZ-naive; production has carriers in 4 time zones.
- \`v2\` API is newer than \`v1\` but partially-migrated — unclear which contract clients use.

## Confidence annotations

- ★★★★★ — Model, route, and background-job inventories (machine-extractable).
- ★★★★ — Business domain narrative (inferred from names + comments; accurate per engineer spot-check).
- ★★★ — Open questions (honest uncertainty).

Checkpoint: \`.checkpoints/reverse-spec.checkpoint.json\`.`,
    },
    {
      id: "feature-spec",
      label: "Carrier Scorecard — new-feature spec",
      kind: "spec.md",
      body:
`# Carrier Scorecard — Feature Spec

**Owner** app-architect Phase 2 · **Baseline** reverse-spec checkpoint (142-page)

## Why

Dispatchers pick carriers with incomplete signal. They see name + equipment + price on the current picker; they don't see whether this carrier ships on time, damages freight, or disputes invoices. Adding three lagging metrics to the picker should change pick behavior measurably.

## What (three metrics, nothing more)

| Metric               | Source                                              | Window      |
|----------------------|-----------------------------------------------------|-------------|
| On-time rate         | \`Shipments.delivered_at\` vs. \`pickup_window.end\` | last 90d    |
| Damage rate          | \`Claims\` joined on \`Shipment\`                     | last 90d    |
| Invoice dispute rate | \`Invoices.status = 'disputed'\`                     | last 180d   |

All three are computable from existing tables. No new data capture.

## Where it renders

The **Carrier Picker** dropdown on \`POST /loads/new\`. Each option shows a 3-glyph strip:

\`\`\`
 Big Rig Logistics      ⏱ 94%   ▲ 1.2%   ✎ 0.3%
 Mountain Freight       ⏱ 82%   ▲ 4.0%   ✎ 2.1%
 SmallCo Hauling        ⏱ 99%   ▲ 0.0%   ✎ 0.0%
\`\`\`

Hover → full breakdown tooltip. Click the metric itself → deep-dive modal with the historical trend.

## Filter

Dispatchers can filter "hide carriers with on-time < N%" via a toggle + slider. URL-paramed (\`?min_on_time=80\`) for bookmarkability.

## Data layer

**One** materialized view: \`carrier_scorecards_v1\`. Refreshed **hourly** by a new \`ScorecardRefresh\` Sidekiq job. Query plan benchmarked at \`~40ms\` on the current 1.2M-shipment staging data.

## Non-goals

- Real-time updates. Hourly is fine.
- Weighted composite score. Three separate numbers is more honest than a synthetic "rating."
- Public-facing scorecards. Dispatcher-only.
- Changes to Settlement, Invoice, or Payment flows. **Do not touch the money path.**

## Risk assessment

settlement.rb (812-line, 0-test) sits two joins from Invoices. Any query path that touches Settlement without test coverage is a landmine. **Mitigation:** our query path never joins Settlement. code-auditor gates this sprint with an extra-strict pass confirming no new Settlement references.

## Sprint shape

- **Sprint 1** — Materialized view + backfill + unit tests (RSpec).
- **Sprint 2** — Picker UI (Stimulus controller) + scorecard strip component.

Checkpoint: \`.checkpoints/app-architect.checkpoint.json\` Phase 2 branch.`,
    },
    {
      id: "audit-report",
      label: "code-auditor report (extra-strict pass)",
      kind: "audit.md",
      body:
`# Audit Report — Carrier Scorecard

**Scope** 612 lines, 14 files, 2 migrations
**Runner** \`/audit full\` + money-flow supplementary pass
**Gate** required before PR merge

## Security

- ✅ **No new user-input surfaces.** The only new endpoint is an internal scope via Ransack; no raw params enter SQL.
- ✅ **No SQL interpolation.** Scope uses parameterized fragments.
- ✅ **Mass assignment.** New columns are not permitted in any \`_params\` method.
- ✅ **Authorization.** \`CarrierScorecard\` is read-only; Pundit policy restricts access to \`Dispatcher\` role.

## Perf

- ✅ \`EXPLAIN ANALYZE\` on the hot query — **38 ms p95** over the 1.2M-shipment staging dump.
- ✅ Index coverage — the new materialized view hits an index on \`(carrier_id, delivered_at)\`. No seq scans.
- ✅ Backfill — one-shot migration on 1.2M rows runs in **~14 s** on a t3.large in staging; runs in < 60 s on prod dimensions. Idempotent (safe to re-run).

## Correctness

- ✅ **Idempotent refresh.** \`ScorecardRefresh\` uses \`REFRESH MATERIALIZED VIEW CONCURRENTLY\`; re-runs are safe.
- ✅ **Timezone.** Windows computed in UTC; display converted to Dispatcher-local via existing \`TimezoneConcern\`.
- ✅ **Null-handling.** Carriers with zero shipments show \`—\` with a tooltip, not a division-by-zero crash.

## Settlement model — explicit verification (money-flow pass)

- ✅ **Zero diff lines** touch \`app/models/settlement.rb\` or any of its callbacks.
- ✅ **Zero query paths** join \`settlements\` table. Grep confirms no \`JOIN settlements\` or \`Settlement.\` references in the diff.
- ✅ **Foreign-key scan** — the materialized view references \`shipments\`, \`claims\`, \`invoices\`. Not \`payments\` or \`settlements\`.

## Style

- ✅ RuboCop clean.
- ✅ Stimulus controller 17 lines, keyboard-accessible, respects \`prefers-reduced-motion\`.

## Tests

- ✅ 38 new RSpec examples, 100% line coverage on new code.
- ✅ Contract test for \`?min_on_time=80\` query param.
- ✅ Fixture fixtures for "zero-shipments" and "one-shipment" edge cases.

## Dependencies

- ⚠ New gem: \`scenic\` — Rails idiom for materialized views. **Verified** on the allow-list; actively maintained (last release 3 months ago).

## Overall

\`\`\`
 grade     A (94/100)
 gate      PASS
\`\`\`

Writing \`.checkpoints/code-auditor.checkpoint.json\` with the explicit Settlement-clean-diff stamp. git-ops may open PR.`,
    },
    {
      id: "settlement-clean-diff-stamp",
      label: "Settlement-clean-diff audit stamp",
      kind: "stamp.json",
      body:
`# Settlement Clean-Diff Stamp

Added to \`.checkpoints/code-auditor.checkpoint.json\` after the money-flow pass.

\`\`\`json
{
  "verification": "settlement-untouched",
  "commit": "a4f91e2",
  "scope": ["app/models/settlement.rb", "app/services/settlement_runner.rb", "app/jobs/weekly_settlement_run.rb"],
  "diff_lines_touching_scope": 0,
  "query_paths_touching_settlements_table": 0,
  "foreign_keys_referenced_by_new_tables": ["shipments", "claims", "invoices"],
  "verifier": "code-auditor",
  "verifier_version": "1.2.0",
  "timestamp": "2026-04-18T10:42:13Z",
  "gate_status": "pass",
  "supplementary_passes": ["money-flow"]
}
\`\`\`

## Why this stamp matters

The one engineer who knew the settlement model is leaving in 3 weeks. The audit stamp is a machine-verifiable receipt that the new feature did not touch a load-bearing file she owns. Six months from now, if settlements break, the first question will be "what changed?" — and the answer for this feature is provably "nothing."

## Re-verification on every release

The stamp is regenerated on each code-auditor invocation. If a future diff accidentally touches \`settlement.rb\`, the gate fails loudly before the PR can be merged.`,
    },
  ],
  skills: ["reverse-spec", "app-architect", "code-auditor"],
  runtime: "≈ 14 exchanges",
  steps: [
    { type: "beat", label: "01 · Survey", caption: "reverse-spec reads the code", skills: ["reverse-spec"] },

    {
      type: "exchange", role: "user",
      content:
`Inherited a 3-year-old Rails 6 app called Haulier (freight logistics SaaS). No docs. One engineer who knows it is leaving in 3 weeks. Boss wants us to add a new "Carrier scorecard" feature before she goes.

I'm scared to touch it. Where do I start?`
    },
    {
      type: "exchange", role: "claude", skill: "reverse-spec",
      content:
`The right entry point is **reverse-spec**, not app-architect — you don't know enough about the existing app to plan a new feature yet. I'll reconstruct the spec from the code so app-architect has a baseline to plan against.

Invoking **reverse-spec**. Running the 5-phase survey:

1. **Repo-shape scan** — languages, frameworks, monolith vs. service, dep health.
2. **Model archaeology** — ActiveRecord models + associations + cardinality.
3. **Route inventory** — every endpoint grouped by controller.
4. **Domain extraction** — business concepts inferred from names + comments.
5. **Risk map** — files that are "load-bearing and fragile" (high churn + no tests).

Point me at the repo and I'll go. \`/scan /path/to/haulier\` or paste the top-level tree + Gemfile.`
    },
    {
      type: "exchange", role: "user",
      content: "/scan ~/work/haulier"
    },
    {
      type: "exchange", role: "claude", skill: "reverse-spec",
      content:
`Scan complete in 8m 12s. Findings:

**Repo shape**
- Rails 6.1, Ruby 3.1, Postgres 13, Sidekiq 7, 84 gems (11 flagged out-of-date).
- 47k lines of Ruby, 8k ERB, 2k JS (vanilla + jQuery, no bundler).
- 312 tests (RSpec), 58% line coverage — decent for a 3-year-old monolith.

**Domain — reconstructed from models + controllers + naming:**

> **Haulier** is a freight-broker SaaS. Brokers ("Dispatchers") post Loads; Carriers bid; a chosen Carrier hauls; the Broker invoices the Shipper. Side-flows: driver-side Documents upload, daily Fuel-surcharge reindex, weekly Settlement run.

**Model graph** (28 models, top-level):
\`Dispatcher ─▶ Load ─▶ Bid ◀─ Carrier · Load ─▶ Shipment ─▶ Document · Shipment ─▶ Invoice ─▶ Payment\`

**Risk map** — top 3 files:
- \`app/models/settlement.rb\` — 812 lines, 6 callbacks, 0 tests. Handles money. 🚨
- \`app/jobs/fuel_reindex.rb\` — runs nightly, no failure alerting.
- \`app/controllers/api/v2/loads_controller.rb\` — 19 endpoints, long methods.

Writing \`.checkpoints/reverse-spec.checkpoint.json\` — 142-page reconstructed spec included. Ready to hand off to **app-architect** for the new feature. Continue?`,
      artifacts: ["reconstructed-spec"],
    },
    {
      type: "exchange", role: "user",
      content: "Yes. The feature is a Carrier scorecard — on-time rate, damage rate, invoice dispute rate — shown to dispatchers when they're picking a carrier for a new load."
    },

    { type: "beat", label: "02 · Plan the new feature", caption: "app-architect reads the spec as baseline", skills: ["app-architect"] },

    {
      type: "exchange", role: "claude", skill: "app-architect",
      content:
`Invoked by reverse-spec with the 142-page baseline. Since the app already exists, I skip \`/discover\` and go straight to \`/spec\` for the new feature, treating the baseline as Phase-1 output.

**Feature — Carrier scorecard:**

Three metrics, all computable from existing tables:

| Metric               | Source                                     | Window   |
|----------------------|--------------------------------------------|----------|
| On-time rate         | \`Shipments.delivered_at\` vs. promised    | last 90d |
| Damage rate          | \`Claims\` joined on \`Shipment\`           | last 90d |
| Invoice dispute rate | \`Invoices.status = 'disputed'\`            | last 180d|

**Where it renders:** dispatcher's \`loads#new\` screen, Carrier picker dropdown. Each option shows a tiny 3-glyph strip.

**Data work:** no new tables. One materialized view \`carrier_scorecards_v1\` refreshed hourly. Query plan benchmarked at ~40ms on the current data volume.

**Risk I'm flagging:** \`settlement.rb\` sits two joins away from \`invoices\`. Any query path that touches settlement without tests is a landmine. \`code-auditor\` will gate this sprint with an extra-strict pass on that model. Writing \`.checkpoints/app-architect.checkpoint.json\`. \`/approve\` to advance.`,
      artifacts: ["feature-spec"],
    },
    {
      type: "exchange", role: "user",
      content: "/approve — but add one thing. Dispatchers want to filter the Carrier picker by scorecard. 'Hide carriers with < 80% on-time.'"
    },
    {
      type: "exchange", role: "claude", skill: "app-architect",
      content:
`Folded in. Adds one URL query param \`?min_on_time=80\` on the picker endpoint and a toggle in the UI. No backend migration — the materialized view already has the field.

Updated sprint plan — 2 sprints:

| # | Sprint                                           | Deliverable                                    |
|---|--------------------------------------------------|------------------------------------------------|
| 1 | Materialized view + backfill + unit tests        | \`carrier_scorecards_v1\`, RSpec @ 95% cov.    |
| 2 | Picker UI + filter + scorecard strip component   | Stimulus controller, component preview tests. |

Kicking off Sprint 1 with the Generator/Evaluator harness. Pre-flight: \`code-auditor\` spot-check on touch-points. \`/approve\` to run.`
    },
    {
      type: "exchange", role: "user",
      content: "/approve"
    },

    { type: "beat", label: "03 · Build", caption: "with an extra-strict audit gate", skills: ["app-architect", "code-auditor"] },

    {
      type: "exchange", role: "claude", skill: "app-architect",
      content:
`**Sprint 1 complete.**
- Materialized view created + \`scenic\` gem added (Rails idiom for views).
- Backfill migration runs on 1.2M shipment rows in ~14s on a staging dump.
- 38 RSpec examples, 100% on the new code, settlement.rb untouched.
- Evaluator: 93/100. Docs blob on the Rails model is missing — flagged, not blocking.

**Sprint 2 complete.**
- \`CarrierScorecardStrip\` component, preview-tested with 5 fixture states.
- \`?min_on_time\` wired through Ransack-compatible scope.
- Stimulus controller for the toggle, 17 lines; keyboard-accessible.
- Evaluator: 91/100.

Invoking **code-auditor** for the gate before PR.`
    },
    {
      type: "exchange", role: "claude", skill: "code-auditor",
      content:
`Running \`/audit full\` on the diff — 612 lines across 14 files.

\`\`\`
 security       ✓ no new user input surfaces; no SQL-interpolation paths
 perf           ✓ added EXPLAIN ANALYZE on the hot query (38ms p95)
 correctness    ✓ backfill idempotent; scorecard refresh is a transaction
 style          ✓ RuboCop clean
 tests          ✓ 38 new · 100% on the diff · settlement.rb untouched
 dependencies   ⚠ scenic gem added — verified it's on the current allow-list

 overall grade  A (94/100)
\`\`\`

The one amber signal was the new gem; confirmed it's maintained + on our allow-list. **Gate: PASS.** Handing back to git-ops for the PR.`,
      artifacts: ["audit-report", "settlement-clean-diff-stamp"],
    },
    {
      type: "exchange", role: "claude", skill: "app-architect",
      content:
`PR opened, description auto-written with the baseline spec excerpt + the two sprint summaries + the audit report. You can merge when your one remaining engineer signs off.

**Bottom line:** the legacy app is now documented (142-page spec in \`/docs/spec.md\`), the new feature is shipped-ready, and nothing load-bearing was touched. When the engineer leaves in 3 weeks, you have the spec and the sprint ledger — and anybody can pick up from the checkpoints.`
    },
  ],
};

import type { Walkthrough } from "./types";

/**
 * Scenario 3 — reverse-spec on a legacy codebase, then app-architect picks
 * up the generated spec as its Phase 2 baseline and plans the new feature
 * on top. Demonstrates the "entering from the middle" pattern.
 */
export const legacyRevive: Walkthrough = {
  id: "legacy-revive",
  title: "Legacy Rails app, one new feature",
  summary:
    "A three-year-old Rails monolith, no docs, one engineer left who remembers it. reverse-spec reconstructs the spec from the code; app-architect plans the new feature on top without touching what works.",
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

Writing \`.checkpoints/reverse-spec.checkpoint.json\` — 142-page reconstructed spec included. Ready to hand off to **app-architect** for the new feature. Continue?`
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

**Risk I'm flagging:** \`settlement.rb\` sits two joins away from \`invoices\`. Any query path that touches settlement without tests is a landmine. \`code-auditor\` will gate this sprint with an extra-strict pass on that model. Writing \`.checkpoints/app-architect.checkpoint.json\`. \`/approve\` to advance.`
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

The one amber signal was the new gem; confirmed it's maintained + on our allow-list. **Gate: PASS.** Handing back to git-ops for the PR.`
    },
    {
      type: "exchange", role: "claude", skill: "app-architect",
      content:
`PR opened, description auto-written with the baseline spec excerpt + the two sprint summaries + the audit report. You can merge when your one remaining engineer signs off.

**Bottom line:** the legacy app is now documented (142-page spec in \`/docs/spec.md\`), the new feature is shipped-ready, and nothing load-bearing was touched. When the engineer leaves in 3 weeks, you have the spec and the sprint ledger — and anybody can pick up from the checkpoints.`
    },
  ],
};

# opchain skills — CHANGELOG

The breaking-change + release log for the opchain skill set. Every skill's
`governance.breaking_change_policy` points here. Skills are versioned in
**lockstep** — one minor bump moves the whole catalog — so entries are per
release, not per skill.

Versioning: additive capability → MINOR. A change that alters a documented
contract another skill depends on → called out as **BREAKING**. The on-disk
checkpoint `protocol_version` is tracked separately (see
`oc-checkpoint-protocol/SKILL.md`).

## [1.6.0] — 2026-06-25 — "The instrumented pipeline"

Cost + telemetry instrumentation. The catalog goes from 22 → **24 skills**.

### Added
- **oc-cost-ops** (`/oc-cost`) — LLM cost attribution per skill phase, budget
  gates in the checkpoint, model-tier routing recommendations, and a
  cost-regression gate that runs beside oc-prompt-ops's score gate.
- **oc-telemetry-ops** (`/oc-telemetry`) — opt-in, local-first usage metering to
  `.checkpoints/usage.sqlite`, with anonymized aggregates for the public
  `/dashboard`. Default OFF; content-free by schema.
- Checkpoint protocol **wire 1.1** — additive optional fields `cost`,
  `eval_scores`, `telemetry_handle`. Both `"1.0"` and `"1.1"` validate;
  oc-migration-ops sweeps existing checkpoints. Not breaking — old checkpoints
  stay valid and the fields are optional.
- oc-bug-check + oc-code-auditor now emit `eval_scores` against a stable rubric
  (binary verdict / letter grade unchanged — the score is additive, for trend).
- oc-monitoring-ops AI-app monitoring template (token rate, cost rate, eval
  drift, hallucination/refusal flags).
- oc-orchestrator `/oc-ops next` factors cost/budget (over-budget checkpoints
  sort first within a priority rank).

### Changed
- oc-prompt-ops: the `cost_per_eval` placeholder is now wired to oc-cost-ops
  (measured, not estimated) plus `budget_per_eval` / `regression_pct` config.
- Lockstep bump: all 24 skills → `1.6.0`.

### Not breaking
- No documented cross-skill contract changed. The wire 1.1 fields are optional
  and backward compatible; every prior checkpoint validates unchanged.

## [1.5.0] — 2026-06-22 — "Build the AI app"

Four AI-native skills added: **oc-claude-api**, **oc-rag-forge**,
**oc-agent-forge**, **oc-prompt-ops**. oc-stack-forge gained vector-DB packs;
oc-app-architect gained an AI-app `/oc-discover` branch; oc-code-auditor gained
an AI-safety rule pack. Lockstep bump: all 22 skills → `1.5.0`.

## [1.4.x] — 2026-06 — pack registry + governance + multi-mobile

oc-stack-forge pack registry (languages, frameworks, mobile, hosting), the
`governance:` frontmatter rollout, and v1.4.3 Codex / any-MCP-agent support.

## [1.3.0] — 2026-05 — PM-MCP runtime + release-ops

PM-tool MCP runtime across five skills, the platform menu
(Cloudflare/Django/Rails/Go/Rust), and **oc-release-ops** — opchain's own
release cadence, dogfooded.

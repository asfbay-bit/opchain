---
name: oc-cost-ops
displayName: OC · Cost Ops
version: 1.6.0
shortDesc: LLM cost attribution per skill phase, budget gates in checkpoints, and model-tier routing recommendations.
phases: [build]
triAgent: false
tryable: true
commands:
  - /oc-cost
  - /oc-cost attribute
  - /oc-cost budget
  - /oc-cost route
  - /oc-cost gate
  - /oc-cost report
description: >
  Cost operations harness — attribute LLM spend to the skill phase that incurred
  it, set per-phase and per-suite budgets that gate in the checkpoint, and
  recommend model-tier routing (Haiku for cheap repetitive phases, Opus for
  spec/audit/migration). Use for /oc-cost, "what did this cost", "cost
  attribution", "token cost", "budget gate", "model tier routing", "cost
  regression", "cheaper model", "spend per feature". Pairs with oc-prompt-ops
  (cost-regression gate alongside the score gate) and oc-telemetry-ops (feeds
  the public /dashboard cost stats). Trigger liberally on cost/spend work.
governance:
  breaking_change_policy: skills/CHANGELOG.md
  last_reviewed: 2026-06-25
  owner: opchain
  docs:
    - { path: SKILL.md, kind: contract, lifecycle: stable }
    - { path: references/cost-attribution.md, kind: shared, lifecycle: stable }
    - { path: references/model-tier-routing.md, kind: shared, lifecycle: stable }
    - { path: references/budget-gates.md, kind: shared, lifecycle: stable }
    - { path: references/pricing-reference.md, kind: shared, lifecycle: stable }
---

# Cost Ops

Make LLM spend a **first-class, attributable number** in the pipeline. v1.5 added
four AI-native skills; the predictable next question is *"what did that cost
me?"* — and today the honest answer across opchain is "we don't precisely know."
Cost Ops closes that loop: every skill phase that calls a model can attribute its
spend, every checkpoint can carry a budget that **gates** when tripped, and every
model choice can be checked against a tier-routing recommendation (don't run
Opus on a phase Haiku handles).

This is **not** a tri-agent harness and not a billing system. It's the
instrumentation layer that sits underneath the model-facing skills — `oc-claude-api`
owns the request surface and the canonical pricing, `oc-prompt-ops` owns the eval
suite, `oc-telemetry-ops` owns local metering — and Cost Ops turns the token
counts they already produce into attributed dollars, budgets, and routing advice.

> **Pricing facts come from `oc-claude-api`, not memory.** Per-token prices,
> Batch-API economics (50% of standard), and cache read/write multipliers are
> sourced there. Current model IDs: **Fable 5** (`claude-fable-5`), **Opus 4.8**
> (`claude-opus-4-8`), **Sonnet 4.6** (`claude-sonnet-4-6`), **Haiku 4.5**
> (`claude-haiku-4-5`). `references/pricing-reference.md` carries a dated snapshot
> and always defers to oc-claude-api as source of truth.

---

## /oc-cost — Command Reference

```
COST OPS COMMANDS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  ATTRIBUTION
  /oc-cost              Summarize spend for the current project (by phase + model)
  /oc-cost attribute    Attribute a run's token counts → dollars, write checkpoint.cost
  /oc-cost report       Cost-per-shipped-feature report (feeds /showcase + /dashboard)

  BUDGETS & GATES
  /oc-cost budget       Set a per-phase / per-suite budget ceiling in the checkpoint
  /oc-cost gate         Run the budget + cost-regression gate (CI-friendly verdict)

  ROUTING
  /oc-cost route        Recommend a model tier per phase (Haiku/Sonnet/Opus/Fable)

  UTILITIES
  /checkpoint           Show checkpoint status

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Type any command to begin. /oc-cost to see this again.
```

---

## How This Skill Fits the Build Pipeline

```
oc-claude-api (pricing + token counts) ──┐
oc-prompt-ops (per-eval token counts)  ──┼──► oc-cost-ops ──► checkpoint.cost
oc-bug-check / oc-code-auditor (phase) ──┘        │            { total_usd, budget_usd,
                                                  │              by_phase, by_model }
                          ┌───────────────────────┼───────────────────────┐
                          ▼                       ▼                        ▼
                   /oc-cost gate            /oc-cost route          oc-telemetry-ops
                   budget + cost-           tier recommendation     aggregate → /dashboard
                   regression (CI)          per phase               cost-per-feature stats
```

Cost Ops reads token counts the model-facing skills already emit, multiplies by
the `oc-claude-api` pricing, and writes the attributed result into the wire-1.1
`cost` checkpoint field. Downstream: `oc-prompt-ops` runs the **cost-regression
gate** beside its score gate (a prompt change that holds quality but triples cost
is a regression), and `oc-telemetry-ops` aggregates cost across runs for the
public `/dashboard`.

---

## The `cost` checkpoint field (wire 1.1)

Cost Ops is the owner of the `cost` field added to the checkpoint protocol in
v1.6 (see `oc-checkpoint-protocol` § "Wire 1.1 extensions"):

```jsonc
"cost": {
  "currency": "USD",
  "total_usd": 12.34,
  "budget_usd": 50,
  "by_phase": { "spec": 3.10, "build": 8.40, "audit": 0.84 },
  "by_model": { "claude-opus-4-8": 9.2, "claude-haiku-4-5": 3.1 },
  "tokens": { "input": 1200000, "output": 240000 },
  "updated_at": "2026-06-25T12:00:00Z"
}
```

The validator warns (does not error) when `total_usd > budget_usd` — overspend is
a signal. The *gate decision* (block the merge / deploy vs. warn) is policy Cost
Ops applies in `/oc-cost gate`, documented in `references/budget-gates.md`.

---

> **Scaffold note (v1.6 Sprint 1).** This file establishes the contract,
> commands, pipeline position, and the `cost` checkpoint field. The full
> methodology — the attribution model, the model-tier routing decision tree, the
> budget-gate mechanics, and the dated pricing snapshot — lands in Sprint 2 as
> `references/cost-attribution.md`, `references/model-tier-routing.md`,
> `references/budget-gates.md`, and `references/pricing-reference.md`, and this
> body expands to reference them.

---

## Boundaries (what oc-cost-ops does NOT own)

| Concern | Owner | Why |
|---|---|---|
| Per-token prices, Batch economics, cache multipliers | `oc-claude-api` | Cost Ops consumes the price table; oc-claude-api is its source of truth |
| The eval suite + score-regression gate | `oc-prompt-ops` | Cost Ops adds the *cost*-regression gate beside it |
| Local usage metering + the `/dashboard` data | `oc-telemetry-ops` | Cost Ops attributes spend; telemetry stores + aggregates it |
| Deploying anything | `oc-deploy-ops` | Cost Ops is advisory + a gate, never a deployer |

---

## Checkpoint Integration

### Location
`{project-dir}/.checkpoints/oc-cost-ops.checkpoint.json`

### When to Write

| Event | What to Save |
|---|---|
| Spend attributed | `cost.total_usd`, `cost.by_phase`, `cost.by_model` |
| Budget set | `cost.budget_usd` |
| Gate run | gate verdict + the cost delta vs baseline |
| Routing recommended | per-phase tier recommendation in `skill_state` |

### Cross-Skill Reads

| Reads from | Why |
|---|---|
| oc-claude-api | The price table + model IDs |
| oc-prompt-ops | Per-eval token counts to cost |
| oc-bug-check / oc-code-auditor | The phase a run belongs to |

| Read by | Why |
|---|---|
| oc-prompt-ops | Cost number for the cost-regression gate |
| oc-telemetry-ops | Attributed cost to aggregate for /dashboard |
| oc-orchestrator | Budget/cost to factor into `/oc-ops next` prioritization |

---

## Principles

1. **Attribute, don't estimate.** Cost is multiplied from real token counts and
   the `oc-claude-api` price table — not guessed.
2. **The number lives in the checkpoint.** `cost` is wire-1.1 protocol state, so
   spend survives across sessions and is auditable in the PR diff.
3. **Cost is a regression dimension.** A change that holds quality but triples
   spend is a regression; the cost gate runs beside the score gate.
4. **Route to the cheapest tier that holds quality.** Haiku for cheap repetitive
   phases, Opus for spec/audit/migration — recommended, never silently downgraded.
5. **Pricing facts come from oc-claude-api.** Never hard-code prices from memory;
   the snapshot is dated and defers to the source.

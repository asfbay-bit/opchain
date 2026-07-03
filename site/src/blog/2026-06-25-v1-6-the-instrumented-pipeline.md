---
title: "v1.6 — The instrumented pipeline"
description: "opchain v1.6 adds oc-cost-ops and oc-telemetry-ops: cost attribution, budget gates, and opt-in usage metering. Your pipeline can now see what it spends."
date: "2026-06-25"
author: opchain
pillar: release
tags: [release, cost, telemetry]
---

v1.5 made the AI part of your app an [evaluated
artifact](/blog/2026-06-23-v1-5-build-the-ai-app). v1.6 asks the ruder
follow-up: **what did all that evaluating cost, and would you notice if it
doubled?**

Until today the honest answer was no. opchain could plan, build, audit, ship,
and monitor your app — and could not tell you what any of that cost. Like a
contractor who does beautiful work and throws away every receipt. v1.6 fixes
the receipts. The theme, in one sentence:

> You can't steer what you can't see.

## The two new skills

- **[oc-cost-ops](/skills/oc-cost-ops)** (`/oc-cost`) — LLM cost attribution
  at the resolution that actually matters: **the skill phase**. Not "you spent
  $40 this month" but "the build loop's evaluator rounds are 31% of sprint
  cost." On top of attribution: **budget gates** in the checkpoint (a phase
  that blows its budget fails the gate the same way a failing test does) and
  **model-tier routing** — Haiku for mechanical, repetitive phases; Opus where
  a wrong judgment is the expensive part. It also adds a cost-regression gate
  that runs beside [oc-prompt-ops](/skills/oc-prompt-ops)'s score gate,
  because a prompt change that improves the score 2% and triples the cost is
  not an improvement. It's a subscription.
- **[oc-telemetry-ops](/skills/oc-telemetry-ops)** (`/oc-telemetry`) — opt-in
  usage metering that records which skills and phases actually run. It's
  **local-first**: everything lands in `.checkpoints/usage.sqlite`, in your
  repo, where you can open it with `sqlite3` and check our math. Anonymized
  aggregates — and only aggregates — feed the public
  [/dashboard](/dashboard). Default **off**, and content-free by schema: the
  tables have no column that could hold a prompt. It answers "which skills get
  used" without ever learning what you used them for.

## Wire 1.1 — the checkpoint protocol grows three fields

Instrumentation needs somewhere to live, and in opchain everything durable
lives in the checkpoint. The
[checkpoint protocol](/skills/oc-checkpoint-protocol) moves to **wire 1.1**
with three additive, optional fields:

- `cost` — what each phase spent, written by oc-cost-ops
- `eval_scores` — scored quality over time, not just a pass/fail verdict
- `telemetry_handle` — the pointer that lets metering stay local

Both `"1.0"` and `"1.1"` validate. Existing checkpoints don't break, don't
need migrating by hand, and get swept up opportunistically by
[oc-migration-ops](/skills/oc-migration-ops). If your resume flow worked
yesterday, it works today — the fields simply start appearing.

## The ripples

As usual, the new skills don't sit off to the side; the rest of the catalog
learns to use them:

- **[oc-bug-check](/skills/oc-bug-check)** and
  **[oc-code-auditor](/skills/oc-code-auditor)** now emit `eval_scores`
  against a stable rubric. The binary verdict and letter grade are unchanged —
  but your code quality now has a *trend line*, and trend lines are where slow
  rot goes to get caught.
- **[oc-monitoring-ops](/skills/oc-monitoring-ops)** gains an AI-app
  monitoring template: token rate, cost rate, eval drift, and
  hallucination/refusal flags. Your error budget, meet your actual budget.
- **[oc-orchestrator](/skills/oc-orchestrator)**'s `/oc-ops next` is now
  cost-aware: within a priority rank, over-budget checkpoints sort first.
  "What should I work on?" now includes "the thing quietly on fire,
  financially."
- **oc-prompt-ops**'s `cost_per_eval` placeholder is finally wired to
  measured numbers instead of estimates.

The catalog goes from 22 to **24 skills**, in lockstep at `1.6.0`.

## The through-line

v1.5's bet was that the AI part of an app should be measured like code. v1.6
extends the same bet to the pipeline itself: every phase now reports what it
spent and how it scored, in a file you own, on your disk.

One warning from experience: instrumentation has a reliable side effect —
**it embarrasses you.** We've already pointed both new skills at opchain's own
development history, and we'll publish what they found, receipts included.
Some of the receipts are unflattering. That's rather the point.

Browse the [skill library](/skills), watch the numbers land on the
[dashboard](/dashboard), or [install opchain](/install) and run `/oc-cost` on
your own pipeline.

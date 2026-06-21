---
name: oc-prompt-ops
displayName: OC · Prompt Ops
version: 1.5.0
shortDesc: Prompt-as-code — versioning, eval datasets, regression and drift detection for LLM prompts.
phases: [build, ai-native]
triAgent: false
tryable: true
commands:
  - /oc-prompt
  - /oc-prompt eval
  - /oc-prompt diff
description: >
  Prompt operations harness — treat prompts as versioned, diffable,
  source-controlled code. Owns prompt versioning, eval datasets, regression
  detection, and drift tracking. Use for /oc-prompt, "prompt versioning",
  "eval dataset", "prompt regression", "prompt drift", "golden set",
  "prompt diff", "LLM eval", "regression suite". Trigger liberally on
  prompt-engineering / eval work.
governance:
  breaking_change_policy: skills/CHANGELOG.md
  last_reviewed: 2026-06-21
  owner: opchain
  docs:
    - { path: SKILL.md, kind: contract, lifecycle: stable }
---

# Prompt Ops

> **WIP — v1.5 Sprint 1 scaffold.** Frontmatter is final; the body lands in
> Sprint 3 (ADEV-347), which also publishes opchain's own eval set as the
> dogfooding artifact under `/oc-prompt eval`.

Prompt-as-code: versioning, eval datasets, regression detection, and drift
tracking for the prompts that drive opchain skills and the apps they build.

## Planned command reference

```
/oc-prompt        Version / organize a prompt set
/oc-prompt eval   Run a prompt against an eval dataset
/oc-prompt diff   Diff two prompt versions + their eval deltas
```

## Planned body (Sprint 3 — ADEV-347)

1. Prompt-as-code convention — source-controlled, diffable, lockstep-versioned.
2. Eval datasets — `inputs.jsonl` / `expected.jsonl` / `eval.yaml` rubric.
3. Drift detection — flag when a model or prompt change moves scores.
4. Regression workflow — gate prompt changes on the eval suite.
5. `oc-cost-ops` collaboration stub — `cost_per_eval` populated once v1.6 lands.

## Planned reference docs (Sprint 3)

- `references/prompt-versioning.md`
- `references/eval-datasets.md`
- `references/drift-detection.md`

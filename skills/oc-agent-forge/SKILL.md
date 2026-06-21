---
name: oc-agent-forge
displayName: OC · Agent Forge
version: 1.5.0
shortDesc: Scaffold Claude Agent SDK apps — subagent topology, tool budgets, harness loops, agent eval. Tri-agent.
phases: [build, ai-native]
triAgent: true
tryable: true
commands:
  - /oc-agent
  - /oc-agent eval
  - /oc-agent loop
description: >
  Claude Agent SDK build harness with a Planner/Builder/Evaluator loop. Owns
  subagent topology, tool-budget design, harness loop shapes, and agent
  evaluation. Use for /oc-agent, "Claude Agent SDK", "build an agent",
  "subagent", "tool budget", "agent loop", "harness", "multi-agent",
  "agent eval", "orchestrator-worker". Model routing comes from oc-claude-api;
  agent-forge owns topology + harness shape. Trigger liberally on agent work.
governance:
  breaking_change_policy: skills/CHANGELOG.md
  last_reviewed: 2026-06-21
  owner: opchain
  docs:
    - { path: SKILL.md, kind: contract, lifecycle: stable }
---

# Agent Forge

> **WIP — v1.5 Sprint 1 scaffold.** Frontmatter is final; the body lands in
> Sprint 3 (ADEV-347) alongside the reference docs below.

Tri-agent harness (Planner → Builder → Evaluator) for Claude Agent SDK apps:
subagent topology, tool budgets, harness loop design, and agent eval.

## Planned command reference

```
/oc-agent       Scaffold a Claude Agent SDK app
/oc-agent eval  Score an agent against an eval harness
/oc-agent loop  Design / tune the harness loop shape
```

## Planned body (Sprint 3 — ADEV-347)

1. Planner / Builder / Evaluator loop.
2. Agent-topology decision tree — single-agent, orchestrator-worker, pipeline.
3. Tool-budget design — allowlists, call ceilings, deferred-load.
4. Harness loop shapes — react / plan-execute / reflect.
5. Agent eval — task-success scoring against a fixture suite.
6. `oc-claude-api` collaboration — model routing from oc-claude-api's
   model-routing reference; agent-forge owns topology + harness shape.

## Planned reference docs (Sprint 3)

- `references/agent-topology.md`
- `references/tool-budgets.md`
- `references/harness-loops.md`
- `references/agent-eval.md`

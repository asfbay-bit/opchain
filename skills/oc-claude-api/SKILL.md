---
name: oc-claude-api
displayName: OC · Claude API
version: 1.5.0
shortDesc: Build, debug, and migrate Claude API apps — model routing, prompt caching, tool use, version-migration playbooks.
phases: [build, ai-native]
triAgent: false
tryable: true
commands:
  - /oc-claude-api
  - /oc-claude-api migrate
  - /oc-claude-api cache-audit
  - /oc-claude-api tool-use
  - /oc-claude-api cost
description: >
  Build, debug, and optimize Claude API / Anthropic SDK apps. Apps built with
  this skill include prompt caching by default. Also migrates existing Claude
  API code between model versions (4.6 → 4.7, retired-model replacements). Use
  for /oc-claude-api, "Anthropic SDK", "prompt caching", "cache hit rate",
  "tool use", "model migration", "extended thinking", "batch API", "files API",
  "memory", "citations". Trigger liberally on Claude API work.
governance:
  breaking_change_policy: skills/CHANGELOG.md
  last_reviewed: 2026-06-21
  owner: opchain
  docs:
    - { path: SKILL.md, kind: contract, lifecycle: stable }
---

# Claude API

> **WIP — v1.5 Sprint 1 scaffold.** Frontmatter is final; the body lands in
> Sprint 2 (ADEV-346) alongside the reference docs below. This stub exists so
> the catalog, flag registry, and site build are green before body content
> arrives, letting Sprint 2 land the skill in isolation.

First-party harness for building on the Claude API / Anthropic SDK: model
routing, prompt caching, tool use, batch/streaming, and version-migration
playbooks.

## Planned command reference

```
/oc-claude-api               Design / debug a Claude API integration
/oc-claude-api migrate       Migrate code across Claude model versions
/oc-claude-api cache-audit   Check prompt-cache hit rate (target ≥ 60%)
/oc-claude-api tool-use      Schema-first tool-use patterns
/oc-claude-api cost          Token-ceiling + cost guardrails per phase
```

## Planned body (Sprint 2 — ADEV-346)

1. How this skill fits the build pipeline — auto-invoked by `oc-app-architect`
   Phase 2 when discovery says "AI app", "agent", "chatbot", or "Claude in the
   loop".
2. Model-routing decision tree — Opus for spec/audit/migration, Sonnet for
   build/reverse-spec, Haiku for cheap repetitive phases.
3. Prompt caching as default — every reference snippet ships caching;
   cache-audit checks hit rate ≥ 60%.
4. Tool-use patterns — schema-first design, deferred-load (ToolSearch),
   parallel tool calls.
5. Migration playbooks — model-version bumps, retired-model replacement;
   produces a diff PR.
6. Cost guardrails — input/output token ceilings per phase; `oc-cost-ops`
   integration once v1.6 lands.
7. Reference docs — `model-routing.md`, `prompt-caching.md`, `tool-use.md`,
   `migration-playbooks.md` (added in Sprint 2).

## Planned reference docs (Sprint 2)

- `references/model-routing.md`
- `references/prompt-caching.md`
- `references/tool-use.md`
- `references/migration-playbooks.md`

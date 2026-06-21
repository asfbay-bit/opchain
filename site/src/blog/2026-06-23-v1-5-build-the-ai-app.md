---
title: "v1.5 — Build the AI app"
description: "opchain's biggest categorical expansion: four AI-native skills that take an AI feature from idea to shipped, evaluated, and safe."
date: "2026-06-23"
author: opchain
tags: [release, ai-native]
---

Every Claude Code user is, by definition, AI-app-curious — and until now opchain
had zero owners for the part of a project where an LLM is in the loop. v1.5 fixes
that. It adds four AI-native skills and wires them through the pipeline you
already use, so "the AI part" gets the same idea → spec → build → ship → evaluate
treatment as the rest of the app.

## The four new skills

- **[oc-claude-api](/skills/oc-claude-api)** — the request surface. Model routing
  (Opus / Sonnet / Haiku / Fable by task), prompt caching by default, tool-use
  patterns, and version-migration playbooks that produce a diff PR. When you move
  a model version, this skill gates the change.
- **[oc-rag-forge](/skills/oc-rag-forge)** — a tri-agent retrieval harness
  (Designer → Builder → Evaluator). It picks the vector DB, embedding model, and
  chunking strategy, then **scores retrieval against a labelled set** instead of
  eyeballing three queries that happen to work.
- **[oc-agent-forge](/skills/oc-agent-forge)** — a tri-agent build harness for
  Claude Agent SDK apps. It owns topology (single / orchestrator-worker /
  pipeline / hierarchical), tool budgets, and the harness loop — and gates the
  agent on a task fixture suite, so "it worked when I tried it" stops being the
  bar.
- **[oc-prompt-ops](/skills/oc-prompt-ops)** — prompts as code: versioned,
  diffable, and gated on an eval suite the same way application code is gated on
  tests. A prompt change becomes a reviewable diff with a measured score delta.

## The ripples

The new skills don't sit off to the side — they extend what's already there:

- **[oc-stack-forge](/skills/oc-stack-forge)** gained `kind: vector-db` packs:
  pgvector, Pinecone, Turbopuffer, and Supabase Vectors. Picking a vector store
  is now part of the same coverage registry as picking a language or a host.
- **[oc-code-auditor](/skills/oc-code-auditor)** learned an AI-safety pass —
  prompt-injection and tool-use-safety rules that only run when an LLM is in the
  loop. It traces untrusted content into prompts and tool arguments into
  dangerous capabilities.
- **[oc-app-architect](/skills/oc-app-architect)** `/oc-discover` now branches on
  "is this an AI app?" and routes through the four new skills automatically.

## Dogfooding

opchain evaluates itself. The new `prompts/opchain-eval/` set is a routing
goldset — given a dev request, does opchain pick the right skill? — published as
the worked example for `/oc-prompt eval`. We catch our own trigger-copy drift the
same way we'd ask you to catch yours.

The theme of v1.5 is simple: building with AI should be an engineering
discipline, not a vibe. Every new skill makes the AI part of your app an
**evaluated artifact** — measured, versioned, and safe to ship.

Browse the [skill library](/skills) or [install opchain](/install) to start.

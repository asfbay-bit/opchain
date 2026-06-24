---
title: "v1.5 — Build the AI app"
description: "opchain's biggest categorical expansion: four AI-native skills that take the LLM part of your app from idea to shipped, evaluated, and safe."
date: "2026-06-23"
author: opchain
pillar: release
tags: [release, ai-native]
---

Every Claude Code user is, by definition, AI-app-curious. And until v1.5, opchain
had **zero owners** for the part of a project where an LLM is actually in the
loop. You could spec, design, build, audit, ship, and monitor a CRUD app with
opchain — but the moment "and then Claude summarizes it" entered the picture, you
were back to vibes.

v1.5 closes that gap. It adds four AI-native skills and wires them through the
pipeline you already use, so *the AI part* gets the same idea → spec → build →
ship → evaluate treatment as the rest of the app. The theme is one sentence:

> Building with AI should be an engineering discipline, not a vibe.

## The four new skills

Each owns one slice of an LLM feature, and each is built to make that slice a
**measured artifact** instead of a hope.

- **[oc-claude-api](/skills/oc-claude-api)** — the request surface. Model routing
  (Opus / Sonnet / Haiku / Fable by task), prompt caching on by default, tool-use
  patterns, and version-migration playbooks that produce a diff PR. When you move
  a model version, this skill gates the change instead of letting it silently
  drift.
- **[oc-rag-forge](/skills/oc-rag-forge)** — a tri-agent retrieval harness
  (Designer → Builder → Evaluator). It picks the vector DB, embedding model, and
  chunking strategy, then **scores retrieval against a labelled set** instead of
  eyeballing three queries that happen to work.
- **[oc-agent-forge](/skills/oc-agent-forge)** — a tri-agent build harness for
  Claude Agent SDK apps. It owns topology (single / orchestrator-worker /
  pipeline / hierarchical), tool budgets, and the harness loop — and gates the
  agent on a task-fixture suite, so "it worked when I tried it" stops being the
  bar.
- **[oc-prompt-ops](/skills/oc-prompt-ops)** — prompts as code: versioned,
  diffable, and gated on an eval suite the same way application code is gated on
  tests. A prompt change becomes a reviewable diff with a measured score delta.

## The ripples

The new skills don't sit off to the side. They extend what was already there:

- **[oc-stack-forge](/skills/oc-stack-forge)** gained `kind: vector-db` packs:
  pgvector, Pinecone, Turbopuffer, and Supabase Vectors. Picking a vector store
  is now part of the same coverage registry as picking a language or a host.
- **[oc-code-auditor](/skills/oc-code-auditor)** learned an AI-safety pass —
  prompt-injection and tool-use-safety rules that only run when an LLM is in the
  loop. It traces untrusted content into prompts, and tool arguments into
  dangerous capabilities.
- **[oc-app-architect](/skills/oc-app-architect)** `/oc-discover` now branches on
  "is this an AI app?" and routes through the four new skills automatically. You
  don't have to know they exist; the orchestrator does.

## How they chain

The point of a skillchain is that the pieces compose. A typical AI feature now
flows like this:

1. `/oc-discover` detects the AI surface and routes to **oc-claude-api** for model
   routing + caching defaults.
2. If it's retrieval-shaped, **oc-rag-forge** picks the vector DB (via the new
   stack-forge packs) and stands up an eval set.
3. If it's agentic, **oc-agent-forge** designs the topology and tool budget.
4. **oc-prompt-ops** versions every prompt and gates changes on the eval suite.
5. **oc-code-auditor** runs the AI-safety pass before you ship.

No single mega-prompt. Each skill does one job, writes a checkpoint, and hands
off. (For the argument behind that design, see the engineering notes on
[evaluating instead of eyeballing](/blog/2026-06-22-evaluate-dont-eyeball).)

## Dogfooding

opchain evaluates itself. The new `prompts/opchain-eval/` set is a routing
goldset — given a dev request, does opchain pick the right skill? — published as
the worked example for `/oc-prompt eval`. We catch our own trigger-copy drift the
same way we'd ask you to catch yours. The
[honest limits of that dogfooding](/blog/2026-06-21-dogfooding-has-a-stopping-point)
are their own post.

## The through-line

Every skill in this release makes the AI part of your app an **evaluated
artifact** — measured, versioned, and safe to ship. That's the whole bet of
v1.5: the difference between a demo and a product is whether you can prove the AI
part works, and prove it still works after you change it.

Browse the [skill library](/skills) or [install opchain](/install) to start.

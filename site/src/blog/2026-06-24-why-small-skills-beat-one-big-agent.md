---
title: "Why 22 small skills beat one big agent"
description: "The instinct is to build one agent that does everything. The Unix lesson — and opchain's bet — is that a chain of small, single-purpose skills beats the monolith on every axis that matters."
date: "2026-06-24"
author: opchain
pillar: opinion
tags: [opinion, architecture, skillchain]
---

There are two ways to give an AI coding assistant more capability. You can make
one agent bigger — a longer system prompt, more tools, more instructions crammed
into one context — or you can make many small agents that each do one thing well
and hand off to each other. opchain is built entirely on the second answer, and
this post is the argument for why.

It's not a new argument. It's the [Unix
philosophy](/glossary) — *write programs that do one thing and do it well; write
programs to work together* — applied to AI development. That philosophy won the
last fifty years of systems design for reasons that apply with even more force to
LLMs than to C programs.

## The monolith's failure mode is the prompt itself

Picture the "one big agent": a single system prompt that knows how to do
discovery, write specs, choose a stack, design UI, scaffold, build, test, audit,
deploy, and monitor. To make it good at all of those, you write instructions for
all of those. The prompt grows to thousands of lines.

Now every request pays for every instruction. Ask it to fix a CSS bug and it's
still carrying the deploy runbook, the security checklist, and the database
migration rules in its working context — diluting attention, inviting it to
"helpfully" wander into concerns you didn't ask about. The bigger the prompt, the
worse the [attention degrades](/blog/2026-06-24-why-your-ai-coding-agent-forgets):
the instruction that matters for *this* task is buried among forty that don't.

This is the same reason you don't write one 10,000-line function. Not because it
can't work, but because nobody — human or model — can hold it all in focus at
once, and the coupling means a change to any part risks breaking every part.

## Small skills are single-responsibility, and that's the whole point

opchain is 22 skills, and each one owns exactly one slice of the pipeline:

- [oc-stack-forge](/skills/oc-stack-forge) decides the stack. That's all it does.
  It doesn't write code. It web-searches current framework status, walks a
  decision tree, and returns a recommendation.
- [oc-bug-check](/skills/oc-bug-check) is a pre-commit metal detector — type,
  lint, tests, secrets, build — in under two minutes. It has one verdict: pass or
  fail. It doesn't deploy, doesn't design, doesn't opine on architecture.
- [oc-code-auditor](/skills/oc-code-auditor) does the deep, slow quality sweep.
  Different job, different cadence, different skill.

Each skill is small enough to read in one sitting, reason about in isolation, and
improve without fear of breaking the others. When you invoke one, its context is
*only* its job. Fix a CSS bug and you're in [oc-ux-engineer](/skills/oc-ux-engineer),
not wading through the deploy runbook. The focus is the feature.

## "But now I have to know which skill to call"

This is the standard objection to composition, and it has a standard answer:
**a router.** In Unix it's the shell and pipes. In opchain it's
[oc-orchestrator](/skills/oc-orchestrator) plus the [skillchain](/architecture):
you describe what you want, and the orchestrator routes to the right skill and
phase. You don't memorize 22 names. You say "build me a thing" and discovery
fires; you say "ship it" and the deploy pipeline fires.

The skills also chain to each other directly. [oc-app-architect](/skills/oc-app-architect)
auto-invokes oc-stack-forge during its spec phase; oc-git-ops auto-invokes
oc-bug-check before every commit. Composition isn't something you assemble by
hand each time — it's wired into the skills, the way `|` is wired into the shell.
The cost of "which one do I call?" is paid once, by the router, not on every
request.

## What composition buys you that a monolith can't

Three things, and they're the same three that made small Unix tools win:

### 1. You can improve one piece without risking the others

A change to oc-stack-forge's vector-DB decision tree can't break the deploy
pipeline, because they don't share a context or a prompt. In the monolith, every
edit is a global edit — you tune the deploy instructions and the design quality
quietly regresses two prompts over, and you find out in production. Small skills
have small blast radii.

### 2. Each piece can be evaluated on its own

This is the underrated one. You can build a [golden set for skill
routing](/blog/2026-06-22-evaluate-dont-eyeball) and measure whether the right
skill fires for a given request — opchain dogfoods exactly this. You cannot write
that test for a monolith, because there's no seam to test at; "did the right part
of the mega-prompt activate?" isn't an observable. Composition creates the
boundaries that make evaluation possible.

### 3. The pieces survive across sessions

Each skill writes a [checkpoint](/blog/2026-06-24-what-a-checkpoint-actually-contains).
The handoff between skills isn't a fragile in-context memory of "what the design
skill decided" — it's a file the next skill reads. The monolith's state lives and
dies with one context window. The chain's state lives on disk, so the work
survives the session, the teammate switch, and the inevitable reset.

## The honest limit

Composition has a real cost: coordination. A handoff can drop context if the
checkpoint is thin; a router can misroute. The skillchain is only as good as the
checkpoint protocol underneath it and the routing copy that feeds the
orchestrator — which is precisely why opchain treats both as first-class,
versioned, evaluated artifacts rather than afterthoughts. The monolith trades
this coordination cost for a worse one: total coupling. We'll take coordination.

A single agent that does everything is a single point of failure that's hard to
test, hard to improve, and forgets everything when the tab closes. Twenty-two
small skills that each do one thing, hand off through checkpoints, and route
through an orchestrator is just the Unix philosophy, and it wins for the same
reasons it always has.

Browse the [skill library](/skills) to see the pieces, or read
[the architecture](/architecture) for how they chain.

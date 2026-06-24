---
title: "Evaluate, don't eyeball: putting prompts under test"
description: "A strong model will produce a confident answer over broken context — which means answer quality alone lies. The fix is to treat prompts like code: gate them on an eval set."
date: "2026-06-22"
author: opchain
pillar: engineering
series: "Dogfooding opchain"
tags: [eval, prompts, rag, engineering]
---

Here's a failure mode that has cost more debugging hours than any other in the
LLM apps we've shipped: **the model produces a great answer over completely
broken context, and you don't notice for a month.**

You build a retrieval feature. You try five questions. The answers are fluent,
specific, correct. You ship. What you didn't see is that for three of those five
questions, the retrieval returned the wrong documents — and Claude, being strong,
papered over the gap with a plausible answer drawn from its own parametric
knowledge. The retrieval is broken. The output looks fine. The two facts coexist
happily until a user asks something the model *can't* paper over, and now you're
debugging in production with no idea the retrieval layer was the problem all
along.

This is why **eyeballing doesn't work for LLM features**, and why the discipline
that fixes it — treating prompts and retrieval as artifacts under test — is the
backbone of opchain's AI-native skills.

## Why answer quality lies

In ordinary software, the output is a tight function of the logic. Wrong logic →
wrong output, loudly. You see the bug.

LLMs break that contract. A capable model is a powerful error-concealment layer.
Give it bad inputs and it will often still return something good, because it can
fall back on what it already knows. That's wonderful for end users on a good day
and catastrophic for *debugging*, because the signal you'd normally use — "the
output is wrong" — has been suppressed by the very capability you're shipping.

The consequence is blunt: **you cannot evaluate an LLM feature by reading its
answers.** You have to evaluate the *components* — did retrieval return the right
context? did the prompt actually use it? — against a known-good reference, not
against your gut.

## What "under test" means for a prompt

The move is to borrow the thing application code already has and LLM features
usually don't: a test suite that runs on every change and fails loudly on
regression. Concretely, three pieces.

### 1. A golden set

A labelled dataset of inputs paired with what *should* happen. For retrieval:
questions paired with the document(s) that genuinely answer them. For a
classifier prompt: inputs paired with correct labels. For an agent: tasks paired
with the expected end state. It does not need to be huge — 30–50 well-chosen,
genuinely-hard cases beat 1,000 easy ones — but it needs to be *real*, drawn from
the actual distribution you'll see, not invented to pass.

### 2. Component metrics, not vibes

For RAG specifically, two metrics catch the "confident answer over broken
context" failure that answer-grading misses:

- **Context recall** — of the documents that *should* have been retrieved, how
  many were? This catches retrieval misses directly, before generation can hide
  them.
- **Faithfulness** — is the answer actually grounded in the retrieved context, or
  did the model wander off into its own knowledge? A faithful answer over
  *recalled* context is the thing you actually want; a faithful answer over empty
  context is the trap.

[oc-rag-forge](/skills/oc-rag-forge) makes both first-class precisely because
answer quality alone can't see them.

### 3. A gate

The suite runs on every prompt change and reports a **score delta**. A change that
improves answers on your five favorite questions but drops context recall 12% across
the golden set is a regression — and the gate says so, in a number, in the diff.
[oc-prompt-ops](/skills/oc-prompt-ops) treats prompts exactly like code here:
versioned, diffable, and gated, so "I tweaked the prompt and it feels better"
becomes "this version scores 0.84 vs 0.79, here's the diff."

## A prompt change is a diff with a measured delta

The payoff is that prompt engineering stops being a craft you do by feel and
becomes an engineering loop you can trust:

1. Change the prompt (or the chunking, or the model).
2. Run the eval suite against the golden set.
3. Read the score delta. Up → keep it. Down → you just caught a regression that
   eyeballing would have shipped.

That's the same loop as `git diff` + `npm test`, applied to the
non-deterministic part of your stack. The non-determinism is exactly *why* you
need it: you can't reason your way to whether a prompt change helped, because the
model's behavior isn't a closed-form function of the prompt. You have to measure.

## We dogfood this on opchain itself

This isn't advice we hold at arm's length. opchain's own skill-routing is gated
on a golden set: `prompts/opchain-eval/` is a labelled collection of dev requests
paired with the skill that *should* fire. When we edit a skill's trigger copy —
the description that tells Claude when to invoke it — we run that set and read the
delta, because trigger copy is a prompt, and prompts drift. We catch our own
routing regressions the same way we're asking you to catch yours. (Where that
dogfooding genuinely stops is its
[own honest post](/blog/2026-06-21-dogfooding-has-a-stopping-point).)

## The takeaway

A strong model is an error-concealment machine. That's a feature for your users
and a hazard for your debugging, and the only durable defense is to stop trusting
the answer and start measuring the components. Build the golden set. Pick metrics
that see past the fluent output. Gate every change on the delta.

Eyeball it, and the day it breaks for real is the day you start building the eval
set you should have built first. Start with the
[AI recipes](/ai-recipes), or read how
[oc-prompt-ops](/skills/oc-prompt-ops) turns a prompt into a tested artifact.

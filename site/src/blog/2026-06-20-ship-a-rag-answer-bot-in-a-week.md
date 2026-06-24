---
title: "Ship a RAG answer bot in a week with opchain"
description: "An end-to-end, day-by-day build of a docs answer bot — stack decision, retrieval eval, deploy — narrated with the real calls opchain makes at each step."
date: "2026-06-20"
author: opchain
pillar: playbook
tags: [playbook, rag, tutorial, cloudflare]
---

This is a narrated build, not a reference card. The goal: a question-answering bot
over a product's documentation — type a question, get an answer grounded in the
docs, with citations — shipped to production in about a week of real (part-time)
work. We'll walk the actual decisions opchain makes at each step, including the
ones where the right move is *not* the flashy one.

If you want the terse version, the [AI recipes](/ai-recipes) page has it as a
card. This is the long version, with the reasoning left in.

## The brief

- **Input:** ~400 Markdown docs for a developer tool.
- **Output:** a `/ask` endpoint and a small chat UI. Answer + cited source links.
- **Constraints:** cheap to run, no separate infra team, must not confidently
  make things up.
- **Definition of done:** on a 40-question golden set, context recall ≥ 0.85 and
  zero unfaithful answers (no claims ungrounded in retrieved docs).

That last line is the whole game. "Looks good when I try it" is not the bar —
see [why answer quality lies](/blog/2026-06-22-evaluate-dont-eyeball).

## Day 1 — Discovery and stack

Start with `/oc-discover`. It detects the AI surface ("answer questions over our
docs", "cite sources") and branches to the AI-native skills automatically, then
hands the platform question to [oc-stack-forge](/skills/oc-stack-forge).

The stack decision, walked honestly:

- **Host:** Cloudflare Workers. The docs site is already static; an edge Worker
  for `/ask` keeps everything in one place and one bill.
- **Vector DB:** this is where people over-build. 400 docs, chunked, is a few
  thousand vectors. oc-stack-forge's `kind: vector-db` pack walks the tree and
  lands on **pgvector** (or Supabase Vectors if you want it managed) — *not*
  Pinecone. At this scale a dedicated vector service is latency and cost for no
  recall benefit. The decision tree says reach for managed scale when you have
  millions of vectors, not thousands.
- **Model:** [oc-claude-api](/skills/oc-claude-api) routes generation to Sonnet
  (fast, cheap, more than strong enough for grounded Q&A) and reserves Opus for
  nothing here — there's no task that needs it. Prompt caching on by default,
  because the system prompt and doc context repeat across requests.

Output of day 1: a spec, a stack with rationale, and a cost estimate that fits in
pocket change per month.

## Day 2 — Chunking and the first index

Now [oc-rag-forge](/skills/oc-rag-forge)'s Designer phase. The decisions that
actually move recall:

- **Chunk on structure, not character count.** Markdown has headings; split on
  them. A chunk that respects a `##` section keeps a coherent idea together. Blind
  512-character windows slice sentences in half and tank recall.
- **Embed with a current small model.** You don't need the largest embedding
  model for 400 docs; you need a good one with a sane dimension count so pgvector
  stays fast.
- **Keep the source path on every chunk.** Citations are a product requirement,
  not an afterthought — store the doc path and heading anchor in metadata at index
  time or you'll be reverse-engineering them later.

End of day 2 you have an index and a naive `/ask` that returns *something*. It
will look like it works. Do not believe it yet.

## Day 3 — Build the golden set (the day people skip)

This is the day that separates a demo from a product, and it's the one everyone is
tempted to skip because it feels like overhead. Don't.

Write 40 real questions — pulled from actual support tickets, forum posts, and the
"how do I…" searches your docs already get. For each, label the document(s) that
genuinely answer it. Include the hard ones: questions whose answer spans two docs,
questions with a tempting-but-wrong near-match, questions your docs *don't* answer
(the bot should say so, not invent).

Forty real, hard cases beat a thousand easy invented ones. This set is now your
regression suite for the rest of the build.

## Day 4 — Evaluate, then fix what the numbers show

Run [oc-rag-forge](/skills/oc-rag-forge)'s Evaluator against the golden set. The
first run is humbling and that's the point — it tells you the truth your eyeballs
couldn't:

- **Context recall 0.72.** Below target. Inspect the misses: usually a chunking
  problem (the right text got split) or a retrieval-`k` that's too low. Bump `k`,
  fix the chunk boundaries, re-run.
- **Faithfulness has two failures.** Two answers made claims not in the retrieved
  context — the model filled gaps from training. Tighten the prompt to "answer
  *only* from the provided context; if it's not there, say you don't know," and
  re-run.

Iterate against the number, not the vibe. By end of day you're at recall 0.87,
zero unfaithful answers. Now the "looks good" actually means something, because
you measured the thing that fluent output was hiding.

## Day 5 — The UI and the citations

A small chat surface: input, streamed answer, and the cited sources as links back
into the docs. Stream the response (Workers supports it) so it feels fast.
Citations come straight from the chunk metadata you stored on day 2 — render the
source path + heading as a link. This is also the natural point to run
[oc-code-auditor](/skills/oc-code-auditor)'s AI-safety pass: it traces untrusted
input (the user's question) into the prompt and flags prompt-injection exposure
before you ship.

## Day 6 — Ship it

Hand off to [oc-deploy-ops](/skills/oc-deploy-ops): audit gate → staging →
smoke-test the golden set against the deployed endpoint → production. Because the
eval suite is automated, your staging smoke test is *the same golden set* —
you're not eyeballing the deploy either. Wire a health check, set the rate limit
and CORS, done.

## What made it a week instead of a month

Three things, and none of them is the model:

1. **The stack decision didn't spiral.** pgvector over Pinecone saved a day of
   integrating infra you didn't need. The skill said "don't," and not-building is
   the fastest build.
2. **The golden set caught the retrieval bug on day 4** instead of in a production
   incident in week 6. That's the single highest-leverage day in the whole plan.
3. **Every gate was a number.** Discovery → spec → eval → deploy, each step had a
   checkpoint and a measurable definition of done, so nothing got relitigated and
   nothing shipped on a hunch.

That's the opchain bet applied to RAG: make the AI part an
[evaluated artifact](/blog/2026-06-22-evaluate-dont-eyeball), and a week is
enough. [Install opchain](/install) and run `/oc-discover` on your own docs to
start, or browse the [skill library](/skills) first.

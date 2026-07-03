---
title: "What building opchain with opchain cost"
description: "We pointed oc-cost-ops at our own Claude Code history and priced every phase of building opchain. The receipts, the model mix, and where caching pays."
date: "2026-06-27"
author: opchain
pillar: engineering
series: "Dogfooding opchain"
tags: [engineering, dogfooding, cost, claude-code]
updated: "2026-06-28"
---

> **Correction (June 28):** the headline number in this post is wrong by
> roughly **13×**. The methodology bug — counting each message once per
> transcript line instead of once per message — is dissected in
> [the follow-up post](/blog/2026-06-28-our-cost-report-was-wrong-by-13x).
> We've annotated this post rather than rewriting it, because publishing the
> mistake honestly is the whole point of this series. Corrected figures
> appear inline, struck-through next to the originals.

Two days ago, [v1.6](/blog/2026-06-25-v1-6-the-instrumented-pipeline) shipped
cost attribution. There is exactly one honest first test subject for a tool
like that: ourselves. So we pointed
[oc-cost-ops](/skills/oc-cost-ops) at the full local Claude Code history for
this repo — every session, every model call, every cache hit since the repo
was extracted — and priced the construction of opchain, with opchain.

This post is the receipts. It's also, as of June 28, a live demonstration of
why [oc-signal-forge](/skills/oc-signal-forge) exists, but we didn't know
that yet when we hit publish.

## Method

Claude Code keeps a local transcript of every session as JSONL — one
directory per project, one file per session, one line per event. Each
assistant message carries a `usage` block: input tokens, output tokens, cache
reads, cache writes, and the model that served it. The report walks every
line, sums the usage, prices it against the current per-model rate card, and
attributes each session to a skill phase by joining timestamps against the
`.checkpoints/` history. No sampling, no estimates — the whole ledger,
priced.

If that sounds tidy, know that your own transcript directory is the
sketchiest data lake you will ever ETL. The format is undocumented and
version-drifted, sessions from abandoned worktrees linger like ghosts, and
nothing in the file promises you the invariants you'll assume anyway. Hold
that thought.

## The headline number

Building opchain — 27 skills, this site, the Worker, the whole pipeline —
cost ~~**$937.41**~~ → **$71.73** in API spend.

The corrected number deserves a beat of appreciation: roughly the price of a
mid-tier office chair, for a system that plans, builds, audits, ships, and
monitors software. The original number implied we'd bought the whole office.

## Where it went

The phase attribution (shares as originally computed; the correction shifted
them slightly but didn't change the ordering):

- **The build loop dominates** — roughly 60% of spend. Generator rounds are
  the bulk; evaluator rounds run about a third of a generator round and are
  the best money in the whole budget, because a failed evaluation is a sprint
  that didn't ship broken.
- **Audits** — around 15%. `/oc-audit` sweeps are Opus-heavy by design;
  judgment is the product.
- **Spec and design** — around 10%. Cheap, front-loaded, and the highest
  leverage per dollar. A spec-phase dollar routinely saves a build-phase ten.
- **Everything else** — git ops, deploys, checkpoints, orchestration — noise.
  Single-digit percent. The plumbing phases run on Haiku-class routing and it
  shows, in a good way.

## Caching is the whole ballgame

The single biggest lever in the ledger isn't the model mix — it's that
[oc-claude-api](/skills/oc-claude-api) turns prompt caching on by default.
Cache reads price at a tenth of fresh input, and an agentic session is
*mostly* re-reading its own context: skill files, specs, the conversation so
far. Our hit rates ran high enough that the effective input price for long
build sessions was closer to the cache rate than the list rate. If you build
with agents and haven't audited your caching, that — not model choice — is
your first dollar.

## What we do with the numbers

Attribution without action is a scrapbook. The follow-ups, now that the
ledger exists:

1. **Budget gates per phase**, set from measured baselines instead of guesses
   — the checkpoint's `cost` field makes an over-budget phase fail loudly.
2. **Model-tier routing review** — anywhere Opus is doing Haiku work, the
   router gets corrected.
3. **A cost-regression gate** beside the eval gate, so a prompt "improvement"
   that triples spend gets caught in review, not on the invoice.

## The seam

We'll say it before you do: a cost report built by parsing undocumented local
transcript files is exactly the kind of artifact that should face hostile
review before anyone believes it. We gave it a friendly one. The number above
wore a strikethrough within 24 hours, and the
[follow-up post](/blog/2026-06-28-our-cost-report-was-wrong-by-13x) is the
full autopsy — join keys, plausibility checks, and the precise way a
confident chart lies.

Run `/oc-cost` on your own pipeline ([install](/install) first if needed), or
see the aggregate picture on the [dashboard](/dashboard).

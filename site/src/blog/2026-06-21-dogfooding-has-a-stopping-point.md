---
title: "Dogfooding has a stopping point"
description: "Eating your own cooking is a quality signal, not a purity test. Where building opchain with opchain is real — and where forcing it would be theater."
date: "2026-06-21"
author: opchain
pillar: engineering
series: "Dogfooding opchain"
tags: [engineering, dogfooding, rag]
---

The clean marketing story is "we built [oc-rag-forge](/skills/oc-rag-forge) by
using oc-rag-forge." The honest version is more useful, so here it is — along
with the general principle it taught us, which is the real subject of this post.

Dogfooding is treated as a binary virtue: either you use your own product for
everything, or you're a hypocrite. That framing is wrong, and following it
literally makes worse software. The useful question is never *"are we using our
own tool?"* It's *"would we make this exact call for a paying client?"* Sometimes
the answer is yes, and dogfooding is a genuine quality signal. Sometimes it's no,
and forcing it would be theater. Knowing the difference is the skill.

## A methodology skill can't "run on itself" literally

oc-rag-forge is a *methodology* skill — a tri-agent harness (Designer → Builder →
Evaluator) plus reference docs on vector DBs, embeddings, chunking, and retrieval
eval. It doesn't ship a running RAG service; it ships the **decisions** and the
**eval discipline** for building one.

So "using it to build itself" can't mean indexing a corpus and querying it. There
is no corpus. The corpus *is* the methodology. If we'd jammed a vector index over
our own docs and called it "rag-forge running on rag-forge," that would have been
a screenshot for a tweet, not engineering.

## Where the recursion is actually real

Drop the literal reading and the dogfooding is everywhere that matters:

- **The decision trees came from real builds.** The vector-DB tree — `pgvector`
  for small-and-already-on-Postgres, `pinecone` for managed scale, `turbopuffer`
  for object-storage economics, `supabase-vectors` for the Supabase stack — is
  the same one we'd walk on a client RAG app. We wrote it down as a skill so we'd
  stop re-deriving it from scratch every engagement.
- **"Evaluate, don't eyeball" is the whole point.** The single most common RAG
  failure we've seen is a strong model (Claude) producing a confident answer over
  *wrong or empty* retrieved context — the generation hides the retrieval bug.
  oc-rag-forge makes **faithfulness** and **context recall** first-class metrics
  precisely because answer quality alone lies. We learned that the hard way on
  real systems, and the skill encodes the lesson. (That principle has its own
  [longer treatment](/blog/2026-06-22-evaluate-dont-eyeball).)

That's recursion in the sense that counts: the skill is the distilled output of
doing the work for real, not a costume.

## Where the dogfooding stops — and that's correct

oc-rag-forge's own reference docs are **not** served through a retrieval
pipeline. They're Markdown the model reads directly. We could have built a RAG
index over opchain's docs and branded it as self-hosting. We didn't, because the
skill's own decision tree says **don't reach for a vector DB when a direct read
wins** — and a 30-file doc set is exactly that case. Retrieval would add latency
and new failure modes for zero recall benefit.

So honoring the skill's own advice *is* the dogfooding here — even though it means
not using the flashy part. The most faithful way to eat your own cooking was to
follow the recipe that says "you don't need this ingredient."

## The general rule

This generalizes past RAG. Across the whole opchain suite we apply one test
before claiming we dogfood something:

> Would we make this call for a client who's paying us to ship, not to look
> consistent?

- For the decision trees, the eval discipline, the checkpoint protocol — **yes,
  every time.** We use them on real work, so we use them on ourselves.
- For forcing a vector DB onto a tiny doc set, or standing up an agent where a
  single function call would do — **no**, and the skills themselves tell you why.

Dogfooding that overrides good judgment isn't rigor. It's marketing wearing an
engineering costume. The version worth doing is the one where your own tools are
good enough that using them is simply the right call — and honest enough to tell
you when they aren't.

Next in this series: [evaluate, don't eyeball](/blog/2026-06-22-evaluate-dont-eyeball)
— the eval discipline that the "answer quality lies" point above is built on.
Or build something now: the [AI recipes](/ai-recipes) walk three multi-skill
flows end to end, including shipping a RAG app in a week.

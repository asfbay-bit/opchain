---
title: "Building rag-forge with rag-forge (sort of)"
description: "An honest note on the dogfooding tension: how we designed the RAG skill, and where eating our own cooking actually stops."
date: "2026-06-23"
author: opchain
tags: [ai-native, engineering]
---

The clean marketing story is "we built [oc-rag-forge](/skills/oc-rag-forge) by
using oc-rag-forge." The honest version is more useful, so here it is.

## What dogfooding actually meant here

oc-rag-forge is a methodology skill — a tri-agent harness (Designer → Builder →
Evaluator) plus reference docs on vector DBs, embeddings, chunking, and
retrieval eval. It doesn't ship a running RAG service; it ships the *decisions*
and the *eval discipline* for building one. So "using it to build itself" can't
mean indexing a corpus and querying it. The corpus *is* the methodology.

Where the recursion is real:

- **The decision trees came from real builds.** The vector-DB tree
  (`pgvector` for small + already-on-Postgres, `pinecone` for managed scale,
  `turbopuffer` for object-storage economics, `supabase-vectors` for the Supabase
  stack) is the same one we'd walk on a client RAG app. We wrote it as the skill
  so we'd stop re-deriving it.
- **"Evaluate, don't eyeball" is the whole point.** The single most common RAG
  failure we've seen is a strong model (Claude) producing a confident answer over
  *wrong or empty* retrieved context — the generation hides the retrieval bug.
  oc-rag-forge makes **faithfulness** and **context recall** first-class metrics
  precisely because answer quality alone lies.

## Where the dogfooding stops (and that's fine)

oc-rag-forge's own reference docs are not themselves served through a retrieval
pipeline — they're Markdown the model reads directly. We could have built a RAG
index over opchain's docs and called it "rag-forge running on rag-forge," but it
would have been theater: the docs are small enough that retrieval adds latency
and failure modes for no recall benefit. The skill's own
[vector-DB decision tree](/skills/oc-rag-forge) says don't reach for a vector DB
when a direct read wins — so honoring that *is* dogfooding, even though it means
not using the flashy part.

## The takeaway

Dogfooding is a quality signal, not a purity test. The useful version is: would
you make the same call for a client? For the decision trees and the eval
discipline — yes, every time. For forcing a vector DB onto a 30-file doc set —
no, and the skill itself tells you why.

Build something with it: the [AI recipes](/ai-recipes) walk three multi-skill
flows end to end, including shipping a RAG app in a week.

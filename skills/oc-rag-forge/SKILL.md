---
name: oc-rag-forge
displayName: OC · RAG Forge
version: 1.5.0
shortDesc: Design and build RAG systems — vector DB choice, embeddings, chunking, hybrid search, retrieval eval. Tri-agent.
phases: [build, ai-native]
triAgent: true
tryable: true
commands:
  - /oc-rag
  - /oc-rag eval
  - /oc-rag bench
description: >
  Retrieval-augmented generation harness with a Designer/Builder/Evaluator
  loop. Owns vector DB selection (pgvector, Turbopuffer, Pinecone, Supabase
  Vectors), embedding-model choice, chunking strategy, hybrid search, and
  retrieval evaluation. Use for /oc-rag, "RAG", "vector database", "embeddings",
  "chunking", "semantic search", "hybrid search", "retrieval eval", "reranking",
  "knowledge base". Trigger liberally on retrieval / RAG work.
governance:
  breaking_change_policy: skills/CHANGELOG.md
  last_reviewed: 2026-06-21
  owner: opchain
  docs:
    - { path: SKILL.md, kind: contract, lifecycle: stable }
---

# RAG Forge

> **WIP — v1.5 Sprint 1 scaffold.** Frontmatter is final; the body lands in
> Sprint 2 (ADEV-346) alongside the reference docs and the four new
> `oc-stack-forge` vector-DB packs.

Tri-agent harness (Designer → Builder → Evaluator) for retrieval-augmented
generation: vector-DB selection, embedding choice, chunking, hybrid search,
and retrieval eval.

## Planned command reference

```
/oc-rag        Design a RAG system end-to-end
/oc-rag eval   Score retrieval quality against a labelled set
/oc-rag bench  Benchmark vector-DB / embedding choices
```

## Planned body (Sprint 2 — ADEV-346)

1. Designer / Builder / Evaluator loop.
2. Vector-DB decision tree — pgvector, Turbopuffer, Pinecone, Supabase Vectors
   (flows through the v1.4 `oc-stack-forge` pack registry).
3. Embedding-model decision tree.
4. Chunking strategies.
5. Hybrid search + reranking.
6. Retrieval eval — precision/recall against a labelled set.

## Planned reference docs (Sprint 2)

- `references/vector-db-decision.md`
- `references/embedding-models.md`
- `references/chunking-strategies.md`
- `references/retrieval-eval.md`

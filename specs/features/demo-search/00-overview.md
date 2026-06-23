# 00 · Project Overview — Demo Workbench Search & Filter

> Feature spec. Scoped enhancement to the existing `/demo` surface, not a
> new project. Master project spec lives in `specs/spec/`; this directory
> (`specs/features/demo-search/`) holds only the docs for this feature.

## Problem

The `/demo` workbench is opchain's richest proof surface — **12 curated
walkthroughs**, hundreds of transcript steps, dozens of expandable
artifacts (specs, runbooks, audit reports, PR lists). But the corpus is
**unnavigable**:

- No way to ask "where does `oc-rag-forge` actually fire?" or "show me
  every audit-gate moment across all demos."
- No full-text search — a visitor who remembers "the rollback bit" has to
  re-read scenarios start to finish to find it.
- The activity-rail `⌕` (Search) and `●` (Skills) icons are **decorative**
  — they look interactive but do nothing.
- No deep links: you cannot share or bookmark a specific exchange, and
  `/skills/<id>` pages cannot point at the moment that skill is exercised.

The global ⌘K `SearchPalette` does **not** help — it indexes pages, skills,
and actions only; it has no knowledge that the scenarios or their
transcripts exist.

## Pitch

A **workbench-scoped Search & Filter layer**: deep full-text search across
every exchange, beat, and artifact body, with four facets (skill · role ·
artifact-kind · pipeline-phase). Search hits **jump to the exact exchange**,
and all search/filter state is **shareable via the URL**. Turns a static,
read-it-all replay into a navigable, linkable corpus.

## Personas

| Persona | Goal | What this unlocks |
|---|---|---|
| **Evaluator** (dev assessing opchain) | "Does opchain handle *my* situation — Postgres migration? Stripe? security hardening?" | Search/facet straight to the relevant scenario + step instead of reading 12 transcripts. |
| **Champion / seller** (links a prospect) | Send a teammate the *exact* proof-point. | Copy a deep link to the precise exchange (`/demo?...#scenario:step`). |
| **Skill-page visitor** | "Show me this skill in action." | `/skills/<id>` can deep-link into the demo where that skill fires. |
| **Agent / crawler** | Addressable, stable deep links into demo content. | URL-encoded state + per-step anchors are linkable and indexable. |

## Anti-goals (explicitly out of scope)

- **No live LLM / no server round-trip.** Static SSG; the removed email-gated
  Try-It path (`/api/try/*`, now 410) is **not** revived.
- **Not folded into the global ⌘K palette.** Stays workbench-local. (A
  future cross-link from ⌘K → "jump to scenario" is possible but not in this
  feature.)
- **No new runtime dependency** unless search quality demonstrably requires
  it (see `01-tech-stack.md`).
- **No re-authoring transcript prose.** We add structured tags (`phase`) and
  a normalized artifact-kind map; we do not rewrite the 12 scenarios' copy.

## Success metrics

1. **Functional:** every one of the 12 scenarios, all their steps, and all
   artifact bodies are searchable; all four facets filter correctly;
   AND-across-facet-types / OR-within-a-facet semantics hold.
2. **Deep-link integrity:** a shared URL (query + hash) reproduces the exact
   filter state and lands pre-scrolled + flashed on the target exchange, on
   both desktop and mobile.
3. **Performance:** filtering stays under one frame (~16 ms) per keystroke on
   the full corpus; the generated index adds a bounded, budgeted payload
   (target ≤ ~120 KB gzipped — verified in CI, see testing).
4. **No regressions:** existing playback (`↵`/`␣`/`R`), the output lightbox,
   fullscreen, and the welcome popup all keep working; LHCI + Axe budgets on
   `/demo` stay green.
5. **Adoption signal (post-launch):** PostHog (consent-gated) shows non-zero
   search/facet/deep-link usage on `/demo`.

## Scope summary

**In:** data-model `phase` tags (12 scenarios) · artifact-kind normalization ·
build-time search index · client search + 4 facets · jump-to-exchange ·
URL/hash state · activity-rail wiring · full desktop + mobile UI · all four
UI states (empty/loading/error/results) · tests (unit + e2e + a11y) ·
consent-gated analytics.

**Out:** live runs, server search API, ⌘K integration, transcript re-writes,
new scenarios.

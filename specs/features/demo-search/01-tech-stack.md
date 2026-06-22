# 01 · Tech Stack — Demo Workbench Search & Filter

## Inherited stack (validated, not re-decided)

This feature sits entirely inside opchain's established stack. oc-stack-forge
was consulted to **validate**, not re-interview — there is no new platform,
database, auth, or hosting decision:

| Layer | Choice | Note |
|---|---|---|
| Site framework | **Astro 5, static mode** | Pages SSG'd at build; served by the Worker `ASSETS` binding. |
| Runtime on the page | **Vanilla TS + inline `<script>`** | No React/Vue/Svelte on `/demo`. Matches `DesktopWorkbench` / `MobileWorkbench` / `SearchPalette`. |
| Styling | **Component-scoped `<style>` + design tokens** | No CSS modules, no preprocessor (per CLAUDE.md). |
| Data | **TS modules in `site/src/data/walkthroughs/`** | The 12 scenarios; the source of truth the index is built from. |
| Build hooks | **`scripts/*.mjs` + `astro build`** | Same place `gen-flags`, `gen-skills-catalog`, `sync-docs` live. |
| Hosting | **Cloudflare Worker (`opchain-dev`)** | Manual `wrangler deploy`. Unchanged. |

## The one open decision: search engine

**Decision: hand-rolled build-time index + client-side ranked filter. Zero
new runtime dependencies.**

### Rationale

- **Corpus is moderate and fully known at build time.** 12 scenarios,
  order-of-hundreds of steps, dozens of artifacts. A precomputed token index
  + per-keystroke scan filters comfortably under a frame — the existing ⌘K
  palette already hand-rolls substring filtering, and this is the same class
  of problem with weighting added.
- **Project ethos is explicitly dependency-conscious.** Dependabot, a
  `/security` posture page, and a documented "styles inline, no extra
  tooling" stance. Adding a search lib to a static marketing site is hard to
  justify when the index is ours and tiny.
- **Determinism + zero supply-chain surface.** The index is generated from
  our own data; nothing fetched, nothing to CVE-patch.

### What "hand-rolled" means here

- A build-time module/script emits a **flat, pre-tokenized index** (see
  `02-architecture.md` for the schema).
- Client ranking is **field-weighted** (title/skill > beat label > exchange
  text > artifact body) with simple substring/token matching and match-count
  scoring. Not fuzzy/typo-tolerant in v1 (documented limitation).

### Alternative considered — and the tripwire to revisit it

**MiniSearch** (~tiny, zero-dep, good BM25-ish ranking + prefix/fuzzy). We do
**not** adopt it now. Revisit only if a real tripwire fires:

> If, in design/build QA, hand-rolled ranking produces visibly poor result
> ordering OR users need typo-tolerance/prefix search, swap the client
> ranker for MiniSearch behind the same index schema. The index format is
> designed to be engine-agnostic so this is a localized change, not a
> rewrite.

## New dependencies

**None at runtime.** Dev-only: none beyond what's already present (Vitest,
Playwright, Astro). The phase-tagging and kind-normalization are pure data +
TS.

## Feature-flag posture

Gate the whole capability behind a new flag so it can ship dark and flip on
without a redeploy, consistent with the registry pattern:

- `site.feature.demo-search` (boolean, default decided at design; owner: site).
  When false, the workbench renders exactly as today (no search/facet UI, no
  index inlined). Wired via `src/lib/flags/registry.js` → mirrored to the
  site. (Confirm the precise name + default at the spec gate.)

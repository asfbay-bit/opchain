# 06 · Testing — Demo Workbench Search & Filter

Test stack is the repo's existing one: **Vitest** (unit) + **Playwright**
(e2e) + **Axe** (a11y, via `@axe-core/playwright`) + **LHCI** (budgets on PR
builds). No new test tooling.

## Unit (Vitest)

`site/src/lib/demo-search/` is pure functions → high-value, fast unit tests.

| Suite | Asserts |
|---|---|
| `kinds.test.ts` | **Every distinct `Artifact.kind` across all 12 scenarios maps to a non-`"other"` canonical kind** (or is explicitly allow-listed). Fails when a new artifact introduces an unmapped kind. |
| `index-build.test.ts` | Index has all 12 scenarios; step counts match source; **every beat has a `phase`** (build-assertion mirror); exchanges inherit the nearest preceding beat's phase; artifact bodies are indexed against their referencing step; step ids are `s{n}` and unique per scenario. |
| `ranking.test.ts` | Field weighting (title/skill > beat > exchange > artifact); match-count scoring; stable tie-break by scenario order then step index; case-insensitive. |
| `url-state.test.ts` | Round-trips `q`/`skill`/`role`/`kind`/`phase`/hash ↔ state; comma-lists parse to OR-within-facet; unknown facet values are dropped (not thrown); hash `scenario:s{n}` parses; malformed input degrades to empty state. |
| `filter.test.ts` | AND-across-facet-types, OR-within-a-facet; query AND-ed on top; empty state returns full corpus. |

**Index size budget:** a test asserts the serialized index is **≤ ~120 KB
gzipped** (guards against the inline `<script>` bloating `/demo`). Number
confirmed against the real corpus during build; treat as a tripwire, not a
guess.

## E2E (Playwright) — `site/tests/` (or repo `tests/e2e`, matching current layout)

Run against the built static site (same as existing demo e2e).

1. **Search happy path:** open `/demo`, click `⌕`, type `rollback` → result
   list shows ≥1 hit with `<mark>` highlight; clicking a result opens the
   transcript at that step (step visible, flashed).
2. **Facet filter:** open `●`, toggle skill `oc-deploy-ops` → scenario/result
   list narrows; add role `audit-gate` → narrows further (AND); counts update;
   clearing restores.
3. **Multi-select within facet:** `skill=oc-git-ops` + `skill=oc-deploy-ops`
   → union (OR) of both.
4. **Deep-link land (cold):** navigate **directly** to
   `/demo?skill=oc-deploy-ops&q=rollback#runtime-pm-loop:s12` → filters
   pre-applied, correct scenario open in transcript mode, target step scrolled
   into view + flashed.
5. **Invalid deep-link:** `#nonexistent:s999` → scenario summary opens, no
   crash, graceful notice.
6. **URL reflects state:** typing a query / toggling facets updates the URL
   (replaceState); reload reproduces the view; back/forward (`popstate`) works.
7. **Mobile parity:** repeat (1), (2), (4) at 375px against `MobileWorkbench`
   — search tab + facet sheet + deep-link landing all work.
8. **No regression:** playback (`↵` reveal-next, `␣` reveal-all, `R` restart),
   output lightbox + its TOC, fullscreen, and the welcome popup still behave.
9. **Flag off:** with `site.feature.demo-search` disabled, `/demo` renders the
   classic workbench — no search/facet UI, no index script, no console errors.

## Accessibility (Axe + manual)

- Activity-rail tabs are real buttons with `aria-selected`/`aria-pressed`;
  facet chips are buttons with `aria-pressed`; result list is a keyboard-
  navigable listbox (↑/↓/↵, focus-visible rings using existing tokens).
- Axe scan of `/demo` with the search panel open and a facet active → no new
  violations.
- The ember-flash on deep-link respects `prefers-reduced-motion` (static tint
  fallback, already implemented for the lightbox TOC flash).
- Color: `<mark>` highlight and any new badges meet AA in **both** themes
  (the repo has a contrast-audit doc; reuse those tokens).

## Performance / budgets

- LHCI budgets on `/demo` stay green (the inline index is the main weight —
  the ≤120 KB gz budget protects this).
- Manual: per-keystroke filter < ~16 ms on the full corpus (devtools perf).

## Definition of done (testable)

- [ ] All unit suites pass; kind-coverage + per-beat-phase assertions enforced.
- [ ] All 9 e2e specs pass on desktop + the mobile subset.
- [ ] Axe: no new violations; reduced-motion honored.
- [ ] Index ≤ budget; LHCI green; `astro check` clean; full `npm test` green.
- [ ] Flag-off path renders the unchanged classic workbench.

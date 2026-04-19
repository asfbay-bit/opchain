# Post-Launch — opchain.dev after Sprint 6

The 7-sprint redesign roadmap (`00-approach.md` → `02-sprint-plan.md`) shipped
on 2026-04-17 with commit `012f322` ("Sprint 6: cutover to Astro site"). This
document tracks work that happened **after** that cutover plus the debt that
the original roadmap did not fully close.

Written during the `/app-architect` evaluation pass on 2026-04-19.

---

## What shipped between Sprint 6 and today

All merged to `main`, live on `opchain.dev`:

| Commit | Topic | Status |
|---|---|---|
| `812bbcd` | CI cleanup — drop dead `public/skills.js` generation | ✅ |
| `8947ad1` | CI fix — staging URL fallback so smoke test never skips silently | ✅ |
| `1818c4a` | SVG pipeline diagram + In Action walkthroughs | ✅ |
| `6e7f7b8` | In-Action — stop scenario-card Enter/Space leaking; flip audit arrow | ✅ |
| `ff14d15` | In-Action — expand 4 scenarios with taglines + artifacts | ✅ |
| `37a274d` / `1818c4a` / `17a15eb` / `33127d7` / `bff322a` / `a026107` / `d16df64` | In-Action page: copy, card collapse, full-width detail, dark chat canvas, inline artifacts, JSON projection | ✅ |
| `a712d5c` | Content audit pass 1 — skill count, homepage framing, SKILL.md context | ✅ |
| `c18e9ff` | Fix: anchor `#usage` to section and merge `.prose` CSS | ✅ |

**New surface area not in the original roadmap:**
- `/in-action` page (`site/src/pages/in-action.astro`, 37 KB) — 4 walkthrough scenarios with inline artifact chips and a dark chat canvas.
- Pipeline diagram component (`site/src/components/PipelineDiagram.astro`) — static SVG, referenced from `/architecture` and `/in-action`.
- `docs/analytics.md` — the PostHog dashboard documentation called for in Sprint 6 L296 (landed quietly, no dedicated commit).

**Content-audit gap closed:** the "stub" framing across homepage, skill detail pages, and install flows has been replaced with shipped-product copy. Skill count (10) and pipeline framing are consistent across `/`, `/skills`, `/architecture`, and `/in-action`.

---

## Outstanding items from the original roadmap

Re-audited on 2026-04-19. Where the audit surfaced a gap, this section is
specific about what "done" looks like.

### Sprint 4 — Try-It rewrite (partial)

- **`src/opchain-try.js` is still JavaScript, not TypeScript.** The original DoD read "Original `src/opchain-try.js` ... deleted." That was aspirational — it assumed a full TS rewrite of the handler. What actually shipped: Zod schemas (`src/lib/schemas.js`), retry helpers (`src/lib/retry.js`), request-ID plumbing (`src/lib/request-id.js`), typed KV wrappers (`src/lib/kv.js`). The handler itself (`src/opchain-try.js`) still composes these in JS.
- **Why it's not urgent.** The handler uses all the new libs. The only things a TS migration would add are compile-time safety and `type` exports. Nothing about security, behavior, or testability is blocked on it.
- **When to do it.** Bundle with the next substantive change to `opchain-try.js` — e.g. adding a second model, swapping the rate-limit algorithm, or introducing streaming tool-use. Don't do a pure port.

### Sprints 2 / 3 / 4 / 5 — Playwright e2e

The original plan repeatedly called for Playwright tests:
- Sprint 2: styleguide renders on dark theme
- Sprint 3: route 200s, filter behavior, mermaid as inline SVG, Axe violations
- Sprint 4: email → chat → counter decrement
- Sprint 5: consent banner, CSP blocks inline scripts

**Current state:** 849 LOC across 12 Vitest files covering Worker-side units
(handlers, schemas, redirects, logs, KV TTL, security headers). No browser-
driven end-to-end coverage.

**Proposal — Sprint 7a: Browser e2e harness (~8 CLAUDE h).**
- Add `@playwright/test` to `site/`.
- Seed `site/tests/e2e/` with:
  - `routes.spec.ts` — `/`, `/architecture`, `/install`, `/skills`, `/skills/app-architect`, `/tryit`, `/in-action`, `/privacy` all return 200 and render their h1.
  - `redirects.spec.ts` — `.html` paths 301 (complements the Vitest redirect tests which mock `ASSETS`).
  - `consent.spec.ts` — fresh profile shows banner; decline → no `window.posthog`; accept → PostHog loads.
  - `filter.spec.ts` — `/skills` phase filter reduces card count.
  - `tryit.spec.ts` — email submit reveals chat UI, starter prompt streams, counter decrements.
- Wire `npx playwright test` into `ci.yml` after `npm test`.
- No visual-regression snapshot yet (brittle without a dedicated screenshot service) — log it for later.

### Sprints 3 / 5 — Lighthouse + Axe CI gate

Original thresholds:
- Sprint 3: Performance ≥ 95, Accessibility ≥ 95 on `/` and `/skills`
- Sprint 5: Best Practices ≥ 95
- Sprint 6: all four (Perf, A11y, Best Practices, SEO) ≥ 95

**Current state:** no automated enforcement. The smoke test (`scripts/smoke.sh`)
only verifies 200s and headers.

**Proposal — Sprint 7b: Quality gates in CI (~4 CLAUDE h).**
- Add `@axe-core/playwright` assertions in each `routes.spec.ts` test (0 violations).
- Add `@lhci/cli` GitHub Action — runs against the staging URL post-deploy
  and fails the action on threshold regression.
- Configure thresholds matching the roadmap; relax selectively with inline reasons, not silently.

### Sprint 4 — client-side analytics wrapper

**Closed in this PR.** `site/src/lib/analytics.ts` exposes typed `track(event, props)`.
Wired into the install page copy buttons as the first caller. Adding more
`track()` calls (filter usage, skill detail pageviews, in-action scenario
opens) can happen incrementally — they no longer need new infrastructure.

### Sprint 6 — launch checklist as an artifact

**Closed in this PR.** `checklists/launch-checklist.md` is now a real file,
derived from the Sprint 6 pre-launch section. Future deploys can copy it into
`checklists/launches/<date>-<release>.md` and keep a verification log.

---

## What else is worth doing next

Not on the original roadmap, surfaced during this audit.

1. **CSP tighten.** `script-src` still permits `'unsafe-inline'` to support
   the theme-init FOUC prevention in `Base.astro`. Swapping to a build-time
   nonce would let us drop it — small, safe, closes a gap CSP reviewers will
   flag.
2. **Feature flag the /in-action page behind a content review.** It's the
   largest post-launch surface; gating it behind `?preview=1` until sign-off
   would make future iterations cheaper.
3. **Per-page OpenGraph images.** `Base.astro` serves the same `/og-image.png`
   everywhere. Per-page images (`/og/skills.png`, `/og/in-action.png`) lift
   social CTR meaningfully.
4. **Dependabot hygiene sweep.** Confirm the Dependabot PRs are actually
   landing — stale bot PRs are a common silent drift.
5. **Skill versioning surfaced in UI.** Each `SKILL.md` has `version:` in
   frontmatter (Sprint 1) but the skill detail page doesn't render it. Add
   a version pill next to the skill name.

---

## Suggested next sprint

**Sprint 7 — Quality gates & small polish** (~14 CLAUDE h / 1 USER h):

- 7a Playwright e2e harness (8 h)
- 7b Lighthouse + Axe CI gate (4 h)
- 7c CSP nonce migration (2 h)

Everything after that is incremental feature work (version pills, OG images,
TS migration of the Worker handler when the next feature lands). Those become
regular backlog items, not roadmap sprints.

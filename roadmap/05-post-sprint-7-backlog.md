# Post-Sprint-7 Backlog

Items surfaced during Sprint 7 (`roadmap/04-sprint-7-revised.md`) that
were deliberately deferred. Each is small enough to land as a
single-PR follow-up; none earn a roadmap sprint of their own.

Captured 2026-04-19, immediately after Sprint 7c.

---

## B-01: Tighten LHCI thresholds back toward 0.95 with per-page overrides

**Why deferred:** Sprint 7b shipped the LHCI gate at 0.95 across the
board. Real Lighthouse scores missed it on at least one page. Without
local Chrome to triage from the authoring sandbox, the baseline pass
(PR #45) loosened all four categories to `minScore: 0.85` so main went
green and the report URLs surfaced.

**Reference data — first-run reports on commit `57b8bf2` (PR #45 merge):**

| Route | Lighthouse report |
|---|---|
| `/` | https://storage.googleapis.com/lighthouse-infrastructure.appspot.com/reports/1776589522386-32525.report.html |
| `/skills` | https://storage.googleapis.com/lighthouse-infrastructure.appspot.com/reports/1776589522704-69557.report.html |
| `/in-action` | https://storage.googleapis.com/lighthouse-infrastructure.appspot.com/reports/1776589522968-75824.report.html |

(Temporary-public-storage retains reports ~7 days; re-run `npm run lhci`
locally if these expire.)

**Definition of done:**

- Read each report's category scores (Performance / Accessibility /
  Best Practices / SEO).
- Edit `lighthouserc.json`'s `assertMatrix`:
  - For each `(route, category)` whose score ≥ 0.95: lift the threshold
    back to `0.95`.
  - For misses ≤ 0.02: drop the per-page threshold to the observed
    score, with an inline comment naming the audit responsible.
  - For misses > 0.02: investigate as a defect — do not relax the
    threshold without a fix in page source.
- Open a PR; if CI surfaces variance (LHCI scores wobble ±0.02 between
  runs), bump `numberOfRuns` from `1` to `3` with median.

**Effort:** ~1 CLAUDE h once the report data is in hand.

---

## B-02: Re-assert Axe violations as hard test failures — **closed**

**Original:** PR #45 had switched Axe from
`expect(violations).toEqual([])` to a side-effect-only attach so the
job could go green during the Sprint 7b baseline pass. Tests passed
regardless of violation count.

**What landed:**
- `site/tests/e2e/routes.spec.ts` re-asserts
  `expect(violations).toEqual([])` for every route. The attach
  branch is preserved (gated on `violations.length > 0`) as a debug
  aid: when a violation slips in, the maintainer gets the JSON
  inline in the Playwright report without having to rerun.
- `color-contrast` is disabled per-route — not globally — with the
  reason `"shared tokens (.nav-link, .eyebrow, .btn, .pill); tracked
  in roadmap B-10"`. Each disable is removed in lockstep with the
  B-10 fix; until then the noise stays out of the gate.
- `/demo` keeps its existing `region`-rule disable (chat-bubble mock
  content) on top of the color-contrast one.

**Trigger to undo a disable:** when B-10 lands (the colour-token
sweep), drop the `COLOR_CONTRAST_DISABLE` constant and every
reference to it. CI will now block on a new color-contrast
regression instead of letting it accumulate.

---

## B-03: Per-page OpenGraph images

**Why deferred:** Carried over from `roadmap/04-sprint-7-revised.md` →
"Backlog" table B1.

`Base.astro:28` serves a single `/og-image.png` for every route. Per-
page images (`/og/skills.png`, `/og/in-action.png`, `/og/<skill>.png`,
…) would lift social CTR.

**Approach options:**
- Static set: design 4–8 PNGs, put them under `site/public/og/`,
  branch the `<meta>` tag in `Base.astro` from a route → asset map.
- Dynamic via `@vercel/og` or Astro's built-in image services: more
  flexible, more moving parts.

**Effort:** Static set ~3 h Claude + ~1 h user (design review).
Dynamic ~5 h Claude.

---

## B-04: Dependabot PR-landing audit

**Why deferred:** `.github/dependabot.yml` is configured but no one
has confirmed bot PRs are actually merging. Stale Dependabot PRs are
the canonical silent drift.

**Definition of done:**

- List all open `dependabot[bot]` PRs against the repo.
- For each: triage (merge, close-with-reason, or escalate as a
  breaking-bump that needs a real diff review).
- Document a monthly cadence in `CLAUDE.md` if any churn is high
  enough to warrant it.

**Effort:** ~1 h, recurring.

---

## B-05: Worker handler TypeScript migration

**Why deferred:** `roadmap/03-post-launch.md` flagged this. The
handler (`src/opchain-try.js`) uses all the Sprint 4 typed libs but
the handler itself remains JS. Behaviour is fine; only compile-time
safety is missing.

**Trigger:** Bundle this with the next substantive change to
`opchain-try.js` — e.g. adding a second model, swapping the
rate-limit algorithm, introducing streaming tool-use. Don't ship a
pure port; let it ride a feature.

---

## B-06: Visual regression snapshots for the styleguide page

**Why deferred:** `roadmap/04-sprint-7-revised.md` Backlog B5.
Brittle without a dedicated screenshot service (Percy, Chromatic).

**Trigger:** When a design refresh causes a regression that visual
review would have caught.

---

## B-07: Lighthouse against production URL

**Why deferred:** Sprint 7b runs LHCI against a local `astro preview`
server for determinism. Catches code/build issues but not
CDN/headers/Cloudflare behaviour.

**Approach:** A second Lighthouse workflow that runs after the
production deploy (`.github/workflows/deploy.yml` `production` job),
hitting `https://opchain.dev/`, `/skills`, `/in-action`. Failure
notifies but does not block (production is already live by then).

**Effort:** ~2 h Claude.

---

## B-08: Raise `/demo` accessibility back to 0.95 — **closed (PR #94)**

**Why deferred originally:** B-01 (PR #86) calibrated LHCI thresholds
back to 0.95 across the board for `/` and `/skills`, but `/demo`
accessibility ran ~0.91. Per-route override sat at 0.91 to keep the
gate green.

**What landed:** PR #94 fixed two ARIA audits surfaced by PR #90's
enriched LHCI comment:

- `aria-allowed-role` on `section#scenario-picker` — switched the
  wrapper to a `<div>` so the explicit `role="tablist"` doesn't
  collide with `<section>`'s implicit `role="region"` (which gets
  applied as soon as `aria-label` is present).
- `aria-allowed-attr` on `button.scenario` — removed `aria-pressed`
  (only valid for `role="button"`); kept `aria-selected` (the
  canonical state for `role="tab"`). Renamed the matching CSS
  selectors to `[aria-selected="true"]`.

`/demo` jumped from 0.91 → 0.96. The per-route threshold was lifted
back to 0.95.

**Outstanding (deferred to a separate item, not B-08):** every route
still flags `color-contrast` on a long list of nodes (`.nav-link`,
`.eyebrow`, `.btn`, `.phase-pill`, `.lede-replays`, `.mode-card-tag`,
`.tab` etc.). Lighthouse weights these such that scores still land
at 0.96, but they're real WCAG misses worth fixing. Likely a single
sweep at the design-token level (`--muted`, `--accent` on `--ribbon`/
`--bg` in dark mode) — best paired with the in-flight UX-pass session
on the colour core. **Tracked as a new item below.**

---

## B-09: Surface LHCI report URLs in the PR comment — **partial (PR #90); regressed**

**Original status:** PR #86 added an `actions/github-script` step
that posts per-route LHCI scores as a PR comment, but the Report
column showed `—`. PR #90 made the lookup robust (try URL key,
absolute path, relative path, basename), added a debug-fallback
block when nothing matches, and added node-selector detail under
each failing audit.

**Where it stands:** the audit-detail and debug-fallback half is
solid (working through PR #92 and PR #94). The Report URL column
flipped back to `—` somewhere between PR #90 and PR #92 — possibly
a different LHCI/temporary-public-storage version writing
`links.json` with yet another key shape. The debug-fallback block
no longer fires either, which is its own small bug.

**Definition of done:**

- Make the script log `links.json`'s first 3 keys to the action's
  step output unconditionally (not only on miss) — one CI run gives
  us the actual format.
- Adjust the multi-key lookup once the format is known.
- Restore clickable `[link]` cells in the comment table.
- Tests cover whatever the new key shape turns out to be.

**Effort:** ~30 min Claude.

---

## B-11: Axe disables surfaced by B-02 — fix in source

**Why opened:** PR #101 (B-02) re-asserted `expect(violations).toEqual([])`
in `routes.spec.ts`. Six routes still flag axe violations beyond
color-contrast (which is in B-10). Each is disabled per-route with a
pointer to this entry; removing the disable closes a real WCAG miss.

**Audits and routes:**

- `link-in-text-block` (serious) — links inside body text need a
  non-colour distinction. Affects `/architecture`, `/install`,
  `/privacy`, `/skills/<id>`, `/styleguide`. Single global fix:
  `a` inside `p`, `li`, `td` etc. gets a default `text-decoration:
  underline` — site-wide CSS rule, scoped to prose contexts so chrome
  links (`.nav-link`, `.btn`) opt out.
- `nested-interactive` (serious) — `.pipeline-svg` on `/architecture`
  has a focusable container with interactive child `<g>` elements.
  Either remove `tabindex` from the container or refactor child
  interactivity into anchor wrappers.
- `label` (critical) — GFM task-list checkboxes rendered from skill
  `SKILL.md` content. The Astro markdown pipeline currently emits
  bare `<input type="checkbox">` without an associated `<label>`
  (because the markdown is `- [ ] item`, not `<label><input>...`).
  Fix at the renderer level: a small rehype plugin that wraps the
  checkbox in a `<label>` paired with the list-item text.

**Removal trigger per audit:** drop the matching constant
(`LINK_IN_TEXT_BLOCK_DISABLE`, `LABEL_TASK_LIST_DISABLE`) and the
inline `nested-interactive` entry from `routes.spec.ts`'s `ROUTES`
table. CI then enforces.

---

## B-10: Color-contrast sweep across `/`, `/skills`, `/demo`

**Why deferred:** PR #94 closed B-08 by fixing the ARIA audits on
`/demo`, but `color-contrast` still flags 11+ nodes on `/`, 13+ on
`/skills`, and 19+ on `/demo`. Lighthouse weighting keeps the
scores at 0.96 each — they pass the 0.95 LHCI threshold — but
they're real WCAG AA misses (`--muted` on `--ribbon`, `--accent` on
`--bg`, etc.).

**Definition of done:**

- For each failing selector listed in the most recent LHCI PR
  comment, identify whether the offender is a token (`--muted`,
  `--accent`, `--info` etc.) or a component-local color choice.
- Token offenders: coordinate with the UX-pass session on the colour
  core. Don't unilaterally darken/lighten — tokens drive the whole
  site.
- Component-local offenders: tighten in the component's `<style>`
  scope with a comment naming the audit.
- Restore the LHCI assertion to `error` instead of accepting the 0.96
  median (delete the inline calibration comment in `lighthouserc.cjs`).
- Re-run LHCI; expect the failing-audits sections under each route
  to be empty.

**Effort:** Hard to bound until token vs component-local is sorted —
probably 2–4 h.

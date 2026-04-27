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

## B-02: Re-assert Axe violations as hard test failures

**Why deferred:** The Sprint 7b baseline (PR #45) switched Axe from
`expect(violations).toEqual([])` to a side-effect-only test that
attaches `axe-violations-<slug>.json` per route. Tests pass regardless;
violation data lands as Playwright report attachments.

**Definition of done:**

- Pull the Axe violation JSON for each route from a recent CI run's
  Playwright report.
- For each violation:
  - **Real WCAG miss** (e.g. missing `alt`, low contrast): fix in page
    source.
  - **False positive** (e.g. `region` rule flagging a known-OK
    landmark layout): per-route `disableRules: [{ id, reason }]` in
    `routes.spec.ts`'s `ROUTES` table — never globally.
- Restore the assertion: `expect(violations).toEqual([])`.
- Remove the artifact-attach branch (or keep it, gated on
  `violations.length > 0`, as a debug aid for future regressions).

**Effort:** ~1–2 CLAUDE h, depends on violation count + complexity.

---

## B-03: Per-page OpenGraph images — **wiring done; designs pending**

**Original:** `Base.astro:28` served one global `/og-image.png` for
every route. Per-page images lift social-share CTR.

**What landed (wiring):**
- `site/src/layouts/Base.astro` now has a `ROUTE_OG_IMAGES` map
  (pathname → asset path) plus an `ogImage` prop for explicit
  overrides. Skill-detail pages fall through to `/og/skills.png`
  until each skill earns its own.
- `site/public/og/{home,skills,architecture,install,demo,privacy}.png`
  are seeded as copies of the existing `/og-image.png`. Each route
  already serves a real asset — no 404s on social-card fetch — so
  the design hand-off is "drop a 1200×630 PNG at the existing path"
  with no code changes required.
- `site/public/og/README.md` documents the setup and lists which
  files are still placeholders.

**Pending — design hand-off:**
- Replace the six placeholder PNGs with actual share-card designs.
  Sizing target is 1200×630 (Open Graph standard). Suggested visual
  direction: brand wordmark + per-route headline pulled from the
  page itself (e.g. "skills that ship" on `/`, "Every skill,
  filterable." on `/skills`, "How opchain skills chain." on
  `/architecture`).
- Optional follow-up: per-skill OG cards under
  `/og/skills/<skill-id>.png` keyed off `Astro.params.id` — currently
  every `/skills/<id>` shares one card.

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

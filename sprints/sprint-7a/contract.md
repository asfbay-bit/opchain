# Sprint 7a Contract — Playwright e2e harness

Negotiated by the app-architect Generator/Evaluator on 2026-04-19. Closes
deferred Sprint 2/3/4/5 e2e items per `roadmap/04-sprint-7-revised.md`.

## Deliverables

1. `@playwright/test` added to `site/package.json` as a devDependency.
2. `site/playwright.config.ts` — single Chromium project, `webServer`
   boots `npm run preview` against the real Astro build, base URL
   `http://localhost:4321`.
3. `site/tests/e2e/`:
   - `routes.spec.ts` — every top-level route returns 200 and renders its `h1`.
   - `filter.spec.ts` — `/skills` phase filter reduces visible card count.
   - `tryit.spec.ts` — email submit reveals chat input; sending a starter
     prompt streams text; remaining-counter decrements. `/api/try/*`
     mocked via `page.route()` so tests don't burn Anthropic credits and
     don't depend on the Worker being up.
   - `consent.spec.ts` — fresh storage shows banner; decline → no PostHog
     stub; accept → PostHog stub appears. Built with
     `PUBLIC_POSTHOG_KEY=test-key` for the e2e build so the loader runs.
4. `site/package.json` script `test:e2e` → `playwright test`.
5. `.github/workflows/ci.yml` extended: a new `e2e` job runs after `site`,
   installs Playwright + Chromium, builds the site, runs the suite. Cache
   the Playwright browser install to keep runtime down.
6. `site/README.md` updated with how to run e2e locally.
7. `.gitignore` extended for Playwright artifacts (`site/test-results/`,
   `site/playwright-report/`, `site/.playwright/`).

## Testable Criteria

| # | Criterion | How to verify |
|---|---|---|
| C1 | Playwright installed and configured | `npm run test:e2e --workspace=site` from a clean clone executes |
| C2 | Routes spec passes | `routes.spec.ts` asserts 200 + `h1` for `/`, `/architecture`, `/install`, `/skills`, `/skills/app-architect`, `/in-action`, `/tryit`, `/privacy`, `/styleguide`, `/404` |
| C3 | Filter spec passes | Selecting "plan" pill on `/skills` strictly reduces visible `.skill-card` count vs. "all" |
| C4 | Try-It spec passes | Submitting a valid email reveals the chat input; mocked SSE response renders text in the assistant bubble; `#tryit-counter` decrements from 5 to 4 |
| C5 | Consent spec passes | Banner visible on first visit; decline → `window.posthog === undefined`; accept → `typeof window.posthog === "object"` |
| C6 | CI gate works | The `e2e` job runs on PR, fails on intentional regression |

## Test Requirements

- 4 spec files (above), each green locally and in CI.
- All flake-prone selectors use `data-testid` or stable IDs already in the
  markup; no nth-child selectors.
- Mock fixtures live alongside each spec; no shared state across files.

## Technical Approach

### Why drop `redirects.spec.ts` from this sprint

The original revised roadmap (`04-sprint-7-revised.md` L34) proposed
`redirects.spec.ts`. Verified during contract negotiation that:

- `.html` redirects are handled by the Worker (`src/index.js:248–256`),
  not by Astro.
- `astro preview` doesn't run the Worker — covering redirects would
  require a `wrangler dev` server-of-record (heavier setup, requires
  KV preview, requires `DEPLOY_API_TOKEN`).
- Existing Vitest tests already cover redirect behaviour by mocking
  `ASSETS` at the Worker level (`tests/redirects.test.js`).

**Decision:** Keep redirects in Vitest, skip the e2e copy. This trims
~30 min of setup and one slow job from CI. If a future sprint adds
header/CSP assertions that genuinely need the Worker (likely Sub-sprint
7c), we'll switch the e2e harness to `wrangler dev` then.

### `webServer` choice: `astro preview`

Astro's `preview` command serves the static build at port 4321. No SSR,
no API. Identical to what Cloudflare's edge serves, minus the Worker.

For Try-It, `page.route("**/api/try/**", route => …)` intercepts the
fetch and fulfils with a mocked SSE response. The client treats it as a
single-chunk stream — the SSE parser doesn't care if delivery is chunked
or not.

### Build env for consent test

Consent banner only loads PostHog when `PUBLIC_POSTHOG_KEY` is set
(`ConsentBanner.astro:14`). The e2e CI step builds with
`PUBLIC_POSTHOG_KEY=pk_test_e2e PUBLIC_POSTHOG_HOST=http://localhost:9999`
so the loader path runs. The PostHog stub is detected purely on
`typeof window.posthog === "object"` — no real network call.

### CI integration

A new `e2e` job:
- Runs after `site` succeeds.
- `npm ci` in `site/` (cached).
- `npx playwright install --with-deps chromium` (cached separately by
  `~/.cache/ms-playwright`).
- `npm run build` with the test-mode env vars.
- `npm run test:e2e -- --reporter=github`.
- Uploads `playwright-report/` on failure.

Time budget: ≤ 90 s cold, ≤ 30 s warm. If we exceed this in the first
PR, we trim the route list before adding parallelism.

## Out of scope (for 7a)

- Visual regression snapshots — backlog item B5.
- Axe assertions inside `routes.spec.ts` — Sub-sprint 7b.
- Lighthouse — Sub-sprint 7b.
- CSP nonce work — Sub-sprint 7c.
- Worker-handled routes (redirects, headers) — covered by Vitest.
- Skill detail pages beyond `app-architect` — adding all 10 would just
  bloat runtime; one is enough to prove the dynamic route works.

## Definition of Done

- `npm run test:e2e --workspace=site` green on a clean clone.
- CI shows the new `e2e` job on the PR check list; failures block merge.
- README documents the local run command.
- Sprint 7 checkpoint marks `sprint-7a` complete; status `in_progress`,
  step `sprint-7b-contract` (or whatever comes next).

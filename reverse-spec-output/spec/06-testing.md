# 06 — Testing

_Refreshed 2026-04-28 by `/reverse-spec` targeted update. Replaces the
2026-04-17 version, which opened with "There are no automated tests in
this repository." That hasn't been true since Sprint 7; the repo now
runs Vitest, Playwright, axe, `astro check`, and Lighthouse on every
PR._

## Current State

The repo runs **three independent test suites** plus two static-analysis
gates, all wired into GitHub Actions.

### 1. Worker unit / integration suite — Vitest

| Aspect | Value |
|---|---|
| Runner | Vitest ^4.1, Node environment | 
| Config | `vitest.config.js` — defines `__OPCHAIN_VERSION__ = "test"` so `src/index.js` imports cleanly without an esbuild step |
| Glob | `tests/**/*.test.js`, `tests/**/*.test.mjs` |
| Pretest | `npm run gen-catalog` — every test run validates `skills/<id>/SKILL.md` frontmatter, so a malformed skill fails the suite before any test runs |
| Files | 11 test files, ~33KB |

Coverage by file:

| File | Surface tested |
|---|---|
| `tests/health.test.js` | `GET /api/health` — status, JSON shape, version header |
| `tests/feedback.test.js` | `POST /api/feedback` — Zod validation, `LINEAR_API_KEY` missing branch, Linear success path with mocked `fetch` |
| `tests/notify.test.js` | `POST /api/notify` — schema, rate-limit (KV mock), KV-missing degrade-open path, lead-key hashing |
| `tests/redirects.test.js` | `/tryit` / `/in-action` → `/demo` 301s, `*.html` → clean URL, query preservation |
| `tests/security-headers.test.js` | Baseline header stamp on every response (HTML + JSON); HSTS / Frame-Options / Permissions-Policy presence |
| `tests/csp-nonce.test.js` | `__OPCHAIN_NONCE__` substitution, per-request nonce uniqueness, CSP header content |
| `tests/analytics.test.js` | `capture()` swallows failures; `hashDistinctId` is stable; missing API key short-circuits without fetch |
| `tests/logs.test.js` | Structured event emission via `bindLogger`, JSON-line shape, `EVENTS` enum |
| `tests/catalog-generator.test.js` | `gen-skills-catalog.mjs` — frontmatter required-field assertions, name-vs-directory mismatch failure |
| `tests/smoke-script.test.js` | `scripts/smoke.sh` shape — header presence, retry behaviour |
| `tests/lhci-comment.test.js` | `scripts/lhci-comment.cjs` — score parsing, comment formatter |

Run: `npm test` (Worker + scripts + helpers, single command).

### 2. Site type-check — `astro check`

| Aspect | Value |
|---|---|
| Command | `cd site && npm run check` |
| Coverage | Astro component types + content collection schema validation |
| What it catches | Missing/mistyped frontmatter, wrong prop types in `Base.astro`, stale `Astro.props` shapes |

This is the only TypeScript-side gate; the Worker (`src/`) is JS-only
and relies on Vitest for shape correctness.

### 3. Site e2e — Playwright + axe

| Aspect | Value |
|---|---|
| Runner | Playwright ^1.59, Chromium only |
| Config | `site/playwright.config.ts` — boots `astro preview` on `127.0.0.1:4321`; the Worker is NOT booted |
| Pretest | `astro build` with `PUBLIC_POSTHOG_KEY=phc_test_e2e PUBLIC_POSTHOG_HOST=http://127.0.0.1:9999` so the consent flow can fire its bootstrap against a controllable host |
| API mocking | `/api/*` is mocked per-test via `page.route()` — the e2e suite does not exercise the live Worker |

Coverage:

| File | What it covers |
|---|---|
| `site/tests/e2e/routes.spec.ts` | Every Astro page renders, status 200, expected H1, no console errors |
| `site/tests/e2e/consent.spec.ts` | Consent banner accept/decline, PostHog bootstrap gate |
| `site/tests/e2e/filter.spec.ts` | `/skills` filter island — keyword + phase filtering |

Each spec also runs `@axe-core/playwright`; violations are written into
`site/test-results/` and posted as a PR comment by
`scripts/axe-comment.cjs` (CI step: "Post axe violation summary as PR
comment").

The Worker's redirect / CSP / API behaviour is **intentionally out of
scope** for this Playwright suite — it lives in the Vitest suite
above. A future e2e harness that boots `wrangler dev` is tracked in
`gap-analysis.md` L1 (B-09) so CSP gets real-browser verification.

### 4. Lighthouse / performance — LHCI

| Aspect | Value |
|---|---|
| Runner | `@lhci/cli` ^0.15 |
| Config | `lighthouserc.cjs` (PR builds), `lighthouserc.prod.cjs` (production audits in `lighthouse-prod.yml`) |
| Routes audited | `/`, `/skills`, `/demo` (3 runs each, median scoring) |
| Thresholds | All four categories ≥ 0.95 (per-route assertion matrix); calibration data in the rc file header comment |
| Comment | `scripts/lhci-comment.cjs` posts a score table on every PR |

### 5. CI workflows

`.github/workflows/ci.yml` — three jobs:

1. **`worker`** — `npm ci` (root), `npm ci` (site, needed because
   `npm run build` triggers `astro build`), `npm test`, `npm run build`
   with `OPCHAIN_VERSION=${{ github.sha }}`, upload `dist/` as
   `worker-dist`.
2. **`site`** — `npm ci` (site), `astro check`, `astro build`.
3. **`site-e2e`** — depends on `site`. Caches Playwright browsers,
   builds with PostHog test env, runs `npm run test:e2e`, posts axe
   summary on failure or as a regular PR comment.

`.github/workflows/lighthouse.yml` — runs LHCI on every PR (against
the freshly-built static site, not the deployed env). PostHog and
beacon hosts are deliberately left empty during the build to keep
network noise out of the run.

`.github/workflows/lighthouse-prod.yml` — separate workflow for prod
audits.

**Neither CI nor any other workflow deploys.** Deploys are manual from
a developer laptop with `wrangler login` already done — see
`07-devops.md`.

### Confidence

| Claim | Confidence |
|---|---|
| Vitest is the Worker test runner | HIGH — `package.json` `test` script + `vitest.config.js` |
| Playwright covers the static site only | HIGH — config explicitly excludes the Worker; `/api/*` mocked per-test |
| Catalog validation runs on every test invocation | HIGH — `pretest` script in `package.json` |
| Axe runs inside Playwright (not standalone) | HIGH — `@axe-core/playwright` import in spec files |
| Lighthouse thresholds are enforced | HIGH — assert matrix in `lighthouserc.cjs` uses `error` severity |
| CI does not deploy | HIGH — no `wrangler deploy` step in any workflow; `CLAUDE.md` documents the rationale |

## Gaps & Recommendations

- **No browser-level verification of the Worker.** Playwright runs
  against `astro preview`, so CSP / redirects / `/api/*` are only
  exercised in Vitest with mocks. A `wrangler dev`-backed e2e suite
  would catch a CSP regression that passes Vitest but fails in a real
  browser. Tracked as `gap-analysis.md` L1 (B-09).
- **No coverage threshold enforced.** Vitest can produce coverage
  reports but the suite doesn't fail on a regression. Adding a
  per-file `lines: 80%` floor on the four `lib/` files would prevent
  silent quality drift.
- **Smoke script is tested but never run by CI.** `scripts/smoke.sh`
  has unit coverage in `tests/smoke-script.test.js`, but no CI job
  invokes it against a real deploy. With deploys being manual, this
  is consistent — the developer who deploys is expected to run smoke
  by hand. Worth a one-line note in the README so the script doesn't
  bit-rot.
- **Skill content is not tested.** The catalog generator validates
  *frontmatter*, but the Markdown body of each skill is unchecked.
  A `skill-prose-lint.test.js` (e.g. assert no broken links, every
  `## Heading` has a body, every `/cmd` reference exists in
  `commands:`) would plug a real gap. Defer until a content-side bug
  actually surfaces.

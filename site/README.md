# opchain-site

Astro 5 app that will replace the current `public/` + `src/` Worker at
cutover (Sprint 6). Today it's a placeholder scaffold.

## Scripts

```bash
cd site
npm install
npm run dev      # astro dev on localhost:4321
npm run build    # astro build → ./dist
npm run check    # astro check (type + content validation)
npm run test:e2e # Playwright e2e (auto-builds with test PostHog key, then runs preview)
```

## E2E (Sprint 7a)

The Playwright suite lives in `site/tests/e2e/` and runs against a real
`astro preview` server on `127.0.0.1:4321`. The Worker is **not** booted —
`/api/try/*` is mocked per-test via `page.route()`.

First run on a clean clone:

```bash
cd site
npx playwright install chromium    # one-time browser install (~150 MB)
npm run test:e2e
```

CI runs the same suite on `ubuntu-latest`; cached browsers keep the step
under a minute warm.

## Lighthouse (Sprint 7b)

Per-PR Lighthouse audit via `@lhci/cli`. Runs against a fresh `astro
preview`. Budgets live at the repo root (`lighthouserc.json`):

- `/` and `/skills`: Performance / Accessibility / Best Practices / SEO ≥ 0.95
- `/in-action`: Performance ≥ 0.85 (chat-mock-heavy DOM); the rest ≥ 0.95

Local one-shot:

```bash
cd site
npm run lhci
```

CI workflow `.github/workflows/lighthouse.yml` runs the same on every PR
and uploads the report to LHCI temporary public storage (link surfaces
in the action summary).

## Roadmap

- Sprint 1: content collections for `skills/*/SKILL.md`, typed catalog.
- Sprint 2: Tailwind 4, design tokens, component library, styleguide page.
- Sprint 3: Intro, Architecture (real), Skill Library, per-skill pages, Install, Try-It shell.
- Sprint 4: Try-It chat ported in with PostHog event tracking.
- Sprint 5: Consent banner, CSP, hardening.
- Sprint 6: Cutover — Astro build replaces the old Worker.

See `roadmap/02-sprint-plan.md` for deliverables.

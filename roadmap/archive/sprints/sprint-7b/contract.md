# Sprint 7b Contract — Lighthouse + Axe quality gates

Negotiated by app-architect on 2026-04-19. Closes deferred Sprint 3/5/6
quality thresholds per `roadmap/04-sprint-7-revised.md`.

## Deliverables

1. `@axe-core/playwright` added to `site/` devDependencies.
2. `site/tests/e2e/routes.spec.ts` extended: every route asserts
   `expect(violations).toEqual([])`. Specific rules can be disabled
   inline with a one-line comment justifying why — never silently.
3. `lighthouserc.json` at the repo root — budgets file driving
   `@lhci/cli`. Per-route assertions:
   - `/`: Performance ≥ 0.95, Accessibility ≥ 0.95, Best Practices ≥ 0.95, SEO ≥ 0.95
   - `/skills`: same four ≥ 0.95
   - `/in-action`: Performance ≥ 0.85 (relaxed because of the chat-mock-heavy DOM); A11y/BP/SEO ≥ 0.95
4. `.github/workflows/lighthouse.yml` — runs `lhci autorun` on PR + push to `main`. Uses LHCI's `startServerCommand` to boot `npm run preview` against the build, then runs Lighthouse in headless Chrome. Uploads to LHCI temporary public storage so PR check output links to the report.
5. README updated with `npm run lhci` (one-shot local run) + `npm run test:e2e` already runs Axe.

## Testable Criteria

| # | Criterion | How to verify |
|---|---|---|
| C1 | Axe runs on every route | `routes.spec.ts` has `AxeBuilder` invocation per route; PR run shows it as part of the existing `e2e` job |
| C2 | Axe gate fails on regression | Intentionally drop an `alt` attribute → `e2e` job red |
| C3 | Lighthouse runs in CI | New `lighthouse` workflow appears on PRs, completes within ~5 min |
| C4 | Lighthouse thresholds enforced | Set `/` perf budget to 1.0 in a draft PR → action fails |
| C5 | Local invocation works | `npm run lhci` from `site/` runs the suite against a local preview |
| C6 | Reports surface | LHCI uploads to temporary-public-storage; URL appears in the action summary |

## Test Requirements

- All 4 existing e2e specs still pass after the Axe extension.
- Lighthouse run does not require any network calls beyond the local preview server (no Anthropic / PostHog calls during scoring; PostHog SDK not loaded because consent banner is the cold-start state).
- CI job time budget: Axe extension ≤ +15s on the existing e2e job; Lighthouse job ≤ 5 min total.

## Technical Approach

### Why local preview, not staging URL

`roadmap/04-sprint-7-revised.md` L99 suggested running against staging.
Verified during contract negotiation that:

- The staging deploy workflow is async on `push: main` (`.github/workflows/deploy.yml:23`); a PR-time Lighthouse gate against staging would race against an unrelated deploy or fall back to the previous build.
- LHCI's `startServerCommand` is the recommended pattern: build → start preview → run Lighthouse → tear down. Deterministic, isolated, no coordination with deploy timing.
- CDN/header behaviour is already covered by `scripts/smoke.sh` post-deploy.
- Re-running Lighthouse against the production URL in a separate job would be valuable (catches CDN regressions) but it's a Sprint 7c+ scope item — log it rather than build it now.

**Decision:** PR-time Lighthouse runs against `npm run preview`; staging-URL Lighthouse stays as a backlog idea.

### Axe rule scope

`@axe-core/playwright`'s default rule set is the WCAG 2.1 A + AA tags
(`wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`) plus the Axe best-practices
rules. We enable those and disable selectively if a real-world false
positive shows up — with an inline comment naming the offender.

The `/in-action` page mocks chat bubbles with no associated landmarks;
expect a couple of `region`-rule false positives. Disable per-route
rather than globally, and document.

### LHCI configuration

`lighthouserc.json`:

```jsonc
{
  "ci": {
    "collect": {
      "startServerCommand": "npm --prefix site run preview -- --port 4321 --host 127.0.0.1",
      "url": [
        "http://127.0.0.1:4321/",
        "http://127.0.0.1:4321/skills",
        "http://127.0.0.1:4321/in-action"
      ],
      "numberOfRuns": 1,
      "settings": { "preset": "desktop" }
    },
    "assert": {
      "assertions": {
        "categories:performance":   ["error", { "minScore": 0.95 }],
        "categories:accessibility": ["error", { "minScore": 0.95 }],
        "categories:best-practices":["error", { "minScore": 0.95 }],
        "categories:seo":           ["error", { "minScore": 0.95 }]
      },
      "assertMatrix": [
        { "matchingUrlPattern": "in-action",
          "assertions": { "categories:performance": ["error", { "minScore": 0.85 }] } }
      ]
    },
    "upload": { "target": "temporary-public-storage" }
  }
}
```

Reasoning:
- `numberOfRuns: 1` keeps PR latency low; can bump to 3 with median if scores prove flaky.
- Desktop preset matches our primary audience and the cleanup work in Sprint 2/3.
- `temporary-public-storage` requires no LHCI server setup; report links live for ~7 days, which is enough to triage.

## Out of scope (for 7b)

- LHCI server / persistent history — temporary-public-storage is enough to start.
- Mobile preset — the site is desktop-first marketing; mobile audit is a backlog item once we have a real mobile target.
- Lighthouse vs. production URL — backlog.
- Visual regression — backlog item B5 from `04-sprint-7-revised.md`.
- CSP nonce — Sub-sprint 7c.

## Definition of Done

- `npm run test:e2e` includes Axe assertions on every route, passes locally and in CI.
- `npm run lhci` runs the Lighthouse suite locally against a freshly built preview.
- `lighthouse` GitHub Action surfaces on PR check list; passes on `main`.
- Intentional regression (e.g. `alt` removal or budget bump) makes the relevant gate red — proves the gate works.
- Sprint 7 checkpoint marks `sprint-7b` complete; status `blocked` on Sprint 7c approval.

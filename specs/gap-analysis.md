# Gap Analysis — opchain.dev

> **Refreshed 2026-04-27.** Closed items moved to `drift-report.md`. This file
> now lists only what's still open as of the refresh date.

Prioritized list of everything that's missing, risky, or ambiguous.

## Severity key

- **HIGH** — production risk, security, or high-probability user-visible breakage.
- **MED** — correctness, maintainability, or growth blocker.
- **LOW** — polish, hygiene, nice-to-have.

---

## HIGH

_All four original HIGH items closed in the 2026-04-17 → 2026-04-27 window. See
`drift-report.md` for evidence._

No open HIGH gaps. Re-run `code-auditor /audit full` for fresh findings.

---

## MED

### M1. XSS surface in the Try-It markdown renderer
**File:** `site/src/components/TryIt.astro` (carried over from `public/tryit.js`)
**Problem:** Original gap M4 — bespoke regex-based markdown rendering of LLM
output. Migration to Astro should have either replaced this with `marked` +
DOMPurify (now present in dependencies) or hardened the regex pipeline.
**Status:** Needs verification against the current Astro component. If still
hand-rolled, replace.
**Fix:** Use `marked` (already in `site/package.json`) + DOMPurify in the
component's render path.

### M2. CSP completeness
**File:** `src/index.js` `applySecurityHeaders`, `tests/csp-nonce.test.js`,
`tests/security-headers.test.js`.
**Problem:** Original gap M5 — missing CSP/Referrer-Policy/Permissions-Policy.
Test files for `csp-nonce` and `security-headers` exist, implying CSP work has
landed. Needs a fresh audit to confirm CSP is comprehensive (frame-ancestors,
form-action, upgrade-insecure-requests, report-uri/report-to) and consistent
between Worker headers and any Astro `<meta http-equiv>` injection.
**Fix:** Run `security-auditor /hardening` against the deployed staging URL.

### M3. No OpenAPI / generated types
**Files:** `src/lib/schemas.js` defines Zod schemas for the API surface, but no
OpenAPI artifact is generated from them.
**Problem:** Carried from original M9 / stack-forge-audit. Worker handlers and
Astro client code maintain types separately.
**Fix:** Use `api-dev /api spec` to derive an OpenAPI document from the Zod
schemas, then generate a TypeScript client for `site/`.

### M4. Skill versioning + CHANGELOG discipline
**Files:** Each `skills/<id>/SKILL.md` carries a `version:` frontmatter field
(closing M10), but there is no CHANGELOG and no published policy for what
constitutes a breaking change.
**Fix:** Add `skills/CHANGELOG.md`. On any breaking change to checkpoint shape
or command names, bump the skill's `version` and append a CHANGELOG entry.

### M5. No production smoke gate post-manual-deploy
**Files:** `tests/smoke-script.test.js` validates the smoke runner; nothing
calls it in production.
**Problem:** Manual deploy means a human is the only gate. A bad deploy could
sit live for the time it takes to switch tabs.
**Fix:** Add a `scripts/smoke-deploy.sh` wrapper invoked at end of `npm run
deploy` and `deploy:staging` that hits `/api/health` and asserts the expected
SHA.

### M6. No incident runbook
**Files:** `CLAUDE.md` has the rollback steps but nothing for upstream
failures.
**Fix:** Add `runbooks/` with one runbook per upstream dependency (Linear,
Anthropic, PostHog), one for KV outage, and one for "rate-limit accidentally
trips a legitimate user." Once `monitoring-ops` is engaged, link runbook IDs
into alert payloads.

---

## LOW

### L1. No nightly synthetic monitoring
**Fix:** GitHub Actions cron daily, hits `/api/health` on prod and staging,
opens a Linear bug if either fails. Or use an external uptime service.

### L2. No deployment audit log
**Fix:** A short `scripts/log-deploy.sh` that appends `<timestamp> <sha>
<env>` to `roadmap/deploy-log.md` after each `wrangler deploy`.

### L3. `wrangler.jsonc $schema` uses local node_modules path
**File:** `wrangler.jsonc` L2.
**Fix:** Replace with the canonical public schema URL.

### L4. PR #100 (OpenGraph images) still draft
**File:** branch `feat/og-images`.
**Fix:** Land the PR — closes original L8 (no OG meta).

### L5. No coverage threshold on Vitest
**Fix:** Add `coverage.thresholds` to `vitest.config.js` (e.g. 70% line on
`src/lib/`, 60% on handlers). Soft floor, fail CI on regression.

### L6. No load test
**Fix:** Defer to `scale-ops` advisory until traffic warrants it. Current usage
is well below Workers Free tier limits.

---

## Cross-cutting

- **Documentation health.** `specs/` is now the canonical reverse-spec output.
  Several specs (`01-tech-stack`, `02-architecture`, `03-security-auth`,
  `04-integrations`, `design/*`) are partially stale and should be regenerated
  by a fresh `/rev-full` run when convenient. The drift-report flags exactly
  which.
- **Site rebuild from Astro.** Once specs are fully refreshed, the
  `architecture.astro` page can pull diagrams directly from `02-architecture.md`
  (likely via Astro's content collection).
- **PostHog consent + privacy posture.** Server-side analytics gating is
  env-controlled; client-side is consent-banner gated. A dedicated
  `08-analytics.md` spec doc should be generated to capture this end-to-end.

---

## Ranked priority for next pipeline action

1. **`code-auditor /audit full`** — establish a current code-quality grade now
   that the previous HIGH items are closed.
2. **`security-auditor /hardening`** — verify M2 (CSP) and surface anything
   the rapid hardening pass missed.
3. **`api-dev /api spec`** — close M3 (OpenAPI from Zod schemas).
4. Land PR #100 (OG images) and PR #99 (lighthouse-prod workflow) — closes L1
   and L4.
5. **`monitoring-ops`** — set up nightly synthetic + deploy smoke + the
   runbooks (M6).

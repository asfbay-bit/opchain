# Drift Report — `/rev-diff`

> ⚠️ **Dated snapshot.** Captured at commit `8f3edf8`. Commit `6511b1d`
> (merged shortly after this report) fully deleted the Try-It / Live chat
> surface — including `src/opchain-try.js`, `src/lib/kv.js`, `src/lib/retry.js`,
> `site/src/components/TryIt.astro`, KV bindings, and the Anthropic
> integration. Sections of this report that describe Try-It hardening
> (`schemas.js` for Try endpoints, fail-closed HMAC, Anthropic retry,
> lead TTL) are now historical. The reverse-spec section list at the
> bottom flagged several specs as "partially stale and not refreshed" —
> after the deletion, those specs are stale plus describe deleted
> code. Re-run `/rev-full` to regenerate from the current commit.

**Source spec generated:** 2026-04-17
**This report:** 2026-04-27
**Window:** 10 days

Reverse-spec specs in this directory were generated against an earlier commit
of opchain. This report identifies what has changed in the codebase since,
which spec sections are now stale, and which gap-analysis findings have been
resolved.

---

## Summary

The original spec captured opchain shortly after extraction from `aidops`. In the
intervening 10 days the codebase has matured substantially:

- **CI is now wired** (`.github/workflows/ci.yml` + `lighthouse.yml`).
- **Test suite exists** — 16 Vitest files in `tests/`, plus Playwright e2e in `site/tests/`.
- **Staging environment** added (`wrangler.jsonc env.staging`, `staging.opchain.dev`).
- **Astro 5 site** scaffolded under `site/` and made the source of truth (Sprint 6 cutover).
- **Worker hardened** — `src/lib/` now contains `schemas.js` (Zod validation), `kv.js`,
  `retry.js`, `request-id.js`, `analytics.js`. `__OPCHAIN_VERSION__` injected at build.
- **HMAC fail-closed** — the hardcoded fallback secret (H1) is gone; `/api/try/*` now
  returns 503 when `DEPLOY_API_TOKEN` is unset.
- **`.env.example` exists.**

Net effect: **all 4 HIGH gaps and most MED gaps from the original analysis are
closed.** A handful of MED/LOW items remain or have been replaced with new ones
introduced by the migration to Astro and the addition of analytics.

---

## Gaps closed since 2026-04-17

| ID | Original finding | Status | Evidence |
|---|---|---|---|
| H1 | Hardcoded fallback HMAC secret | **Closed** | `CLAUDE.md` "fail-closed, no fallback"; `src/opchain-try.js` returns 503 when `DEPLOY_API_TOKEN` unset |
| H2 | No CI, no automated tests | **Closed** | `.github/workflows/ci.yml`, 16 Vitest files in `tests/`, Playwright e2e in `site/tests/` |
| H3 | Single environment (no staging) | **Closed** | `wrangler.jsonc env.staging` → `opchain-staging` worker on `staging.opchain.dev` |
| H4 | No input validation on Worker handlers | **Closed** | `src/lib/schemas.js` (Zod), used by feedback + try handlers |
| M1 | KV production namespace bound in `wrangler dev` | **Closed** | `preview_id` now set in `wrangler.jsonc` for both prod and staging |
| M2 | Catalog drift across `skills.js` / `opchain-try.js` / `tryit.js` | **Closed** | `scripts/gen-skills-catalog.mjs` generates `public/skills.js` + `src/generated/skill-prompts.js` from `skills/<id>/SKILL.md` + `TRYIT.md` |
| M3 | `architecture.html` and `install.html` are stubs | **Closed** | Replaced by Astro pages `site/src/pages/architecture.astro`, `install.astro` (now real content) |
| M6 | Lead data has no TTL | **Closed** | `LEAD_TTL_DAYS` env var (default 365); `tests/lead-ttl.test.js` covers it |
| M7 | Linear team/project IDs hardcoded | **Closed** | `LINEAR_TEAM_ID`, `LINEAR_PROJECT_ID` env overrides per `CLAUDE.md` |
| M8 | Anthropic model hardcoded | **Closed** | `ANTHROPIC_MODEL` env override per `CLAUDE.md` |
| L1 | No `.env.example` | **Closed** | `.env.example` exists at repo root |
| L4 | No retry on Linear/Anthropic calls | **Closed** | `src/lib/retry.js` |
| L5 | No request-id on outbound calls | **Closed** | `src/lib/request-id.js` |
| L6 | Logs unstructured | **Partial** | `src/lib/analytics.js` adds structured PostHog events, but `console.error` calls in handlers remain unstructured |
| L7 | No version identifier | **Closed** | `build.mjs` injects `__OPCHAIN_VERSION__` from `OPCHAIN_VERSION` env or `git rev-parse --short HEAD`; surfaced in `GET /api/health` (`version` JSON field + `X-Opchain-Version` header) |

---

## Gaps still open

| ID | Finding | Severity | Notes |
|---|---|---|---|
| M4 | XSS surface through bespoke `renderMarkdown` | MED | The Try-It component's markdown handling moved into `site/src/components/TryIt.astro`. Confirm whether it still uses a hand-rolled regex renderer or has been replaced with `marked` + DOMPurify. |
| M5 | Missing CSP / Referrer-Policy / Permissions-Policy | MED | `tests/security-headers.test.js` and `tests/csp-nonce.test.js` exist — implies CSP work has at least started. Needs confirmation against current `src/index.js`. |
| M9 | Stub "API types" contract | MED | `src/lib/schemas.js` (Zod) helps, but no OpenAPI / generated types on the wire yet. |
| M10 | No per-skill versioning | MED | Skills now have `version: 1.0.0` in frontmatter — verify CHANGELOG discipline. |
| L2 | No `:focus-visible` ring | LOW | Site rebuilt; needs re-check against `site/src/styles/`. |
| L3 | `#e85c5c` not tokenized | LOW | Likely irrelevant after Astro migration; new token system in place. |
| L8 | No `robots.txt` / `sitemap.xml` / OG meta | LOW | PR #100 (open draft) is wiring per-route OG images, so this is in flight. |
| L10 | `wrangler.jsonc $schema` uses local path | LOW | Unchanged. |

---

## New surface that wasn't in the original spec

Sections of the codebase that didn't exist on 2026-04-17 and aren't yet covered
by any spec doc:

| Surface | Files | Spec impact |
|---|---|---|
| Astro 5 site | `site/src/pages/**`, `site/src/components/**`, `site/src/content.config.ts` | `02-architecture.md` Part A is stale on the frontend layer; design system spec needs full re-extraction from `site/src/styles/`. |
| Worker hardening libs | `src/lib/schemas.js`, `kv.js`, `retry.js`, `request-id.js`, `analytics.js` | `02-architecture.md`, `03-security-auth.md`, `04-integrations.md` all need to mention these. |
| PostHog analytics | `src/lib/analytics.js`, `site/src/components/ConsentBanner.astro` | `08-analytics.md` is now applicable (was previously skipped) — needs a new spec doc. |
| Lighthouse CI | `lighthouserc.cjs`, `.github/workflows/lighthouse.yml`, `tests/lhci-comment.test.js`, `scripts/lhci-summary.mjs` | `06-testing.md` and `07-devops.md` need to mention LHCI as a separate quality gate. |
| Demo route | `site/src/pages/demo.astro`, `site/src/components/Replays.astro` | New surface — combined `/in-action` + `/tryit` into `/demo` per recent commits. |
| OpenGraph images (in flight) | `feat/og-images` branch, PR #100 | Will close L8 once merged. |

---

## Spec sections refreshed in this drift pass

The following docs are updated in-place to reflect current state:

- `specs/spec/06-testing.md` — full rewrite (no longer "no tests")
- `specs/spec/07-devops.md` — full rewrite (no longer "no CI, no staging")
- `specs/spec/00-project-overview.md` — minor update (Astro 5 site, version surface)
- `specs/gap-analysis.md` — updated with closed/open status + new gaps

The following docs are **not refreshed in this pass** and remain partially stale.
They are accurate enough for app-architect baseline + code-auditor input, but
should be regenerated before any future production roadmap work:

- `specs/spec/01-tech-stack.md` — does not yet list `astro`, `tailwind`, `marked`, etc.
- `specs/spec/02-architecture.md` — Part A frontend section predates Astro migration.
- `specs/spec/03-security-auth.md` — does not mention Zod schema layer or CSP work.
- `specs/spec/04-integrations.md` — does not mention PostHog.
- `specs/design/design-system.md` — extracted from the old `public/styles.css`, not the new Astro tokens.
- `specs/stack-forge-audit.md` — typed pipeline analysis is stale on the Zod layer.
- `specs/tri-dev-ready/spec.md` — predates Astro and the post-launch backlog in `roadmap/05-post-sprint-7-backlog.md`.

A future `/rev-full --refresh` should fully regenerate the above against the
current commit.

---

## Pipeline readiness (post-drift)

| Next step | Readiness |
|---|---|
| `app-architect /roadmap` (plan new features) | **READY** — refreshed sections cover the highest-impact areas |
| `code-auditor /audit full` | **READY** — gap-analysis is now current; H1–H4 closed means audit can focus on real findings |
| `security-auditor` posture review | **READY** — CSP work is in flight, worth a fresh assessment |
| `scale-ops` advisory | **DEFERRED** — no scaling pressure surfaced; revisit when Try-It traffic grows |

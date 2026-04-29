# Gap Analysis — opchain.dev

_Refreshed 2026-04-28 by `/reverse-spec` targeted update. Replaces the
2026-04-17 list, which was dominated by the now-removed Try-It chat
(H1, H4, M2, M4, M8) and pre-Sprint-7 hygiene work that has since
shipped (H2, H3, M5, M10, L1, L6, L7)._

Prioritized list of what's missing, risky, or ambiguous in the codebase
**as it stands today**.

## Severity key

- **HIGH** — production risk, security, or high-probability user-visible breakage.
- **MED** — correctness, maintainability, or growth blocker.
- **LOW** — polish, hygiene, nice-to-have.

---

## HIGH

### H1. Lead capture isn't actually persisted in either env
**File:** `wrangler.jsonc` L33–L37 (prod), L45–L50 (staging)
**Problem:** Both `kv_namespaces[].id` and `preview_id` are empty strings
in production *and* in `env.staging`. `handleNotify` is written to
**degrade open** — if `env.NOTIFY` is unbound it accepts the submission,
emits a `notify_no_kv` event, and returns `{ ok: true }` (`src/index.js`
L286–L319). Net effect: every install/download soft-gate submission
since the bindings landed has been silently dropped on the floor.
**Fix:** Provision `NOTIFY` (+ `NOTIFY-staging`) with `wrangler kv
namespace create`, paste the IDs into `wrangler.jsonc`, redeploy. The
ratelimit branch *also* short-circuits when KV is missing, so this
unblocks two correctness issues in one move.

---

## MED

### M1. Lead data has no TTL
**File:** `src/index.js` L315 (`env.NOTIFY.put(\`lead:${emailHash}\`, …)`)
**Problem:** `lead:` records are written without `expirationTtl`. PII
retention is unbounded; once the binding from H1 is provisioned, this
becomes a privacy / compliance issue rather than a theoretical one.
**Fix:** Either add an explicit TTL (e.g. `expirationTtl: 60 * 60 * 24 *
540` for ~18 months) or document the retention decision in
`site/src/pages/privacy.astro`. Cross-referenced from `03-security-auth.md`.

### M2. `style-src` retains `'unsafe-inline'` (B-08)
**File:** `src/index.js` L106 (`buildCspHtml`)
**Problem:** The CSP shipped in Sprint 7c removed `'unsafe-inline'` from
`script-src` but kept it on `style-src` because Tailwind 4 emits inline
`style=` attributes (e.g. accent-color overrides, motion-safe transforms).
Until that's gone, an attacker who finds an HTML-injection sink can
exfiltrate via CSS without tripping CSP.
**Fix:** Audit Tailwind utilities that emit inline `style=`; lift them
into the global stylesheet or CSS variables, then drop `'unsafe-inline'`
from `style-src`. Tracked as B-08 in
`roadmap/05-post-sprint-7-backlog.md`.

### M3. CORS allow-list still includes `aidops.dev` / `www.aidops.dev`
**File:** `src/index.js` L42–L43
**Problem:** opchain was extracted from the `aidops` repo. Both aidops
origins remain in `ALLOWED_ORIGINS`, plus the workers.dev default
domain. If aidops no longer cross-fetches the opchain APIs, the
allow-list is permitting cross-site requests that shouldn't exist.
**Fix:** Confirm with the aidops repo whether anything still posts to
`/api/feedback` or `/api/notify`; trim the list if not. Same call for
`opchain-dev.4fstpkkw72.workers.dev`.

### M4. `/api/feedback` has no rate limit
**Problem:** `/api/notify` is rate-limited at 3/60s/IP via KV; `/api/feedback`
isn't. The Linear API key is the upstream cap, and Linear's own throttling
is the practical floor — but a determined sender can flood the Linear
project with junk before that kicks in.
**Fix:** Mirror the `handleNotify` rate-limit pattern (`src/index.js`
L286–L298) on `handleFeedback`. Defer until a feedback-spam incident
actually happens — premature otherwise. This is a "watch list" item,
not a do-now.

### M5. Outbound Linear call has no retry, no User-Agent, no upstream-id correlation
**File:** `src/index.js` L204–L211 (`fetch("https://api.linear.app/graphql", …)`)
**Problem:** A single transient 5xx from Linear drops the user's
feedback. The request also identifies as the default Workers UA and
doesn't surface Linear's response headers, so there's no way to
correlate a failed report from Linear's side.
**Fix:** Add a single retry with ~500ms backoff on 5xx (and document why
we don't retry 4xx). Set `User-Agent: opchain-dev/<version>` from the
build-time `__OPCHAIN_VERSION__`. Forward Linear's request id into the
structured log payload.

### M6. `wrangler.jsonc` `$schema` points at a local `node_modules` path
**File:** `wrangler.jsonc` L2
**Problem:** `"$schema": "node_modules/wrangler/config-schema.json"` only
resolves when `node_modules/` is materialized at the repo root — fine
locally and in CI, broken when the file is opened standalone (e.g. via
GitHub's editor or a fresh clone before `npm install`).
**Fix:** Use the published schema URL the wrangler README recommends.
Same diff also lets editors validate the file pre-install.

---

## LOW

### L1. No browser-level CSP verification in CI (B-09)
**File:** `site/playwright.config.ts`
**Problem:** Playwright runs against `astro preview`, which serves the
static HTML *without* the Worker — so the e2e suite never exercises a
real CSP-served response. A future Tailwind/PostHog change could
re-introduce an `'unsafe-inline'` regression and pass CI.
**Fix:** Swap the Playwright `webServer` to `wrangler dev` so e2e covers
HTML that's been through `applySecurityHeaders`, and assert the console
has no `Refused to execute inline script` errors. Tracked as B-09.

### L2. `Content-Length` is dropped on every HTML response
**File:** `src/index.js` L138–L139
**Problem:** Documented in the source comment: when `applySecurityHeaders`
substitutes the nonce placeholder, the body length usually changes, so
we delete `Content-Length` and rely on Cloudflare adding
`Transfer-Encoding: chunked`. Quiet today, but a future workerd change
could surface it as a regression.
**Fix:** Add a regression test that asserts either a correct
`Content-Length` *or* a present `Transfer-Encoding` on HTML responses.

### L3. Default Linear team / project IDs still hardcoded as fallbacks
**File:** `src/index.js` L25–L26
**Problem:** `LINEAR_TEAM_ID` and `LINEAR_PROJECT_ID` are env-overridable
(`src/index.js` L175–L176), but the production UUIDs are baked in as
defaults. Forgetting to set the env var on a forked deploy posts to the
original opchain Linear project.
**Fix:** Drop the defaults; require the env vars; surface a 503
`not_configured` like the existing API-key path.

### L4. PostHog client init re-fetches on every page nav
**File:** `site/src/components/ConsentBanner.astro` (consent-gated `<script>`)
**Problem:** The site is multi-page Astro static — each route load
re-bootstraps PostHog. Not a correctness issue, but page-view counts
double-fire if a user accepts consent and then navigates.
**Fix:** Verify against PostHog's own docs whether the SDK debounces
this; if not, gate `posthog.init` on a window-level sentinel.

### L5. No dependency-update cadence
**Problem:** No Dependabot / Renovate config in `.github/`. `wrangler`,
`vitest`, `astro`, and `tailwindcss` will drift.
**Fix:** Drop a minimal `.github/dependabot.yml` covering `npm` (root +
`site/`) and `github-actions`.

### L6. Synced docs in `public/docs/` are duplicated content
**File:** `scripts/sync-docs.sh`
**Problem:** `skills/<id>/SKILL.md` is copied verbatim into
`public/docs/<id>/SKILL.md` for the "View raw" link. If the URL ever
changes (e.g. moves under `/docs/skills/`), the install instructions
inside each `SKILL.md` need a coordinated update.
**Fix:** Acceptable for now — flag as a footgun if the docs URL pattern
ever changes.

---

## Resolved since 2026-04-17 (kept for diff-legibility)

| Old item | Status | Notes |
|---|---|---|
| H1 — Hardcoded fallback HMAC secret | RESOLVED | Try-It chat removed in `claude/remove-try-it`; no HMAC surface remains |
| H2 — No CI, no automated tests | RESOLVED | `.github/workflows/ci.yml` (worker + site + Playwright e2e), `lighthouse.yml`, vitest suite |
| H3 — Single environment | RESOLVED | `env.staging` in `wrangler.jsonc`; KV bindings still need IDs (see H1 above) |
| H4 — No input validation on Worker handlers | RESOLVED | Zod schemas in `src/lib/schemas.js`; every POST goes through `parseBody` |
| M2 — Catalog drift across three files | RESOLVED | `scripts/gen-skills-catalog.mjs` validates frontmatter; site reads `skills/` directly via `site/src/content.config.ts` |
| M3 — `architecture.html` and `install.html` are stubs | RESOLVED | Sprint 6 Astro cutover; both pages are full content (337 + 352 lines) |
| M4 — XSS surface in `tryit.js` `renderMarkdown` | RESOLVED | Try-It removed; the chat-transcript renderer in `site/src/lib/markdown.ts` uses `marked` + `isomorphic-dompurify` with an `href` scheme allow-list |
| M5 — Missing CSP/Referrer-Policy/Permissions-Policy | RESOLVED | Sprint 7c CSP + full baseline header set, see `03-security-auth.md` |
| M8 — Anthropic model hardcoded | OBSOLETE | Anthropic surface removed entirely |
| M10 — No per-skill versioning | RESOLVED | `version: x.y.z` is a required field in the Astro content collection schema |
| L1 — No `.env.example` | RESOLVED | Lives at the repo root; referenced in `CLAUDE.md` |
| L6 — Unstructured logs | RESOLVED | `src/lib/request-id.js` + `EVENTS` enum; every event line is JSON |
| L7 — No version identifier on `/api/health` | RESOLVED | `__OPCHAIN_VERSION__` injected by `build.mjs`; surfaced as `version` JSON + `X-Opchain-Version` header |
| L8 — No `robots.txt` / sitemap / OG | RESOLVED | `site/public/robots.txt`, `@astrojs/sitemap` integration, per-route OG image map in `Base.astro` |

## Cross-cutting

- **The skills product itself is not gap-analyzed here.** This document
  scopes to the Worker + site. Skill content quality, prompt drift, and
  pipeline-protocol soundness belong in a separate `/code-auditor /audit
  skills` pass.
- **Documentation surfaces are now plural.** `CLAUDE.md` (repo
  contributor instructions), `site/src/pages/architecture.astro` (public
  architecture page), `reverse-spec-output/` (this folder) all describe
  the same system at different levels of abstraction. When the Worker
  routing changes, all three need updates — a small drift-check script
  in `prebuild` would catch the obvious ones.

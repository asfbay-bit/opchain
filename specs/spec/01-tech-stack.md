# 01 — Tech Stack

_Refreshed 2026-04-28 by `/reverse-spec` targeted update. Replaces the
2026-04-17 version, which described a vanilla-HTML site with no test
runner, no validation library, and an Anthropic SDK in the Worker._

## Current State

| Layer | Choice | Evidence | Rationale (inferred) |
|---|---|---|---|
| Runtime | Cloudflare Workers (`workerd`) | `wrangler.jsonc` L1–L7, `build.mjs` L18 (`conditions: ["workerd", "worker", "browser"]`) | Edge-first, low cold start, fits marketing + lightweight APIs |
| Compat date | `2026-03-01` with `nodejs_compat` flag | `wrangler.jsonc` L5–L6 | Latest runtime APIs; nodejs_compat for `crypto.subtle` + the few Node-style imports |
| Static assets | Workers Assets binding (`ASSETS`) | `wrangler.jsonc` L29–L34 | `run_worker_first: true` so the Worker fronts every route; `not_found_handling: "404-page"` serves the Astro 404 |
| KV | 1 namespace `NOTIFY` (prod + staging) | `wrangler.jsonc` L33–L37, L51–L55 | Rate-limit + lead capture for `/api/notify`. **IDs currently empty strings** — see `gap-analysis.md` H1 |
| Bundler (Worker) | esbuild ^0.28 (ESM, `target: esnext`) | `build.mjs`, `package.json` | Single Worker entry → `dist/index.js`; `__OPCHAIN_VERSION__` injected via `define` |
| Site framework | Astro 5 (`output: "static"`) | `site/astro.config.mjs`, `site/package.json` | Sprint 6 cutover; static HTML served via the Worker's `ASSETS` binding (no Astro SSR adapter active) |
| Site CSS | Tailwind 4 via Vite plugin | `site/package.json` (`@tailwindcss/vite ^4.2.2`), `astro.config.mjs` `vite.plugins` | Replaces the previous hand-written `styles.css` |
| Markdown rendering (UI) | `marked` ^18 + `isomorphic-dompurify` ^3.9 | `site/src/lib/markdown.ts` | Used to render skill markdown / walkthrough transcripts safely; explicit `href` scheme allow-list |
| Validation | Zod ^4.3 | `package.json` `dependencies`, `src/lib/schemas.js` | Every POST endpoint runs through `parseBody(request, schema)` |
| Analytics (server) | PostHog `/capture/` over raw fetch | `src/lib/analytics.js` | No SDK (Workers-incompatible Node shims); fire-and-forget via `ctx.waitUntil` |
| Analytics (client) | PostHog JS, consent-gated | `site/src/components/ConsentBanner.astro`, `site/src/lib/analytics.ts` | Loaded only after explicit accept; uses `PUBLIC_POSTHOG_KEY` env at build time |
| Test runner | Vitest ^4.1 | `package.json`, `tests/*.test.js` | Worker unit + integration coverage (`pretest` regenerates the catalog so a malformed skill fails tests) |
| E2E | Playwright ^1.59 + `@axe-core/playwright` | `site/playwright.config.ts`, `site/tests/e2e/*.spec.ts` | Routes, consent banner, filter UI; axe scans piggyback on the same suite |
| Type-check (site) | `astro check` (TS ^5.6) | `site/package.json` `check` script, `site/tsconfig.json` | CI runs `astro check` on every PR (Worker remains JS) |
| Lighthouse / a11y | `@lhci/cli` ^0.15 | `lighthouserc.cjs`, `.github/workflows/lighthouse.yml` | Per-route thresholds enforced; calibration data inline in the rc file |
| Site adapter dep | `@astrojs/cloudflare` ^12 | `site/package.json` | Currently unused by the build (output is static) — kept for an SSR escape hatch |
| Sitemap | `@astrojs/sitemap` ^3.7 | `astro.config.mjs` | Generates `sitemap-index.xml`; referenced by `site/public/robots.txt` |
| Linear | GraphQL `api.linear.app/graphql` | `src/index.js` L49–L54, L204–L211 | `issueCreate` mutation; raw API key in `Authorization` (Linear convention, no `Bearer`) |
| Package manager | npm | `package-lock.json` (root + `site/`) | Two lockfiles; `cache-dependency-path: site/package-lock.json` in CI |
| Language | JavaScript ESM (Worker), TypeScript (site) | `package.json` `"type": "module"` (no Worker `tsconfig.json`); `site/tsconfig.json` extends Astro strict | Worker stays light; site benefits from typed Astro components |

### Dependencies (root)

- Runtime: `zod ^4.3.6` (only).
- Dev: `esbuild ^0.28`, `vitest ^4.1`, `wrangler ^4.85`, `gray-matter ^4.0` (used by `gen-skills-catalog.mjs`).

### Dependencies (`site/`)

- Runtime: `astro ^5`, `@astrojs/cloudflare ^12`, `@astrojs/sitemap ^3.7`, `marked ^18`, `dompurify ^3.4`, `isomorphic-dompurify ^3.9`.
- Dev: `@astrojs/check ^0.9`, `@axe-core/playwright ^4.11`, `@lhci/cli ^0.15`, `@playwright/test ^1.59`, `@tailwindcss/vite ^4.2`, `tailwindcss ^4.2`, `typescript ^5.6`.

### Data model

There is **no database**. The only stateful store is Cloudflare KV in
the `NOTIFY` namespace with two key shapes:

| Key pattern | Value | TTL | Purpose |
|---|---|---|---|
| `ratelimit:notify:{ip}` | numeric counter | `60s` | Per-IP rate limit on `/api/notify` (max 3) |
| `lead:{sha256(lower(email))}` | JSON record (email, role, teamSize, building, source, ip, userAgent, submittedAt, requestId) | none | Soft-gate lead capture; idempotent upsert (re-submit overwrites) |

The previous `DATA` namespace (used by the removed Try-It chat) is gone
from `wrangler.jsonc`; if any historical key/values still exist in
Cloudflare's account, they're orphaned and can be deleted via
`wrangler kv namespace delete --namespace-id <id>`.

### Confidence

| Claim | Confidence |
|---|---|
| Astro 5 static cutover complete | HIGH — `output: "static"`, `site/dist/` is materialized into `public/` |
| Tailwind 4 in use | HIGH — `@tailwindcss/vite ^4.2.2` in `site/package.json`, no other CSS framework |
| Worker is JS-only (no TypeScript) | HIGH — no `tsconfig.json` at the repo root, no `.ts` under `src/` |
| Zod is the validation surface for every POST | HIGH — direct read of `src/index.js` confirms every handler calls `parseBody(request, schema)` |
| `NOTIFY` KV bindings have empty IDs | HIGH — `wrangler.jsonc` shows literal `""` for both prod and staging |
| Anthropic SDK / API entirely absent | HIGH — `git grep -i anthropic` returns only doc-string references |

## Gaps & Recommendations

- **`NOTIFY` KV IDs are empty.** Both prod and staging
  `kv_namespaces[].id` (and `preview_id`) are `""`. The handler
  degrades open, so submissions are silently dropped on the floor
  rather than throwing. Carried forward as `gap-analysis.md` H1 — fix
  is a one-time `wrangler kv namespace create` per env.
- **Worker stays untyped.** Runtime `import` shape mismatches are
  caught only by Vitest. A `tsconfig.json` at the root with
  `checkJs: true` and `@cloudflare/workers-types` would lift most of
  the win without forcing a `.ts` rewrite.
- **`@astrojs/cloudflare` is installed but unused.** With
  `output: "static"` the adapter never engages. Either drop the dep,
  or document the SSR-escape-hatch intent in `site/README.md` so a
  future contributor doesn't assume SSR is wired up.
- **Two lockfiles, two `node_modules/`.** CI handles both; local
  contributors must remember `npm run site:install` before
  `npm run site:dev`. A short note in `CLAUDE.md` (already there)
  helps; a single root install via npm workspaces would erase the
  footgun entirely. Defer until the next dependency churn.

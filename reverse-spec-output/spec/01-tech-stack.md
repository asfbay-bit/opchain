# 01 — Tech Stack

## Current State

| Layer | Choice | Evidence | Rationale (inferred) |
|---|---|---|---|
| Runtime | Cloudflare Workers (`workerd`) | `wrangler.jsonc` L1–L7, `build.mjs` L9 (`conditions: ["workerd", "worker", "browser"]`) | Edge-first, low cold start, fits marketing + lightweight APIs |
| Compat date | `2026-03-01` with `nodejs_compat` flag | `wrangler.jsonc` L5–L6 | Latest runtime for fetch/streaming APIs; nodejs_compat for `crypto.subtle` + Buffer shims |
| Static assets | Workers Assets binding (`ASSETS`) | `wrangler.jsonc` L12–L17 | Integrated with Worker; uses `run_worker_first: true` so the Worker fronts all routes |
| KV | 1 namespace `DATA` (id `7574667e560c4727bae2da069c9d6f52`) | `wrangler.jsonc` L18–L23 | Used for rate limiting + lead tracking for the Try It demo |
| Bundler | esbuild (ESM, `target: esnext`) | `build.mjs` L3–L11 | Single Worker entry file output → `dist/index.js` |
| Dev runner | `wrangler dev` | `package.json` L7 | Local worker emulation on port 8787 |
| Frontend | Plain HTML + vanilla JS + single CSS file | `public/*.html`, `public/*.js` (no framework imports anywhere) | No build step for the site; maintainable and fast |
| CSS | Single hand-written `styles.css` (669 lines) | `public/styles.css` | No Tailwind, no CSS modules — keeps the site a single cacheable file |
| Package manager | npm (lockfile present) | `package-lock.json` | Default; no yarn/pnpm artifacts |
| Language | JavaScript (ESM) — no TypeScript | `"type": "module"` in `package.json`, no `tsconfig.json`, no `.ts` files | Keeps the Worker lightweight; trade-off: no type safety |
| LLM SDK | Raw `fetch` to Anthropic Messages API (SSE) | `src/opchain-try.js` L356–L370 | Avoids SDK dependency in a Worker; direct control over streaming |
| Feedback API | Linear GraphQL (`api.linear.app/graphql`) | `src/index.js` L51–L56, L136–L143 | Linear is the team's issue tracker |

### Dependencies

- Runtime dependencies: **none** (no `dependencies` block; only `devDependencies`)
- Dev dependencies: `esbuild ^0.24.0`, `wrangler ^4.0.0`

The Worker is bundle-free at runtime beyond the Cloudflare runtime itself — no
`@anthropic-ai/sdk`, no routing framework, no validation library, no test runner.

### Data model

There is **no database**. The only stateful store is Cloudflare KV, with three key
shapes in the `DATA` namespace:

| Key pattern | Value | TTL | Purpose |
|---|---|---|---|
| `opchain-try-ip:{ip}` | `{ count, start }` | `IP_WINDOW_SEC` = 3600 | Per-IP session-creation rate limit (20/hr) |
| `opchain-try-email:{email}` | `{ count }` | `EMAIL_TTL_SEC` = 86400 | Per-email exchange counter (max 5) |
| `opchain-leads:{email}` | `{ email, first_seen, source }` | none (persistent) | Lead capture |

Source: `src/opchain-try.js` L201–L239, L270–L282.

### Confidence

| Claim | Confidence |
|---|---|
| Cloudflare Workers runtime | HIGH — `wrangler.jsonc` |
| No TypeScript | HIGH — absence of tsconfig + `.ts` files |
| No test framework | HIGH — absence of test dirs, no test scripts in package.json |
| KV schema | HIGH — direct observation in opchain-try.js |
| "No database" | HIGH — no migrations/, no ORM config, no SQL files |

## Gaps & Recommendations

- **No TypeScript or type-generation.** The Worker handlers accept arbitrary JSON and
  only spot-check fields. A typed contract (e.g. Zod validators, or TS + generated
  types) would prevent runtime surprises. See `stack-forge-audit.md`.
- **No central config.** Constants like `MAX_EXCHANGES`, `IP_MAX_SESSIONS`, rate-limit
  windows, allowed origins, and skill lists are scattered across `src/index.js` and
  `src/opchain-try.js`. One `src/config.js` module would centralize them.
- **KV id is hardcoded in `wrangler.jsonc`.** Acceptable for a single-env setup, but
  future preview/staging deploys will need a KV binding override.
- **No separation between prod and preview `DATA` bindings.** If someone runs
  `wrangler dev` against production-bound KV, they'd read/write real lead data.

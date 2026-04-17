# 07 — DevOps, Deployment, Observability

## Current State

### Environments

There is **one** environment: production, on Cloudflare Workers, worker name
`opchain-dev`, custom domain `opchain.dev` (default domain also active at
`opchain-dev.4fstpkkw72.workers.dev`).

No staging environment, no preview environment, no per-branch deploys configured.

Source: `wrangler.jsonc`, `CLAUDE.md` Deployment section.

### Build pipeline

| Step | Command | What runs |
|---|---|---|
| 1. Sync skill docs | `bash scripts/sync-docs.sh` | Copies `skills/*/SKILL.md` → `public/docs/<skill>/SKILL.md` |
| 2. Bundle skills ZIP | `bash scripts/make-skills-zip.sh` | Creates `public/opchain-skills.zip` with all SKILL.md files |
| 3. Bundle Worker | `node build.mjs` | esbuild `src/index.js` → `dist/index.js` (ESM, workerd target) |

`npm run prebuild` runs steps 1 and 2; `npm run build` invokes step 3 after `prebuild`.

`wrangler.jsonc` also declares `build.command = "node build.mjs"`, so `wrangler deploy`
will re-run esbuild; `no_bundle: true` ensures wrangler doesn't re-bundle on top of
the esbuild output.

### Deploy

- `npm run deploy` → runs the build, then `wrangler deploy`.
- `npm run deploy:skip-build` → `wrangler deploy --no-build`, useful if `dist/` is
  already fresh.
- No deploy script handles git tagging, version bumping, or changelog generation.

### Dev

- `npm run dev` → `wrangler dev` on port 8787 (inferred default).
- `.dev.vars` provides secrets locally; not checked in.

### Observability

- `wrangler.jsonc` sets `observability.enabled = true`, so Cloudflare Logs
  (request-level) is on.
- Structured logging: none. The Worker uses `console.error` for Linear failures
  (`src/index.js` L155) and for streaming errors (`src/opchain-try.js` L372, L378,
  L429). These appear in `wrangler tail` and Cloudflare Logs but aren't tagged.
- Health check: `GET /api/health` returns `{ ok: true, service: "opchain-dev" }`.
- No external monitoring (no Sentry, no Datadog, no PagerDuty).
- No uptime checks configured in-repo.

### Secrets

Per `CLAUDE.md`:

- `LINEAR_API_KEY` — Linear GraphQL API key.
- `ANTHROPIC_API_KEY` — Claude API key for Try It.
- `DEPLOY_API_TOKEN` — HMAC signing secret for session tokens.

Stored in `.dev.vars` locally, in the Cloudflare Workers dashboard for production.
No `.env.example` file exists — env var names must be discovered by reading the code.

### Asset caching

- ZIP responses: `Cache-Control: public, max-age=3600` (`src/index.js` L215).
- All other static assets: default Workers Assets caching (no explicit headers set by
  the Worker; relies on platform defaults).
- `assets.not_found_handling = "404-page"` — Workers Assets serves a 404 page when an
  asset isn't found (`wrangler.jsonc` L15).
- `assets.run_worker_first = true` — the Worker routes before assets, enabling the
  `/` → `/index.html` and `.zip` header logic (`wrangler.jsonc` L16).

### CI/CD

None. Deployment is manual via `npm run deploy`. No GitHub Actions, no Cloudflare
Git integration visible in the repo (no `.github/`).

### Cost estimate

Workers Free tier allows 100k requests/day. With 2 KV namespaces reads/writes per
Try It exchange and current per-email limit of 5 exchanges, cost scales linearly
with Try It usage. Anthropic API cost is the dominant expense under any realistic
traffic (Haiku 4.5 token pricing × streamed content).

No line-item cost modeling exists in the repo.

### Confidence

| Claim | Confidence |
|---|---|
| Single environment | HIGH |
| No CI | HIGH |
| esbuild builds the Worker | HIGH |
| Observability is enabled at Cloudflare level only | HIGH |
| Secrets documented in CLAUDE.md only | HIGH |

## Gaps & Recommendations

| Finding | Impact | Fix |
|---|---|---|
| **No staging env** — every deploy goes to production | HIGH | Add a `staging` Wrangler environment with a distinct worker name + KV namespace (preview id) |
| **No CI** — nothing gates a bad build from reaching prod | HIGH | Add a GitHub Actions workflow: `npm ci && npm run build` on PR; `wrangler deploy` with OIDC on `main` merge |
| **No `.env.example`** | MEDIUM | Add one with commented-out values matching `CLAUDE.md` |
| **No rollback script** | MEDIUM | Document `wrangler rollback` procedure + keep the previous `dist/index.js` committed or tagged |
| **No smoke test post-deploy** | MEDIUM | Run a simple script that pings `/api/health` and asserts the build hash/version header |
| **No version header** | LOW | Inject a build-time `X-Opchain-Version` with a short git SHA for debuggability |
| **`wrangler.jsonc` KV id is production** | LOW-MED | Use `preview_id` for `wrangler dev` to avoid touching prod KV |
| **`observability.enabled` is coarse** | LOW | Consider per-request structured log lines with a stable schema |
| **No dependency update cadence** | LOW | Dependabot or Renovate on `esbuild` + `wrangler` |

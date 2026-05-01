# 07 — DevOps, Deployment, Observability

> **Refreshed 2026-04-27** — superseded the previous "no CI, single env" finding.
> See `specs/drift-report.md` for what closed.

## Current State

### Environments

Two environments, both on Cloudflare Workers, both with `custom_domain: true`
so Cloudflare manages DNS automatically on `wrangler deploy`:

| Env | Worker name | URL | KV namespace id |
|---|---|---|---|
| Production | `opchain-dev` | `opchain.dev` | `7574667e560c4727bae2da069c9d6f52` |
| Staging | `opchain-staging` | `staging.opchain.dev` | `6156bc3d5a5c4bd780f3d2667950e703` |
| Preview (local `wrangler dev`) | n/a | `localhost:8787` | `93c4a01577774dd2864581ba6444df8c` |

Source: `wrangler.jsonc` L24, L40–L57.

### Deploy flow (manual)

Per `CLAUDE.md` — deploys are run from a developer laptop with `wrangler login`
already done. There is no automated CI deploy:

```
feature branch ─► PR ─► CI green (tests only) ─► merge to main
                                                       │
                                                       ▼
                                       (you, on your laptop)
                                       npm run deploy:staging
                                                       │
                                                       ▼
                                            staging.opchain.dev
                                                       │
                                       (you, in a browser, eyeball it)
                                                       │
                                                       ▼
                                            npm run deploy
                                                       │
                                                       ▼
                                                opchain.dev
```

CLAUDE.md notes that a previous `deploy.yml` / `promote.yml` was removed because
the GitHub Actions Cloudflare API token couldn't reliably manage routes/DNS in
the `opchain.dev` zone (`error 100117` on externally-managed records). A
logged-in human in `wrangler` uses the full account session and avoids the
token-scope problem.

### Build pipeline

`npm run prebuild` (chained into `dev`, `deploy`, `deploy:staging`):

| Step | Command | Output |
|---|---|---|
| 1 | `npm run gen-catalog` | `public/skills.js` + `src/generated/skill-prompts.js` |
| 2 | `npm run sync-docs` | `public/docs/<skill>/SKILL.md` |
| 3 | `npm run make-zip` | `public/opchain-skills.zip` |
| 4 | `npm run build-site` | `site/dist/` → copied into `public/` |

Then `node build.mjs` bundles `src/index.js` → `dist/index.js` (esbuild, ESM,
workerd target). `build.mjs` injects `__OPCHAIN_VERSION__` via esbuild's
`define` from `OPCHAIN_VERSION` env or `git rev-parse --short HEAD`, falling
back to `"dev"`.

`wrangler.jsonc` declares `build.command = "node build.mjs"`, so `wrangler
deploy` re-runs esbuild; `no_bundle: true` ensures wrangler doesn't re-bundle on
top.

### Dev

- `npm run dev` → `npm run prebuild && wrangler dev` on `localhost:8787`.
- `.dev.vars` provides secrets locally; not checked in. `.env.example`
  documents the required keys.

### Observability

- `wrangler.jsonc` sets `observability.enabled = true` — Cloudflare Logs
  request-level capture is on for both prod and staging.
- **Version stamp** — `__OPCHAIN_VERSION__` is surfaced in `GET /api/health`
  (`version` JSON field) AND as an `X-Opchain-Version` response header. Manual
  post-deploy verification is `curl -sS https://staging.opchain.dev/api/health`
  and confirming the SHA matches the local commit.
- **Structured analytics** — `src/lib/analytics.js` captures server-side events
  to PostHog when `POSTHOG_PROJECT_API_KEY` is set. Env-gated; unset → no-op.
- **Client analytics** — Astro layout boots PostHog client-side via
  `PUBLIC_POSTHOG_KEY` + `PUBLIC_POSTHOG_HOST`, gated by the consent banner
  (`site/src/components/ConsentBanner.astro`).
- **Request IDs** — `src/lib/request-id.js` mints a per-request id propagated
  to upstream calls (Linear, Anthropic) and into log lines.
- No external alerting (no Sentry, no Datadog, no PagerDuty). No uptime
  checks configured in-repo.

### Secrets

Documented in `.env.example` and `CLAUDE.md`:

- `LINEAR_API_KEY` — Linear GraphQL API key (feedback endpoint)
- `LINEAR_TEAM_ID`, `LINEAR_PROJECT_ID` — optional Linear overrides
- `ANTHROPIC_API_KEY` — Claude API key for Try It
- `ANTHROPIC_MODEL` — optional, defaults to `claude-haiku-4-5-20251001`
- `DEPLOY_API_TOKEN` — HMAC signing secret. **Required.** Unset → 503.
- `POSTHOG_PROJECT_API_KEY`, `POSTHOG_HOST` — server analytics
- `PUBLIC_POSTHOG_KEY`, `PUBLIC_POSTHOG_HOST` — client analytics
- `LEAD_TTL_DAYS` — KV TTL on Try-It leads (default 365)

Stored in `.dev.vars` locally; in the Cloudflare Workers dashboard or via
`wrangler secret put` for staging + production.

### Asset caching

- ZIP responses: `Cache-Control: public, max-age=3600` (`src/index.js`).
- All other static assets: default Workers Assets caching.
- `assets.not_found_handling = "404-page"`.
- `assets.run_worker_first = true` — Worker routes first, then assets.

### CI/CD

`.github/workflows/ci.yml` runs on every PR and push to `main`:

1. `actions/checkout@v6`, `actions/setup-node@v6`
2. `npm ci`
3. `npm test` (Vitest)
4. `astro check`
5. `npm run build-site`
6. Playwright e2e against the built site

`.github/workflows/lighthouse.yml` runs LHCI on PR builds and posts a
per-route score summary as a PR comment.

CI does **not** deploy. Deploy is manual, see above.

### Rollback

Per `CLAUDE.md`:

```bash
npx wrangler deployments list      # find last good deployment id
npx wrangler rollback <id>         # reverts the Worker (~30s propagation)
```

No automated rollback trigger; this is a human-in-the-loop step.

### Cost

- Workers Free tier covers 100k requests/day. Site + skills downloads sit well
  under that.
- Anthropic Haiku 4.5 token cost dominates Try-It usage.
- KV reads/writes per Try-It exchange are bounded by the 5-exchange / per-email
  rate limit + IP rate limit.
- No line-item cost modeling in the repo.

### Confidence

| Claim | Confidence |
|---|---|
| Two environments (prod + staging) | HIGH |
| Manual deploy, no CI deploy | HIGH — CLAUDE.md is explicit |
| `__OPCHAIN_VERSION__` is the deployment identity | HIGH — `build.mjs` + `health.test.js` |
| LHCI runs on PRs only | HIGH — `lighthouse.yml` |
| Rollback is a documented manual step | HIGH — CLAUDE.md |

## Gaps & Recommendations

| Finding | Severity | Fix |
|---|---|---|
| **No automated post-deploy smoke** | MED | Add a small wrapper around `npm run deploy:staging` that calls `/api/health` and asserts the version SHA before returning success. Same for prod. |
| **No nightly LHCI / synthetic monitoring** | MED | Cron a daily LHCI run against staging + prod, alert on regression. Or add an external uptime check (Better Stack, UptimeRobot). |
| **No structured incident runbook** | MED | The rollback steps live in CLAUDE.md but there's no runbook for "Linear API down", "Anthropic 5xx burst", "rate-limit accidentally tripped legitimate user". Recommend a `runbooks/` directory. |
| **No dependency-update review cadence beyond Dependabot PRs** | LOW | Dependabot is already opening PRs (PRs #95–98 visible at time of writing). Add a weekly merge ritual or auto-merge for green minor bumps. |
| **`wrangler.jsonc $schema` uses local `node_modules` path** | LOW | Replace with the public schema URL so the file is meaningful when viewed outside the repo. |
| **No deployment audit log** | LOW | `wrangler deployments list` works but isn't archived. A simple shell script that appends each deploy's SHA + timestamp to `roadmap/deploy-log.md` would create the audit trail. |

# 07 — DevOps, Deployment, Observability

_Refreshed 2026-04-28 by `/reverse-spec` targeted update. Replaces the
2026-04-17 version, which described a single-environment deploy with
no CI, no version stamp, no `.env.example`, and Anthropic among the
secrets. All of those have moved._

## Current State

### Environments

| Env | Worker name | URL | KV `NOTIFY` |
|---|---|---|---|
| Production | `opchain-dev` | `opchain.dev` (custom domain) + `opchain-dev.4fstpkkw72.workers.dev` (default) | Binding declared, **id empty** — provision via `wrangler kv namespace create NOTIFY` |
| Staging | `opchain-staging` | `staging.opchain.dev` (custom domain) | Binding declared, **id empty** — provision via `wrangler kv namespace create NOTIFY-staging` |

Both environments use `custom_domain: true`. Cloudflare manages the
DNS record automatically on `wrangler deploy`; **do not pre-create a
CNAME** — wrangler refuses the takeover with `error 100117 Hostname …
already has externally managed DNS records`. This is documented at
`wrangler.jsonc` L11–L18 and in `CLAUDE.md`.

Source: `wrangler.jsonc` (full file), `CLAUDE.md` Deployment section.

### Deploy posture

**Deploys are manual**, run from a developer laptop with `wrangler
login` already done. There is no automated deploy path in CI; the
previous `deploy.yml` and `promote.yml` workflows were removed
because the GitHub Actions Cloudflare token couldn't reliably manage
the routes/DNS in the `opchain.dev` zone, leaving bindings in a
broken state. A logged-in human session has full account access and
sidesteps the whole token-scope class of problem.

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

Source: `CLAUDE.md` "Deploy flow", `package.json` scripts.

### Build pipeline

`npm run prebuild` chains the four steps that materialize the deploy
inputs:

| Step | Command | What runs |
|---|---|---|
| 1. Generate skill catalog | `node scripts/gen-skills-catalog.mjs` | Validates `skills/<id>/SKILL.md` frontmatter; asserts `name === <dir>` |
| 2. Sync skill docs | `bash scripts/sync-docs.sh` | Copies `skills/<id>/SKILL.md` → `public/docs/<id>/SKILL.md` |
| 3. Build skills ZIPs | `bash scripts/make-skills-zip.sh` | Emits combined `public/opchain-skills.zip` plus per-skill `public/skills/<id>.zip` |
| 4. Build the site | `bash scripts/build-site.sh` | `cd site && astro build`; snapshots `public/{docs,opchain-skills.zip}`, wipes `public/`, copies `site/dist/` over, restores the snapshot, runs `inject-nonce-placeholder.mjs` |

`npm run build` runs `prebuild` then `node build.mjs` (esbuild →
`dist/index.js`). `npm run deploy` runs `prebuild` then
`wrangler deploy`. `wrangler.jsonc` also declares
`build.command = "node build.mjs"` so `wrangler deploy` re-runs
esbuild; `no_bundle: true` ensures wrangler doesn't re-bundle on top.

### Version stamp

`build.mjs` injects `__OPCHAIN_VERSION__` via esbuild `define`,
sourced from:

1. `OPCHAIN_VERSION` env var (CI sets it to `${{ github.sha }}`).
2. `git rev-parse --short HEAD` (local).
3. The literal string `"dev"` (fallback).

The Worker surfaces it on every response:

- `GET /api/health` returns `{ ok, service, version }` and an
  `X-Opchain-Version` header (`src/index.js` L357–L368).
- All other responses still get the underlying `__OPCHAIN_VERSION__`
  string available inside the bundle for log lines.

Sanity check after a deploy:

```bash
curl -sS https://staging.opchain.dev/api/health
# → { "ok": true, "service": "opchain-dev", "version": "<short-sha>" }
```

### Dev / local

- `npm run dev` → `npm run prebuild` then `wrangler dev` on `localhost:8787`.
- `.dev.vars` provides secrets locally; gitignored.
- `.env.example` at the repo root lists every env var with a one-line
  comment per group (Linear, Notify, PostHog).
- Local `wrangler dev` reads/writes the **same KV namespace** the
  bound env points at. Today both prod and staging have empty IDs, so
  the binding is missing in `wrangler dev` and the handler falls
  through its degrade-open path. Once IDs are filled, the
  `preview_id` slot (already declared in `wrangler.jsonc`) needs to be
  populated via `wrangler kv namespace create NOTIFY --preview` to
  keep local writes off prod.

### Observability

| Aspect | Value |
|---|---|
| Cloudflare Logs | `observability.enabled = true` in `wrangler.jsonc` |
| Structured logging | `src/lib/request-id.js` — every event is a single JSON line with `level`, `ts`, `request_id`, `event` plus event-specific fields |
| Event taxonomy | `EVENTS` enum: `feedback_submitted`, `feedback_failed`, `notify_captured`, `notify_ratelimited`, `notify_no_kv`, `rate_limit_hit`, `upstream_failed`, `validation_failed` |
| Request id correlation | Every request gets a fresh UUID (or honours an inbound `X-Opchain-Request-Id`); echoed back via `X-Opchain-Request-Id` and exposed via CORS |
| Health check | `GET /api/health` (free-tier monitoring service of choice can hit this) |
| Analytics | PostHog (server fire-and-forget + consent-gated client). See `04-integrations.md` |
| External monitoring | None (no Sentry, Datadog, PagerDuty) |
| In-repo uptime checks | None |

### Secrets

Set via Cloudflare dashboard or `wrangler secret put`. Local: `.dev.vars`.

| Secret | Purpose | Required? |
|---|---|---|
| `LINEAR_API_KEY` | `/api/feedback` Linear access | Required for feedback to function (otherwise `503 not_configured`) |
| `LINEAR_TEAM_ID` | Override default Linear team | Optional |
| `LINEAR_PROJECT_ID` | Override default Linear project | Optional |
| `POSTHOG_PROJECT_API_KEY` | Server-side analytics capture | Optional — unset means analytics is a silent no-op |
| `POSTHOG_HOST` | PostHog endpoint | Optional, defaults to `https://eu.i.posthog.com` |
| `PUBLIC_POSTHOG_KEY` | Client-side PostHog (Astro build-time `import.meta.env`) | Optional |
| `PUBLIC_POSTHOG_HOST` | Client-side PostHog endpoint | Optional |

`ANTHROPIC_API_KEY` and `DEPLOY_API_TOKEN` were the Try-It chat's
secrets; both are gone. If still set in the Cloudflare dashboard
they're inert — safe to delete.

### Asset caching

- ZIP responses: `Cache-Control: public, max-age=3600`
  (`src/index.js` L430).
- Other static assets: default Workers Assets caching (Cloudflare
  fingerprints + edge cache; no explicit `Cache-Control` set by the
  Worker).
- `assets.not_found_handling = "404-page"` — Workers Assets serves
  the Astro `404.astro`-built page for unknown paths.
- `assets.run_worker_first = true` — the Worker fronts every route,
  enabling redirects, CSP nonce substitution, and the ZIP
  `Content-Disposition` decoration.

### Rollback

```bash
npx wrangler deployments list           # find the last good deployment id
npx wrangler rollback <deployment-id>   # reverts the Worker
```

Cloudflare serves the previous code within ~30s. Documented in
`CLAUDE.md`.

### Confidence

| Claim | Confidence |
|---|---|
| Two environments (prod + staging) | HIGH — `wrangler.jsonc env.staging` + `npm run deploy:staging` |
| Deploys are manual, not via CI | HIGH — `CLAUDE.md` documents the explicit rationale; no `wrangler deploy` step in any workflow |
| Version stamp is a real git SHA | HIGH — `build.mjs` `getVersion()` chain; CI sets `OPCHAIN_VERSION=github.sha` |
| Structured JSON logs | HIGH — every `EVENTS.*` call goes through `emit()` in `src/lib/request-id.js` |
| KV bindings exist but ids are unset | HIGH — direct read of `wrangler.jsonc` |

## Gaps & Recommendations

| Finding | Impact | Fix |
|---|---|---|
| **`NOTIFY` KV ids are empty in both envs** | HIGH | Provision via `wrangler kv namespace create` for prod, staging, and `--preview`; paste IDs into `wrangler.jsonc`. Tracked as `gap-analysis.md` H1 |
| **No automated post-deploy smoke test** | MEDIUM | Wire `scripts/smoke.sh` into a "deploy reminder" — e.g. a `npm run smoke:staging` script that the deployer runs by hand. The script already retries; what's missing is the muscle memory |
| **No external uptime monitoring** | MEDIUM | The `/api/health` endpoint is up and stamped; cheapest fix is a Better Uptime / UptimeRobot ping every minute, alert via email |
| **`wrangler.jsonc` `$schema` resolves to `node_modules/`** | LOW | Use a published URL so editors validate the file pre-install. Carried forward as `gap-analysis.md` M6 |
| **No Dependabot / Renovate** | LOW | Dependency drift bites quietly; a minimal config covering `npm` (root + `site/`) and `github-actions` is one file. Tracked as `gap-analysis.md` L5 |
| **Staging KV writes are also unbound** | LOW | Once H1 is fixed, ensure staging gets its own namespace (not a shared id with prod). Already structurally separated in `wrangler.jsonc`; just needs the actual `wrangler kv namespace create NOTIFY-staging` |

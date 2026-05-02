# opchain.dev

Marketing site + skill showcase for opchain — a set of interconnected Claude Code skills 
that form a software development pipeline (concept → spec → design → build → deploy).

## Deployment

Deploys are **manual**, run from a developer laptop with `wrangler login` already done. There is no automatic CI/CD path — `deploy.yml` and `promote.yml` were removed because the GitHub Actions Cloudflare token couldn't reliably manage routes/DNS in the `opchain.dev` zone, which left the bindings in a broken state. Deploying as a logged-in human in `wrangler` uses your full account session and avoids that whole class of token-scope issue.

- **Production Worker:** `opchain-dev` on Cloudflare Workers, served at `opchain.dev`.
- **Staging Worker:** `opchain-staging`, served at `staging.opchain.dev`. See `wrangler.jsonc env.staging`.
- **Both** use `custom_domain: true` — Cloudflare manages DNS automatically on `wrangler deploy`. Do not pre-create CNAMEs manually (Cloudflare refuses to take over externally-managed records: `error 100117`).
- **Version stamp:** `build.mjs` injects `__OPCHAIN_VERSION__` via esbuild `define`, sourced from `OPCHAIN_VERSION` env var or `git rev-parse --short HEAD`. Surfaced in `GET /api/health` (`version` JSON field + `X-Opchain-Version` response header on that route).

### Deploy flow

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

- `npm run deploy:staging` → `wrangler deploy --env staging`
- `npm run deploy` → `wrangler deploy` (production)
- After each deploy, sanity-check by hand: `curl -sS https://staging.opchain.dev/api/health` and confirm `version` matches your local commit SHA.

### CI

`.github/workflows/ci.yml` runs on every PR and push to main: Vitest, `astro check`, site build, Playwright e2e. CI does not deploy anything — it only verifies the build is green before you decide to ship.

`.github/workflows/lighthouse.yml` runs Lighthouse/Axe budgets on PR builds (not against deployed environments).

### Rollback

If a manual deploy breaks production:

1. `npx wrangler deployments list` — find the last good deployment id.
2. `npx wrangler rollback <deployment-id>` — reverts the Worker.
3. Cloudflare serves the previous code within ~30s.

## Repo Layout

```
opchain/
├── src/                    # Cloudflare Worker source
│   ├── index.js            # Router: static assets, feedback API, 301 redirects
│   └── lib/                # Shared worker libs (schemas, kv, retry, analytics, request-id)
├── site/                   # Astro 5 app — the whole site lives here now.
│   ├── src/pages/          # Every route: /, /architecture, /skills, /skills/[id], /install, /demo, /privacy, /404
│   ├── src/components/     # FeedbackWidget, ConsentBanner, Header, Footer, Replays, UI kit
│   ├── src/layouts/        # Base.astro (head, theme init, analytics beacon)
│   └── dist/               # Built static HTML — gitignored
├── public/                 # BUILD OUTPUT — gitignored. Materialized by scripts/build-site.sh.
│   ├── (astro dist copied in)
│   ├── opchain-skills.zip  # Generated from skills/ by scripts/make-skills-zip.sh
│   └── docs/               # Synced from skills/ by scripts/sync-docs.sh
├── skills/                 # Skill source definitions (the product)
│   ├── app-architect/
│   ├── checkpoint-protocol/
│   ├── code-auditor/
│   ├── deploy-ops/
│   ├── git-ops/
│   ├── integrations-engineer/
│   ├── reverse-spec/
│   ├── scale-ops/
│   ├── stack-forge/
│   ├── ux-engineer/
│   ├── orchestrator.md     # Shared orchestration rules
│   └── README.md           # Installation instructions
├── site/                   # Astro 5 app. Scaffolded Sprint 0; content collection in Sprint 1; cutover Sprint 6.
├── scripts/
│   ├── sync-docs.sh                # skills/ → public/docs/ sync
│   ├── make-skills-zip.sh          # skills/ → public/opchain-skills.zip
│   └── gen-skills-catalog.mjs      # validates skills/<id>/SKILL.md frontmatter at build time
├── tests/                  # Vitest unit + handler tests
├── .github/workflows/      # ci.yml + lighthouse.yml (no deploy workflows — manual)
├── wrangler.jsonc           # Worker config (prod + env.staging)
├── build.mjs               # esbuild: src/index.js → dist/index.js, injects __OPCHAIN_VERSION__
├── vitest.config.js        # test runner config (defines __OPCHAIN_VERSION__ = "test")
├── .env.example            # env var template (copy to .dev.vars for local)
└── package.json
```

## Key Commands

```bash
# Worker (current production) ————————————————————————————————————
npm run dev              # prebuild then wrangler dev on localhost:8787
npm run build            # prebuild (gen-catalog + sync-docs + make-zip) → esbuild → dist/
npm run deploy           # wrangler deploy (production)
npm run deploy:staging   # wrangler deploy --env staging (staging.opchain.dev)
npm test                 # vitest unit + integration-ish suite
npm run gen-catalog      # validates skills/<id>/SKILL.md frontmatter at build time
npm run sync-docs        # skills/ → public/docs/ (runs in prebuild)
npm run make-zip         # skills/ → public/opchain-skills.zip (runs in prebuild)

# New Astro site (Sprint 0 scaffold; real pages land Sprints 1-3) —
npm run site:install     # one-time: cd site && npm install
npm run site:dev         # astro dev on localhost:4321
npm run site:build       # astro build → site/dist
```

## API Routes

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/health` | Health check (with optional flag-overrides summary) |
| GET | `/api/flags/public` | Public-flag map for the browser; sets `oc_id` cookie |
| POST | `/api/feedback` | Create Linear issue (bug/feature/improvement) |
| POST | `/api/notify` | Lead capture (KV-backed) |
| GET | `/*` | Static assets from `public/` |

The email-gated Try-It chat (`POST /api/try/start` + `POST /api/try/chat`)
was removed in `claude/remove-try-it`. Old client requests now get a 410
Gone response; legacy `/tryit` and `/tryit.html` paths 301 to `/demo`.

## Environment Variables

Template lives in `.env.example`. Copy to `.dev.vars` for local dev; set in the Cloudflare dashboard (or via `wrangler secret put`) for staging + production.

- `LINEAR_API_KEY` — Linear API key for feedback endpoint
- `LINEAR_TEAM_ID`, `LINEAR_PROJECT_ID` — optional overrides for the default team/project
- `POSTHOG_PROJECT_API_KEY`, `POSTHOG_HOST` — server-side analytics capture. Env-gated; unset → no-op.
- `PUBLIC_POSTHOG_KEY`, `PUBLIC_POSTHOG_HOST` — client-side PostHog (consent-gated via `ConsentBanner.astro`).

CI deploy needs two GitHub Actions secrets at the repo level:

- `CLOUDFLARE_API_TOKEN` — Wrangler API token with Workers deploy scope
- `CLOUDFLARE_ACCOUNT_ID` — the opchain Cloudflare account id

## Important Notes

- **The site is Astro 5 in static mode** (Sprint 6). Pages, components, content collection for skills live in `site/`. `npm run prebuild` runs `astro build` and copies `site/dist/` into `public/`, then the Worker serves everything through the ASSETS binding. Nothing in `public/` is source-of-truth any more — it's gitignored.
- **Skill catalog validation runs on every build.** `scripts/gen-skills-catalog.mjs` reads `skills/<id>/SKILL.md` frontmatter and asserts required fields are present and the directory name matches `frontmatter.name`. The Astro site reads `skills/` directly via `site/src/content.config.ts`; there is no longer a separate codegen step.
- **Skill docs** in `public/docs/` are synced from `skills/` via `sync-docs.sh`. Edit the source in `skills/`, the copy regenerates on build.
- **styles.css** has all component styles inline — no CSS modules, no preprocessor.
- **URL paths in HTML** use root-relative paths (e.g., `/styles.css`, `/docs/app-architect/SKILL.md`). These were previously `/opchain/styles.css` etc. when hosted under aidops.dev — they've been updated for standalone hosting.

## Feature flags

Single source of truth: **`src/lib/flags/registry.js`**. Every flag has a name, type, default, owner, category, and description. Hierarchy is dot-namespaced:

- `site.ui.*` / `site.feature.*` / `site.experiment.*` — surface, page, A/B
- `site.ops.*.kill` — ops kill switches (default false; on → degrade gracefully)
- `site.consent.*` — consent / privacy
- `skills.registry.<id>.enabled` — per-skill visibility (one per `skills/<id>/`)
- `skills.capability.*` — cross-cutting (tri-agent, checkpoint-protocol)
- `skills.command.<verb>.enabled` — slash-command verb gates (subcommands inherit)
- `skills.experiment.<id>.<feature>` — experimental skill behaviour
- `platform.observability.*` / `platform.security.*` — infra-level toggles

Evaluation is layered (default → wrangler env override → PostHog `/decide`). PostHog is the runtime backend; flag values flip without a redeploy. When PostHog is unconfigured or unreachable, the registry default wins (fail-closed). The Worker helper is `evalFlag(name, { env, ctx, distinctId })` — see `src/lib/flags/eval.js`. Per-request memoisation keeps cost to one PostHog call per request.

The site receives a `<meta name="opchain-flags">` snapshot of public defaults at build time (`Base.astro`), then `site/src/lib/flags/client.ts` layers PostHog overrides post-consent. Server-only flags never leak to the browser — see `PUBLIC_FLAG_NAMES` in the registry.

Env-var override naming: `site.ops.api-feedback.kill` → `FLAG_SITE_OPS_API_FEEDBACK_KILL`. Booleans accept `true`/`false`/`1`/`0`. Useful for staging-only kill switches.

`scripts/gen-flags.mjs` mirrors the registry into `site/src/lib/flags/registry.ts` (typed, gitignored). `scripts/gen-skills-catalog.mjs` validates that every `flags.required` / `flags.exposes` / command verb in a `SKILL.md` has a corresponding registry entry — build fails on drift.

## Relationship to aidops

This repo was extracted from `aidops/platform/public/opchain/`. 
The aidops repo no longer owns opchain code. Changes to opchain.dev happen here and deploy via 
`npm run deploy` directly to the `opchain-dev` worker.

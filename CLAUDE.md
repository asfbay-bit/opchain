# opchain.dev

Marketing site + skill showcase for opchain — a set of interconnected Claude Code skills 
that form a software development pipeline (concept → spec → design → build → deploy).

## Deployment

- **Production Worker:** `opchain-dev` on Cloudflare Workers
- **Production URL:** https://opchain-dev.4fstpkkw72.workers.dev (custom domain: opchain.dev)
- **Staging Worker:** `opchain-staging` (see `wrangler.jsonc env.staging`; CNAME + KV ids require one-time setup)
- **Staging URL:** https://staging.opchain.dev (planned)
- **Deploy:** `npm run deploy` (production) / `npm run deploy:staging`
- **CI:** `.github/workflows/ci.yml` runs on every PR (test + build + catalog verify). `deploy.yml` pushes main to staging automatically; production requires manual `workflow_dispatch` approval.
- **Version stamp:** the build injects `__OPCHAIN_VERSION__` (short git SHA) via esbuild `define`. Visible in `GET /api/health` and the `X-Opchain-Version` response header.

## Repo Layout

```
opchain/
├── src/                    # Cloudflare Worker source
│   ├── index.js            # Router: static assets, feedback API, try-it API
│   └── opchain-try.js      # Email-gated AI chat demo (SSE streaming)
├── public/                 # Static site (served by Worker via ASSETS binding)
│   ├── index.html          # Introduction page
│   ├── architecture.html   # Architecture overview
│   ├── skills.html         # Skill Library (interactive browser)
│   ├── install.html        # Installation guide
│   ├── tryit.html          # Try It demo UI
│   ├── styles.css          # Shared stylesheet (dark theme, all components)
│   ├── skills.js           # Skill metadata array
│   ├── skills-app.js       # Skill card renderer + filter logic
│   ├── tryit.js            # Try It chat UI + SSE client
│   ├── opchain-skills.zip  # Downloadable skill bundle
│   └── docs/               # Synced SKILL.md files (one per skill)
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
│   └── gen-skills-catalog.mjs      # skills/<id>/SKILL.md + TRYIT.md → public/skills.js + src/generated/skill-prompts.js
├── tests/                  # Vitest unit + handler tests
├── .github/workflows/      # ci.yml + deploy.yml
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
npm run gen-catalog      # skills/<id>/SKILL.md + TRYIT.md → public/skills.js + src/generated/skill-prompts.js
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
| GET | `/api/health` | Health check |
| POST | `/api/feedback` | Create Linear issue (bug/feature/improvement) |
| POST | `/api/try/start` | Email submission → session token |
| POST | `/api/try/chat` | Streaming AI chat (SSE, 5 exchanges max) |
| GET | `/*` | Static assets from `public/` |

## Environment Variables

Template lives in `.env.example`. Copy to `.dev.vars` for local dev; set in the Cloudflare dashboard (or via `wrangler secret put`) for staging + production.

- `LINEAR_API_KEY` — Linear API key for feedback endpoint
- `LINEAR_TEAM_ID`, `LINEAR_PROJECT_ID` — optional overrides for the default team/project
- `ANTHROPIC_API_KEY` — Claude API key for Try It chat
- `ANTHROPIC_MODEL` — optional override, defaults to `claude-haiku-4-5-20251001`
- `DEPLOY_API_TOKEN` — HMAC secret for session token signing. **Required.** If unset, `/api/try/start` and `/api/try/chat` return 503 (fail-closed, no fallback).
- `POSTHOG_PROJECT_API_KEY`, `POSTHOG_HOST` — server-side analytics capture. Env-gated; unset → no-op.
- `PUBLIC_POSTHOG_KEY`, `PUBLIC_POSTHOG_HOST` — client-side PostHog (consent-gated via `ConsentBanner.astro`).
- `LEAD_TTL_DAYS` — optional, defaults to 365. Controls KV TTL for Try-It lead records.

CI deploy needs two GitHub Actions secrets at the repo level:

- `CLOUDFLARE_API_TOKEN` — Wrangler API token with Workers deploy scope
- `CLOUDFLARE_ACCOUNT_ID` — the opchain Cloudflare account id

## Important Notes

- **Static site pages** are plain HTML + vanilla JS. No framework, no build step for the frontend.
- **Skill catalog is regenerated on every build.** `scripts/gen-skills-catalog.mjs` reads `skills/<id>/SKILL.md` frontmatter + `skills/<id>/TRYIT.md` and emits:
    - `public/skills.js` — consumed by `public/skills.html` + `public/tryit.html`.
    - `src/generated/skill-prompts.js` — consumed by the Worker for Try-It system prompts + display names.
  Adding or renaming a skill requires edits in **one** place: the `skills/` directory. Both generated files are gitignored.
- **Skill docs** in `public/docs/` are synced from `skills/` via `sync-docs.sh`. Same rule — edit the source in `skills/`, the copy regenerates on build.
- **The Try It API** uses KV (`DATA` binding) for rate limiting and lead tracking.
- **styles.css** has all component styles inline — no CSS modules, no preprocessor.
- **URL paths in HTML** use root-relative paths (e.g., `/styles.css`, `/docs/app-architect/SKILL.md`). These were previously `/opchain/styles.css` etc. when hosted under aidops.dev — they've been updated for standalone hosting.

## Relationship to aidops

This repo was extracted from `aidops/platform/public/opchain/` + `aidops/platform/src/opchain-try.js`. 
The aidops repo no longer owns opchain code. Changes to opchain.dev happen here and deploy via 
`npm run deploy` directly to the `opchain-dev` worker.

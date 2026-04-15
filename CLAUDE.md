# opchain.dev

Marketing site + skill showcase for opchain — a set of interconnected Claude Code skills 
that form a software development pipeline (concept → spec → design → build → deploy).

## Deployment

- **Worker:** `opchain-dev` on Cloudflare Workers
- **URL:** https://opchain-dev.4fstpkkw72.workers.dev (custom domain: opchain.dev)
- **Deploy:** `npm run deploy` (builds then deploys via wrangler)

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
├── scripts/
│   ├── sync-docs.sh        # skills/ → public/docs/ sync
│   └── make-skills-zip.sh  # skills/ → public/opchain-skills.zip
├── wrangler.jsonc           # Worker config (name: opchain-dev)
├── build.mjs               # esbuild: src/index.js → dist/index.js
└── package.json
```

## Key Commands

```bash
# Development (port 8787)
npm run dev

# Build (syncs docs + zip, then esbuild)
npm run build

# Deploy to Cloudflare
npm run deploy

# Sync skill docs to public/ (runs automatically in prebuild)
npm run sync-docs

# Bundle skills ZIP (runs automatically in prebuild)
npm run make-zip
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

Set in `.dev.vars` for local dev, Cloudflare dashboard for production:

- `LINEAR_API_KEY` — Linear API key for feedback endpoint
- `ANTHROPIC_API_KEY` — Claude API key for Try It chat
- `DEPLOY_API_TOKEN` — HMAC secret for session token signing

## Important Notes

- **Static site pages** are plain HTML + vanilla JS. No framework, no build step for the frontend.
- **Skill docs** in `public/docs/` are synced from `skills/` via `sync-docs.sh`. Edit the source in `skills/`, not `public/docs/`.
- **The Try It API** uses KV (`DATA` binding) for rate limiting and lead tracking.
- **styles.css** has all component styles inline — no CSS modules, no preprocessor.
- **URL paths in HTML** use root-relative paths (e.g., `/styles.css`, `/docs/app-architect/SKILL.md`). These were previously `/opchain/styles.css` etc. when hosted under aidops.dev — they've been updated for standalone hosting.

## Relationship to aidops

This repo was extracted from `aidops/platform/public/opchain/` + `aidops/platform/src/opchain-try.js`. 
The aidops repo no longer owns opchain code. Changes to opchain.dev happen here and deploy via 
`npm run deploy` directly to the `opchain-dev` worker.

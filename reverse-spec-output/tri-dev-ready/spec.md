# Tri-Dev Spec — opchain.dev (current state)

This spec describes opchain AS IT EXISTS today, formatted for app-architect's build
pipeline (Phase 6 build loop / Generator-Evaluator). It is the baseline for any new
feature on opchain.dev.

## Overview

opchain.dev is the marketing site and live demo surface for opchain — a set of 10
Claude Code skills that form a software development pipeline. The site is a 5-page
static marketing property plus two dynamic endpoints (feedback → Linear and an
email-gated Try-It chat demo powered by Anthropic's API). Everything runs as a
single Cloudflare Worker (`opchain-dev`) with Workers Assets serving `public/` and
one KV namespace (`DATA`) used for rate-limiting and lead capture.

## Features

### F1. Static marketing pages (Introduction, Architecture, Skill Library, Install)
- Plain HTML + vanilla JS, single `styles.css`.
- Skill Library renders a filterable list of 10 cards from `public/skills.js`.
- Architecture and Install are stubs today (see F7).

### F2. Feedback → Linear issue
- `POST /api/feedback` creates a Linear issue in a fixed team/project with `type` → label mapping and `priority` → Linear priority mapping.
- Optional `skill`, `email`, `description` enrich the issue body.

### F3. Try It — email-gated AI chat demo
- `POST /api/try/start` accepts email, enforces IP + email rate limits via KV, returns an HMAC-signed session token.
- `POST /api/try/chat` verifies the token, streams a response from Anthropic's Messages API (model `claude-haiku-4-5-20251001`), counts against the per-email exchange limit (5), and re-emits a simplified SSE protocol (`{text}` / `{done, remaining}`).
- 9 skills have system prompts; `checkpoint-protocol` is the only non-demoable skill.

### F4. Skill bundle download
- `GET /opchain-skills.zip` → served with `Content-Disposition: attachment` and `Cache-Control: public, max-age=3600`.
- Bundle is regenerated from `skills/*/SKILL.md` by `scripts/make-skills-zip.sh` during `prebuild`.

### F5. Skill doc pages
- `scripts/sync-docs.sh` copies `skills/*/SKILL.md` → `public/docs/<skill>/SKILL.md`.
- Linked from skill cards as "View docs".

### F6. Health check
- `GET /api/health` → `{ ok: true, service: "opchain-dev" }`.

### F7. (Out of scope but flagged) Architecture + Install content
- `public/architecture.html` and `public/install.html` are one-paragraph placeholders. Not currently a feature — a known gap.

## Design Direction

Dark warm theme. Near-black background (`#0c0a08`), warm off-white body
(`#f4ede4`), orange accent (`#e8945c`) used for links, active nav, primary
buttons, and the hero mark on the intro page. System font stack, no icon library,
minimal motion (only a blinking streaming cursor). See `design/design-system.md`
for the full token set and `design/component-inventory.md` for patterns.

## Technical Constraints

- **Runtime:** Cloudflare Workers, compatibility date `2026-03-01`, `nodejs_compat` flag.
- **Bundler:** esbuild → `dist/index.js`, no framework.
- **Storage:** KV only (no DB, no durable objects).
- **Secrets:** `LINEAR_API_KEY`, `ANTHROPIC_API_KEY`, `DEPLOY_API_TOKEN` (HMAC).
- **Allowed origins** (CORS): opchain.dev, www, Cloudflare default worker domain, aidops.dev, www.aidops.dev, localhost:8787/3000.
- **Rate limits:** 20 session-starts per IP per hour, 5 exchanges per email per 24 h.
- **Model:** pinned to `claude-haiku-4-5-20251001`.
- **Observability:** Cloudflare-provided only (`observability.enabled = true`).

## Out of Scope (today)

- User accounts / login (the site is read-only for most routes).
- Payment / subscriptions.
- Analytics / tracking beyond Cloudflare request logs.
- Automated tests and CI (acknowledged gap — see `spec/06-testing.md`).
- Multi-environment (no staging).
- i18n / localization.
- Server-side rendering / SSG (plain HTML is hand-maintained).

## Existing Patterns (for future features to follow or justifiably break)

- **Router:** plain `if/else` in `src/index.js`. Adding an endpoint = adding an
  `if (url.pathname === ...)` branch + a handler function.
- **CORS:** centralized via `corsHeaders(origin)` + `ALLOWED_ORIGINS` list.
- **Security headers:** centralized via `applySecurityHeaders`.
- **KV keys:** namespaced by prefix (`opchain-try-ip:`, `opchain-try-email:`, `opchain-leads:`).
- **Frontend state:** vanilla JS, `sessionStorage` for the Try-It token, IIFE per script, no bundler.
- **Skill docs:** written in `skills/`; synced to `public/docs/` via `prebuild`.

## Tech Debt to Resolve Before Major Feature Work

1. Remove the hardcoded HMAC fallback secret (gap H1).
2. Add minimal CI + test suite (gap H2).
3. Single source of truth for the skill catalog (gap M2).
4. Staging environment + preview KV id (gaps H3, M1).

## Confidence

HIGH across F1–F6 and all Technical Constraints — everything is directly observable
in the codebase.

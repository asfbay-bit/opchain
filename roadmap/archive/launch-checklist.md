# Launch Checklist — opchain.dev

Derived from `skills/app-architect/SKILL.md` Phase 7. Run before any prod
deploy that changes user-visible behavior, swaps dependencies, or edits the
Worker's security or routing surface.

Green means green — skip nothing. If an item doesn't apply, mark it `n/a`
with a one-line reason so the next operator knows it was considered.

---

## Pre-flight (before `npm run deploy`)

### Code

- [ ] `npm test` — all green, no skipped tests not already flagged `it.todo`
- [ ] `npm run build` — no type errors, no esbuild warnings
- [ ] `npm run site:build` — Astro static build completes
- [ ] `scripts/smoke.sh` run against staging — health + homepage + zip + security headers all pass
- [ ] `git status` clean on `main` (or the deploy branch)
- [ ] `git log --oneline -5` reviewed — every commit has a clear why

### Secrets & env

- [ ] `DEPLOY_API_TOKEN` set in Cloudflare (prod + staging)
- [ ] `LINEAR_API_KEY` set
- [ ] `ANTHROPIC_API_KEY` set
- [ ] `POSTHOG_PROJECT_API_KEY` + `POSTHOG_HOST` set (or explicitly unset — analytics will no-op)
- [ ] `PUBLIC_CF_BEACON_TOKEN` set (cookieless pageview beacon)
- [ ] `PUBLIC_POSTHOG_KEY` + `PUBLIC_POSTHOG_HOST` set (consent-gated client SDK)
- [ ] `LEAD_TTL_DAYS` unset or equal to 365 (privacy retention window)

### Observability

- [ ] Cloudflare Web Analytics dashboard reachable; last 24 h shows traffic
- [ ] PostHog project reachable; funnel dashboard documented in `docs/analytics.md` loads
- [ ] `wrangler tail --env production` streams logs cleanly (no flood of errors)

### Infrastructure

- [ ] DNS for `opchain.dev` + `www.opchain.dev` + `staging.opchain.dev` correct
- [ ] SSL / HTTPS valid, certificate auto-renewing
- [ ] `GET /api/health` from prod returns `{ ok: true, version: <short-sha> }` with the SHA matching the commit being deployed
- [ ] `X-Opchain-Version` header present on `/`

### Privacy & security

- [ ] `/privacy` renders and lists every data collector in play
- [ ] Consent banner appears on a fresh profile
- [ ] Declining consent blocks PostHog SDK load (verify no `window.posthog` global)
- [ ] Accepting consent loads PostHog (verify a pageview in the dashboard)
- [ ] Security headers (`Content-Security-Policy`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, `Strict-Transport-Security`, `X-Content-Type-Options`) present on `/` and `/api/health`
- [ ] CSP `connect-src` list reviewed — no third-party beyond Anthropic, PostHog, Cloudflare

## Deploy

- [ ] `npm run deploy:staging` → `scripts/smoke.sh` against staging green
- [ ] Staging URL manually smoke-tested by a human (home → skills → tryit email → install copy)
- [ ] `npm run deploy` (production) — deploy action green
- [ ] `scripts/smoke.sh` against production green
- [ ] `wrangler deployments list` — deployment id recorded here: `__________`

## Post-launch watch (first 60 minutes)

- [ ] Zero 5xx in `wrangler tail`
- [ ] PostHog funnel shows at least one session progressing past `demo_email_submitted`
- [ ] Feedback widget smoke — submit a real `[test]` feedback, confirm Linear issue created, delete after
- [ ] No Lighthouse regression vs. previous deploy (manual check on `/`, `/skills`)

## Post-launch watch (first 24 h)

- [ ] Error rate < 0.1% of requests
- [ ] CF Web Analytics shows pageviews across the top 5 routes
- [ ] No user reports via feedback widget marked bug

## Rollback protocol (if anything above fails)

1. `npx wrangler deployments list`
2. `npx wrangler rollback <last-good-deployment-id>`
3. Cloudflare serves previous worker within ~30 s
4. File a `/feedback type=bug` with the failure signal so it lands in Linear
5. Post-mortem: note what the checklist missed and add the item before next deploy

---

## How to use this file

- Copy it per-deploy: `cp checklists/launch-checklist.md checklists/launches/<YYYY-MM-DD>-<release>.md`
- Fill in checkboxes and deployment id inline
- Commit the filled copy on the same PR that cut the release (or in a follow-up)
- Archives form a running log of "what was verified when"

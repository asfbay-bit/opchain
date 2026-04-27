# Orientation Summary — opchain

_Refreshed 2026-04-28 by `/reverse-spec` targeted update. Replaces the
2026-04-17 summary, which counted 10 skills, no tests, and called out
the email-gated Try-It chat (since removed)._

```
ORIENTATION SUMMARY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Project:        opchain-dev
Type:           Hybrid — (a) Astro 5 marketing site + (b) skill product catalog + (c) Cloudflare Worker API
Stack:          Cloudflare Workers + Workers Assets + KV NOTIFY + Astro 5 + Tailwind 4 + esbuild + Zod
Deploy targets: opchain.dev (worker: opchain-dev) + staging.opchain.dev (worker: opchain-staging)
Size:           src/: 4 files, 660 LOC · site/src/: 12,146 LOC · skills/: 17 SKILL.md, 9,136 LOC
Existing docs:  README.md, CLAUDE.md, per-skill SKILL.md, this reverse-spec output
Test coverage: 11 Vitest files (Worker) + 3 Playwright e2e specs (site) + axe + Lighthouse, all in CI
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## What opchain actually is

opchain is **two things in one repo**:

1. **A product** — 17 Claude Code skills (`skills/<id>/SKILL.md`)
   forming a dev pipeline. The `checkpoint-protocol` and
   `orchestrator` skills are the protocol substrate; the other 15
   cover plan / build / quality / ship phases. Skills chain by reading
   each other's JSON checkpoints from `.checkpoints/`. Distribution:
   raw `SKILL.md` files, per-skill `<id>.zip`, or the combined
   `opchain-skills.zip`.

2. **A showcase website** (`opchain.dev`, plus `staging.opchain.dev`)
   — an Astro 5 static site (`site/`) served by a Cloudflare Worker
   (`src/`), with three live API endpoints: `/api/health`,
   `/api/feedback` (Linear issue creation), and `/api/notify`
   (install-moment soft-gate email capture, KV-backed). The previous
   email-gated Try-It chat was removed in `claude/remove-try-it`;
   `/api/try/*` now responds `410 Gone`.

## Scope for this reverse-spec run

Single-repo scope with **mixed outputs**: the Worker has its own
architecture (router, KV, security headers, CSP nonce), the Astro site
has its own component tree and content collection, and the skills
ecosystem has its own shape (checkpoint protocol, orchestrator,
pipeline topology). All three are documented below.

Scoped skipped outputs (unchanged from the original run): `05-monetization.md`
(no payment code), `08-analytics.md` (folded into `04-integrations.md`),
`09-documentation-plan.md` (no docs infra beyond markdown files),
`10-cost-estimate.md` (folded into `07-devops.md`).

## Recommended read order

1. `spec/00-project-overview.md` — what opchain is, who it's for, dual product/site framing
2. `spec/02-architecture.md` — the Worker router, the Astro asset pipeline, the skills topology
3. `spec/01-tech-stack.md` — Astro 5, Tailwind 4, Vitest, Playwright, Zod
4. `spec/03-security-auth.md` — no auth, CSP nonce, rate limits, lead-PII handling
5. `spec/04-integrations.md` — Linear GraphQL, PostHog server + client
6. `spec/06-testing.md` — Vitest + Playwright + axe + LHCI (all in CI)
7. `spec/07-devops.md` — manual deploy posture, version stamp, env matrix
8. `gap-analysis.md` — current punch list (the 2026-04-17 HIGHs are all resolved)

The `design/`, `stack-forge-audit.md`, and `tri-dev-ready/spec.md`
artifacts in this folder were generated against the pre-Sprint-6
codebase (vanilla HTML site, Try-It chat) and have **not** been
refreshed in this pass — treat them as stale until a follow-up run.

# Orientation Summary — opchain

```
ORIENTATION SUMMARY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Project:        opchain-dev
Type:           Hybrid — (a) static marketing site + (b) skill product catalog + (c) Cloudflare Worker API
Stack:          Cloudflare Workers + Workers Assets + KV + esbuild + vanilla HTML/CSS/JS
Deploy target:  Cloudflare (worker name: opchain-dev, custom domain: opchain.dev)
Size:           src/: 2 files, 685 LOC · public/: 9 files, 1,633 LOC · skills/: 10 SKILL.md files, 4,950 LOC
Existing docs:  README.md (top-level), CLAUDE.md (project instructions), per-skill SKILL.md
Test coverage: NONE — no test runner, no test files, no CI step (HIGH confidence)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## What opchain actually is

opchain is **two things in one repo**:

1. **A product** — 10 Claude Code skills (`skills/*/SKILL.md`) forming a dev pipeline
   (reverse-spec → app-architect → stack-forge/ux-engineer → code-auditor →
   integrations-engineer → git-ops → deploy-ops, with scale-ops as advisory and
   checkpoint-protocol as the persistence layer). The product ships as raw `SKILL.md`
   files, bundled into `opchain-skills.zip`.

2. **A showcase website** (opchain.dev) — a 5-page static site served by a Cloudflare
   Worker, with two dynamic endpoints: feedback-to-Linear and an email-gated "Try It"
   AI chat demo that streams responses from the Anthropic API.

## Scope for this reverse-spec run

Single-app scope with **mixed outputs**: the Worker has its own architecture (routes,
KV, streaming), while the skills ecosystem has its own shape (checkpoint protocol,
orchestrator, pipeline topology). Both are documented below.

Scoped skipped outputs: `05-monetization.md` (no payment code), `08-analytics.md`
(no tracking/analytics code), `09-documentation-plan.md` (no docs infra beyond
markdown files), `10-cost-estimate.md` (folded into 07-devops).

## Recommended read order

1. `spec/00-project-overview.md` — what opchain is, who it's for, dual product/site framing
2. `spec/02-architecture.md` — the Worker router, the skills pipeline topology, checkpoint protocol
3. `spec/01-tech-stack.md` — inferred stack rationale
4. `spec/03-security-auth.md` — session token HMAC, rate limits, CORS
5. `spec/04-integrations.md` — Linear GraphQL, Anthropic Messages API
6. `design/design-system.md` — tokens and components extracted from styles.css
7. `stack-forge-audit.md` — typed pipeline gap analysis
8. `gap-analysis.md` — everything that's missing or risky

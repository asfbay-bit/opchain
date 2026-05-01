# 00 — Project Overview

_Refreshed 2026-04-28 by `/reverse-spec` targeted update. Replaces the
2026-04-17 version, which still framed the email-gated Try-It chat as a
core surface and counted 10 skills (the catalog has since grown to 17)._

## Current State

**opchain** is a product + marketing property in a single repo:

- **The product:** 17 interconnected Claude Code skills (`skills/*/SKILL.md`)
  that form an end-to-end software development pipeline. Skills chain by
  reading each other's JSON checkpoints from `.checkpoints/`, so context
  flows forward across conversations without manual handoffs. The shared
  `skills/orchestrator/SKILL.md` (and the historical mirror at
  `skills/orchestrator.md`) defines the cross-skill protocol — welcome
  flow, chaining matrix, checkpoint shape.
- **The showcase site:** `opchain.dev` (and `staging.opchain.dev`),
  served by the `opchain-dev` / `opchain-staging` Cloudflare Workers.
  The site is an Astro 5 static build (Sprint 6 cutover) — six routes
  (`/`, `/architecture`, `/skills`, `/skills/[id]`, `/install`,
  `/demo`, `/privacy`, plus `/styleguide` for component QA and `/404`)
  served as static HTML through the Worker's `ASSETS` binding. Two
  backend endpoints remain: `POST /api/feedback` (creates a Linear
  issue) and `POST /api/notify` (soft-gate email capture, persisted to
  KV `NOTIFY`).

### What changed since the 2026-04-17 spec

| Surface | Status |
|---|---|
| Email-gated Try-It chat (`/api/try/*`, `/tryit`) | **Removed** in `claude/remove-try-it`. Stale clients get `410 Gone`; `/tryit` and `/in-action` 301 to `/demo` |
| Anthropic Messages API integration | Gone with Try-It |
| HMAC-signed session tokens, `DEPLOY_API_TOKEN` secret | Gone with Try-It |
| Static HTML site (`public/*.html`, `public/*.js`) | **Replaced** by Astro 5 in `site/`; `public/` is now build output, gitignored |
| Soft-gate notify endpoint (`POST /api/notify`) | **Added** — captures email + role + team-size at install/download moment |
| PostHog analytics (server + consent-gated client) | **Added** — see `src/lib/analytics.js`, `site/src/components/ConsentBanner.astro` |

### Pipeline at a glance

```
foundation: checkpoint-protocol · orchestrator
       │
plan:   reverse-spec ──► app-architect ─┬─► stack-forge   (auto-invoked)
                                         ├─► ux-engineer   (Phase 3 design)
                                         └─► dash-forge   (data-dense apps)
                                  
build:  app-architect (build loop) ──► bug-check ──► git-ops ──► deploy-ops
        api-dev                                                       │
        integrations-engineer                                          │
        migration-ops                            ◄──── monitoring-ops ─┘
                                                                      
cross-cutting: code-auditor (gate before deploy)
               security-auditor (auth + supply-chain)
               scale-ops (capacity advisory)
```

Sources: `README.md` skill table, `skills/orchestrator.md` welcome +
chaining sections, frontmatter `phases:` field across `skills/*/SKILL.md`.

### Audience / users

- Claude Code CLI users who want a structured pipeline instead of
  ad-hoc prompting.
- Claude.ai / Claude Desktop users who can upload individual `.skill`
  files via Settings → Customize → Skills.
- Teams that want to check a standard set of skills into
  `.claude/skills/` for shared workflow conventions.

Source: `README.md`, install pages.

### Delivery model

- **Install:** copy individual `SKILL.md` files, download a per-skill
  ZIP from `/skills/<id>.zip`, or grab the combined
  `public/opchain-skills.zip`. The ZIPs are generated from `skills/`
  by `scripts/make-skills-zip.sh` during `prebuild`.
- **No backend required for the product.** Each skill is a
  self-contained prompt package. The Worker only powers the marketing
  site's feedback widget and install-moment soft-gate.
- **No API keys required** for users of the product itself.

### Marketing demo surface

`/demo` is a static gallery of skill walkthroughs (Sprint 7 / round-3
content) — pre-recorded transcripts, screenshots, and onboarding
narration. The previous live email-gated chat is gone; the page is a
read-only showcase now. Source: `site/src/pages/demo.astro`,
`site/src/data/walkthroughs/`.

### Skill catalog growth (17 skills)

| Category | Count | Skills |
|---|---|---|
| Foundation (protocol) | 2 | `checkpoint-protocol`, `orchestrator` |
| Plan | 4 | `reverse-spec`, `stack-forge`, `app-architect`, `dash-forge` |
| Build | 7 | `app-architect`, `api-dev`, `integrations-engineer`, `bug-check`, `git-ops`, `deploy-ops`, `migration-ops` |
| Quality / cross-cutting | 4 | `code-auditor`, `security-auditor`, `scale-ops`, `monitoring-ops` |
| Design | 1 | `ux-engineer` |

(`app-architect` carries `phases: [plan, build]` so it's listed in both.
The Astro content-collection schema validates `phases` against
`["foundation", "plan", "build"]` — the categorization above is the
public-facing slice from `README.md`, not the schema's own enum.)

### Confidence

| Claim | Confidence |
|---|---|
| "opchain is both product and marketing site in one repo" | HIGH — entire repo structure, `CLAUDE.md` explicit |
| 17 skills with valid frontmatter | HIGH — `find skills -name SKILL.md \| wc -l` = 17, content collection validates |
| Try-It chat fully removed | HIGH — `/api/try/*` returns 410, no `ANTHROPIC_API_KEY` reference |
| Astro 5 static cutover complete | HIGH — `site/dist/` is the source-of-truth; `public/` is gitignored build output |
| Product needs no API keys | HIGH — skills are prompt bundles |

### Gaps & Recommendations

- **Skill versioning is in place but unused.** Every `SKILL.md` has
  `version: x.y.z` in frontmatter (validated as semver by
  `site/src/content.config.ts`), but the values are all `1.0.0` —
  bumps are still notional. A first real bump (when the checkpoint
  shape changes, say) will validate that the field has teeth.
- **The dual `skills/orchestrator.md` + `skills/orchestrator/SKILL.md`
  is confusing.** The Markdown file at the skills root is a historical
  mirror; the `SKILL.md` under `orchestrator/` is the one the content
  collection sees. Worth a one-liner in `skills/README.md` clarifying
  which is canonical, or collapsing one into a redirect.
- **The branding split with aidops still leaks.** `aidops.dev` /
  `www.aidops.dev` remain in the Worker's CORS allow-list
  (`src/index.js` L42–L43). Track in `gap-analysis.md` M3 — confirm
  whether aidops still cross-fetches opchain APIs and prune if not.
- **No formal positioning doc / ICP.** README and the homepage carry
  taglines ("skills that ship"), but there's no written description of
  the ideal user, what they previously did, and what measurable
  outcome they get. Not a blocker for the site, but a gap for
  growth/marketing work.

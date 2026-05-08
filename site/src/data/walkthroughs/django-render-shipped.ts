import type { Walkthrough } from "./types";

/**
 * Scenario 12 (v1.3 supporting) — Priya, a solo founder, builds Quill
 * (a B2B invoicing tool for small accounting firms) from idea to
 * paying customer in two weeks. opchain scaffolds Django + Postgres,
 * deploys to Render via render.yaml Blueprint, uses GitHub Issues
 * (not Linear) for tracking. Proves the v1.3 platform expansion is
 * real, not just words in stack-forge — and that the same opchain
 * pipeline that ships JS-on-Cloudflare also ships Python-on-Render
 * with no special-casing.
 */
export const djangoRenderShipped: Walkthrough = {
  id: "django-render-shipped",
  title: "Django + Postgres + Render, shipped by opchain",
  tagline: "v1.3 supporting · platform expansion proof",
  summary:
    "Solo founder builds a B2B invoicing app on Django + Postgres + Render with GitHub Issues for tracking. Same opchain pipeline as the Cloudflare-flavored scenarios — stack-forge picks the stack, app-architect scaffolds, git-ops shapes commits from GH issues, deploy-ops ships via render.yaml Blueprint. Two weeks ideation → paying customer.",
  description:
    "Quill is a B2B invoicing tool aimed at small US accounting firms (3-15 person partnerships) that hate QuickBooks but can't yet afford a dedicated finance ops team. Priya is the solo founder; she has 8 years of Python at a fintech, no Cloudflare experience, and wants the smallest possible ops surface. The opchain pipeline picks Django + Postgres + Render automatically (stack-forge decision tree: solo founder, no ops appetite, server-rendered UI, admin panel needed → Django/Render is the canonical match), scaffolds the project per the v1.3 \"Platform-Specific Recipes\" in app-architect's scaffold-guide, uses GitHub Issues as the PM provider (one-line config swap from Linear; same protocol §3 markers), and ships via render.yaml Blueprint (one-click Postgres + web service provisioning). The artifact set is what Priya actually ends up with after two weeks: the spec docs from /spec, the render.yaml Blueprint from /scaffold, the .opchain/pm.yaml configured for GitHub Issues, the first sprint contract, the first PR linked back to inv-org/quill#1.",
  inputs: [
    "Solo founder · 8 years Python · fintech background · no Cloudflare experience",
    "Idea: B2B invoicing tool for small accounting firms (3-15 person partnerships)",
    "Existing GitHub repo: inv-org/quill (empty, just LICENSE + README)",
    "GitHub Issues for tracking; no Linear, no Jira",
    "Preference: smallest possible ops surface — solo founder with no ops appetite",
  ],
  outputs: [
    {
      id: "discovery",
      label: "/discover output — interview transcript + summary",
      kind: "spec/00-project-overview.md",
      body:
`# 00-project-overview.md — Quill

**Source ticket:** inv-org/quill#1 (the user filed it from "Build me an invoicing app for accounting firms")

## Problem

Small US accounting firms (3-15 partners) hate QuickBooks Online's
pricing tiers and per-seat surcharges, but they can't afford a
dedicated finance-ops engineer. They live in spreadsheets + email.
The pain: month-end invoicing across 80-200 active client engagements
takes 3-5 days of manual work that recurs every month.

## Pitch

Quill: opinionated invoicing for partnership-shaped firms.
Multi-partner billable-time entry, retainer + hourly + fixed-fee
mixing, automated month-end invoice generation, GAAP-friendly
exports for the firm's own books.

Not competing with full ERPs (NetSuite). Not competing with
self-serve indie tools (FreshBooks, Wave). The wedge is
"partnership-aware": the data model treats partners as first-class,
not as users-with-a-role.

## Primary user

Sarah, ~45y, the "operations partner" at a 7-partner CPA firm. She
spends ~30h/month on invoicing alone. She doesn't want a complex
tool; she wants to load the firm's billables once a month, click
generate, and email PDFs.

## Anti-goals

- Multi-tenant SaaS at scale — Quill is per-firm-installed (one Render service per firm) until proven otherwise. Keeps data segregation simple.
- Mobile-first — accounting work happens on desktop.
- Real-time anything — month-end batch generation is the workflow.
- Free tier — accounting firms don't expect free tooling; pricing pressure is downward but not zero.

## Success metrics

- 3 paying firms within 90 days
- ARR $30k by 6 months
- ≤ 1h ops work per firm per month (Priya's time, not Sarah's)
`,
    },
    {
      id: "stack",
      label: "/spec stack-forge output — Django/Postgres/Render decision",
      kind: "spec/01-tech-stack.md",
      body:
`# 01-tech-stack.md — Quill

stack-forge ran the v1.3 "Platform Matrix" decision tree against
the discovery context. **Django + Postgres + Render** picked itself.

## Decision trace

| Criterion | Quill answer | Stack hint |
|---|---|---|
| Solo dev / small team? | solo (Priya) | Django/Rails/Render |
| Ops appetite? | none | Render (managed everything) |
| UI shape? | server-rendered (Sarah won't tolerate SPA load times for batch ops) | Django (or Rails) |
| Admin panel needed? | yes (Priya needs internal tools fast) | Django (admin is built-in) |
| Time-to-first-deploy is dominant cost? | yes (90-day window) | Django/Render |
| Latency-sensitive? | no (batch workflow) | not Cloudflare/Fly |
| Team has Rails experience? | no | not Rails |

→ **Django + Postgres + Render**, primary recommendation. Cost band:
\$14/mo at hobby, \$50/mo at small-team scale. Ramps to \$150/mo before
needing migration to managed Postgres beyond Render's offering.

## Versions

- Python 3.12
- Django 5.1 (current LTS line at 2026-Q2)
- Postgres 17 (Render's default)
- pytest 8.x + pytest-django 4.x

## Key invariants from scaffold-guide

- Settings split: \`core/settings/{base,dev,prod}.py\`; \`DJANGO_SETTINGS_MODULE\` env var picks the active one. Never have a single \`settings.py\` for both.
- \`render.yaml\` Blueprint provisions Postgres + web service together; Render reads it on first push.
- Postgres URL from \`DATABASE_URL\`; \`dj-database-url\` parses it in \`prod.py\`.
- pytest, not \`manage.py test\`. \`pytest.ini\` declares \`DJANGO_SETTINGS_MODULE=core.settings.dev\`.

## Why NOT the alternatives

- **Rails/Heroku** would also have worked, but Priya has zero Rails. Learning curve > Heroku's reliability win.
- **Cloudflare Workers + D1** is opchain's home stack but server-rendered Django doesn't fit the edge model; D1 is also less mature for the kind of complex reporting joins Quill needs.
- **Go/Fly.io** — overkill; Quill is CRUD with a generated-PDF step. Go's strengths don't apply.
- **Rust/Shuttle.rs** — Priya doesn't know Rust. Adoption cost dwarfs the technical wins.
`,
    },
    {
      id: "render-yaml",
      label: "render.yaml — Blueprint for Postgres + web service",
      kind: "render.yaml",
      body:
`# render.yaml — Quill Blueprint
# Render reads this on first push and provisions everything below.
# Subsequent deploys are pure git push.

databases:
  - name: quill-db
    plan: starter         # \$7/mo; free tier for staging-only
    postgresMajorVersion: 17

services:
  - type: web
    name: quill
    runtime: python
    plan: starter         # \$7/mo
    region: oregon
    rootDir: .
    buildCommand: |
      pip install -r requirements.txt
      python manage.py collectstatic --noinput
    startCommand: gunicorn core.wsgi:application
    preDeployCommand: python manage.py migrate --noinput   # release step
    healthCheckPath: /health
    envVars:
      - key: DJANGO_SETTINGS_MODULE
        value: core.settings.prod
      - key: DATABASE_URL
        fromDatabase:
          name: quill-db
          property: connectionString
      - key: SECRET_KEY
        generateValue: true              # Render generates and sets it
      - key: ALLOWED_HOSTS
        value: quill.onrender.com,quill.priyabuilds.com
      - key: RENDER_GIT_COMMIT           # Render auto-injects; we surface in /health
        sync: false                      # do not echo to env-config UI

  - type: web
    name: quill-staging
    runtime: python
    plan: free
    region: oregon
    rootDir: .
    buildCommand: |
      pip install -r requirements.txt
      python manage.py collectstatic --noinput
    startCommand: gunicorn core.wsgi:application
    preDeployCommand: python manage.py migrate --noinput
    healthCheckPath: /health
    branch: main
    envVars:
      - key: DJANGO_SETTINGS_MODULE
        value: core.settings.prod
      - key: DATABASE_URL
        fromDatabase:
          name: quill-db
          property: connectionString
      - key: SECRET_KEY
        sync: false                      # set manually in dashboard
`,
    },
    {
      id: "pm-yaml-gh",
      label: "`.opchain/pm.yaml` — GitHub Issues config",
      kind: "config.yaml",
      body:
`# .opchain/pm.yaml — Quill (provider: github-issues)
#
# v1.3 protocol applies to GH Issues identically to Linear / Jira;
# only the tool names + state mappings change. Markers, retry,
# idempotency, deferred-action queue all work the same.

provider: github-issues
team_or_project: inv-org/quill        # owner/repo
mcp_server: github

issue_types:
  feature:  "type:feature"            # GH labels for issue-type discrimination
  bug:      "type:bug"
  chore:    "type:chore"
  deploy:   "type:deploy"
  incident: "type:incident"
  release:  "type:release"

states:
  in_progress: "status:in-progress"   # GH issues are open/closed; states map to labels
  in_review:   "status:in-review"
  done:        closed                 # the literal closed state, not a label
  extended:
    blocked:                       "status:blocked"
    staging-verified:              "status:staging-verified"
    shipped:                       "status:shipped"
    rolled-back:                   "status:rolled-back"
    resolved-pending-postmortem:   "status:pending-pm"

labels_default: [opchain, agent-driven]

remediation_owners:
  backend:  priya     # solo, but maintained for forward-compat
  frontend: priya
  data:     priya
  infra:    priya

create_child_tickets: true

# v1.3 tool registry resolves these to:
#   get_issue        → mcp__mcp-server-github__issue_read
#   list_issues      → mcp__mcp-server-github__list_issues
#   add_comment      → mcp__mcp-server-github__add_issue_comment
#   create_issue     → mcp__mcp-server-github__issue_write (action=create)
#   transition_state → mcp__mcp-server-github__issue_write (with state field)
# (No tool_overrides — public github.com works out of the box.)
`,
    },
    {
      id: "scaffold",
      label: "/scaffold output — Django project layout written",
      kind: "tree",
      body:
`# Files written by /scaffold (per scaffold-guide.md § Django)

quill/
├── manage.py
├── requirements.txt              # Django==5.1.* dj-database-url gunicorn psycopg[binary]
├── pytest.ini                    # DJANGO_SETTINGS_MODULE=core.settings.dev addopts=-ra
├── render.yaml                   # see artifact 'render.yaml'
├── .env.example                  # DATABASE_URL=postgres://... SECRET_KEY=... DJANGO_SETTINGS_MODULE=core.settings.dev
├── .gitignore
├── core/
│   ├── settings/
│   │   ├── __init__.py
│   │   ├── base.py               # shared
│   │   ├── dev.py                # debug=True, sqlite for offline dev
│   │   └── prod.py               # debug=False, dj_database_url.parse(env('DATABASE_URL'))
│   ├── urls.py
│   ├── wsgi.py
│   └── views.py                  # /health (returns SHA + DB ping)
├── apps/
│   ├── firms/                    # the partnership tenant
│   │   ├── models.py             # Firm, Partner, Engagement
│   │   ├── views.py
│   │   ├── urls.py
│   │   ├── admin.py              # full Django-admin registration
│   │   └── tests/
│   │       └── test_models.py
│   ├── billables/                # time entries, retainers, fixed fees
│   ├── invoices/                 # generation, PDF render, email
│   └── auth/                     # bare auth on top of django.contrib.auth (sessions)
└── templates/
    ├── base.html
    ├── invoices/list.html
    └── invoices/detail.html

(scaffold respects "Minimal but complete" rule from scaffold-guide:
no placeholder TODO files. Every file has real, runnable code.)

## Verification

\`\`\`
$ python -m venv .venv && source .venv/bin/activate
$ pip install -r requirements.txt
$ python manage.py migrate
$ python manage.py runserver
[2026-05-09 09:14:01] Starting development server at http://127.0.0.1:8000/
\`\`\`

\`\`\`
$ pytest -q
.................. [100%]
18 passed in 1.42s
\`\`\`
`,
    },
    {
      id: "first-pr",
      label: "First PR — fix linked back to inv-org/quill#5",
      kind: "github.pr",
      body:
`# PR #1 — feat(billables): time-entry CRUD + bulk import

\`https://github.com/inv-org/quill/pull/1\`

**Linked issue:** [#5](https://github.com/inv-org/quill/issues/5)
(Sprint 1: time-entry foundations)

git-ops shaped this PR from issue #5. The body is auto-generated;
the trailer references the issue; the PR-opened comment was posted
back to issue #5 via \`mcp__mcp-server-github__add_issue_comment\`
with marker \`<!-- opchain:git-ops:pr-opened:#1 -->\`.

## Description (auto-generated by git-ops from issue #5 + diff)

Closes #5.

Adds the \`TimeEntry\` model, the bulk-import CSV view, and the
\`/billables/list/\` page. Bulk-import respects the firm-tenant
boundary (a partner of firm A cannot import time entries for firm
B; admin enforces it via row-level filter).

### Diff summary

- 12 files changed, +387 lines, -4 lines
- 8 new tests in \`apps/billables/tests/\`
- 1 migration (\`0002_timeentry.py\`)

### Audit gate

- \`pytest\` PASS (147/147)
- \`mypy\` PASS (no new ignores)
- \`bandit\` PASS

### What this PR is NOT

- The PDF render path. That's #6 (Sprint 2).
- The invoice generation logic. That's #7 (Sprint 2).

## Comment posted back to issue #5

\`\`\`
<!-- opchain:git-ops:pr-opened:#1 -->
PR opened: https://github.com/inv-org/quill/pull/1
\`\`\`

(Same shape as the Linear scenarios — provider swap is one config line.)

## When this merges

git-ops will:
1. Add comment with marker \`<!-- opchain:git-ops:pr-merged:#1 -->\`
2. Close issue #5 (label \`status:in-review\` removed; issue closed = the v1.3 \`done\` state for github-issues per pm.yaml)
`,
    },
    {
      id: "first-deploy",
      label: "First deploy via Render Blueprint",
      kind: "deploy.log",
      body:
`# /deploy staging — first push to Render

\`\`\`
[deploy-ops] Provider detected: Render (render.yaml present)
[deploy-ops] Audit gate (code-auditor + bandit + pytest) PASS
[deploy-ops] git push render main → 2026-05-22T14:08:11Z

Render Blueprint applying:
  ✓ Database 'quill-db' (plan: starter, region: oregon, postgres 17)
  ✓ Service 'quill-staging' (plan: free, region: oregon, runtime: python)
  ✓ Service 'quill' (plan: starter, region: oregon)

Build (build 1):
  - pip install -r requirements.txt → 23.4s
  - python manage.py collectstatic --noinput → 1.1s

Deploy:
  - preDeployCommand: python manage.py migrate --noinput → 0.8s
    Applying contenttypes.0001_initial... OK
    Applying auth.0001_initial... OK
    Applying firms.0001_initial... OK
    Applying billables.0001_initial... OK
    Applying billables.0002_timeentry... OK
  - startCommand: gunicorn core.wsgi:application → service healthy
[deploy-ops] /api/health → 200, SHA bb1f0e2 ✓

[deploy-ops] Pre-create check on deploy ticket:
  mcp__mcp-server-github__list_issues(
    owner=inv-org, repo=quill,
    labels=["type:deploy"],
    body_text_query="opchain:deploy-ops:deploy-created:staging:bb1f0e2"
  )
  → no match. Creating.

[deploy-ops] mcp__mcp-server-github__issue_write(action=create):
  Title: "Deploy: staging c4f8a21..bb1f0e2"
  Body:
    <!-- opchain:deploy-ops:deploy-created:staging:bb1f0e2 -->

    Environment: staging
    Range: c4f8a21..bb1f0e2
    Commits: 3
    Linked tickets: #5, #8, #11
    Audit gate: PASS
    Smoke tests: PASS
  Labels: [opchain, agent-driven, type:deploy]
  → Created issue #14.

[deploy-ops] Comment on each linked issue (#5, #8, #11):
  → 3 comments posted, each with marker
    <!-- opchain:deploy-ops:linked-shipped:#14:#<n> -->
\`\`\`

## /deploy prod (a week later, when Sarah signs the contract)

\`\`\`
[deploy-ops] git push render main (with prod service active)
[deploy-ops] Smoke: /api/health → 200, SHA d18ca44
[deploy-ops] Quill is live: https://quill.priyabuilds.com
[deploy-ops] Sarah's firm onboarded; first invoice batch generated.
[deploy-ops] Closing deploy ticket #14: state → "status:shipped"
\`\`\`
`,
    },
  ],
  skills: ["app-architect", "stack-forge", "git-ops", "deploy-ops", "integrations-engineer"],
  runtime: "~7 minutes",
  steps: [
    {
      type: "beat",
      label: "Day 1 — Priya files inv-org/quill#1",
      caption: "She types the idea into a GH issue and runs `/discover --ticket inv-org/quill#1`. opchain pulls the issue body via mcp__mcp-server-github__issue_read.",
      skills: ["app-architect"],
    },
    {
      type: "exchange",
      role: "user",
      content:
        "/discover --ticket inv-org/quill#1\n\nThe ticket has the rough idea: invoicing tool for small accounting firms. Solo founder, want to go fast.",
    },
    {
      type: "exchange",
      role: "claude",
      skill: "app-architect",
      content:
`Reading the issue. \`mcp__mcp-server-github__issue_read(owner=inv-org, repo=quill, number=1)\`.

The ticket is rough — let me ask 4 quick questions, pre-filled where the ticket is explicit:

1. **The ticket says** "small accounting firms." How small — solo CPAs? 3-15-person partnerships? Mid-market with their own ops team?
2. **The ticket says** "fast." 30 days, 90 days, 180 days?
3. **Anti-goals?** Anything you want to make sure this is NOT?
4. **Pricing model?** SaaS subscription, per-firm install, free + paid tiers?

(I'm not going to skip the discovery questions just because there's a ticket — but I'll ask the ones the ticket leaves ambiguous.)`,
    },
    {
      type: "exchange",
      role: "user",
      content:
        "1) 3-15-person partnerships, the kind that hate QuickBooks but can't afford NetSuite. 2) 90 days to first paying firm. 3) Not multi-tenant SaaS-at-scale; per-firm install. Not mobile-first. 4) Per-firm install, ~$200-500/mo per firm.",
    },
    {
      type: "exchange",
      role: "claude",
      skill: "app-architect",
      content:
`Got it. Writing \`spec/00-project-overview.md\` with "Source ticket: inv-org/quill#1" cited at the top.

The protagonist (Sarah, ops partner) and the wedge ("partnership-aware" data model) come straight from your answers. The anti-goals list is sharper than the typical discovery output — that's because the ticket gave me directional info.

\`/spec\` next — auto-invoking stack-forge to pick the stack.`,
      artifacts: ["discovery"],
    },
    {
      type: "beat",
      label: "Day 1 — stack-forge picks Django/Render automatically",
      caption: "v1.3's Platform Matrix decision tree resolves cleanly.",
      skills: ["stack-forge"],
    },
    {
      type: "exchange",
      role: "claude",
      skill: "stack-forge",
      content:
`Running the v1.3 "Platform Matrix" decision tree against discovery context.

| Criterion | Quill | Hint |
|---|---|---|
| Solo dev? | yes (Priya) | Django/Rails/Render |
| Ops appetite? | none | Render |
| UI shape? | server-rendered | Django |
| Admin panel? | yes | Django (built-in) |
| Latency-sensitive? | no (batch) | not Cloudflare/Fly |
| Rails experience? | no | not Rails |

→ **Django + Postgres + Render**. Versions: Python 3.12, Django 5.1, Postgres 17.

The trace + the rejected alternatives are in \`spec/01-tech-stack.md\`. Cost band: \$14/mo hobby → \$50/mo small-team.`,
      artifacts: ["stack"],
    },
    {
      type: "beat",
      label: "Day 1 — /scaffold writes the project",
      caption: "Per scaffold-guide.md § Django. Settings split, render.yaml Blueprint, pytest, Django admin all wired.",
      skills: ["app-architect"],
    },
    {
      type: "exchange",
      role: "claude",
      skill: "app-architect",
      content:
`\`/scaffold\` writes the layout from \`scaffold-guide.md § Django\`:
- Settings split into \`base / dev / prod\` (DJANGO_SETTINGS_MODULE selects)
- \`render.yaml\` Blueprint provisioning Postgres + web service
- \`pytest.ini\` pointing at the dev settings module
- Django admin registered for every model
- Three apps: \`firms\`, \`billables\`, \`invoices\` — partner / engagement / time-entry / invoice domain

Verification: \`python manage.py runserver\` boots; \`pytest -q\` shows 18 passing tests on the scaffold itself.

\`.opchain/pm.yaml\` written for **GitHub Issues** (not Linear) — same protocol §3 markers, different tool names. Provider swap is a single config line.`,
      artifacts: ["scaffold", "render-yaml", "pm-yaml-gh"],
    },
    {
      type: "beat",
      label: "Day 8 — first PR opens, linked back to issue #5",
      caption: "git-ops uses GitHub Issues exactly like it uses Linear. Same protocol, different tool names.",
      skills: ["git-ops"],
    },
    {
      type: "exchange",
      role: "user",
      content: "/git-sync inv-org/quill#5",
    },
    {
      type: "exchange",
      role: "claude",
      skill: "git-ops",
      content:
`Reading issue #5 via \`mcp__mcp-server-github__issue_read\`. Title: "Sprint 1: time-entry foundations." Type: \`type:feature\` (from issue label).

- Branch: \`feat/quill-5-time-entry-foundations\`
- Commit subject: \`feat(billables): time-entry CRUD + bulk import\`
- PR body: auto-generated from the issue + diff summary + audit gate output

**Pre-write check:** \`mcp__mcp-server-github__issue_read(...comments)\` → no \`<!-- opchain:git-ops:pr-opened:#1 -->\` marker present → safe to write.

\`mcp__mcp-server-github__add_issue_comment\` posts the marker comment back to issue #5. Then \`mcp__mcp-server-github__issue_write\` adds label \`status:in-review\` (the GH-issues equivalent of Linear's \`In Review\` state per the v1.3 \`states\` map in \`pm.yaml\`).

PR #1 opened. Same shape as the Linear scenarios — protocol §3 abstracts the provider.`,
      artifacts: ["first-pr"],
    },
    {
      type: "beat",
      label: "Day 9 — first staging deploy via Render Blueprint",
      caption: "deploy-ops detects render.yaml, walks the audit gate, ships. First deploy provisions Postgres + web service in one push.",
      skills: ["deploy-ops"],
    },
    {
      type: "exchange",
      role: "user",
      content: "/deploy staging",
    },
    {
      type: "exchange",
      role: "claude",
      skill: "deploy-ops",
      content:
`Provider detected: **Render** (\`render.yaml\` present at repo root).

Audit gate: \`pytest\` PASS (147/147), \`mypy\` PASS, \`bandit\` PASS.

\`git push render main\` — Render reads the Blueprint, provisions Postgres + web service in 47s, runs \`migrate --noinput\` as the preDeployCommand, swaps traffic.

\`/api/health\` returns 200 + SHA bb1f0e2 ✓.

**Pre-create check** on the deploy ticket:
\`mcp__mcp-server-github__list_issues(owner=inv-org, repo=quill, labels=["type:deploy"], body_text_query="opchain:deploy-ops:deploy-created:staging:bb1f0e2")\` → no match → safe to create.

Created issue #14 with the marker in the description. Posted linked-shipped comments back to #5, #8, #11 (the issues whose commits made it into this deploy range).

Same flow as the Linear scenarios. Same markers. Different tool surface.`,
      artifacts: ["first-deploy"],
    },
    {
      type: "beat",
      label: "Day 14 — Sarah's firm signs",
      caption: "Production deploy. Quill is live at https://quill.priyabuilds.com. Two weeks ideation → first paying customer.",
    },
    {
      type: "exchange",
      role: "user",
      content:
        "What changed about the pipeline because we used Django + Render + GitHub Issues instead of CF Workers + Linear?",
    },
    {
      type: "exchange",
      role: "claude",
      skill: "integrations-engineer",
      content:
`Surprisingly little. The v1.3 protocol abstracts the provider — every PM-aware skill calls "registry-resolved \`add_comment\`" and the registry maps to \`mcp__claude_ai_Linear__save_comment\` for Linear or \`mcp__mcp-server-github__add_issue_comment\` for GitHub. Same markers, same retry policy, same deferred-action queue.

The provider-specific things were:

- **\`pm.yaml\` provider line + state mapping.** GH issues are open/closed; the \`states\` map points at GH labels (\`status:in-progress\`, \`status:in-review\`) for non-terminal states and \`closed\` for the terminal one. Linear's state map points at workflow names. One-line config swap.
- **deploy-ops Render section.** Different from the deploy-ops Cloudflare walkthrough — \`render.yaml\` Blueprint instead of \`wrangler deploy\`, \`preDeployCommand\` instead of separate migration step, Render's \`fromDatabase\` reference instead of \`wrangler secret put DATABASE_URL\`.
- **scaffold layout.** Django's settings-split + apps/ + templates/ pattern instead of Astro pages/ + components/.

Everything else — the discovery → spec → roadmap → build → ship pipeline, the audit gate, the PM-MCP loop, the scenarios linking back through the checkpoint files — was identical. That's the v1.3 platform-expansion bet: opchain stops being Cloudflare-only on the page without breaking what already worked.`,
    },
  ],
};

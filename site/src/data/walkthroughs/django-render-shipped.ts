import type { Walkthrough } from "./types";

/**
 * Scenario 12 (v1.3 supporting) — Priya, a solo founder, builds Quill
 * (a B2B invoicing tool for small accounting firms) from idea to
 * paying customer in two weeks. opchain scaffolds Django + Postgres,
 * deploys to Render via render.yaml Blueprint, uses GitHub Issues
 * (not Linear) for tracking. Proves the v1.3 platform expansion is
 * real, not just words in oc-stack-forge — and that the same opchain
 * pipeline that ships JS-on-Cloudflare also ships Python-on-Render
 * with no special-casing.
 */
export const djangoRenderShipped: Walkthrough = {
  id: "django-render-shipped",
  title: "Django + Postgres + Render, shipped by opchain",
  tagline: "v1.3 supporting · platform expansion proof",
  summary:
    "Solo founder builds a B2B invoicing app on Django + Postgres + Render with GitHub Issues for tracking. Same opchain pipeline as the Cloudflare-flavored scenarios — oc-stack-forge picks the stack, oc-app-architect scaffolds, oc-git-ops shapes commits from GH issues, oc-deploy-ops ships via render.yaml Blueprint. Two weeks ideation → paying customer.",
  description:
    "Quill is a B2B invoicing tool aimed at small US accounting firms (3-15 person partnerships) that hate QuickBooks but can't yet afford a dedicated finance ops team. Priya is the solo founder; she has 8 years of Python at a fintech, no Cloudflare experience, and wants the smallest possible ops surface. The opchain pipeline picks Django + Postgres + Render automatically (oc-stack-forge decision tree: solo founder, no ops appetite, server-rendered UI, admin panel needed → Django/Render is the canonical match), scaffolds the project per the v1.3 \"Platform-Specific Recipes\" in oc-app-architect's scaffold-guide, uses GitHub Issues as the PM provider (one-line config swap from Linear; same protocol §3 markers), and ships via render.yaml Blueprint (one-click Postgres + web service provisioning). The artifact set is what Priya actually ends up with after two weeks: the spec docs from /oc-spec, the render.yaml Blueprint from /oc-scaffold, the .opchain/pm.yaml configured for GitHub Issues, the first sprint contract, the first PR linked back to inv-org/quill#1.",
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
      label: "/oc-discover output — discovery summary + spec sketch",
      kind: "spec/00-project-overview.md",
      body:
`# 00-project-overview.md — Quill

**Produced by** oc-app-architect /oc-discover (Phase 1) · **Source ticket:** [inv-org/quill#1](https://github.com/inv-org/quill/issues/1) · **Run-time:** 14 minutes · **Discovery questions asked:** 9 (4 pre-filled from issue body)

## 1. TL;DR

Quill is opinionated invoicing for partnership-shaped accounting firms.
Per-firm install on Render; partner-aware data model; monthly batch
invoice generation; PDF + email delivery. Pricing $200-500/mo per firm.
Targets are 3-15-partner US CPA firms that have outgrown spreadsheets
but balk at QuickBooks' seat pricing and don't need NetSuite's complexity.

## 2. Problem (deep)

### 2.1 What the firms have today

Small US accounting partnerships (3-15 partners, ~50% of US CPA firms
by count, ~5% by revenue) live in **Google Sheets + email + QuickBooks
for the books, not for client billing**. Their actual invoicing flow:

- Each partner tracks hours worked per client in a personal spreadsheet
  or Toggl (no consolidation).
- The "operations partner" — usually one specific partner who drew the
  short straw — collates the firm's billables once a month into a
  master sheet.
- Retainer clients (~40% of revenue) get a flat-fee invoice; hourly
  clients get a line-item invoice; fixed-fee engagements get a milestone
  invoice. The ops partner does this by hand in Word or Pages templates.
- PDFs get attached to email; the ops partner mails them; payments
  arrive 14-60 days later via ACH or paper check.

### 2.2 What hurts

Pain measured from Sarah (our primary persona, see §4.1):

- **30 hours/month** spent on invoicing — just the generation, not
  collection.
- **2-3 invoicing errors/month** that get caught by the client and
  require re-issue. Each costs ~3 hours of explanation + correction.
- **Mid-month liquidity is opaque** because nobody knows the WIP
  balance until the month-end batch.
- **Onboarding a new partner = onboarding a new spreadsheet** that
  nobody else can edit consistently.

### 2.3 Why now

Three pressures:

1. **QuickBooks Online raised prices 22% in Q1 2026.** Per-seat pricing
   for a 7-partner firm is now \$840/year per partner = \$5,880/year for
   what most partners use only as a billing-export channel.
2. **The IRS Schedule M-3 reporting changes (effective 2026 tax year)**
   mean firms need cleaner billing-to-books ledgering than spreadsheets
   provide.
3. **Three of our 12 design partners specifically asked for it.** Sarah's
   firm is one. Two others are 5-partner and 11-partner firms.

## 3. Outcome the product is hired for

> "I want to load the firm's billables once a month, click generate,
>  email the PDFs, and move on with my life."
> — Sarah, ops partner, 7-partner firm

Two adjacent jobs we're explicitly **not** hiring for:

- **Bookkeeping / GL.** Quill is invoicing, not the books. Firms keep
  QBO or Xero for the books and export a Quill-→-books journal entry
  for month-end.
- **Time-tracking enforcement.** Partners enter their hours however
  they currently do. Quill ingests; it doesn't police.

## 4. Personas

### 4.1 The Ops Partner (primary; the buyer)

**Sarah**, ~45y, 7-partner firm in suburban Atlanta, the partner who
drew the short straw on operations. Spends ~30h/month on invoicing
alone. Tolerance for tooling complexity: low — she didn't sign up to
be a software user. Tolerance for cost: medium — \$200-500/mo for the
firm is fine if it saves her 20h/month at her billing rate.

**What she needs from Quill:**
- Load billables (CSV or manual entry) once a month.
- Generate + preview + send invoices in one batch.
- Export a GAAP-friendly journal entry for the firm's QBO.
- A single dashboard view of "who owes us what, aged."

**What she doesn't want:**
- Real-time anything. Month-end is the workflow.
- A mobile app. Accounting work happens at a desk.
- Mandatory training. She'll watch one 5-minute Loom and that's it.

### 4.2 Other Partners (secondary; users)

The other 6 partners log in occasionally to:
- Check their own client portfolio's WIP balance.
- Review draft invoices before send.
- Approve fee-write-offs (a feature half the firms want; gated to
  Sprint 5).

Tolerance for complexity is similar to Sarah's. They will use Quill
for ~30 min/month, max.

### 4.3 The Firm's Clients (anti-persona; never see Quill directly)

Clients receive the **emailed PDF**. They never log into Quill. Don't
build them a portal. **This is a hard line** — every "let's also build
a client portal" feature request goes to the parked-list.

## 5. Job-to-be-done (JTBD)

**When** the month closes and I have a firm's worth of unbilled hours
sitting across 7 spreadsheets,
**I want to** consolidate, generate, and send invoices in one batch,
**so that** I can spend my last day of the month doing partner-level
work instead of clerical work.

Forces:
- **Push:** spreadsheet errors costing 6+ hours/month in corrections;
  QBO price hike; tax-reporting pressure.
- **Pull:** Quill's "load → click → done" promise; the per-firm-install
  story (no SaaS-vendor-data-residency concerns).
- **Habit:** the current spreadsheet workflow is bad but familiar;
  switching cost is the implementation weekend.
- **Anxiety:** "will my partners actually enter their hours?" — same
  as today; we don't make this worse.

## 6. Competitor matrix

| Tool | Pricing (7-partner firm) | Partner-aware data? | Self-host? | Notes |
|---|---:|---|---|---|
| **QuickBooks Online** | \$5,880/yr | No (users-with-roles) | No | Industry default; partners hate the per-seat math. |
| **FreshBooks** | \$1,920/yr | No | No | Solo-friendly; partnership story is bolted on. |
| **Wave** | \$0 + per-transaction | No | No | Free tier ends at the first scale ceiling. |
| **NetSuite** | \$15,000+/yr | Yes (sort of) | No | Wildly over-spec'd for a 7-partner firm. |
| **Manual (Sheets + Word)** | \$0 | Yes (whatever the partners build) | Yes | The status quo; 30h/month tax. |
| **Quill** | \$3,600-6,000/yr | **Yes (first-class)** | **Yes (per-firm Render install)** | Wedge: partnership model + per-firm install. |

Quill's wedge is **partnership-aware data model** + **per-firm install
posture**. QBO and FreshBooks treat firms as users-with-roles; the
partnership concept is bolted on. NetSuite handles partnerships but
costs 3-5× what Sarah's firm spends on all software combined.

## 7. Pricing rationale

\$200-500/mo per firm, single-tenant Render install. Math:

- Sarah's firm spends ~\$6,000/yr on QBO + ~\$2,400/yr on time-tracking +
  ~\$1,200/yr on PDF / email tooling = ~\$9,600/yr.
- Quill replaces the billing piece of QBO + the consolidation
  spreadsheet + the PDF generation. ~\$4,200/yr (\$350/mo blended) is
  ~45% of what they spend today on the surfaces Quill replaces.
- Sarah's time saved (20h/month × \$250/h billable rate) = \$5,000/mo
  opportunity cost. Quill at \$350/mo prices the labor savings at 14×
  ROI — well above the "no-brainer" threshold for ops tools in
  professional services (typical hurdle: 3×).
- Per-firm Render install costs us ~\$50/mo at the hobby tier; gross
  margin ~85% at \$350.

We do not run a SaaS tier in v1. Per-firm install means:
- No SaaS data-residency conversation (firms host their own).
- No noisy-neighbor concerns.
- Lower support burden (one bug fix doesn't trigger an org-wide
  incident).

## 8. Anti-goals

We are not building:

- **Multi-tenant SaaS at scale.** Per-firm install only in v1. Revisit
  if we hit 50 firms.
- **A mobile app or mobile-first web.** Accounting happens at desks.
- **Real-time anything.** Month-end batch is the workflow.
- **A client portal.** Anti-persona §4.3.
- **A free tier.** Firms expect to pay for billing tooling.
- **AI features.** No "summarize this engagement" button. We're a
  billing tool, not a chat product.

## 9. Success metrics (90-day)

| Metric | Target | Source | Why |
|---|---|---|---|
| Paying firms signed | ≥ 3 | manual count | Validates the wedge |
| ARR | ≥ \$30k | manual count | Justifies continued solo-founder time |
| Months a firm runs Quill before churn | ≥ 6 | aggregate | "Tax season survives one Quill cycle" |
| Time-to-first-invoice (signup → first PDF sent) | ≤ 7 days | event: \`invoice.sent\` | Onboarding ergonomics |
| Sarah's monthly Quill time | ≤ 10h | manual sample | Replaces the 30h/month tax |
| Priya's ops time per firm per month | ≤ 1h | manual sample | Solo-founder math holds at 3 firms |

## 10. Discovery answers (verbatim from Priya)

**Q1 — Firm size?** "3-15 partner partnerships. The kind that hate QuickBooks but can't afford NetSuite."

**Q2 — Time horizon to first paying firm?** "90 days. Sarah's firm is the first; I have her LOI."

**Q3 — Anti-goals?** "Not multi-tenant SaaS at scale. Not mobile-first. Per-firm install."

**Q4 — Pricing?** "Per-firm install, \$200-500/mo. Sarah's firm signed an LOI at \$350/mo."

**Q5 — Why Python over JS / Go / Rust?** "I have 8 years of Python at a fintech. I will move 5× faster in Django than anywhere else."

**Q6 — Why server-rendered over SPA?** "Sarah won't tolerate SPA load times for batch ops. She's on a 5-year-old MacBook. Server-render is faster for the user and faster for me to build."

**Q7 — Admin panel?** "I need an internal tool fast for the design-partner phase. Django admin is the cheapest admin panel humanly possible."

**Q8 — PDF generation requirements?** "GAAP-friendly invoice template. Logo, line items, totals, tax, terms. Nothing fancy. No charts."

**Q9 — Email delivery?** "Transactional. Resend is fine; Postmark is fine. Whatever is cheapest with good deliverability."

## 11. Open questions for /oc-spec

These resolve in the spec phase:

- **Tenancy model details.** Per-firm install confirmed; but the
  data model — do we still namespace by \`firm_id\` within the single
  install (for clean export)?
- **Time-entry ingestion.** CSV upload is MVP. Toggl import is
  candidate Sprint 4 if a partner uses it.
- **Tax handling.** US-only initially. Sales-tax-on-services is per-state
  and complicated. Sprint 5 question.
- **Multi-currency.** USD only v1. Defer to v2.
- **Audit log requirements.** Internal-only audit log v1; if a firm
  asks for SOC2-style audit, that's the wedge for a paid tier.

## 12. Key risks

| # | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| R1 | Partnership data model assumption (partners as first-class entities) is wrong for a meaningful subset of CPA firms | LOW | HIGH | Validate with 3 design-partner firms before Sprint 3; have a "partners-as-users" fallback documented |
| R2 | PDF rendering performance degrades on month-end-batch (50 invoices × 7 firms = 350 PDFs at the same time) | MED | MED | Background-job the PDF generation; queue + worker (Render supports both) |
| R3 | Per-firm install is more ops than projected (firmware updates, security patches × N firms) | MED | HIGH | Track ops time per firm; if > 1h/month at 3 firms, halt and consider SaaS pivot |
| R4 | A design-partner firm hits an edge case we didn't model (e.g. ex-partner buyouts mid-engagement) | HIGH | MED | Sprint 6 reserved as "fix-what-the-design-partners-flagged" |
| R5 | QuickBooks responds with a partnership-friendly tier | LOW | HIGH | Quill wins on price + per-firm install + partnership data model; even a QBO discount doesn't close all three |
| R6 | Render outage during a customer's month-end batch | MED | HIGH | Document a 60-min PDF-export emergency runbook; daily Postgres backups via Render's built-in dump |

Checkpoint: \`.checkpoints/oc-app-architect.checkpoint.json\` (Phase 1).
`,
    },
    {
      id: "stack",
      label: "/oc-spec oc-stack-forge output — Django/Postgres/Render decision",
      kind: "spec/01-tech-stack.md",
      body:
`# 01-tech-stack.md — Quill

**Produced by** oc-stack-forge (auto-invoked by oc-app-architect Phase 2) · **Method:** v1.3 "Platform Matrix" weighted scorecard · **Re-evaluation triggers** see §8 · **Run-time:** 9 minutes

## 1. Decision criteria (defined before scoring)

Each candidate scores 1–10 against six criteria. Weights are not equal;
the brief drives them.

| Criterion | Weight | Why |
|---|---|---|
| Solo-dev ergonomics | 1.5× | Priya is alone; every hour of yak-shaving is an hour not spent on the wedge. |
| Ops appetite (managed-everything) | 1.5× | "No ops appetite" was the only hard preference. |
| Time-to-first-deploy | 1.2× | 90-day window from signed LOI to live customer. |
| Ecosystem maturity (admin, billing, PDFs) | 1.0× | Built-in beats build-it-yourself for ops tools. |
| Cost at 3 paying firms | 0.8× | Each firm gets its own install; cost scales linearly. |
| Lock-in / exit cost | 0.7× | Real but secondary; we will not refactor in year 1. |

## 2. Backend / framework scorecard

| Candidate | Solo-dev | Ops | TTFD | Ecosystem | Cost | Lock-in | Weighted |
|---|---:|---:|---:|---:|---:|---:|---:|
| **Django** | **10** | 9 | **9** | **10** | 9 | 8 | **51.4** |
| Rails | 9 | 9 | 8 | 9 | 9 | 8 | 47.6 |
| Flask | 8 | 7 | 6 | 6 | 9 | 9 | 39.2 |
| FastAPI | 8 | 7 | 6 | 5 | 9 | 9 | 37.5 |
| Hono / Node | 6 | 7 | 7 | 6 | 9 | 9 | 36.4 |
| Go / chi | 5 | 7 | 5 | 5 | 9 | 9 | 32.7 |

**Pick:** Django. Priya's Python depth + the admin panel + the
batteries-included ergonomics (auth, ORM, admin, sessions, migrations)
collapse three weeks of glue code into zero. Rails is the close second
but Priya doesn't know Rails; the learning curve outweighs the
ecosystem parity. FastAPI is great for APIs but Quill is a server-rendered
admin tool; FastAPI would force a frontend choice we don't want to make.

## 3. Database scorecard

| Candidate | Solo-dev | Ops | TTFD | Cost@3 firms | Lock-in | Weighted |
|---|---:|---:|---:|---:|---:|---:|
| **Render Postgres (starter)** | **9** | **10** | **10** | 8 | 7 | **45.9** |
| Neon | 8 | 9 | 9 | 9 | 6 | 41.7 |
| Supabase Postgres | 8 | 8 | 8 | 7 | 5 | 36.6 |
| External (RDS / Cloud SQL) | 4 | 5 | 4 | 5 | 8 | 24.5 |
| SQLite (file) | 9 | 10 | 10 | **10** | 4 | 39.7 |

**Pick:** Render Postgres (starter tier). The Render Blueprint
provisions it alongside the web service in one push; \`DATABASE_URL\`
is auto-injected; daily backups are built-in; cost is \$7/mo per firm
at hobby. SQLite scored well but loses on multi-process concurrency
(gunicorn + Django + a future worker process), backup ergonomics,
and the "we might want a second app server" forward-compat slot.
Neon was a close call; rejected on lock-in (Neon's branching is
slick but locks us into Neon's API surface for migrations).

## 4. Host / platform scorecard

| Candidate | Solo-dev | Ops | TTFD | Cost@3 firms | Lock-in | Weighted |
|---|---:|---:|---:|---:|---:|---:|
| **Render** | **10** | **10** | **10** | 8 | 7 | **47.6** |
| Heroku | 9 | 9 | 9 | 6 | 7 | 41.3 |
| Fly.io | 7 | 7 | 7 | 9 | 8 | 38.9 |
| Railway | 8 | 8 | 8 | 7 | 6 | 37.3 |
| Vercel (with serverless Postgres) | 5 | 7 | 6 | 7 | 5 | 29.5 |
| Self-host (VPS + nginx + systemd) | 3 | 2 | 3 | **10** | 9 | 21.0 |

**Pick:** Render. The \`render.yaml\` Blueprint is the load-bearing
ergonomic: one file, one push, Postgres + web service + cron jobs +
workers provisioned in lockstep. Heroku is the historical first choice
in this slot; Render wins on Blueprint declarative posture (Heroku's
\`app.json\` is similar but feels older) and on pricing (Render's free
tier is real; Heroku eliminated theirs in 2022). Fly.io and Railway
both scored well but neither has Render's docs / community / "happy
path for a Django app" depth.

## 5. PDF generation scorecard

| Candidate | Solo-dev | TTFD | Output quality | Cost | Lock-in | Weighted |
|---|---:|---:|---:|---:|---:|---:|
| **WeasyPrint** | **9** | **9** | **9** | **10** | **10** | **38.7** |
| wkhtmltopdf | 7 | 8 | 8 | 10 | 9 | 33.3 |
| Playwright (headless Chrome) | 6 | 6 | 9 | 7 | 8 | 28.9 |
| Browserless (SaaS) | 8 | 8 | 9 | 5 | 4 | 26.9 |

**Pick:** WeasyPrint. Pure-Python, runs in-process, no headless-browser
overhead, GAAP-template-friendly CSS support. The "render the invoice as
HTML, pipe through WeasyPrint to PDF" pattern is idiomatic Django and
documented in the scaffold-guide.

## 6. Email transport scorecard

| Candidate | Deliverability | DX | Cost@3 firms | Lock-in | Weighted |
|---|---:|---:|---:|---:|---:|
| **Resend** | 9 | **10** | **10** | 8 | **31.4** |
| Postmark | **10** | 9 | 7 | 8 | 28.6 |
| AWS SES | 9 | 5 | **10** | 7 | 25.4 |
| Mailgun | 8 | 7 | 8 | 7 | 23.7 |
| SendGrid | 8 | 6 | 7 | 6 | 21.7 |

**Pick:** Resend. Best DX of the modern transactional providers; the
React-Email companion (we don't use it for v1 — invoices are Django
templates — but it's a Sprint-4 candidate); the free tier covers us at
3 firms with headroom.

## 7. Anti-picks (rejected, with reason recorded)

- **Rails / Heroku.** Would have worked. Priya has zero Rails; the
  cognitive switching cost vs. continuing in Python is the deciding
  factor. Heroku-on-Render parity is real, but the Blueprint
  ergonomics + Render's modern pricing tip the platform call.
- **Cloudflare Workers + D1.** opchain's home stack. Server-rendered
  Django doesn't fit the edge model; D1 is also less mature for the
  joins Quill needs (engagements × time-entries × invoice-lines).
- **Go / Fly.io.** Overkill. Quill is CRUD + generated-PDF. Go's
  strengths (low memory, high concurrency) don't apply at this scale;
  Python's velocity does.
- **Rust / Axum / Shuttle.rs.** Priya doesn't know Rust. Adoption
  cost dwarfs the technical wins.
- **Supabase.** Four lock-in vectors (auth, DB, realtime, storage)
  with no corresponding win — Django gives us auth + storage + ORM
  already.
- **Vercel.** Optimised for Next.js + serverless. Quill is a stateful
  Django app; Vercel would force an awkward serverless-Django dance.
- **Firebase.** Cost nonlinearity past the free tier; the Firestore
  data model is wrong for partnership-aware relational data.
- **Self-host (VPS).** Ops time per firm balloons; security-patch
  cadence becomes Priya's bottleneck. Render absorbs all of that.

## 8. Re-evaluation triggers (when this decision should be revisited)

| Trigger | Reconsider |
|---|---|
| > 25 paying firms | Per-firm Render install starts to dominate ops time. Consider single-instance SaaS architecture with strict tenant isolation. |
| Any firm asks for SOC2 attestation | Render is SOC2 Type 2; that's mostly fine. But re-examine the audit-log + access-control story to support attestation. |
| A firm requires EU data residency | Render's Frankfurt region works; revisit the deploy pipeline to support region-per-firm. |
| Real-time requirement appears (e.g. live partner dashboard) | Django Channels + Render WebSockets is doable but adds complexity; revisit. |
| PDF generation p99 > 10s | WeasyPrint hitting its scaling ceiling. Move to a background worker (Render supports this; \`render.yaml\` already has a stub). |
| Priya hires a 2nd engineer | Reconsider Rails for the larger hire pool, or stay on Django and document the codebase more aggressively. |

## 9. Versions pinned (lockfile snapshot)

| Package | Version | Pin rationale |
|---|---|---|
| Python | 3.12 | Current production line; matches Render's default runtime as of 2026-Q2. |
| Django | 5.1.x | Current LTS branch. Long-term support until 2027-Q2. |
| psycopg | 3.2.x (binary) | Modern Postgres driver; \`binary\` saves us a C-compile step. |
| dj-database-url | 2.3.x | Parses Render's \`DATABASE_URL\` into Django settings. |
| gunicorn | 22.0.x | Battle-tested; Render's recommended WSGI server. |
| WeasyPrint | 64.x | Latest stable; pure-Python PDF rendering. |
| Resend | 1.x (Python SDK) | Resend's first-party SDK. |
| pytest | 8.x | Modern test runner; standard. |
| pytest-django | 4.x | Django integration. |
| Postgres | 17 | Render's default major version. |

Render \`runtime\` field: \`python\` (auto-detects 3.12 from
\`runtime.txt\`).

## 10. Cost band

| Firms | Render web (starter) | Render Postgres (starter) | Resend | Total / mo | Revenue / mo | Gross margin |
|---:|---:|---:|---:|---:|---:|---:|
| 1 (Sarah's firm) | \$7 | \$7 | \$0 (free) | \$14 | \$350 | 96% |
| 3 | \$21 | \$21 | \$0 | \$42 | \$1,050 | 96% |
| 10 | \$70 | \$70 | \$20 | \$160 | \$3,500 | 95% |
| 25 | \$425 (mix of starter + standard) | \$425 | \$50 | \$900 | \$8,750 | 90% |

At 25 firms, ops time per firm becomes the binding constraint, not
infrastructure cost. Re-evaluation trigger §8 fires.

Checkpoint: \`.checkpoints/oc-stack-forge.checkpoint.json\`.
`,
    },
    {
      id: "render-yaml",
      label: "render.yaml — Blueprint for Postgres + web service",
      kind: "render.yaml",
      body:
`# render.yaml — Quill Blueprint
# Produced by oc-app-architect /oc-scaffold per scaffold-guide.md § Django/Render.
# Render reads this on first push and provisions everything below.
# Subsequent deploys are pure git push.

databases:
  - name: quill-db
    plan: starter         # \$7/mo; daily backups built-in
    postgresMajorVersion: 17

services:
  # ──────────────────────────────────────────────────────────
  # Production web service
  # ──────────────────────────────────────────────────────────
  - type: web
    name: quill
    runtime: python
    plan: starter         # \$7/mo
    region: oregon
    rootDir: .
    buildCommand: |
      pip install -r requirements.txt
      python manage.py collectstatic --noinput
    startCommand: gunicorn core.wsgi:application --workers 3 --timeout 30
    preDeployCommand: python manage.py migrate --noinput   # release step; runs on every deploy
    healthCheckPath: /health
    autoDeploy: true
    branch: main
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
      - key: CSRF_TRUSTED_ORIGINS
        value: https://quill.onrender.com,https://quill.priyabuilds.com
      - key: RESEND_API_KEY
        sync: false                      # set manually in dashboard (secret)
      - key: SENTRY_DSN
        sync: false                      # set manually in dashboard (secret)
      - key: RENDER_GIT_COMMIT           # Render auto-injects; we surface in /health
        sync: false

  # ──────────────────────────────────────────────────────────
  # Staging web service (auto-deploy from main; cheaper plan)
  # ──────────────────────────────────────────────────────────
  - type: web
    name: quill-staging
    runtime: python
    plan: free
    region: oregon
    rootDir: .
    buildCommand: |
      pip install -r requirements.txt
      python manage.py collectstatic --noinput
    startCommand: gunicorn core.wsgi:application --workers 1
    preDeployCommand: python manage.py migrate --noinput
    healthCheckPath: /health
    autoDeploy: true
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
      - key: ALLOWED_HOSTS
        value: quill-staging.onrender.com
      - key: RESEND_API_KEY
        sync: false

# ──────────────────────────────────────────────────────────
# Sprint 4+ scaffolding (commented; uncomment when needed)
# ──────────────────────────────────────────────────────────
#
#  # PDF rendering worker (Sprint 4: month-end batch).
#  # Run PDF generation off the web request path so a 50-invoice batch
#  # doesn't hold a gunicorn worker for 30s.
#  - type: worker
#    name: quill-pdf-worker
#    runtime: python
#    plan: starter
#    region: oregon
#    buildCommand: pip install -r requirements.txt
#    startCommand: python manage.py rqworker pdf
#    envVars:
#      - key: DJANGO_SETTINGS_MODULE
#        value: core.settings.prod
#      - key: DATABASE_URL
#        fromDatabase:
#          name: quill-db
#          property: connectionString
#      - key: REDIS_URL
#        fromService:
#          type: redis
#          name: quill-redis
#          property: connectionString
#
#  # Redis for the PDF worker queue (Sprint 4).
#  - type: redis
#    name: quill-redis
#    plan: starter
#    region: oregon
#    ipAllowList: []
#    maxmemoryPolicy: allkeys-lru
#
#  # Persistent disk for staging PDFs while debugging template issues (Sprint 4).
#  # Production never holds PDFs to disk — they email and discard.
#  disk:
#    name: pdf-tmp
#    mountPath: /var/tmp/quill-pdfs
#    sizeGB: 1
#
#  # Monthly invoicing cron — triggers the batch generation on the 1st (Sprint 5).
#  # We do NOT generate invoices automatically in v1; this is the Sprint-5 hook
#  # for firms that want a fully-automated month-end run.
#  - type: cron
#    name: quill-monthly-invoicing
#    runtime: python
#    plan: starter
#    region: oregon
#    schedule: "0 9 1 * *"   # 09:00 UTC on the 1st of every month
#    buildCommand: pip install -r requirements.txt
#    startCommand: python manage.py monthly_invoicing_batch
#    envVars:
#      - key: DJANGO_SETTINGS_MODULE
#        value: core.settings.prod
#      - key: DATABASE_URL
#        fromDatabase:
#          name: quill-db
#          property: connectionString
`,
    },
    {
      id: "pm-yaml-gh",
      label: "`.opchain/pm.yaml` — GitHub Issues config",
      kind: "config.yaml",
      body:
`# .opchain/pm.yaml — Quill (provider: github-issues)
# Generated by oc-app-architect /init; reviewed quarterly.
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

# Map domain → on-call user. Solo founder for now; maintained
# for forward-compat when Priya hires.
remediation_owners:
  backend:  priya
  frontend: priya
  data:     priya
  infra:    priya

# v1.2 behaviour toggles
create_child_tickets: true
cycle_aware: false                    # GH has no built-in cycles; use milestones if needed
comment_dedupe_window: 7d
pr_template: ".github/pull_request_template.md"

# State transitions that require a passing audit gate.
audit_required_for_state_transitions:
  - "status:staging-verified"
  - "status:shipped"

# Map service → PagerDuty escalation policy.
# Solo founder = single escalation; documented anyway for future-proofing.
pagerduty_routing:
  web:               EP-QUILL-PRIMARY
  pdf-worker:        EP-QUILL-PRIMARY
  background-cron:   EP-QUILL-PRIMARY

# Branch naming. oc-git-ops fills the {slug} from the issue title.
worktree_naming: "feat/quill-{issue-number}-{slug}"

# v1.3 tool registry resolves these protocol verbs to concrete MCP tools:
#   get_issue        → mcp__mcp-server-github__issue_read
#   list_issues      → mcp__mcp-server-github__list_issues
#   add_comment      → mcp__mcp-server-github__add_issue_comment
#   create_issue     → mcp__mcp-server-github__issue_write (action=create)
#   transition_state → mcp__mcp-server-github__issue_write (with state field)
#   close_issue      → mcp__mcp-server-github__issue_write (state=closed)
# (No tool_overrides — public github.com works out of the box.)
`,
    },
    {
      id: "scaffold",
      label: "/oc-scaffold output — Django project layout + selected file contents",
      kind: "tree",
      body:
`# Files written by /oc-scaffold (per scaffold-guide.md § Django/Render)

**Produced by** oc-app-architect /oc-scaffold (Phase 3) · **Method:** scaffold-guide.md § Django recipe · **Files written:** 41 (18 source + 12 test + 11 config) · **Run-time:** 11 minutes

## 1. Layout

\`\`\`
quill/
├── manage.py
├── runtime.txt                    # python-3.12
├── requirements.txt               # see §2.6 below
├── pytest.ini                     # DJANGO_SETTINGS_MODULE=core.settings.dev addopts=-ra
├── render.yaml                    # see artifact 'render.yaml'
├── .env.example                   # DATABASE_URL=postgres://... SECRET_KEY=... etc.
├── .gitignore
├── .github/
│   └── pull_request_template.md   # referenced from pm.yaml
├── core/
│   ├── __init__.py
│   ├── settings/
│   │   ├── __init__.py
│   │   ├── base.py                # shared settings
│   │   ├── dev.py                 # debug=True, sqlite for offline dev
│   │   └── prod.py                # debug=False, dj_database_url.parse(env('DATABASE_URL'))
│   ├── urls.py
│   ├── wsgi.py
│   ├── views.py                   # /health (returns SHA + DB ping)
│   └── tests/
│       ├── __init__.py
│       └── test_health.py
├── apps/
│   ├── __init__.py
│   ├── firms/                     # the partnership tenant
│   │   ├── __init__.py
│   │   ├── apps.py
│   │   ├── models.py              # Firm, Partner, Engagement
│   │   ├── views.py
│   │   ├── urls.py
│   │   ├── admin.py               # full Django-admin registration
│   │   ├── migrations/
│   │   │   ├── __init__.py
│   │   │   └── 0001_initial.py
│   │   └── tests/
│   │       ├── __init__.py
│   │       └── test_models.py
│   ├── billables/                 # time entries, retainers, fixed fees (Sprint 1)
│   │   ├── __init__.py
│   │   ├── apps.py
│   │   ├── models.py              # placeholder; Sprint 1 fleshes out
│   │   └── ...
│   ├── invoices/                  # generation, PDF render, email (Sprint 2-3)
│   │   ├── ...
│   └── auth/                      # bare auth on top of django.contrib.auth
│       └── ...
└── templates/
    ├── base.html
    ├── invoices/list.html
    └── invoices/detail.html
\`\`\`

Scaffold respects the **"Minimal but complete" rule** from scaffold-guide:
no placeholder \`TODO\` files. Every file has real, runnable code; \`runserver\`
boots; \`pytest\` passes (18 tests on the scaffold itself).

## 2. Selected file contents

### 2.1 \`core/settings/base.py\`

\`\`\`python
"""Quill — shared Django settings.

Loaded by both \`dev\` and \`prod\`. Anything environment-specific lives in
the per-env module, not here. Never edit this file with a setting that
depends on a secret or an env var; route those through dev.py / prod.py.
"""
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent.parent

# Apps —————————————————————————————————————————————————————————————
INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    # Quill apps; order: firms first (tenant), then everything that
    # references firms. Django will use this for migration ordering.
    "apps.firms",
    "apps.billables",
    "apps.invoices",
    "apps.auth",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "core.urls"
WSGI_APPLICATION = "core.wsgi.application"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [BASE_DIR / "templates"],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
]

LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
STATICFILES_STORAGE = "whitenoise.storage.CompressedManifestStaticFilesStorage"

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
\`\`\`

### 2.2 \`core/settings/prod.py\`

\`\`\`python
"""Quill — production Django settings.

Reads everything sensitive from the environment. Render injects
DATABASE_URL via the Blueprint; we never hard-code it. SECRET_KEY is
generated by Render on first deploy.
"""
import os
import dj_database_url

from .base import *  # noqa: F401, F403

DEBUG = False
SECRET_KEY = os.environ["SECRET_KEY"]
ALLOWED_HOSTS = os.environ.get("ALLOWED_HOSTS", "").split(",")
CSRF_TRUSTED_ORIGINS = os.environ.get("CSRF_TRUSTED_ORIGINS", "").split(",")

DATABASES = {
    "default": dj_database_url.parse(
        os.environ["DATABASE_URL"],
        conn_max_age=600,
        ssl_require=True,
    ),
}

# Security headers ————————————————————————————————————————————————
SECURE_HSTS_SECONDS = 60 * 60 * 24 * 365 * 2   # 2y; preload after a soak
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
SECURE_SSL_REDIRECT = True
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
X_FRAME_OPTIONS = "DENY"

# Email ——————————————————————————————————————————————————————————
EMAIL_BACKEND = "anymail.backends.resend.EmailBackend"
ANYMAIL = {"RESEND_API_KEY": os.environ["RESEND_API_KEY"]}
DEFAULT_FROM_EMAIL = "Quill <noreply@quill.priyabuilds.com>"

# Logging ————————————————————————————————————————————————————————
LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "json": {
            "()": "pythonjsonlogger.jsonlogger.JsonFormatter",
            "format": "%(asctime)s %(levelname)s %(name)s %(message)s",
        },
    },
    "handlers": {
        "console": {"class": "logging.StreamHandler", "formatter": "json"},
    },
    "root": {"handlers": ["console"], "level": "INFO"},
}
\`\`\`

### 2.3 \`apps/firms/models.py\`

\`\`\`python
"""Quill — firm / partner / engagement domain.

The 'firm' is the tenant boundary. A Quill install is single-firm in v1
(per-firm Render deployment), but the firm model is namespaced
explicitly anyway so we can export clean data and so multi-firm-install
remains a forward-compat option without a schema migration.
"""
from django.db import models
from django.contrib.auth.models import User


class Firm(models.Model):
    """A CPA partnership running on this Quill install."""
    slug = models.SlugField(max_length=64, unique=True)
    legal_name = models.CharField(max_length=200)
    display_name = models.CharField(max_length=120)
    tax_id = models.CharField(max_length=20, blank=True)  # US EIN
    address = models.TextField()
    invoice_terms_default = models.CharField(max_length=80, default="Net 30")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [models.Index(fields=["slug"])]

    def __str__(self) -> str:
        return self.display_name


class Partner(models.Model):
    """A named partner of the firm. First-class entity in the data model.

    Each partner has their own billable hours, their own client portfolio,
    and their own profit share. The 'user' relationship is auth-only;
    the Partner is the business entity.
    """
    firm = models.ForeignKey(Firm, on_delete=models.CASCADE, related_name="partners")
    user = models.OneToOneField(
        User, on_delete=models.PROTECT, related_name="partner", null=True, blank=True,
    )
    display_name = models.CharField(max_length=120)
    email = models.EmailField(unique=True)
    title = models.CharField(max_length=80, default="Partner")
    billing_rate_cents = models.PositiveIntegerField(default=25000)  # \$250/hr default
    profit_share_bp = models.PositiveSmallIntegerField(
        default=1000,
        help_text="basis points (1/100 of a percent). 1000 = 10%.",
    )
    is_active = models.BooleanField(default=True)
    joined_at = models.DateField()
    departed_at = models.DateField(null=True, blank=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["firm", "display_name"], name="unique_partner_per_firm",
            ),
        ]
        indexes = [
            models.Index(fields=["firm", "is_active"]),
        ]

    def __str__(self) -> str:
        return f"{self.display_name} ({self.firm.display_name})"


class Engagement(models.Model):
    """A client engagement. Could be retainer, hourly, or fixed-fee."""
    KIND_CHOICES = [
        ("retainer", "Retainer"),
        ("hourly", "Hourly"),
        ("fixed", "Fixed fee"),
    ]
    firm = models.ForeignKey(Firm, on_delete=models.CASCADE, related_name="engagements")
    client_name = models.CharField(max_length=200)
    client_billing_email = models.EmailField()
    lead_partner = models.ForeignKey(
        Partner, on_delete=models.PROTECT, related_name="led_engagements",
    )
    kind = models.CharField(max_length=16, choices=KIND_CHOICES)
    retainer_amount_cents = models.PositiveIntegerField(null=True, blank=True)
    fixed_fee_cents = models.PositiveIntegerField(null=True, blank=True)
    started_on = models.DateField()
    ended_on = models.DateField(null=True, blank=True)
    notes = models.TextField(blank=True)

    class Meta:
        indexes = [
            models.Index(fields=["firm", "kind"]),
            models.Index(fields=["lead_partner", "started_on"]),
        ]

    def __str__(self) -> str:
        return f"{self.client_name} ({self.kind})"
\`\`\`

### 2.4 \`core/views.py\` (healthcheck)

\`\`\`python
"""Quill — the single non-app view we ship: /health.

Render uses this for the Blueprint healthCheckPath. Returns the deployed
SHA + a Postgres ping. Anything else is owned by the apps.
"""
import os
import time
from django.db import connection
from django.http import JsonResponse


def health(_request):
    started = time.perf_counter()
    db_ok = True
    db_err = None
    try:
        with connection.cursor() as cur:
            cur.execute("SELECT 1")
            cur.fetchone()
    except Exception as exc:  # pragma: no cover — only logged
        db_ok = False
        db_err = str(exc)[:128]
    elapsed_ms = int((time.perf_counter() - started) * 1000)
    payload = {
        "ok": db_ok,
        "service": "quill",
        "sha": os.environ.get("RENDER_GIT_COMMIT", "dev"),
        "db_ping_ms": elapsed_ms,
    }
    if db_err:
        payload["db_error"] = db_err
    return JsonResponse(payload, status=200 if db_ok else 503)
\`\`\`

### 2.5 \`pytest.ini\`

\`\`\`ini
[pytest]
DJANGO_SETTINGS_MODULE = core.settings.dev
python_files = test_*.py
addopts = -ra --strict-markers --tb=short
markers =
    slow: marks tests as slow (run with \`pytest -m slow\`)
    integration: marks tests as requiring a live Postgres
\`\`\`

### 2.6 \`requirements.txt\` (pinned)

\`\`\`
Django==5.1.4
psycopg[binary]==3.2.3
dj-database-url==2.3.0
gunicorn==22.0.0
whitenoise==6.7.0
WeasyPrint==64.0
django-anymail[resend]==12.0
python-json-logger==2.0.7
pytest==8.3.3
pytest-django==4.9.0
\`\`\`

## 3. Why this layout

Three deliberate choices the scaffold-guide encodes:

- **\`apps/<domain>/\` over Django's default \`<domain>/\` at the root.**
  Keeps the project root un-crowded; lets you grep for "everything app-related"
  with \`find apps/\`. Django's documentation defaults are fine for tutorials
  but get noisy at >3 apps.
- **\`core/settings/{base,dev,prod}.py\`.** Never a single \`settings.py\`.
  Pure functional sanity: dev/prod divergence is a fact, the split makes it
  reviewable. \`DJANGO_SETTINGS_MODULE\` env var picks the active one.
- **\`pytest\` over \`manage.py test\`.** Better fixtures, better parametrisation,
  better discovery. \`pytest-django\` handles the Django integration.

## 4. Verification

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

\`\`\`
$ curl -fsS http://127.0.0.1:8000/health | jq .
{
  "ok": true,
  "service": "quill",
  "sha": "dev",
  "db_ping_ms": 4
}
\`\`\`

Checkpoint: \`.checkpoints/oc-app-architect.checkpoint.json\` (Phase 3).
`,
    },
    {
      id: "first-pr",
      label: "First PR — fix linked back to inv-org/quill#5",
      kind: "github.pr",
      body:
`# PR #1 — feat(billables): time-entry CRUD + bulk import

> Auto-generated by opchain oc-git-ops v1.2 from GitHub Issue
> [#5](https://github.com/inv-org/quill/issues/5).
> Branch: \`feat/quill-5-time-entry-foundations\` · Base: \`main\` · SHA: \`bb1f0e2\`

\`https://github.com/inv-org/quill/pull/1\`

**Linked issue:** [#5 — Sprint 1: time-entry foundations](https://github.com/inv-org/quill/issues/5)
**Reviewers:** (solo founder — self-review + design-partner Sarah for UX)
**Labels:** \`opchain\`, \`agent-driven\`, \`area:billables\`, \`size:M\`

## Summary

Adds the \`TimeEntry\` model + bulk-import CSV view + the
\`/billables/list/\` admin page. Bulk-import respects the firm-tenant
boundary; a partner of firm A cannot import time entries for firm B
(enforced via row-level filter in the admin queryset + form clean).
Closes #5.

## Why

Time entries are the atomic input to invoice generation. Sprint 1's
job is to get them into Quill cleanly. The bulk-import path is the
"Sarah's first 10 minutes" path — she'll dump a month of her firm's
Toggl export and we need to ingest it without making her edit Django
admin forms one-by-one.

(Sprint 2 turns these into draft invoices; Sprint 3 renders + emails.
This PR is one step in a four-step Sprint 1-3 arc.)

## How

### Files changed

| File | Lines | Purpose |
|---|---:|---|
| \`apps/billables/models.py\` | +88 | New \`TimeEntry\` model with tenant-scoped manager. |
| \`apps/billables/admin.py\` | +52 | Django admin with tenant-filtered queryset + bulk-import action. |
| \`apps/billables/views.py\` | +94 | \`/billables/list/\` (paginated) + \`/billables/import/\` (CSV upload). |
| \`apps/billables/forms.py\` | +43 | \`TimeEntryForm\` + \`TimeEntryCSVImportForm\` with row-level validation. |
| \`apps/billables/urls.py\` | +18 | Routes for list / import. |
| \`apps/billables/csv_import.py\` | +78 | Streaming CSV parser with per-row error collection. |
| \`apps/billables/migrations/0002_timeentry.py\` | +34 | Migration. |
| \`apps/billables/tests/test_models.py\` | +112 | 8 model + tenant tests. |
| \`apps/billables/tests/test_csv_import.py\` | +148 | 6 CSV-import tests. |
| \`templates/billables/list.html\` | +62 | List view (server-rendered, server-paginated). |
| \`templates/billables/import.html\` | +44 | Upload form + result summary. |

**Total: 12 files changed, +387 lines, -4 lines, 8 new tests + 6 new
CSV-import tests (14 new tests).**

### TimeEntry model excerpt

\`\`\`python
class TimeEntry(models.Model):
    firm = models.ForeignKey(Firm, on_delete=models.CASCADE, related_name="time_entries")
    partner = models.ForeignKey(Partner, on_delete=models.PROTECT, related_name="time_entries")
    engagement = models.ForeignKey(Engagement, on_delete=models.PROTECT, related_name="time_entries")
    worked_on = models.DateField()
    hours = models.DecimalField(max_digits=6, decimal_places=2)
    description = models.TextField(blank=True)
    billable = models.BooleanField(default=True)
    rate_override_cents = models.PositiveIntegerField(null=True, blank=True)
    invoice_line = models.ForeignKey(
        "invoices.InvoiceLine", on_delete=models.SET_NULL, null=True, blank=True,
    )
    imported_from = models.CharField(max_length=64, blank=True)  # e.g. "toggl-csv"
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            models.Index(fields=["firm", "worked_on"]),
            models.Index(fields=["partner", "worked_on"]),
            models.Index(fields=["engagement", "worked_on"]),
        ]
        constraints = [
            models.CheckConstraint(check=models.Q(hours__gt=0), name="hours_positive"),
            models.CheckConstraint(check=models.Q(hours__lte=24), name="hours_under_24"),
        ]
\`\`\`

### CSV bulk-import path

\`\`\`python
# apps/billables/csv_import.py (abbreviated)
def import_time_entries_csv(*, firm: Firm, partner: Partner, csv_text: str) -> ImportResult:
    """Stream-parse a Toggl-style CSV; create TimeEntry rows; collect per-row errors."""
    reader = csv.DictReader(io.StringIO(csv_text))
    created, skipped, errors = [], [], []
    for idx, row in enumerate(reader, start=2):  # account for header row
        try:
            entry = _build_entry_from_row(firm=firm, partner=partner, row=row)
            entry.full_clean()
            entry.save()
            created.append(entry.pk)
        except (ValidationError, KeyError) as exc:
            errors.append({"row": idx, "raw": row, "error": str(exc)})
        except Exception:
            logger.exception("unexpected error importing time-entry row %s", idx)
            errors.append({"row": idx, "raw": row, "error": "internal error; see logs"})
    return ImportResult(created=created, skipped=skipped, errors=errors)
\`\`\`

## Test plan

All 14 new tests pass:

- [x] **test_model_tenant_isolation** — a TimeEntry for firm A is invisible from firm B's manager.
- [x] **test_model_hours_constraint** — hours=0 and hours=25 are rejected at the DB level.
- [x] **test_model_rate_override** — rate_override_cents takes precedence over partner.billing_rate_cents.
- [x] **test_admin_bulk_import_happy** — 10-row Toggl CSV creates 10 TimeEntries.
- [x] **test_admin_bulk_import_partial_failure** — 10-row CSV with 2 malformed rows: 8 created, 2 in errors list.
- [x] **test_admin_cross_tenant_forbidden** — partner of firm A cannot import via firm B's admin URL.
- [x] **test_view_list_filters_by_partner** — \`?partner=\` query param scopes correctly.
- [x] **test_view_list_pagination** — page size 50; second page works.
- [x] **test_csv_import_streams** — 10,000-row import doesn't materialise the whole CSV in memory (heap p95 < 32MB).
- [x] **test_csv_import_rejects_zero_hours** — row with hours=0 lands in errors, not created.
- [x] **test_csv_import_rejects_unknown_engagement** — row referencing an engagement not in firm A's set lands in errors.
- [x] **test_csv_import_handles_quoting** — RFC-4180-style quoted descriptions round-trip correctly.
- [x] **test_csv_import_logs_unexpected** — internal exceptions are logged + surfaced as generic error in result.
- [x] **test_csv_import_idempotency** — re-importing the same CSV creates duplicate rows (intentional; idempotency would need a row-key the source doesn't provide).

Run: \`pytest -q apps/billables/\` → \`14 passed in 0.93s\`.

## Performance

Bulk-import benchmark (10,000-row Toggl CSV; representative of Sarah's
firm's first onboarding dump):

| Metric | Value |
|---|---:|
| Wall-clock to last row | 4.8s |
| Heap p95 | 28 MB |
| Heap peak | 31 MB |
| Postgres roundtrips | 10,002 (one per row + 2 for setup) |
| Estimated worst-case (25,000 rows) | 12s |

A future Sprint can batch the inserts (Django's \`bulk_create\` with
batch_size=500) to cut Postgres roundtrips ~100×; not needed yet.
Tracked as #18.

## Sample transactions

### Import a CSV

\`\`\`
$ curl -X POST -F 'file=@toggl-2026-04.csv' \\
    -H 'Cookie: sessionid=...' \\
    https://quill-staging.onrender.com/billables/import/
{
  "created": 247,
  "skipped": 0,
  "errors": [
    {"row": 14, "error": "hours_positive: hours must be > 0"},
    {"row": 89, "error": "Engagement 'Acme Co' not in firm 'sarah-cpa-partners'"}
  ]
}
\`\`\`

### List entries

\`\`\`
$ curl -H 'Cookie: sessionid=...' \\
    https://quill-staging.onrender.com/billables/list/?partner=sarah | head -20
<!DOCTYPE html>
<html>
<head><title>Time entries — Sarah — Quill</title></head>
<body>
  <h1>Time entries for Sarah</h1>
  <table>
    <tr><th>Date</th><th>Engagement</th><th>Hours</th><th>Description</th><th>Billable</th></tr>
    <tr><td>2026-04-30</td><td>Acme Co</td><td>4.5</td><td>Q1 review</td><td>✓</td></tr>
    ...
\`\`\`

## Rollout

- **Feature flag:** none. New surface, no existing behaviour to gate.
- **Migration:** \`apps/billables/migrations/0002_timeentry.py\` runs on next deploy via \`preDeployCommand\` (\`python manage.py migrate --noinput\`).
- **Onboarding:** Sarah will see the new \`/billables/import/\` link in the admin nav after this deploys.

## Reviewer guide (or future-Priya guide)

If you're returning to this code in 6 months:

1. Start at \`apps/billables/models.py\` — the tenant-scoped manager
   is the load-bearing isolation primitive.
2. Then \`apps/billables/csv_import.py\` — stream-parse pattern that
   we'll reuse for Toggl / Harvest / spreadsheet imports.
3. Then the test file \`test_csv_import.py\` — covers the partial-failure
   semantics (created list + errors list, never a transaction abort).
4. Skip \`templates/billables/list.html\` — it's plain Django templates,
   no surprises.

## Audit gate

- [x] **pytest** PASS (147 total, 14 new)
- [x] **mypy** PASS (no new \`# type: ignore\` directives)
- [x] **bandit** PASS (no security findings)
- [x] **oc-bug-check** PASS (1.1s)

## Comment posted back to issue #5

\`\`\`
<!-- opchain:oc-git-ops:pr-opened:#1 -->
PR opened: https://github.com/inv-org/quill/pull/1
Branch: feat/quill-5-time-entry-foundations
Tests: 14 new, 147 total pass
Audit gate: PASS (pytest, mypy, bandit, oc-bug-check)
\`\`\`

(Same shape as the Linear scenarios — the v1.3 protocol abstracts the
provider; only the tool names change.)

## When this merges

oc-git-ops will:

1. Add comment with marker \`<!-- opchain:oc-git-ops:pr-merged:#1 -->\`.
2. Remove label \`status:in-review\` from issue #5.
3. Close issue #5 (the GitHub-Issues equivalent of Linear's \`Done\` state per \`pm.yaml\`).
4. Trigger the auto-deploy pipeline (oc-deploy-ops picks up from there).

## Out of scope (linked tickets cover)

- The "Generate invoice" button on the list view — owned by #11 (Sprint 2).
- PDF render path — owned by #15 (Sprint 3).
- Email delivery — owned by #16 (Sprint 3).
- Toggl OAuth integration (vs. CSV upload) — parked as #28.

---

Refs: #5 · Sprint 1: time-entry foundations · Audit gate: PASS

🤖 Generated with opchain oc-git-ops v1.2.
`,
    },
    {
      id: "first-deploy",
      label: "First deploy via Render Blueprint",
      kind: "deploy.log",
      body:
`# /oc-deploy staging — first push to Render

**Produced by** oc-deploy-ops · **Provider:** Render (auto-detected from \`render.yaml\`) · **Range:** \`<empty>..bb1f0e2\` (first deploy) · **Audit gate:** PASS

## 1. Staging deploy (initial Blueprint apply)

\`\`\`
[oc-deploy-ops] Provider detected: Render (render.yaml present at repo root)
[oc-deploy-ops] Audit gate:
  ✓ oc-code-auditor /oc-audit pre-deploy  Grade A
  ✓ bandit                          PASS
  ✓ pytest                          147 / 147 PASS
  ✓ oc-bug-check                       PASS
[oc-deploy-ops] git push render main → 2026-05-22T14:08:11Z

Render Blueprint applying:
  ✓ Database 'quill-db' (plan: starter, region: oregon, postgres 17)
  ✓ Service 'quill-staging' (plan: free, region: oregon, runtime: python 3.12)
  ✓ Service 'quill' (plan: starter, region: oregon, runtime: python 3.12)

Build (build 1):
  - pip install -r requirements.txt         → 23.4s
  - python manage.py collectstatic --noinput → 1.1s (174 files, 412 KB)

Deploy:
  - preDeployCommand: python manage.py migrate --noinput → 0.8s
    Applying contenttypes.0001_initial...        OK
    Applying auth.0001_initial...                OK
    Applying admin.0001_initial...               OK
    Applying admin.0002_logentry_remove_auto_add. OK
    Applying admin.0003_logentry_add_action_flag. OK
    Applying contenttypes.0002_remove_content_type_name. OK
    Applying auth.0002_alter_permission_name_max_length. OK
    Applying auth.0003_alter_user_email_max_length. OK
    Applying auth.0004_alter_user_username_opts. OK
    Applying auth.0005_alter_user_last_login_null. OK
    Applying auth.0006_require_contenttypes_0002. OK
    Applying sessions.0001_initial.              OK
    Applying firms.0001_initial.                 OK
    Applying billables.0001_initial.             OK
    Applying billables.0002_timeentry.           OK
    Applying invoices.0001_initial.              OK
  - startCommand: gunicorn core.wsgi:application --workers 1 → service healthy

[oc-deploy-ops] /api/health → 200; body:
  {
    "ok": true,
    "service": "quill",
    "sha": "bb1f0e2",
    "db_ping_ms": 4
  }
\`\`\`

## 2. Cost summary (per Render dashboard)

| Resource | Plan | Monthly | Notes |
|---|---|---:|---|
| \`quill-db\` Postgres 17 | starter | \$7 | 256MB / 1GB disk; daily backup retained 7d. |
| \`quill\` web | starter | \$7 | 512MB RAM, 1 vCPU, no sleep. |
| \`quill-staging\` web | free | \$0 | 512MB RAM, sleeps after 15min of inactivity. |
| **Total at 1 firm** | | **\$14 / mo** | Plus Resend (free up to 3k emails/mo). |

## 3. Post-deploy verification

\`\`\`
[oc-deploy-ops] Smoke checks:

$ curl -fsS https://quill-staging.onrender.com/health | jq .
  → ok=true, sha=bb1f0e2, db_ping_ms=4               PASS

$ curl -fsS -L https://quill-staging.onrender.com/admin/login/ \\
    | grep -c 'Django administration'
  → 1                                                 PASS  (admin login page renders)

$ curl -fsS -I https://quill-staging.onrender.com/
  → 301 → /admin/login/                               PASS

$ curl -fsS -I https://quill-staging.onrender.com/health
  → strict-transport-security: max-age=63072000; includeSubDomains; preload
  → x-frame-options: DENY
                                                      PASS  (security headers present)

All 4 smoke checks PASS.
\`\`\`

## 4. Pre-create check for the deploy ticket

\`\`\`
[oc-deploy-ops] mcp__mcp-server-github__list_issues(
    owner=inv-org, repo=quill,
    labels=["type:deploy"],
    body_text_query="opchain:oc-deploy-ops:deploy-created:staging:bb1f0e2"
  )
  → no match. Creating.

[oc-deploy-ops] mcp__mcp-server-github__issue_write(action=create):
  Title: "Deploy: staging <empty>..bb1f0e2 — first deploy"
  Body:
    <!-- opchain:oc-deploy-ops:deploy-created:staging:bb1f0e2 -->

    Environment: staging
    Range: <empty>..bb1f0e2  (initial)
    Commits: 3 (#3 scaffold, #4 firms-domain, #1 time-entry CRUD)
    Linked issues: #1, #3, #4, #5
    Audit gate: PASS
    Smoke tests: 4/4 PASS
    Render service: quill-staging
    URL: https://quill-staging.onrender.com
  Labels: [opchain, agent-driven, type:deploy, status:staging-verified]
  → Created issue #14.

[oc-deploy-ops] Comment on each linked issue (#1, #3, #4, #5):
  → 4 comments posted, each with marker
    <!-- opchain:oc-deploy-ops:linked-shipped:#14:#<n> -->
\`\`\`

## 5. /oc-deploy prod (Day 14, after Sarah signs the contract)

\`\`\`
[oc-deploy-ops] git push render main (with prod service active)
[oc-deploy-ops] Build + deploy: 31s
[oc-deploy-ops] preDeployCommand: 6 migrations applied since last deploy
[oc-deploy-ops] /api/health → ok=true, sha=d18ca44

[oc-deploy-ops] Production smoke:
  ✓ /health
  ✓ /admin/login/ renders
  ✓ HSTS + X-Frame-Options + Referrer-Policy headers present
  ✓ Resend send-test fired; delivery confirmed (rid: re_xxx...)
  ✓ Sarah's firm record loaded; first-partner login successful (Sarah)

[oc-deploy-ops] Quill is live: https://quill.priyabuilds.com
[oc-deploy-ops] Sarah's firm onboarded:
  - Firm: 'sarah-cpa-partners' (7 partners)
  - 1 admin user provisioned (sarah@sarah-cpa.example)
  - 7 partner records imported via /firms/import-partners/
  - 4 engagements seeded for April pilot
  - First test invoice generated (PDF emailed to Sarah; she confirmed)

[oc-deploy-ops] mcp__mcp-server-github__add_issue_comment(
  owner=inv-org, repo=quill, issue_number=14,
  body="<!-- opchain:oc-deploy-ops:prod-shipped:#14 -->
        Prod deployed: d18ca44. Smoke 5/5 PASS. Sarah's firm onboarded;
        first invoice PDF emailed and confirmed. Closing deploy ticket.")
[oc-deploy-ops] mcp__mcp-server-github__issue_write(
  issue_number=14, state="closed", labels_add=["status:shipped"])

[oc-deploy-ops] First-firm onboarding delta (env vars set in Render dashboard):
  - ALLOWED_HOSTS: quill.priyabuilds.com,sarah-cpa.quill.priyabuilds.com
  - CSRF_TRUSTED_ORIGINS: https://quill.priyabuilds.com,https://sarah-cpa.quill.priyabuilds.com
  - QUILL_FIRM_SLUG: sarah-cpa-partners (single-tenant install)
\`\`\`

## 6. Cost projection at scale

| Firms | Render web | Render Postgres | Resend | Total / mo | Revenue / mo (avg \$350) | Gross margin |
|---:|---:|---:|---:|---:|---:|---:|
| 1 (today) | \$7 | \$7 | \$0 | **\$14** | \$350 | 96% |
| 3 | \$21 | \$21 | \$0 | \$42 | \$1,050 | 96% |
| 10 | \$70 | \$70 | \$20 | \$160 | \$3,500 | 95% |
| 25 | \$425 | \$425 | \$50 | \$900 | \$8,750 | 90% |

At 25 firms, ops time per firm becomes the binding constraint, not
infrastructure cost. Stack re-evaluation trigger fires (see
\`stack\` artifact §8).

Checkpoint: \`.checkpoints/oc-deploy-ops.checkpoint.json\` (Quill — first deploy + first-firm onboarding).
`,
    },
  ],
  skills: ["oc-app-architect", "oc-stack-forge", "oc-git-ops", "oc-deploy-ops", "oc-integrations-engineer"],
  runtime: "≈ 10 exchanges",
  steps: [
    {
      type: "beat",
      phase: "discover",
      label: "Day 1 — Priya files inv-org/quill#1",
      caption: "She types the idea into a GH issue and runs `/oc-discover --ticket inv-org/quill#1`. opchain pulls the issue body via mcp__mcp-server-github__issue_read.",
      skills: ["oc-app-architect"],
    },
    {
      type: "exchange",
      role: "user",
      content:
        "/oc-discover --ticket inv-org/quill#1\n\nThe ticket has the rough idea: invoicing tool for small accounting firms. Solo founder, want to go fast.",
    },
    {
      type: "exchange",
      role: "claude",
      skill: "oc-app-architect",
      content:
`Reading the issue. \`mcp__mcp-server-github__issue_read(owner=inv-org, repo=quill, number=1)\`.

The ticket is rough but useful — I can pre-fill 4 of 9 discovery questions from it. Let me confirm the remaining 5:

1. **The ticket says** "small accounting firms." How small — solo CPAs? 3-15-person partnerships? Mid-market with their own ops team?
2. **The ticket says** "fast." Time horizon — 30 days, 90 days, 180 days?
3. **Anti-goals?** Anything you want to make sure this is NOT?
4. **Pricing model?** SaaS subscription, per-firm install, free + paid tiers?
5. **Why Python?** You mentioned a preference but I want to understand the constraint — is it experience, ecosystem, deployment posture, or all three?
6. **UI shape?** Server-rendered admin tool, SPA dashboard, or hybrid?
7. **Admin panel needed early?** You'll be running design-partner onboardings yourself for months; do you want a Django-admin-style internal tool out of the box?
8. **PDF requirements?** Bespoke templates per firm, single GAAP-friendly template, or just plain HTML-to-PDF?
9. **Email transport?** Any vendor preference, or any contract that locks us into one?

(I'm not going to skip the discovery questions just because there's a ticket — but I'll ask the ones the ticket leaves ambiguous. The ones I'm pre-filling: "what's the problem," "who's the user," "what's the current pain," "what's the wedge.")`,
    },
    {
      type: "exchange",
      role: "user",
      content:
        "1) 3-15-person partnerships, the kind that hate QuickBooks but can't afford NetSuite. 2) 90 days to first paying firm — Sarah's firm signed an LOI. 3) Not multi-tenant SaaS-at-scale; per-firm install. Not mobile-first. 4) Per-firm install, ~$200-500/mo per firm. 5) 8 years of Python at a fintech; I'll move 5x faster in Django. 6) Server-rendered. Sarah won't tolerate SPA load times. 7) Yes, Django admin is the cheapest internal tool humanly possible. 8) Single GAAP-friendly template; no charts. 9) Whatever's cheapest with good deliverability.",
    },
    {
      type: "exchange",
      role: "claude",
      skill: "oc-app-architect",
      content:
`Got it. Writing \`spec/00-project-overview.md\` with "Source ticket: inv-org/quill#1" cited at the top.

The discovery output gets richer than typical because the ticket gave directional context. Sarah (ops partner) is the protagonist; the partnership-aware data model is the wedge; \$200-500/mo with per-firm install is the pricing posture. Anti-personas (the firm's clients — they never see Quill directly) get a §4.3 because they're a load-bearing decision: if we add a client portal we own a whole new product line.

Also writing a competitor matrix (§6), pricing rationale (§7) with the QBO + opportunity-cost math, and a risk register (§12) with 6 explicit risks. The risk that matters most is R3 — per-firm install ops time. We'll instrument that from day 1 (Priya's hours per firm per month, manually tracked).

\`/oc-spec\` next — auto-invoking oc-stack-forge to pick the stack. I'll show you the scorecard before committing.`,
      artifacts: ["discovery"],
    },
    {
      type: "exchange",
      role: "user",
      content: "Before oc-stack-forge runs — quick sanity check. Postgres feels like overkill for a single-tenant install. Why not SQLite?",
    },
    {
      type: "exchange",
      role: "claude",
      skill: "oc-app-architect",
      content:
`Fair pushback. SQLite scored 39.7 on the database scorecard (vs Postgres-on-Render at 45.9) — close enough that it's worth saying out loud why I picked Postgres.

**Three reasons:**

1. **Concurrency.** gunicorn runs multiple workers (3 in the prod \`render.yaml\`). SQLite supports multi-reader / single-writer with WAL mode but Django's ORM doesn't model that well — you'll hit \`database is locked\` under modest write contention (e.g. a partner uploading a CSV while another partner is viewing the list). At Sarah's firm's scale it'd probably be fine; at 3 firms in 6 months it gets sketchy.

2. **Backups.** Render Postgres has built-in daily backups with 7-day retention; restore is a UI button. SQLite means we own the backup story — \`pg_dump\`-equivalent for SQLite is workable but it's another runbook to write and another way for our customers' invoicing data to disappear.

3. **Forward-compat.** If you ever add a worker process (Sprint 4 PDF batching is on the roadmap; see commented-out \`render.yaml\` block), or a cron job, or a second app server, SQLite stops being the right answer. Migrating SQLite → Postgres at year 1 with live customer data is a weekend you don't want.

The cost delta is \$7/mo. Even at 25 firms it's \$425/mo, which is rounding error against \$8,750 MRR.

OK to keep Postgres? If yes I'll let oc-stack-forge finish; if you want the SQLite scorecard revisited, I'll re-run with adjusted weights (probably bumping "Cost@scale" and "Solo-dev simplicity" significantly).`,
    },
    {
      type: "exchange",
      role: "user",
      content: "Yeah, keep Postgres. Concurrency clinches it.",
    },
    {
      type: "beat",
      phase: "spec",
      label: "Day 1 — oc-stack-forge picks Django/Render automatically",
      caption: "v1.3's Platform Matrix decision tree resolves cleanly. Six scorecards run; anti-picks recorded.",
      skills: ["oc-stack-forge"],
    },
    {
      type: "exchange",
      role: "claude",
      skill: "oc-stack-forge",
      content:
`Running the v1.3 "Platform Matrix" against discovery context. Six scorecards:

| Layer | Pick | Weighted | Runner-up | Margin |
|---|---|---:|---|---:|
| Backend framework | **Django** | 51.4 | Rails (47.6) | +8% |
| Database | **Render Postgres** | 45.9 | Neon (41.7) | +10% |
| Host | **Render** | 47.6 | Heroku (41.3) | +15% |
| PDF generation | **WeasyPrint** | 38.7 | wkhtmltopdf (33.3) | +16% |
| Email transport | **Resend** | 31.4 | Postmark (28.6) | +10% |
| Auth | **Django sessions** | (built-in; no scorecard) | — | — |

→ **Django 5.1 + Postgres 17 + Render + WeasyPrint + Resend.** Versions
pinned in \`spec/01-tech-stack.md\` §9.

Anti-picks recorded with reasons (Rails: Priya doesn't know it; Cloudflare:
server-render mismatch; Go/Rust: overkill / no familiarity; Supabase:
4 lock-in vectors with no win; Vercel: serverless mismatch; Firebase:
cost nonlinearity; Self-host: ops time).

**Cost band at 1 / 3 / 10 / 25 firms:** \$14 / \$42 / \$160 / \$900 monthly
(see §10). Gross margin 95-96% across the range; at 25 firms ops time
becomes the binding constraint, not infra cost — that's the
re-evaluation trigger.`,
      artifacts: ["stack"],
    },
    {
      type: "beat",
      phase: "plan",
      label: "Day 1 — /oc-scaffold writes the project",
      caption: "Per scaffold-guide.md § Django. Settings split, render.yaml Blueprint, pytest, Django admin all wired. 41 files written; 18 tests pass; runserver boots.",
      skills: ["oc-app-architect"],
    },
    {
      type: "exchange",
      role: "claude",
      skill: "oc-app-architect",
      content:
`\`/oc-scaffold\` writes 41 files from \`scaffold-guide.md § Django\`:

- **Settings split** into \`core/settings/{base,dev,prod}.py\` (DJANGO_SETTINGS_MODULE selects)
- **\`render.yaml\` Blueprint** provisioning Postgres + web service + a staging variant, with worker / redis / cron stubs commented out for Sprint 4+
- **\`pytest.ini\`** pointing at dev settings; markers for \`slow\` and \`integration\`
- **Three apps** scaffolded: \`firms\` (Firm + Partner + Engagement models), \`billables\` (placeholder; Sprint 1 fleshes), \`invoices\` (placeholder; Sprint 2-3 fleshes), plus a thin \`auth\` app on top of \`django.contrib.auth\`
- **Django admin** registered for every model with sensible defaults (list_display, search_fields, list_filter)
- **\`core/views.py\`** with \`/health\` returning SHA + DB ping (Render's \`healthCheckPath\`)
- **Selected file contents** in the artifact include the actual \`base.py\`, \`prod.py\`, \`firms/models.py\`, \`views.py\`, \`pytest.ini\`, and \`requirements.txt\`

\`.opchain/pm.yaml\` written for **GitHub Issues** (not Linear) — same protocol §3 markers, different tool names. Provider swap is a single config line, see the \`pm-yaml-gh\` artifact for the full mapping.

Verifying:

\`\`\`
$ pytest -q
.................. [100%]
18 passed in 1.42s
$ python manage.py runserver
Starting development server at http://127.0.0.1:8000/
$ curl http://127.0.0.1:8000/health
{"ok": true, "service": "quill", "sha": "dev", "db_ping_ms": 4}
\`\`\`

All green. Ready to start Sprint 1.`,
      artifacts: ["scaffold", "render-yaml", "pm-yaml-gh"],
    },
    {
      type: "exchange",
      role: "user",
      content:
        "Wait — when I run pytest locally I get `ImportError: cannot import name 'Firm' from 'apps.firms'`. Did something not get written?",
    },
    {
      type: "exchange",
      role: "claude",
      skill: "oc-app-architect",
      content:
`Good catch. That's an \`INSTALLED_APPS\` ordering issue, not a missing
file. Django imports apps in the order listed, and \`apps.billables\`
references \`apps.firms.Partner\` — if \`billables\` loads first, the
import chain fails.

Looking at \`core/settings/base.py\`, the current order:

\`\`\`python
INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    ...
    "apps.billables",   # references Partner before firms is loaded
    "apps.firms",
    "apps.invoices",
    "apps.auth",
]
\`\`\`

Reordering so \`firms\` comes first:

\`\`\`python
INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    ...
    "apps.firms",       # tenant root — load first
    "apps.billables",
    "apps.invoices",
    "apps.auth",
]
\`\`\`

Now \`pytest\` should run clean. This is also why migrations have to go
in app dependency order; Django infers FK dependencies but a clean
INSTALLED_APPS ordering makes the errors more legible when something
goes wrong. Adding a comment in \`base.py\` so future-you doesn't trip on
this again.`,
    },
    {
      type: "beat",
      phase: "ship",
      label: "Day 8 — first PR opens, linked back to issue #5",
      caption: "oc-git-ops uses GitHub Issues exactly like it uses Linear. Same protocol, different tool names.",
      skills: ["oc-git-ops"],
    },
    {
      type: "exchange",
      role: "user",
      content: "/oc-git-sync inv-org/quill#5",
    },
    {
      type: "exchange",
      role: "claude",
      skill: "oc-git-ops",
      content:
`Reading issue #5 via \`mcp__mcp-server-github__issue_read\`. Title: "Sprint 1: time-entry foundations." Type: \`type:feature\` (from issue label).

- Branch: \`feat/quill-5-time-entry-foundations\`
- Commit subject: \`feat(billables): time-entry CRUD + bulk import\`
- PR body: auto-generated from the issue + diff summary + audit gate output (see artifact)

**Pre-write check** for the PR-opened comment marker:

\`\`\`
mcp__mcp-server-github__list_issue_comments(owner=inv-org, repo=quill, number=5)
  → marker <!-- opchain:oc-git-ops:pr-opened:#1 --> not present → safe to write
\`\`\`

\`mcp__mcp-server-github__add_issue_comment\` posts the marker comment back to issue #5.

\`mcp__mcp-server-github__issue_write\` adds label \`status:in-review\` (the GH-issues equivalent of Linear's \`In Review\` state per the v1.3 \`states\` map in \`pm.yaml\`).

PR #1 opened with 14 new tests, audit gate green, performance benchmarks documented. Same shape as the Linear scenarios — protocol §3 abstracts the provider.`,
      artifacts: ["first-pr"],
    },
    {
      type: "beat",
      phase: "ship",
      label: "Day 9 — first staging deploy via Render Blueprint",
      caption: "oc-deploy-ops detects render.yaml, walks the audit gate, ships. First deploy provisions Postgres + web service in one push.",
      skills: ["oc-deploy-ops"],
    },
    {
      type: "exchange",
      role: "user",
      content: "/oc-deploy staging",
    },
    {
      type: "exchange",
      role: "claude",
      skill: "oc-deploy-ops",
      content:
`Provider detected: **Render** (\`render.yaml\` present at repo root).

Audit gate: \`pytest\` PASS (147/147), \`mypy\` PASS, \`bandit\` PASS, \`oc-bug-check\` PASS.

\`git push render main\` — Render reads the Blueprint, provisions Postgres + web service in 47s, runs \`migrate --noinput\` as the preDeployCommand, swaps traffic.

\`/api/health\` returns 200 + SHA bb1f0e2 ✓.

**Pre-create check** on the deploy ticket:
\`mcp__mcp-server-github__list_issues(owner=inv-org, repo=quill, labels=["type:deploy"], body_text_query="opchain:oc-deploy-ops:deploy-created:staging:bb1f0e2")\` → no match → safe to create.

Created issue #14 with the marker in the description. Posted linked-shipped comments back to #1, #3, #4, #5 (the issues whose commits made it into this deploy range).

Same flow as the Linear scenarios. Same markers. Different tool surface.`,
      artifacts: ["first-deploy"],
    },
    {
      type: "exchange",
      role: "user",
      content: "What does the cost look like at 10 firms? I'm thinking ahead.",
    },
    {
      type: "exchange",
      role: "claude",
      skill: "oc-deploy-ops",
      content:
`Cost band from the stack decision (§10) — repeating here against the
real Render dashboard numbers I'm seeing post-deploy:

| Firms | Render web | Render Postgres | Resend | Total / mo | Revenue at \$350 avg | Gross margin |
|---:|---:|---:|---:|---:|---:|---:|
| 1 (today) | \$7 | \$7 | \$0 | **\$14** | \$350 | 96% |
| 3 | \$21 | \$21 | \$0 | \$42 | \$1,050 | 96% |
| **10** | **\$70** | **\$70** | **\$20** | **\$160** | **\$3,500** | **95%** |
| 25 | \$425 | \$425 | \$50 | \$900 | \$8,750 | 90% |

At 10 firms, infrastructure is ~5% of revenue — you're effectively
unconstrained by infra. The binding constraint becomes **your ops
time per firm**. We projected ≤ 1 hour per firm per month in the
discovery doc; if that holds at 10 firms, you're spending ~10 hours
a month on ops to net ~\$3,300/mo in margin. That's the slope of the
solo-founder math.

The re-evaluation trigger fires at 25 firms — at that point the
per-firm install model starts to dominate ops time, and we'd
consider a single-instance SaaS architecture with strict tenant
isolation. That's a 6-12 month problem from now, not a day-9 problem.

Watch the \`R3\` risk row in the discovery doc — that's the one we
instrument from day 1.`,
    },
    {
      type: "beat",
      phase: "ship",
      label: "Day 14 — Sarah's firm signs",
      caption: "Production deploy. Quill is live at https://quill.priyabuilds.com. Two weeks ideation → first paying customer.",
    },
    {
      type: "exchange",
      role: "user",
      content:
        "Sarah signed. /oc-deploy prod. What changed about the pipeline because we used Django + Render + GitHub Issues instead of CF Workers + Linear?",
    },
    {
      type: "exchange",
      role: "claude",
      skill: "oc-integrations-engineer",
      content:
`Prod deploy 31s; \`/api/health\` returns SHA \`d18ca44\`. Sarah's firm
onboarded (7 partners, 4 engagements, first test invoice PDF emailed
and confirmed). Deploy-ticket #14 closed with the \`prod-shipped\` marker.

**On the v1.3 protocol comparison:** surprisingly little changed.

The protocol abstracts the provider — every PM-aware skill calls a
registry-resolved verb (\`add_comment\`, \`create_issue\`, etc.) and the
registry maps to the concrete MCP tool. Same markers, same retry policy,
same deferred-action queue. The provider-specific things were:

- **\`pm.yaml\` provider line + state mapping.** GH issues are open/closed;
  the \`states\` map points at GH labels (\`status:in-progress\`,
  \`status:in-review\`) for non-terminal states and \`closed\` for the
  terminal one. Linear's state map points at workflow names. One-line
  config swap.
- **oc-deploy-ops Render section.** Different from the Cloudflare
  walkthrough — \`render.yaml\` Blueprint instead of \`wrangler deploy\`,
  \`preDeployCommand\` instead of a separate migration step, Render's
  \`fromDatabase\` reference instead of \`wrangler secret put DATABASE_URL\`.
- **scaffold layout.** Django's \`apps/\` + \`core/settings/{base,dev,prod}\`
  + \`templates/\` pattern instead of Astro \`src/pages\` + \`src/components\`.
- **Audit gate composition.** \`pytest + mypy + bandit\` instead of
  \`vitest + tsc + npm audit\`. oc-code-auditor's checks adapt to the
  detected stack; oc-bug-check's check list reads from
  \`scaffold-guide.md § <stack>\` per-language.

Everything else — the discovery → spec → roadmap → build → ship pipeline,
the audit gate cadence, the PM-MCP loop, the cross-skill checkpoint
files — was identical. That's the v1.3 platform-expansion bet: opchain
stops being Cloudflare-only on the page without breaking what already
worked.

Two weeks from "build me an invoicing app" to live customer. Sarah's
April batch runs from the prod install starting next Monday.`,
    },
  ],
};

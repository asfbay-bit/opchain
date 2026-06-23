import type { Walkthrough } from "./types";

/**
 * Scenario 3 — oc-reverse-spec on a legacy codebase, then oc-app-architect picks
 * up the generated spec as its Phase 2 baseline and plans the new feature
 * on top. Demonstrates the "entering from the middle" pattern.
 */
export const legacyRevive: Walkthrough = {
  id: "legacy-revive",
  title: "Legacy Rails app, one new feature",
  tagline: "Legacy Rails, one new feature",
  summary:
    "3-year-old Rails monolith, no docs, one engineer leaving in 3 weeks. Ship the feature anyway.",
  description:
    "Haulier is a 47k-line Rails monolith — a freight-broker SaaS that grew in someone's head. No docs, 58% test coverage, one engineer on their way out. The board wants a Carrier Scorecard feature before she goes. oc-reverse-spec crawls the code and reconstructs a 142-page spec from models, controllers, and naming patterns. oc-app-architect reads that spec as Phase-1 baseline, scopes the new feature with surgical precision, and ships it behind an extra-strict oc-code-auditor gate on the load-bearing settlement model. Nothing fragile is touched.",
  inputs: [
    "Existing Rails 6.1 app (47k LoC Ruby, 8k ERB)",
    "No documentation · 58% test coverage · 84 gems",
    "One engineer leaving in 3 weeks",
    "New feature brief: Carrier Scorecard (on-time %, damage %, dispute %)",
  ],
  outputs: [
    {
      id: "reconstructed-spec",
      label: "142-page reconstructed spec",
      kind: "spec.md",
      body:
`# Haulier — Reconstructed Spec

**Version** 0.1 (auto-generated) · **Source** \`oc-reverse-spec\` over commit \`a4f91e2\` · **Confidence** model-annotated per section · **Generated** 2026-04-15

> **Reading guide.** This document is reverse-engineered from the codebase, not handwritten by the original author. Sections marked ★★★★★ are mechanically extracted (model graphs, routes, jobs) and high-confidence. Sections ★★★★ are inferred from naming + comments. Sections ★★★ are open questions where the model could not determine intent. Use the table of contents on the left to jump.

## 1. TL;DR

Haulier is a **freight-broker SaaS**. Brokers ("Dispatchers") post **Loads**; Carriers bid; a chosen Carrier hauls; the Broker invoices the Shipper. Side-flows: driver-side Documents upload, daily Fuel-surcharge reindex, weekly Settlement run.

The codebase is a 47k-LoC Rails 6.1 monolith, three years old, with 58% line coverage and 84 gems. There is no prior documentation. The original author is leaving in three weeks.

## 2. Repository overview

| Stat | Value |
|---|---|
| Languages | Ruby 89% · ERB 8% · JavaScript 3% |
| LoC | 47,108 Ruby · 8,214 ERB · 1,983 JS |
| Test coverage (line) | 58% |
| Tests | 312 RSpec examples · 4 Capybara feature specs |
| Models | 28 |
| Controllers | 41 (24 web · 17 API) |
| Background jobs | 11 Sidekiq workers · 4 cron entries |
| Gems | 84 (11 flagged out-of-date by \`bundle outdated\`) |
| DB | Postgres 13 · 47 tables · 19 materialized views? (no — none confirmed) |
| Hosting | Heroku Standard-2X (3 web dynos · 2 worker dynos) |
| External services | Stripe (broker→carrier payout), Twilio (driver SMS), AWS S3 (Documents) |

## 3. Domain narrative (as inferred)

Dispatchers post Loads representing freight that needs to move from origin A to destination B by date D, with equipment requirements (dry van, reefer, flatbed). Carriers — independent trucking companies — see relevant Loads (filtered by their declared lanes + equipment) and submit Bids. The Dispatcher reviews bids, chooses one, and a Shipment is created.

The chosen Carrier executes the haul: pickup → transit → delivery. At each stage, Documents (BOL, POD, weigh tickets) are uploaded by the driver via the mobile-web app. Once delivery + Documents are confirmed, the cycle has two financial tails:

1. **Invoice** flows Broker → Shipper. Shippers pay against invoices; Payments record the inbound money.
2. **Settlement** flows Broker → Carrier. Once the invoice is paid (or after a configurable hold period), the Settlement runner pays the Carrier their portion (load price minus broker margin).

## 4. Domain model (★★★★★)

\`\`\`
Shipper ──▶ Load ──▶ Bid ◀── Carrier
              │      │
              │      └──▶ Shipment ──▶ Document
              │                          │
              │                          └──▶ Invoice ──▶ Payment
              │                                  │
              │                                  └──▶ Settlement  ⚠ fragile
              ▼
          Dispatcher (user)
\`\`\`

### 4.1 Inventory of all 28 models

| Model | Lines | Tests | Notable |
|---|---:|---:|---|
| User | 312 | ✓ | Devise; STI parent for Dispatcher and Carrier-User. |
| Dispatcher | 88 | ✓ | STI subclass. Belongs_to Broker. |
| Carrier | 467 | ✓ | One Carrier company; many Carrier-Users. \`scope :active\` is buggy (§13). |
| CarrierUser | 124 | ✓ | STI subclass of User. |
| Broker | 198 | ✓ | A brokerage firm; Dispatchers belong to it. |
| Shipper | 156 | partial | The customer paying for freight. |
| Load | 904 | ✓ | The work. Has_many bids. State machine: posted → bid → awarded → in_transit → delivered → invoiced. |
| Bid | 244 | ✓ | Carrier offers a price for a Load. \`negative price\` validation missing (§13). |
| Shipment | 612 | ✓ | The awarded Load + execution state. Pickup/delivery timestamps. |
| Document | 311 | ✓ | BOL / POD / weigh ticket. \`paperclip\` (deprecated) → S3. |
| Invoice | 778 | ✓ | Multi-step state machine (draft → sent → viewed → paid / disputed / written_off). Heavy callbacks. |
| Payment | 432 | partial | Inbound from Shipper. Stripe + ACH + check (manual). |
| Settlement | **812** | **0** | Outbound to Carrier. **6 callbacks. Money flow. No tests. (CRITICAL — see §13.)** |
| SettlementLineItem | 188 | 0 | Components of a Settlement. Lacks unique constraint on (settlement_id, source_id). |
| ChartOfAccount | 64 | 0 | Bookkeeping references. Apparently unused by code path; possibly legacy. |
| Lane | 102 | ✓ | Carrier's preferred origin/destination corridors. |
| Equipment | 44 | ✓ | Enum-ish lookup table (dry_van, reefer, flatbed, …). |
| Address | 187 | ✓ | Used by Load (origin, destination), Shipper, Carrier. |
| GeoLookup | 56 | ✓ | Cached zip→lat/lng. \`SmartyStreets\` gem. |
| FuelSurcharge | 91 | partial | Updated nightly; affects Bid pricing. The job that updates this has no failure alerting (§13). |
| MarginRule | 142 | ✓ | Per-shipper margin overrides. |
| Notification | 89 | ✓ | In-app notification feed. |
| AuditLog | 144 | partial | \`paper_trail\`-backed. Spotty coverage — only ~12 models opt in. |
| Webhook | 78 | ✓ | Outbound webhooks to integrations. |
| WebhookDelivery | 102 | ✓ | Delivery attempts + retries. |
| ApiToken | 56 | ✓ | Carrier-side API tokens. \`bcrypt\`-stored. |
| FeatureFlag | 38 | ✓ | Internal: \`Flipper\` UI gates a few half-shipped features. |
| Setting | 44 | ✓ | Singleton row of broker-wide config. |

### 4.2 Associations matrix (cardinality)

| From | → | To | Notes |
|---|---|---|---|
| Broker | has_many | Dispatcher | |
| Broker | has_many | Shipper | |
| Dispatcher | has_many | Load | |
| Shipper | has_many | Load | source of business |
| Load | has_many | Bid | |
| Load | belongs_to | chosen_bid (Bid, optional) | |
| Load | has_one | Shipment | |
| Bid | belongs_to | Carrier | |
| Bid | belongs_to | Load | |
| Shipment | has_many | Document | dependent: destroy |
| Shipment | has_one | Invoice | |
| Shipment | has_one | Settlement | |
| Invoice | has_many | Payment | |
| Settlement | has_many | SettlementLineItem | |
| Carrier | has_many | CarrierUser | |
| Carrier | has_many | Bid | |
| Carrier | has_many | Lane | |

### 4.3 Soft-delete + audit

- \`paranoia\` gem on: \`User\`, \`Carrier\`, \`Shipper\`, \`Load\`, \`Shipment\`. Deleted rows have \`deleted_at IS NOT NULL\` and are excluded from default scopes — **except** \`Carrier.active\` which has a bug (§13).
- \`paper_trail\` opted in on 12 of 28 models. Inconsistent.

## 5. Controllers + routes (★★★★★)

### 5.1 Web controllers (24)

| Controller | Routes | Notes |
|---|---|---|
| ApplicationController | — | Sets current_user, current_broker; before_action heavy. |
| DashboardController | GET / | Different views per user role. |
| LoadsController | resources | + custom \`#repost\`, \`#cancel\`, \`#extend_window\`. |
| BidsController | resources | nested under loads. |
| ShipmentsController | resources | + \`#mark_delivered\`. |
| InvoicesController | resources | + \`#mark_paid\`, \`#mark_disputed\`, \`#export_pdf\`. |
| SettlementsController | resources | read-only for everyone except SuperAdmin. |
| DocumentsController | resources | direct-to-S3 upload; presigned URLs. |
| CarriersController | resources | + \`#approve\`, \`#suspend\`, \`#reactivate\`. |
| ShippersController | resources | |
| DispatchersController | resources | **mass-assignment via strong_params needs audit (§13).** |
| BrokerSettingsController | settings/* | wraps Setting singleton. |
| ApiTokensController | resources | for Carrier API access. |
| WebhooksController | resources | outbound webhook configuration. |
| AuditLogController | GET /oc-audit | search via Ransack. |
| NotificationsController | index, mark_read | |
| FuelSurchargesController | index, current | |
| ReportsController | various | mostly Ransack-backed CSV exports. |
| OnboardingController | wizard/* | new-Carrier 5-step flow. |
| HealthController | GET /health | returns 200 + version. |
| Devise::* | auth/* | sign_in, sign_up, password reset. |
| HomeController | GET / (signed-out) | marketing landing. |
| AdminController (suite) | /admin/* | Active Admin engine. |
| RailsAdminController | /rails_admin (disabled in prod) | should be removed entirely. |

### 5.2 API v1 (12 endpoints — Carrier-facing)

\`/api/v1/loads\` (search, show) · \`/api/v1/bids\` (create, list, withdraw) · \`/api/v1/shipments\` (show, update_status) · \`/api/v1/documents\` (create, list) · \`/api/v1/invoices\` (list) · \`/api/v1/settlements\` (list) · \`/api/v1/carriers/me\`.

Auth: \`ApiToken\` via \`Authorization: Bearer\`. Rate-limit: \`rack-attack\` 600/hr/token.

### 5.3 API v2 (19 endpoints — newer, partially migrated)

\`/api/v2/loads_controller.rb\` is 1,242 lines and has 19 endpoints — many duplicate v1 with subtle changes (snake_case vs camelCase response). **Unclear which contract clients use.** (§14)

### 5.4 Active Admin (40+ resource registrations)

The Active Admin dashboard exposes raw CRUD on every model including \`Settlement\`. Two SuperAdmin users have access. **No audit log on Active Admin actions.** (§13)

## 6. Background jobs (★★★★★)

| Job | Schedule | Failure alert | Notes |
|---|---|---|---|
| \`FuelReindex\` | nightly 02:00 UTC | **none** | Updates FuelSurcharge from API; if it fails silently, all next-day bids use stale prices. (§13) |
| \`WeeklySettlementRun\` | Mondays 06:00 UTC | Slack | Big — runs in 4 minutes p99. The money path. |
| \`InvoiceDelinquencyNudge\` | daily 09:00 broker-tz | Slack on raise | Timezone bug in tests (skipped). (§13) |
| \`DocumentVirusScan\` | per-upload | Sentry | ClamAV via \`clamby\`. |
| \`WebhookDeliveryWorker\` | per-event | Sentry | Exponential backoff up to 24h. |
| \`SmsSendWorker\` | per-event | Sentry | Twilio. |
| \`EmailSendWorker\` | per-event | Sentry | ActionMailer/Sendgrid. |
| \`StaleLoadCloser\` | hourly | Slack | Closes Loads in \`posted\` past pickup window. |
| \`InvoicePdfRenderer\` | per-invoice | Sentry | Wicked PDF. |
| \`AuditLogPurger\` | weekly | none | 7-year retention; deletes older. |
| \`MetricsRollup\` | hourly | none | Populates \`metrics_*\` tables for the dashboard. |

## 7. Database

### 7.1 Tables (47)

Top 10 by row count:

| Table | Rows (prod) | Notes |
|---|---:|---|
| audit_versions | 4,812,901 | \`paper_trail\`. Purged weekly. |
| webhook_deliveries | 1,902,114 | Could TTL aggressively. |
| documents | 411,238 | + ~2 TB on S3. |
| shipments | 188,442 | |
| loads | 156,801 | |
| invoices | 184,229 | |
| settlements | 142,108 | |
| bids | 802,144 | ~5 bids per load average. |
| notifications | 1,402,889 | |
| metrics_daily | 1,128,440 | rollup table. |

### 7.2 Indexes

- Most foreign keys are indexed. Two are not: \`bids.load_id\` (b-tree exists but not on \`(load_id, status)\`), \`webhook_deliveries.webhook_id\` (missing entirely).
- One missing covering index on \`shipments(carrier_id, delivered_at)\` causes the \`carrier_active\` query to seq-scan at scale.

### 7.3 Migrations

302 migrations on disk. Last 10 reviewed for risk:

- \`20260301_add_carrier_external_id\` — backfilled in a separate task, safe.
- \`20260218_drop_legacy_fuel_table\` — dropped a 200k-row table without a backup snapshot in the migration. (★★★ correctness risk if reverted.)
- … rest are routine.

## 8. Authentication + authorization

- \`Devise\` for User; standard config.
- \`Pundit\` for authorization; policies cover ~70% of controllers. The remaining 30% rely on controller \`before_action :require_admin!\` checks. (★★★ inconsistent.)
- API uses \`ApiToken\` rows; \`bcrypt\`-hashed; included in \`Authorization: Bearer …\`.
- Sessions via Rails encrypted cookies. \`session.idle_timeout = 30.days\`. Cookie lacks \`SameSite=Strict\`. (★★★)

## 9. Third-party services

| Service | Used for | Credential | Notes |
|---|---|---|---|
| Stripe | Carrier payouts (Settlement) | \`STRIPE_SECRET\` | Test mode in CI. |
| Twilio | SMS to drivers | \`TWILIO_*\` | Costs trending up. |
| Sendgrid | Transactional email | \`SENDGRID_API_KEY\` | |
| AWS S3 | Documents | \`AWS_*\` | One bucket; \`paperclip\` (deprecated). |
| SmartyStreets | Address validation + geocoding | \`SS_AUTH_*\` | |
| Sentry | Error tracking | \`SENTRY_DSN\` | |
| Datadog | Metrics + APM | \`DD_API_KEY\` | |
| ClamAV (self-hosted) | Virus scan on uploads | — | Single-tenant scanning service in same VPC. |
| Slack | Internal alerts | webhook URL | |

## 10. Environment variables (24 in use)

\`DATABASE_URL\`, \`REDIS_URL\`, \`SECRET_KEY_BASE\`, \`RAILS_MASTER_KEY\`, \`STRIPE_SECRET\`, \`STRIPE_PUBLIC\`, \`STRIPE_WEBHOOK_SECRET\`, \`TWILIO_ACCOUNT_SID\`, \`TWILIO_AUTH_TOKEN\`, \`TWILIO_FROM\`, \`SENDGRID_API_KEY\`, \`SENDGRID_FROM\`, \`AWS_ACCESS_KEY_ID\`, \`AWS_SECRET_ACCESS_KEY\`, \`AWS_S3_BUCKET\`, \`SS_AUTH_ID\`, \`SS_AUTH_TOKEN\`, \`SENTRY_DSN\`, \`DD_API_KEY\`, \`DD_APP_KEY\`, \`SLACK_WEBHOOK_OPS\`, \`SLACK_WEBHOOK_BIZ\`, \`CLAMAV_HOST\`, \`FEATURE_FLAGS_REDIS_URL\`.

## 11. Gem inventory (★★★★★)

84 gems in \`Gemfile\`. Highlights:

- Frameworks: \`rails 6.1.7\`, \`puma 5.6\`, \`sidekiq 7.1\`, \`activeadmin 2.13\`, \`devise 4.9\`, \`pundit 2.3\`.
- ORM extras: \`paranoia 2.6\`, \`paper_trail 15\`, \`ransack 4.0\`, \`scenic 1.7\` (added but unused — see §14).
- Money + payments: \`stripe 8.2\`, \`money-rails 1.15\`.
- Files + media: \`paperclip 6.1\` (**deprecated** — should migrate to ActiveStorage), \`wicked_pdf 2.7\`, \`clamby 1.6\`.
- Background: \`sidekiq 7.1\`, \`sidekiq-scheduler 5.0\`, \`sidekiq-status 3.0\`.
- Frontend: \`stimulus_reflex 3.5\`, \`turbo-rails 1.5\`, \`tailwindcss-rails 2.1\`.
- Outdated by \`bundle outdated\` (11): \`rails 6.1.7 → 7.1\`, \`puma 5 → 6\`, \`sidekiq 7.1 → 7.3\`, \`stripe 8.2 → 12\`, \`devise 4.9 → 4.9.4\`, \`paper_trail 15 → 17\`, \`pundit 2.3 → 2.4\`, \`tailwindcss-rails 2.1 → 3\`, \`activeadmin 2.13 → 3\`, \`paperclip\` (no upgrade path; deprecated), \`smarty_streets\` (rebranded; vendor).

## 12. Deployment topology

- Heroku Standard-2X for web (3 dynos), Standard-2X for workers (2 dynos).
- Postgres: Heroku Postgres Standard-4 plan; 64 GB; ~30 connections.
- Redis: Heroku Redis Premium-2 plan; used for Sidekiq + Rails cache.
- ELB + Cloudflare in front. Cloudflare on **default** WAF ruleset only.
- Deploys via \`git push heroku main\`; no Pipelines / staging environment exists. (★★★ correctness/risk concern; deploys are blind.)
- Database migrations run via \`heroku run rails db:migrate\` post-deploy. Two migrations in the last year required maintenance windows; both bypassed by the engineer.

## 13. Risk map — top 30 (★★★★)

The original spec excerpt covered the top 10. The full oc-reverse-spec found 30 load-bearing risks ranked by *fragility* × *blast radius*. This is the working backlog any successor team should triage first.

1. **\`app/models/settlement.rb\`** — 812 lines, 6 callbacks, **0 tests**. Money flow. The single highest-risk file in the repo. 🚨
2. **\`app/jobs/fuel_reindex.rb\`** — runs nightly, no failure alerting; silent failure → stale bid prices for 24h.
3. **\`app/controllers/api/v2/loads_controller.rb\`** — 19 endpoints, long methods (avg 84 LoC), partially migrated from v1.
4. **\`app/models/invoice.rb\`** — multi-step state machine; good test coverage but 7 callbacks deep — touch with care.
5. **\`app/services/settlement_runner.rb\`** — batched job, transactional. Failure mid-batch leaves partial Settlements written. (★★★ uncertain — no test confirms transaction wraps the loop.)
6. **\`app/models/bid.rb\`** — no validation on negative prices (latent bug; a Carrier could in theory submit a negative bid).
7. **\`app/jobs/invoice_delinquency_nudge.rb\`** — timezone bug in tests (currently \`skip\`-ped); production runs in broker-local but tests assume UTC.
8. **\`db/seeds.rb\`** — hardcodes production Carrier ids (🚨 must not run on prod).
9. **\`app/controllers/dispatchers_controller.rb\`** — mass-assignment via strong_params; \`permit!\` used in one path. Audit before adding any new field.
10. **\`app/models/carrier.rb\`** — scope \`active\` includes soft-deleted in prod (off-by-one in the chained \`.where.not(deleted_at: nil)\` is inverted).
11. **\`app/admin/settlements.rb\`** — Active Admin exposes Settlement to two SuperAdmins; no AuditLog on Active Admin actions.
12. **\`app/models/payment.rb\`** — manual reconciliation path (ACH + check) lacks idempotency on amount.
13. **\`app/services/invoice_pdf_renderer.rb\`** — Wicked PDF + system Wkhtmltopdf binary. PDF rendering is single-threaded and 8s p99 — the biggest tail latency in the app.
14. **\`config/routes.rb\`** — 412 lines; \`match\` used in two places where \`get\` would be safer.
15. **\`app/policies/load_policy.rb\`** — last touched 18 months ago; some new actions aren't policed.
16. **\`Gemfile.lock\`** — \`paperclip\` is end-of-life; documents pipeline must migrate to ActiveStorage.
17. **\`spec/factories/settlements.rb\`** — exists, but not used anywhere; the absence of Settlement specs is by omission, not by lack of fixtures.
18. **\`app/models/concerns/auditable.rb\`** — opt-in concern; only 12 of 28 models include it. Inconsistency leaves audit gaps.
19. **\`app/jobs/webhook_delivery_worker.rb\`** — exponential backoff up to 24h; can pile thousands of jobs in queue if a customer endpoint is down.
20. **\`config/initializers/cors.rb\`** — wildcard origin on \`/api/v2/*\`. Should be tightened.
21. **\`app/models/setting.rb\`** — broker-wide singleton; cached in Rails cache without explicit invalidation on update.
22. **\`db/migrate/20260218_drop_legacy_fuel_table.rb\`** — destructive migration applied without rollback snapshot.
23. **\`app/models/document.rb\`** — \`paperclip\` direct-to-S3; signed URLs lack short TTL on read.
24. **\`config/sidekiq.yml\`** — single queue \`default\`; high-priority money jobs share lane with low-priority emails.
25. **\`app/services/margin_rule_resolver.rb\`** — operator-precedence bug on rule overlap (last-write-wins where it should be most-specific-wins). Latent; surfaces only on overlapping rules.
26. **\`app/views/invoices/_line_items.html.erb\`** — 412 lines of ERB; XSS audit recommended (looks safe, but length makes review hard).
27. **\`app/models/api_token.rb\`** — bcrypt cost 10; should be 12 by today's standards.
28. **\`config/environments/production.rb\`** — \`config.force_ssl = false\` (relies on Cloudflare); a CDN swap would silently downgrade to HTTP.
29. **\`app/services/load_search.rb\`** — Ransack-driven; allow-list is permissive, exposes most columns. Low impact today; high risk under a future PII-bearing column.
30. **\`app/admin/users.rb\`** — Active Admin user impersonation enabled; not audited.

## 14. Open questions (★★★)

- \`Settlement.rb\` \`after_commit\` callback may fire twice under transaction rollback; no test confirms.
- \`Shipment.pickup_window\` is stored as TZ-naive; production has carriers in 4 time zones (Pacific, Mountain, Central, Eastern).
- \`/api/v2\` was added but \`/api/v1\` was never deprecated. Unclear which contract Carrier integrations actually use; both endpoints log similar volumes.
- \`scenic\` gem present in \`Gemfile\` but no \`db/views/\` directory exists — was someone planning materialized views and never followed through?
- \`Setting\` is cached but invalidation looks manual. Have we ever shipped a config change that didn't take effect for 5 minutes?
- The two SuperAdmin accounts share a 1Password vault entry — has it been rotated since the last engineer left? (No way to tell from the code.)
- \`config/database.yml\` references a \`replica\` URL that is unset on Heroku — is the read-replica being used at all, or is everything hitting primary?

## 15. Confidence annotations

| Section | Confidence | Source |
|---|---|---|
| §2 Repository overview | ★★★★★ | \`cloc\`, \`bundle list\`, \`rails stats\` |
| §3 Domain narrative | ★★★★ | inferred from model + controller names + comments |
| §4 Domain model | ★★★★★ | machine-extracted from \`db/schema.rb\` + \`belongs_to\` declarations |
| §5 Controllers + routes | ★★★★★ | \`rails routes\` |
| §6 Background jobs | ★★★★★ | \`sidekiq-scheduler\` config + \`Sidekiq::Worker\` includes |
| §7 Database | ★★★★ | \`db/schema.rb\` + production size approximations |
| §8 Auth | ★★★★ | Devise + Pundit configs |
| §9 Services | ★★★★★ | Gemfile + initializer scan |
| §10 Env vars | ★★★★★ | grep \`ENV[\` |
| §11 Gems | ★★★★★ | \`Gemfile.lock\` + \`bundle outdated\` |
| §12 Deployment | ★★★ | inferred from Procfile + Heroku CLI; no runbook on file |
| §13 Risk map | ★★★★ | static analysis + heuristic scoring |
| §14 Open questions | ★★★ | flagged where the model could not determine intent from code alone |

## 16. Suggested next steps for new owners

1. Pair with the outgoing engineer this week to validate §13 risks 1–10.
2. Tag every file in §13 with \`# RISK: …\` comments so future reviewers see them in diff view.
3. Decide whether \`/api/v2\` is the future or whether \`/api/v1\` should be the survivor — then deprecate the other.
4. Add tests around \`settlement.rb\` before any new feature touches the money path.
5. Move \`config/sidekiq.yml\` to multi-queue with explicit priorities.
6. Schedule the \`paperclip\` → ActiveStorage migration; \`paperclip\` is unmaintained and a CVE waiting to happen.

Checkpoint: \`.checkpoints/oc-reverse-spec.checkpoint.json\`. The full 142-page export lives at \`docs/spec/haulier-reconstructed.md\` in the repo.`,
    },
    {
      id: "feature-spec",
      label: "Carrier Scorecard — new-feature spec",
      kind: "spec.md",
      body:
`# Carrier Scorecard — Feature Spec

**Owner** oc-app-architect Phase 2 · **Baseline** oc-reverse-spec checkpoint (142-page) · **Status** ready to build

## 1. Why

Dispatchers pick carriers with incomplete signal. They see name + equipment + price on the current picker; they don't see whether this carrier ships on time, damages freight, or disputes invoices. Adding three lagging metrics to the picker should change pick behavior measurably.

Internal customer interviews (3 dispatchers, 30 min each) surfaced the same complaint independently: "I just learn the bad ones by getting burned. There's no way to know up front."

## 2. Outcome we want to see

90 days post-launch:

| Metric | Target |
|---|---|
| Carriers with on-time < 80% are chosen | down 30% (from baseline) |
| Disputes per 100 invoices (carrier-attributable) | down 15% |
| Dispatcher NPS on the picker flow | up ≥ 10 points |
| Time-to-pick (seconds from "new load" to "awarded") | flat or improved |

We are explicitly not optimising for "more total picks" — we want better picks, not more.

## 3. What — three metrics, nothing more

| Metric | Source | Window | Visibility |
|---|---|---|---|
| On-time rate | \`Shipments.delivered_at\` vs. \`pickup_window.end\` | last 90d | always shown |
| Damage rate | \`Claims\` joined on \`Shipment\` | last 90d | always shown |
| Invoice dispute rate | \`Invoices.status = 'disputed'\` | last 180d | always shown |

All three are computable from existing tables. No new data capture.

### 3.1 Why three, not more

We tested a 6-metric variant in research; dispatchers either glazed over or arrived at "give me a single rating." A 3-metric strip with no synthetic rating is the sweet spot — we surface the dimensions people care about and let them weigh trade-offs.

### 3.2 Why three separate numbers, not a composite "rating"

A composite hides trade-offs (cheap-but-late vs. on-time-but-pricey is a real choice). It also invites the carriers to game one weight at the expense of another. Three numbers, three glyphs, three choices.

### 3.3 Edge cases

- **Carrier with zero shipments in window** — show \`—\` with tooltip "no recent data." Do not display a 0% (mathematically true, semantically misleading).
- **Carrier with one shipment** — show the metric with a "low data" badge. The number is real but the sample is tiny.
- **Carrier with all delivered but no invoice yet** — dispute rate window starts when invoice is sent; show \`—\` for dispute rate.

## 4. Where it renders

### 4.1 Primary surface: Carrier Picker dropdown on \`POST /loads/new\`

Each option shows a 3-glyph strip:

\`\`\`
 Big Rig Logistics      ⏱ 94%   ▲ 1.2%   ✎ 0.3%     [12 shipments]
 Mountain Freight       ⏱ 82%   ▲ 4.0%   ✎ 2.1%     [44 shipments]
 SmallCo Hauling        ⏱ 99%   ▲ 0.0%   ✎ 0.0%     [3 shipments · low data]
\`\`\`

- Hover → full breakdown tooltip with raw numerator/denominator.
- Click the metric → deep-dive modal with the historical trend (sparkline + table view, last 12 weeks).
- Glyphs: \`⏱\` on-time, \`▲\` damage (think "warning triangle"), \`✎\` dispute (think "edit / contention").

### 4.2 Secondary surface: Carrier index page

Sortable column on \`/carriers\` (read-only). No new affordances.

### 4.3 Not in scope

- The Carrier-facing UI does not show the score. (Carriers see their own scorecards in v1.5; out of scope for this spec.)

## 5. Filter

Dispatchers can filter "hide carriers with on-time < N%" via a toggle + slider on the picker. URL-paramed (\`?min_on_time=80\`) for bookmarkability and shareability.

Default value: off (no filtering). Persistent per-Dispatcher in \`User.preferences\` once toggled.

## 6. Data layer

### 6.1 The materialized view

**One** materialized view: \`carrier_scorecards_v1\`.

\`\`\`sql
CREATE MATERIALIZED VIEW carrier_scorecards_v1 AS
SELECT
  c.id              AS carrier_id,
  -- on-time rate
  COUNT(DISTINCT s.id) FILTER (
    WHERE s.delivered_at <= s.pickup_window_end
      AND s.delivered_at >= NOW() - INTERVAL '90 days'
  )::float
    / NULLIF(COUNT(DISTINCT s.id) FILTER (
        WHERE s.delivered_at IS NOT NULL
          AND s.delivered_at >= NOW() - INTERVAL '90 days'
      ), 0) AS on_time_rate,
  -- damage rate
  COUNT(DISTINCT cl.id)::float
    / NULLIF(COUNT(DISTINCT s.id) FILTER (
        WHERE s.delivered_at IS NOT NULL
          AND s.delivered_at >= NOW() - INTERVAL '90 days'
      ), 0) AS damage_rate,
  -- dispute rate (180d window)
  COUNT(DISTINCT i.id) FILTER (WHERE i.status = 'disputed')::float
    / NULLIF(COUNT(DISTINCT i.id) FILTER (
        WHERE i.created_at >= NOW() - INTERVAL '180 days'
      ), 0) AS dispute_rate,
  -- denominators for "low data" badge
  COUNT(DISTINCT s.id) FILTER (
    WHERE s.delivered_at >= NOW() - INTERVAL '90 days'
  ) AS shipments_90d
FROM carriers c
LEFT JOIN shipments  s  ON s.carrier_id = c.id
LEFT JOIN claims     cl ON cl.shipment_id = s.id
LEFT JOIN invoices   i  ON i.shipment_id = s.id
WHERE c.deleted_at IS NULL
GROUP BY c.id;

CREATE UNIQUE INDEX carrier_scorecards_v1_carrier_id ON carrier_scorecards_v1(carrier_id);
CREATE INDEX carrier_scorecards_v1_on_time          ON carrier_scorecards_v1(on_time_rate);
\`\`\`

Refreshed **hourly** by a new \`ScorecardRefresh\` Sidekiq job using \`REFRESH MATERIALIZED VIEW CONCURRENTLY\` (which the unique index enables).

### 6.2 Query plan

\`EXPLAIN ANALYZE\` on the picker query (with filter):

\`\`\`
Index Scan using carrier_scorecards_v1_on_time
  ...
Planning Time: 0.412 ms
Execution Time: 38.7 ms  ← p95 on 1.2M-shipment staging data
\`\`\`

### 6.3 Refresh job

\`\`\`ruby
# app/jobs/scorecard_refresh.rb
class ScorecardRefresh
  include Sidekiq::Worker
  sidekiq_options queue: :money_adjacent, retry: 3

  def perform
    ActiveRecord::Base.connection.execute(
      "REFRESH MATERIALIZED VIEW CONCURRENTLY carrier_scorecards_v1"
    )
  end
end
\`\`\`

Scheduled hourly via \`sidekiq-scheduler\`.

## 7. Test matrix

| Layer | Cases |
|---|---|
| Materialized view | empty Carrier · 1-shipment Carrier · all-on-time Carrier · all-late Carrier · disputed-but-no-claim · claim-on-canceled-shipment |
| Refresh job | runs without lock contention · idempotent on retry · alerts on >5min runtime |
| Picker controller | filter URL param parses · invalid param falls back to default · denied access via Pundit |
| Stimulus filter | toggle persists in localStorage as fallback · slider keyboard-accessible · respects prefers-reduced-motion |
| Component | low-data badge renders · em-dash for null · screen-reader announces full metric on focus |
| Regression | settlement.rb completely untouched (grep gate in CI) |

38 RSpec examples + 4 system specs.

## 8. Telemetry

| Event | Payload | Why |
|---|---|---|
| \`scorecard.viewed\` | \`{dispatcher_id}\` | adoption signal |
| \`scorecard.tooltip_opened\` | \`{carrier_id, metric}\` | which metric drives engagement |
| \`scorecard.deep_dive_opened\` | \`{carrier_id, metric}\` | which metric is most "want to know more" |
| \`scorecard.filter_applied\` | \`{min_on_time}\` | filter usage |
| \`carrier.picked\` | \`{carrier_id, on_time_rate, damage_rate, dispute_rate}\` | did pick behavior change? |

Aggregated weekly into the existing \`metrics_*\` rollup tables.

## 9. Rollout plan

| Phase | Audience | Duration | Gate |
|---|---|---|---|
| Internal | brokerage staff (5 users) | 1 week | no errors in Sentry; manual UX feedback |
| 10% | feature flag \`scorecard_picker\` for 10% of Dispatchers | 1 week | telemetry shows ≥ 50% \`scorecard.viewed\` rate |
| 100% | everyone | indefinite | — |

Feature flag via existing \`Flipper\` gem; cohort by \`Dispatcher#id MOD 10\`.

## 10. Fallback behaviour

- If the materialized view fails to refresh for > 6 hours, the picker shows scorecards without a "fresh as of" badge (it shows "fresh as of HH:MM" otherwise) and a \`#ops\` Slack alert fires.
- If the view is missing entirely (catastrophic failure), the picker falls back to the legacy view (no scorecards) without errors.

## 11. Non-goals

- Real-time updates. Hourly is fine; cement that with a "fresh as of" badge.
- Weighted composite score (see §3.2).
- Public-facing scorecards (carrier-facing in v1.5).
- Changes to Settlement, Invoice, or Payment flows. **Do not touch the money path.**

## 12. Risk assessment

\`settlement.rb\` (812-line, 0-test) sits two joins from Invoices. Any query path that touches Settlement without test coverage is a landmine. **Mitigation:** our query path never joins Settlement. oc-code-auditor gates this sprint with an extra-strict pass confirming no new Settlement references — the "Settlement clean-diff stamp" (separate artifact).

Other risks:

| Risk | Likelihood | Mitigation |
|---|---|---|
| Materialized view refresh contention | low | \`REFRESH ... CONCURRENTLY\` (requires unique index — included). |
| Hourly stale window misleads dispatchers | low | "fresh as of HH:MM" badge in tooltip. |
| Carrier disputes the score | medium | We surface the underlying numbers via deep-dive modal; the score is just a window over public facts. |
| Filter slider hides too many carriers from new dispatchers | medium | Default off; per-user persistence only after explicit toggle. |

## 13. Sprint shape

- **Sprint 1** — Materialized view + backfill + unit tests (RSpec). 38 examples.
- **Sprint 2** — Picker UI (Stimulus controller) + scorecard strip component + filter + telemetry.

Each sprint runs through the standard Generator/Evaluator loop, then the **extra-strict** oc-code-auditor pass before PR.

Checkpoint: \`.checkpoints/oc-app-architect.checkpoint.json\` Phase 2 branch.`,
    },
    {
      id: "audit-report",
      label: "oc-code-auditor report (extra-strict pass)",
      kind: "audit.md",
      body:
`# Audit Report — Carrier Scorecard

**Scope** 612 lines, 14 files, 2 migrations · **Runner** \`/oc-audit full\` + money-flow supplementary pass · **Gate** required before PR merge · **Auditor version** 1.2.0 · **Run at** 2026-04-18T10:42:13Z

## 1. Files inspected

| File | LoC changed | Notes |
|---|---:|---|
| \`db/migrate/20260418_add_carrier_scorecards_view.rb\` | +18 | Creates materialized view + unique index. |
| \`db/migrate/20260418_backfill_scorecards.rb\` | +6 | One-shot REFRESH after view creation. |
| \`db/views/carrier_scorecards_v1_v01.sql\` | +42 | DDL via \`scenic\` gem. |
| \`app/models/carrier_scorecard.rb\` | +28 | Read-only AR model wrapping the view. |
| \`app/policies/carrier_scorecard_policy.rb\` | +14 | Pundit; Dispatcher-only. |
| \`app/jobs/scorecard_refresh.rb\` | +18 | Hourly Sidekiq job; uses \`CONCURRENTLY\`. |
| \`config/sidekiq.yml\` | +2 | New \`money_adjacent\` queue. |
| \`app/controllers/loads_controller.rb\` | +9 | Wires \`?min_on_time\` Ransack param. |
| \`app/views/loads/_carrier_picker.html.erb\` | +44 | New 3-glyph strip + low-data badge. |
| \`app/javascript/controllers/scorecard_filter_controller.js\` | +17 | Stimulus controller for the toggle. |
| \`app/views/carriers/_index_row.html.erb\` | +6 | Sortable column on \`/carriers\`. |
| \`spec/models/carrier_scorecard_spec.rb\` | +156 | 12 examples; covers all edge cases. |
| \`spec/jobs/scorecard_refresh_spec.rb\` | +52 | 4 examples (idempotency, lock-contention, runtime guard). |
| \`spec/system/loads/picker_spec.rb\` | +200 | 22 examples (filter, deep-dive, low-data badge, a11y). |

Total: **612** lines added, **0** removed, across **14** files + **2** migrations.

## 2. Security

- ✅ **No new user-input surfaces.** The only new endpoint is an internal scope via Ransack; no raw params enter SQL.
- ✅ **No SQL interpolation.** Scope uses parameterized fragments. \`?min_on_time=80\` is parsed as Float and clamped to [0, 100].
- ✅ **Mass assignment.** New columns are not permitted in any \`_params\` method. Verified by grepping every \`permit(\` call site.
- ✅ **Authorization.** \`CarrierScorecard\` is read-only; Pundit policy restricts access to \`Dispatcher\` role. SuperAdmin sees aggregate dashboard, not per-Carrier scorecards.
- ✅ **Pundit verify_authorized.** The new controller actions invoke \`authorize @carrier_scorecard\` — verified by static check (\`bundle exec pundit-matchers\`).
- ✅ **No PII in logs.** The new code logs only carrier_id (already an internal id, not surfaced in URLs).
- ✅ **Rate-limiting.** Picker endpoint inherits the existing \`rack-attack\` 600/hr/user rule.

## 3. Performance

- ✅ \`EXPLAIN ANALYZE\` on the hot query — **38 ms p95** over the 1.2M-shipment staging dump.
- ✅ Index coverage — the materialized view hits a unique index on \`(carrier_id)\`; the filtered ordering hits the secondary index on \`on_time_rate\`. No seq scans.
- ✅ Backfill — one-shot migration on 1.2M rows runs in **~14 s** on a t3.large in staging; runs in < 60 s on prod dimensions. Idempotent (safe to re-run).
- ✅ \`CONCURRENTLY\` REFRESH measured at **18 s p99** on staging; runs without taking the table lock.
- ✅ Picker page weight change: **+1.1 KB gzipped** (mostly the Stimulus controller + the SVG glyphs).
- ✅ No N+1 — \`includes(:carrier_scorecard)\` on the picker query.

### EXPLAIN excerpt

\`\`\`
Sort  (cost=412.84..414.21 rows=549 width=72)
  ->  Bitmap Heap Scan on carrier_scorecards_v1
        Recheck Cond: (on_time_rate >= 0.8::double precision)
        ->  Bitmap Index Scan on carrier_scorecards_v1_on_time
              Index Cond: (on_time_rate >= 0.8::double precision)
Planning Time: 0.412 ms
Execution Time: 38.7 ms
\`\`\`

## 4. Correctness

- ✅ **Idempotent refresh.** \`ScorecardRefresh\` uses \`REFRESH MATERIALIZED VIEW CONCURRENTLY\`; re-runs are safe and don't take a write lock.
- ✅ **Timezone.** Windows computed in UTC inside the view; display converted to Dispatcher-local via existing \`TimezoneConcern\`. No naive timestamps cross boundaries.
- ✅ **Null-handling.** Carriers with zero shipments show \`—\` with a tooltip, not a division-by-zero crash. The view uses \`NULLIF(denominator, 0)\` so the underlying float is \`NULL\`, not \`Inf\` or \`NaN\`.
- ✅ **Low-data badge.** Shown when \`shipments_90d < 5\` — chosen empirically (below 5, the metric variance is too high to be useful).
- ✅ **Filter clamping.** \`?min_on_time=200\` → clamped to 100. \`?min_on_time=-5\` → clamped to 0. \`?min_on_time=foo\` → falls back to default (off).

## 5. Settlement model — explicit verification (money-flow pass)

This is the **extra-strict** pass mandated by the project context (the only engineer who knew \`settlement.rb\` is leaving in 3 weeks; the file has 0 tests and 6 callbacks). Anything in this diff that touched it would be a hard fail.

- ✅ **Zero diff lines** touch \`app/models/settlement.rb\` or any of its callbacks.
- ✅ **Zero diff lines** touch \`app/services/settlement_runner.rb\`, \`app/jobs/weekly_settlement_run.rb\`, \`app/models/settlement_line_item.rb\`.
- ✅ **Zero query paths** join \`settlements\` table. Grep confirms no \`JOIN settlements\` or \`Settlement.\` references in the diff (including ERB partials and Ruby string heredocs).
- ✅ **Foreign-key scan** — the materialized view references \`shipments\`, \`claims\`, \`invoices\`. Not \`payments\` or \`settlements\`.
- ✅ **Active Admin scan** — no new Active Admin registration; no new admin can edit Settlement.
- ✅ **Background job scan** — \`scorecard_refresh.rb\` operates on the new view only; doesn't enqueue or dequeue any \`Settlement*\` job.
- ✅ **Pundit policy scan** — no new \`SettlementPolicy\` change; existing access control unchanged.

The Settlement clean-diff stamp (separate artifact) is the machine-verifiable receipt of this pass.

## 6. Style

- ✅ **RuboCop clean** — 0 offences. Run with \`bundle exec rubocop --parallel\`.
- ✅ **Brakeman clean** — 0 warnings, 0 errors. Run with \`bundle exec brakeman -q\`.
- ✅ **Stimulus controller** 17 lines, keyboard-accessible (Tab, Enter, Space all work), respects \`prefers-reduced-motion\` (skips the slider's settle animation).
- ✅ **ERB partial** uses \`html_safe\`-on-helpers, never on user input. No raw interpolation.
- ✅ **No \`raw\`** calls in any new view; everything passes through Rails' default escaping.
- ✅ **No new \`config.eager_load = false\`** in env files.
- ✅ **i18n** — new strings live in \`config/locales/en.yml\`; no inline strings in views.

## 7. Tests

- ✅ **38 new RSpec examples**, 100% line coverage on the diff (verified by SimpleCov).
- ✅ **Contract test** for \`?min_on_time=80\` query param — asserts the URL is bookmarkable.
- ✅ **Fixture builders** for "zero-shipments" and "one-shipment" edge cases.
- ✅ **System spec** with Capybara + Selenium covers the picker flow end-to-end including keyboard navigation.
- ✅ **a11y test** — \`axe-rspec\` matcher run on the picker page; 0 violations.
- ✅ **Performance regression** — Capybara assertion that the picker render time is < 200 ms in CI (it's 88 ms on the test rig).

| Test file | Examples | Coverage |
|---|---:|---:|
| \`spec/models/carrier_scorecard_spec.rb\` | 12 | 100% |
| \`spec/jobs/scorecard_refresh_spec.rb\` | 4 | 100% |
| \`spec/system/loads/picker_spec.rb\` | 22 | 100% (controller + view + Stimulus) |

## 8. Dependencies

- ⚠ **New gem:** \`scenic\` (1.7.0). Rails idiom for materialized views.
  - Verified on the allow-list (\`bundle audit\` clean).
  - Last release: 3 months ago. Maintainer: thoughtbot. Active.
  - License: MIT. No copyleft contamination.
  - Exit cost if needed: \`scenic\` files are SQL DDL files in \`db/views/\` — easy to lift out into raw migrations if we ever drop the gem.

## 9. Operability

- ✅ **Sidekiq queue** \`money_adjacent\` (not \`default\`) — the refresh job won't compete with email blasts in the queue.
- ✅ **Failure alert** — the refresh job fires a Slack alert if it runs > 5 min (anomaly threshold).
- ✅ **Stale-data alert** — a separate watchdog asserts the view's \`pg_stat_user_tables\` last-vacuum timestamp is within 6 hours.
- ✅ **Feature flag** — \`scorecard_picker\` (Flipper) gates the new picker UI; off by default. Rollout plan in the feature spec.
- ✅ **Rollback procedure** — flip the flag off; legacy picker renders unchanged. Drop the materialized view when confident.
- ✅ **Documented runbook** — \`docs/runbooks/carrier-scorecard.md\` (added in this PR).

## 10. Overall

\`\`\`
 grade     A (94/100)
 gate      PASS
\`\`\`

Deductions:
- −3 for the new gem (any dependency adds risk; mitigated by allow-list verification).
- −2 for missing a "low data" telemetry event (we know which metric is hidden, but not how often that hide is the only blocker between the dispatcher and a pick).
- −1 for documentation: the runbook covers the happy path but skips "what if the materialized view is corrupted?" — added a TODO for v1.1.

Writing \`.checkpoints/oc-code-auditor.checkpoint.json\` with the explicit Settlement-clean-diff stamp. oc-git-ops may open PR.

## 11. Auditor sign-off

- **Auditor:** oc-code-auditor v1.2.0
- **Mode:** \`/oc-audit full\` + money-flow supplementary pass (Settlement clean-diff verification)
- **Run-time:** 4 m 12 s end-to-end (RuboCop + Brakeman + RSpec + EXPLAIN benchmarks + grep gates).
- **Gate verdict:** PASS — oc-git-ops may open PR.
- **Re-audit recommended:** before any future change touches the materialized view definition or adds a join from the picker to the Settlement table.`,
    },
    {
      id: "settlement-clean-diff-stamp",
      label: "Settlement-clean-diff audit stamp",
      kind: "stamp.json",
      body:
`# Settlement Clean-Diff Stamp

Added to \`.checkpoints/oc-code-auditor.checkpoint.json\` after the money-flow pass. This is a **machine-verifiable receipt** that the new feature did not touch any file in the Settlement scope.

## 1. The stamp

\`\`\`json
{
  "verification": "settlement-untouched",
  "commit": "a4f91e2",
  "branch": "feat/carrier-scorecard",
  "scope": [
    "app/models/settlement.rb",
    "app/models/settlement_line_item.rb",
    "app/services/settlement_runner.rb",
    "app/services/settlement_balancer.rb",
    "app/jobs/weekly_settlement_run.rb",
    "app/admin/settlements.rb",
    "app/policies/settlement_policy.rb",
    "spec/models/settlement_spec.rb"
  ],
  "diff_lines_touching_scope": 0,
  "query_paths_touching_settlements_table": 0,
  "active_admin_changes_to_settlement": 0,
  "background_jobs_added_to_settlement_workers": 0,
  "policy_changes": 0,
  "foreign_keys_referenced_by_new_tables": ["shipments", "claims", "invoices"],
  "grep_patterns_run": [
    "JOIN settlements",
    "Settlement\\\\.",
    "Settlement::",
    "settlement_id",
    "settlements_path",
    "settlement_runner",
    "WeeklySettlementRun"
  ],
  "verifier": "oc-code-auditor",
  "verifier_version": "1.2.0",
  "timestamp": "2026-04-18T10:42:13Z",
  "gate_status": "pass",
  "supplementary_passes": ["money-flow"]
}
\`\`\`

## 2. Why this stamp matters

The one engineer who knew the settlement model is leaving in 3 weeks. The audit stamp is a machine-verifiable receipt that the new feature did not touch a load-bearing file she owns.

Six months from now, if settlements break, the first question will be "what changed?" — and the answer for this feature is provably "nothing." That's the difference between a 4-hour incident and a 2-day forensic audit.

## 3. What the verifier actually does

The clean-diff verifier is a deterministic script (\`bin/audit/settlement-clean-diff.rb\`) that runs as part of \`/oc-audit full\` on any diff:

1. **\`git diff --name-only HEAD\`** intersected with the in-scope file list — must be empty.
2. **Static grep** across the entire diff for the pattern list above. Each match is a hard fail.
3. **AST scan** of every changed Ruby file — looks for any reference to a constant matching \`/Settlement/\` (catches indirect references like \`scope.send(:settlements)\`).
4. **Schema diff** — asserts no migration in the diff touches the \`settlements\` table or any table with a \`settlement_id\` foreign key.
5. **Active Admin scan** — \`/app/admin/\` files in the diff are inspected for any \`ActiveAdmin.register Settlement\` block change.
6. **Background-job scan** — \`/app/jobs/\` and \`/app/workers/\` files are inspected for any new enqueue of a Settlement-related class name.
7. **Policy scan** — Pundit \`SettlementPolicy\` AST hash unchanged.

A failure on any of these short-circuits the gate; the PR cannot be opened.

## 4. Where the stamp lives

The stamp is one entry in \`.checkpoints/oc-code-auditor.checkpoint.json\` under \`skill_state.supplementary_pass_stamps\`. The full checkpoint also stores the \`/oc-audit full\` results, so a successor team can reconstruct the audit history without re-running.

\`\`\`
.checkpoints/
└─ oc-code-auditor.checkpoint.json
   └─ skill_state.supplementary_pass_stamps[]
      ├─ {commit: "a4f91e2", verification: "settlement-untouched", ...}  ← this stamp
      ├─ {commit: "918aaee", verification: "invoice-callback-untouched", ...}
      └─ ...
\`\`\`

## 5. Re-verification on every release

The stamp is **regenerated on each oc-code-auditor invocation**. If a future diff accidentally touches \`settlement.rb\`, the gate fails loudly before the PR can be merged. Specifically:

- A pre-commit hook (\`.husky/pre-commit\`) runs the verifier on the local diff.
- A GitHub Actions workflow runs it on every PR push.
- A nightly cron runs it against \`main\` to catch drift (e.g., a force-push that bypassed the gate).

If any of those finds a violation, a Linear bug is auto-filed at \`Severity = High\` with the failing diff attached.

## 6. Stamp signature (forward-compat)

In v1, stamps are unsigned; the verifier writes them and the checkpoint trusts the writer. In v1.1, stamps will be signed with a CI-only ed25519 key so a tampered stamp can be detected:

\`\`\`json
{
  ...
  "signature": "ed25519:7f4e9c...",
  "signed_by": "code-auditor-ci"
}
\`\`\`

This is documented as a TODO; not blocking for v1.

## 7. Provenance

| Field | Value |
|---|---|
| Stamp produced by | oc-code-auditor v1.2.0 |
| Run mode | \`/oc-audit full\` + money-flow supplementary pass |
| Commit verified | \`a4f91e2\` |
| Run duration | 4 m 12 s |
| Gate verdict | PASS |
| Stored at | \`.checkpoints/oc-code-auditor.checkpoint.json\` |`,
    },
  ],
  skills: ["oc-reverse-spec", "oc-app-architect", "oc-code-auditor"],
  runtime: "≈ 14 exchanges",
  steps: [
    { type: "beat", phase: "discover", label: "01 · Survey", caption: "oc-reverse-spec reads the code", skills: ["oc-reverse-spec"] },

    {
      type: "exchange", role: "user",
      content:
`Inherited a 3-year-old Rails 6 app called Haulier (freight logistics SaaS). No docs. One engineer who knows it is leaving in 3 weeks. Boss wants us to add a new "Carrier scorecard" feature before she goes.

I'm scared to touch it. Where do I start?`
    },
    {
      type: "exchange", role: "claude", skill: "oc-reverse-spec",
      content:
`The right entry point is **oc-reverse-spec**, not oc-app-architect — you don't know enough about the existing app to plan a new feature yet. I'll reconstruct the spec from the code so oc-app-architect has a baseline to plan against.

Invoking **oc-reverse-spec**. Running the 5-phase survey:

1. **Repo-shape scan** — languages, frameworks, monolith vs. service, dep health.
2. **Model archaeology** — ActiveRecord models + associations + cardinality.
3. **Route inventory** — every endpoint grouped by controller.
4. **Domain extraction** — business concepts inferred from names + comments.
5. **Risk map** — files that are "load-bearing and fragile" (high churn + no tests).

Point me at the repo and I'll go. \`/scan /path/to/haulier\` or paste the top-level tree + Gemfile.`
    },
    {
      type: "exchange", role: "user",
      content: "/scan ~/work/haulier"
    },
    {
      type: "exchange", role: "claude", skill: "oc-reverse-spec",
      content:
`Scan complete in 8m 12s. Findings:

**Repo shape**
- Rails 6.1, Ruby 3.1, Postgres 13, Sidekiq 7, 84 gems (11 flagged out-of-date).
- 47k lines of Ruby, 8k ERB, 2k JS (vanilla + jQuery, no bundler).
- 312 tests (RSpec), 58% line coverage — decent for a 3-year-old monolith.

**Domain — reconstructed from models + controllers + naming:**

> **Haulier** is a freight-broker SaaS. Brokers ("Dispatchers") post Loads; Carriers bid; a chosen Carrier hauls; the Broker invoices the Shipper. Side-flows: driver-side Documents upload, daily Fuel-surcharge reindex, weekly Settlement run.

**Model graph** (28 models, top-level):
\`Dispatcher ─▶ Load ─▶ Bid ◀─ Carrier · Load ─▶ Shipment ─▶ Document · Shipment ─▶ Invoice ─▶ Payment\`

**Risk map** — top 3 files:
- \`app/models/settlement.rb\` — 812 lines, 6 callbacks, 0 tests. Handles money. 🚨
- \`app/jobs/fuel_reindex.rb\` — runs nightly, no failure alerting.
- \`app/controllers/api/v2/loads_controller.rb\` — 19 endpoints, long methods.

Writing \`.checkpoints/oc-reverse-spec.checkpoint.json\` — 142-page reconstructed spec included. Ready to hand off to **oc-app-architect** for the new feature. Continue?`,
      artifacts: ["reconstructed-spec"],
    },
    {
      type: "exchange", role: "user",
      content: "Yes. The feature is a Carrier scorecard — on-time rate, damage rate, invoice dispute rate — shown to dispatchers when they're picking a carrier for a new load."
    },

    { type: "beat", phase: "plan", label: "02 · Plan the new feature", caption: "oc-app-architect reads the spec as baseline", skills: ["oc-app-architect"] },

    {
      type: "exchange", role: "claude", skill: "oc-app-architect",
      content:
`Invoked by oc-reverse-spec with the 142-page baseline. Since the app already exists, I skip \`/oc-discover\` and go straight to \`/oc-spec\` for the new feature, treating the baseline as Phase-1 output.

**Feature — Carrier scorecard:**

Three metrics, all computable from existing tables:

| Metric               | Source                                     | Window   |
|----------------------|--------------------------------------------|----------|
| On-time rate         | \`Shipments.delivered_at\` vs. promised    | last 90d |
| Damage rate          | \`Claims\` joined on \`Shipment\`           | last 90d |
| Invoice dispute rate | \`Invoices.status = 'disputed'\`            | last 180d|

**Where it renders:** dispatcher's \`loads#new\` screen, Carrier picker dropdown. Each option shows a tiny 3-glyph strip.

**Data work:** no new tables. One materialized view \`carrier_scorecards_v1\` refreshed hourly. Query plan benchmarked at ~40ms on the current data volume.

**Risk I'm flagging:** \`settlement.rb\` sits two joins away from \`invoices\`. Any query path that touches settlement without tests is a landmine. \`oc-code-auditor\` will gate this sprint with an extra-strict pass on that model. Writing \`.checkpoints/oc-app-architect.checkpoint.json\`. \`/approve\` to advance.`,
      artifacts: ["feature-spec"],
    },
    {
      type: "exchange", role: "user",
      content: "/approve — but add one thing. Dispatchers want to filter the Carrier picker by scorecard. 'Hide carriers with < 80% on-time.'"
    },
    {
      type: "exchange", role: "claude", skill: "oc-app-architect",
      content:
`Folded in. Adds one URL query param \`?min_on_time=80\` on the picker endpoint and a toggle in the UI. No backend migration — the materialized view already has the field.

Updated sprint plan — 2 sprints:

| # | Sprint                                           | Deliverable                                    |
|---|--------------------------------------------------|------------------------------------------------|
| 1 | Materialized view + backfill + unit tests        | \`carrier_scorecards_v1\`, RSpec @ 95% cov.    |
| 2 | Picker UI + filter + scorecard strip component   | Stimulus controller, component preview tests. |

Kicking off Sprint 1 with the Generator/Evaluator harness. Pre-flight: \`oc-code-auditor\` spot-check on touch-points. \`/approve\` to run.`
    },
    {
      type: "exchange", role: "user",
      content: "/approve"
    },

    { type: "beat", phase: "build", label: "03 · Build", caption: "with an extra-strict audit gate", skills: ["oc-app-architect", "oc-code-auditor"] },

    {
      type: "exchange", role: "claude", skill: "oc-app-architect",
      content:
`**Sprint 1 complete.**
- Materialized view created + \`scenic\` gem added (Rails idiom for views).
- Backfill migration runs on 1.2M shipment rows in ~14s on a staging dump.
- 38 RSpec examples, 100% on the new code, settlement.rb untouched.
- Evaluator: 93/100. Docs blob on the Rails model is missing — flagged, not blocking.

**Sprint 2 complete.**
- \`CarrierScorecardStrip\` component, preview-tested with 5 fixture states.
- \`?min_on_time\` wired through Ransack-compatible scope.
- Stimulus controller for the toggle, 17 lines; keyboard-accessible.
- Evaluator: 91/100.

Invoking **oc-code-auditor** for the gate before PR.`
    },
    {
      type: "exchange", role: "claude", skill: "oc-code-auditor",
      content:
`Running \`/oc-audit full\` on the diff — 612 lines across 14 files.

\`\`\`
 security       ✓ no new user input surfaces; no SQL-interpolation paths
 perf           ✓ added EXPLAIN ANALYZE on the hot query (38ms p95)
 correctness    ✓ backfill idempotent; scorecard refresh is a transaction
 style          ✓ RuboCop clean
 tests          ✓ 38 new · 100% on the diff · settlement.rb untouched
 dependencies   ⚠ scenic gem added — verified it's on the current allow-list

 overall grade  A (94/100)
\`\`\`

The one amber signal was the new gem; confirmed it's maintained + on our allow-list. **Gate: PASS.** Handing back to oc-git-ops for the PR.`,
      artifacts: ["audit-report", "settlement-clean-diff-stamp"],
    },
    {
      type: "exchange", role: "claude", skill: "oc-app-architect",
      content:
`PR opened, description auto-written with the baseline spec excerpt + the two sprint summaries + the audit report. You can merge when your one remaining engineer signs off.

**Bottom line:** the legacy app is now documented (142-page spec in \`/docs/spec.md\`), the new feature is shipped-ready, and nothing load-bearing was touched. When the engineer leaves in 3 weeks, you have the spec and the sprint ledger — and anybody can pick up from the checkpoints.`
    },
  ],
};

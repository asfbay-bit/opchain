import type { Walkthrough } from "./types";

/**
 * Scenario 4 — integrations-engineer runs its 5-phase integration protocol
 * and code-auditor gates the PR. Demonstrates the side-chain pattern
 * (integration skill + audit gate) that isn't on the main spine.
 */
export const stripeShip: Walkthrough = {
  id: "stripe-ship",
  title: "Ship Stripe subscriptions by Friday",
  tagline: "Stripe subscriptions by Friday",
  summary:
    "Two tiers, per-seat billing, webhook signatures, audit gate — five days, one session.",
  description:
    "A live Next.js app needs Stripe subscriptions by Friday: two tiers (Pro $19, Team $49), per-seat billing on Team. The founder has never wired Stripe before and doesn't want to break production. integrations-engineer runs its 5-phase protocol — recon, contract, scaffolding, live wiring, proof — building a mock-first boundary layer before a single real key touches the codebase. code-auditor gates the PR with a money-flow supplementary pass; a feature flag rolls the integration to 5% on launch day and 100% once webhooks hold steady.",
  inputs: [
    "Live Next.js app · Prisma on Postgres",
    "Two pricing tiers (Pro $19/mo, Team $49/mo)",
    "Per-seat billing on the Team tier; seats = team member count",
    "No prior Stripe experience · one 40-hour week until launch",
  ],
  outputs: [
    {
      id: "integration-contract",
      label: "Integration Contract",
      kind: "contract.md",
      body:
`# Stripe Integration Contract

**Produced by** integrations-engineer Phase 2 (Contract) · **Reviewed by** code-auditor

## Purpose

Turn a \`Team\` (Team tier) or \`User\` (Pro tier) into a Stripe Subscription; keep seat count synced; surface billing state to the app.

## Inputs → Stripe

- \`POST /api/billing/checkout\` — creates \`checkout.sessions\` with:
  - \`mode: "subscription"\`
  - \`customer\`: \`stripe_customer_id\` (new field on \`User\` + \`Team\`)
  - \`line_items\`: one of two \`price_id\`s (\`PRICE_PRO\`, \`PRICE_TEAM\`)
  - \`metadata.source = "heads-down-app"\`
  - \`success_url\`, \`cancel_url\` signed with a short-lived token

## Outputs from Stripe (webhooks)

All via \`POST /api/billing/webhook\` — raw body, signature-verified.

| Event                             | Handler                          | Side effect                                              |
|-----------------------------------|----------------------------------|----------------------------------------------------------|
| \`checkout.session.completed\`     | \`checkout-completed.ts\`         | Flip \`billing_status\` pending → active; store subscription id |
| \`customer.subscription.updated\`  | \`subscription-updated.ts\`       | Update \`current_period_end\`; reconcile seat count      |
| \`customer.subscription.deleted\`  | \`subscription-deleted.ts\`       | Flip \`billing_status\` → canceled; UI gates writes      |
| \`invoice.payment_failed\`         | \`invoice-payment-failed.ts\`     | Flip \`billing_status\` → past_due; show retry CTA        |

## Invariants (MUST hold)

1. **One active subscription per \`Team\` (Team tier) or \`User\` (Pro tier).** Duplicate checkout sessions fail at webhook ingestion with a 409 log line.
2. **Seat-count changes reflect in Stripe within 60s.** Reconciliation runs via \`subscription_items\` quantity update, not \`replace_all\`.
3. **Webhook events are idempotent.** \`StripeEvent.stripe_event_id\` has a unique index; replays are no-ops.
4. **Failed payment blocks writes.** \`billing_status === 'past_due'\` gates any mutation in the UI; reads still work.

## New tables

- \`StripeEvent\` — idempotency ledger
  \`\`\`
  id, stripe_event_id (unique), type, received_at, processed_at, raw_payload
  \`\`\`
- \`BillingStatus\` — denormalized for fast reads
  \`\`\`
  owner_type ('User'|'Team'), owner_id, status, plan, seats, current_period_end
  \`\`\`

## Feature flag

\`FLAG_STRIPE_LIVE\` — when off, everything runs against Stripe test mode with the fixture clock. When on, live keys + live charges.

## Failure modes (catalog)

1. **Webhook arrives before the user's browser returns from Checkout.** Handled: \`billing_status\` is set to \`pending\` during Checkout creation, \`active\` on webhook arrival. UI reads from BillingStatus, not query params.
2. **User closes tab mid-Checkout.** Stripe Session eventually expires; no webhook arrives; \`billing_status\` stays \`pending\` for 1h, then reconciler flips it back to \`free\`.
3. **Network partition during webhook retry.** Stripe retries up to 3 days; our idempotency ledger ensures replay safety.

Checkpoint: \`.checkpoints/integrations-engineer.checkpoint.json\` (Phase 2).`,
    },
    {
      id: "boundary-layer",
      label: "Boundary layer (mocked, then live)",
      kind: "code.md",
      body:
`# Boundary Layer — \`lib/billing/\`

**Principle:** the rest of the app never imports \`stripe\` directly. Everything goes through \`lib/billing/client.ts\`. Mock the boundary, test everything else in isolation.

## File tree

\`\`\`
lib/billing/
├─ client.ts                     // thin Stripe wrapper; only call site in the app
├─ checkout.ts                   // createCheckoutSession(userId | teamId, tier)
├─ webhook.ts                    // verifyAndDispatch(req) → {event, handler}
├─ handlers/
│   ├─ checkout-completed.ts
│   ├─ subscription-updated.ts
│   ├─ subscription-deleted.ts
│   └─ invoice-payment-failed.ts
├─ seat-sync.ts                  // reconcile Team.members.length → subscription_item.quantity
├─ types.ts                      // shared TS types mirroring the contract
└─ __mocks__/                    // fixture responses keyed by scenario
    ├─ checkout-completed.json
    ├─ subscription-updated-seats-up.json
    ├─ subscription-updated-seats-down.json
    ├─ subscription-deleted.json
    └─ invoice-payment-failed.json
\`\`\`

## \`client.ts\` (shape, not the full thing)

\`\`\`ts
import Stripe from "stripe";

export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET;
  if (!key) throw new Error("STRIPE_SECRET unset");
  return new Stripe(key, { apiVersion: "2024-11-20.acacia" });
}

export const MOCK_MODE = process.env.FLAG_STRIPE_LIVE !== "true";
\`\`\`

## \`webhook.ts\` — the critical path

\`\`\`ts
import { getStripe } from "./client";
import { handlers } from "./handlers";

export async function verifyAndDispatch(req: Request): Promise<void> {
  // Stripe SDK verifies on raw body; we must not parse JSON first.
  const raw = await req.text();
  const sig = req.headers.get("stripe-signature") ?? "";
  const event = getStripe().webhooks.constructEvent(
    raw, sig, process.env.STRIPE_WEBHOOK_SECRET!
  );

  // Idempotency — ledger table with unique(stripe_event_id)
  const already = await db.stripeEvent.findUnique({ where: { stripeEventId: event.id } });
  if (already) return;                        // duplicate replay; no-op
  await db.stripeEvent.create({ data: { stripeEventId: event.id, type: event.type, rawPayload: raw, receivedAt: new Date() } });

  const handler = handlers[event.type as keyof typeof handlers];
  if (!handler) return;                       // event we don't care about
  await handler(event);
  await db.stripeEvent.update({ where: { stripeEventId: event.id }, data: { processedAt: new Date() } });
}
\`\`\`

## Contract tests (22 passing)

- Every handler: replay identical event twice → assert state unchanged.
- \`checkout-completed\`: \`billing_status\` flips pending → active.
- \`subscription-updated\` with increased seats: \`BillingStatus.seats\` reflects new count.
- \`subscription-updated\` with decreased seats: ditto.
- \`subscription-deleted\`: \`billing_status\` → canceled; UI gate asserted on a subsequent mutation.
- \`invoice.payment_failed\`: \`billing_status\` → past_due; any mutation returns 402.

All tests run with \`MOCK_MODE = true\` and the fixture clock. Run time: **1.8 s** for the whole suite.`,
    },
    {
      id: "audit-report",
      label: "code-auditor report (money-flow pass)",
      kind: "audit.md",
      body:
`# Audit Report — Stripe Subscriptions

**Scope** \`lib/billing/**\` + routes + tests
**Runner** \`/audit full\` + money-flow supplementary pass
**Gate** required before PR merge

## Security

- ✅ **Webhook endpoint verifies signature on raw body** (not parsed). Confirmed \`req.text()\` is read before any JSON parse.
- ✅ **No secret leakage.** \`STRIPE_SECRET\` never logged; never reaches the client bundle (grep + bundle inspection).
- ✅ **CSRF.** \`/api/billing/checkout\` requires an authenticated session + same-origin check; no CSRF token needed because it's same-origin JSON.
- ⚠ **Rate-limit** on \`/api/billing/webhook\` is 60/min. Stripe can burst to 150/min during incident retries.
    **→ Recommendation:** raise to 300/min **or** switch to Stripe IP allow-list (preferred, see [Stripe docs](https://stripe.com/docs/webhooks#verify-ip)).

## Correctness

- ✅ Handlers idempotent on \`stripe_event_id\` (unique index confirmed).
- ✅ Seat-sync uses \`subscription_items\` API, not \`replace_all\`. Confirms we don't clobber unrelated line items.
- ✅ Race between \`checkout.completed\` webhook and user closing tab: handled via \`billing_status = 'pending'\` → \`'active'\` transition.

## Money flow (supplementary pass)

- ✅ **No proration path without explicit toggle.** \`billing_cycle_anchor\` not set without a corresponding guard.
- ✅ \`subscription.deleted\` → \`billing_status = 'canceled'\`, never \`NULL\`. Absent status would fail open.
- ✅ \`invoice.payment_failed\` → \`billing_status = 'past_due'\`. UI gate in \`middleware/billing-gate.ts\` confirmed in route tests.
- ✅ **No refund path in scope.** Refund handling is deliberately out of v1 — documented in the contract, not silently missing.

## Tests

- ✅ 22 contract tests + 14 handler tests + 6 E2E in Stripe **test mode** with the fixture clock. All green.
- ✅ Fixture clock used — deterministic. No sleeps, no retries-that-hide-bugs.
- ⚠ **Missing coverage.** No test for "user closes tab mid-Checkout, returns next day." Absent, we can't prove we don't double-charge.
    **→ Recommendation:** add \`abandoned-checkout-recovery.e2e.ts\` covering the 1-hour timeout → \`free\` fallback.

## Overall (initial gate)

\`\`\`
 grade           A− (91/100)
 gate            CONDITIONAL PASS
 action items    1. webhook rate-limit (see above)
                 2. abandoned-checkout E2E test
\`\`\`

## Re-audit after fixes

\`\`\`
 grade           A (95/100)
 gate            PASS
\`\`\`

- Webhook endpoint now uses Stripe IP allow-list (\`X-Forwarded-For\` validated against published CIDR block). Rate-limiter removed; Stripe's own backoff handles burst.
- \`abandoned-checkout-recovery.e2e.ts\` added. Simulates user closing tab between Checkout redirect and webhook arrival; asserts no duplicate charge, asserts \`billing_status = 'pending'\` expires after 1h back to \`'free'\`.

Checkpoint: \`.checkpoints/code-auditor.checkpoint.json\`.`,
    },
    {
      id: "launch-plan",
      label: "Friday launch plan + rollback",
      kind: "runbook",
      body:
`# Launch Plan — Stripe Go-Live

**Target window** Friday · **Owner** integrations-engineer checkpoint · **Rollback** ≤ 60 s via feature flag

## Pre-flight (Thursday evening)

- [x] All 22 contract tests + 14 handler tests + 7 E2E green on main
- [x] Audit gate: A (95/100), PASS
- [x] Staging has been running on live Stripe keys for **3 days** with 0 webhook failures
- [x] \`.env.production\` has \`FLAG_STRIPE_LIVE=false\` (we'll flip manually)
- [x] Cloudflare KV flag flip tested (propagates ≤ 10s)
- [x] Stripe webhook dashboard bookmarked + PagerDuty rules added

## Go-live sequence (Friday)

### 10:00 — Flip flag for 5% of accounts

Enable \`FLAG_STRIPE_LIVE\` for accounts in the internal-team + 3-friendly-user list (hardcoded allowlist).

**Watch for 60 minutes:**
- \`POST /api/billing/checkout\` requests in the Stripe dashboard
- Webhook event arrivals (expect ~1 per action, within 2s)
- Our own error tracker \`lib/billing/*\` scope
- BillingStatus row creation cadence

### 11:00 — Decide

Go criteria (all required):
- [ ] 0 webhook signature failures
- [ ] 0 handler errors in \`lib/billing/*\`
- [ ] All test purchases flow: Checkout → \`billing_status = active\` within 5s
- [ ] Seat-sync on add/remove teammate works end-to-end
- [ ] Support inbox: 0 billing-related tickets

No-go → rollback (below). Go → continue.

### 14:00 — Flip to 100%

Enable \`FLAG_STRIPE_LIVE\` for everyone.

**Watch for 24 hours:**
- Webhook event rate vs. expected
- \`billing_status\` distribution (pending count should be tiny; persistent pending is a red flag)
- Failed-payment rate (expect near-zero in first week; new customers have fresh cards)

## Rollback

\`\`\`bash
# Flip the flag off — existing subscriptions keep running in Stripe;
# the app stops creating new ones.
wrangler kv:key put --binding=FLAGS FLAG_STRIPE_LIVE false --preview false
wrangler kv:key put --binding=FLAGS FLAG_STRIPE_LIVE false
\`\`\`

Propagation: ≤ 10 s edge-wide.

**What still works after rollback:**
- Existing subscribers — Stripe keeps billing them. Our app continues to read BillingStatus as stamped.
- Seat-sync for existing subscribers — handler still runs on webhooks.
- Pause/cancel — users can still downgrade via the Customer Portal.

**What stops working:**
- New Checkout sessions — \`/api/billing/checkout\` returns 503 with a "temporarily unavailable" message.

## Post-launch review (Monday)

- Webhook volume vs. expected
- Top 5 slowest handler executions
- Any \`stripeEventId\` collisions (should be zero)
- Customer feedback on Checkout UX

Checkpoint: \`.checkpoints/integrations-engineer.checkpoint.json\` closes with the go-live timestamp.`,
    },
  ],
  skills: ["integrations-engineer", "code-auditor"],
  runtime: "≈ 13 exchanges",
  steps: [
    { type: "beat", label: "01 · Brief", caption: "integrations-engineer sizes the job", skills: ["integrations-engineer"] },

    {
      type: "exchange", role: "user",
      content:
`I need Stripe subscriptions in my Next.js app by Friday. Two tiers (Pro $19/mo, Team $49/mo), per-seat billing on the Team tier. App is live, Prisma on Postgres. I've never wired Stripe before.

Don't break the app.`
    },
    {
      type: "exchange", role: "claude", skill: "integrations-engineer",
      content:
`Invoking **integrations-engineer** with its 5-phase protocol:

1. **Recon** — read the target service's docs + SDK health; score risk surfaces.
2. **Contract** — write the Integration Contract spec (what enters, what leaves, which failures are recoverable).
3. **Scaffolding** — implement the boundary layer with typed mocks.
4. **Live wiring** — connect to the real API, feature-flagged.
5. **Proof** — end-to-end test + failure-mode harness + audit gate.

**Recon on Stripe:**
- Stripe API version target: \`2024-11-20.acacia\` (current stable).
- Node SDK \`stripe@17.x\` (official, maintained).
- Webhook signature verification is **mandatory** — any other shortcut fails the audit.
- Test mode keys available; fixture clock available for clean test data.
- Primary risk surfaces: (a) webhook race conditions vs. Checkout redirect, (b) proration math on the Team tier.

Handing me your repo root + the current user/team schema and I'll draft the contract. Paste the \`schema.prisma\` excerpt for \`User\` and whatever \`Team\` / \`Membership\` you have.`
    },
    {
      type: "exchange", role: "user",
      content:
`\`\`\`prisma
model User   { id String @id @default(cuid()) email String @unique teamId String? team Team? @relation(...) }
model Team   { id String @id @default(cuid()) slug String @unique members User[] createdAt DateTime @default(now()) }
\`\`\`
Seat count = count of User records where teamId = Team.id.`
    },
    {
      type: "exchange", role: "claude", skill: "integrations-engineer",
      content:
`Got it. Writing the **Integration Contract** (Phase 2):

**Purpose:** turn a Team (or solo User) into a Stripe Subscription; keep seat count synced; surface billing state to the app.

**Inputs → Stripe:** \`checkout.sessions.create\` with \`subscription\` mode, \`customer\` = \`stripe_customer_id\` (new field on \`User\` for solo and \`Team\` for team), \`line_items\` = one of two \`price_id\`s.
**Outputs from Stripe:** webhooks: \`checkout.session.completed\` · \`customer.subscription.updated\` · \`customer.subscription.deleted\` · \`invoice.payment_failed\`.
**Invariants:**
- Exactly one active subscription per \`Team\` (for Team tier) or \`User\` (for Pro).
- Seat-count changes reflect in Stripe within 60s via subscription-item quantity update.
- Webhook events are **idempotent** on receipt (primary key on \`stripe_event_id\`).
- Failed payments → \`billing_status: 'past_due'\` on the User/Team; UI gates writes.

**New tables:** \`StripeEvent\` (idempotency ledger), \`BillingStatus\` (denormalized for fast reads).

**Feature flag:** \`FLAG_STRIPE_LIVE\` — when off, everything runs against mocks in test mode.

Writing \`.checkpoints/integrations-engineer.checkpoint.json\` with the contract. \`/approve\` to proceed to Phase 3 scaffolding.`,
      artifacts: ["integration-contract"],
    },
    {
      type: "exchange", role: "user",
      content: "/approve"
    },

    { type: "beat", label: "02 · Scaffold + wire", caption: "boundary layer first, live keys last", skills: ["integrations-engineer"] },

    {
      type: "exchange", role: "claude", skill: "integrations-engineer",
      content:
`**Phase 3 — Scaffolding.** Implementing the boundary layer with typed mocks so tests can run without network.

\`\`\`
lib/billing/
├─ client.ts         // thin Stripe wrapper, only call site in the app
├─ checkout.ts       // createCheckoutSession(userId | teamId, tier)
├─ webhook.ts        // verifyAndDispatch(req) → {event, handler}
├─ handlers/
│   ├─ checkout-completed.ts
│   ├─ subscription-updated.ts
│   ├─ subscription-deleted.ts
│   └─ invoice-payment-failed.ts
├─ seat-sync.ts      // reconcile Team.members.length → subscription_item.quantity
└─ types.ts

lib/billing/__mocks__/  // fixture responses keyed by scenario
\`\`\`

Contract tests: 22 passing. Every handler has an idempotency test (replay the same event twice, assert state unchanged).

**Phase 4 — Live wiring.** Added:
- \`/api/billing/checkout\` (signed-in only, rate-limited 5/min).
- \`/api/billing/webhook\` (raw body, signature-verified).
- \`/billing\` page with tier cards + portal link post-subscribe.

\`FLAG_STRIPE_LIVE\` defaulting to **off** in \`.env\`; **on** in staging. Handing to **code-auditor** for the gate.`,
      artifacts: ["boundary-layer"],
    },

    { type: "beat", label: "03 · Audit gate", caption: "code-auditor before merge", skills: ["code-auditor"] },

    {
      type: "exchange", role: "claude", skill: "code-auditor",
      content:
`Invoked by integrations-engineer on a Stripe integration — running \`/audit full\` with the **money-flow supplementary pass** (extra scrutiny on auth, webhook signatures, idempotency).

\`\`\`
 security
   ✓ webhook endpoint verifies signature on raw body (not parsed)
   ✓ no secret leakage: STRIPE_SECRET never logged, never client-shipped
   ✓ CSRF: checkout endpoint requires session + same-origin check
   ⚠ rate-limit on /api/billing/webhook is 60/min; Stripe can burst to 150
       recommendation: raise to 300/min or use IP allow-list

 correctness
   ✓ handlers idempotent on stripe_event_id (unique index confirmed)
   ✓ seat-sync uses Stripe's subscription_items API (not replace_all)
   ✓ race between checkout.completed and user closing tab: handled via
       billing_status = 'pending' → 'active' transition

 money flow
   ✓ no proration path without explicit toggle
   ✓ subscription.deleted → billing_status = 'canceled' not NULL
   ✓ invoice.payment_failed → flipped to past_due, UI gate in place

 tests
   ✓ 22 contract tests + 14 handler tests + 6 E2E in Stripe test mode
   ✓ fixture clock used — deterministic

 overall grade   A− (91/100)
\`\`\`

Two action items before merge:
1. Raise webhook rate limit to 300/min (or switch to Stripe IP allow-list — preferred).
2. Add a test for the "user closes tab mid-checkout, returns next day" path — asserts we don't double-charge.

Writing \`.checkpoints/code-auditor.checkpoint.json\`. **Gate: CONDITIONAL PASS** until those two are addressed.`
    },
    {
      type: "exchange", role: "user",
      content: "Fix both and re-audit."
    },
    {
      type: "exchange", role: "claude", skill: "integrations-engineer",
      content:
`Patching:

1. Swapping webhook rate limit for Stripe's IP allow-list (\`lib/billing/webhook.ts\` now checks \`X-Forwarded-For\` against the documented CIDR block; rate-limiter removed).
2. Added \`abandoned-checkout-recovery.e2e.ts\` — simulates user closing tab between Checkout redirect and webhook arrival; asserts no duplicate charge, asserts \`billing_status = 'pending'\` expires after 1h back to \`'free'\`.

Re-requesting audit.`
    },
    {
      type: "exchange", role: "claude", skill: "code-auditor",
      content:
`Re-running. Both items resolved, no regressions.

\`\`\`
 overall grade   A (95/100)
 gate            PASS
\`\`\`

Ship it.`,
      artifacts: ["audit-report"],
    },

    { type: "beat", label: "04 · Go-live", caption: "feature flag flipped", skills: ["integrations-engineer"] },

    {
      type: "exchange", role: "claude", skill: "integrations-engineer",
      content:
`PR merged into main. CI ran the full suite; green.

**Launch plan for Friday:**
1. 10:00 — flip \`FLAG_STRIPE_LIVE\` on for 5% of accounts (internal team + 3 friendly users).
2. 14:00 — if zero webhook failures + zero support tickets, roll to 100%.
3. Monitoring: Stripe's webhook dashboard + your error tracker's \`lib/billing/*\` scope.
4. Rollback: flip the flag off. Existing subscriptions keep running — they're server-side in Stripe.

integrations-engineer checkpoint closed. You're shipped.`,
      artifacts: ["launch-plan"],
    },
  ],
};

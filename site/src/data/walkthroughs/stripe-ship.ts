import type { Walkthrough } from "./types";

/**
 * Scenario 4 — integrations-engineer runs its 5-phase integration protocol
 * and code-auditor gates the PR. Demonstrates the side-chain pattern
 * (integration skill + audit gate) that isn't on the main spine.
 */
export const stripeShip: Walkthrough = {
  id: "stripe-ship",
  title: "Ship Stripe subscriptions by Friday",
  summary:
    "A founder wants Stripe subscriptions in a live Next.js app by end of week. integrations-engineer runs the 5-phase integration protocol; code-auditor gates the PR before merge.",
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

Writing \`.checkpoints/integrations-engineer.checkpoint.json\` with the contract. \`/approve\` to proceed to Phase 3 scaffolding.`
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

\`FLAG_STRIPE_LIVE\` defaulting to **off** in \`.env\`; **on** in staging. Handing to **code-auditor** for the gate.`
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

Ship it.`
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

integrations-engineer checkpoint closed. You're shipped.`
    },
  ],
};

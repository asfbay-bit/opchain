import type { Walkthrough } from "./types";

/**
 * Scenario 4 — oc-integrations-engineer runs its 5-phase integration protocol
 * and oc-code-auditor gates the PR. Demonstrates the side-chain pattern
 * (integration skill + audit gate) that isn't on the main spine.
 */
export const stripeShip: Walkthrough = {
  id: "stripe-ship",
  title: "Ship Stripe subscriptions by Friday",
  tagline: "Stripe subscriptions by Friday",
  summary:
    "Two tiers, per-seat billing, webhook signatures, audit gate — five days, one session.",
  description:
    "A live Next.js app needs Stripe subscriptions by Friday: two tiers (Pro $19, Team $49), per-seat billing on Team. The founder has never wired Stripe before and doesn't want to break production. oc-integrations-engineer runs its 5-phase protocol — recon, contract, scaffolding, live wiring, proof — building a mock-first boundary layer before a single real key touches the codebase. oc-code-auditor gates the PR with a money-flow supplementary pass; a feature flag rolls the integration to 5% on launch day and 100% once webhooks hold steady.",
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

**Produced by** oc-integrations-engineer Phase 2 (Contract) · **Reviewed by** oc-code-auditor · **API version target** \`2024-11-20.acacia\` · **SDK** \`stripe@17.x\`

## 1. Purpose

Turn a \`Team\` (Team tier) or \`User\` (Pro tier) into a Stripe Subscription; keep seat count synced; surface billing state to the app. Operate behind a feature flag so the integration can be flipped on/off without a code deploy.

## 2. Tier definitions

| Tier | Subject | Stripe Price | Quantity |
|---|---|---|---|
| Pro | a single \`User\` | \`PRICE_PRO\` ($19/mo) | 1 |
| Team | a \`Team\` (with N members) | \`PRICE_TEAM\` ($49/mo, per-seat) | \`Team.members.length\` |

Tier is determined at Checkout creation; never changed without a tier-swap flow (out of scope for v1).

## 3. Inputs → Stripe

### 3.1 \`POST /api/billing/checkout\`

Authenticated; rate-limited at 5/min/user. Body:

\`\`\`json
{ "tier": "pro" | "team" }
\`\`\`

The handler creates a \`checkout.sessions\` with:

| Field | Value |
|---|---|
| \`mode\` | \`"subscription"\` |
| \`customer\` | existing \`stripe_customer_id\` if present, else create new |
| \`customer_email\` | (when creating) the authenticated user's email |
| \`line_items[0].price\` | \`PRICE_PRO\` or \`PRICE_TEAM\` |
| \`line_items[0].quantity\` | 1 (Pro) or \`Team.members.length\` (Team) |
| \`metadata.source\` | \`"heads-down-app"\` |
| \`metadata.owner_type\` | \`"User"\` or \`"Team"\` |
| \`metadata.owner_id\` | the User or Team id |
| \`success_url\` | \`https://oc-app.headsdown.app/billing/success?session_id={CHECKOUT_SESSION_ID}\` |
| \`cancel_url\` | \`https://oc-app.headsdown.app/billing\` |
| \`subscription_data.metadata\` | mirrored from session metadata |
| \`client_reference_id\` | \`{owner_type}:{owner_id}\` |
| \`expires_at\` | now + 30 minutes |

### 3.2 \`POST /api/billing/portal\`

Creates a Stripe Customer Portal session for the user's customer; returns the URL for redirect. No special inputs.

## 4. Outputs from Stripe (webhooks)

All via \`POST /api/billing/webhook\` — raw body, signature-verified, IP-allow-listed against Stripe's published CIDR block.

| Event | Handler | Side effect |
|---|---|---|
| \`checkout.session.completed\` | \`checkout-completed.ts\` | Flip \`billing_status\` pending → active; store subscription id |
| \`customer.subscription.updated\` | \`subscription-updated.ts\` | Update \`current_period_end\`; reconcile seat count |
| \`customer.subscription.deleted\` | \`subscription-deleted.ts\` | Flip \`billing_status\` → canceled; UI gates writes |
| \`invoice.payment_succeeded\` | \`invoice-payment-succeeded.ts\` | Update \`current_period_end\`; clear past-due if set |
| \`invoice.payment_failed\` | \`invoice-payment-failed.ts\` | Flip \`billing_status\` → past_due; show retry CTA |
| \`customer.updated\` | \`customer-updated.ts\` | Mirror email + default payment method |

Any other event type is logged + dropped (no error); we explicitly subscribe only to the events above.

## 5. Invariants (MUST hold)

1. **One active subscription per \`Team\` (Team tier) or \`User\` (Pro tier).** Duplicate checkout sessions fail at webhook ingestion with a 409 log line; the prior subscription is canceled before the new one activates.
2. **Seat-count changes reflect in Stripe within 60s.** Reconciliation runs via \`subscription_items\` quantity update, not \`replace_all\`.
3. **Webhook events are idempotent.** \`StripeEvent.stripe_event_id\` has a unique index; replays are no-ops with deterministic logging.
4. **Failed payment blocks writes.** \`billing_status === 'past_due'\` gates any mutation in the UI; reads still work, exports still work, write paths return \`402 Payment Required\` with a portal redirect.
5. **No client-side use of \`STRIPE_SECRET\`.** Only \`STRIPE_PUBLIC\` reaches the bundle; verified by bundle-inspection step in CI.
6. **No event handler runs synchronously inside the request lifecycle longer than 800ms.** Long fan-outs (e.g., re-emailing all team members) enqueue a background task and ack the webhook.

## 6. New tables

### 6.1 \`StripeEvent\` — idempotency ledger

\`\`\`prisma
model StripeEvent {
  id              String   @id @default(cuid())
  stripeEventId   String   @unique
  type            String
  receivedAt      DateTime
  processedAt     DateTime?
  rawPayload      String   // JSON string — full event for forensics
  ownerType       String?  // resolved during processing
  ownerId         String?
  errorMessage    String?  // null on success
  attemptCount    Int      @default(1)

  @@index([type, receivedAt])
  @@index([processedAt])
}
\`\`\`

Retention: 18 months (SOC2-friendly), then archive to S3.

### 6.2 \`BillingStatus\` — denormalized for fast reads

\`\`\`prisma
model BillingStatus {
  ownerType        String   // "User" or "Team"
  ownerId          String
  stripeCustomerId String?
  stripeSubId      String?
  status           String   // "free" | "pending" | "active" | "past_due" | "canceled"
  plan             String?  // "pro" | "team"
  seats            Int?     // null for Pro
  currentPeriodEnd DateTime?
  updatedAt        DateTime @updatedAt

  @@id([ownerType, ownerId])
  @@index([stripeCustomerId])
  @@index([stripeSubId])
}
\`\`\`

UI reads exclusively from \`BillingStatus\` (never from Stripe at request time).

## 7. Feature flag

\`FLAG_STRIPE_LIVE\` — when **off**, everything runs against Stripe test mode with the fixture clock. When **on**, live keys + live charges. Defaults to off in \`.env.production\` until launch day.

KV-backed via Cloudflare Workers KV; flip propagates in ≤ 10s edge-wide.

## 8. Failure modes (catalog)

| # | Scenario | Detection | Recovery |
|---|---|---|---|
| F1 | Webhook arrives before user's browser returns from Checkout | sequencing | \`billing_status\` is \`pending\` during Checkout creation; flips \`active\` on webhook arrival; UI reads from BillingStatus, not query params. |
| F2 | User closes tab mid-Checkout | Stripe Session expires; no webhook arrives | \`billing_status\` stays \`pending\` for 1h, then reconciler flips back to \`free\`. |
| F3 | Network partition during webhook retry | Stripe retries up to 3 days | Idempotency ledger ensures replay safety; processed events are no-ops. |
| F4 | Stripe outage during \`checkout.sessions.create\` | API call fails | UI surfaces "billing temporarily unavailable; try again in a few minutes." Endpoint returns 503. |
| F5 | Webhook handler errors mid-execution | \`StripeEvent.errorMessage\` set | Stripe retries; idempotency ledger short-circuits replays of successfully-processed earlier attempts. |
| F6 | Seat reconciliation fails (Team tier) | Slack alert from \`subscription-updated\` handler | Manual sync via admin tool; backfill from \`Team.members.length\` |
| F7 | Card declined on renewal | \`invoice.payment_failed\` | UI gates writes via 402; portal CTA on every mutation page; team admins receive Slack DM if integrated. |
| F8 | Customer Portal session expired | redirect to \`/billing\` | UI re-creates a portal session on demand. |

## 9. Out of scope (v1)

- **Refunds** — handled manually via Stripe dashboard; documented in the launch plan, not silently missing.
- **Proration on tier swap** — no tier-swap flow in v1 (forces cancel + re-checkout).
- **Annual billing** — monthly only.
- **Coupon codes** — possibly v1.5.
- **Tax (Stripe Tax)** — relies on customer's billing address; out of scope for v1 (US-only beta).
- **Multiple currencies** — USD only.

## 10. Security considerations

- Webhook signature verified using \`stripe.webhooks.constructEvent\` against the raw request body. Body is read with \`req.text()\` before any JSON parse.
- IP allow-list in addition to HMAC (defence in depth).
- \`STRIPE_SECRET\`, \`STRIPE_WEBHOOK_SECRET\` only in env; never logged, never in client bundle.
- Customer Portal redirects use signed short-lived tokens; success URLs tokenised to prevent fixation.

Checkpoint: \`.checkpoints/oc-integrations-engineer.checkpoint.json\` (Phase 2).`,
    },
    {
      id: "boundary-layer",
      label: "Boundary layer (mocked, then live)",
      kind: "code.md",
      body:
`# Boundary Layer — \`lib/billing/\`

**Principle:** the rest of the app never imports \`stripe\` directly. Everything goes through \`lib/billing/client.ts\`. Mock the boundary, test everything else in isolation.

## 1. File tree

\`\`\`
lib/billing/
├─ client.ts                       // thin Stripe wrapper; only call site in the app
├─ checkout.ts                     // createCheckoutSession(ownerType, ownerId, tier)
├─ portal.ts                       // createPortalSession(stripeCustomerId)
├─ webhook.ts                      // verifyAndDispatch(req) → routes to handlers
├─ handlers/
│   ├─ checkout-completed.ts
│   ├─ subscription-updated.ts
│   ├─ subscription-deleted.ts
│   ├─ invoice-payment-succeeded.ts
│   ├─ invoice-payment-failed.ts
│   ├─ customer-updated.ts
│   └─ index.ts                    // type-safe handler map
├─ seat-sync.ts                    // reconcile Team.members.length → subscription_item.quantity
├─ billing-gate.ts                 // middleware that returns 402 when past_due
├─ types.ts                        // shared TS types mirroring the contract
├─ errors.ts                       // typed errors (BillingError, IdempotentReplay)
└─ __mocks__/                      // fixture responses keyed by scenario
    ├─ checkout-session-completed.json
    ├─ subscription-updated-seats-up.json
    ├─ subscription-updated-seats-down.json
    ├─ subscription-deleted.json
    ├─ invoice-payment-succeeded.json
    ├─ invoice-payment-failed.json
    └─ customer-updated.json
\`\`\`

## 2. \`client.ts\`

\`\`\`ts
import Stripe from "stripe";

export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET;
  if (!key) throw new Error("STRIPE_SECRET unset");
  return new Stripe(key, {
    apiVersion: "2024-11-20.acacia",
    typescript: true,
    telemetry: false,
  });
}

export const MOCK_MODE = process.env.FLAG_STRIPE_LIVE !== "true";
\`\`\`

The lazy \`getStripe()\` rather than a module-load constant lets tests run without the env var set. \`MOCK_MODE\` is read at module load — we accept that flag flips require a redeploy in dev but propagate via KV in prod (see \`flag-readiness.ts\`).

## 3. \`webhook.ts\` — the critical path

\`\`\`ts
import { getStripe } from "./client";
import { handlers } from "./handlers";
import { db } from "@/lib/db";
import { isStripeIp } from "./ip-allowlist";

export async function verifyAndDispatch(req: Request): Promise<Response> {
  // Defence-in-depth: verify origin IP first.
  const fwd = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "";
  if (!isStripeIp(fwd)) return new Response("forbidden", { status: 403 });

  // Stripe SDK verifies on raw body; we must not parse JSON first.
  const raw = await req.text();
  const sig = req.headers.get("stripe-signature") ?? "";
  const event = getStripe().webhooks.constructEvent(
    raw, sig, process.env.STRIPE_WEBHOOK_SECRET!
  );

  // Idempotency — ledger table with unique(stripe_event_id).
  const existing = await db.stripeEvent.findUnique({
    where: { stripeEventId: event.id }
  });
  if (existing?.processedAt) {
    // Duplicate replay; idempotent no-op.
    return new Response("ok", { status: 200 });
  }
  if (!existing) {
    await db.stripeEvent.create({
      data: {
        stripeEventId: event.id,
        type: event.type,
        rawPayload: raw,
        receivedAt: new Date(),
      },
    });
  }

  const handler = handlers[event.type as keyof typeof handlers];
  if (!handler) {
    // Subscribed event we don't care about; ack so Stripe doesn't retry.
    await db.stripeEvent.update({
      where: { stripeEventId: event.id },
      data: { processedAt: new Date() },
    });
    return new Response("ok", { status: 200 });
  }

  try {
    await handler(event);
    await db.stripeEvent.update({
      where: { stripeEventId: event.id },
      data: { processedAt: new Date() },
    });
    return new Response("ok", { status: 200 });
  } catch (err) {
    // Mark for retry; do not flip processedAt.
    await db.stripeEvent.update({
      where: { stripeEventId: event.id },
      data: {
        attemptCount: { increment: 1 },
        errorMessage: err instanceof Error ? err.message : String(err),
      },
    });
    // Return 500 so Stripe retries.
    return new Response("handler failed", { status: 500 });
  }
}
\`\`\`

## 4. Handler shape

\`\`\`ts
// lib/billing/handlers/checkout-completed.ts
import type Stripe from "stripe";
import { db } from "@/lib/db";

export async function checkoutCompleted(event: Stripe.Event) {
  const session = event.data.object as Stripe.Checkout.Session;
  const ownerType = session.metadata?.owner_type;
  const ownerId   = session.metadata?.owner_id;
  if (!ownerType || !ownerId) throw new Error("missing owner metadata");

  await db.billingStatus.upsert({
    where: { ownerType_ownerId: { ownerType, ownerId } },
    create: {
      ownerType, ownerId,
      stripeCustomerId: session.customer as string,
      stripeSubId: session.subscription as string,
      status: "active",
      plan: session.metadata?.tier,
      seats: session.metadata?.tier === "team" ? 1 : null,
      currentPeriodEnd: null, // populated by subscription.updated
    },
    update: {
      status: "active",
      stripeSubId: session.subscription as string,
    },
  });
}
\`\`\`

Every handler follows this shape: pull the owner from metadata, upsert BillingStatus, return.

## 5. \`billing-gate.ts\` — middleware

\`\`\`ts
import type { NextRequest } from "next/server";
import { db } from "@/lib/db";

export async function billingGate(req: NextRequest, ownerType: "User"|"Team", ownerId: string) {
  const status = await db.billingStatus.findUnique({
    where: { ownerType_ownerId: { ownerType, ownerId } },
  });
  if (!status) return null; // free tier
  if (status.status === "past_due") {
    return new Response(
      JSON.stringify({ error: "past_due", portal_url: "/api/billing/portal" }),
      { status: 402, headers: { "content-type": "application/json" } }
    );
  }
  return null;
}
\`\`\`

Mounted on every mutation route; reads stay open (we want users to see their own data even past-due).

## 6. \`seat-sync.ts\` — reconciliation

\`\`\`ts
import { getStripe } from "./client";
import { db } from "@/lib/db";

export async function syncSeats(teamId: string) {
  const team = await db.team.findUniqueOrThrow({
    where: { id: teamId },
    include: { members: true, billingStatus: true },
  });
  if (!team.billingStatus?.stripeSubId) return; // not paying

  const sub = await getStripe().subscriptions.retrieve(
    team.billingStatus.stripeSubId,
    { expand: ["items"] }
  );
  const item = sub.items.data[0];
  const wantQty = team.members.length;
  if (item.quantity === wantQty) return; // nothing to do

  await getStripe().subscriptionItems.update(item.id, {
    quantity: wantQty,
    proration_behavior: "create_prorations",
  });

  await db.billingStatus.update({
    where: { ownerType_ownerId: { ownerType: "Team", ownerId: teamId } },
    data: { seats: wantQty },
  });
}
\`\`\`

Invoked from member-add/remove flows + a 5-minute cron as a safety net.

## 7. Contract tests (22 passing)

| # | Test | Asserts |
|---|---|---|
| 1 | \`checkout-completed → BillingStatus exists\` | row created with \`status='active'\` |
| 2 | \`checkout-completed replay\` | second receive is no-op (idempotent) |
| 3 | \`subscription-updated seats up\` | seats field bumped |
| 4 | \`subscription-updated seats down\` | seats field decreased |
| 5 | \`subscription-deleted → canceled\` | \`status='canceled'\` |
| 6 | \`invoice.payment_failed → past_due\` | \`status='past_due'\` |
| 7 | \`invoice.payment_succeeded clears past_due\` | flips back to active |
| 8 | \`customer.updated mirrors email\` | denormalised email updated |
| 9 | webhook missing signature → 400 | |
| 10 | webhook non-Stripe IP → 403 | |
| 11 | webhook unknown event type → 200 (acked, dropped) | |
| 12 | handler throws → 500 + retry counter incremented | |
| 13 | seat-sync no-op when quantities match | |
| 14 | seat-sync uses \`subscription_items\`, not \`replace_all\` | API call introspected |
| 15 | billing-gate returns 402 when past_due | |
| 16 | billing-gate passes through when active | |
| 17 | abandoned checkout reconciler flips pending → free after 1h | clock-controlled test |
| 18 | tier-swap not allowed in v1 | API returns 422 |
| 19 | duplicate active subscription per owner returns 409 in webhook | |
| 20 | bundle inspection: \`STRIPE_SECRET\` not present | |
| 21 | log scrubber: \`STRIPE_SECRET\` redacted from any log line | |
| 22 | StripeEvent retention: rows older than 18 months marked \`archived\` | |

All tests run with \`MOCK_MODE = true\` and the Stripe fixture clock. Run time: **1.8 s** for the whole suite.

## 8. Why a boundary at all

Boundary discipline buys three things:

1. **Tests don't need the network.** Fixture-driven; deterministic.
2. **Future provider swap.** If we ever migrate to a different processor (Paddle, LemonSqueezy), only \`lib/billing/\` changes; the rest of the app reads \`BillingStatus\` rows.
3. **Audit surface is one directory.** oc-code-auditor's money-flow pass scans only \`lib/billing/**\`; nothing in \`app/**\` or \`components/**\` should import \`stripe\` (lint rule enforces).

## 9. Lint rule

\`\`\`json
{
  "rules": {
    "no-restricted-imports": ["error", {
      "paths": [{
        "name": "stripe",
        "message": "Import via lib/billing/* — do not call Stripe directly outside the boundary."
      }]
    }]
  },
  "overrides": [{
    "files": ["lib/billing/**"],
    "rules": { "no-restricted-imports": "off" }
  }]
}
\`\`\`

CI runs ESLint with this rule; any new direct \`import "stripe"\` outside the boundary fails the build.`,
    },
    {
      id: "audit-report",
      label: "oc-code-auditor report (money-flow pass)",
      kind: "audit.md",
      body:
`# Audit Report — Stripe Subscriptions

**Scope** \`lib/billing/**\` + routes + middleware + tests · **Runner** \`/oc-audit full\` + money-flow supplementary pass · **Gate** required before PR merge · **Auditor version** 1.2.0

## 1. Files inspected

| File | LoC | Notes |
|---|---:|---|
| \`lib/billing/client.ts\` | 28 | Stripe SDK init + MOCK_MODE flag. |
| \`lib/billing/checkout.ts\` | 84 | Checkout session create. |
| \`lib/billing/portal.ts\` | 36 | Customer portal session. |
| \`lib/billing/webhook.ts\` | 102 | Verify + dispatch + idempotency. |
| \`lib/billing/handlers/*.ts\` | 240 (6 files) | One per event type. |
| \`lib/billing/seat-sync.ts\` | 64 | Reconciliation. |
| \`lib/billing/billing-gate.ts\` | 32 | Past-due 402 middleware. |
| \`lib/billing/ip-allowlist.ts\` | 48 | Stripe CIDR check. |
| \`app/api/billing/checkout/route.ts\` | 41 | |
| \`app/api/billing/portal/route.ts\` | 28 | |
| \`app/api/billing/webhook/route.ts\` | 18 | thin wrapper around verifyAndDispatch. |
| \`prisma/schema.prisma\` | +44 | StripeEvent + BillingStatus tables. |
| \`prisma/migrations/*\` | +112 | 2 migrations. |
| \`tests/billing/*.test.ts\` | 612 (8 files) | 22 contract + 14 handler + 6 E2E. |

Total: **1,489 lines added**, 7 deleted, across **22 files**.

## 2. Security

- ✅ **Webhook endpoint verifies signature on raw body** (not parsed). Confirmed \`req.text()\` is read before any JSON parse; type-checked.
- ✅ **No secret leakage.** \`STRIPE_SECRET\` never logged (verified by grep on the diff); never reaches the client bundle (verified by bundle inspection — \`STRIPE_PUBLIC\` only in client output).
- ✅ **CSRF.** \`/api/billing/checkout\` requires an authenticated session + same-origin check (\`Origin\` header); no CSRF token needed because it's same-origin JSON.
- ✅ **No SSRF.** Webhook handler doesn't issue any outbound HTTP based on payload content.
- ✅ **Customer Portal redirects** use Stripe-signed short-lived URLs; we never construct portal URLs by hand.
- ⚠ **Rate-limit** on \`/api/billing/webhook\` is 60/min. Stripe can burst to 150/min during incident retries.
    **→ Recommendation:** raise to 300/min **or** switch to Stripe IP allow-list (preferred — see [Stripe docs](https://stripe.com/docs/webhooks#verify-ip)).
- ✅ **\`/api/billing/checkout\` rate-limit** at 5/min/user — adequate.
- ✅ **Webhook secret rotation procedure** documented in the runbook (rotate via Stripe dashboard → update \`STRIPE_WEBHOOK_SECRET\` env → no code change).

## 3. Correctness

- ✅ Handlers idempotent on \`stripe_event_id\` (unique index confirmed in migration).
- ✅ Seat-sync uses \`subscription_items.update\` (not \`replace_all\`) — verified by inspecting the SDK call. Doesn't clobber unrelated line items.
- ✅ Race between \`checkout.completed\` webhook and user closing tab: handled via \`billing_status = 'pending'\` → \`'active'\` transition.
- ✅ Race between two parallel webhook deliveries: idempotency ledger short-circuits the second; verified via concurrent fixture test.
- ✅ Race between seat-sync from cron and seat-sync from member-add: serialised on a row-level lock on \`Team\`; verified.
- ✅ \`subscription_items.update\` is called with \`proration_behavior: "create_prorations"\` — explicit, not Stripe-default.

## 4. Money flow (supplementary pass)

This is the extra-strict pass on the money path. Every claim is backed by a concrete check.

- ✅ **No proration path without explicit toggle.** \`billing_cycle_anchor\` is never set in any handler (grep confirmed); only \`subscription_items.update\` uses \`proration_behavior\` and it's explicit.
- ✅ \`subscription.deleted\` → \`billing_status = 'canceled'\`, never \`NULL\`. Absent status would fail open (we'd treat the user as paying); verified by route test that asserts BillingStatus.status is non-null after handler.
- ✅ \`invoice.payment_failed\` → \`billing_status = 'past_due'\`. UI gate in \`lib/billing/billing-gate.ts\` confirmed in route tests; mutation routes return 402 with portal CTA.
- ✅ \`invoice.payment_succeeded\` clears past_due if set. Verified by sequence test (\`payment_failed → past_due → payment_succeeded → active\`).
- ✅ **No refund path in scope.** Refund handling is deliberately out of v1 — documented in the contract, not silently missing. The launch plan documents the manual-via-dashboard procedure.
- ✅ **No double-charge surface.** F2 (user closes tab) leaves \`billing_status='pending'\`; the abandoned-checkout reconciler flips to \`free\` after 1h. No second checkout can race because rate-limit + UI gating.
- ✅ **No silent currency change.** USD-only enforced by Price configuration in Stripe; no client input controls currency.
- ✅ **Tax rounding consistency.** Stripe handles tax computation; we never round in our code path.

## 5. Performance

- ✅ Webhook handler p99: **86 ms** in staging benchmarking (well under the 800ms invariant).
- ✅ Customer Portal redirect p99: **142 ms** (Stripe API round-trip).
- ✅ \`BillingStatus\` reads are indexed on PK \`(ownerType, ownerId)\`; no full scans.
- ✅ Seat-sync 95th percentile: **310 ms** end-to-end (read DB + Stripe API + write DB).

## 6. Style

- ✅ ESLint clean.
- ✅ Prettier clean.
- ✅ TypeScript strict; no \`any\` in the diff.
- ✅ No \`@ts-ignore\` / \`@ts-expect-error\`.
- ✅ The \`no-restricted-imports\` rule for \`stripe\` outside \`lib/billing/\` is in the lint config and CI-gated.

## 7. Tests

- ✅ **22 contract tests + 14 handler tests + 6 E2E** in Stripe **test mode** with the fixture clock. All green.
- ✅ Fixture clock used — deterministic. No sleeps, no retries-that-hide-bugs.
- ✅ Coverage: 96% line, 91% branch on the billing diff.
- ⚠ **Missing coverage.** No test for "user closes tab mid-Checkout, returns next day." Absent, we can't prove we don't double-charge.
    **→ Recommendation:** add \`abandoned-checkout-recovery.e2e.ts\` covering the 1-hour timeout → \`free\` fallback.

## 8. Operability

- ✅ Structured logs on every webhook (event type, owner, duration, idempotent-replay flag).
- ✅ Sentry breadcrumbs on each handler.
- ✅ Slack alert on \`StripeEvent.attemptCount > 3\` for any single event.
- ✅ Slack alert on \`billing_status='past_due'\` for any team with > 3 members (high-impact).
- ✅ Documented runbook for the launch (separate artifact).
- ✅ Rollback procedure: flip \`FLAG_STRIPE_LIVE\` off; existing subs continue billing in Stripe.

## 9. Overall (initial gate)

\`\`\`
 grade           A− (91/100)
 gate            CONDITIONAL PASS
 action items    1. webhook rate-limit (see §2)
                 2. abandoned-checkout E2E test (see §7)
\`\`\`

## 10. Re-audit after fixes

After fixes applied:

\`\`\`
 grade           A (95/100)
 gate            PASS
\`\`\`

- Webhook endpoint now uses Stripe IP allow-list (\`X-Forwarded-For\` validated against published CIDR block). Rate-limiter removed; Stripe's own backoff handles burst.
- \`abandoned-checkout-recovery.e2e.ts\` added. Simulates user closing tab between Checkout redirect and webhook arrival; asserts no duplicate charge, asserts \`billing_status = 'pending'\` expires after 1h back to \`'free'\`.

## 11. Auditor sign-off

- **Auditor:** oc-code-auditor v1.2.0
- **Mode:** \`/oc-audit full\` + money-flow supplementary pass
- **Run-time:** 6 m 18 s end-to-end (lint + typecheck + tests + grep gates + EXPLAIN benchmarks).
- **Gate verdict:** PASS — oc-git-ops may merge.
- **Re-audit recommended:** before any future change to the webhook ingestion pipeline or to the IP allow-list.

Checkpoint: \`.checkpoints/oc-code-auditor.checkpoint.json\`.`,
    },
    {
      id: "launch-plan",
      label: "Friday launch plan + rollback",
      kind: "runbook",
      body:
`# Launch Plan — Stripe Go-Live

**Target window** Friday · **Owner** oc-integrations-engineer checkpoint · **Rollback** ≤ 60 s via feature flag · **Last drill** Thursday afternoon

## 1. Pre-flight (Thursday evening)

- [x] All 22 contract tests + 14 handler tests + 7 E2E green on main
- [x] Audit gate: A (95/100), PASS (separate artifact)
- [x] Staging has been running on live Stripe keys for **3 days** with 0 webhook failures
- [x] \`.env.production\` has \`FLAG_STRIPE_LIVE=false\` (we'll flip manually)
- [x] Cloudflare KV flag flip tested (propagates ≤ 10s)
- [x] Stripe webhook dashboard bookmarked + PagerDuty rules added
- [x] Customer Portal branding + colours configured in Stripe dashboard
- [x] Refund procedure documented (manual via dashboard; out of v1 code)
- [x] Test purchases on staging:
  - Pro tier with valid Visa
  - Team tier with valid Visa
  - Pro tier with declined card (4000 0000 0000 0002)
  - Team tier with insufficient funds card
  - Add member → seat-sync upticks
  - Remove member → seat-sync downticks
  - Cancel via portal → status → canceled

## 2. Go-live sequence (Friday)

### 2.1 09:30 — All hands ready

- Founder online, headphones in, slack open.
- On-call engineer online (today: founder; secondary: <name>).
- War room channel \`#go-live-stripe\` opened.

### 2.2 09:45 — Final smoke

\`\`\`bash
curl -fsS https://oc-app.headsdown.app/api/health | jq '.version'
# expect HEAD SHA on main
curl -fsS https://oc-app.headsdown.app/api/version
# expect HEAD SHA
\`\`\`

### 2.3 10:00 — Flip flag for 5% of accounts (internal + 3 friendly)

Enable \`FLAG_STRIPE_LIVE\` for accounts in the internal-team + 3-friendly-user list (hardcoded allowlist on the flag).

\`\`\`bash
wrangler kv:key put --binding=FLAGS FLAG_STRIPE_LIVE_ALLOWLIST \\
  '["user_internal1","user_internal2","user_internal3","user_friendly1","user_friendly2","user_friendly3"]'
wrangler kv:key put --binding=FLAGS FLAG_STRIPE_LIVE true
\`\`\`

### 2.4 10:00 → 11:00 — Watch for 60 minutes

| Signal | Where | Threshold |
|---|---|---|
| \`POST /api/billing/checkout\` request rate | Stripe dashboard + Cloudflare logs | matches expected ramp |
| Webhook event arrivals | Stripe dashboard | ~1 per action, within 2s |
| Webhook handler errors | Sentry, scoped to \`lib/billing/*\` | 0 |
| Handler p99 latency | Cloudflare Workers analytics | < 200 ms |
| BillingStatus row creation cadence | Postgres query every 5 min | matches checkout count |
| Customer support inbox | Linear + email | 0 billing-related tickets |

### 2.5 11:00 — Go/no-go decision

Go criteria (all required):

- [ ] 0 webhook signature failures
- [ ] 0 handler errors in \`lib/billing/*\`
- [ ] All test purchases flow: Checkout → \`billing_status = active\` within 5s
- [ ] Seat-sync on add/remove teammate works end-to-end
- [ ] Support inbox: 0 billing-related tickets
- [ ] No 5xx anywhere on \`/api/billing/*\`

No-go → rollback (§4). Go → continue.

### 2.6 11:00 → 14:00 — Hold at 5%

Three hours at 5% lets us watch a full UTC business cycle and catch any timing-sensitive bugs.

### 2.7 14:00 — Flip to 100%

\`\`\`bash
wrangler kv:key delete --binding=FLAGS FLAG_STRIPE_LIVE_ALLOWLIST
# Now FLAG_STRIPE_LIVE applies to everyone.
\`\`\`

### 2.8 14:00 → next morning — Watch for 24 hours

| Signal | Where | Threshold |
|---|---|---|
| Webhook event rate | Stripe dashboard | within 20% of expected |
| \`billing_status\` distribution | Postgres query every hour | pending count tiny; persistent pending is a red flag |
| Failed-payment rate | Stripe dashboard | near-zero in first week (new customers have fresh cards) |
| Sentry billing scope errors | Sentry | 0 |
| Linear billing tag | Linear search | < 3 in first 24h |

## 3. Communication

| Time | Channel | What |
|---|---|---|
| Thursday evening | \`#announcements\` | "Stripe goes live tomorrow at 10:00 PT, ramped 5% → 100% over 4 hours" |
| Friday 09:50 | \`#go-live-stripe\` | "Going live in 10 minutes" |
| Friday 10:00 | status page | "New: paid plans now available (rolling out gradually today)" |
| Friday 11:00 | \`#go-live-stripe\` | "5% smoke clean — holding to 14:00" |
| Friday 14:00 | \`#announcements\` + status page | "Paid plans are live for everyone" |
| Friday 17:00 | \`#go-live-stripe\` | "End-of-day check-in" |
| Monday 10:00 | \`#announcements\` | post-launch review summary |

## 4. Rollback (≤ 60 s)

\`\`\`bash
# Flip the flag off — existing subscriptions keep running in Stripe;
# the app stops creating new ones.
wrangler kv:key put --binding=FLAGS FLAG_STRIPE_LIVE false --preview false
wrangler kv:key put --binding=FLAGS FLAG_STRIPE_LIVE false
\`\`\`

Propagation: ≤ 10 s edge-wide.

### 4.1 What still works after rollback

- **Existing subscribers** — Stripe keeps billing them. Our app continues to read BillingStatus as stamped.
- **Seat-sync for existing subscribers** — handler still runs on webhooks.
- **Pause/cancel** — users can still downgrade via the Customer Portal.

### 4.2 What stops working

- **New Checkout sessions** — \`/api/billing/checkout\` returns 503 with "temporarily unavailable; please try again in a few minutes" message.
- **Customer Portal** — disabled when flag is off (graceful "billing service is being updated").

### 4.3 If rollback isn't enough

If the issue is in the webhook handler (rather than the flag-gated UI), additional mitigations:

1. Pause webhook delivery in the Stripe dashboard (won't lose events; Stripe retries for 3 days).
2. Switch \`STRIPE_WEBHOOK_SECRET\` to a known-bad value (forces 401 on incoming webhooks; events queue at Stripe).
3. Manually edit \`BillingStatus\` rows for impacted users via a one-shot script.

## 5. Post-launch review (Monday)

- Webhook volume vs. expected
- Top 5 slowest handler executions
- Any \`stripeEventId\` collisions (should be zero)
- Customer feedback on Checkout UX (NPS micro-survey on success page)
- Conversion funnel: Pricing page → Checkout opened → Checkout completed
- Plan distribution: Pro vs. Team
- Average team size at Team-tier subscription time
- Any past-due triggers (should be zero in first week)

## 6. SLO targets (steady state, post-launch)

| SLI | Window | Target |
|---|---|---|
| \`/api/billing/checkout\` 2xx rate | 28d rolling | ≥ 99.95% |
| \`/api/billing/webhook\` 2xx rate | 28d rolling | ≥ 99.99% (Stripe retries cover blips) |
| Webhook → BillingStatus update latency | p99 | ≤ 5 s |
| Seat-sync end-to-end | p99 | ≤ 60 s |
| Past-due → portal CTA visible | p99 | ≤ 30 s |

## 7. Forward roadmap (out of v1, queued)

- Annual billing (10% discount).
- Coupon codes (\`/coupons/<code>\` lands on Pricing with discount applied).
- Stripe Tax (auto-collect VAT/GST when the EU/UK launch happens).
- Refund-via-portal (currently dashboard-only).
- Tier-swap in-app (currently requires cancel + re-checkout).

Checkpoint: \`.checkpoints/oc-integrations-engineer.checkpoint.json\` closes with the go-live timestamp + the post-launch metrics snapshot.`,
    },
  ],
  skills: ["oc-integrations-engineer", "oc-code-auditor"],
  runtime: "≈ 13 exchanges",
  steps: [
    { type: "beat", label: "01 · Brief", caption: "oc-integrations-engineer sizes the job", skills: ["oc-integrations-engineer"] },

    {
      type: "exchange", role: "user",
      content:
`I need Stripe subscriptions in my Next.js app by Friday. Two tiers (Pro $19/mo, Team $49/mo), per-seat billing on the Team tier. App is live, Prisma on Postgres. I've never wired Stripe before.

Don't break the app.`
    },
    {
      type: "exchange", role: "claude", skill: "oc-integrations-engineer",
      content:
`Invoking **oc-integrations-engineer** with its 5-phase protocol:

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
      type: "exchange", role: "claude", skill: "oc-integrations-engineer",
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

Writing \`.checkpoints/oc-integrations-engineer.checkpoint.json\` with the contract. \`/approve\` to proceed to Phase 3 scaffolding.`,
      artifacts: ["integration-contract"],
    },
    {
      type: "exchange", role: "user",
      content: "/approve"
    },

    { type: "beat", label: "02 · Scaffold + wire", caption: "boundary layer first, live keys last", skills: ["oc-integrations-engineer"] },

    {
      type: "exchange", role: "claude", skill: "oc-integrations-engineer",
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

\`FLAG_STRIPE_LIVE\` defaulting to **off** in \`.env\`; **on** in staging. Handing to **oc-code-auditor** for the gate.`,
      artifacts: ["boundary-layer"],
    },

    { type: "beat", label: "03 · Audit gate", caption: "oc-code-auditor before merge", skills: ["oc-code-auditor"] },

    {
      type: "exchange", role: "claude", skill: "oc-code-auditor",
      content:
`Invoked by oc-integrations-engineer on a Stripe integration — running \`/oc-audit full\` with the **money-flow supplementary pass** (extra scrutiny on auth, webhook signatures, idempotency).

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

Writing \`.checkpoints/oc-code-auditor.checkpoint.json\`. **Gate: CONDITIONAL PASS** until those two are addressed.`
    },
    {
      type: "exchange", role: "user",
      content: "Fix both and re-audit."
    },
    {
      type: "exchange", role: "claude", skill: "oc-integrations-engineer",
      content:
`Patching:

1. Swapping webhook rate limit for Stripe's IP allow-list (\`lib/billing/webhook.ts\` now checks \`X-Forwarded-For\` against the documented CIDR block; rate-limiter removed).
2. Added \`abandoned-checkout-recovery.e2e.ts\` — simulates user closing tab between Checkout redirect and webhook arrival; asserts no duplicate charge, asserts \`billing_status = 'pending'\` expires after 1h back to \`'free'\`.

Re-requesting audit.`
    },
    {
      type: "exchange", role: "claude", skill: "oc-code-auditor",
      content:
`Re-running. Both items resolved, no regressions.

\`\`\`
 overall grade   A (95/100)
 gate            PASS
\`\`\`

Ship it.`,
      artifacts: ["audit-report"],
    },

    { type: "beat", label: "04 · Go-live", caption: "feature flag flipped", skills: ["oc-integrations-engineer"] },

    {
      type: "exchange", role: "claude", skill: "oc-integrations-engineer",
      content:
`PR merged into main. CI ran the full suite; green.

**Launch plan for Friday:**
1. 10:00 — flip \`FLAG_STRIPE_LIVE\` on for 5% of accounts (internal team + 3 friendly users).
2. 14:00 — if zero webhook failures + zero support tickets, roll to 100%.
3. Monitoring: Stripe's webhook dashboard + your error tracker's \`lib/billing/*\` scope.
4. Rollback: flip the flag off. Existing subscriptions keep running — they're server-side in Stripe.

oc-integrations-engineer checkpoint closed. You're shipped.`,
      artifacts: ["launch-plan"],
    },
  ],
};

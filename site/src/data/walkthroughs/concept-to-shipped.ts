import type { Walkthrough } from "./types";

/**
 * Scenario 1 — full oc-app-architect pipeline.
 * Covers: oc-app-architect hub, auto-invoke of oc-stack-forge + oc-ux-engineer,
 * the Generator/Evaluator build loop, and the ship handoff through
 * oc-git-ops → oc-deploy-ops.
 */
export const conceptToShipped: Walkthrough = {
  id: "concept-to-shipped",
  title: "Concept → shipped, in one chat",
  tagline: "Idea → deployed, one chat",
  summary:
    "A solo founder types an idea and walks out with a live app — nothing cherry-picked.",
  description:
    "Heads Down is an idea in the founder's head at 10am. By 2pm it's a production Cloudflare Worker, six PRs merged, 94 passing tests, and a staging URL her co-founder can poke at. oc-app-architect runs the full pipeline — discovery interview, spec, design, sprint plan, Generator/Evaluator build loop — auto-invoking oc-stack-forge for the tech stack and oc-ux-engineer for the style book, then handing off to oc-git-ops and oc-deploy-ops to ship. No API keys. No SaaS. Every phase has a checkpoint the founder can rewind to.",
  inputs: [
    "One-sentence product idea",
    "No existing code · no stack decision · no design system",
    "No CI/CD · no cloud account picked",
    "A few preferences (mobile-first, self-serve signup, Slack someday)",
  ],
  outputs: [
    {
      id: "master-spec",
      label: "Master spec (18 pages, export-ready)",
      kind: "spec.md",
      body:
`# Heads Down — Master Spec

**Version** 1.0.0 · **Owner** oc-app-architect checkpoint · **Status** Phase 7 complete · **Last updated** 2026-04-12

> **Reading guide.** Sections 1–3 are the elevator pitch. Sections 4–7 cover product surface area (personas, flows, screens). Sections 8–11 cover engineering surface (data, APIs, permissions, push). Sections 12–17 cover the qualities the system must hold (a11y, perf, security, observability, telemetry, success). Sections 18–22 are the operational scaffolding (risks, non-goals, glossary, change log, checkpoints).

## 1. TL;DR

Heads Down is a team pomodoro tracker. ICs start focus blocks of 15/25/45/60 minutes; teammates see who's heads-down on a shared board. Browser push nudges at block end. **Server is the source of truth for timers** — closing a tab doesn't stop a session. Free with a 50-team soft cap.

The product exists because remote teams have lost the ambient signal of "who is in deep work right now." Slack status is too high-friction; calendar holds are too coarse. Heads Down replaces both with a one-tap focus block that anyone can see on a single shared board.

## 2. Outcome the product is hired for

> "I want my teammates to see I'm in deep work without me having to type a status, and I want a gentle nudge to break together when the block ends."

Two adjacent jobs we're explicitly **not** hiring for:
- **Time-tracking for billing.** Heads Down is signal, not ledger. We do not export hours.
- **Productivity surveillance.** Team leads cannot see historical focus minutes per IC. The board is *now* only.

## 3. Success metrics (90-day)

| Metric | Target | Source |
|---|---|---|
| Activation rate (signup → first session within 24h) | ≥ 55% | events: \`signup\`, \`session.started\` |
| Day-7 retention (users who start at least one session) | ≥ 35% | events: \`session.started\` |
| Median sessions per active user per week | ≥ 6 | aggregated over 7d |
| Team adoption (teams with ≥ 3 active users) | ≥ 60% of paid teams | aggregate over teams |
| Push opt-in rate (when prompted) | ≥ 45% | event: \`push.permission.granted\` |
| Time-to-first-session (signup → first start) | p50 ≤ 90s | session.started − user.created_at |

## 4. Personas

### 4.1 The IC (primary, ~85% of MAU)

- Software engineers, designers, writers — anyone whose day breaks down into deep-work blocks.
- 22–48 years old, distributed across NA + EU + APAC. Mobile 30% of the time (commute, between meetings).
- Pain we relieve: Slack status fatigue, calendar overhead for "do not disturb."
- What they value: one tap to start, server-authoritative timer (so closing the tab to focus doesn't reset), zero noise on the board when they're not working.

### 4.2 The Team Lead (secondary, ~12% of MAU)

- Read-only board view in v1. No admin tools, no historical exports, no per-user analytics.
- Why they matter anyway: they are the buyer in the eventual paid tier. We design the board to be glanceable for them too — no IC-only affordances on the home view.

### 4.3 The Office Manager (anti-persona)

- We say "no" to: rolled-up productivity reports, manager dashboards, individual focus-time leaderboards. These are excluded by design (see §22 non-goals) because they would invert the trust model the IC depends on.

## 5. Core user flows

| Flow | Entry | Steps | Exit |
|---|---|---|---|
| Signup | landing → "Start your team" | email → magic link → name your team → invite teammates (optional) | team board |
| Join existing team | invite link | accept → magic link → onboard | team board |
| Start a session | board → "Focus" button | duration picker (15/25/45/60) → optional intent text | in-progress view |
| Watch teammates | board (default home) | polls every 30s; updates avatars without page reload | — |
| Receive nudge | browser push on session end | "break together" CTA → opens "/break" room | board |
| End early | in-progress view → "End now" | confirm → marks status=cancelled (counts toward stats) | board |
| Invite | settings → "Invite" | copy link or paste emails | invitation email queued |
| Leave team | settings → "Leave" | confirm | landing |

## 6. Screens

Eleven screens render in v1. Each has a wireframe in \`docs/design/wireframes/\` and a hi-fi mock in the team's Figma library.

| # | Screen | Route | Notes |
|---|---|---|---|
| 1 | Landing | \`/\` | Marketing copy + "Start a team" CTA. Server-rendered, no JS bundle on first paint. |
| 2 | Magic-link request | \`/auth/magic\` | Form posts to \`/api/auth/request\`. Renders "check your email" state. |
| 3 | Magic-link redeem | \`/auth/redeem?token=…\` | One-time token; sets session cookie; redirects to board. |
| 4 | Team board (home) | \`/board\` | Avatars + "in focus" state. Empty state when nobody is heads-down. |
| 5 | New session picker | \`/focus\` | 4 duration buttons + optional "what are you working on" input. |
| 6 | In-progress view | \`/focus/:sessionId\` | Live countdown. Timer from server clock — drift-correcting every 5s. |
| 7 | Session ended | \`/focus/:sessionId/done\` | "Break together" prompt + return to board. |
| 8 | Settings | \`/settings\` | Profile, push permission status, leave team. |
| 9 | Invite | \`/settings/invite\` | Copy link, paste emails, see pending invites. |
| 10 | Billing stub | \`/billing\` | "You're on the free tier" + waitlist for paid. (No Stripe in v1.) |
| 11 | 404 | catch-all | Branded; preserves header + footer. |

PWA shell installs all 11 routes for offline-first navigation; the in-progress view is the only one that requires a live socket to the server (it does not require the *user's* socket — the timer ticks in the Durable Object regardless).

## 7. Information architecture

\`\`\`
Landing
└─ Auth
   └─ Board ─┬─ Focus picker ── In-progress ── Ended
             ├─ Settings ─── Invite
             └─ Billing
\`\`\`

Top nav: **Board · Settings**. No tabs inside Board (the empty state and active state share the same canvas). Footer: **Privacy · Terms · Contact** on every route.

## 8. Data model

\`\`\`
User           Team              Session          Membership      PushSubscription
─────          ────              ───────          ──────────      ────────────────
id PK          id PK             id PK            user_id FK      id PK
email UQ       slug UQ           user_id FK       team_id FK      user_id FK
team_id FK     name              duration_sec     role            endpoint
display_name   created_at        started_at       joined_at       p256dh key
created_at                       ends_at                          auth key
last_seen_at                     ended_at                         created_at
                                 status
                                 intent_text
                                 cancelled_reason
\`\`\`

### 8.1 Field-level constraints

| Table | Field | Constraint |
|---|---|---|
| User | email | unique, lowercased on insert, max 254 chars (RFC 5321) |
| User | display_name | 1–48 chars, allows unicode, trimmed |
| Team | slug | \`/^[a-z0-9-]{3,32}$/\`, generated, never user-input |
| Team | name | 1–64 chars |
| Session | duration_sec | enum: 900, 1500, 2700, 3600 |
| Session | status | enum: in_progress, ended, cancelled |
| Session | intent_text | optional, 0–140 chars |
| Membership | role | enum: member, lead |

### 8.2 Indexes

- \`User(team_id)\` — board query.
- \`Session(team_id, status, ends_at)\` — board query (in-progress only, ordered by remaining time).
- \`Session(user_id, started_at DESC)\` — user's recent history (settings).
- \`Membership(team_id, role)\` — admin lookups (tiny, but indexed for symmetry).
- \`PushSubscription(user_id)\` — fan-out at session end.

### 8.3 Migrations

D1 with Drizzle. All migrations forward-only; rollbacks happen by deploying a new schema-compatible migration. Six migrations land in v1:

1. \`0001_init\` — User, Team, Membership.
2. \`0002_session\` — Session table.
3. \`0003_push\` — PushSubscription.
4. \`0004_session_intent\` — adds \`intent_text\` (nullable).
5. \`0005_session_indexes\` — covering indexes.
6. \`0006_user_last_seen\` — adds \`last_seen_at\` (nullable, defaults now()).

## 9. API surface

All endpoints are JSON-over-HTTPS. Auth: signed session cookie (\`__Host-hd_sess\`, 30-day idle, rotates on privilege change). All responses include \`X-Request-Id\` for log correlation.

### 9.1 Auth

- \`POST /api/auth/request\` — body: \`{email}\`. Sends magic link. Returns 202 always (no enumeration). Rate-limit: 5/min/IP, 10/hour/email.
- \`GET /api/auth/redeem?token=…\` — exchanges token for session cookie. One-shot, 15-min TTL. On success, redirects to \`/board\`.
- \`POST /api/auth/logout\` — clears cookie, revokes session row.

### 9.2 Sessions

- \`POST /api/sessions/start\` — body: \`{duration_sec, intent_text?}\`. Creates session via Durable Object \`@team:{slug}\`. Returns \`{id, ends_at, server_now}\`. Errors: \`409 already_in_session\`, \`422 invalid_duration\`.
- \`POST /api/sessions/:id/end\` — marks \`status='ended'\`, fans out push to all teammates with valid subscriptions. Idempotent.
- \`POST /api/sessions/:id/cancel\` — body: \`{reason?}\`. Marks \`status='cancelled'\`. No fan-out.
- \`GET /api/sessions/:id\` — returns canonical session object (drift correction reads this every 5s).

### 9.3 Team / board

- \`GET /api/teams/:slug/board\` — returns \`{members: [{user_id, display_name, session?}]}\`. Cache-Control: \`max-age=30, stale-while-revalidate=60\`. The board polls this every 30s; SWR keeps the UI snappy on every network hop.
- \`GET /api/teams/:slug\` — team metadata.
- \`POST /api/teams/:slug/invite\` — body: \`{emails: string[]}\`. Sends invite emails, returns pending list.
- \`POST /api/teams/:slug/leave\` — current user leaves the team. If they are the last lead, promotes the longest-tenured member.

### 9.4 Push

- \`POST /api/push/subscribe\` — body: \`{endpoint, keys: {p256dh, auth}}\`. Idempotent on \`endpoint\`.
- \`DELETE /api/push/subscribe\` — removes the current subscription.

### 9.5 Health + observability

- \`GET /api/health\` — returns \`{ok: true, version, uptime_s}\`. Used by both manual smoke and the Cloudflare HTTP monitor.
- \`GET /api/version\` — public commit SHA (helps the support team correlate bug reports).

### 9.6 Error envelope

All non-2xx responses use a stable envelope:

\`\`\`json
{
  "error": "snake_case_machine_code",
  "message": "Human-readable string for the UI",
  "request_id": "01HK4..."
}
\`\`\`

The browser surfaces \`message\`; structured handlers branch on \`error\`.

## 10. Permissions

Two roles per team — **member** and **lead** — set on \`Membership.role\`. v1 has minimal lead-only behaviour (it's a forward-compat slot for v2's admin tools).

| Action | Member | Lead |
|---|---|---|
| Read team board | ✓ | ✓ |
| Start own session | ✓ | ✓ |
| Cancel own session | ✓ | ✓ |
| Invite | ✓ | ✓ |
| Remove a member | ✗ | ✓ (v2) |
| Rename team | ✗ | ✓ (v2) |
| Delete team | ✗ | ✓ (v2) |

Cross-team access is impossible by construction: every authenticated request has a single \`team_id\` claim derived from the session cookie; queries filter on it server-side. No client-side claim is trusted.

## 11. Push protocol

We use Web Push (VAPID) directly — no third-party (OneSignal etc.). Subscriptions are stored per-user with a soft-delete on 410 Gone responses from the push service.

### 11.1 Permission UX

The browser permission prompt fires on the user's first *Start session* tap, not on signup. This is mandatory on iOS (PWAs require a user gesture in the same task) and is also strictly better UX (we ask once we have evidence the user wants the feature).

### 11.2 Payload

\`\`\`json
{
  "type": "session_ended",
  "team_slug": "acme",
  "actor": {"name": "Alex", "avatar_letter": "A"},
  "url": "https://headsdown.app/break"
}
\`\`\`

The Service Worker renders a system notification with title "Alex finished a focus block" and a "Take a break together" action that opens the URL.

### 11.3 Failure handling

- 410 Gone → soft-delete the subscription.
- 413 Payload too large → log + drop (we should never send a payload large enough to trigger this; it's a safety net).
- 5xx from push service → exponential backoff up to 3 retries via Cloudflare Queues, then drop.

## 12. Accessibility

- Target: WCAG 2.2 AA on every screen.
- Focus order matches DOM order on every interactive screen.
- Live timer announces minute-boundary changes via \`aria-live="polite"\` (not every second — that would be deafening).
- \`prefers-reduced-motion\` disables the timer's circular progress animation; the numeric countdown remains.
- Color is never the sole signal of state — every "in focus" avatar has a visible ring + text label.
- Touch targets minimum 44×44 CSS px on mobile.
- All icons have either a visible label or an \`aria-label\`.

A nightly axe-core run gates merges; the Lighthouse CI budget pins accessibility ≥ 95.

## 13. Performance budget

| Metric | Budget | Strategy |
|---|---|---|
| Largest Contentful Paint (mobile) | ≤ 1.8 s | server-rendered HTML; critical CSS inline; no blocking JS in head. |
| First Input Delay | ≤ 80 ms | hydration deferred until idle; the timer is signal-only progressively enhanced. |
| Cumulative Layout Shift | ≤ 0.05 | font-size locked from start; image dimensions declared. |
| JS bundle (board route) | ≤ 38 KB gzipped | SvelteKit; no dependencies above 4 KB allowed without justification. |
| Worker CPU / request | ≤ 12 ms p95 | board read served from edge cache; only Durable Object writes pay full latency. |

Lighthouse CI runs on every PR (mobile preset). Failing budget blocks merge.

## 14. Security & privacy

- Magic link tokens: 32-byte random, single-use, 15-minute TTL.
- Session cookie: \`__Host-\` prefix, \`HttpOnly\`, \`Secure\`, \`SameSite=Strict\`.
- CSRF: same-site cookie + same-origin check on every mutation; no separate token.
- CSP: \`default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self' https://oc-api.*; img-src 'self' data:;\` enforced from day one (no report-only — we ship strict and fix any breakage in PR).
- HSTS: \`max-age=63072000; includeSubDomains; preload\`.
- All third parties: zero in v1. No analytics SDK (we use Cloudflare Web Analytics, cookieless). No live-chat widget. No font CDN.
- PII inventory: email, display name, team membership. **Not** stored: IP (only in CF logs, retained 14 days), location, device fingerprint.
- Subprocessor list: Cloudflare (compute, edge, DNS, analytics), Resend (transactional email), Web Push services (Apple, Mozilla, Google — no PII shared, only user-supplied endpoint).

## 15. Observability

- **Structured logs** (Workers Logs): one JSON line per request with \`request_id\`, \`route\`, \`status\`, \`duration_ms\`, \`team_id\` (hashed), \`user_id\` (hashed).
- **Metrics**: Workers Analytics Engine for app-level counters (\`session.started\`, \`session.ended\`, etc.) — sampled at 100% for v1 volumes.
- **Traces**: Workers' built-in trace per invocation; outbound calls (D1, DO, Resend, Push) recorded as spans.
- **Alerts**: see §16 telemetry. Page on 5xx > 1% over 5 min; Slack on push backlog > 100.

## 16. Telemetry events

Every event has a stable name + JSON payload + timestamp. Used for §3 success metrics + downstream analytics.

| Event | Payload | Sampling |
|---|---|---|
| \`signup\` | \`{team_new: bool}\` | 100% |
| \`session.started\` | \`{duration_sec, has_intent: bool}\` | 100% |
| \`session.ended\` | \`{duration_sec, completed_pct}\` | 100% |
| \`session.cancelled\` | \`{duration_sec, completed_pct, reason?}\` | 100% |
| \`push.permission.prompted\` | \`{}\` | 100% |
| \`push.permission.granted\` | \`{}\` | 100% |
| \`push.permission.denied\` | \`{}\` | 100% |
| \`push.delivered\` | \`{recipients}\` | 100% |
| \`board.view\` | \`{teammates_visible}\` | 10% |
| \`board.poll\` | \`{}\` | 0% (counter only via metrics) |

Telemetry never includes raw email or display name.

## 17. SLO / SLI

| SLI | Window | Target |
|---|---|---|
| Board availability (\`/api/teams/:slug/board\` 2xx rate) | 28d rolling | ≥ 99.9% |
| Session-start success | 28d rolling | ≥ 99.95% |
| Push delivery latency (DO commit → push enqueued) | p99 | ≤ 500 ms |
| Magic-link delivery (request → email received) | p95 | ≤ 8 s |

Error budget = 1 − target. Burn-rate alerts: 14.4× over 1h burns 2% of monthly budget → page; 6× over 6h → Slack.

## 18. Risk register

| # | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| R1 | Push unreliable on iOS Safari | Med | High | First-tap permission flow; in-app fallback toast on session end. |
| R2 | DO single-region adds latency for APAC users | Med | Med | Accept for v1; revisit after first APAC-heavy team onboards. |
| R3 | 50-team soft cap exceeded before billing exists | Low | High | Cap is enforced server-side; over-cap signups go to a waitlist. |
| R4 | Magic-link email goes to spam | Med | Med | SPF/DKIM/DMARC set on day one; Resend domain warmed for 14d before launch. |
| R5 | User runs the PWA in a backgrounded tab and misses the push | Med | Low | Push fires regardless of tab state; fallback to email digest if push fails (v2). |
| R6 | DO cold start adds 200ms to first session of the day | Low | Low | Acceptable; surfaced in observability. |

## 19. Non-goals (v1)

- **Realtime websockets.** 30s polling + edge cache is enough for the cohort sizes we target.
- **Native mobile apps.** PWA covers iOS + Android.
- **Per-user productivity analytics.** Fundamental anti-persona conflict (§4.3).
- **Slack bot.** Webhook-only integration in v1.5; full bot in v2.
- **Calendar integration.** Researched and rejected — too much OAuth surface for the value.
- **Multiple teams per user.** A user belongs to exactly one team. v2 will add team switching.
- **Public team board.** Boards are always behind auth.

## 20. Open questions resolved during discovery

- Timezone display: **user-local** (answered Phase 1).
- Push permission UX: **prompt on first session, not signup** (answered Phase 2).
- Proration on paid tiers: **out of scope — no paid tier in v1** (answered Phase 2).
- Should the board show "ended X minutes ago" for finished sessions? **No** — board shows *now* only.
- Should we send digest emails of "this week your team focused N hours"? **No in v1**; revisit after measuring opt-in interest.

## 21. Glossary

- **Block** — a single focus session of 15/25/45/60 min.
- **Board** — the team's shared view of who is currently in a block.
- **DO** — Cloudflare Durable Object; one per team, owns the timer state.
- **Heads-down** — the in-progress state of a session (visible on the board).
- **Magic link** — passwordless sign-in via emailed one-time URL.
- **Nudge** — the browser push fired on session end.
- **Soft cap** — server-enforced limit (50 teams) above which signups go to a waitlist rather than failing.

## 22. Change log

| Version | Date | Change |
|---|---|---|
| 0.1 | 2026-04-08 | Phase 1 discovery output. |
| 0.2 | 2026-04-09 | Stack-forge handoff folded in. |
| 0.3 | 2026-04-10 | UX style book + screen list integrated. |
| 0.9 | 2026-04-11 | Sprint plan + checkpoint structure. |
| 1.0 | 2026-04-12 | Phase 7 sign-off; this is the export-ready snapshot. |

## 23. Phase checkpoints

\`.checkpoints/oc-app-architect.checkpoint.json\` captures phase 1–7 outcomes + the approval gate log. Restoring from any checkpoint resumes the session without context loss. The checkpoint includes:

- Discovery answers (Phase 1)
- Stack-forge output reference (Phase 2)
- UX style book reference (Phase 3)
- Sprint plan + scaffold commit SHA (Phase 4)
- Per-sprint Generator/Evaluator scores (Phase 5)
- oc-git-ops PR list (Phase 6)
- oc-deploy-ops staging URL + production URL (Phase 7)

To rewind to a prior phase: \`/replay phase=3\`. The session resumes from the UX checkpoint with all later state cleared.`,
    },
    {
      id: "stack-decision",
      label: "Stack decision + scorecards",
      kind: "decision.md",
      body:
`# Stack Decision — Heads Down

**Produced by** oc-stack-forge on behalf of oc-app-architect, Phase 2 · **Decision date** 2026-04-09 · **Re-evaluation triggers** see §8.

## 1. Decision criteria (defined before scoring)

Each candidate scores 1–10 against six criteria. Weights are not equal; the brief drives them.

| Criterion | Weight | Why |
|---|---|---|
| Mobile weight | 1.5× | 30% of users are on mobile; bundle is the difference between snap and stutter. |
| Server-authoritative timer | 1.5× | Core differentiator: closing the tab cannot stop the block. |
| Cost @ 50 teams | 1.0× | The soft cap defines our \`v1\` budget envelope. |
| Hydration / runtime cost | 1.0× | Timer animation is visible; jank is unforgiveable. |
| Tooling maturity | 0.7× | Solo founder; documentation > novelty. |
| Lock-in (exit cost) | 0.7× | We will not refactor in year 1; we want options in year 2. |

## 2. Frontend scorecard

| Candidate | Mobile | Hydration | Tooling | Hire pool | Lock-in | Weighted |
|---|---:|---:|---:|---:|---:|---:|
| **SvelteKit** | **9** | **10** | 8 | 7 | 8 | **44.6** |
| Next.js | 6 | 6 | **10** | **10** | 6 | 41.0 |
| Remix | 7 | 8 | 8 | 8 | 7 | 39.4 |
| Nuxt | 7 | 7 | 7 | 7 | 7 | 35.5 |
| Astro + islands | 8 | 9 | 7 | 5 | 8 | 38.4 |

**Pick:** SvelteKit. Smallest JS on mobile — the primary IC device 30% of the time. Hydration predictability matters for a visible timer. Astro was a close second but its islands model is awkward for the in-progress view, which is one big interactive surface.

## 3. Backend scorecard

| Candidate | Cold-start | Timer primitive | Cost @ 50 teams | Tooling | Lock-in | Weighted |
|---|---:|---:|---:|---:|---:|---:|
| **CF Workers + D1 + DO** | **10** | **10** (DO) | **10** ($0) | 7 | 7 | **49.0** |
| Fly.io + Postgres + Redis | 6 | 8 (cron + Redis) | 6 ($24/mo) | 8 | 9 | 38.6 |
| Supabase | 6 | 6 (Edge fn) | 7 ($25/mo over free) | 8 | 5 | 35.4 |
| Vercel + Neon + QStash | 7 | 7 | 6 | 9 | 6 | 37.0 |
| Lambda + RDS + EventBridge | 5 | 7 | 4 | 6 | 6 | 32.0 |

**Pick:** Cloudflare Workers + D1 + Durable Objects. DO is purpose-built for the server-authoritative timer (\`alarm()\` for end-of-block fan-out). Free tier covers the 50-team soft cap with headroom.

## 4. Auth scorecard

| Candidate | Mobile UX | Cost @ 50 teams | Lock-in | DX | Weighted |
|---|---:|---:|---:|---:|---:|
| **Magic link via Resend (in-house)** | **9** | **10** ($0 within free) | **9** | 8 | **34.7** |
| Auth0 | 7 | 5 | 4 | 9 | 24.5 |
| Clerk | 8 | 5 | 4 | **10** | 25.6 |
| WorkOS | 8 | 4 | 6 | 8 | 25.5 |

**Pick:** in-house magic link. Three reasons: (1) zero cost at the soft cap, (2) the auth flow is < 200 lines we can audit, (3) no vendor session/JWT layer to learn.

## 5. Email transport

| Candidate | Deliverability | Cost @ 50 teams | DX | Weighted |
|---|---:|---:|---:|---:|
| **Resend** | 9 | **10** | **9** | **27.5** |
| Postmark | 9 | 7 | 8 | 23.5 |
| AWS SES | 8 | **10** | 5 | 22.0 |

**Pick:** Resend. Modern API, generous free tier, the best DX of the three; deliverability is good enough for transactional volume.

## 6. Observability stack

| Candidate | Workers integration | Cost | Lock-in | Weighted |
|---|---:|---:|---:|---:|
| **CF Workers Logs + Analytics Engine + Logpush → Tinybird (later)** | **10** | **10** | 9 | **28.4** |
| Datadog | 9 | 4 | 4 | 17.0 |
| Honeycomb | 8 | 6 | 6 | 19.4 |
| Sentry (errors only) | 9 | **10** (free tier) | 8 | 27.0 |

**Pick:** Workers-native first; Sentry layered on for client errors only. We ship without paying for Datadog in year 1.

## 7. Anti-picks (rejected, with reason recorded)

- **Next.js** — overkill; we don't need ISR, server actions, or their hydration tax for this UI. The team-board route would ship 80 KB of framework before our code; SvelteKit ships 18 KB.
- **Supabase** — 4 lock-in vectors (auth, DB, realtime, storage) with no corresponding win. Nice product, wrong tool for this brief.
- **Firebase** — cost nonlinearity past the free tier; unclear exit strategy from Firestore data model.
- **RDS Postgres** — ops overhead without the scale to justify it. We'd be paying for HA we don't yet need.
- **Clerk** — best DX of the auth options, but the per-MAU pricing makes the soft-cap economics ugly.

## 8. Re-evaluation triggers (when this decision should be revisited)

| Trigger | Reconsider |
|---|---|
| > 200 paying teams | D1 row limits + DO single-region latency for APAC. Possibly migrate to Postgres + multi-region DO. |
| Slack bot promoted to first-class | Auth + permission model expands; revisit auth provider for OAuth-into-Slack flow. |
| Push fan-out backlog > 5,000/min | DO write contention; revisit with Workers Queues fan-out pattern. |
| Founder hires a 2nd engineer | Reconsider Next.js for the larger hire pool. |

## 9. Versions pinned (lockfile snapshot)

\`\`\`
svelte@5.5.x
@sveltejs/kit@2.16.x
wrangler@4.0.x
drizzle-orm@0.36.x
resend@4.0.x
web-push@3.6.x
\`\`\`

Cloudflare compat date: \`2026-04-01\` (latest stable).

Checkpoint written to \`.checkpoints/oc-stack-forge.checkpoint.json\`; oc-app-architect reads it for Phase 3 design brief.`,
    },
    {
      id: "sprint-ledger",
      label: "Sprint ledger (Generator/Evaluator scores)",
      kind: "ledger",
      body:
`# Sprint Ledger — Heads Down

Generator proposes, Evaluator grades, loop repeats until ≥ 85. Each sprint written to \`.checkpoints/oc-app-architect.checkpoint.json\` on completion.

## 1. Scoreboard

\`\`\`
 SPRINT                             GEN  EVAL   STATUS    NOTES
 ────────────────────────────────  ────  ────  ───────  ──────────────────────────────────────────
 01 · Auth + team creation          p1    72   failed   loose email regex; no /auth rate-limit
                                    p2    94   shipped  KV-backed rate-limit; fuzz test added
 02 · Session timer (Durable Obj)   p1    91   shipped  server-authoritative; survives tab close
 03 · Team board + polling          p1    93   shipped  30s TTL, heads-down avatars, state fsm
 04 · Browser push opt-in UX        p1    76   failed   permission race on iOS Safari
                                    p2    88   shipped  requested on first session, not signup
 05 · Stripe Checkout + soft cap    p1    90   shipped  50-team gate; billing portal wired
 06 · Polish: 404, empty states     p1    95   shipped  /privacy stub, GA4 skipped (CF Analytics)
\`\`\`

## 2. Aggregate

- **6 sprints** · **94 tests passing** · **2 re-evals** · **0 Evaluator overrides**
- Mean Evaluator score: **92**
- Median time per sprint (including re-evals): **17 minutes**
- Total wall-clock: **3h 41m**
- Re-eval rate: **33% (2/6)** — within target (Evaluator targets 30–40% catch rate; lower means it's rubber-stamping).

## 3. Per-sprint detail

### Sprint 01 — Auth + team creation

- **Pass 1** — 23 files touched (\`+812 / −0\`); 14 unit tests; magic-link flow + signup landing.
- **Evaluator pass 1: 72/100.** Deductions:
  - Email validation accepted \`a@b\` and \`a@b.\`.
  - \`/api/auth/request\` had no rate-limit; trivially DoS-able.
  - Team-slug collision path lacked tests (the slug is generated from the team name; unicode + emoji collisions untested).
- **Pass 2** — 4 files touched (\`+118 / −22\`); 8 new tests.
  - Email validation: RFC 5322 lite (no quoted-locals, but rejects all malformed inputs).
  - KV-backed rate-limit: 5/min/IP, 10/hour/email.
  - Fuzz test: 1,000 random unicode strings → asserts slug uniqueness via deterministic generator.
- **Evaluator pass 2: 94/100.** Shipped.

### Sprint 02 — Session timer (Durable Object)

- **Pass 1** — 11 files (\`+504 / −31\`); 14 unit tests; 1 integration test that closes the websocket and reopens to verify the timer continues.
- **Evaluator pass 1: 91/100.** Shipped. Minor deductions for missing telemetry on \`alarm()\` callback failures (logged, not blocking).

### Sprint 03 — Team board + polling

- **Pass 1** — 9 files (\`+388 / −18\`); 11 tests including a state-machine fuzz test for board transitions.
- **Evaluator pass 1: 93/100.** Shipped. State FSM diagrammed in the PR description.

### Sprint 04 — Browser push + opt-in UX

- **Pass 1** — 6 files (\`+221 / −12\`); 9 tests.
- **Evaluator pass 1: 76/100.** Deductions:
  - Permission prompt ran on page load — silently fails on iOS Safari (requires user gesture in same task).
  - Denied permission blocked session start (should be soft fallback).
  - Push payload not signed at the App layer (VAPID handles transport; Evaluator wanted a higher-level integrity stamp for forensics).
- **Pass 2** — 4 files (\`+78 / −19\`); 4 new tests.
  - Permission prompted on first \`/api/sessions/start\` user gesture.
  - Denied path renders an in-app toast at session end as fallback.
  - Payload includes a \`request_id\` for log-correlation if a recipient reports a missed push.
- **Evaluator pass 2: 88/100.** Shipped.

### Sprint 05 — Stripe Checkout + soft cap

- **Pass 1** — 9 files (\`+406 / −7\`); 13 tests including a contract test against the Stripe fixture clock.
- **Evaluator pass 1: 90/100.** Shipped. The 50-team soft cap reads from a cached count (5-min TTL) so we don't \`SELECT count(*)\` on every signup.

### Sprint 06 — Empty states + /privacy + a11y

- **Pass 1** — 17 files (\`+196 / −44\`); 25 tests including axe-core scans on every route.
- **Evaluator pass 1: 95/100.** Shipped. Highest score of the run; Evaluator commented that the empty-state copy was "actually warm, not corporate filler."

## 4. What the Evaluator caught that Generator missed

1. \`/api/auth/request\` had no rate limit. Evaluator flagged after one-pass gen. Cost: 6 minutes.
2. Push permission prompt ran on page load, not on user gesture — fails on iOS. Cost: 12 minutes.
3. Team-slug collision path wasn't fuzz-tested; Evaluator mandated a unicode suite. Cost: 8 minutes.
4. Billing "50 teams" was counted at request time — Evaluator pushed for a cached read. Cost: 4 minutes.
5. Denied push permission blocked session start. Evaluator caught the failure mode in the test review, not the code. Cost: 5 minutes.

Average remediation time per Evaluator catch: **7 minutes.** Each fix costed < 90s of Generator time + the Evaluator re-pass.

## 5. Generator efficiency

- **Total tokens consumed:** ~1.2M (in) / ~340K (out) across all sprints.
- **Mean tokens per sprint:** 200K / 57K.
- **Largest sprint:** Sprint 06 (polish + a11y) — 280K / 88K. Heavy because every screen got an axe-core pass.
- **Smallest sprint:** Sprint 02 (timer) — 130K / 38K. Most of the work was in Durable Object boilerplate that the Generator already had templates for.

## 6. Evaluator rubric (summary)

The Evaluator scores on five axes, each weighted equally:

| Axis | What it checks |
|---|---|
| **Correctness** | Does the code do what the spec says? Tests pass? Edge cases handled? |
| **Security** | Authn/authz, input validation, rate-limits, secret hygiene. |
| **Performance** | Bundle budget, query plans, hot-path allocation. |
| **Operability** | Logs, metrics, alerts, rollback path, runbook implications. |
| **Style + a11y** | Lint, type-check, axe-core, design-system adherence. |

A sprint ships at ≥ 85; below that, Generator runs another pass with the deduction list as input.

## 7. Checkpoint

Each sprint's pass-by-pass detail (file diffs, test list, Evaluator narrative, score breakdown) lives in \`.checkpoints/oc-app-architect.checkpoint.json\` under \`phases.5.sprints[]\`. Replayable with \`/replay sprint=04 pass=1\`.`,
    },
    {
      id: "pr-bundle",
      label: "Six draft PRs, one per sprint",
      kind: "pull-request",
      body:
`# Pull Request Bundle

All six PRs opened in draft by **oc-git-ops**; descriptions auto-written from the sprint ledger. Filterable on the repo under label \`opchain-sprint\`. Reviewer should merge in order — each PR depends on the prior schema/state.

## Index

\`\`\`
 #14  Sprint 1 · Auth + team creation         draft · +812 −0    · 22 tests · 24 files
 #15  Sprint 2 · Session timer (Durable Obj)  draft · +504 −31   · 14 tests · 11 files
 #16  Sprint 3 · Team board + polling         draft · +388 −18   · 11 tests ·  9 files
 #17  Sprint 4 · Browser push + opt-in UX     draft · +221 −12   ·  9 tests ·  6 files
 #18  Sprint 5 · Stripe Checkout + soft cap   draft · +406 −7    · 13 tests · 11 files
 #19  Sprint 6 · Empty states + /privacy      draft · +196 −44   · 25 tests · 17 files
\`\`\`

---

## #14 — feat(auth): magic-link signup + team creation

\`\`\`
Summary:
- Public landing page with "Start a team" CTA.
- POST /api/auth/request — emails magic link via Resend; rate-limited 5/min/IP.
- GET  /api/auth/redeem  — single-use token, 15-min TTL.
- On first redeem: prompts for team name; generates URL-safe slug.
- D1 migrations 0001 (User, Team, Membership) applied + seeded in test fixtures.

Test plan:
- [x] Request twice within a minute → second returns 202 but no email sent.
- [x] Redeem after 15 min → 410 Gone with friendly UX.
- [x] Slug generator produces unique slug under 1k unicode-name fuzz.
- [x] Magic link opens in same browser → session cookie set.

Rollback:
- Revert migration 0001; flip FLAG_SIGNUP off (returns waitlist page).
\`\`\`

---

## #15 — feat(session): server-authoritative timer via Durable Object

\`\`\`
Summary:
- New DO class TeamTimerDO; one instance per team slug.
- POST /api/sessions/start delegates to DO; DO sets alarm() at ends_at.
- Timer is server-source-of-truth; closing the tab does not stop it.
- Drift correction: client polls /api/sessions/:id every 5s and rewrites the
  countdown from the server clock.

Test plan:
- [x] Start session, kill the tab, reopen 10 min later → in-progress view
       resumes correctly.
- [x] DO alarm() fires within 2s of expected ends_at across 1k iterations.
- [x] Concurrent /start from same user returns 409 already_in_session.
- [x] DO restart mid-session preserves timer state via storage.put().

Rollback:
- Migration 0002 is forward-only; DO storage is per-team, no cross-team
  blast radius. Keep DO binding in wrangler.jsonc.
\`\`\`

---

## #16 — feat(board): polling team board + heads-down avatars

\`\`\`
Summary:
- GET /api/teams/:slug/board returns members with current session.
- Cache-Control: max-age=30, stale-while-revalidate=60 — board polls every
  30s; SWR keeps the last good response on slow networks.
- Empty state when nobody is heads-down.
- Board is a finite-state machine: empty → mixed → all-heads-down → cool-down.

Test plan:
- [x] State transitions through every FSM edge under fuzzed input.
- [x] Cache headers verified end-to-end against staging edge.
- [x] Avatar contrast ≥ 4.5:1 against background in both themes.
- [x] Cold-cache board read p95 < 70ms in CF benchmarking.

Rollback:
- Disable polling on client; route still works (manual refresh).
\`\`\`

---

## #17 — feat(push): browser push opt-in on first session

\`\`\`
Summary:
- Request notification permission on the first /sessions/start interaction
  (iOS requires a user gesture — permission-on-load fails silently).
- Store the PushSubscription in PushSubscription table (not on User).
- POST /sessions/:id/end enqueues pushes to every teammate via
  Web Push SDK + VAPID keys in env.
- Denied permission falls back to in-app toast at session end.

Test plan:
- [x] Permission prompt appears on first start, not on page load.
- [x] Denied permission does not block session start (graceful fallback).
- [x] Push payload includes request_id for log-correlation on missed pushes.
- [x] Tab close during active session still triggers push at end.
- [x] 410 Gone response from push service soft-deletes the subscription.

Rollback:
- Flip FLAG_PUSH off in env. Existing sessions unaffected; no push on end.
\`\`\`

---

## #18 — feat(billing): Stripe Checkout stub + 50-team soft cap

\`\`\`
Summary:
- /billing renders "you're on the free tier" + a paid-tier waitlist.
- 50-team soft cap enforced server-side at signup; over-cap signups go to
  waitlist via /api/waitlist/join.
- Cap counter cached in KV (5-min TTL) to avoid SELECT count(*) on every
  signup. Cache-bust on team_create.
- Stripe wired via test keys — live keys remain unset in v1.

Test plan:
- [x] 51st team signup → returns waitlist page with confirmation email.
- [x] KV cache-bust after team_create propagates within 2 invocations.
- [x] Billing portal link present + signed for authenticated users.
- [x] All Stripe contract tests pass against fixture clock.

Rollback:
- Flip FLAG_BILLING off — billing routes 503; existing data unaffected.
\`\`\`

---

## #19 — chore(polish): empty states, /privacy, /404, a11y sweep

\`\`\`
Summary:
- All 11 routes audited with axe-core; 0 critical issues.
- Empty states for board, settings, invite — copy reviewed manually.
- /privacy (handwritten, not a generator template) + /terms.
- /404 branded; preserves header/footer.
- Cloudflare Web Analytics wire-up (cookieless, no consent banner needed).

Test plan:
- [x] axe-core nightly gate: 0 critical, 0 serious on every route.
- [x] Lighthouse mobile a11y ≥ 95 on board + in-progress + ended.
- [x] Empty-state copy reviewed; no Lorem-ipsum survives.
- [x] 404 returns 404 status code (some frameworks fail this).
- [x] CF Web Analytics events firing on all 11 routes.

Rollback:
- /privacy + /terms can be replaced inline; /404 is a fallback.
\`\`\`

---

## Reviewer notes

- Branch order matters: #14 lands first (migrations), then #15, then #16/17 in either order, then #18, then #19.
- Each PR's CI runs the full test suite — green CI is required before merge.
- Lighthouse CI gates merge on the bundle/perf budget; failing budgets surface as PR comments.
- Squash-merge convention; PR title becomes the commit subject.

All PRs opened in \`draft\` mode so the human reviewer can approve in order without surprise auto-merges.`,
    },
    {
      id: "rollback-runbook",
      label: "Deploy + rollback runbook",
      kind: "runbook",
      body:
`# Heads Down — Deploy & Rollback Runbook

**Owner** oc-deploy-ops checkpoint · Produced after Phase 7 ship handoff · **Reviewed quarterly**.

## 1. Deploy procedure (normal)

\`\`\`bash
# From main, with clean tree:
pnpm ci
pnpm build
wrangler deploy            # production
# Smoke:
curl -fsS https://headsdown.app/api/health | jq '.'
\`\`\`

A post-deploy GitHub Actions workflow auto-runs the 12-check smoke suite:

1. \`GET /api/health\` returns \`{ ok: true }\` with a version stamp matching \`HEAD\`.
2. \`GET /\` responds 200 with every required security header (CSP, HSTS, X-Content-Type-Options, X-Frame-Options, Referrer-Policy, Permissions-Policy).
3. \`POST /api/auth/request\` (test-only stub address) returns 202.
4. \`POST /api/sessions/start\` (authed) returns \`ends_at\` in the future.
5. \`GET /api/sessions/:id\` matches the started session.
6. \`GET /api/teams/:slug/board\` includes the active session.
7. \`POST /api/sessions/:id/end\` flips status to \`ended\`.
8. Durable Object \`alarm()\` fires within 2s of expected.
9. Push fan-out succeeds against a fixture VAPID endpoint.
10. Stripe webhook endpoint verifies a known-good signed payload (test mode).
11. axe-core scan on \`/\`, \`/board\`, \`/settings\` — 0 critical.
12. Lighthouse mobile budget passes for \`/board\`.

Fails loudly on any regression — the deploy action exits non-zero, the bad release is paused, and a Linear bug is auto-filed.

## 2. Rollback (≤ 60s)

\`\`\`bash
wrangler deployments list
# Copy the last-known-good deployment id, then:
wrangler rollback <deployment-id>
\`\`\`

Cloudflare serves the previous code within ~30s globally. D1 migrations are forward-only; for a schema-rollback scenario, use the migration's own \`down()\` captured at build, or deploy a forward-fix migration.

## 3. Feature flags (graceful degrade without deploy)

| Flag | Default | When to flip |
|---|---|---|
| \`FLAG_PUSH\` | on | Push fan-out failing or backlog growing. Sessions still work; nudges silenced. |
| \`FLAG_BILLING\` | on | Stripe outage. Existing subscriptions unaffected; new signups go to waitlist. |
| \`FLAG_SIGNUP\` | on | Surprise signup spike or 50-team soft cap pressure; routes \`/auth/request\` to waitlist UI. |
| \`FLAG_DO_TIMERS\` | on | Durable Object regional outage. Sessions fall back to client-side timers (degraded — they stop on tab close). Last-resort. |
| \`FLAG_BOARD_POLL\` | on | Hot read storm. Disables 30s polling; users see static board until they manually refresh. |

Flag flips propagate in ≤ 10s via Workers KV.

## 4. Monitoring + SLO

| SLI | Window | Target | Alert |
|---|---|---|---|
| 5xx rate | 5 min | < 0.1% | > 1% over 5 min → PagerDuty page |
| Board p99 latency | 5 min | < 200 ms | > 500 ms over 10 min → Slack |
| DO alarm-miss rate | 24h | < 0.01% | any miss → Slack; > 5/day → page |
| Push fan-out backlog | live | < 100 queued | > 500 → Slack; > 5,000 → page |
| Magic-link delivery (request → received) | 24h | p95 < 8s | p95 > 30s → Slack |

Burn-rate alerts: 14.4× burn over 1h on any SLO → page; 6× over 6h → Slack.

## 5. Incident playbook

When the page fires:

1. **Acknowledge** in PagerDuty within 5 minutes; post in #ops the alert + a "investigating" message.
2. **Triage** — open the Cloudflare dashboard + Workers Logs for the affected route. Cross-check the most recent deploy SHA vs. the alert window.
3. **Bisect** — if the alert started within 10 minutes of a deploy, rollback first (§2), investigate after.
4. **Mitigate** — if rollback isn't viable, flip the relevant feature flag (§3) to degrade gracefully.
5. **Communicate** — if user impact is real, post to status page within 15 minutes. Update every 30 minutes until resolved.
6. **Resolve** — verify SLI back in target band for 30 minutes before declaring resolved.
7. **Postmortem** — within 5 business days for any incident that paged. See §7 template.

## 6. On-call rotation

- Solo founder is sole on-call in v1. PagerDuty schedule: 24/7, with a "do not disturb" window 22:00–07:00 Pacific where alerts page only on **5xx > 5%** or **complete outage**. All other alerts queue to Slack.
- When the team grows past one engineer, primary/secondary rotation flips weekly on Mondays at 10:00 Pacific.
- Onboarding checklist for new on-call: this runbook, dashboard tour, fire-drill rehearsal (rollback + flag flip), war-game one staged outage.

## 7. Postmortem template

\`\`\`
# Incident — <date> — <one-line summary>

## Impact
- Users affected: <N> (<scope>)
- Duration: <start> → <end> (<minutes>)
- SLI burn: <number>× over <window>

## Timeline (UTC)
- HH:MM — first signal
- HH:MM — page acknowledged
- HH:MM — root cause identified
- HH:MM — mitigation applied
- HH:MM — verified resolved

## Root cause
<2–4 sentences of plain English; no jargon.>

## What went well
- ...

## What didn't
- ...

## Action items
- [ ] <owner> — <action> — <due date>
\`\`\`

Postmortems are blameless. Action items live in Linear under the \`incident\` label and are reviewed at the weekly ops sync.

## 8. Disaster recovery

- **D1 backup cadence:** Cloudflare runs continuous backups; we additionally run a nightly export to R2 via a scheduled Worker. Retain 30 days.
- **VAPID key loss:** keys are stored in Cloudflare secrets + a 1Password vault entry owned by the founder. Rotation procedure in \`docs/runbooks/rotate-vapid.md\`.
- **Account loss:** if the Cloudflare account is compromised, the recovery contact (founder's lawyer, on file with CF) can re-establish ownership; runbook in \`docs/runbooks/cf-account-recovery.md\`.

## 9. Dashboards

- **Health** — \`https://dash.cloudflare.com/.../headsdown-app/analytics\` (5xx, latency, request volume).
- **DO timer** — custom Workers Analytics Engine dashboard (alarm fire rate, alarm-miss rate, active timers per region).
- **Push** — fan-out success rate, backlog depth, per-endpoint failure breakdown.
- **Business** — daily active sessions, signup funnel, push opt-in rate (read from Workers Analytics Engine).

## 10. Change log

- **2026-04-12** — initial runbook produced after Phase 7 ship.
- **2026-04-19** — added Lighthouse smoke check (#12).
- **2026-04-26** — added \`FLAG_BOARD_POLL\` after a hot-read storm test.

Checkpoint: \`.checkpoints/oc-deploy-ops.checkpoint.json\` — includes deploy history, rollback events, on-call schedule.`,
    },
  ],
  skills: ["oc-app-architect", "oc-stack-forge", "oc-ux-engineer", "oc-git-ops", "oc-deploy-ops"],
  runtime: "≈ 22 exchanges",
  steps: [
    { type: "beat", label: "01 · Discover", caption: "oc-app-architect runs the interview", skills: ["oc-app-architect"] },

    {
      type: "exchange", role: "user",
      content: "I want to build a Pomodoro app for remote teams. Team members start a focus block, others see who's heads-down, and the app nudges them to break together."
    },
    {
      type: "exchange", role: "claude", skill: "oc-app-architect",
      content:
`Recognized a new-app brief — invoking **oc-app-architect** and loading \`oc-orchestrator.md\`. No prior checkpoint found, so I'll start at Phase 1 (Discovery).

I'll run eight questions to lock the shape of the product. You can skip any by saying "skip" and we'll fill defaults from comparable apps.

**1. Who's the primary user?** (pick one, or describe)
- Individual contributor who wants to focus
- Team lead who wants visibility into focus time
- Ops / HR wanting aggregate productivity data

**2. Sync or async?** Does the "others see who's heads-down" part update in real time, or is a 30-second refresh good enough?

**3. Scale at launch?** 5-person team, 50, 500? Affects the stack choice.`
    },
    {
      type: "exchange", role: "user",
      content: "Primary user is the IC. Real-time is nice but 30s refresh is fine for v1. Target: teams of 5–30. Self-serve signup. Mobile-first."
    },
    {
      type: "exchange", role: "claude", skill: "oc-app-architect",
      content:
`Good — anchoring on the IC, polling rather than websockets, 5-30 person teams, mobile-first, self-serve. Continuing:

**4. Team identity** — how do people find their team? Invite link, shared workspace slug, SSO?
**5. Focus block rules** — fixed 25-min pomodoros, or user-chosen duration?
**6. Nudges** — browser push, Slack, email, in-app only?
**7. Paid tier?** Free forever, trial, or paywalled from day one?
**8. Offline behaviour** — must the timer keep running if the tab closes?`
    },
    {
      type: "exchange", role: "user",
      content: "Invite links. User picks duration from {15, 25, 45, 60}. Nudges via browser push + Slack later. Free with a soft cap at 50 active teams. Timer must survive tab close — treat as server-side authoritative."
    },
    {
      type: "exchange", role: "claude", skill: "oc-app-architect",
      content:
`Writing \`.checkpoints/oc-app-architect.checkpoint.json\` — Phase 1 complete.

**Product summary (will become the spec's TL;DR):**

> **Heads Down** — a team pomodoro tracker. ICs start focus blocks of 15/25/45/60 minutes; teammates see who's heads-down on a shared board. Browser push nudges at block end. Server is the source of truth for timers; closing a tab doesn't stop a session. Free with a 50-team soft cap.

I'll advance to **Phase 2 — Spec + Stack**. Auto-invoking \`oc-stack-forge\` for the stack decision. Type \`/approve\` to advance, or push back on anything in the summary.`
    },
    {
      type: "exchange", role: "user",
      content: "/approve"
    },

    { type: "beat", label: "02 · Spec + Stack", caption: "oc-stack-forge picks the stack", skills: ["oc-app-architect", "oc-stack-forge"] },

    {
      type: "exchange", role: "claude", skill: "oc-stack-forge",
      content:
`Invoked by oc-app-architect with the Heads Down brief. I run three scorecards — frontend, backend, and infra — against the constraints (mobile-first, server-authoritative timers, 50-team soft cap, self-serve signup, Slack integration roadmap).

**Recommendation — v1 stack:**

| Layer        | Pick                           | Why                                                  |
|--------------|--------------------------------|------------------------------------------------------|
| Frontend     | SvelteKit + Tailwind           | Smallest JS on mobile; no hydration weirdness.       |
| Backend      | Cloudflare Workers + D1        | Free tier fits 50 teams; server-side timer is trivial with Durable Objects. |
| Auth         | Magic link via Resend          | No OAuth friction for a 5-person pilot.              |
| Realtime     | 30s polling                    | Matches your spec; websockets deferrable.            |
| Slack later  | Incoming webhooks (no bot yet) | One scope, no OAuth consent screen.                  |

**Anti-picks:** Next.js (overkill), Supabase (stack lock-in this early), Firebase (cost risk at scale), Postgres on RDS (infra we don't need yet).

Writing \`.checkpoints/oc-stack-forge.checkpoint.json\`. Control returns to oc-app-architect.`
    },
    {
      type: "exchange", role: "claude", skill: "oc-app-architect",
      artifacts: ["master-spec", "stack-decision"],
      content:
`Spec drafted against the oc-stack-forge output — 11 screens, 4 data models, 3 API surfaces. Full doc is 18 pages; here's the TL;DR of what you'd see on \`/oc-export-spec\`:

- **Screens:** team board · new session · session-in-progress · session ended · join-via-link · settings · billing stub · 3 admin views
- **Models:** \`User\`, \`Team\`, \`Session\`, \`Membership\`
- **APIs:** \`POST /sessions/start\` · \`POST /sessions/end\` · \`GET /teams/:id/board\` (cacheable, 30s TTL)
- **Open questions:** (1) timezone display — team-local or user-local? (2) push permission UX — prompt on signup, on first session, or nudge card on the board?

Phase 2 checkpoint written. Ready for **Phase 3 — Design** (auto-invokes \`oc-ux-engineer\`). \`/approve\` to advance.`
    },
    {
      type: "exchange", role: "user",
      content: "User-local for timezone. Push prompt on first session (not signup). /approve"
    },

    { type: "beat", label: "03 · Design", caption: "oc-ux-engineer builds the style book", skills: ["oc-app-architect", "oc-ux-engineer"] },

    {
      type: "exchange", role: "claude", skill: "oc-ux-engineer",
      content:
`Invoked by oc-app-architect for Phase 3. Since this is a consumer-ish timer app without dense tabular data, I stay solo — \`oc-dash-forge\` not needed.

**Design system — "Quiet Work":**
- **Palette:** Ink \`#1b1d1f\` / Mist \`#e9e6df\` / Leaf \`#2f8a57\` (focus) / Clay \`#d96b3a\` (alert). High contrast for at-a-glance board scanning.
- **Type:** Inter 560/400 for UI, JetBrains Mono for timers.
- **Key components:** \`FocusCard\`, \`TeamBoard\`, \`SessionTimer\`, \`NudgeToast\`.
- **Mobile frame:** 390×844; primary CTA bottom-center thumb zone.

Delivered: style book (18 tokens), wireframes (11 screens), Figma-equivalent prompts for hi-fi mocks. Evaluator loop (Generator → Evaluator harness) passes with 88/100 — deductions for mobile nav contrast at 4.4:1 (target 4.5:1).

Writing \`.checkpoints/oc-ux-engineer.checkpoint.json\` with the style book. \`/approve\` to proceed to roadmap.`
    },
    {
      type: "exchange", role: "user",
      content: "/approve"
    },

    { type: "beat", label: "04 · Roadmap + Scaffold", caption: "sprint plan and runnable skeleton", skills: ["oc-app-architect"] },

    {
      type: "exchange", role: "claude", skill: "oc-app-architect",
      content:
`**Sprint plan — 6 sprints to v1:**

| # | Sprint                    | Deliverable                                           |
|---|---------------------------|-------------------------------------------------------|
| 1 | Auth + team creation      | Magic-link signup, team invite URL, empty board.      |
| 2 | Session timer (server)    | Durable Object per session; survives tab close.       |
| 3 | Team board (polling)      | 30s refresh, heads-down avatars, state transitions.   |
| 4 | Nudges                    | Browser push on session end; graceful fallback.       |
| 5 | Billing stub              | Stripe Checkout + 50-team soft cap gate.              |
| 6 | Launch polish             | Empty-states, 404, analytics wire, privacy page.      |

Scaffold generated: 47 files, passing \`pnpm dev\`, schema migrated, \`/auth/magic\` smoke-tested with a local SMTP stub. \`/approve\` to kick off Sprint 1.`
    },
    {
      type: "exchange", role: "user",
      content: "/approve"
    },

    { type: "beat", label: "05 · Build", caption: "Generator → Evaluator sprint loop", skills: ["oc-app-architect"] },

    {
      type: "exchange", role: "claude", skill: "oc-app-architect",
      content:
`**Sprint 1 — Auth + team creation.** Running the Generator/Evaluator harness.

**Generator pass 1** — 23 files touched. Routes, DB schema, magic-link flow, landing page.
**Evaluator pass 1** — 72/100. Deductions: email validation too loose, no rate-limit on \`/auth/request\`, team-slug collision untested.
**Generator pass 2** — tightened validation, added KV-backed rate limit, fuzz test on team-slug.
**Evaluator pass 2** — 94/100. Ship it.

Writing checkpoint. Next sprint? Say \`/oc-build\` to continue, \`/status\` for the scoreboard, or \`/approve\` to auto-run all remaining sprints back-to-back.`
    },
    {
      type: "exchange", role: "user",
      content: "Run all remaining sprints. /approve"
    },
    {
      type: "exchange", role: "claude", skill: "oc-app-architect",
      artifacts: ["sprint-ledger"],
      content:
`Running Sprints 2–6 end-to-end. Streaming the scoreboard:

\`\`\`
Sprint 2 · Session timer (Durable Objects)    passed · 91/100
Sprint 3 · Team board + polling               passed · 93/100
Sprint 4 · Browser push + opt-in UX           passed · 88/100  ← 1 re-eval, fixed permission race
Sprint 5 · Stripe Checkout + soft cap         passed · 90/100
Sprint 6 · Empty states + /privacy + GA4      passed · 95/100
\`\`\`

All green. Invoking **oc-git-ops** with the full sprint ledger.`
    },

    { type: "beat", label: "06 · Ship", caption: "oc-git-ops → oc-deploy-ops", skills: ["oc-git-ops", "oc-deploy-ops"] },

    {
      type: "exchange", role: "claude", skill: "oc-git-ops",
      artifacts: ["pr-bundle"],
      content:
`Reading oc-app-architect's checkpoint — 6 sprints, 94 passing tests, no outstanding blockers.

Creating branches \`sprint/1-auth\` … \`sprint/6-polish\`, one PR per sprint, each with generated descriptions + test plan. Draft mode on all six so you can review.

\`\`\`
 #14  Sprint 1 · Auth + team creation     draft · +812 −0   · 22 tests
 #15  Sprint 2 · Session timer            draft · +504 −31  · 14 tests
 #16  Sprint 3 · Team board + polling     draft · +388 −18  · 11 tests
 #17  Sprint 4 · Browser push             draft · +221 −12  ·  9 tests
 #18  Sprint 5 · Stripe Checkout          draft · +406 −7   · 13 tests
 #19  Sprint 6 · Polish                   draft · +196 −44  · 25 tests
\`\`\`

Handing off to **oc-deploy-ops** for the preview + staging pipeline.`
    },
    {
      type: "exchange", role: "claude", skill: "oc-deploy-ops",
      content:
`Reading oc-git-ops checkpoint. Building preview deployments for each PR, running the Cloudflare Workers + D1 migration dry-run, wiring the staging secrets.

\`\`\`
 heads-down-staging.workers.dev   deployed · 42 KB worker · TTFB 38ms
 D1 migration dry-run             6 migrations · 0 conflicts · 0 destructive ops
 smoke suite (18 checks)          all green
 security headers                 CSP, HSTS, nosniff, Frame-Options all present
\`\`\`

Staging is live. Production deploy is one \`/oc-launch\` away — but give it 24h soak first. Writing \`.checkpoints/oc-deploy-ops.checkpoint.json\` with the staging URL + a rollback runbook.`,
      artifacts: ["rollback-runbook"],
    },
    {
      type: "exchange", role: "user",
      content: "Soaked fine overnight. /oc-launch"
    },
    {
      type: "exchange", role: "claude", skill: "oc-deploy-ops",
      content:
`Promoting staging → production. DNS \`headsdown.app\` points at the prod worker. Post-deploy smoke: all green. Error budget: 0 requests 5xx'd in the first 60 minutes.

**Summary — end of session:**
- **Time elapsed:** 3h 41m of chat, mostly spent on design.
- **Code shipped:** 2,627 lines across 6 PRs, 94 tests passing.
- **Infra cost:** \`$0\` (Workers free tier fits the 50-team soft cap).
- **Next natural phase:** \`oc-scale-ops\` advisory when you hit ~30 teams; \`oc-integrations-engineer\` whenever you're ready for the Slack bot.

Congrats — you shipped. 🚀`
    },
  ],
};

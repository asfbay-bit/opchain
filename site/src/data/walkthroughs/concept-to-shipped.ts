import type { Walkthrough } from "./types";

/**
 * Scenario 1 — full app-architect pipeline.
 * Covers: app-architect hub, auto-invoke of stack-forge + ux-engineer,
 * the Generator/Evaluator build loop, and the ship handoff through
 * git-ops → deploy-ops.
 */
export const conceptToShipped: Walkthrough = {
  id: "concept-to-shipped",
  title: "Concept → shipped, in one chat",
  tagline: "Idea → deployed, one chat",
  summary:
    "A solo founder types an idea and walks out with a live app — nothing cherry-picked.",
  description:
    "Heads Down is an idea in the founder's head at 10am. By 2pm it's a production Cloudflare Worker, six PRs merged, 94 passing tests, and a staging URL her co-founder can poke at. app-architect runs the full pipeline — discovery interview, spec, design, sprint plan, Generator/Evaluator build loop — auto-invoking stack-forge for the tech stack and ux-engineer for the style book, then handing off to git-ops and deploy-ops to ship. No API keys. No SaaS. Every phase has a checkpoint the founder can rewind to.",
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

**Version** 1.0.0 · **Owner** app-architect checkpoint · **Status** Phase 7 complete

## 1. TL;DR

Heads Down is a team pomodoro tracker. ICs start focus blocks of 15/25/45/60 minutes; teammates see who's heads-down on a shared board. Browser push nudges at block end. **Server is the source of truth for timers** — closing a tab doesn't stop a session. Free with a 50-team soft cap.

## 2. Primary user

The individual contributor. 5–30 person teams. Mobile 30% of the time. The team lead is a secondary user (read-only board view, no admin tools in v1).

## 3. Core flows

| Flow | Entry | Exit |
|---|---|---|
| Signup | magic-link request → one-click join | team board |
| Start session | board → "focus" button → duration picker | in-progress view |
| Watch teammates | board polling 30s | — |
| Receive nudge | browser push on session end | "break together" prompt |
| Invite | settings → copy link | teammate lands on join page |

## 4. Data model

- \`User\` — id, email, team_id, push_subscription, created_at
- \`Team\` — id, slug, name, created_at
- \`Session\` — id, user_id, duration_sec, started_at, ends_at, ended_at, status
- \`Membership\` — user_id, team_id, role (member/lead), joined_at

## 5. APIs

- \`POST /sessions/start\` → creates Session, returns ends_at
- \`POST /sessions/end\` → marks status=ended, fires push to teammates
- \`GET /teams/:id/board\` → cacheable, 30s TTL, returns array of in-progress sessions

## 6. Non-goals (v1)

- Websocket realtime (polling is fine)
- Native mobile apps (installable PWA is sufficient)
- Per-user analytics (team-level only)
- Slack bot (webhook later)

## 7. Open questions resolved during discovery

- Timezone display: **user-local** (answered Phase 1)
- Push permission UX: **prompt on first session, not signup** (answered Phase 2)
- Proration on paid tiers: **out of scope — no paid tier in v1**

## 8. Phase checkpoints

\`.checkpoints/app-architect.checkpoint.json\` captures phase 1–7 outcomes + the approval gate log. Restoring from any checkpoint resumes the session without context loss.`,
    },
    {
      id: "stack-decision",
      label: "Stack decision + scorecards",
      kind: "decision.md",
      body:
`# Stack Decision — Heads Down

**Produced by** stack-forge on behalf of app-architect, Phase 2.

## Scorecards (out of 10)

### Frontend candidates

| Candidate   | Mobile weight | Hydration cost | Tooling   | Hire pool | Total |
|-------------|--------------:|---------------:|----------:|----------:|------:|
| SvelteKit   | **9**         | **10**         | 8         | 7         | **34**|
| Next.js     | 6             | 6              | **10**    | **10**    | 32    |
| Remix       | 7             | 8              | 8         | 8         | 31    |
| Nuxt        | 7             | 7              | 7         | 7         | 28    |

**Pick:** SvelteKit. Smallest JS on mobile — the primary IC device 30% of the time. Hydration predictability matters for a visible timer.

### Backend candidates

| Candidate                   | Cold-start | Timer primitive | Cost@50 teams | Lock-in | Total |
|-----------------------------|-----------:|----------------:|--------------:|--------:|------:|
| CF Workers + D1 + DO        | **10**     | **10** (DO)     | **10** ($0)   | 7       | **37**|
| Fly.io + Postgres           | 6          | 8               | 6             | 9       | 29    |
| Supabase                    | 6          | 6               | 7             | 5       | 24    |

**Pick:** Cloudflare Workers + D1 + Durable Objects. DO is purpose-built for the server-authoritative timer. Free tier covers the 50-team soft cap.

## Anti-picks (rejected, with reason)

- **Next.js** — overkill; we don't need ISR, server actions, or their hydration tax for this UI.
- **Supabase** — 4 lock-in vectors (auth, DB, realtime, storage) with no corresponding win.
- **Firebase** — cost nonlinearity past the free tier; unclear exit strategy.
- **RDS Postgres** — ops overhead without the scale to justify it.

## Versions pinned

\`svelte@5.x\` · \`@sveltejs/kit@2.x\` · \`wrangler@4.x\` · \`drizzle-orm@0.36\` · \`resend@4.x\`

Checkpoint written to \`.checkpoints/stack-forge.checkpoint.json\`; app-architect reads it for Phase 3 design brief.`,
    },
    {
      id: "sprint-ledger",
      label: "Sprint ledger (Generator/Evaluator scores)",
      kind: "ledger",
      body:
`# Sprint Ledger — Heads Down

Generator proposes, Evaluator grades, loop repeats until ≥ 85. Each sprint written to \`.checkpoints/app-architect.checkpoint.json\` on completion.

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

## Aggregate

- **6 sprints** · **94 tests passing** · **2 re-evals** · **0 Evaluator overrides**
- Mean Evaluator score: **92**
- Median time per sprint (including re-evals): **17 minutes**

## What the Evaluator caught that Generator missed

1. \`/auth/request\` had no rate limit. Evaluator flagged after one-pass gen.
2. Push permission prompt ran on page load, not on user gesture — fails on iOS.
3. Team-slug collision path wasn't fuzz-tested; Evaluator mandated a unicode suite.
4. Billing "50 teams" was counted at request time — Evaluator pushed for a cached read.

Each fix costed < 90 s of Generator time. Checkpoint replayable.`,
    },
    {
      id: "pr-bundle",
      label: "Six draft PRs, one per sprint",
      kind: "pull-request",
      body:
`# Pull Request Bundle

All six PRs opened in draft by **git-ops**; descriptions auto-written from the sprint ledger. Filterable on the repo under label \`opchain-sprint\`.

\`\`\`
 #14  Sprint 1 · Auth + team creation         draft · +812 −0    · 22 tests · 4 files
 #15  Sprint 2 · Session timer (Durable Obj)  draft · +504 −31   · 14 tests · 6 files
 #16  Sprint 3 · Team board + polling         draft · +388 −18   · 11 tests · 5 files
 #17  Sprint 4 · Browser push + opt-in UX     draft · +221 −12   ·  9 tests · 3 files
 #18  Sprint 5 · Stripe Checkout + soft cap   draft · +406 −7    · 13 tests · 5 files
 #19  Sprint 6 · Empty states + /privacy      draft · +196 −44   · 25 tests · 9 files
\`\`\`

## Anatomy of #17 (representative)

\`\`\`
Title:   feat(push): browser push opt-in on first session

Summary:
- Request notification permission on the first \`/sessions/start\` interaction
  (iOS requires a user gesture — permission-on-load fails silently).
- Store the PushSubscription in \`User.push_subscription\`.
- \`POST /sessions/end\` enqueues pushes to every teammate via
  Web Push SDK + VAPID keys in env.

Test plan:
- [x] Permission prompt appears on first start, not on page load.
- [x] Denied permission does not block session start (graceful fallback).
- [x] Push payload is signed; server rejects unsigned replays.
- [x] Tab close during active session still triggers push at end.

Rollback:
- Flip \`FLAG_PUSH\` off in env. Existing sessions unaffected.
\`\`\`

All PRs opened in \`draft\` mode so the human reviewer can approve in order.`,
    },
    {
      id: "rollback-runbook",
      label: "Deploy + rollback runbook",
      kind: "runbook",
      body:
`# Heads Down — Deploy & Rollback Runbook

**Owner** deploy-ops checkpoint · Produced after Phase 7 ship handoff.

## Deploy

\`\`\`bash
# From main, with clean tree:
pnpm ci
pnpm build
wrangler deploy            # production
# Smoke:
curl -fsS https://headsdown.app/api/health | grep '"ok":true'
\`\`\`

A post-deploy GitHub Actions workflow auto-runs the 8-check smoke suite:

1. \`/api/health\` returns \`{ ok: true }\` with a version stamp.
2. \`/\` responds 200 with every required security header (CSP, HSTS, nosniff, X-Frame-Options, Referrer-Policy, Permissions-Policy).
3. \`/sessions/start\` (authed) returns \`ends_at\` in the future.
4. Durable Object timer ticks within 2s of expected.
5. Stripe webhook endpoint verifies a known-good signed payload.

Fails loudly on any regression — the deploy action exits non-zero and a Linear bug is auto-filed.

## Rollback (≤ 60s)

\`\`\`bash
wrangler deployments list
# Copy the last-known-good deployment id, then:
wrangler rollback <deployment-id>
\`\`\`

Cloudflare serves the previous code within ~30s. D1 migrations are forward-only; for a schema-rollback scenario, use the migration's own \`down()\` captured at build.

## Feature flags (graceful degrade)

- \`FLAG_PUSH\` — disable browser push without a code deploy.
- \`FLAG_BILLING\` — halt new subscriptions while keeping existing ones active.
- \`FLAG_SIGNUP\` — freeze new signups (protects the 50-team soft cap).

Flag flips propagate in ≤ 10s via Workers KV.

## Monitoring

- Cloudflare Web Analytics for pageviews (cookieless).
- Error budget: 0.1% 5xx over a rolling 1h window — exceeding pages via PagerDuty.
- Durable Object metrics in CF dashboard: alarm if timer-miss rate > 0.01%.`,
    },
  ],
  skills: ["app-architect", "stack-forge", "ux-engineer", "git-ops", "deploy-ops"],
  runtime: "≈ 22 exchanges",
  steps: [
    { type: "beat", label: "01 · Discover", caption: "app-architect runs the interview", skills: ["app-architect"] },

    {
      type: "exchange", role: "user",
      content: "I want to build a Pomodoro app for remote teams. Team members start a focus block, others see who's heads-down, and the app nudges them to break together."
    },
    {
      type: "exchange", role: "claude", skill: "app-architect",
      content:
`Recognized a new-app brief — invoking **app-architect** and loading \`orchestrator.md\`. No prior checkpoint found, so I'll start at Phase 1 (Discovery).

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
      type: "exchange", role: "claude", skill: "app-architect",
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
      type: "exchange", role: "claude", skill: "app-architect",
      content:
`Writing \`.checkpoints/app-architect.checkpoint.json\` — Phase 1 complete.

**Product summary (will become the spec's TL;DR):**

> **Heads Down** — a team pomodoro tracker. ICs start focus blocks of 15/25/45/60 minutes; teammates see who's heads-down on a shared board. Browser push nudges at block end. Server is the source of truth for timers; closing a tab doesn't stop a session. Free with a 50-team soft cap.

I'll advance to **Phase 2 — Spec + Stack**. Auto-invoking \`stack-forge\` for the stack decision. Type \`/approve\` to advance, or push back on anything in the summary.`
    },
    {
      type: "exchange", role: "user",
      content: "/approve"
    },

    { type: "beat", label: "02 · Spec + Stack", caption: "stack-forge picks the stack", skills: ["app-architect", "stack-forge"] },

    {
      type: "exchange", role: "claude", skill: "stack-forge",
      content:
`Invoked by app-architect with the Heads Down brief. I run three scorecards — frontend, backend, and infra — against the constraints (mobile-first, server-authoritative timers, 50-team soft cap, self-serve signup, Slack integration roadmap).

**Recommendation — v1 stack:**

| Layer        | Pick                           | Why                                                  |
|--------------|--------------------------------|------------------------------------------------------|
| Frontend     | SvelteKit + Tailwind           | Smallest JS on mobile; no hydration weirdness.       |
| Backend      | Cloudflare Workers + D1        | Free tier fits 50 teams; server-side timer is trivial with Durable Objects. |
| Auth         | Magic link via Resend          | No OAuth friction for a 5-person pilot.              |
| Realtime     | 30s polling                    | Matches your spec; websockets deferrable.            |
| Slack later  | Incoming webhooks (no bot yet) | One scope, no OAuth consent screen.                  |

**Anti-picks:** Next.js (overkill), Supabase (stack lock-in this early), Firebase (cost risk at scale), Postgres on RDS (infra we don't need yet).

Writing \`.checkpoints/stack-forge.checkpoint.json\`. Control returns to app-architect.`
    },
    {
      type: "exchange", role: "claude", skill: "app-architect",
      artifacts: ["master-spec", "stack-decision"],
      content:
`Spec drafted against the stack-forge output — 11 screens, 4 data models, 3 API surfaces. Full doc is 18 pages; here's the TL;DR of what you'd see on \`/export-spec\`:

- **Screens:** team board · new session · session-in-progress · session ended · join-via-link · settings · billing stub · 3 admin views
- **Models:** \`User\`, \`Team\`, \`Session\`, \`Membership\`
- **APIs:** \`POST /sessions/start\` · \`POST /sessions/end\` · \`GET /teams/:id/board\` (cacheable, 30s TTL)
- **Open questions:** (1) timezone display — team-local or user-local? (2) push permission UX — prompt on signup, on first session, or nudge card on the board?

Phase 2 checkpoint written. Ready for **Phase 3 — Design** (auto-invokes \`ux-engineer\`). \`/approve\` to advance.`
    },
    {
      type: "exchange", role: "user",
      content: "User-local for timezone. Push prompt on first session (not signup). /approve"
    },

    { type: "beat", label: "03 · Design", caption: "ux-engineer builds the style book", skills: ["app-architect", "ux-engineer"] },

    {
      type: "exchange", role: "claude", skill: "ux-engineer",
      content:
`Invoked by app-architect for Phase 3. Since this is a consumer-ish timer app without dense tabular data, I stay solo — \`dash-forge\` not needed.

**Design system — "Quiet Work":**
- **Palette:** Ink \`#1b1d1f\` / Mist \`#e9e6df\` / Leaf \`#2f8a57\` (focus) / Clay \`#d96b3a\` (alert). High contrast for at-a-glance board scanning.
- **Type:** Inter 560/400 for UI, JetBrains Mono for timers.
- **Key components:** \`FocusCard\`, \`TeamBoard\`, \`SessionTimer\`, \`NudgeToast\`.
- **Mobile frame:** 390×844; primary CTA bottom-center thumb zone.

Delivered: style book (18 tokens), wireframes (11 screens), Figma-equivalent prompts for hi-fi mocks. Evaluator loop (Generator → Evaluator harness) passes with 88/100 — deductions for mobile nav contrast at 4.4:1 (target 4.5:1).

Writing \`.checkpoints/ux-engineer.checkpoint.json\` with the style book. \`/approve\` to proceed to roadmap.`
    },
    {
      type: "exchange", role: "user",
      content: "/approve"
    },

    { type: "beat", label: "04 · Roadmap + Scaffold", caption: "sprint plan and runnable skeleton", skills: ["app-architect"] },

    {
      type: "exchange", role: "claude", skill: "app-architect",
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

    { type: "beat", label: "05 · Build", caption: "Generator → Evaluator sprint loop", skills: ["app-architect"] },

    {
      type: "exchange", role: "claude", skill: "app-architect",
      content:
`**Sprint 1 — Auth + team creation.** Running the Generator/Evaluator harness.

**Generator pass 1** — 23 files touched. Routes, DB schema, magic-link flow, landing page.
**Evaluator pass 1** — 72/100. Deductions: email validation too loose, no rate-limit on \`/auth/request\`, team-slug collision untested.
**Generator pass 2** — tightened validation, added KV-backed rate limit, fuzz test on team-slug.
**Evaluator pass 2** — 94/100. Ship it.

Writing checkpoint. Next sprint? Say \`/build\` to continue, \`/status\` for the scoreboard, or \`/approve\` to auto-run all remaining sprints back-to-back.`
    },
    {
      type: "exchange", role: "user",
      content: "Run all remaining sprints. /approve"
    },
    {
      type: "exchange", role: "claude", skill: "app-architect",
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

All green. Invoking **git-ops** with the full sprint ledger.`
    },

    { type: "beat", label: "06 · Ship", caption: "git-ops → deploy-ops", skills: ["git-ops", "deploy-ops"] },

    {
      type: "exchange", role: "claude", skill: "git-ops",
      artifacts: ["pr-bundle"],
      content:
`Reading app-architect's checkpoint — 6 sprints, 94 passing tests, no outstanding blockers.

Creating branches \`sprint/1-auth\` … \`sprint/6-polish\`, one PR per sprint, each with generated descriptions + test plan. Draft mode on all six so you can review.

\`\`\`
 #14  Sprint 1 · Auth + team creation     draft · +812 −0   · 22 tests
 #15  Sprint 2 · Session timer            draft · +504 −31  · 14 tests
 #16  Sprint 3 · Team board + polling     draft · +388 −18  · 11 tests
 #17  Sprint 4 · Browser push             draft · +221 −12  ·  9 tests
 #18  Sprint 5 · Stripe Checkout          draft · +406 −7   · 13 tests
 #19  Sprint 6 · Polish                   draft · +196 −44  · 25 tests
\`\`\`

Handing off to **deploy-ops** for the preview + staging pipeline.`
    },
    {
      type: "exchange", role: "claude", skill: "deploy-ops",
      content:
`Reading git-ops checkpoint. Building preview deployments for each PR, running the Cloudflare Workers + D1 migration dry-run, wiring the staging secrets.

\`\`\`
 heads-down-staging.workers.dev   deployed · 42 KB worker · TTFB 38ms
 D1 migration dry-run             6 migrations · 0 conflicts · 0 destructive ops
 smoke suite (18 checks)          all green
 security headers                 CSP, HSTS, nosniff, Frame-Options all present
\`\`\`

Staging is live. Production deploy is one \`/launch\` away — but give it 24h soak first. Writing \`.checkpoints/deploy-ops.checkpoint.json\` with the staging URL + a rollback runbook.`,
      artifacts: ["rollback-runbook"],
    },
    {
      type: "exchange", role: "user",
      content: "Soaked fine overnight. /launch"
    },
    {
      type: "exchange", role: "claude", skill: "deploy-ops",
      content:
`Promoting staging → production. DNS \`headsdown.app\` points at the prod worker. Post-deploy smoke: all green. Error budget: 0 requests 5xx'd in the first 60 minutes.

**Summary — end of session:**
- **Time elapsed:** 3h 41m of chat, mostly spent on design.
- **Code shipped:** 2,627 lines across 6 PRs, 94 tests passing.
- **Infra cost:** \`$0\` (Workers free tier fits the 50-team soft cap).
- **Next natural phase:** \`scale-ops\` advisory when you hit ~30 teams; \`integrations-engineer\` whenever you're ready for the Slack bot.

Congrats — you shipped. 🚀`
    },
  ],
};

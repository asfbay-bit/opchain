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
  summary:
    "A solo founder types an idea and ends the session with a deployed app. Watch app-architect drive every phase, auto-invoke the specialists it needs, and hand off to git-ops and deploy-ops at the end.",
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

Staging is live. Production deploy is one \`/launch\` away — but give it 24h soak first. Writing \`.checkpoints/deploy-ops.checkpoint.json\` with the staging URL + a rollback runbook.`
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

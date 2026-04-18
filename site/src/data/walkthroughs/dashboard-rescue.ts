import type { Walkthrough } from "./types";

/**
 * Scenario 2 — ux-engineer detects a data-heavy surface and hands off to
 * dash-forge. Demonstrates the specialist routing pattern: ux-engineer
 * stays in control of the overall style book but calls in the Tufte-density
 * specialist for the dense screen.
 */
export const dashboardRescue: Walkthrough = {
  id: "dashboard-rescue",
  title: "Dashboard rescue — dense data, designed right",
  tagline: "Dense data, designed right",
  summary:
    "A 14-chart dashboard nobody uses becomes a 3-layer OKR view nobody can ignore.",
  description:
    "The analytics screen was a 'kitchen sink' — 14 charts, 4 tabs, zero hierarchy. Team leads said they didn't know where to look. ux-engineer reads the screenshot, identifies this as a **density problem** not a visual-design problem, and hands off to dash-forge — the Tufte-density specialist — for the rebuild. The rest of the style book stays intact; only the problem screen changes. ux-engineer grades the output against the existing design system and queues a single-sprint implementation on app-architect behind a feature flag.",
  inputs: [
    "Existing production SaaS (Next.js + Postgres)",
    "Screenshot + Figma of the current 14-chart screen",
    "Primary user: founder/team-lead on a weekly cadence, 30% mobile",
    "Primary question (discovered via ux-engineer): \"Are we on track for this quarter's OKRs?\"",
  ],
  outputs: [
    {
      id: "dashboard-principles",
      label: "Density principles + screen audit",
      kind: "audit.md",
      body:
`# Old dashboard — audit

Produced by **ux-engineer** before invoking dash-forge.

## What's wrong (top offenders)

1. **14 charts, all equal visual weight.** Nothing cues the reader where to start.
2. **Redundant encoding.** MAU is shown three different ways (count, trend, heatmap). Pick one.
3. **Typography collapse.** Chart titles and axis labels are both 14px. No hierarchy between "what this chart is" and "what this number is."
4. **Color is noise.** 9 distinct hues across 14 charts. Red is used for "good" in one (low error rate) and "bad" in another (high churn).
5. **No small multiples.** Every trend comparison is a full-width chart. Two charts can't be compared at a glance because they're not spatially adjacent or scale-aligned.
6. **Accessibility gap.** Three charts sit below WCAG AA for text contrast (3.1–3.9:1; target ≥ 4.5:1).

## Principles that will drive the rebuild

- **One question, one answer, top-of-fold.**
- **Small multiples over big singles** for comparison.
- **Data-ink ratio.** No 3D, no gradient fills, no chart shadows.
- **Color = meaning.** Three hues max, each with semantic weight (on-track / at-risk / off-track).
- **Consistent baselines.** If two charts are comparable, their y-axes share a scale.
- **Mobile-first.** 390×844 reference frame; the primary layer must fit above the fold.

Handing off to **dash-forge** with the "Are we on track for this quarter's OKRs?" brief.`,
    },
    {
      id: "dashboard-layers",
      label: "3-layer information architecture",
      kind: "ia.md",
      body:
`# Heads Down Dashboard — 3-layer IA

Produced by **dash-forge** after accepting the brief from ux-engineer.

## Layer 0 — Weekly summary (above-the-fold, 3 lines)

Plain text, no chart. Three bullets auto-written by the existing nightly job. Example:

> **This week · Tue 18 Oct**
> Signups up **+18%** week-over-week (leading OKR #3 on track).
> Retention day-7 flat at **42.1%** (lagging OKR #1 slipping — needs attention).
> Support tickets down **−12%** (leading OKR #5 on track).

## Layer 1 — OKR rows (the hero)

One horizontal bar **per OKR**. Target line, current value, trajectory-at-current-pace. Eight OKRs fit above the fold on mobile (390w).

\`\`\`
 OKR 1  ⊢  Retention day-7 ≥ 45%          ██████████░░░░░░  42.1  ← target 45    on-track? no
 OKR 2  ↗  Weekly signups  ≥ 600/wk        ████████████████  710   ← target 600   on-track? yes
 OKR 3  ↗  NPS             ≥ 40            █████████████░░░  36    ← target 40    on-track? trending yes
 ...
\`\`\`

\`↗\` = leading indicator · \`⊢\` = lagging indicator (glyph + tooltip; no new color).

## Layer 2 — Context strip (the supporting cast)

2×4 grid of small multiples. Each cell: sparkline + last-value + 7d-change. Baseline y-axes normalized to their own max for shape comparison; exact values shown numerically. Not charts in the usual sense — data strips.

## Layer 3 — Deep-dive (on demand)

Clicking an OKR row opens a drawer with **three** charts max:
1. Historical trend vs. plan.
2. Contributing subcomponents (stacked area).
3. Cohort view (small multiples).

No tabs. No nesting. If a fourth chart is needed, the OKR is probably two OKRs.

## Component catalog

- \`WeekSummary\` — Layer 0
- \`OkrRow\` — Layer 1
- \`SmallMultiple\` — Layer 2
- \`OkrDrawer\` — Layer 3

All components accessible by keyboard; drawer respects \`prefers-reduced-motion\`.`,
    },
    {
      id: "dashboard-grade",
      label: "Before/after Evaluator grade",
      kind: "eval.md",
      body:
`# Evaluator Grade — Old vs. New

Scored against the Heads Down style book by the **ux-engineer** Evaluator agent.

## Old dashboard

- **Data-ink ratio:** 0.32 (lots of chrome, shadows, gradients)
- **Hierarchy signal:** 1.1 (almost flat)
- **Color semantic consistency:** 0.4 (same hue used for different meanings)
- **WCAG AA pass rate:** 11/14 charts
- **"Single question" test:** FAIL (user can't identify the primary KPI in < 10s)
- **Overall:** **61 / 100**

## New dashboard (dash-forge)

- **Data-ink ratio:** 0.71
- **Hierarchy signal:** 3.4 (three-layer pyramid holds up under eye-tracking sim)
- **Color semantic consistency:** 1.0 (three hues, one semantic each)
- **WCAG AA pass rate:** 14/14
- **"Single question" test:** PASS — Layer 0 + Layer 1 answer the OKR question in < 2s.
- **Overall:** **96 / 100** (−4 for a 2px baseline misalignment at 390w; fixed in the build sprint)

## Deductions resolved post-handoff

1. **Baseline misalignment at 390w** — patched in the build sprint via a \`measureText\`-driven first-pass offset.
2. **Drawer close-button tap target** — bumped from 32×32 to 44×44 for mobile.
3. **Screen-reader order** — Layer 0 text is now first in source order so a blind user hears the weekly summary before navigating the OKR rows.`,
    },
    {
      id: "dashboard-sprint",
      label: "Single-sprint implementation brief",
      kind: "sprint.md",
      body:
`# Sprint Brief — New Dashboard

Queued on **app-architect** as a one-sprint ship. No migrations. Reuses existing \`/api/metrics\`.

## Scope

- Replace \`/dashboard\` (single route).
- **3 new components:** \`OkrRow\`, \`SmallMultiple\`, \`WeekSummary\`.
- **1 new view:** \`OkrDrawer\`.
- **No backend changes.** The existing \`/api/metrics\` endpoint already returns the shape we need.

## Feature flag

\`FLAG_NEW_DASHBOARD\` — default off. Rollout: internal team → 10% → 50% → 100% over 2 weeks, with a kill-switch.

## Acceptance criteria

- [ ] Evaluator score ≥ 90 on the merged build
- [ ] Lighthouse mobile performance ≥ 85 (current dashboard: 62)
- [ ] WCAG AA pass rate = 100%
- [ ] Old dashboard remains accessible at \`/dashboard/legacy\` during rollout
- [ ] \`FLAG_NEW_DASHBOARD\` off → old view still renders without regression

## Generator/Evaluator target

Single pass expected (≤ 1 re-eval). Expected runtime 35 min end-to-end.

## Rollback plan

Flip the flag off. Legacy dashboard code stays in the tree for one full release cycle, then removed.`,
    },
  ],
  skills: ["ux-engineer", "dash-forge"],
  runtime: "≈ 12 exchanges",
  steps: [
    { type: "beat", label: "01 · Triage", caption: "ux-engineer reads the screen", skills: ["ux-engineer"] },

    {
      type: "exchange", role: "user",
      content:
`My analytics dashboard is a mess. 14 charts, 4 tabs, users say they "don't know where to look." Here's the screenshot + the current Figma:

[image: kitchen-sink-dashboard.png]
[figma: https://figma.com/file/abc/saas-analytics]

Can we make this actually usable?`
    },
    {
      type: "exchange", role: "claude", skill: "ux-engineer",
      content:
`Pulled the screenshot and the Figma. Recognizing this as a **data-density problem**, not a visual-design problem — so ux-engineer drives the overall system but I'll invoke **dash-forge** for the actual screen redesign in a moment.

**First pass — what I see:**

- 14 charts, all ~equal visual weight, zero hierarchy.
- 5 of 14 encode redundant data (MAU shown 3 different ways).
- Axis labels are 14px; chart titles are 14px; can't tell what's a label from 10ft away.
- No small multiples — every trend comparison is a full-width chart.
- Color: 9 unique hues, none of them tied to a semantic (red used for "good" in one chart, "bad" in another).

Before redesigning, two questions:

**1. What's the single question this dashboard has to answer?** (every dashboard needs one — if yours is "health of the business," say that; if it's "am I off track this week," say that).
**2. Who's the primary user — exec who glances once a week, or IC who lives in it?**`
    },
    {
      type: "exchange", role: "user",
      content:
`Primary question: "Is my team on track to hit this quarter's OKRs?"
Primary user: founders + team leads, weekly check-in, mobile 30% of the time.`
    },
    {
      type: "exchange", role: "claude", skill: "ux-engineer",
      artifacts: ["dashboard-principles"],
      content:
`Clear brief. This is tri-agent territory — I'll invoke **dash-forge** (the density specialist) with the OKR-focused framing, then I'll grade the output against the style book.

Writing \`.checkpoints/ux-engineer.checkpoint.json\` with the brief + handing off.`
    },

    { type: "beat", label: "02 · dash-forge", caption: "density specialist takes over", skills: ["dash-forge"] },

    {
      type: "exchange", role: "claude", skill: "dash-forge",
      content:
`Invoked by ux-engineer. Brief: **"Is my team on track to hit this quarter's OKRs?"** for founders/leads on a weekly cadence, 30% mobile.

**Principles I'll apply** (Tufte, Few, Cleveland — the canon):

1. **One question, one answer, top-of-fold.** Everything else earns its place below.
2. **Small multiples over big singles.** 12 tiny charts beat 4 big ones for comparison.
3. **Data-ink ratio.** Remove every pixel that isn't data. No 3D. No gradients. No drop shadows on charts.
4. **Color = meaning.** Three hues max, each carrying semantic weight.
5. **Consistent baselines.** If two charts are comparable, their y-axes share a scale.

**Proposed redesign — 3 layers:**

- **Layer 1 (hero):** A single horizontal bar per OKR — target line, current, trajectory-at-current-pace. Eight OKRs fit above the fold on mobile.
- **Layer 2 (context):** 2×4 small multiples of the leading indicators, sparkline + last-value + 7d-change. Not charts — data strips.
- **Layer 3 (deep-dive):** Click any OKR → drawer with 3 charts, max. No tabs.

Delivering wireframes + the component spec. Writing \`.checkpoints/dash-forge.checkpoint.json\`.`,
      artifacts: ["dashboard-layers"],
    },
    {
      type: "exchange", role: "user",
      content:
`Love it. Two concerns:

1. Some OKRs are leading, some lagging. Users want to know which is which.
2. We also need a "what changed this week" section — not a chart, a list.`
    },
    {
      type: "exchange", role: "claude", skill: "dash-forge",
      content:
`Both land cleanly in the system.

**Leading vs. lagging:** each OKR row gets a prefix glyph — \`↗\` for leading, \`⊢\` for lagging — tied to a legend tooltip. No new color; glyphs preserve the 3-hue cap.

**"What changed this week":** a Layer 0, above Layer 1. Three-line summary auto-written by your existing nightly job, rendered as plain text with inline numbers in \`JetBrains Mono\`. Example:

> **This week · Tue 18 Oct**
> Signups up **+18%** week-over-week (leading OKR #3 on track).
> Retention day-7 flat at **42.1%** (lagging OKR #1 slipping — needs attention).
> Support tickets down **−12%** (leading OKR #5 on track).

Three bullets. No chart. Reads like a newsletter. Updating the wireframes, re-running the Evaluator.

**Evaluator:** 94/100 (deduction: small-multiples baseline alignment off by 2px at 390w; trivial fix).`
    },

    { type: "beat", label: "03 · Handback", caption: "ux-engineer integrates + grades", skills: ["ux-engineer"] },

    {
      type: "exchange", role: "claude", skill: "ux-engineer",
      content:
`Resuming from the ux-engineer checkpoint. Reading dash-forge's output.

**Integration pass:**
- Style-book tokens absorbed (no new color; only the semantic mapping of existing neutrals).
- Component catalog updated: \`OkrRow\`, \`SmallMultiple\`, \`WeekSummary\` added; old \`ChartCard\` deprecated.
- Accessibility audit: contrast ratios all ≥ 4.6:1 (your old one had 3 charts below WCAG AA).

**Style-book grade on the new screen: 96/100** — vs. 61/100 for the old kitchen-sink version. Net data-ink ratio doubled; the "single question" test passes (an exec who glances once a week sees their OKR status in under 2 seconds).

Writing consolidated checkpoint. Hand back to you — or say \`/implement\` and I'll spin up an app-architect sprint to build the new screen in your existing Next.js app.`,
      artifacts: ["dashboard-grade"],
    },
    {
      type: "exchange", role: "user",
      content: "/implement"
    },
    {
      type: "exchange", role: "claude", skill: "ux-engineer",
      content:
`Handing off to app-architect with the new design as a single-sprint brief:

- **Scope:** replace \`/dashboard\` (one route, no migrations).
- **New components:** 3 (OkrRow, SmallMultiple, WeekSummary).
- **Data:** reuse existing \`/api/metrics\` — no backend changes.
- **Acceptance:** Evaluator ≥ 90, Lighthouse mobile ≥ 85, feature-flag behind \`FLAG_NEW_DASHBOARD\` so you can A/B against the old one.

app-architect checkpoint written. Ready for you to \`/build\` when you are.`,
      artifacts: ["dashboard-sprint"],
    },
  ],
};

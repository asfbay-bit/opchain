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
  summary:
    "A SaaS team has a 'kitchen sink' analytics screen that no one uses. ux-engineer diagnoses, then routes the data-heavy screen to dash-forge for a Tufte-density rebuild.",
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

Delivering wireframes + the component spec. Writing \`.checkpoints/dash-forge.checkpoint.json\`.`
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

Writing consolidated checkpoint. Hand back to you — or say \`/implement\` and I'll spin up an app-architect sprint to build the new screen in your existing Next.js app.`
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

app-architect checkpoint written. Ready for you to \`/build\` when you are.`
    },
  ],
};

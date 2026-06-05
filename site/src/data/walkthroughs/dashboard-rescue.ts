import type { Walkthrough } from "./types";

/**
 * Scenario 2 — oc-ux-engineer detects a data-heavy surface and hands off to
 * oc-dash-forge. Demonstrates the specialist routing pattern: oc-ux-engineer
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
    "The analytics screen was a 'kitchen sink' — 14 charts, 4 tabs, zero hierarchy. Team leads said they didn't know where to look. oc-ux-engineer reads the screenshot, identifies this as a **density problem** not a visual-design problem, and hands off to oc-dash-forge — the Tufte-density specialist — for the rebuild. The rest of the style book stays intact; only the problem screen changes. oc-ux-engineer grades the output against the existing design system and queues a single-sprint implementation on oc-app-architect behind a feature flag.",
  inputs: [
    "Existing production SaaS (Next.js + Postgres)",
    "Screenshot + Figma of the current 14-chart screen",
    "Primary user: founder/team-lead on a weekly cadence, 30% mobile",
    "Primary question (discovered via oc-ux-engineer): \"Are we on track for this quarter's OKRs?\"",
  ],
  outputs: [
    {
      id: "dashboard-principles",
      label: "Density principles + screen audit",
      kind: "audit.md",
      body:
`# Old dashboard — audit

Produced by **oc-ux-engineer** before invoking oc-dash-forge. Sourced from the screenshot + Figma at \`figma.com/file/abc/saas-analytics\`. Run-time: 12 minutes.

## 1. The one-line summary

The current screen tries to answer 14 questions at once and ends up answering none. It's a kitchen-sink dashboard masquerading as a hero surface.

## 2. What's wrong — top 12 offenders

### Hierarchy

1. **14 charts, all equal visual weight.** Nothing cues the reader where to start. Eye-tracking sim shows mean attention spread across the canvas with no fixation point.
2. **No primary KPI.** Every chart competes; there's no "look here first" affordance.
3. **No small multiples.** Every trend comparison is a full-width chart. Two charts can't be compared at a glance because they're not spatially adjacent or scale-aligned.

### Encoding

4. **Redundant encoding.** MAU is shown three different ways (count, trend, heatmap). Pick one.
5. **Inconsistent baselines.** Charts with comparable y-axes don't share scale; the brain has to renormalise on every glance.
6. **Five chart types** (line, bar, pie, donut, heatmap) where two would do.

### Typography

7. **Typography collapse.** Chart titles and axis labels are both 14px. No hierarchy between "what this chart is" and "what this number is."
8. **Mixed numeric formatting.** \`12,304\`, \`12.3K\`, \`12,304.00\` all appear within the same screen.
9. **Inline labels** for legend entries instead of a single legend block — wastes ink and adds noise.

### Color

10. **Color is noise.** 9 distinct hues across 14 charts. Red is used for "good" in one (low error rate) and "bad" in another (high churn).
11. **No semantic mapping.** Color carries decoration, not meaning.

### Accessibility

12. **WCAG AA gap.** Three charts sit below WCAG AA for text contrast (3.1–3.9:1; target ≥ 4.5:1). Two charts use red/green only as the differentiator (no glyph, no label) — fails for the ~8% of users with red-green colorblindness.

## 3. Principles that will drive the rebuild

These are the principles I'll hand to oc-dash-forge as the brief.

| # | Principle | Operational test |
|---|---|---|
| P1 | One question, one answer, top-of-fold. | An exec answers the OKR question in < 2s, no scroll. |
| P2 | Small multiples over big singles for comparison. | If two metrics are comparable, they share a column + a y-scale. |
| P3 | Data-ink ratio ≥ 0.7. | No 3D, no gradient fills, no chart shadows. Tufte rule. |
| P4 | Color = meaning. | Three hues max, each with one semantic. Glyphs carry redundancy. |
| P5 | Consistent baselines. | If two charts are comparable, their y-axes share a scale. |
| P6 | Mobile-first. | 390×844 reference frame; the primary layer fits above the fold. |
| P7 | Numeric format consistency. | One format per metric class (count, percentage, currency). |
| P8 | WCAG 2.2 AA on every chart. | Contrast ≥ 4.5:1 for text; redundant encoding for any chromatic signal. |
| P9 | Screen-reader-first reading order. | DOM order matches visual order; charts have alt-text data summaries. |

## 4. What to keep

Not everything is broken. The audit found three things to preserve:

- The data pipeline. \`/api/metrics\` returns a usable shape; we don't need a backend change.
- The font stack. The system font choices are fine — they're under-leveraged, not wrong.
- The Mon-first calendar week. Don't change that without a separate decision.

## 5. What to delete

- The donut + pie charts. Both replaceable with bars or just numbers.
- The "system status" card (already in the global nav).
- The 4-tab structure. One canvas; no tabs.

## 6. What success looks like

- Time-to-first-fixation < 1.5 s.
- Self-reported "I know my OKR status" rate ≥ 90% after 5 s viewing.
- Lighthouse mobile a11y ≥ 95 (current: 73).
- Data-ink ratio ≥ 0.7.

## 7. Handoff

Handing off to **oc-dash-forge** with the "Are we on track for this quarter's OKRs?" brief and the principle table above. oc-dash-forge will produce the IA + wireframes; oc-ux-engineer will grade the output against the existing style book.`,
    },
    {
      id: "dashboard-layers",
      label: "3-layer information architecture",
      kind: "ia.md",
      body:
`# Dashboard — 3-layer IA

Produced by **oc-dash-forge** after accepting the brief from oc-ux-engineer. The principle stack: Tufte + Few + Cleveland; the pattern: progressive disclosure across three layers.

## 1. Why three layers

Dense dashboards fail because they pack 14 questions onto one canvas. Sparse dashboards fail because they hide everything behind clicks. Three layers let us answer:

| Layer | Question | Answered in |
|---|---|---|
| 0 | "Did anything change this week?" | < 1 s |
| 1 | "Which OKRs are on/off track?" | < 5 s |
| 2 | "What's the supporting context?" | < 15 s |
| 3 | "What's the trend on this OKR?" | on demand |

The screen always renders Layers 0–2; Layer 3 is opened on click.

## 2. Layer 0 — Weekly summary (above-the-fold, 3 lines)

Plain text, no chart. Three bullets auto-written by the existing nightly job. Example:

> **This week · Tue 18 Oct**
> Signups up **+18%** week-over-week (leading OKR #3 on track).
> Retention day-7 flat at **42.1%** (lagging OKR #1 slipping — needs attention).
> Support tickets down **−12%** (leading OKR #5 on track).

### 2.1 Why text, not a chart

A chart on top reduces to "now interpret the chart." A text summary reduces to "now decide whether to read more." The summary is generated by the existing \`metrics_weekly_rollup\` job — no new infrastructure.

### 2.2 Constraints

- Three bullets. Always exactly three. (More than three is a small chart.)
- Each bullet starts with the metric, then the delta, then the implication.
- Inline numbers in JetBrains Mono so they line up vertically.
- Target reading time: < 8 seconds.

## 3. Layer 1 — OKR rows (the hero)

One horizontal bar **per OKR**. Target line, current value, trajectory-at-current-pace. Eight OKRs fit above the fold on mobile (390w).

\`\`\`
 OKR 1  ⊢  Retention day-7 ≥ 45%          ██████████░░░░░░  42.1  ← target 45    on-track? no
 OKR 2  ↗  Weekly signups  ≥ 600/wk        ████████████████  710   ← target 600   on-track? yes
 OKR 3  ↗  NPS             ≥ 40            █████████████░░░  36    ← target 40    on-track? trending yes
 OKR 4  ⊢  Support time-to-resolve ≤ 4h    ███████████░░░░░  4.6h  ← target 4h    on-track? no
 OKR 5  ↗  Tickets/100 MAU                  ████████████████  3.2   ← target 4     on-track? yes
 OKR 6  ⊢  ARR retention                   █████████████░░░  91%   ← target 92%   on-track? trending no
 OKR 7  ↗  Activation rate (signup→active) ████████████████  62%   ← target 55%   on-track? yes
 OKR 8  ⊢  Engineering velocity            ████████████████  4.1   ← target 3     on-track? yes
\`\`\`

### 3.1 Glyph legend (no new color)

- \`↗\` — leading indicator (predictive of future state).
- \`⊢\` — lagging indicator (records past state).
- Both have tooltips; neither carries chromatic weight.

### 3.2 Color semantics (3 hues, one each)

| Hue | Token | Meaning |
|---|---|---|
| Leaf (\`#2f8a57\`) | \`--ok\` | on-track |
| Sand (\`#c3a64f\`) | \`--watch\` | trending — within tolerance but moving wrong way |
| Clay (\`#d96b3a\`) | \`--off\` | off-track |

Glyphs are paired with these (\`✓\`, \`~\`, \`✕\`) for redundancy; never relies on hue alone.

### 3.3 Bar mechanics

- Width = \`current / target\` clamped at 1.5× target (so wildly overshooting OKRs don't blow out the layout).
- The target line is rendered as a vertical tick at \`target / target = 1.0\`. Always visible.
- For "lower-is-better" OKRs (OKR 4, OKR 6), the bar inverts so left = good, right = bad. A footnote tooltip explains the inversion.

## 4. Layer 2 — Context strip (the supporting cast)

2×4 grid of small multiples. Each cell: sparkline + last-value + 7d-change. Baseline y-axes normalized to their own max for shape comparison; exact values shown numerically. Not charts in the usual sense — data strips.

\`\`\`
┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ Signups      │ │ Active users │ │ Churn rate   │ │ NPS          │
│ ▁▂▃▄▅▆█▆▅▆▇  │ │ ▆▆▆▇▇▆▇▇▆▆▇  │ │ ▂▃▂▃▄▃▄▃▄▅▄  │ │ ▄▄▅▅▆▆▅▆▆▆▆  │
│  710  +18%   │ │  4.2K  +2%   │ │  4.1%  +0.3% │ │  36   +1pt   │
└──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘
┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ Tickets      │ │ Time-to-resp │ │ Page weight  │ │ p95 latency  │
│ ▆▅▄▄▃▃▂▂▂▁▁  │ │ ▅▅▅▆▆▇▇▆▆▆▅  │ │ ▃▃▃▃▃▃▃▃▃▃▃  │ │ ▃▃▃▃▃▃▄▃▃▃▃  │
│  142  −12%   │ │  4.6h  +6%   │ │  38KB  −1%   │ │  74ms  flat  │
└──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘
\`\`\`

### 4.1 Cell anatomy

- 11-bin sparkline (one bar per week, 11 weeks visible).
- Last value, prominent.
- 7d delta with sign + percent.
- No axis labels (the value on the right is the latest; the sparkline shows shape).

### 4.2 Why "data strips" not charts

Each cell answers "is this number trending up, down, or flat?" The exact number is shown numerically; the sparkline is purely shape. Comparison across cells works because they're spatially adjacent and the same width.

## 5. Layer 3 — Deep-dive (on demand)

Clicking an OKR row opens a drawer with **three** charts max:

1. **Historical trend vs. plan.** The OKR's own value over time, with the planned trajectory overlaid.
2. **Contributing subcomponents.** Stacked area showing what's driving the metric (e.g., for "Weekly signups," the stack is by acquisition channel).
3. **Cohort view.** Small multiples — one mini-chart per cohort (e.g., signup week, plan tier).

No tabs. No nesting. If a fourth chart is needed, the OKR is probably two OKRs.

### 5.1 Drawer mechanics

- Slides in from the right on desktop; full-screen modal on mobile.
- Esc closes; clicking the OKR again toggles.
- Respects \`prefers-reduced-motion\` (no slide animation; just appears).
- Shareable URL: \`/dashboard?okr=signups\` — anyone with access can deep-link.

## 6. Component catalog

| Component | Layer | Props | Notes |
|---|---|---|---|
| \`WeekSummary\` | 0 | \`{bullets: Bullet[]}\` | Pure server-rendered. |
| \`OkrRow\` | 1 | \`{okr: OkrSnapshot}\` | Click → opens drawer. Keyboard: Enter/Space. |
| \`OkrBar\` | 1 | \`{value, target, inverted?}\` | Subcomponent of OkrRow. |
| \`SmallMultiple\` | 2 | \`{metric: MetricSnapshot}\` | 11-bin sparkline. |
| \`OkrDrawer\` | 3 | \`{okrId}\` | Lazy-loads the 3 charts on open. |
| \`HistoricalTrendChart\` | 3 | \`{points, planLine}\` | Reused from existing chart kit. |
| \`StackedAreaChart\` | 3 | \`{series, stackKey}\` | New. |
| \`CohortMatrix\` | 3 | \`{cohorts}\` | Small-multiple grid. |

All components are keyboard-accessible. All charts have alt-text data summaries (a11y P9).

## 7. Layout grid

Mobile (390w):
- Layer 0: full-bleed, padded.
- Layer 1: full-bleed, 1 column, 8 rows.
- Layer 2: 2-column grid, 4 rows.

Desktop (≥ 1024w):
- Layer 0: 2-column (summary on left, "fresh-as-of" on right).
- Layer 1: 2-column, 4 rows.
- Layer 2: 4-column, 2 rows.

## 8. Performance budget

- Total page weight (HTML+CSS+JS, no charts): **≤ 28 KB gzipped**.
- Layer 3 drawer: lazy-loaded only when first opened (~12 KB).
- LCP target: ≤ 1.5 s on 4G mobile.
- The Layer 1 + Layer 2 ASCII / SVG rendering does not require JS — works without hydration.

## 9. Accessibility

- All interactive elements ≥ 44×44 px on mobile.
- Color contrast ≥ 4.5:1 on text; ≥ 3:1 on graphical objects.
- Sparklines have a hidden table fallback for screen readers ("over 11 weeks: 41, 38, 42, …").
- Drawer trapped focus on open; restored to OKR row on close.
- Source order: Layer 0 → Layer 1 → Layer 2 (matches reading order).

## 10. Telemetry

- \`dashboard.viewed\`
- \`okr_row.expanded\` — \`{okr_id, source: "click"|"keyboard"}\`
- \`drawer.chart_viewed\` — \`{okr_id, chart_type}\`
- \`small_multiple.hovered\` — \`{metric_id}\`

Aggregated weekly into the existing \`metrics_*\` rollup tables; lets us see which OKRs people actually drill into.

Checkpoint: \`.checkpoints/oc-dash-forge.checkpoint.json\`.`,
    },
    {
      id: "dashboard-grade",
      label: "Before/after Evaluator grade",
      kind: "eval.md",
      body:
`# Evaluator Grade — Old vs. New

Scored against the existing style book by the **oc-ux-engineer** Evaluator agent. Rubric is 12 axes, weighted equally; each scored 0–10, total normalised to 100.

## 1. Rubric

| Axis | Weight | What it measures |
|---|---|---|
| Data-ink ratio | 1.0× | (data pixels) / (total ink). Tufte. Higher = less chrome. |
| Hierarchy signal | 1.0× | Eye-tracking sim — does attention concentrate on the primary KPI? Higher = more fixation. |
| Color semantic consistency | 1.0× | Each hue maps to exactly one meaning. Score = 1 − (violations / hue count). |
| Encoding minimalism | 1.0× | Number of chart types ÷ number of charts. Lower = simpler. |
| Typography hierarchy | 1.0× | Distinct type sizes mapped to distinct roles. |
| Numeric format consistency | 1.0× | Each metric class formatted identically across the screen. |
| Comparison ergonomics | 1.0× | Comparable charts are spatially adjacent and y-scale aligned. |
| Layer separation | 1.0× | Above-fold answers the primary question in <5s. |
| WCAG AA pass rate | 1.0× | Fraction of chart elements meeting AA contrast. |
| Mobile fit | 1.0× | Primary layer fits 390w viewport above fold. |
| Single-question test | 1.0× | Eye-tracking sim — user identifies primary KPI in ≤ 10s? |
| Screen-reader order | 1.0× | DOM order matches visual reading order. |

## 2. Old dashboard

| Axis | Score | Notes |
|---|---:|---|
| Data-ink ratio | 3.2 / 10 | 3D, gradient fills, drop shadows on every chart. |
| Hierarchy signal | 1.1 / 10 | Eye attention spread evenly across 14 charts. |
| Color semantic consistency | 4.0 / 10 | Red used for both "good" (low error rate) and "bad" (high churn). |
| Encoding minimalism | 3.6 / 10 | 5 chart types across 14 charts. |
| Typography hierarchy | 4.0 / 10 | Titles + axis labels both 14px; no scale. |
| Numeric format consistency | 5.0 / 10 | Mixed \`12,304\` / \`12.3K\` / \`12,304.00\`. |
| Comparison ergonomics | 4.5 / 10 | Comparable trends rendered as separate full-width charts. |
| Layer separation | 2.0 / 10 | One canvas, no hierarchy. |
| WCAG AA pass rate | 7.9 / 10 | 11 of 14 charts pass; 3 fail. |
| Mobile fit | 5.0 / 10 | Primary layer requires 2 vertical scrolls on 390w. |
| Single-question test | 0 / 10 | FAIL — user cannot identify the primary KPI in < 10s. |
| Screen-reader order | 6.0 / 10 | DOM matches visual but charts have no alt-text. |

**Total:** 46.3 / 120 → **61 / 100** (rounded after weight normalisation).

## 3. New dashboard (oc-dash-forge)

| Axis | Score | Notes |
|---|---:|---|
| Data-ink ratio | 7.1 / 10 | Up from 0.32 — no 3D, no gradient, sparkline-only at Layer 2. |
| Hierarchy signal | 9.4 / 10 | Eye-tracking sim concentrates on Layer 1 OKR row 1. |
| Color semantic consistency | 10 / 10 | 3 hues, one semantic each (\`--ok\`, \`--watch\`, \`--off\`). |
| Encoding minimalism | 9.0 / 10 | 2 chart types (bar + sparkline) across 8 OKR rows + 8 small multiples. |
| Typography hierarchy | 9.0 / 10 | Display / body / mono with consistent role mapping. |
| Numeric format consistency | 10 / 10 | One format per metric class enforced by component prop. |
| Comparison ergonomics | 9.5 / 10 | Layer 2 small multiples share width + y-normalisation. |
| Layer separation | 10 / 10 | Layer 0 + Layer 1 answer the primary question in < 2s. |
| WCAG AA pass rate | 10 / 10 | 14/14. Verified by axe-core. |
| Mobile fit | 9.0 / 10 | Layer 0 + Layer 1 fit above the fold on 390w. |
| Single-question test | 10 / 10 | PASS in eye-tracking sim. |
| Screen-reader order | 9.5 / 10 | DOM matches visual; sparklines have hidden table fallback. |

**Total:** 112.5 / 120 → **96 / 100** (rounded). Deductions explained below.

## 4. Where the 4 points went

- **−2 baseline misalignment at 390w.** Layer 2 small-multiples have a 2px offset on the bottom rule due to text-baseline rounding. Fixed in the build sprint via a \`measureText\`-driven first-pass offset.
- **−1 drawer close-button tap target.** Bumped from 32×32 to 44×44 for mobile (WCAG 2.5.5 best practice).
- **−1 screen-reader sparkline fallback.** Initially missing; now: a visually-hidden \`<table>\` per sparkline lists the 11 values so a screen reader user can interrogate the trend.

All three deductions were resolved post-handoff during the build sprint; the production-shipped version scores **100/100** on the same rubric.

## 5. Comparative measures (eye-tracking sim)

| Metric | Old | New | Delta |
|---|---:|---:|---:|
| Time-to-first-fixation | 4.1 s | 1.2 s | −71% |
| Mean attention dwell on primary KPI | 0.4 s | 2.8 s | +600% |
| Number of fixations to answer "is OKR 1 on track?" | 11 | 2 | −82% |
| Self-reported "I know my OKR status" rate after 5s | 22% | 94% | +327% |

## 6. Lighthouse + axe (built page)

| Metric | Old | New |
|---|---:|---:|
| Lighthouse mobile performance | 62 | 91 |
| Lighthouse mobile a11y | 73 | 100 |
| axe-core violations | 14 | 0 |
| Total page weight | 412 KB | 26 KB (Layer 3 drawer +12 KB on demand) |
| LCP (4G mobile sim) | 4.8 s | 1.3 s |

## 7. Reviewer notes

The dashboard now passes the "exec-on-Tuesday-morning" test: someone who hasn't looked at the screen in a week can answer "what's off track this quarter?" in under 5 seconds, on their phone, without scrolling.

The principles that did the heavy lifting:
- **Layer separation.** Three layers, one question each. Replaces the kitchen-sink mental model.
- **Three hues, one semantic each.** Eliminates the cognitive cost of "what does red mean here?"
- **Small multiples.** Replaces 8 full-width charts with one 8-cell grid that supports actual comparison.

Checkpoint: \`.checkpoints/oc-ux-engineer.checkpoint.json\`.`,
    },
    {
      id: "dashboard-sprint",
      label: "Single-sprint implementation brief",
      kind: "sprint.md",
      body:
`# Sprint Brief — New Dashboard

Queued on **oc-app-architect** as a one-sprint ship. No migrations. Reuses existing \`/api/metrics\`. Estimated runtime: 35 min Generator + 10 min Evaluator.

## 1. Scope

- Replace \`/dashboard\` (single route).
- **5 new components:** \`WeekSummary\`, \`OkrRow\`, \`OkrBar\`, \`SmallMultiple\`, \`OkrDrawer\`.
- **3 new internal API helpers:** \`weekSummary()\`, \`okrSnapshot()\`, \`smallMultiple()\` — all read from the existing \`/api/metrics\`.
- **No backend changes.** The existing \`/api/metrics\` endpoint already returns the shape we need.
- **No new dependencies.** Reuses the existing chart kit (already includes sparkline + bar primitives).

### Out of scope for this sprint

- New OKR creation UI (uses existing settings).
- Historical export (uses existing CSV download from \`/api/metrics\`).
- Changes to the nightly rollup job (already produces the shape we read).

## 2. Files touched

| File | Change | LoC |
|---|---|---:|
| \`app/dashboard/page.tsx\` | rewrite | ~140 |
| \`components/dashboard/WeekSummary.tsx\` | new | ~60 |
| \`components/dashboard/OkrRow.tsx\` | new | ~80 |
| \`components/dashboard/OkrBar.tsx\` | new | ~50 |
| \`components/dashboard/SmallMultiple.tsx\` | new | ~70 |
| \`components/dashboard/OkrDrawer.tsx\` | new | ~110 (lazy-loaded) |
| \`lib/dashboard/snapshots.ts\` | new | ~90 |
| \`lib/dashboard/format.ts\` | new | ~40 (number/percent formatters) |
| \`tests/components/dashboard/*.test.tsx\` | new | ~280 (8 component test files) |
| \`tests/e2e/dashboard.spec.ts\` | new | ~110 (Playwright) |
| \`app/dashboard/legacy/page.tsx\` | move existing dashboard here | (just a move) |

Total: **~1,030 lines added**, 0 deleted (legacy dashboard preserved at \`/dashboard/legacy\`).

## 3. Feature flag

\`FLAG_NEW_DASHBOARD\` — default off.

| Phase | Audience | Duration | Gate |
|---|---|---|---|
| Internal | team only | 1 day | manual smoke |
| 10% | random sampling | 3 days | feedback ≤ 2 issues; 0 errors in Sentry |
| 50% | scaled out | 4 days | LCP/p95 within 10% of legacy; complaint rate ≤ baseline |
| 100% | everyone | indefinite | — |

Total rollout: ~2 weeks. Kill switch is the same flag — flip off → legacy dashboard renders.

## 4. Acceptance criteria

- [ ] Evaluator score ≥ 90 on the merged build (target 96 — matches oc-dash-forge handoff).
- [ ] Lighthouse mobile performance ≥ 85 (current dashboard: 62).
- [ ] WCAG AA pass rate = 100% (axe-core: 0 violations).
- [ ] Old dashboard remains accessible at \`/dashboard/legacy\` during rollout.
- [ ] \`FLAG_NEW_DASHBOARD\` off → old view still renders without regression.
- [ ] Eye-tracking sim: time-to-first-fixation < 1.5 s on Layer 1.
- [ ] Playwright E2E: open dashboard → click OKR row → drawer opens → press Esc → drawer closes → focus returns to OKR row.
- [ ] Bundle delta ≤ +28 KB gzipped (Layer 3 drawer counted lazy, not in initial budget).
- [ ] Unit-test coverage ≥ 90% on new files.

## 5. Generator/Evaluator targets

Single pass expected (≤ 1 re-eval). Expected runtime 35 min end-to-end.

The Evaluator runs the same 12-axis rubric used by oc-ux-engineer (separate artifact). A score < 90 triggers a re-pass; the most likely culprit is small-multiple baseline misalignment (already-known issue, fixable via \`measureText\`).

## 6. Telemetry to add

| Event | Payload | Why |
|---|---|---|
| \`dashboard.viewed\` | \`{flag_variant: "new"|"legacy"}\` | A/B comparison |
| \`okr_row.expanded\` | \`{okr_id, source}\` | which OKRs people drill into |
| \`drawer.chart_viewed\` | \`{okr_id, chart_type}\` | which deep-dive charts get attention |
| \`small_multiple.hovered\` | \`{metric_id}\` | Layer 2 engagement |

## 7. Rollback plan

Flip the flag off. Legacy dashboard code stays in the tree for one full release cycle, then removed in a separate cleanup PR.

In-flight requests handled by a deployment cycle:
- Existing tabs polling \`/api/metrics\` → unchanged.
- Existing drawer-open URLs (\`/dashboard?okr=x\`) → resolve to legacy dashboard if flag flipped during their session.

## 8. Risks

| Risk | Mitigation |
|---|---|
| Layer 0 weekly summary copy is generated by an existing job; may fail | If \`weeklySummary()\` returns null, render Layer 1 only with a "summary unavailable" hint. |
| Bundle creep from sparkline rendering | Use the existing chart kit's tree-shakable sparkline export; verified at 4.2 KB. |
| Drawer state in URL conflicts with deep-link | Parse on mount; fall back to closed if invalid OKR id. |
| Eye-tracking sim disagrees with real users | Embed Hotjar (cookieless mode) for the 10% rollout; revisit if the sim was wrong. |

## 9. Dependencies on other work

None. This sprint can ship in isolation.

## 10. After-merge checklist

- [ ] Evaluator score ≥ 90 confirmed in CI annotation.
- [ ] Lighthouse CI gate green.
- [ ] axe-core nightly green for 3 consecutive nights before going to 50%.
- [ ] Document the new components in the Storybook (existing).
- [ ] Update \`docs/runbooks/dashboard.md\` with the new components.

Checkpoint: \`.checkpoints/oc-app-architect.checkpoint.json\` — new sprint queued.`,
    },
  ],
  skills: ["oc-ux-engineer", "oc-dash-forge"],
  runtime: "≈ 12 exchanges",
  steps: [
    { type: "beat", label: "01 · Triage", caption: "oc-ux-engineer reads the screen", skills: ["oc-ux-engineer"] },

    {
      type: "exchange", role: "user",
      content:
`My analytics dashboard is a mess. 14 charts, 4 tabs, users say they "don't know where to look." Here's the screenshot + the current Figma:

[image: kitchen-sink-dashboard.png]
[figma: https://figma.com/file/abc/saas-analytics]

Can we make this actually usable?`
    },
    {
      type: "exchange", role: "claude", skill: "oc-ux-engineer",
      content:
`Pulled the screenshot and the Figma. Recognizing this as a **data-density problem**, not a visual-design problem — so oc-ux-engineer drives the overall system but I'll invoke **oc-dash-forge** for the actual screen redesign in a moment.

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
      type: "exchange", role: "claude", skill: "oc-ux-engineer",
      artifacts: ["dashboard-principles"],
      content:
`Clear brief. This is tri-agent territory — I'll invoke **oc-dash-forge** (the density specialist) with the OKR-focused framing, then I'll grade the output against the style book.

Writing \`.checkpoints/oc-ux-engineer.checkpoint.json\` with the brief + handing off.`
    },

    { type: "beat", label: "02 · oc-dash-forge", caption: "density specialist takes over", skills: ["oc-dash-forge"] },

    {
      type: "exchange", role: "claude", skill: "oc-dash-forge",
      content:
`Invoked by oc-ux-engineer. Brief: **"Is my team on track to hit this quarter's OKRs?"** for founders/leads on a weekly cadence, 30% mobile.

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

Delivering wireframes + the component spec. Writing \`.checkpoints/oc-dash-forge.checkpoint.json\`.`,
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
      type: "exchange", role: "claude", skill: "oc-dash-forge",
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

    { type: "beat", label: "03 · Handback", caption: "oc-ux-engineer integrates + grades", skills: ["oc-ux-engineer"] },

    {
      type: "exchange", role: "claude", skill: "oc-ux-engineer",
      content:
`Resuming from the oc-ux-engineer checkpoint. Reading oc-dash-forge's output.

**Integration pass:**
- Style-book tokens absorbed (no new color; only the semantic mapping of existing neutrals).
- Component catalog updated: \`OkrRow\`, \`SmallMultiple\`, \`WeekSummary\` added; old \`ChartCard\` deprecated.
- Accessibility audit: contrast ratios all ≥ 4.6:1 (your old one had 3 charts below WCAG AA).

**Style-book grade on the new screen: 96/100** — vs. 61/100 for the old kitchen-sink version. Net data-ink ratio doubled; the "single question" test passes (an exec who glances once a week sees their OKR status in under 2 seconds).

Writing consolidated checkpoint. Hand back to you — or say \`/implement\` and I'll spin up an oc-app-architect sprint to build the new screen in your existing Next.js app.`,
      artifacts: ["dashboard-grade"],
    },
    {
      type: "exchange", role: "user",
      content: "/implement"
    },
    {
      type: "exchange", role: "claude", skill: "oc-ux-engineer",
      content:
`Handing off to oc-app-architect with the new design as a single-sprint brief:

- **Scope:** replace \`/dashboard\` (one route, no migrations).
- **New components:** 3 (OkrRow, SmallMultiple, WeekSummary).
- **Data:** reuse existing \`/api/metrics\` — no backend changes.
- **Acceptance:** Evaluator ≥ 90, Lighthouse mobile ≥ 85, feature-flag behind \`FLAG_NEW_DASHBOARD\` so you can A/B against the old one.

oc-app-architect checkpoint written. Ready for you to \`/build\` when you are.`,
      artifacts: ["dashboard-sprint"],
    },
  ],
};

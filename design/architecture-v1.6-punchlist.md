# Implementation Punch List — v1.6 in the architecture diagrams

**Release:** v1.6 "Cost & telemetry" (the instrumented pipeline) — adds `oc-cost-ops` +
`oc-telemetry-ops`, catalog 22 → 24, checkpoint wire 1.0 → 1.1.
**Chosen variants:** Desktop **C · spine-side meter rail** · Mobile **C · per-band meter chips** (animated).
**Source of truth for the look/behavior:**
- `design/architecture-v1.6-proposals.html` — all 3 placements, static (A/B/C).
- `design/architecture-v1.6-variantC-functional.html` — the approved C, **functional** (live meters, Replay/Pause, reduced-motion fallback).

**New semantic accent:** `--inst` lime — the v1.6 analog of v1.5's violet `--ai`.
**Status:** ✅ Implemented in `architecture.astro` (desktop rail panel + controller) and `MobileArchitecture.astro` (anchor pill + per-band chips). `--inst`/`--ma-inst` lime tokens, counts 22→24, wire-1.1 CP fields, legend entries, and a11y (decorative meters `aria-hidden`, reduced-motion → static totals) all landed. Local `astro check` = 0 errors / 0 warnings; site build green; manual desktop + mobile renders verified. Animation is a single perf-safe pass on load (illustrative sample data) — CI LHCI polices the `/architecture` perf budget.

> The punch list IS the scope. If it's not listed here, it doesn't get built.

---

## ⚠ Read first — two consequences of picking C

1. **The `/architecture` page is static (Astro static mode).** The rail's per-phase numbers are **not real
   per-visitor spend** — they are *illustrative sample data*, either a scripted demo loop (as in the
   functional mockup) or a baked static snapshot. Real live data would require wiring to the `/dashboard`
   aggregate, which was deselected. The UI must read as a *representative example*, not a live billing meter
   (a small "sample" / "illustrative" label avoids implying real-time cost).
2. **Animation runs under the Lighthouse perf budget.** `/architecture` currently scores **0.89 perf** (the
   lowest budgeted route). The meter loop must be cheap (animate `width`/`opacity` only, no layout thrash,
   tiny JS, throttled) and **must not** drop the route below its LHCI budget. A `prefers-reduced-motion`
   fallback to static final totals is mandatory.

---

## 0 · Shared tokens & SVG defs (both components)

- [ ] **0.1 — Desktop `--inst` accent.** In `site/src/pages/architecture.astro`: stroke/text `#a3e635`;
  fills `rgba(163,230,53,.04)` (gutter wash) · `rgba(163,230,53,.16)` (active/anchor). Add `--inst:#a3e635;`
  + `[data-theme="light"]` override `--inst:#65a30d;` to the page token block.
- [ ] **0.2 — Desktop glow filter.** Add `<filter id="glow-inst">` to `.arch-v2-defs` (clone of `glow-mint`,
  `flood-color="#a3e635"`). Only if anchors/markers use a glow.
- [ ] **0.3 — Mobile `--ma-inst` token.** Add `--ma-inst:#a3e635;` (dark) and `#65a30d` in the
  `:global([data-theme="light"]) .mobile-architecture` block. Mirror the `--ma-ai` v1.5 precedent.

---

## 1 · Desktop — `site/src/pages/architecture.astro` (Variant C · meter rail)

### 1a · Header counts
- [ ] **1.1** Eyebrow `… RELEASE v1.5` → `… RELEASE v1.6`.
- [ ] **1.2** Subtitle `… 22 skills · 6 phases …` → `… 24 skills · 6 phases …`.

### 1b · Rail anchors (the two new skills)
- [ ] **1.3** Add two anchor boxes for `oc-cost-ops` + `oc-telemetry-ops`, lime-stroked, positioned as the
  rail's header (right side, above/beside the spine). Each: name · `Specialist · /oc-cost|/oc-telemetry` ·
  one-line role · `CP` + `ORC` badges · lime `NEW v1.6·gated` chip. Wrap each in
  `<a href="/skills/oc-cost-ops">` / `/skills/oc-telemetry-ops` (dirs exist → routes resolve).
- [ ] **1.4** `oc-telemetry-ops` anchor notes `default OFF · opt-in`.

### 1c · Per-phase meter rail (the gutter)
- [ ] **1.5** Add a right-aligned **rail gutter** keyed to each spine phase (Discover/Plan/Build/Ship/Monitor):
  each phase gets a `Cost` readout + a `Usage` bar+count, lime-tinted, marked as a visually-distinct rail
  column (`border-left:2px solid --inst` on the gutter). Reuse the structure/colors from
  `architecture-v1.6-variantC-functional.html` (`.rail-meter` / `.usebar`).
- [ ] **1.6** Add a **RUN TOTAL** row rolling the per-phase values up, captioned `rolls up → /oc-ops budget`.
- [ ] **1.7** Active-phase highlight as the (illustrative) run streams; `↑ INSTRUMENT RAIL · v1.6 · taps every phase` caption.

### 1d · The meter behavior (data + animation)
- [ ] **1.8** Implement the live loop as a **small, self-contained script** (port the controller from the
  functional mockup): per-phase cost/usage ramp, active highlight, totals, auto-loop, with the values clearly
  flagged illustrative/sample. Keep it `<~1KB`, no dependencies.
- [ ] **1.9** **`prefers-reduced-motion: reduce` → render final totals, no streaming** (already in the mockup; port it).
- [ ] **1.10** Decide the data source for the baked numbers: a `SAMPLE_RUN` constant in the component
  (recommended — deterministic, reviewable) rather than random per-load, so LHCI runs are stable.
- [ ] **1.11** Consider gating the whole rail behind the instrumentation flag (`skills.registry.oc-cost-ops.enabled`
  || the v1.6 flag) so it can be killed without a redeploy, consistent with "both skills ship gated."

### 1e · Wire 1.1 + legend + a11y
- [ ] **1.12** Band/rail caption + `#cp-detail-top` CP JSON gain `cost · eval_scores · telemetry_handle` (additive; wire 1.0 still validates).
- [ ] **1.13** Legend: add `Instrumentation (v1.6)` lime swatch + the rail/meter explanation.
- [ ] **1.14** Bump every `22`/`all 22` → `24`/`all 24` in this file.
- [ ] **1.15** a11y: the animated meters are decorative — mark the streaming region `aria-hidden="true"`
  (or `aria-live="off"`) so screen readers aren't spammed; give the rail a static `aria-label` describing
  it ("Instrumentation rail: per-phase cost and usage, illustrative"). Provide the final totals as static text.

---

## 2 · Mobile — `site/src/components/MobileArchitecture.astro` (Variant C · per-band chips)

### 2a · Header counts
- [ ] **2.1** Eyebrow `… MOBILE · v1.5` → `… MOBILE · v1.6`; subtitle `22` → `24`.

### 2b · Rail anchor + per-band chips
- [ ] **2.2** Add a **rail anchor pill** above the bands: `RAIL · Instrumentation rail · v1.6`, naming
  `oc-cost-ops` + `oc-telemetry-ops` (NEW · gated), "tap every band ↓".
- [ ] **2.3** Add a lime `border-left:3px solid --ma-inst` to each phase band and a live **meter chip**
  (`$ · usage`) on each band summary — port `.chip` from the functional mockup.
- [ ] **2.4** Add a **roll-up total** line (`rolls up → /oc-ops budget · $X · N ev`).
- [ ] **2.5** The mobile component is currently **static, no JS** (its own header says "no JS · no animations").
  **Decision required:** introducing the streaming chips means adding a small script to this component.
  Port the same controller + `prefers-reduced-motion` fallback; update the component header note from
  "no JS · no animations" to reflect the gated, reduced-motion-safe meter loop. (If you'd rather keep mobile
  strictly no-JS, fall back to **static sample chips** — say the word and I'll switch 2.3/2.5 to static.)

### 2c · Wire 1.1 + legend
- [ ] **2.6** `oc-checkpoint-protocol` pill desc + Appendix A CP JSON gain the three wire-1.1 fields.
- [ ] **2.7** Bump all `22` → `24`; add `oc-cost-ops` / `oc-telemetry-ops` to the Standalone-specialist type list;
  add an `Instrumentation · v1.6` reference line.
- [ ] **2.8** a11y: chips decorative → `aria-hidden` on the animated value; band still announces its title/phase.

---

## 3 · Validation & acceptance

- [ ] **3.1** `npm run site:build` / `npm run build` green; `astro check` clean.
- [ ] **3.2** Playwright e2e for `/architecture` passes; update any snapshot intentionally.
- [ ] **3.3** **LHCI is the key gate now.** `/architecture` perf must stay at/above its budget (≈0.89) **with the
  animation running**; A11y/SEO stay 1.00; Best-practices ≥0.96. If perf regresses, fall back to static
  sample meters (no loop).
- [ ] **3.4** Lime contrast: `#a3e635` on `#1c1710` (dark) and `#65a30d` on `#f6f0e8` (light) meet the a11y budget.
- [ ] **3.5** Manual: reduced-motion shows static totals (no streaming); dark+light both legible; anchor skills link to working `/skills/<id>`; mobile chips don't overflow 390pt; desktop rail doesn't force horizontal scroll.

**Acceptance criteria (Evaluator-gradeable):**
1. Both diagrams show the two new skills (lime, `NEW·v1.6·gated`) anchoring a per-phase meter rail (desktop) / per-band chips (mobile).
2. Meters are clearly illustrative/sample; reduced-motion renders static totals; the loop is gated + cheap.
3. Every "22" → "24"; headers read v1.6; wire-1.1 fields appear in the CP example(s).
4. No spine band, ordinal, or existing edge altered; additions are the rail/anchors (desktop) + chips/anchor (mobile).
5. Build green **and `/architecture` LHCI perf holds its budget** in both themes.

---

## 4 · Out of scope / adjacent (NOT in this punch list)

- **`/dashboard` live wiring** — deselected; meters stay illustrative sample data on the static page.
- **`PipelineDiagram.astro`** — unused (no imports); untouched.
- **`compare.astro`** — also says "22 skills"; per "approve as-is" it is **not** a punch-list item (noted only).
- **New `/skills/<id>` page content** for cost/telemetry — dirs + SKILL.md already exist; this list only wires the diagram links.

---

## 5 · Open decision carried into implementation

- **Mobile no-JS stance (item 2.5).** Mobile C adds animation to a component that today advertises "no JS · no
  animations." Default plan: add the small gated, reduced-motion-safe loop. Alternative: keep mobile strictly
  static with fixed sample chips. Confirm at implementation time if you have a preference.

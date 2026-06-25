# Implementation Punch List — v1.6 in the architecture diagrams

**Release:** v1.6 "Cost & telemetry" (the instrumented pipeline) — adds `oc-cost-ops` +
`oc-telemetry-ops`, catalog 22 → 24, checkpoint wire 1.0 → 1.1.
**Chosen variants:** Desktop **A · cross-cutting Instrumentation band** · Mobile **B · foundation block**.
**Source of truth for the look:** `design/architecture-v1.6-proposals.html` (approved preview).
**New semantic accent:** `--inst` lime — the v1.6 analog of v1.5's violet `--ai`.
**Status:** ⛔ Awaiting go-ahead to implement. This document is the scope; no component is edited yet.

> The punch list IS the scope. If it's not listed here, it doesn't get built.

---

## 0 · Shared tokens & SVG defs (both components)

- [ ] **0.1 — Desktop `--inst` accent.** In `site/src/pages/architecture.astro`, instrumentation
  elements use inline hex (matching how the desktop diagram already inlines `#0D9488`, `#f59e0b`, etc.):
  - stroke / text: `#a3e635`
  - fills: `rgba(163,230,53,.04)` (band wash) · `rgba(163,230,53,.16)` (chips)
  - If/where a CSS custom prop is cleaner, add `--inst:#a3e635;` and a `[data-theme="light"]` override `--inst:#65a30d;` alongside the page's existing token block.
- [ ] **0.2 — Desktop glow filter.** Add `<filter id="glow-inst">` to the `.arch-v2-defs` block,
  cloned from `glow-mint`/`glow-yellow` with `flood-color="#a3e635"` (stdDeviation `7`, flood-opacity `~0.5`).
- [ ] **0.3 — Mobile `--ma-inst` token.** In `site/src/components/MobileArchitecture.astro` `.mobile-architecture`
  block add `--ma-inst:#a3e635;`; in the `:global([data-theme="light"]) .mobile-architecture` block add `--ma-inst:#65a30d;`.
  (Mirror the existing `--ma-ai` / `--ma-vec` v1.5 precedent.)
- [ ] **0.4 — Mobile glow + marker.** Add `<filter id="ma-glow-inst">` (flood `#a3e635`) and
  `<marker id="ma-ah-inst">` (lime polygon) to the mobile `.ma-defs` block. (Only needed if the
  foundation pills use a glow/arrow — keep minimal; foundation pills today have no glow, so these may be skippable.)

---

## 1 · Desktop — `site/src/pages/architecture.astro` (Variant A)

### 1a · Header counts
- [ ] **1.1** Eyebrow `SKILLS · ARCHITECTURE · v2 · RELEASE v1.5` → `… RELEASE v1.6`.
- [ ] **1.2** Subtitle `… · 22 skills · 6 phases …` → `… · 24 skills · 6 phases …`. Leave
  `7 tri-agent · 3 audit gates · spine ordinals · v1.5 pack fabric (N)` intact (tri-agent count
  unchanged; cost/telemetry are specialists, not tri-agent).

### 1b · New cross-cutting Instrumentation band
- [ ] **1.3 — Insertion point.** Add a new `.band` block **after** the MONITOR spine band
  (`#band-monitor`), before the diagram's legend/reference. **No** preceding `.band-arrow` —
  it is cross-cutting, not a spine step (same treatment as the `#band-packs` pack-fabric band).
- [ ] **1.4 — Band shell.** `band-label` with a lime label bar (`background:var(--inst)` / `#a3e635`)
  and label text `INSTRUMENTATION`; `band-content` holds an `.instrument-band` block modeled on
  `.pack-fabric-band` (eyebrow → title → cells).
- [ ] **1.5 — Eyebrow + title.**
  - eyebrow: `v1.6 · cross-cutting · instrumentation`
  - title: `Instrumentation — per-phase cost + opt-in usage telemetry`
- [ ] **1.6 — Cell: `oc-cost-ops`.** Box stroked `#a3e635`. Lines:
  `oc-cost-ops` / `Specialist · /oc-cost` / `$ attribution · budget gates · tier routing` /
  italic ripple `→ pairs cost-regression gate w/ oc-prompt-ops`.
  Badges: `CP`, `ORC` (same small-rect pattern as every other node), and a lime `NEW v1.6·gated` chip.
  Wrap in `<a href="/skills/oc-cost-ops" class="node-link">` (dir exists → route resolves).
- [ ] **1.7 — Cell: `oc-telemetry-ops`.** Box stroked `#a3e635`. Lines:
  `oc-telemetry-ops` / `Specialist · /oc-telemetry · default OFF` /
  `opt-in local metering · .checkpoints/usage.sqlite` /
  italic `anonymized aggregate · no PII leaves the machine`.
  Badges `CP` + `ORC` + lime `NEW v1.6·gated`. Wrap in `<a href="/skills/oc-telemetry-ops" class="node-link">`.
- [ ] **1.8 — "Measures every phase" taps.** Inside the band's own inline `<svg>`, draw 5 dashed
  lime taps (`stroke="#a3e635" stroke-dasharray="3,3"` + `marker-end` lime arrow) pointing up toward
  the five lanes. Keep these **self-contained in the band SVG** — do **not** extend the `lines-canvas`
  connector JS (avoids touching the spine-arrow drawing logic).

### 1c · Wire 1.1 + ripples
- [ ] **1.9 — Band caption note.** Add `CP wire 1.1: cost · eval_scores · telemetry_handle (additive; wire 1.0 still validates)`.
- [ ] **1.10 — CP-detail JSON.** In the `#cp-detail-top` example JSON, add the optional `cost`,
  `eval_scores`, `telemetry_handle` fields (commented or shown as additive) so the protocol card matches reality.

### 1d · Legend / Reference / a11y
- [ ] **1.11** Add an `Instrumentation (v1.6)` entry to the desktop legend with a lime swatch +
  one-line definition ("cross-cutting · measures every phase · gated").
- [ ] **1.12** Bump every "22"/"all 22" assertion in this file to "24"/"all 24"
  (skill count, CP/ORC "all N skills carry", checkpoint-sync copy).
- [ ] **1.13** a11y: band `aria-label` ("Instrumentation: oc-cost-ops and oc-telemetry-ops, cross-cutting v1.6");
  inline `<svg role="img" aria-label="…">`; preserve the nested-interactive pattern (links inside, no
  conflicting `role="img"` on a wrapper that contains `<a>`).
- [ ] **1.14** Verify the page `<script>` (band hover/expand, canvas line draw) does not assume the new
  band has a `data-phase` spine role or a `band-arrow`. The band should render correctly with JS disabled.

---

## 2 · Mobile — `site/src/components/MobileArchitecture.astro` (Variant B)

### 2a · Header counts
- [ ] **2.1** Eyebrow `… · MOBILE · v1.5` → `… · MOBILE · v1.6`.
- [ ] **2.2** Subtitle `… 22 skills · 6 phases …` → `… 24 skills · 6 phases …`.

### 2b · Foundation block — two new pills
- [ ] **2.3** Inside the existing Foundation `<details class="ma-foundation">`, **after** the
  `oc-orchestrator` pill, add two `.ma-foundation-pill` blocks with `--inst` styling
  (lime border + `var(--ma-inst-dim)` wash):
  - **COST** → `oc-cost-ops` — desc `/oc-cost · per-phase $ attribution · budget gates · model-tier routing` + `NEW · gated` marker.
  - **USAGE** → `oc-telemetry-ops` — desc `/oc-telemetry · opt-in local metering · default OFF · anonymized` + `NEW · gated` marker.
- [ ] **2.4** Add a small sublabel under the new pills: `v1.6 instrumentation · measures every phase` (lime).
- [ ] **2.5** Confirm the foundation `<summary>`/`aria-label` copy still reads correctly with 4 pills
  ("Foundation layer: oc-checkpoint-protocol, oc-orchestrator, oc-cost-ops, oc-telemetry-ops").

### 2c · Wire 1.1
- [ ] **2.6** Extend the `oc-checkpoint-protocol` pill `ma-fp-desc` to append
  `· wire 1.1: cost · eval_scores · telemetry_handle`.
- [ ] **2.7** Add the three optional fields to the **Appendix A** CP JSON example (`.ma-cp-json`).

### 2d · Legend / Reference cards
- [ ] **2.8** Bump "all 22" → "all 24" everywhere in this file (CP indicator, ORC indicator,
  Checkpoint-Protocol card "All 22 skills read all 22 checkpoints", Appendix A "all 22").
- [ ] **2.9** Add `oc-cost-ops` / `oc-telemetry-ops` to the **Standalone specialist** type list in
  the Skill-types legend (they are specialists). Tri-agent list stays 7; audit gates stay 3.
- [ ] **2.10** Optional: add an `Instrumentation · v1.6` line to the Reference info-cards
  ("cost + usage · cross-cutting · gated") for parity with desktop's legend entry.

---

## 3 · Validation & acceptance

- [ ] **3.1** `npm run site:build` (or `npm run build`) green; `astro check` clean.
- [ ] **3.2** Playwright e2e for the `/architecture` route still passes (and any snapshot updated intentionally).
- [ ] **3.3** Lighthouse/Axe budgets hold — **specifically** lime `#a3e635` text/stroke contrast on
  `#1c1710` (dark) and `#65a30d` on `#f6f0e8` (light) meet the SEO/a11y budget; no new nested-interactive violations.
- [ ] **3.4** Manual: dark **and** light theme both legible; reduced-motion respected; the two new
  desktop boxes link to working `/skills/oc-cost-ops` + `/skills/oc-telemetry-ops` pages.
- [ ] **3.5** Manual: mobile foundation block (4 pills) doesn't overflow 390pt; desktop band scales without horizontal squish.

**Acceptance criteria (Evaluator-gradeable):**
1. Both diagrams show exactly two new skills, lime-accented, marked `NEW · v1.6 · gated`, on `/skills/<id>` links (desktop).
2. Every "22" the diagrams asserted now reads "24"; headers read v1.6.
3. Wire-1.1 fields appear in the CP example(s) of both components.
4. No spine band, ordinal, or existing edge changed; the only structural additions are the desktop band + the two mobile pills.
5. Build + a11y budgets green in both themes.

---

## 4 · Out of scope / adjacent (NOT in this punch list)

- **`PipelineDiagram.astro`** — not imported anywhere (dead component); intentionally untouched.
- **`compare.astro`** — also contains a `"22 skills"` string. You chose "Approve as-is" (not the
  +compare option), so it is **not** a punch-list item. Noting it here only so the inconsistency is visible.
- **`/dashboard` tie-in** — deliberately omitted per the design decision; the rail/rollup language was
  dropped with Variant C and isn't part of Desktop A / Mobile B.
- **New `/skills/<id>` page content** for cost/telemetry — the dirs + SKILL.md already exist; this list
  only wires the diagram links to them, not their page content.

# Design — Demo Workbench Search & Filter (Phase 3)

> Reuses the **existing** opchain design system (`specs/design/design-system.md`,
> tokens in the global stylesheet). No new style book — every new surface is
> built from existing tokens. This doc covers wireframes, states, responsive
> behavior, and a11y for the new surfaces.
>
> Not data-heavy in the oc-dash-forge sense (no charts/KPIs/real-time) → **no
> dash-forge routing.** Inline wireframes below.

## Token reuse (no new tokens)

| Need | Existing token |
|---|---|
| Accent / active | `--accent`, `--ember-dim`, `--ember-glow`, `--glow-md` |
| Surfaces | `--bg`, `--surface`, `--ribbon`, `--card` |
| Lines | `--border` (0.5px hairlines, the house style) |
| Text | `--text`, `--muted`, `--subtle` |
| Role colours | `--workflow`/`--tri-agent`/`--audit-gate`/`--specialist`/`--advisor`/`--orchestrator`/`--success` |
| Type | `--font-mono` (chrome/labels), `--font-display` (titles), ramp `--fs-xs…lg` |
| Radii / focus | `--r-xs/sm/md/pill`, `--focus-ring`, `--focus-ring-inset` |
| Motion | `--dur-fast/base`, `--ease-standard`; honor `prefers-reduced-motion` |

One **new highlight** treatment only: search-match `<mark>` → background
`--ember-dim`, text `--text` (AA-checked both themes; reuses the contrast
audit's ember pair). No new palette hues.

---

## Desktop (`DesktopWorkbench`) — wireframes

The IDE grid is unchanged: `activity(44) · sidebar(248) · editor(1fr) ·
inspector(288)`. The **activity rail tabs become functional** and drive what
the **sidebar column** shows. Three sidebar modes: `scenarios` (today's tree,
default), `search`, `facets`.

### Rail states

```
┌──┐  ▦  ← Scenarios (tree)        is-active by default
│  │  ⌕  ← Search      ← NEW: shows search panel in sidebar
│  │  ⊞  ← I/O (unchanged decorative for now)
│  │  ●  ← Skills/Facets ← NEW: shows facet panel in sidebar
│  │  ?  ← Help
└──┘
```
Exactly one of {▦, ⌕, ●} is active (they share the sidebar column). Each is a
real `<button role="tab" aria-selected>`; ↑/↓ moves, Enter/Space activates.

### Search panel (⌕ active) — replaces the tree in the 248px column

```
┌─ SEARCH ──────────────────────────────┐
│  ⌕ [ rollback________________ ] (✕)    │  ← input, clear button
│  results · 7                           │  ← live count
│  ── active filters ──                  │  ← shown only if facets set
│  [skill: oc-deploy-ops ✕][ship ✕]      │  ← removable pills
│ ───────────────────────────────────── │
│  runtime-pm-loop                       │  ← scenario group header
│   ▸ …staging green, run `npm run       │  ← result row: snippet w/ <mark>
│     deploy` then **rollback** if…      │     + step badge
│     [oc-deploy-ops] ship · s12         │
│   ▸ …prod incident → **rollback** to   │
│     the last good deploy id…           │
│     [oc-monitoring-ops] monitor · s31  │
│  postgres-migration                    │
│   ▸ …add a **rollback** point before   │
│     the cutover migration runs…        │
│     [oc-migration-ops] operate · s8    │
└────────────────────────────────────────┘
```

- Rows are buttons; activating one opens that scenario in the **editor**
  transcript view, scrolled + flashed to the step (see Landing).
- Snippet centers the first match, ~120 chars, match `<mark>`-wrapped.
- Keyboard: type in input; ↓ moves into results; ↵ opens; Esc clears →
  restores tree.

### Facet panel (● active) — replaces the tree

```
┌─ FILTER ──────────────────────────────┐
│  showing 5 / 12 scenarios              │  ← count reflects active facets
│  ── skills ──                          │
│  [oc-app-architect 12][oc-deploy 6]    │  ← chips w/ per-facet counts,
│  [oc-rag-forge 3][oc-git-ops 8] …      │     role-tinted, aria-pressed
│  ── roles ──                           │
│  [workflow 9][audit-gate 5][advisor 4] │
│  ── artifact kind ──                   │
│  [spec 10][runbook 4][pull-request 7]  │
│  ── pipeline phase ──                  │
│  [discover][spec][design][build]       │  ← ordered by pipeline
│  [audit][ship][monitor][operate]       │
│ ───────────────────────────────────── │
│  ( clear all )                         │
└────────────────────────────────────────┘
```

- **Semantics:** OR within a group, AND across groups. Query (if any) AND-ed
  on top. Counts update as facets narrow (reflect the *current* filtered set).
- Active facets also surface as removable pills in the Search panel, so the
  two panels stay in sync (one shared filter state).
- Chips are `<button aria-pressed>`; role chips tinted with role colours;
  zero-count chips dim + disabled.

### Landing (result → transcript)

1. Open the scenario pane in **transcript mode** (existing `setPaneMode`).
2. Reveal steps **through** the target (not the hidden-until-`↵` state) so the
   hit + its lead-in are readable.
3. `scrollIntoView` the target step within the editor column.
4. **Ember-flash** the step (reuse `is-flash-heading` keyframe pattern; static
   tint under `prefers-reduced-motion`).
5. The inspector keeps its transcript-mode side summary.

---

## Mobile (`MobileWorkbench`) — full parity

Bottom tabbar stays **4 tabs** (Scenarios/Stream/I/O/Inspector). Search is a
**topbar icon button** that opens a **full-screen Find overlay** (the iOS/
Android-native search pattern — avoids cramming a 5th tab; keeps ≥44px
targets).

### Topbar

```
┌───────────────────────────────────────┐
│ opchain        [⌕]   ‹active scenario› │  ← ⌕ button opens Find overlay
└───────────────────────────────────────┘
```

### Find overlay (full-screen sheet)

```
┌─ FIND ───────────────────────────  ✕ ─┐
│  ⌕ [ rollback______________ ]          │
│  [ Filters ▾ ]   results · 7           │  ← Filters expands chip groups
│  ┄┄ when expanded ┄┄                    │
│  skills:  [oc-deploy-ops][oc-git-ops]…  │
│  roles:   [audit-gate][advisor]…        │
│  kind:    [spec][runbook]…              │
│  phase:   [ship][monitor]…              │
│ ─────────────────────────────────────  │
│  runtime-pm-loop                        │
│   ▸ …`npm run deploy` then **rollback** │
│     [oc-deploy-ops] ship · s12          │
│   ▸ …prod incident → **rollback**…      │
│     [oc-monitoring-ops] monitor · s31   │
└─────────────────────────────────────────┘
```

- Tapping a result: closes the overlay, `selectScenario(id)`, switches to the
  **Stream** tab, reveals through + scrolls + flashes the step.
- Overlay scrolls; chips wrap; everything ≥44px. Trap focus while open; Esc /
  ✕ / back-gesture closes.

---

## States (all four, every surface)

| State | Search panel / overlay | Facet panel |
|---|---|---|
| **Empty** (no query, no facets) | "Search N steps across 12 scenarios" + hint | All chips shown with full corpus counts |
| **Loading** | n/a — index is inlined, instant. (Skeleton only if the `/demo-search-index.json` async path is ever used.) | n/a |
| **No results** | "No matches for ‘…’. Clear filters / try another term" + one-tap clear | If facets zero out: "No scenarios match these filters" + Clear all |
| **Results** | Ranked, grouped-by-scenario list w/ highlights + badges + count | Counts updated; active chips pressed; pills mirrored |

---

## Responsive

- **≥768px** → DesktopWorkbench (rail + sidebar panels).
- **<768px** → MobileWorkbench (topbar ⌕ + Find overlay).
- Deep-link URLs work on both; the CSS breakpoint already swaps the trees, and
  the client engine binds to whichever subtree is live.
- Verified at 375 / 768 / 1280px (per the spec's DoD).

## Accessibility

- Rail tabs: `role="tab"` + `aria-selected` + roving tabindex; sidebar panels
  `role="tabpanel"`.
- Facet chips + clear: `<button aria-pressed>`; disabled at zero count.
- Result list: `role="listbox"`/`option` (or a labelled list of buttons),
  ↑/↓/↵, `focus-visible` rings via existing tokens.
- Find overlay (mobile): focus trap, labelled, Esc/back closes, returns focus
  to the ⌕ button.
- Flash respects `prefers-reduced-motion` (static tint fallback).
- `<mark>` highlight + badges meet AA in dark **and** light.

## Out of scope for this design

Typo/fuzzy search visuals (v1 is substring/token), ⌘K integration, a
"copy link to this exchange" button in the lightbox (noted stretch in spec
`02 §5`).

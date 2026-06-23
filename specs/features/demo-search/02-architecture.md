# 02 · Architecture — Demo Workbench Search & Filter

## Overview

```
                    BUILD TIME (Astro SSG)                          RUN TIME (browser)
 ┌──────────────────────────────────────────────┐     ┌─────────────────────────────────────┐
 │ site/src/data/walkthroughs/*.ts                │     │  /demo page                          │
 │   ├─ Beat.phase  (NEW explicit tag)            │     │   ├─ DesktopWorkbench / Mobile…      │
 │   ├─ Exchange (inherits nearest beat phase)    │     │   ├─ <script type=app/json           │
 │   └─ Artifact.kind ──► normalizeKind() (NEW)   │     │   │     id="demo-search-index">       │
 │                                                │     │   │     { …index… }                   │
 │              buildSearchIndex()                │     │   ├─ search panel (⌕ tab)            │
 │            (site/src/lib/demo-search/)         │ ──► │   ├─ facet panel  (● tab)            │
 │                     │                          │     │   └─ demo-search.client.ts           │
 │                     ▼                          │     │        ├─ parse URL state            │
 │   inlined into /demo as a JSON <script>        │     │        ├─ filter + rank (hand-rolled)│
 │   (and emitted to /demo-search-index.json      │     │        ├─ render results             │
 │    for agents/crawlers — see §6)               │     │        └─ deep-link → reveal+scroll+ │
 └──────────────────────────────────────────────┘     │              flash target exchange   │
                                                        └─────────────────────────────────────┘
```

No server, no API route. The index is computed during `astro build` and
shipped inert with the page.

---

## 1. Data-model changes (`site/src/data/walkthroughs/types.ts`)

### 1a. Pipeline phase (explicit tags)

Add a controlled `Phase` union and tag **beats** with it. Exchanges do **not**
carry `phase` directly — they **inherit the nearest preceding beat's phase**
at index time (fallback: the walkthrough's leading phase, else `"other"`).
This keeps the authoring burden to beats (few) rather than every exchange
(many).

```ts
export type Phase =
  | "discover"   // idea → requirements (oc-discover, reverse-spec intake)
  | "spec"       // spec + stack + architecture
  | "design"     // UX, wireframes, dashboards
  | "plan"       // roadmap / sprint decomposition
  | "build"      // generator→evaluator implementation
  | "audit"      // code-auditor / security-auditor / bug-check gates
  | "ship"       // git-ops + release-ops + deploy-ops
  | "monitor"    // monitoring-ops, incident, post-deploy
  | "operate";   // migration, scale, integrations, day-2 ops

export type Beat = {
  type: "beat";
  label: string;
  caption?: string;
  skills?: string[];
  phase?: Phase;          // NEW — chapter's pipeline phase
};
```

**Authoring:** every beat in all 12 scenarios gets a `phase`. A build-time
assertion (see testing) **fails the build** if any beat is missing `phase`,
so the tagging can't silently rot. (Whether to also relax this to a warning
for non-beat-led scenarios is a spec-gate question; default = hard fail.)

> Bonus: `phase` also lets the transcript chapter dividers show a phase
> label/colour — a small UX win that falls out of this data for free
> (decided in design).

### 1b. Artifact-kind normalization

`Artifact.kind` is free-text today (`"spec.md"`, `"pull-request"`,
`"runbook"`, …). Faceting needs a controlled vocabulary. We do **not** edit
every artifact — instead a build-time normalizer maps raw kind → canonical
facet value:

```ts
// site/src/lib/demo-search/kinds.ts
export type ArtifactKind =
  | "spec" | "design" | "code" | "test"
  | "pull-request" | "audit" | "runbook"
  | "report" | "config" | "data" | "other";

export function normalizeKind(raw: string | undefined): ArtifactKind { … }
```

A unit test enumerates every distinct `kind` string across all artifacts and
asserts **100% map to a non-`"other"` canonical value** (or are explicitly
allow-listed as `"other"`), so a new artifact kind can't silently fall
through. Fail-loud, matching the repo's gen-script philosophy.

### 1c. Stable step anchors

Each step gets a stable id for deep-linking: **`s{index}`** within its
scenario, exposed as `data-step-id` and used in the URL hash as
`#{scenarioId}:s{index}` (the workbench already renders `data-step-index`;
we promote it to a stable, documented anchor). Positional ids are acceptable
because scenarios are curated and append-mostly; reordering steps re-points
anchors, which is documented as expected for curated content.

---

## 2. Build-time index (`site/src/lib/demo-search/index-build.ts`)

A pure function over `walkthroughs` → a serializable index. Markdown is
**stripped to text** for indexing (reuse the existing markdown pipeline or a
light strip — exchange/artifact bodies are markdown).

### Index schema

```ts
interface SearchIndex {
  version: 1;
  scenarios: IndexScenario[];
  facets: {                       // precomputed facet universes (for chip lists + counts)
    skills: FacetValue[];         // { id, label, role, count }
    roles:  FacetValue[];         // 7-role taxonomy
    kinds:  FacetValue[];         // canonical ArtifactKind
    phases: FacetValue[];         // Phase, in pipeline order
  };
}

interface IndexScenario {
  id: string; title: string; tagline: string; summary: string;
  skills: string[];               // skill ids
  roles: Role[];                  // derived from skills via getSkillRole
  phases: Phase[];                // distinct phases present
  kinds: ArtifactKind[];          // distinct artifact kinds present
  steps: IndexStep[];
}

interface IndexStep {
  id: string;                     // "s{index}"
  kind: "beat" | "user" | "claude";
  phase: Phase;                   // resolved (inherited for exchanges)
  skill?: string;                 // claude steps
  role?: Role;
  text: string;                   // searchable plain text (markdown-stripped)
  snippet: string;                // pre-trimmed display snippet
  artifactIds?: string[];         // artifacts referenced here
}
```

Artifact bodies are indexed against the **step that references them** (via
`Exchange.artifacts`) so an artifact-body hit deep-links to the exchange that
produced it. Artifacts referenced nowhere are indexed against the scenario.

### Where the index is emitted

1. **Inlined** into `/demo` as `<script type="application/json"
   id="demo-search-index">` — no extra request, available before hydration.
2. Also written to **`/demo-search-index.json`** (static asset) so agents and
   crawlers can fetch the structured corpus directly (CORS-open read, like the
   other discovery surfaces). Optional/confirm at gate; cheap to include.

---

## 3. Client engine (`site/src/lib/demo-search/demo-search.client.ts`)

Loaded by `demo.astro` (module script). Responsibilities:

- **Parse** the index JSON + the URL state on load.
- **Filter:** AND **across** facet types, OR **within** a facet. A scenario/
  step matches if it satisfies every active facet group; text query AND-ed on
  top.
- **Rank:** field-weighted score — `title/skill (3) > beat label (2) >
  exchange/user text (1.5) > artifact body (1)`, × match count. Stable sort;
  ties broken by scenario display order then step index.
- **Render** results into the search panel: grouped by scenario, each hit a
  row showing the snippet with the matched term `<mark>`-highlighted + skill/
  phase badges. Keyboard navigable (↑/↓/↵), reusing palette ergonomics.
- **Activate** a result → jump-to-exchange (§5).

Performance: precomputed lowercase text on the index; per-keystroke linear
scan with early-out; debounced URL writes (not filtering). Target < 16 ms for
the full corpus.

---

## 4. UI surfaces

### 4a. Activity rail wiring (both workbenches)

- `⌕` **Search** tab → toggles the **search panel** into the sidebar column
  (replaces the scenario tree while active; `Esc` / clicking the tab again
  restores the tree).
- `●` **Skills** tab → toggles the **facet panel** (skill chips grouped by
  role, plus role / artifact-kind / phase chip groups). Multi-select chips
  are real `<button aria-pressed>`; active facets show counts.
- Tabs get `role`, `aria-selected`, and are keyboard-operable (currently
  plain `<div>`s — promoted to buttons).

### 4b. Search panel

Input + live result list + result count + a "clear" affordance. Active
facets render as removable pills above the input. Empty-query state shows
facet summary / "type to search N steps across 12 scenarios."

### 4c. Desktop vs mobile

- **Desktop** (`DesktopWorkbench`): panels live in the existing 248px sidebar
  column; results open the editor pane in transcript mode at the target step.
- **Mobile** (`MobileWorkbench`): search + facets surface via the bottom-tab
  layout — a dedicated Search tab and a facet bottom-sheet; results deep-link
  the same way. **Full parity** (decided in discovery).

### 4d. States (all four, per screen)

- **Empty (no query, no facets):** prompt + corpus size + facet chips.
- **Loading:** index is inlined, so effectively instant; show a skeleton only
  if the flag/index is ever fetched async (the `/demo-search-index.json` path).
- **No results:** "No matches for ‘…’. Clear filters / try another term," with
  one-tap clear.
- **Results:** ranked list with highlights + badges + counts.

---

## 5. Deep-link / URL state

### URL contract

```
/demo
  ?q=rollback                 # free-text query (optional)
  &skill=oc-deploy-ops,oc-git-ops   # OR within facet (comma-separated)
  &role=audit-gate
  &kind=runbook
  &phase=ship
  #runtime-pm-loop:s12        # target scenario:step (optional)
```

- Query params drive **filter state**; the hash drives **navigation** to a
  specific exchange. Either can appear without the other.
- State is serialized on change via `history.replaceState` (debounced) so the
  URL is always shareable without flooding history; `popstate` re-applies.

### Landing behavior (on load or hash change)

1. Apply facet/query state from the query string.
2. If a hash target exists: open that scenario, switch its pane to
   **transcript mode**, **reveal steps through the target** (so the target and
   its context are visible — not the hidden-until-`↵` playback state), scroll
   the target into view, and **ember-flash** it (reuse the existing
   `is-flash-heading`/flash pattern; honor `prefers-reduced-motion`).
3. If the target id is missing/invalid: open the scenario summary and surface
   a non-blocking "that step no longer exists" notice (graceful degradation).

### Cross-surface hooks (enables the seller / skill-page personas)

- `/skills/<id>` can link `/demo?skill=<id>` (and optionally a curated
  `#scenario:step`) to jump into a skill's proof-point.
- The output lightbox can expose a "copy link to this exchange" affordance
  (stretch; confirm at design).

---

## 6. Security / privacy notes

- **No new injection surface.** Indexed text is **plain-text-stripped** from
  the same markdown that's already rendered via the sanitized
  `renderSafeMarkdown` pipeline; result snippets are inserted as text with
  `<mark>` wrapping done on escaped strings (no `innerHTML` of user/remote
  data — the corpus is first-party + build-time, but we still escape).
- **All client-side, first-party data.** No fetch of third-party content, no
  PII, no auth.
- The `/demo-search-index.json` asset (if shipped) is a public, CORS-open
  read of already-public demo content — same posture as `/skills.json`.

## 7. Files touched / added

**Added**
- `site/src/lib/demo-search/index-build.ts` — build the index from walkthroughs.
- `site/src/lib/demo-search/kinds.ts` — artifact-kind normalization + types.
- `site/src/lib/demo-search/demo-search.client.ts` — client engine.
- `site/src/lib/demo-search/url-state.ts` — parse/serialize URL ↔ filter state.
- (optional) `scripts/gen-demo-search-index.mjs` — only if we emit the static
  JSON; otherwise the inline index is built in `demo.astro` frontmatter.

**Changed**
- `site/src/data/walkthroughs/types.ts` — `Phase`, `Beat.phase`.
- `site/src/data/walkthroughs/*.ts` (×12) — add `phase` to beats.
- `site/src/components/DesktopWorkbench.astro` — rail wiring, panels, anchors.
- `site/src/components/MobileWorkbench.astro` — rail/tab wiring, panels, anchors.
- `site/src/pages/demo.astro` — inline index, mount client engine, deep-link.
- `src/lib/flags/registry.js` (+ generated mirror) — `site.feature.demo-search`.
- `site/src/pages/skills/[id].astro` — (stretch) deep-link into demo.

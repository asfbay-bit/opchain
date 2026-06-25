# v1.6 Sprint Plan — "The instrumented pipeline"

> Sprint-level execution plan for the v1.6 release theme defined in
> `roadmap/07-v15-v16-v17-roadmap.md` § "v1.6 — The instrumented pipeline".
> Companion to `roadmap/08-v15-sprint-plan.md` (which froze the v1.5 arc).
> Produced by **oc-app-architect /oc-roadmap**.

**Status:** APPROVED (sprint-plan gate) — 2026-06-25
**Owner:** opchain core
**Branch:** `claude/charming-knuth-2jyhhf`
**Predecessor:** v1.5.0 "Build the AI app" — SHIPPED + LIVE 2026-06-22 (22 skills @ 1.5.0)

**Gate decisions (2026-06-25):**
1. **Protocol:** bump on-disk `protocol_version` → `"1.1"` (Option 2). Validator
   accepts both `"1.0"` and `"1.1"`; `oc-migration-ops` sweeps existing
   checkpoints; new writes stamp `"1.1"`.
2. **Scope:** full v1.6 theme — all 6 sprints.
3. **Cadence:** build straight through. Constrained to the single branch
   `claude/charming-knuth-2jyhhf`, so this ships as **one PR with one
   per-sprint commit per push** (PR opened after S1 is green), not six PRs.
   Stop only on a real blocker or the S6 release cut (manual deploy = user).

---

## Theme

*Every phase reports cost, every skill reports eval score, every checkpoint
carries budget.* v1.5 shipped four AI-native skills; the predictable next
question is **"what did that cost me, and did my changes actually improve
anything?"** v1.6 answers both, and spends the release's one allotted
checkpoint-protocol bump on the `cost` / `eval` / `telemetry` fields.

## Deliverables (the whole theme)

1. **`oc-cost-ops`** (new, `/oc-cost`) — LLM cost attribution per skill phase,
   budget gates in checkpoints, model-tier routing recommendations.
2. **`oc-telemetry-ops`** (new, `/oc-telemetry`) — opt-in local usage metering
   → `.checkpoints/usage.sqlite`, aggregates for the public `/dashboard`.
3. **Checkpoint-protocol fields** — additive optional `cost`, `eval_scores`,
   `telemetry_handle` (see § Protocol decision).
4. **Cross-skill ripples** — `oc-bug-check` + `oc-code-auditor` emit eval
   scores against a stable rubric; `oc-monitoring-ops` gains an AI-app
   template; `oc-orchestrator` `/oc-ops next` factors in cost/budget;
   `oc-prompt-ops` flips `cost_per_eval` from `null` → wired.
5. **Site / GTM** — `/dashboard` (anonymized aggregate usage), `/showcase`
   substance (cost-per-shipped-feature), wire the reserved
   `site.feature.replays-section` flag.
6. **Lockstep bump** — all 24 skills → `1.6.0`; skills changelog entry.
7. **Release-driven site surfaces** — sweep every page/component coupled to the
   current release (Header constant, homepage release bar, `/changelog`,
   roadmap data, architecture diagrams, skill library, OG cards), roll forward
   to v1.6, and capture a reusable per-release checklist; then release handoff.

## Protocol decision (DECIDED at gate: Option 2 — bump wire to "1.1")

The roadmap calls this "checkpoint-protocol v1.3", but two version numbers exist
and only one is in play:

| Version | Today | What it tracks |
|---|---|---|
| on-disk `protocol_version` | `"1.0"` | the checkpoint *file shape*; validator hardcodes `SCHEMA_VERSION="1.0"` |
| skill release `version:` | `1.5.0` | the docs+tooling of the `oc-checkpoint-protocol` skill (lockstep) |

`pm_refs` (skill release 1.2) was added as an **additive optional field under
on-disk schema `1.0`** — old checkpoints stayed valid, the wire version did not
bump. **Recommendation (Option 1):** add `cost` / `eval_scores` /
`telemetry_handle` the same way — validated-when-present, wire
`protocol_version` stays `"1.0"`, skill release → `1.6.0` lockstep. No migration
of existing checkpoints required. **Option 2:** bump the wire
`protocol_version` to `"1.1"` to mark the new fields (validator accepts `1.0`
*and* `1.1`; `oc-migration-ops` sweeps existing checkpoints). A literal `"1.3"`
wire version is not on the table — the wire format has only ever been `1.0`.

---

## Sprint 1 — Protocol fields + new-skill scaffolds + wiring

**Goal:** land the checkpoint-protocol fields and stand up both new skills'
frontmatter so the catalog/flag/site machinery validates green before any
skill body is written.

### Features
Roadmap deliverables 3 (protocol fields) + the scaffold half of 1 & 2.

### Deliverables
- `oc-checkpoint-protocol/SKILL.md`: document `cost`, `eval_scores`,
  `telemetry_handle` as additive optional fields (Core Concepts + a Validation
  note mirroring the `pm_refs` section) and the wire bump to `"1.1"`. (Its
  frontmatter `version:` stays `1.5.0` here — the skill-release bump is the
  atomic S6 lockstep; only the wire `protocol_version` moves in S1.)
- `scripts/checkpoint.mjs`: bump `SCHEMA_VERSION` handling to accept both
  `"1.0"` and `"1.1"`, stamp new writes `"1.1"`, and validate the three new
  fields **when present** (shape checks like `pm_refs`).
- New skills `oc-cost-ops` / `oc-telemetry-ops` are born at `version: 1.6.0`.
- `.checkpoints/README.md`: add the three fields to the schema table.
- `skills/oc-cost-ops/SKILL.md` + `skills/oc-telemetry-ops/SKILL.md`:
  frontmatter + a stub body (full bodies land Sprints 2–3), `version: 1.6.0`.
- `src/lib/flags/registry.js`: add `skills.registry.oc-cost-ops.enabled`,
  `skills.registry.oc-telemetry-ops.enabled`,
  `skills.command./oc-cost.enabled`, `skills.command./oc-telemetry.enabled`.
- `npm run gen-flags` → regenerate `site/src/lib/flags/registry.ts`.

### Test Requirements
- Unit: checkpoint validator accepts valid `cost`/`eval_scores`/
  `telemetry_handle` and rejects malformed shapes; existing checkpoints still
  validate.
- Integration: `npm run gen-catalog` validates all 24 skills (name↔dir, command
  verbs have flags, flags.required/exposes resolve).

### Definition of Done
`npm run gen-catalog`, `npm run checkpoint:validate`, `npm test`, and
`npm run build` all green with 24 skills registered and the two new skills
visible on a local `/skills` build.

### Dependencies
None — this is the foundation sprint.

### Estimated Effort
CLAUDE: 3h | USER: 0.5h (gate review)

---

## Sprint 2 — oc-cost-ops skill body

**Goal:** a complete, dogfoodable cost-attribution skill that fulfills the
contract `oc-prompt-ops` already advertises.

### Features
Roadmap deliverable 1 (full body).

### Deliverables
- `oc-cost-ops/SKILL.md` full body: `/oc-cost` command reference, model-tier
  routing recommendations (Haiku cheap phases / Opus spec+audit, sourced from
  `oc-claude-api`), per-skill-phase cost attribution, the `cost` checkpoint
  field contract, and the **cost-regression gate** that runs alongside
  `oc-prompt-ops`'s score gate.
- `references/`: `cost-attribution.md`, `model-tier-routing.md`,
  `budget-gates.md`, `pricing-reference.md` (token→$ table sourced from
  `oc-claude-api`, marked as a snapshot).
- Wire `prompts/opchain-eval/eval.yaml` `cost_per_eval` and the `cost` block in
  `oc-prompt-ops` checkpoints from `null` → the cost-ops contract.
- Register `oc-cost-ops` in `orchestrator.md` upstream/downstream map +
  pipeline diagram; add its description block.

### Test Requirements
- Unit: any pricing/token-math helper that ships (e.g. a cost estimator) gets
  happy-path + error-path tests.
- Integration: catalog still green; cross-references to `oc-cost-ops` resolve.

### Definition of Done
The skill reads end-to-end as a usable methodology, the prompt-ops `null`
placeholders are resolved, and `oc-cost-ops` appears in `orchestrator.md`.

### Dependencies
Sprint 1 (flags + frontmatter + checkpoint `cost` field).

### Estimated Effort
CLAUDE: 4h | USER: 0.5h (gate review)

---

## Sprint 3 — oc-telemetry-ops skill body

**Goal:** opt-in, local-first usage metering that respects the project's
local-first / no-backend stance and feeds the `/dashboard`.

### Features
Roadmap deliverable 2 (full body).

### Deliverables
- `oc-telemetry-ops/SKILL.md` full body: `/oc-telemetry` command reference,
  opt-in consent model (default OFF, explicit enable), local metering to
  `.checkpoints/usage.sqlite`, the `telemetry_handle` checkpoint field, the
  anonymized-aggregate export that `/dashboard` consumes.
- `references/`: `local-metering.md` (sqlite schema), `privacy-consent.md`
  (opt-in, anonymization, what is and isn't recorded), `aggregation.md`
  (the export shape `/dashboard` reads).
- Register `oc-telemetry-ops` in `orchestrator.md`.
- `.gitignore`: ensure `.checkpoints/usage.sqlite` is ignored (local-only,
  never committed) — confirm it does not break the "track `.checkpoints/`" rule.

### Test Requirements
- Unit: any sqlite-schema or aggregation helper that ships gets tested with a
  temp DB; opt-out path produces no writes.
- Integration: catalog green.

### Definition of Done
Telemetry is genuinely opt-in (verified: disabled → zero writes), the local
sqlite schema is documented, and the aggregate export shape is defined for
Sprint 5's `/dashboard`.

### Dependencies
Sprint 1 (flags + frontmatter + checkpoint `telemetry_handle` field).

### Estimated Effort
CLAUDE: 4h | USER: 0.5h (gate review)

---

## Sprint 4 — Cross-skill ripples (eval scores + cost/budget awareness)

**Goal:** the existing pipeline becomes instrumented — not new skills, upgrades
to the ones that already run every release.

### Features
Roadmap deliverable 4.

### Deliverables
- `oc-bug-check` + `oc-code-auditor`: emit `eval_scores` against a stable
  rubric (not just pass/fail) into their checkpoints; document the rubric.
- `oc-monitoring-ops`: add an "AI-app" monitoring template (token rate, eval
  drift, hallucination flags).
- `oc-orchestrator`: `/oc-ops next` priority engine factors in `cost` /
  budget from checkpoints (doc + any `scripts/checkpoint.mjs next` heuristic).
- `oc-prompt-ops`: confirm `cost_per_eval` / `eval_score_trend` populate via
  the Sprint 2 cost-ops contract.

### Test Requirements
- Unit: rubric scorer (if it ships as code) tested; any `next`-engine cost
  heuristic tested.
- Integration: full suite green; checkpoints carrying `eval_scores` validate.

### Definition of Done
A `/oc-bugcheck` or `/oc-audit` run records an eval score; `/oc-ops next` can
explain a cost-influenced ranking; monitoring has an AI-app template.

### Dependencies
Sprints 1–3 (protocol fields + both new skills).

### Estimated Effort
CLAUDE: 4h | USER: 0.5h (gate review)

---

## Sprint 5 — Site / GTM: /dashboard, /showcase, replays

**Goal:** the credibility surface — show real, anonymized usage and
cost-per-shipped-feature. UX Design Evaluator auto-attaches (UI sprint).

### Features
Roadmap deliverable 5 + the v1.6 GTM bundle.

### Deliverables
- `/dashboard` Astro page: anonymized aggregate usage (pipelines run, most-used
  skill, avg shipped-feature cost, model-tier distribution) — reads the
  `oc-telemetry-ops` aggregate export shape; ships with honest seed/sample data
  if no live aggregate yet, clearly labeled.
- `/showcase` substance: cost-per-shipped-feature stats from opchain's own
  pipeline.
- Wire `site.feature.replays-section` (reserved flag) → a real replays block.
- Nav / Header / JSON-LD wiring for the new page; e2e + LHCI budgets.

### Test Requirements
- Playwright e2e for `/dashboard` (loads, renders, a11y).
- LHCI/Axe budgets hold; astro check 0 errors.

### Definition of Done
`/dashboard` builds and renders with labeled data, passes Design Evaluator +
a11y, and the replays flag controls a real block.

### Dependencies
Sprint 3 (telemetry aggregate export shape).

### Estimated Effort
CLAUDE: 5h | USER: 1h (eyeball the page, gate review)

---

## Sprint 6 — Lockstep skill version bump

**Goal:** every skill at `1.6.0` in lockstep, recorded in the skills changelog.
Skill-side only — site release surfaces are S7.

### Features
Roadmap deliverable 6 (skill-side half).

### Deliverables
- Bump all 24 `skills/*/SKILL.md` → `version: 1.6.0` (atomic, lockstep).
- `skills/CHANGELOG.md` entry for v1.6 (the breaking-change/governance log).
- Refresh `last_reviewed` in `governance:` frontmatter where touched this cycle.
- Confirm `npm run gen-catalog` reports 24 skills @ 1.6.0.

### Test Requirements
- Full suite green post-bump; `npm run build`; `astro check` 0 errors.
- No skill left at 1.5.0 (grep guard).

### Definition of Done
All 24 skills at 1.6.0, changelog entry written, catalog + build green.

### Dependencies
Sprints 1–5 complete.

### Estimated Effort
CLAUDE: 1.5h | USER: 0.5h (review)

---

## Sprint 7 — Release-driven site surfaces + repeatable checklist

**Goal:** sweep **every** site page/component that encodes "the current
release" and roll it forward to v1.6 — and capture the sweep as a reusable
per-release checklist so no surface is ever missed again. This is the sprint
that exists *because* these surfaces drift release-to-release.

### Features
The site half of the release cut + a durable process artifact. Closes the
recurring "we shipped but the site still says v1.5" gap.

### Deliverables — roll forward to v1.6 (the exhaustive list, verified by sweep)
- **Release constant:** `Header.astro` `CURRENT_RELEASE` + `CURRENT_RELEASE_HREF`
  (`v1.5`/`#v1-5` → `v1.6`/`#v1-6`); version chip + its aria/title strings.
- **Homepage:** `index.astro` release bar (`vN · shipped`), the `· next` tag
  (→ v1.7), and the `stat-num` release chip.
- **Changelog page:** `changelog.astro` — promote v1.6 to "Just Released",
  demote v1.5, repoint "Coming Next" → v1.7, shift the roadmap/Planned tab,
  fix deep-link anchors (`#v1-5`/`#v1-6`/`#v1-7`).
- **Roadmap data:** `site/src/data/roadmap-static.ts` — move v1.5 → shipped /
  release-history, v1.6 → in-progress→shipped, surface v1.7 in planned;
  update milestones + URLs.
- **Architecture surfaces:** `MobileArchitecture.astro` (and the desktop
  `architecture` page/components) — the `vX` band badges, the AI-phase /
  pack-fabric "NEW vX" annotations, and add the v1.6 instrumentation layer
  (cost/telemetry) where the diagram narrates the pipeline.
- **Skill library:** `/skills` index + `/skills/[id]` — surface the two new
  skills (auto-discovered) and any current-release badging; confirm phase
  chips include the new skills' phases.
- **Per-skill OG cards:** `Base.astro` dedicated-share-card list — add cards
  for `oc-cost-ops` + `oc-telemetry-ops` (B-03 chip-away).
- **Search / footer / nav:** `SearchPalette.astro`, footer, any `showcase`/
  release blurbs that name the current release or skill count.
- **styleguide:** `styleguide.astro` version badge example.

### Deliverables — the repeatable checklist (the durable win)
- New `skills/oc-release-ops/references/site-release-surfaces.md`: an
  exhaustive, file+line-anchored checklist of every release-coupled site
  surface (the list above), with a one-line "what changes each release" per
  entry. Cross-link it from `version-locations.md` and the oc-release-ops
  SKILL.md so `/oc-release` drives it every cycle.
- Optional guard: a `scripts/` check (or test) that greps the site for the
  previous release literal after a bump and fails if any stragglers remain —
  turns "did we miss one?" into CI signal.

### Release handoff
After S7 is green, hand off to **oc-release-ops** `/oc-release` for the
tag/announce sequence, then **oc-git-ops** → **oc-deploy-ops** per CLAUDE.md
deploy flow (manual deploy = user step). Catalog tag `skills-v1.6.0` at ship.

### Test Requirements
- Playwright e2e: changelog tabs + deep links resolve for the v1.6 layout;
  homepage release bar renders v1.6.
- Straggler grep guard passes (no `v1.5`/`v1-5` left in release-coupled spots).
- LHCI/Axe budgets hold; `astro check` 0 errors.

### Definition of Done
No release-coupled site surface still says v1.5; `/changelog`, homepage,
roadmap, architecture, and skill library all show v1.6 with v1.7 queued; the
`site-release-surfaces.md` checklist exists and is wired into oc-release-ops.

### Dependencies
Sprint 6 (skills at 1.6.0) + Sprint 5 (the new `/dashboard` is a surface the
sweep should include).

### Estimated Effort
CLAUDE: 4h | USER: 1.5h (release review, staging eyeball, prod ship)

---

## Build order summary

```
S1 protocol fields + scaffolds + wiring   ─┐ (foundation, no deps)
S2 oc-cost-ops body                         ├─ depend on S1
S3 oc-telemetry-ops body                    │
S4 cross-skill ripples (eval/cost)         ─┘ depend on S1–S3
S5 site /dashboard /showcase replays       ── depends on S3
S6 lockstep skills → 1.6.0                  ── depends on S1–S5
S7 release-driven site surfaces + checklist ── depends on S6 (+S5); then release handoff
```

Constrained to one branch (`claude/charming-knuth-2jyhhf`): ships as **one PR,
one per-sprint commit per push**, PR opened after S1 is green so CI
(Vitest, astro check, site build, Playwright e2e, LHCI) validates each push.

## Scope toggle

If the cycle needs to ship narrower, the **core** is S1 + S2 + S3 + S6 + S7
(two new skills + protocol fields + lockstep + the site roll-forward — S7 is
*not* optional at release time, since shipping with stale site surfaces is the
exact gap it closes). S4 (ripples) and S5 (`/dashboard`) are the separable
theme extensions that could move to a v1.6.x follow-on.

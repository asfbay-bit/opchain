# v1.5 Sprint Plan — "Build the AI app"

> Companion to `roadmap/07-v15-v16-v17-roadmap.md` (strategy memo). This doc
> sequences v1.5 into five sprints, each gated on an `app-architect`
> Evaluator-style pass (criteria ≥ 6/10) and tracked under a single Linear
> parent ticket with one child per sprint. Modelled on
> `roadmap/02-sprint-plan.md` (the v1.0 redesign plan that hit ship).

**Status:** proposed — 2026-05-12
**Owner:** opchain core
**Parent ticket:** ADEV-401 (v1.5 release)
**Branch where this was authored:** `claude/plan-future-releases-SQeO8`
**Target ship:** v1.5.0 by 2026-06-23 (6 weeks from v1.4 ship; ~1 sprint per week with one slack week)

Effort estimates use `CLAUDE: <hrs> | USER: <hrs>` and match the v1.3
sprint plan's accounting. Total v1.5 budget: ≈ 80 Claude hours / 10 user
hours.

---

## Theme recap

Add four new AI-native skills (`claude-api`, `rag-forge`, `agent-forge`,
`prompt-ops`), wire them into `app-architect`'s `/discover` branch, give
`stack-forge` vector-DB packs, give `code-auditor` prompt-injection +
tool-use safety rules, ship the `/ai-recipes` site surface, bundle the
v1.5 GTM motion (`/blog`, `/for-agencies`, newsletter), and dogfood it all
by rewriting the `/demo` Worker on `claude-api` and publishing opchain's
own eval set via `prompt-ops`. Lockstep bump to `1.5.0`. Catalog tag
`skills-v1.5.0`.

---

## Sprint 1 — Foundation: scaffolds + registry + schema

**Goal:** make the catalog and the build green with four new skills
present as stubs, before any body content lands. Lets later sprints land
each skill in isolation without churn on shared files.

**Linear ticket:** ADEV-402

### Features

- Four new skill directories: `skills/claude-api/`, `skills/rag-forge/`,
  `skills/agent-forge/`, `skills/prompt-ops/`.
- Frontmatter is final (per the stubs in `roadmap/07` §SKILL.md stubs);
  bodies are placeholder ("WIP — sprint N").
- Flag registry entries for each skill (`skills.registry.<id>.enabled`)
  and each new command verb (`skills.command.claude-api.enabled`,
  `skills.command.rag.enabled`, `skills.command.agent.enabled`,
  `skills.command.prompt.enabled`).
- `governance:` block on all four new skills (matches the v1.4 PR 8
  rollout shape — see `roadmap/06-versioning-and-doc-governance.md` §B).
- Astro content schema (`site/src/content.config.ts`) and
  `scripts/gen-skills-catalog.mjs` validators accept the new skills.
- `/skills` page gains an `AI-native` phase chip; the four new skills
  are filterable under it. (Filter logic; new chip styling falls out of
  existing token set.)

### Deliverables

- `skills/<id>/SKILL.md` × 4 (frontmatter complete, body stubbed).
- `skills/<id>/checkpoint.sh` × 4 (standard pattern from
  `release-ops/checkpoint.sh`).
- `skills/<id>/references/.gitkeep` × 4 (reference dirs exist; content
  in sprints 2 + 3).
- `src/lib/flags/registry.js` — 4 + 4 + 1 + 1 + 1 + 1 = 12 new flag
  entries (4 registry + 4 base verbs + 4 sub-verbs spread; verify exact
  count when wiring).
- `site/src/lib/flags/registry.ts` regenerated via
  `scripts/gen-flags.mjs`.
- `scripts/gen-skills-catalog.mjs` — no changes expected; if the
  validator flags a missing field, fix here.
- `site/src/pages/skills/index.astro` — `AI-native` chip in the filter
  set.

### Test Requirements

- Vitest: all 22 skills present in the catalog; the 4 new ones validate.
- `npm run gen-catalog` exits 0.
- `npm run prebuild` + `npm run build` green.
- Playwright: `/skills` renders the 4 new placeholder cards; filtering
  by `AI-native` returns exactly 4.

### Definition of Done

- 4 new skill dirs exist with valid frontmatter and stubbed bodies.
- All builds green (vitest, gen-catalog, prebuild, astro build, e2e).
- `/skills` filter set surfaces the new chip and the 4 skills.
- No body content; that's sprint 2 + 3 work.

### Dependencies

v1.4 PR 8 must be merged first (governance frontmatter validator is
required by the new skills). Coordinate cut-over.

### Estimated Effort

CLAUDE: 10 | USER: 1 (review frontmatter + flag names before PR open)

---

## Sprint 2 — claude-api + rag-forge bodies

**Goal:** land the first two AI-native skills with full bodies, reference
docs, and the cross-skill ripples they trigger.

**Linear ticket:** ADEV-403

### Features

- `skills/claude-api/SKILL.md` body complete: command reference, model-
  routing decision tree, prompt-caching defaults, tool-use patterns,
  migration playbooks, cost guardrails (stubbed — full integration in
  v1.6).
- `skills/claude-api/references/` — `model-routing.md`,
  `prompt-caching.md`, `tool-use.md`, `migration-playbooks.md`.
- `skills/rag-forge/SKILL.md` body complete: Designer / Builder /
  Evaluator loop, vector DB decision tree, embedding model decision
  tree, chunking strategies, hybrid search, retrieval eval.
- `skills/rag-forge/references/` — `vector-db-decision.md`,
  `embedding-models.md`, `chunking-strategies.md`, `retrieval-eval.md`.
- `stack-forge` gains four vector-DB packs: `pgvector`, `turbopuffer`,
  `pinecone`, `supabase-vectors`. Pack files follow the v1.4 PR 1
  registry schema; coverage flags emit via `scripts/gen-stack-packs`.
- `app-architect` `/discover` learns an "AI app?" branch that
  routes the interview through `claude-api` + `rag-forge`. New section
  in `skills/app-architect/SKILL.md` under Phase 2.

### Deliverables

- `claude-api` + `rag-forge` ship-ready, including the four references
  per skill (~5KB each, under the 50KB soft cap that v1.4 set for
  langRef docs).
- `packs/pgvector/`, `packs/turbopuffer/`, `packs/pinecone/`,
  `packs/supabase-vectors/` — each with `pack.yml` and a `vectorRef`
  doc under the same 50KB cap.
- `scripts/gen-stack-packs` reports `16 pack(s), 16 coverage flag(s)`
  (12 from v1.4 + 4 new — verify against actual v1.4 count post-PR-7).
- `scripts/gen-api-dev-adapters.mjs` re-run (no new adapters; vector-DB
  packs are `kind: data-store`, not language). If the validator wants a
  new `kind`, add it; otherwise reuse `deploy-target`-style skip.
- `skills/app-architect/SKILL.md` Phase 2 update — AI-app branch in
  the discovery flow.
- Cross-tests: `tests/pack-dispatch.test.js` + `tests/stack-packs-real.test.js`
  extended for the 4 new packs.

### Test Requirements

- Vitest: pack-dispatch returns the right runtime config for the 4 new
  vector-DB packs. Equivalence test that pack docs match registry. AI-
  app branch in app-architect routes correctly (snapshot test on the
  flow).
- `npm test` ≥ existing baseline (currently 198/198 per v1.4 PR 4
  checkpoint).
- Playwright: `/skills/claude-api` and `/skills/rag-forge` render the
  body and link to references.

### Definition of Done

- `claude-api` + `rag-forge` body content equivalent in depth to
  `stack-forge` + `api-dev` (the existing tri-agent / decision-tree
  models).
- 4 new vector-DB packs in the registry, all tests passing.
- `app-architect` AI-app branch demonstrable end-to-end against a
  scratch project (manual smoke).

### Dependencies

Sprint 1.

### Estimated Effort

CLAUDE: 22 | USER: 2 (review claude-api reference accuracy — model
routing in particular; AI-app branch text in app-architect)

---

## Sprint 3 — agent-forge + prompt-ops bodies

**Goal:** land the second pair of AI-native skills with full bodies and
the cross-skill ripples (`code-auditor` learns prompt-injection +
tool-use rules; opchain's own eval set published under `prompt-ops`).

**Linear ticket:** ADEV-404

### Features

- `skills/agent-forge/SKILL.md` body complete: Planner / Builder /
  Evaluator loop, agent topology decision tree, tool budget design,
  harness loop shapes, agent eval.
- `skills/agent-forge/references/` — `agent-topology.md`,
  `tool-budgets.md`, `harness-loops.md`, `agent-eval.md`.
- `skills/prompt-ops/SKILL.md` body complete: prompt-as-code convention,
  eval datasets, drift detection, regression workflow, `cost-ops`
  collaboration stub.
- `skills/prompt-ops/references/` — `prompt-versioning.md`,
  `eval-datasets.md`, `drift-detection.md`.
- `code-auditor` rule pack additions: prompt-injection patterns
  (delimiter injection, indirect injection via tool output, jailbreak
  templates), tool-use safety (allowlist drift, parameter pollution,
  privilege escalation through chained tool calls). Lives under
  `skills/code-auditor/references/ai-safety-rules.md`.
- opchain's own eval set published as `prompts/opchain-eval/` (golden
  set of inputs + expected outputs for the demo Worker prompts) —
  becomes the v1.5 dogfooding artifact and the worked example for
  `/prompt eval`.

### Deliverables

- `agent-forge` + `prompt-ops` ship-ready.
- `code-auditor` reference pack for AI safety; `skills/code-auditor/SKILL.md`
  body updated with a "Phase: AI app?" sub-routine.
- `prompts/opchain-eval/` directory with: `inputs.jsonl`,
  `expected.jsonl`, `eval.yaml` (rubric).
- `prompt-ops` `/prompt eval` worked example documented in its SKILL.md
  using `prompts/opchain-eval/` as the demo target.

### Test Requirements

- Vitest: `prompts/opchain-eval/` parses cleanly; `/prompt eval --dry-run`
  against the demo set produces a deterministic score.
- Code-auditor rule pack: 10 hand-crafted positive + 10 negative cases
  per category (prompt-injection, tool-use safety), asserts grade ≥ B+
  on the synthetic suite.
- Playwright: `/skills/agent-forge` and `/skills/prompt-ops` render
  bodies and references.

### Definition of Done

- `agent-forge` + `prompt-ops` body content equivalent in depth to
  `claude-api` + `rag-forge`.
- `code-auditor` flags an injected prompt in a synthetic fixture.
- opchain's own eval set is the demo input for `/prompt eval`.

### Dependencies

Sprint 1, Sprint 2.

### Estimated Effort

CLAUDE: 22 | USER: 2 (review agent-forge topology accuracy; smoke-test
the eval set output)

---

## Sprint 4 — Site surface + GTM bundle

**Goal:** ship the public site surfaces for v1.5 and the first GTM
artifacts (`/blog`, `/for-agencies`, newsletter). This sprint is the
one explicitly carrying the v1.5 distribution arc.

**Linear ticket:** ADEV-405

### Features

- `/ai-recipes` page — 3 multi-skill walkthroughs:
  - "Ship a RAG app in a week" (rag-forge → app-architect → stack-forge
    → claude-api → code-auditor → deploy-ops).
  - "Build a Claude agent that ships PRs" (agent-forge → app-architect
    → claude-api → git-ops).
  - "Migrate from Sonnet 4.6 to 4.7 without regressing" (claude-api
    migrate playbook → prompt-ops regress → release-ops).
- `/compare` — add a "Build AI apps" row to the comparison matrix
  against LangChain, LlamaIndex, Vellum, Inkeep. Antigravity column
  promoted from "review" to either confirmed or removed.
- `/pipeline-builder` — AI-app variant. Adds an "AI app?" question; if
  yes, recommended pipeline includes the four new skills.
- `/blog` scaffold — Astro content collection at `site/src/content/blog/`,
  index page at `site/src/pages/blog/index.astro`, post page at
  `site/src/pages/blog/[slug].astro`. RSS feed at `/blog/rss.xml`.
- First two launch posts (hand-edited):
  - `2026-06-23-v1.5-ai-native-expansion.md` — frames the theme.
  - `2026-06-23-building-rag-forge-with-rag-forge.md` — honest
    dogfooding tension piece.
- `/for-agencies` page — handoff workflow, per-client checkpoint
  isolation, deliverable templates, the "client handoff" demo
  scenario.
- Newsletter wiring — `site.ui.footer.newsletter` flag flipped to
  default `true`; footer renders a single-field form posting to
  Buttondown's hosted form action. No backend needed.

### Deliverables

- `site/src/pages/ai-recipes.astro` (or `/ai-recipes/index.astro` if a
  collection emerges).
- `site/src/pages/compare.astro` — new row + provider columns audit.
- `site/src/pages/pipeline-builder.astro` — new question + branch.
- `site/src/content/blog/` collection + 2 posts.
- `site/src/pages/blog/index.astro` + `[slug].astro`.
- `site/src/pages/for-agencies.astro` + one new demo scenario at
  `site/src/data/walkthroughs/agency-client-handoff.json` (or whatever
  the existing walkthrough schema is — see `/demo` source).
- `site/src/components/Footer.astro` (or wherever footer lives) —
  newsletter form wired behind the now-default-true flag.
- Per-skill OG images for the 4 new AI-native skills (chips away at
  backlog B-03; produced via existing OG image generator if one exists,
  hand-designed otherwise).

### Test Requirements

- Playwright: `/ai-recipes`, `/blog`, `/blog/v1.5-ai-native-expansion`,
  `/for-agencies` all return 200; `/compare` renders the new row;
  `/pipeline-builder` produces the AI-app variant when "AI app?" is
  selected.
- Axe a11y scan: 0 violations on each new route.
- Lighthouse: Performance ≥ 95, Accessibility ≥ 95, SEO ≥ 95 on the
  new routes.
- RSS feed validates against W3C feed validator (offline tooling).
- Newsletter form posts to Buttondown's hosted action and returns 200
  (Playwright with a real Buttondown sandbox endpoint).

### Definition of Done

- New routes shipped, no axe violations, Lighthouse ≥ 95.
- Newsletter form is functional end-to-end against the chosen
  provider's sandbox.
- Two blog posts publish under `/blog`.
- B-03 backlog drops 4 per-skill OG images closer to done.

### Dependencies

Sprint 1 (catalog has the 4 new skills for `/skills` to surface and for
the recipes to reference). Sprints 2 + 3 (recipes link into the bodies).

### Estimated Effort

CLAUDE: 16 | USER: 3 (review `/ai-recipes` accuracy, blog post copy,
`/for-agencies` framing, Buttondown account setup)

---

## Sprint 5 — Dogfood + release ship

**Goal:** rewrite the `/demo` Worker on `claude-api` patterns, run the
v1.5 release via `release-ops` (lockstep bump → /changelog → catalog tag
→ manual deploy), and re-stamp every checkpoint.

**Linear ticket:** ADEV-406

### Features

- `/demo` Worker rewrite — the existing demo route uses Claude (per
  v1.3 `runtime-pm-loop` scenario). Rewrite using `claude-api`
  patterns: model routing per scenario type (Sonnet for build scenarios,
  Haiku for cheap repetition), prompt caching for the system prompt,
  tool use for the agent scenario, structured retry + cost telemetry
  stubs.
- `prompt-ops` regression demo — the rewritten demo Worker's prompts
  registered under `prompts/opchain-demo/`; `/prompt regress` against
  `prompts/opchain-eval/` runs in CI on PRs touching the demo. Sets the
  precedent for v1.6 (`cost-ops` adds the budget assertion).
- `release-ops` runs the v1.5 release: `/release plan` → `/release
  draft` → `/release bump` → `/release announce` → `/release ship`.
  All 22 skills go to `1.5.0` atomically.
- `/changelog` v1.5 entry — written by `/release draft` from sprint
  checkpoints and merged PRs, hand-edited for narrative.
- `skills/CHANGELOG.md` v1.5 entry — separate, opchain catalog-level
  changelog (v1.4 PR 8 seeded this file).
- Homepage release pill flipped to `v1.5` with the one-liner ("Build
  the AI app · claude-api · rag · agents · prompt-ops"). Closes the
  `site.experiment.landing-cta-copy` flag with a final variant.
- Catalog tag `skills-v1.5.0` (single tag, per v1.4's tag strategy
  decision).
- Manual deploy: `npm run deploy:staging`, eyeball
  `/api/health` (verify `version` field matches HEAD SHA), then
  `npm run deploy` for prod.
- Re-stamp checkpoints: `app-architect`, `release-ops`, `git-ops`,
  `orchestrator`, plus the 4 new skills (`claude-api`, `rag-forge`,
  `agent-forge`, `prompt-ops`).
- New demo scenario added under `/demo`: "v1.5 ships v1.5" — meta proof
  the way v1.3 had `release-ops-dogfood`.

### Deliverables

- `src/lib/claude-api/` shared client (or wherever the demo Worker's
  Claude calls live) rewritten on the new patterns.
- `prompts/opchain-demo/` + `prompts/opchain-eval/` cross-referenced in
  `prompt-ops/SKILL.md` as the worked example.
- `.github/workflows/ci.yml` — new job `prompt-ops-regress` running
  `/prompt regress` on touched prompt files.
- `site/src/pages/changelog.astro` — new `<section class="release release--current">`
  for v1.5; v1.4 demoted to `release--past`.
- `skills/CHANGELOG.md` updated.
- Lockstep bumps via `release-ops`: 22 files touched.
- Homepage release-pill update.
- `.checkpoints/*.checkpoint.json` re-stamped.

### Test Requirements

- Vitest + Playwright suite green on the demo rewrite.
- `/prompt regress` against `prompts/opchain-eval/` returns
  deterministic scores; CI job passes.
- Manual smoke against staging.opchain.dev: `/`, `/ai-recipes`,
  `/skills`, `/demo` all functional; `/api/health` returns
  `version: <v1.5 SHA>`.
- Smoke against opchain.dev post-deploy.
- `npm run checkpoint:validate` passes against every re-stamped
  checkpoint.

### Definition of Done

- opchain.dev serves v1.5 with all 4 new skills live in `/skills`.
- /demo Worker is running on claude-api patterns; the rewrite is
  documented in the v1.5 launch blog post.
- prompt-ops regression demo runs in CI on every PR touching prompts.
- All 22 skill SKILL.md files at version 1.5.0.
- Catalog tag `skills-v1.5.0` pushed.
- Re-stamped checkpoints reflect the post-ship state.

### Dependencies

All prior sprints. v1.4 must have fully shipped before this sprint
starts (the lockstep bump from 1.4.0 → 1.5.0 requires 1.4.0 to be the
prior baseline).

### Estimated Effort

CLAUDE: 14 | USER: 2 (deploy approval, smoke staging + prod, eyeball
homepage release pill, review the v1.5 launch blog post copy one last
time)

---

## Build Order summary

Mirrors the app-architect Phase 4 "Build Order" guidance and the v1.3
pattern (foundation → bodies → site/GTM → release):

1. **Sprint 1:** scaffold + flag registry + Astro schema.
2. **Sprint 2:** claude-api + rag-forge bodies (with stack-forge vector
   packs + app-architect AI-app branch).
3. **Sprint 3:** agent-forge + prompt-ops bodies (with code-auditor AI-
   safety rules + opchain eval set).
4. **Sprint 4:** site surfaces + GTM bundle.
5. **Sprint 5:** dogfood (demo Worker rewrite) + release ship.

---

## Total effort (estimate)

| Sprint                              | CLAUDE hrs | USER hrs | Cum CLAUDE |
|-------------------------------------|-----------:|---------:|-----------:|
| 1 — Foundation                      | 10         | 1        | 10         |
| 2 — claude-api + rag-forge          | 22         | 2        | 32         |
| 3 — agent-forge + prompt-ops        | 22         | 2        | 54         |
| 4 — Site + GTM bundle               | 16         | 3        | 70         |
| 5 — Dogfood + release ship          | 14         | 2        | 84         |
| **Total**                           | **84 hrs** | **10 hrs** | —        |

Calendar-wise, ~6 weeks with one sprint per week and one slack week for
unforeseen drift. Matches the v1.3 / v1.4 release cadence.

---

## Linear ticket structure

```
ADEV-401 — v1.5: Build the AI app (parent, in progress)
  ├── ADEV-402 — Sprint 1: Foundation (scaffolds + registry + schema)
  ├── ADEV-403 — Sprint 2: claude-api + rag-forge bodies
  ├── ADEV-404 — Sprint 3: agent-forge + prompt-ops bodies
  ├── ADEV-405 — Sprint 4: Site surface + GTM bundle
  └── ADEV-406 — Sprint 5: Dogfood + release ship
```

Side artefacts (also tracked under ADEV-401 as related):

- ADEV-407 — `/blog` content cadence (post-launch, ≥ 1/week)
- ADEV-408 — `/for-agencies` discovery follow-ups (which agencies to
  pitch first; first three signed adopters tracked here)
- ADEV-409 — v1.6 stubs (`cost-ops` + `telemetry-ops` placeholders so
  the foreshadowing in v1.5 references real ticket ids)

Actual Linear ticket numbers will be assigned at creation; the
ADEV-401…409 sequence here is a placeholder that the v1.5 kickoff
session updates after ticket creation.

---

## Per-sprint Evaluator gate

Each sprint ends with the same gate `app-architect` runs internally
(`skills/app-architect/SKILL.md` Phase 5 / Evaluator pass — criteria
≥ 6/10). For this release the criteria are:

1. **Frontmatter correctness** — all new + touched SKILL.md frontmatter
   validates against `gen-skills-catalog.mjs`.
2. **Test coverage** — vitest baseline holds or grows.
3. **Reference doc completeness** — every claim in a SKILL.md body has
   a citation in a `references/<id>.md` file.
4. **Cross-skill consistency** — no contradiction between the new
   skill's claims and existing skills (claude-api on model routing
   doesn't conflict with stack-forge on stack picks; prompt-ops on
   evals doesn't conflict with code-auditor on grading).
5. **Site rendering** — pages render with no console errors, no axe
   violations, no Lighthouse score regression.
6. **Dogfooding** — at least one place inside opchain itself uses the
   sprint's new artefacts (sprint 2: app-architect AI-app branch
   references claude-api; sprint 4: blog post drafted via the
   reverse-spec pattern; sprint 5: demo Worker uses claude-api).

If any criterion < 6/10, the sprint extends; v1.5 doesn't ship until
sprint 5 passes the gate.

---

## What v1.5 explicitly defers

- **`cost-ops` + `telemetry-ops`** — v1.6 owns these. claude-api stubs
  the cost guardrails; prompt-ops stubs the cost-per-eval field;
  neither is wired through `.checkpoints/usage.sqlite` yet.
- **Marketplace / community skills** — v1.7 candidate.
- **Monorepo sub-project checkpoint scoping** — v1.7 / v1.8 candidate
  (`monorepo-ops` skill).
- **Per-skill OG images for the existing 18 skills** — chip away 4 in
  v1.5 (the new ones), then 4 more per release.
- **Beta banner / hero variant real use** — v1.7 / v1.8.
- **`/case-studies` page** — v1.7 (needs adopters first).
- **`/community` page** — v1.7 (needs cadence first).

---

## Rollback strategy

Each sprint is its own PR(s); each ships independently. Rollback is per-
PR via `git revert` (catalog mode — no destructive ops). The lockstep
bump in sprint 5 is the irreversible point; `release-ops` `/release
rollback` reverts the bump within the same release if `deploy-ops` has
not yet shipped to prod. After prod ship, rollback is a hotfix release
(v1.5.1) — same pattern v1.4 will document on first need.

---

## Decision

Adopt the 5-sprint, ≈ 6-week plan. Land scaffolds in sprint 1 before any
body work to keep file conflicts contained. Bundle the GTM motion in
sprint 4 alongside the site surface so v1.5 ships with the distribution
arc, not after it. Open ADEV-401 + the five sprint child tickets in the
same session that lands this doc.

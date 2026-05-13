# Roadmap — v1.5 / v1.6 / v1.7+

> Strategy memo. Frames the next three releases and the long-tail backlog
> beyond them. Sprint-level execution lives in
> `roadmap/08-v15-sprint-plan.md`. Companion to
> `roadmap/06-versioning-and-doc-governance.md` (which froze the v1.3 / v1.4
> release-ops + governance arc).

**Status:** proposed — 2026-05-12
**Owner:** opchain core
**Related tickets:** ADEV-327 parent (v1.4 in flight); v1.5 parent + child tickets opened alongside this memo
**Branch where this was authored:** `claude/plan-future-releases-SQeO8`

---

## Context

After v1.4 lands (pack registry + governance + multi-mobile), the *breadth*
well is dry. The next three releases need to pivot to either **depth** (do
what we already claim, better and more honestly) or **AI-native** (the only
genre every dev tool right now is being measured on). This memo picks the
themes, names the skills, sequences the deliverables, and calls out the
distribution gap that opchain has carried since v1.0.

### Narrative arc so far

```
v1.0 catalog
v1.1 tri-agent quality loop + Astro site
v1.2 PM-MCP prose
v1.3 PM-MCP runtime + platforms + release-ops (dogfooded)
v1.4 pack registry + governance + multi-mobile           ← in flight
v1.5 build the AI app                                    ← proposed below
v1.6 the instrumented pipeline                           ← proposed below
v1.7 pick ONE distribution play                          ← lean: marketplace
```

### Where opchain actually is (12 May 2026)

**Shipped (v1.3, 2026-05-11):** 18 skills at `1.3.0`, PM-MCP runtime through
five skills, Cloudflare/Django/Rails/Go/Rust platform menu, release-ops
dogfooded against opchain's own release, site at 18 pages including
`/compare` vs. 7 competitors and `/security` with a disclosure form wired
through `/api/feedback`.

**In flight (v1.4, partway through):** Pack registry in `stack-forge`.
PRs 1–4 shipped (architecture, 5 language packs, pack-aware dispatch +
api-dev adapters + mobile branch, modern-web bulk). PRs 5–8 still pending:
enterprise bulk, Apple/iOS, Android/Flutter/RN, hosting adapters, then PR 8
= `/coverage` page + governance frontmatter rollout via `migration-ops` +
lockstep bump to `1.4.0`.

---

## v1.5 — "Build the AI app"

**Why this theme:** the single biggest *categorical* gap in opchain. Every
Claude Code user is, by definition, AI-app-curious. opchain currently has
zero owners for AI-feature design. It is also the strongest constraint fit
— Markdown methodology + reference snippets are exactly the shape eval
datasets and prompt versions desperately need (source-controlled,
diffable, lockstep-versioned).

**Concrete plan:**

| Verb | Skill | What it owns |
|---|---|---|
| `/claude-api` | **claude-api** (new) | Model selection (Opus/Sonnet/Haiku routing), prompt caching, batch vs streaming, tool use, citations, files, memory, retry/cost guardrails. `/claude-api migrate` for model-version bumps (4.6 → 4.7 etc.). |
| `/rag` | **rag-forge** (new) | Vector DB selection (pgvector, Turbopuffer, Pinecone, Supabase Vectors), embedding model choice, chunking strategy, hybrid search, retrieval eval. Verbs: `/rag`, `/rag eval`, `/rag bench`. |
| `/agent` | **agent-forge** (new) | Claude Agent SDK app scaffold: subagent topology, tool budgets, harness loop design, eval harness. Verbs: `/agent`, `/agent eval`, `/agent loop`. |
| `/prompt` | **prompt-ops** (new) | Prompt versioning, eval datasets, regression detection, drift tracking. Verbs: `/prompt`, `/prompt eval`, `/prompt diff`. |

**Cross-skill ripples:**

- `app-architect` learns an "AI app?" branch in `/discover` that routes to
  the new four.
- `stack-forge` adds vector-DB packs (pgvector, Turbopuffer, Pinecone,
  Supabase Vectors) to the v1.4 pack registry — pure additive.
- `code-auditor` learns prompt-injection and tool-use safety rules.
- `cost-ops` is teased as a v1.6 stub (foreshadowing pays off).

**Site / dogfood deliverables:**

- New `/ai-recipes` page (multi-skill walkthroughs for "ship a RAG app",
  "ship an agent", "migrate to Sonnet 4.6").
- `/compare` adds a "Build AI apps" row against LangChain / LlamaIndex /
  Vellum / Inkeep.
- `/skills` filter set expands with an "AI-native" phase chip.
- `/pipeline-builder` renders an AI-app variant.
- `/demo` Worker rewritten to use `claude-api` patterns; the public eval
  set ships under `prompt-ops` as the v1.5 dogfooding proof.

**Site-debt closed in passing:** B-03 per-skill OG images (4 new skills
force the issue), `site.experiment.landing-cta-copy` resolved to a final
variant, `site.ui.footer.newsletter` flag wired (newsletter is the v1.5
GTM artifact — see § GTM below).

**Lockstep bump:** all 22 skills (18 + 4 new) → `1.5.0`. Catalog tag
`skills-v1.5.0`.

**Sprint-level execution:** see `roadmap/08-v15-sprint-plan.md`.

---

## v1.6 — "The instrumented pipeline"

**Why this theme:** v1.5 lands new AI-native skills; the inevitable v1.5
complaint will be *"these are great but I don't know what they cost me or
whether my changes improved anything."* v1.6 answers that, and it is also
the right release for the first checkpoint-protocol bump since v1.2.

**Concrete plan:**

| Verb | Skill | What it owns |
|---|---|---|
| `/cost` | **cost-ops** (new) | LLM cost attribution per skill phase, budget gates in checkpoints, model-tier routing recommendations (Haiku for cheap phases, Opus for spec/audit). |
| `/telemetry` | **telemetry-ops** (new) | Opt-in local usage metering writing to `.checkpoints/usage.sqlite`; aggregates "skills people actually use" stats for the public `/dashboard`. |

**Cross-skill ripples (existing skills get upgraded, not new ones):**

- `bug-check` and `code-auditor` emit eval scores against a stable rubric,
  not just pass/fail.
- `monitoring-ops` gains an "AI-app" template covering token rate, eval
  drift, hallucination flags.
- `prompt-ops` (from v1.5) starts populating `cost_per_eval` and
  `eval_score_trend` fields.
- `orchestrator` `/ops next` factors cost and budget into prioritization.

**Protocol bump:** **checkpoint-protocol v1.3** — adds `cost`,
`eval_scores`, `telemetry_handle` fields. First protocol bump since v1.2
PM-refs; rolled out by `migration-ops` the same way governance frontmatter
rolled out in v1.4 PR 8.

**Site / dogfood deliverables:**

- New `/dashboard` page showing anonymized aggregate opchain usage as a
  living showcase (closes the "is anyone actually using this?" objection
  — see § GTM below).
- `/showcase` finally has substance (cost-per-shipped-feature stats from
  opchain's own pipeline).
- `site.feature.replays-section` flag wired (replays of real pipeline runs
  with cost overlays).

**Lockstep bump:** all 24 skills → `1.6.0`.

**One-line pitch:** *v1.6 makes the pipeline instrumented — every phase
reports cost, every skill reports eval score, every checkpoint carries
budget.*

---

## v1.7 — Pick ONE distribution play (don't leave it in the long tail)

By the time v1.6 ships, opchain will have 24 skills, instrumented
pipelines, and AI-native coverage. The biggest remaining weakness is
**distribution / GTM** (see § Critique below). v1.7 should explicitly
promote one of the long-tail ideas into a flagship release theme rather
than continuing to accrete skills.

**Strongest v1.7 candidates (decide closer to the time — not today):**

1. **"Marketplace + templates"** — `marketplace` site surface for
   community-contributed skills + `template-ops` skill for opinionated
   project starters that pre-wire a whole pipeline. Best fit if v1.5 + v1.6
   attracted contributors.
2. **"Multi-project / agency play"** — implement (not just document)
   checkpoint sub-project scoping (`monorepo-ops` skill), ship a
   `/for-agencies` page, add a "client handoff" demo scenario. Best fit if
   v1.5 + v1.6 traction is mostly with consultancies.
3. **"Discovery + product"** — `discovery-ops` skill (JTBD / opportunity
   tree, upstream of `app-architect`) + `qa-ops` (separates test-pyramid
   design from `bug-check`'s pre-commit gate). Best fit if the v1.5 / v1.6
   retro says "the pipeline still starts too late."

**Pre-commitment lean:** option 1 (marketplace + templates). It compounds
— every new community skill adds breadth without core-team cost — and is
the natural follow-on once opchain has telemetry to grade community
contributions on.

---

## v1.7+ long tail — ranked, not unranked

These are candidate themes for v1.7 / v1.8 / v1.9 / v2.0. Promote one into
each release when its time comes. Each row is scored 1–5 on four axes:

- **Fit** — constraint fit (Markdown / MIT / local-first / no backend)
- **Pull** — audience pull (can I name three real adopters in week 1?)
- **Dogfood** — does opchain itself use the skill within one release?
- **Scope** — fits a 6-week / 4-skill / lockstep-bump release?

Score is the sum (max 20). Higher = stronger v1.7+ candidate.

| Candidate                              | Cluster              | Fit | Pull | Dogfood | Scope | **Sum** | v1.7+ verdict |
|----------------------------------------|----------------------|----:|-----:|--------:|------:|--------:|---------------|
| **`marketplace` + `template-ops`**     | Ecosystem            | 5 | 4 | 5 | 4 | **18** | **Promote to v1.7 (lean)** |
| **`monorepo-ops`** (impl sub-project)  | Pipeline depth       | 5 | 4 | 5 | 3 | **17** | Strong v1.7 alt; or v1.8 |
| **`prompt-ops` deepening** (eval host) | AI-native depth      | 5 | 4 | 5 | 3 | **17** | Folds into v1.6 |
| `discovery-ops`                        | Pipeline depth       | 5 | 3 | 4 | 4 | **16** | v1.7 alt; or v1.8 |
| `pricing-forge`                        | Business-app         | 4 | 4 | 3 | 4 | **15** | v1.8 candidate |
| `email-ops`                            | Business-app         | 4 | 4 | 3 | 4 | **15** | v1.8 candidate |
| `qa-ops`                               | Pipeline depth       | 5 | 3 | 4 | 3 | **15** | v1.8 alt |
| `billing-ops`                          | Business-app         | 4 | 4 | 2 | 4 | **14** | v1.8 |
| `support-ops`                          | Business-app         | 4 | 3 | 3 | 4 | **14** | v1.9 |
| `compliance-ops` (SOC2/HIPAA/GDPR)     | Compliance & data    | 3 | 4 | 2 | 4 | **13** | v1.9 / v2.0 (enterprise pull) |
| `analytics-ops` (event taxonomy)       | Compliance & data    | 4 | 3 | 3 | 3 | **13** | v1.8 alt |
| `a11y-ops`                             | Pipeline depth       | 5 | 2 | 4 | 2 | **13** | v1.9 |
| `cms-ops`                              | Business-app         | 4 | 3 | 2 | 4 | **13** | v1.9 |
| `growth-ops`                           | Business-app         | 4 | 3 | 2 | 3 | **12** | v2.0; partial fit (some pieces are content not skill) |
| `vscode-ext`                           | Ecosystem            | 2 | 4 | 4 | 2 | **12** | Spike, not full theme |
| `i18n-ops`                             | Pipeline depth       | 4 | 2 | 3 | 3 | **12** | v2.0 (low pull) |
| `audit-trail-ops`                      | Compliance & data    | 4 | 2 | 3 | 3 | **12** | Folds into `security-auditor` |
| `etl-ops`                              | Compliance & data    | 3 | 3 | 2 | 3 | **11** | Defer indefinitely |
| `legal-ops` (ToS / DPA templates)      | Business-app         | 3 | 3 | 2 | 3 | **11** | Defer; risk of stale templates |
| `playground` (browser sandbox)         | Ecosystem            | 1 | 4 | 4 | 1 | **10** | Skip — violates local-first |

**Scoring notes:**

- `marketplace + template-ops` tops because community contributions
  compound (every new pack adds breadth at zero core-team cost) and the
  dogfooding loop is obvious (opchain itself is the first marketplace).
- `monorepo-ops` is tied at the top — opchain *itself* is the largest
  monorepo case study and would dogfood it the day it ships. The reason
  it's the alternate rather than the lead is scope: implementing sub-project
  checkpoint scoping properly is also a checkpoint-protocol bump, which
  v1.6 already spends.
- `prompt-ops` "deepening" scores high but is not a v1.7 theme — it's
  what `prompt-ops` should ship inside v1.6 once `cost-ops` and
  `telemetry-ops` exist to feed it.
- `playground` scores low because a browser sandbox violates local-first
  and would require backend hosting opchain has consistently refused.
- Business-app cluster (`pricing` / `billing` / `email` / `support` /
  `cms`) clusters in the 13–15 range. It's a real long-tail, but only
  pulls high once opchain has logos to point to — v1.8+, not v1.7.
- Compliance / data (`compliance-ops` / `etl-ops`) score lowest on Pull
  *for now* — they're the enterprise lane that becomes mandatory once
  paid pilots show up. Build them reactively, not speculatively.

---

## Cross-cutting / always-on (runs in parallel to every themed release)

- **Pack registry growth.** Add 2–4 packs per release. After v1.4 lands
  the core-team-built phase ends; switch to *community-contributed* packs
  (frees ~6 Claude-hours per release for higher-leverage work).
  Diminishing returns past pack #20 — Elm and ClojureScript will not move
  the needle.
- **Scenario authoring.** `/demo` and `/showcase` starve for content.
  Ship 2 new scenarios per release.
- **Checkpoint protocol bumps.** Bump at v1.6 (cost + eval fields) and
  again at v1.8 (monorepo scoping). Never bump in odd-numbered minor
  releases — predictable cadence is more valuable than fresh fields.
- **Site debt burndown.** Close one reserved flag per release (newsletter
  in v1.5, replays section in v1.6, hero variant locked in v1.7, beta
  banner used in v1.8).
- **Governance frontmatter audit.** Once v1.4 PR 8 lands governance
  fields, audit drift every release through `release-ops`.
- **`/compare`** keeps current vs. competitor matrix; add any new entrant
  per release. Antigravity is currently flagged "review" — promote or
  demote in v1.5.
- **Per-skill OG images.** Chip away 4 per release until B-03 closes.

---

## GTM plan deep-dive — the distribution gap

### The problem

Six releases in (v1.0 → v1.4), opchain has zero public artifacts that say
"someone actually used this and shipped something." `/showcase` is a
feature index. `/demo` is scripted, not lived. There are no logos, no
usage counts, no testimonials, no "shipped with opchain" badge in the
wild. The brand strategy ("open-source, MIT, local-first") is excellent
for credibility and terrible for distribution.

This is unrecoverable inside skill design alone — the skills are fine, the
*story isn't being told*. Every themed release from v1.5 onward needs to
bundle one GTM move.

### v1.5 GTM bundle

1. **Public dev-log at `/blog`.** Single-page Markdown. First post is
   "How v1.5 was built (with v1.4)" — produced by running `reverse-spec`
   over the v1.5 commit history. Subsequent posts are weekly, also
   `reverse-spec` outputs over the prior week. Zero new infra (Astro
   content collection, static rendering, no comments).
2. **Wire the reserved newsletter flag** (`site.ui.footer.newsletter`).
   Initial provider: Buttondown (free tier, plain Markdown editor, RSS-
   importable). Cadence: one email per blog post. CTA: "weekly opchain
   field notes." Single field, double-opt-in.
3. **`/for-agencies` page.** The missing audience is the agency /
   consultancy that ships 5–10 client builds per quarter — natural
   opchain super-user (multi-project orchestrator, lockstep skills,
   version-controlled checkpoints). Page content: handoff workflow,
   per-client checkpoint isolation, client-deliverable templates. One
   demo scenario added: "Take a client from spec to shipped on a 4-week
   fixed-bid."
4. **First four dev-log posts (the cadence proof):**
   - **Post 1 — "v1.5 in 6 weeks: the AI-native expansion."** Frames the
     theme, walks through `claude-api`, `rag-forge`, `agent-forge`,
     `prompt-ops`. Hand-edited for launch.
   - **Post 2 — "Building rag-forge with rag-forge (sort of)."** Honest
     post about dogfooding tension — rag-forge's reference docs are not
     a RAG application, they're a knowledge pack. What the analog of
     dogfooding looks like for a methodology skill.
   - **Post 3 — "What it cost to ship v1.5."** Tease for v1.6
     (`cost-ops`). Currently the cost is unknowable; v1.6 closes that
     loop. Includes the back-of-envelope number ("~$X in Anthropic API,
     ~Y Claude-hours") with a "we don't actually know precisely, which
     is the point" caveat.
   - **Post 4 — "Three real adopters" (or honest "we don't have them
     yet")**. Either three named users or three pseudonymous case
     studies. If none yet, post is titled "Looking for our first three
     adopters" with concrete asks.
5. **Anthropic devrel surface.** Once `/blog` and `/ai-recipes` are
   live, the `claude-api` skill is the natural angle for an Anthropic
   developer-relations cross-post. Not blocking, but the asset exists to
   pitch with.

### v1.6 GTM bundle

1. **Public `/dashboard`.** Anonymized aggregate usage from
   `telemetry-ops`. Numbers: pipelines run, most-used skill, average
   shipped-feature cost, model-tier distribution. Refreshed daily. The
   credibility lever.
2. **Replays section** (closes `site.feature.replays-section` reserved
   flag). Two or three real pipeline runs with cost overlays — recorded
   as `.md` transcripts plus a `monitoring-ops` annotation layer.
3. **Blog cadence continues** — by v1.6 ship date there should be
   ~10–12 posts. The cadence itself becomes a credibility signal.

### v1.7 GTM bundle

1. **Marketplace launch post.** "From 24 skills to N." Promote three
   community-contributed skills on launch day.
2. **`/case-studies`** — needs to exist by now. Two or three named user
   builds even if pseudonymous.
3. **`/community` page.** Discord or GitHub Discussions hub.

### What we explicitly defer (and why)

- **Paid pilots / commercial motion.** Site continues to position as
  open-source, MIT, local-first. Adding a `/pricing` page or paid tier is
  out of scope through v2.0. If a paid motion emerges, it'll be the
  marketplace skill ratings + verified skill badges in v1.8+, not opchain
  itself.
- **YouTube / video content.** Cheap in theory, expensive in calendar
  time. Defer until `/blog` has a stable weekly cadence (8+ posts).
- **Conference talks.** Same reasoning — needs a track record of public
  artifacts first.

---

## Skill SKILL.md stubs — v1.5 new skills

These are the frontmatter + body outlines that will land in
`skills/<id>/SKILL.md` during the v1.5 sprint 1 scaffold PR. Full bodies
are written in sprints 2–4. Format follows the v1.3 pattern (see
`skills/release-ops/SKILL.md` and `skills/stack-forge/SKILL.md`).

### `skills/claude-api/SKILL.md`

```yaml
---
name: claude-api
displayName: Claude API
version: 1.5.0
shortDesc: Design, build, debug, and migrate Claude API integrations. Owns model selection, caching, batch, tool use, and version-migration playbooks.
phases: [build]
triAgent: false
tryable: true
commands:
  - /claude-api
  - /claude-api migrate
  - /claude-api cache-audit
  - /claude-api tool-use
  - /claude-api cost
description: >
  Build, debug, and optimize Claude API / Anthropic SDK apps. Apps built
  with this skill should include prompt caching by default. Also handles
  migrating existing Claude API code between Claude model versions
  (4.6 → 4.7, retired-model replacements). Use for /claude-api,
  "Anthropic SDK", "prompt caching", "cache hit rate", "tool use",
  "model migration", "extended thinking", "batch API", "files API",
  "memory", "citations". Trigger liberally on Claude API work.
governance:
  breaking_change_policy: skills/CHANGELOG.md
  last_reviewed: 2026-05-15
  owner: opchain
  docs:
    - { path: SKILL.md, kind: contract, lifecycle: stable }
    - { path: references/model-routing.md, kind: shared, lifecycle: stable }
    - { path: references/prompt-caching.md, kind: shared, lifecycle: stable }
    - { path: references/tool-use.md, kind: shared, lifecycle: stable }
    - { path: references/migration-playbooks.md, kind: shared, lifecycle: stable }
---
```

**Body outline:**

1. *How this skill fits the build pipeline* — auto-invoked by
   `app-architect` Phase 2 when the discovery interview says "AI app",
   "agent", "chatbot", or "Claude in the loop".
2. *Command reference* — `/claude-api`, `/claude-api migrate`,
   `/claude-api cache-audit`, `/claude-api tool-use`, `/claude-api cost`.
3. *Model routing decision tree* — Opus for spec / audit / migration,
   Sonnet for build / reverse-spec, Haiku for cheap repetitive phases.
4. *Prompt caching as default* — every reference snippet includes
   caching; cache-audit checks hit rate ≥ 60%.
5. *Tool use patterns* — schema-first design, ToolSearch deferred-load
   pattern, parallel tool calls.
6. *Migration playbooks* — 4.6 → 4.7, retired-model replacement, model-
   family upgrades; produces a diff PR.
7. *Cost guardrails* — input/output token ceilings per skill phase,
   `cost-ops` integration once v1.6 lands.
8. *Reference docs* — `model-routing.md`, `prompt-caching.md`,
   `tool-use.md`, `migration-playbooks.md`.
9. *PM-MCP integration* (per v1.3 protocol) — files migration tickets as
   sub-tickets of the parent migration request.

### `skills/rag-forge/SKILL.md`

```yaml
---
name: rag-forge
displayName: RAG Forge
version: 1.5.0
shortDesc: RAG design harness — vector DB selection, embedding choice, chunking strategy, retrieval eval. Treats RAG as a typed pipeline.
phases: [plan, build]
triAgent: true
tryable: true
commands:
  - /rag
  - /rag decide
  - /rag eval
  - /rag bench
description: >
  RAG design harness with Designer/Builder/Evaluator loop. Owns vector DB
  selection (pgvector, Turbopuffer, Pinecone, Supabase Vectors), embedding
  model choice (Voyage, OpenAI text-embedding-3, Cohere, BGE), chunking
  strategy, hybrid search, retrieval eval datasets, regression detection.
  Use for /rag, /rag decide, /rag eval, /rag bench, "semantic search",
  "embeddings", "vector db", "RAG pipeline", "retrieval", "chunking",
  "hybrid search". Auto-invoked by app-architect for AI-app projects.
  Trigger liberally on retrieval/RAG work.
governance:
  breaking_change_policy: skills/CHANGELOG.md
  last_reviewed: 2026-05-15
  owner: opchain
  docs:
    - { path: SKILL.md, kind: contract, lifecycle: stable }
    - { path: references/vector-db-decision.md, kind: shared, lifecycle: stable }
    - { path: references/embedding-models.md, kind: shared, lifecycle: stable }
    - { path: references/chunking-strategies.md, kind: shared, lifecycle: stable }
    - { path: references/retrieval-eval.md, kind: shared, lifecycle: stable }
---
```

**Body outline:**

1. *How this skill fits the build pipeline* — auto-invoked by
   `app-architect` Phase 2 when discovery says "search", "Q&A over
   docs", "knowledge base", "ground answers in", "RAG".
2. *Designer / Builder / Evaluator tri-agent loop* — same shape as
   `code-auditor` and `ux-engineer`.
3. *Vector DB decision tree* — pgvector (default for Postgres-already-
   present), Turbopuffer (serverless), Pinecone (enterprise),
   Supabase Vectors (Supabase-already-present), Turso (edge).
4. *Embedding model decision tree* — Voyage 3 (default for English/
   code), OpenAI text-embedding-3 (when OpenAI infra already in flight),
   Cohere multilingual, BGE for self-hosted.
5. *Chunking strategies* — semantic, fixed-window with overlap,
   hierarchical, propositions.
6. *Retrieval eval* — golden-set authoring, recall@k, NDCG, retrieval-
   distinct-from-generation eval.
7. *Hybrid search* — vector + BM25 (Postgres `tsvector`, Turbopuffer
   hybrid).
8. *Reference docs* — `vector-db-decision.md`, `embedding-models.md`,
   `chunking-strategies.md`, `retrieval-eval.md`.
9. *stack-forge pack collaboration* — emits vector-DB packs to the v1.4
   pack registry.

### `skills/agent-forge/SKILL.md`

```yaml
---
name: agent-forge
displayName: Agent Forge
version: 1.5.0
shortDesc: Build agents on the Claude Agent SDK — subagent topology, tool budgets, harness loops, eval harness.
phases: [plan, build]
triAgent: true
tryable: true
commands:
  - /agent
  - /agent decide
  - /agent scaffold
  - /agent eval
  - /agent loop
description: >
  Agent-building harness with Planner/Builder/Evaluator loop. Owns
  Claude Agent SDK app scaffold, subagent topology (single-agent vs
  multi-agent vs orchestrator-worker), tool budget design, harness loop
  shape (chat loop, autonomous loop, human-in-the-loop), eval harness for
  agent runs. Use for /agent, /agent decide, /agent scaffold, /agent
  eval, /agent loop, "build an agent", "Claude Agent SDK", "subagent",
  "tool design", "agent loop", "agent eval". Auto-invoked by app-architect
  for agent projects. Trigger liberally on agent-building.
governance:
  breaking_change_policy: skills/CHANGELOG.md
  last_reviewed: 2026-05-15
  owner: opchain
  docs:
    - { path: SKILL.md, kind: contract, lifecycle: stable }
    - { path: references/agent-topology.md, kind: shared, lifecycle: stable }
    - { path: references/tool-budgets.md, kind: shared, lifecycle: stable }
    - { path: references/harness-loops.md, kind: shared, lifecycle: stable }
    - { path: references/agent-eval.md, kind: shared, lifecycle: stable }
---
```

**Body outline:**

1. *How this skill fits the build pipeline* — auto-invoked by
   `app-architect` Phase 2 when discovery says "agent", "autonomous",
   "subagents", "tool use over long horizons".
2. *Planner / Builder / Evaluator tri-agent loop*.
3. *Agent topology decision tree* — single agent, multi-agent (peer),
   orchestrator-worker, hierarchical. Cites real Claude Agent SDK
   patterns.
4. *Tool budget design* — `bash`, `read`, `write`, `edit`, custom MCP
   tools; per-agent allowlists.
5. *Harness loop shapes* — chat loop (user-facing), autonomous loop
   (no user), human-in-the-loop (approval gates).
6. *Eval harness* — golden trajectories, success-rate-at-step,
   intervention rate.
7. *Reference docs* — `agent-topology.md`, `tool-budgets.md`,
   `harness-loops.md`, `agent-eval.md`.
8. *claude-api collaboration* — model routing comes from `claude-api`'s
   model-routing reference; agent-forge owns topology + harness shape.

### `skills/prompt-ops/SKILL.md`

```yaml
---
name: prompt-ops
displayName: Prompt Ops
version: 1.5.0
shortDesc: Version, eval, and regress-test prompts as first-class artifacts. Owns prompt versioning, eval datasets, drift detection.
phases: [build]
triAgent: false
tryable: true
commands:
  - /prompt
  - /prompt version
  - /prompt eval
  - /prompt diff
  - /prompt regress
description: >
  Prompt-as-code operator. Owns prompt versioning (file-shaped, diff-able,
  source-controlled), eval datasets (golden sets, A/B model comparison),
  regression detection (eval score trend, drift alerts). Use for /prompt,
  /prompt version, /prompt eval, /prompt diff, /prompt regress, "prompt
  versioning", "prompt eval", "eval harness", "prompt regression", "prompt
  diff", "golden set". Trigger liberally on prompt engineering work.
governance:
  breaking_change_policy: skills/CHANGELOG.md
  last_reviewed: 2026-05-15
  owner: opchain
  docs:
    - { path: SKILL.md, kind: contract, lifecycle: stable }
    - { path: references/prompt-versioning.md, kind: shared, lifecycle: stable }
    - { path: references/eval-datasets.md, kind: shared, lifecycle: stable }
    - { path: references/drift-detection.md, kind: shared, lifecycle: stable }
---
```

**Body outline:**

1. *How this skill fits the build pipeline* — runs alongside
   `claude-api`, `rag-forge`, and `agent-forge` during build; called
   explicitly when prompts change.
2. *Prompt-as-code convention* — prompts live in `prompts/<id>.md` with
   YAML frontmatter (`version:`, `model:`, `eval_set:`); diffs are
   semantic.
3. *Eval datasets* — golden-set authoring, eval rubrics (rule-based,
   model-graded), A/B between prompt versions or models.
4. *Drift detection* — eval score over time, alerts on regression
   threshold.
5. *Regression workflow* — `/prompt regress` runs the golden set on the
   PR-changed prompts, blocks the PR if eval drops.
6. *cost-ops collaboration* (v1.6) — each eval run reports cost; the
   regression check budgets against a ceiling.
7. *Reference docs* — `prompt-versioning.md`, `eval-datasets.md`,
   `drift-detection.md`.
8. *v1.5 dogfooding artifact* — opchain's own eval set ships with the
   v1.5 release as the demo Worker's regression suite.

---

## Verification — how to grade ideas before committing

Before any candidate becomes a sprint plan, run each through these gates:

1. **Constraint fit.** Stays Markdown-shaped, local-first, MIT, no
   backend? If not, kill or redesign.
2. **Dogfooding loop.** Does opchain itself use the skill within one
   release of shipping it? (v1.3 → `release-ops`; v1.5 → `claude-api`
   via the demo Worker; v1.6 → `cost-ops` on opchain's own pipeline.) If
   no dogfooding path exists, deprioritize.
3. **Skill-shaped vs site-shaped.** AI-native / cost / telemetry /
   instrumentation want to be skills. Newsletter / blog / dashboard /
   marketplace want to be site features. Don't conflate.
4. **Audience pull.** Can three real adopters be named in week one? If
   not, it's speculative.
5. **6-week scope.** Each themed release has to fit a 6-week cadence
   with lockstep version bumps. v1.5 with 4 new skills + 1 page +
   lockstep is at the upper edge.

**End-to-end sanity checks before locking a release plan:**

- `npm run checkpoint:status` — confirm prior release fully closed.
- `npm run gen-catalog` — confirm `governance:` frontmatter (v1.4 PR 8)
  is valid across all skills.
- `npm test` + `npm run prebuild` + `npm run build` — green before
  lockstep bump.
- Manual deploy to `staging.opchain.dev`, eyeball `/api/health` version
  stamp, then prod.

---

## Open questions

1. **Site surfacing for AI-native skills.** Does `/skills` get a new
   "AI-native" phase chip, or does it become a fifth top-level phase in
   `/architecture`? Lean: new chip in v1.5, evaluate top-level promotion
   in v1.6.
2. **`prompt-ops` cost integration order.** Ship `prompt-ops` with
   eval-only in v1.5, then add cost reporting in v1.6 once `cost-ops`
   exists? Or wait and ship `prompt-ops` complete in v1.6? Lean: ship
   eval-only in v1.5 (story needs all 4 AI-native skills together; cost
   reporting is additive).
3. **Newsletter provider.** Buttondown vs ConvertKit vs a self-hosted
   `notify` extension? Lean: Buttondown for v1.5 (cheap, Markdown-
   native, RSS-importable); evaluate self-hosting in v1.7 if list grows
   past free tier.
4. **`monorepo-ops` promotion to v1.6.** If v1.5 retro shows opchain's
   own monorepo pain blocking work, promote `monorepo-ops` into v1.6
   alongside `cost-ops` / `telemetry-ops` and drop one of those to v1.7.
   Decide post-v1.5 ship.

---

## Decision

Adopt v1.5 = AI-native, v1.6 = instrumentation, v1.7 = (lean) marketplace.
Land roadmap doc + sprint plan + Linear tickets on
`claude/plan-future-releases-SQeO8`. Start the GTM bundle (newsletter
flag, `/blog`, `/for-agencies`) inside v1.5 sprint 4 alongside skill
work — these are cheap and unblock the distribution arc that has been
stalled since v1.0.

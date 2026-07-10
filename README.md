# opchain

> skills that ship.

opchain is an open-source Claude skill ecosystem for developers —
a tightly-integrated set of `.skill` files covering the full
development pipeline: discover, spec, design, build, audit, deploy,
and scale.

Install a skill. Trigger it by name. Pick up where you left off.

---

## what's a skill?

A skill is a self-contained instruction set that extends Claude's
behavior for a specific phase of development. Each skill:

- Owns one phase of the pipeline
- Reads upstream checkpoints from other skills
- Writes its own checkpoint so work persists across sessions
- Triggers via slash command or natural language

No API keys. No build step. Drop a `.skill` file into Claude's
settings and go.

---

## the pipeline

> discover → spec → design → build → audit → ship → scale

Each phase is owned by a dedicated skill. Skills share state
through a JSON checkpoint protocol — context flows forward
without manual handoffs.

| phase | skill | trigger | what it does |
|---|---|---|---|
| discover | `oc-app-architect` | `/oc-discover` | Requirements interview → user stories, constraints, acceptance criteria |
| spec | `oc-app-architect` + `oc-stack-forge` | `/oc-spec` | API contract, data model, stack decision with rationale |
| design | `oc-ux-engineer` | `/oc-uxe plan` | Formal design spec, component tree, style tokens |
| build | `oc-app-architect` | `/oc-build` | Generator → Evaluator loop. Score ≥ 7/10 to advance. |
| audit | `oc-code-auditor` | `/oc-audit full` | 5-layer sweep: security, performance, correctness, UX, config |
| ship | `oc-deploy-ops` + `oc-git-ops` | `/oc-deploy staging` | Audit gate, staging, smoke tests, production with rollback |
| scale | `oc-scale-ops` | `/oc-scale audit` | Load tests, perf budgets, caching, capacity planning |

---

## skill library

### foundation

| skill | trigger | what it does |
|---|---|---|
| `oc-checkpoint-protocol` | — | JSON session persistence across skills and conversations |
| `oc-orchestrator` | `/oc-ops` | Pipeline coordinator — multi-project registry, status, routing |

### plan

| skill | trigger | what it does |
|---|---|---|
| `oc-stack-forge` | `/oc-stack-decide` | Stack advisor for CF, Vercel, AWS, Supabase, Rails, Django, Go, Rust |
| `oc-reverse-spec` | `/oc-rev-full` | Reverse-engineer existing code into structured spec docs |
| `oc-api-dev` | `/oc-api design` | First-party API design — OpenAPI, versioning, SDK generation, schema drift |
| `oc-migration-ops` | `/oc-migrate` | Plan + execute framework/DB/auth/platform migrations with rollback points |
| `oc-modularize-ops` | `/oc-modularize` | Decompose a live monolith with golden-fixture proof of zero data/functionality loss |
| `oc-dash-forge` | `/oc-dash-forge` | Dashboard and dense-data UI design spec + working React prototype |
| `oc-docs-forge` | `/oc-docs pr` | PR docs, README/catalog upkeep, changelog and ADR generation |

### plan + build

| skill | trigger | what it does |
|---|---|---|
| `oc-app-architect` | `/oc-discover` `/oc-spec` `/oc-build` `/oc-launch` | Unified pipeline: discover → spec → design → sprint → build → launch |

### build

| skill | trigger | what it does |
|---|---|---|
| `oc-ux-engineer` | `/oc-uxe plan` `/oc-uxe build` `/oc-uxe eval` | Design Planner → Generator → Evaluator tri-agent harness |
| `oc-integrations-engineer` | `/oc-integrate plan` | Planner → Builder → Tester. Hits real API sandboxes, not mocks. |
| `oc-bug-check` | `/oc-bugcheck` | Pre-commit QA gate — type/lint/test/anti-pattern/secret checks on every commit |
| `oc-agent-forge` | `/oc-agent` | Claude Agent SDK build harness — subagent topology, tool budgets, harness loops |
| `oc-claude-api` | `/oc-claude-api` | Build, debug, and migrate Claude API apps — caching, tool use, model routing |
| `oc-prompt-ops` | `/oc-prompt` | Prompt-as-code — versioning, eval datasets, regression and drift detection |
| `oc-rag-forge` | `/oc-rag` | RAG system design — vector DB choice, embeddings, chunking, retrieval eval |
| `oc-signal-forge` | `/oc-signal` | Derive and instrument a new analytics metric, prove it answers the question |
| `oc-cost-ops` | `/oc-cost` | LLM cost attribution per skill phase, budget gates, model-tier routing |
| `oc-fleet-ops` | `/oc-fleet` | Provision and operate multi-container fleets on self-managed infra |
| `oc-monitoring-ops` | `/oc-monitor` | Post-deploy observability — uptime, error tracking, alerting, incident runbooks |
| `oc-release-ops` | `/oc-release` | Plan, draft, bump, announce, and ship versioned releases |
| `oc-repo-ops` | `/oc-repo audit` | Repository hygiene and PR-readiness gate |
| `oc-telemetry-ops` | `/oc-telemetry` | Opt-in, local-first usage metering feeding the public `/dashboard` |

### quality

| skill | trigger | what it does |
|---|---|---|
| `oc-code-auditor` | `/oc-audit full` | Auditor → Fixer → Verifier. 5-layer sweep, pre-deploy gate. |
| `oc-scale-ops` | `/oc-scale audit` | Load testing, perf budgets, caching strategy, capacity planning |
| `oc-security-auditor` | `/oc-security` | Threat modeling (STRIDE), OWASP compliance, attack-surface review |

### ship

| skill | trigger | what it does |
|---|---|---|
| `oc-deploy-ops` | `/oc-deploy staging` | Audit gate → staging → smoke tests → production → auto-rollback |
| `oc-git-ops` | `/oc-git-commit` `/git-pr` | Conventional commits, sprint-scoped branches, checkpoint-enriched PRs |

---

## install

### Claude.ai / Claude Desktop

1. Download any `.skill` file from [`/skills`](./skills)
2. Open Claude → Settings → Customize → Skills
3. Upload the `.skill` file
4. Start a new conversation and trigger it

### Claude Code CLI

```bash
mkdir -p .claude/skills
cp ~/opchain/skills/*.md .claude/skills/
claude
> /oc-discover
```

### Team (check into git)

```bash
git add .claude/skills/
git commit -m "chore: add opchain skills"
git push
```

---

## the checkpoint protocol

Every skill writes a JSON checkpoint to `.checkpoints/` in your
project. Skills read each other's checkpoints to make informed
decisions:

- `oc-deploy-ops` reads `oc-code-auditor` — CRITICAL findings block deploy
- Build evaluator reads `oc-ux-engineer` — grades frontend against approved spec
- `oc-git-ops` reads `oc-app-architect` — names branches by sprint

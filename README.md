# opchain

> skills that ship.

opchain is an open-source Claude skill ecosystem for developers —
a tightly-integrated set of Claude Code skills (`SKILL.md` files)
covering the full development pipeline: discover, spec, design,
build, audit, deploy, and scale.

Install a skill. Trigger it by name. Pick up where you left off.

---

## what's a skill?

A skill is a self-contained instruction set that extends Claude's
behavior for a specific phase of development. Each skill:

- Owns one phase of the pipeline
- Reads upstream checkpoints from other skills
- Writes its own checkpoint so work persists across sessions
- Triggers via slash command or natural language

No API keys. No build step. Unzip the skill bundle into Claude's
skills folder and go.

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

29 skills across 6 phases. Canonical list lives in
[`skills/README.md`](./skills/README.md) — this table mirrors it.

### foundation

| skill | role |
|---|---|
| `oc-checkpoint-protocol` | Session persistence (bundled in all skills) |
| `oc-orchestrator` | `/oc-ops` — multi-project registry, status, routing |

### plan

| skill | role |
|---|---|
| `oc-reverse-spec` | Code → spec docs |
| `oc-stack-forge` | Universal stack advisor |
| `oc-dash-forge` | Dashboards + dense data UI (spec + React prototype) |
| `oc-scale-ops` | Scaling readiness |

### plan + build

| skill | role |
|---|---|
| `oc-app-architect` | Unified planning + build harness |
| `oc-ux-engineer` | Tri-design harness |
| `oc-docs-forge` | Documentation generator for every PR: PR body/comments, README/catalog docs, changelog, ADR upkeep |
| `oc-integrations-engineer` | API integration harness (third-party APIs you consume) |
| `oc-api-dev` | First-party API design + build harness (OpenAPI, versioning, SDKs) |
| `oc-migration-ops` | `/oc-migrate` — DB / framework / auth / platform migrations |
| `oc-modularize-ops` | Live-monolith decomposition with golden-fixture equivalence proof |

### build + ai-native

| skill | role |
|---|---|
| `oc-agent-forge` | Claude Agent SDK apps: topology, tool budgets, harness loops, agent eval |
| `oc-claude-api` | Claude API apps: model routing, prompt caching, tool use, migration playbooks |
| `oc-prompt-ops` | Prompt-as-code: versioning, eval datasets, regression and drift detection |
| `oc-rag-forge` | RAG systems: vector DB choice, embeddings, chunking, hybrid search, retrieval eval |

### build

| skill | role |
|---|---|
| `oc-code-auditor` | Auditor → Fixer → Verifier. 5-layer sweep, pre-deploy gate |
| `oc-bug-check` | Pre-commit QA gate: type, lint, tests, secrets, build, deps, anti-patterns |
| `oc-security-auditor` | Threat modeling, OWASP hardening, attack-surface review |
| `oc-repo-ops` | Repository hygiene and PR readiness gate |
| `oc-cost-ops` | LLM cost attribution, budget gates, model-tier routing recommendations |
| `oc-telemetry-ops` | Opt-in local usage metering and anonymized aggregate dashboard feed |
| `oc-signal-forge` | Product-analytics signal builder: question to trustworthy metric |
| `oc-fleet-ops` | Self-managed fleet deployment and multi-container operations |

### ship

| skill | role |
|---|---|
| `oc-git-ops` | Conventional commits, sprint-scoped branches, checkpoint-enriched PRs |
| `oc-release-ops` | Release cadence: plan, draft, bump, announce, ship |
| `oc-deploy-ops` | Audit gate → staging → smoke tests → production → auto-rollback |
| `oc-monitoring-ops` | Post-deploy observability — uptime, errors, alerts, incidents |

---

## install

### Claude.ai / Cowork

1. Go to Settings → Customize → Skills
2. Upload each `.zip` file (from a release, or built locally with
   `npm run make-zip` — see [`skills/README.md`](./skills/README.md))
3. Delete any existing tri-dev skill (merged into `oc-app-architect`)

### Claude Code CLI

```bash
mkdir -p .claude/skills
# unzip each skill's .zip into .claude/skills/, e.g.:
unzip oc-app-architect.zip -d .claude/skills/oc-app-architect
claude
> /oc-discover
```

### Codex / any MCP agent

Codex Agent Skills use the same `SKILL.md` format, so either unzip into
`.codex/skills/` the same way, or point an MCP client at the hosted server:

```toml
[mcp_servers.opchain]
url = "https://opchain.dev/mcp"
```

### Team (check into git)

```bash
git add .claude/skills/
git commit -m "chore: add opchain skills"
git push
```

Full walkthrough: https://opchain.dev/install — full skill list and
install details: [`skills/README.md`](./skills/README.md).

---

## the checkpoint protocol

Every skill writes a JSON checkpoint to `.checkpoints/` in your
project. Skills read each other's checkpoints to make informed
decisions:

- `oc-deploy-ops` reads `oc-code-auditor` — CRITICAL findings block deploy
- Build evaluator reads `oc-ux-engineer` — grades frontend against approved spec
- `oc-git-ops` reads `oc-app-architect` — names branches by sprint

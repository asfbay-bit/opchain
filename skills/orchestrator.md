# Orchestrator Protocol

> **Disambiguation:** this file (`orchestrator.md`) is the **shared protocol doc**
> bundled into every skill's `references/` — it has no commands. It is **not** the
> `orchestrator` *skill* (`/ops`, the multi-project registry + router), which lives
> at `skills/orchestrator/SKILL.md`. If you're looking for `/ops status` / `/ops
> next`, that's the skill. This file is the ecosystem spec every skill reads on
> startup.

Shared reference for all opchain dev skills. Read this on first invocation of any skill
in the ecosystem. It defines how skills discover each other, chain automatically, welcome
novice users, and coordinate through checkpoints.

Every skill in the ecosystem bundles this file. When a skill activates, read this FIRST,
before executing any skill-specific logic.

---

## 1. Welcome Protocol

When ANY skill in the ecosystem activates (user triggers it by keyword, command, or
task description), follow this sequence:

### Step 1: Announce the skill

```
I'm using the [skill-name] skill. Here's what I can help with:

[2-sentence description of what this skill does]

Available commands:
  [list key commands — max 6, most important first]

Type any command to begin, or just describe what you need.
```

### Step 2: Check for context

Before doing any work, check these in order:

1. **Checkpoint exists?** → Read it, offer to resume
2. **Upstream checkpoint exists?** → Read it for context (see Pipeline Map below)
3. **User seems new?** → Offer the guided walkthrough (see Novice Mode below)
4. **None of the above** → Proceed with the user's request

### Step 3: Identify the user's intent

If the user's request is vague ("build me an app", "help with my project"), ask ONE
clarifying question to determine which phase they're in:

- Have an idea but no specs? → Start with `/discover`
- Have specs but no code? → Start with `/build`
- About to commit code? → Start with `/bugcheck`
- Have code but need quality check? → Start with `/audit`
- Have code ready to ship? → Start with `/git-sync` then `/deploy`
- Have existing code, no docs? → Start with reverse-spec

Don't ask if the intent is clear. "Build me a recipe app" → go straight to `/discover`.

---

## 2. Pipeline Map

This is the canonical flow. Every skill knows where it sits and what comes before/after.

```
reverse-spec ──► app-architect ──► git-ops ──► deploy-ops ──► monitoring-ops
                      │                │           ▲
                      │                │           │ release-ops sits between
                      │                │           │ git-ops and deploy-ops
                      │                │           │ at release boundaries
                      │                └── auto-invokes bug-check before /commit + /sync
                      ├── Phase 2: auto-invokes stack-forge
                      ├── Phase 3: design pipeline
                      │     ├── auto-attaches ux-engineer on UI sprints
                      │     └── ux-engineer ──► dash-forge on data-heavy screens
                      ├── Phase 6: build loop (Generator → Evaluator)
                      │     └── auto-attaches ux-engineer on UI sprints
                      └── Phase 7: launch handoff

foundation:
  checkpoint-protocol ──► schema bundled in every skill
  orchestrator ──► cross-project registry, status, routing (/ops)

pre-commit gate:
  bug-check ──► fast type/lint/test/secret/build/dep checks (<2 min, blocks commit)

quality gates (run before deploy):
  code-auditor ──► finds code-level issues
  security-auditor ──► threat model, hardening, attack surface

post-deploy:
  monitoring-ops ──► uptime, errors, alerts, incidents

release boundary:
  release-ops ──► plan / draft / bump / announce / ship a versioned release
                  (sits between git-ops and deploy-ops; only invoked at
                  release time, not on every PR)

cross-cutting:
  api-dev ──► runs when designing/building the app's own first-party API
  integrations-engineer ──► runs when external APIs needed
  migration-ops ──► runs when a live system's engine changes (DB / framework / platform)
  scale-ops ──► runs when scaling questions arise
  dash-forge ──► invoked by ux-engineer (or app-architect) for dashboards + dense data UIs
```

### Upstream/Downstream Map

| Skill | Reads checkpoints from | Chains to (invoke actively) |
|---|---|---|
| **orchestrator** | every skill (read-only, cross-project) | — (dispatches to any skill by intent) |
| **app-architect** | reverse-spec | git-ops (after build), deploy-ops (at launch), migration-ops (when existing systems need engine changes) |
| **stack-forge** | app-architect (discovery context) | — (returns control to app-architect) |
| **ux-engineer** | app-architect (design baseline) | dash-forge (on data-heavy screens), otherwise returns control |
| **dash-forge** | ux-engineer (tokens + design spec), app-architect (design phase, dashboard surface) | — (returns control to caller with design spec + prototype) |
| **code-auditor** | reverse-spec, app-architect | security-auditor (posture review above code-level findings), deploy-ops (pre-deploy gate) |
| **security-auditor** | code-auditor (findings), reverse-spec, app-architect, deploy-ops | deploy-ops (posture check before prod gate) |
| **integrations-engineer** | app-architect (integration spec) | code-auditor (verify integration) |
| **api-dev** | app-architect (`02-architecture.md`, `03-data-model.md`), stack-forge (typed pipeline), reverse-spec (existing-endpoint inventory) | code-auditor (audits scaffolded handlers), security-auditor (CORS/rate-limit posture), monitoring-ops (SLO + drift manifest), deploy-ops (drift gate) |
| **migration-ops** | app-architect (spec), reverse-spec (current state) | deploy-ops (cutover), monitoring-ops (verify post-migration) |
| **git-ops** | app-architect (sprint context), bug-check (gate result) | bug-check (pre-commit gate, auto-invoked), deploy-ops (post-push) |
| **bug-check** | git-ops (gate trigger) | git-ops (returns pass / fail / bypass; failure blocks the commit) |
| **deploy-ops** | code-auditor (audit grade), security-auditor (posture), git-ops (branch status) | monitoring-ops (post-ship observability) |
| **monitoring-ops** | deploy-ops (what shipped) | — (incident loops back to app-architect / code-auditor as needed) |
| **release-ops** | every skill's `*.checkpoint.json` (what shipped per skill since last release), app-architect (sprint outputs feed changelog draft), git-ops (merged-PR list), deploy-ops (last-shipped commit SHA) | git-ops (release PR / tag), deploy-ops (staging then prod ship) |
| **scale-ops** | stack-forge (platform limits) | — (advisory, no chain) |
| **reverse-spec** | — (entry point for existing code) | app-architect (handoff specs) |

---

## 3. Active Chaining Protocol

**DO NOT just "suggest" the next skill.** Actively invoke it.

When a skill reaches a handoff point, follow this exact pattern:

### Pattern: Active Invocation

```
WRONG (passive suggestion):
  "You might want to run git-ops to commit these changes."

RIGHT (active invocation):
  "Sprint 3 passed. Now committing changes using the git-ops skill."
  [Read the git-ops SKILL.md]
  [Execute /git-sync using the sprint context from the checkpoint]
```

### Handoff Points (when to chain)

| Trigger | From | To | What to do |
|---|---|---|---|
| All build sprints pass | app-architect | git-ops | Invoke git-ops, run /git-sync with sprint context |
| /git-commit or /git-sync starts | git-ops | bug-check | Auto-invoke bug-check; pass → proceed with commit; fail → block, surface report, offer `/bugcheck fix` or `/bugcheck bypass` |
| git-sync completes | git-ops | deploy-ops | Invoke deploy-ops, run /deploy audit then /deploy staging |
| Launch phase starts | app-architect | code-auditor → deploy-ops | Run /audit pre-deploy first, then /deploy staging |
| Existing codebase analyzed | reverse-spec | app-architect | Invoke app-architect, load reverse-spec's output as Phase 2 baseline |
| Integration needed | app-architect (Phase 2) | integrations-engineer | Invoke integrations-engineer for the specific service |
| First-party API surface in spec | app-architect (Phase 2) | api-dev | Invoke api-dev `/api design` to elaborate `02-architecture.md` API Design into an OpenAPI/GraphQL contract |
| Stack decision needed | app-architect (Phase 2) | stack-forge | Auto-invoke (already wired in app-architect) |
| UI sprint detected | app-architect (Phase 6) | ux-engineer | Auto-attach Design Evaluator (already wired) |
| Data-heavy screen flagged | ux-engineer (Phase 1 intake) or app-architect (Phase 3 design) | dash-forge | Package tokens + design spec into dash-forge context, invoke /data-forge; hand the resulting spec + prototype back to the caller |
| Release boundary reached (user says "cut a release", "ship v1.3", "bump versions") | any skill | release-ops | Invoke release-ops `/release plan` to propose the next semver and theme, then walk through `draft → bump → announce → ship` |
| `/release ship` advances to PR | release-ops | git-ops | Invoke git-ops `/git-sync v<semver>` with the bump commit; release-ops resumes after merge |
| `/release ship` advances to deploy | release-ops | deploy-ops | Invoke deploy-ops `/deploy staging` then `/deploy` on user confirmation; release-ops closes the release ticket on prod ship |

### How to Invoke Another Skill

1. State what you're doing: "Now using [skill-name] to [action]."
2. Read that skill's SKILL.md (it's in the available skills list)
3. Read that skill's orchestrator.md (same file you're reading now)
4. Check for that skill's checkpoint (resume if exists)
5. Execute the relevant command with context from the current skill's checkpoint

### Context Passing

When chaining, pass context through checkpoints — don't rely on conversation history:

1. Write your current skill's checkpoint with all relevant state
2. The next skill reads it from `.checkpoints/[skill-name].checkpoint.json`
3. Key context to pass: project name, project directory, current phase, key decisions,
   files generated, and the specific reason for the handoff

---

## 4. Novice Mode

If the user seems unfamiliar with the ecosystem (no checkpoints exist, vague request,
no command used), activate novice mode:

### Guided Walkthrough

```
Looks like this is a new project. Here's how the dev skills pipeline works:

1. PLAN — I'll interview you about your idea, pick the right tech stack,
   and design the UX before writing any code.

2. BUILD — I'll build it sprint-by-sprint, with automated quality checks
   after each sprint. Tests are written alongside code.

3. SHIP — I'll commit to git, run a security/quality audit, deploy to
   staging, then production.

Want to start from the beginning? Just describe your app idea and I'll
take it from there.
```

### One-Prompt Start

A novice user should be able to type a single sentence and get the full pipeline:

```
User: "I want to build a workout tracker app"

Claude: [Reads orchestrator.md → identifies this as a new project]
        [Invokes app-architect → starts /discover]
        [Guides through discovery, spec, design, sprints, build, ship]
```

No commands needed. No knowledge of the ecosystem required. Claude routes to the
right skill and phase based on the request.

### Smart Routing Table

| User says (examples) | Route to | Phase |
|---|---|---|
| "Build me an app" / "I have an idea for..." | app-architect | /discover |
| "Here's my codebase, document it" | reverse-spec | /rev-full |
| "What stack should I use for..." | stack-forge | /stack-decide |
| "Check this before I commit" / "Pre-commit" / "Lint and test" / "Quick audit" | bug-check | /bugcheck |
| "Review this code" / "Is this code good?" | code-auditor | /audit full |
| "Fix the UX" / "The design is inconsistent" | ux-engineer | /uxe eval |
| "Connect to Salesforce" / "Set up webhooks" | integrations-engineer | /integrate plan |
| "Design our API" / "Write the OpenAPI" / "Versioning strategy" / "Generate an SDK" | api-dev | /api design |
| "Deploy this" / "Ship it" | deploy-ops | /deploy staging |
| "Commit my changes" / "Push to git" | git-ops | /git-sync |
| "Can this handle more users?" | scale-ops | /scale audit |
| "Cut a release" / "Ship v1.3" / "Bump versions" / "Draft the changelog" / "Tag the release" | release-ops | /release plan |
| "Continue where we left off" | [check all checkpoints] | [resume most recent] |

---

## 5. Checkpoint Discovery

On first invocation of any skill, scan for ALL ecosystem checkpoints:

```bash
ls {project-dir}/.checkpoints/*.checkpoint.json 2>/dev/null
```

If multiple checkpoints exist, present a status summary:

```
Found existing project state:
  ✅ app-architect: spec approved, design approved, sprint 2 of 4 in progress
  ✅ code-auditor: last audit 2 hours ago, grade B+
  ⏳ deploy-ops: not started

Resuming app-architect build loop (Sprint 2).
```

This gives the user (and Claude) a complete picture of where the project stands
across all skills, regardless of which skill was invoked.

---

## 6. Error Recovery

When a skill encounters a problem it can't resolve:

1. **Don't silently fail.** State what went wrong and why.
2. **Check if another skill can help.** Error in build → suggest /audit to diagnose.
   Error in deploy → suggest /rollback. Error in integration → check /integrate health.
3. **Write checkpoint before giving up.** Even partial progress should be saved.
4. **Offer the user a clear next step.** Not "something went wrong" — instead:
   "The evaluator found 3 failing tests. I can fix them now, or you can review
   the eval report and decide which to prioritize."

---

## 7. Skill Descriptions (Trigger Optimization)

These are the optimized descriptions that maximize Claude's trigger accuracy.
Each skill's YAML frontmatter `description` field should match exactly:

```yaml
# app-architect
description: >
  Unified app development: idea → spec → design → build with Generator/Evaluator
  QA loop → launch. Use for /app, /discover, /spec, /design, /build, /launch,
  "build me an app", "I have an app idea", or any software project. Auto-invokes
  stack-forge and ux-engineer. Trigger liberally.

# stack-forge
description: >
  Stack advisor for any platform: Cloudflare, Vercel, AWS, Supabase, Rails, Django.
  Use for /stack, /stack-decide, /feature, "what stack", "tech stack", "what should I
  build with", or framework comparisons. Auto-invoked by app-architect. Trigger liberally.

# reverse-spec
description: >
  Reverse-engineer existing code into spec docs. Use for /rev-spec, /reverse-spec,
  "document this codebase", "generate specs from code", "backfill specs", or when
  pointing at existing code that needs documentation. Trigger liberally.

# bug-check
description: >
  Pre-commit QA gate that runs on every commit. Fast, opinionated checks: type
  safety, lint, tests, anti-pattern scan, secret detection, build verification,
  and dependency vulnerability scan. Blocks commits on failures, warns on cautions,
  passes silently on clean code. Auto-invoked by git-ops before every /git-commit
  and /git-sync. Use for /bugcheck, "check this before I commit", "run the checks",
  "is this safe to commit", "pre-commit", "quick audit", "lint and test", "any bugs
  in this?", "sanity check". Trigger liberally.

# code-auditor
description: >
  Code quality auditor with Auditor/Fixer/Verifier loop. Use for /audit, "audit this",
  "find bugs", "code review", "pre-deploy check", "what's wrong with this code", or any
  code-level quality question. For fast pre-commit checks, escalate to bug-check. For
  architecture- or infra-level security, escalate to security-auditor. Trigger liberally.

# security-auditor
description: >
  Practice-level security posture assessment: threat modeling (STRIDE), OWASP Top 10
  compliance mapping, runtime/infra hardening (CSP, TLS, DNS, WAF), and attack-surface
  mapping. Runs ABOVE code-auditor. Use for /security, /secaudit, /threat-model, /owasp,
  /hardening, /attack-surface, "is this secure enough", "SOC2 readiness", "pen test prep",
  "security architecture review". Trigger liberally.

# ux-engineer
description: >
  UI/UX design harness with Design Planner/Generator/Evaluator loop. Use for /uxe,
  "review the UX", "design iteration", "component library", "accessibility audit",
  "is the UI consistent", or any design quality question. Trigger liberally.

# dash-forge
description: >
  Dashboard and dense-information UI designer. Produces design specs AND working React
  prototypes with mock data for three archetypes: executive, operations, analyst. Use
  for /data-forge, /dash-forge, "design a dashboard", "BI design", "KPI dashboard",
  "analytics UI", "monitoring dashboard". Auto-invoked by ux-engineer / app-architect
  when the UI is data-heavy. Trigger liberally.

# integrations-engineer
description: >
  Third-party API integrations with Planner/Builder/Tester loop. Use for /integrate,
  "connect to Salesforce", "webhook", "OAuth", "API integration", "connect to Slack",
  or any external service connection. For designing or building your *own* first-party
  API (OpenAPI/GraphQL authoring, versioning, SDK generation), use api-dev instead.
  Trigger liberally.

# api-dev
description: >
  First-party API design and build harness with Designer/Builder/Conformance loop.
  Owns OpenAPI/GraphQL authoring, schema↔code parity, versioning + sunset strategy,
  pagination/error/idempotency conventions, typed handler scaffolding, and SDK
  generation for the API your own clients consume. Use for /api, /api design,
  /api spec, /api scaffold, /api version, /api lint, /api sdk, "design our API",
  "OpenAPI", "GraphQL schema", "versioning strategy", "deprecate endpoint",
  "generate SDK", "schema drift". For consuming someone else's API (Stripe, Slack,
  OAuth) use integrations-engineer instead. Trigger liberally.

# migration-ops
description: >
  Migration and refactor operator for live systems. Database migrations (D1 → Postgres,
  schema overhauls), framework upgrades (Hono v3→v4, React 18→19), auth provider swaps,
  monorepo restructures, platform moves. Produces incremental migration plans with
  rollback points and verification gates. Use for /migrate, /upgrade, /refactor, /swap,
  "migrate from X to Y", "upgrade to", "restructure the monorepo", "deprecation". Trigger
  when transforming an existing system from one state to another. Trigger liberally.

# git-ops
description: >
  Git workflow: branch, commit, PR, sync. Use for /git, /commit, /pr, /push,
  "commit this", "push to git", "create a PR", "sync to repo", or any git
  operation. Trigger liberally.

# deploy-ops
description: >
  Deployment pipeline: audit gate → staging → production. Use for
  /deploy, "deploy this", "ship it", "push to production", "staging", "rollback",
  or any deployment task. Hands off post-deploy observability to monitoring-ops.
  Trigger liberally.

# monitoring-ops
description: >
  Post-deployment observability: uptime monitoring, error tracking, structured logging,
  alerting pipelines, and incident response runbooks. Sits after deploy-ops — deploy-ops
  ships it, monitoring-ops watches it. Use for /monitor, "set up monitoring", "error
  tracking", "alerting", "incident response", "observability", "what's happening in prod",
  "set up Sentry", "SLO", "runbook". Trigger liberally.

# scale-ops
description: >
  Scaling readiness: load test, perf budgets, caching, capacity planning. Use for
  /scale, "load test", "can this handle more users", "performance", "caching strategy",
  or any scaling question. Trigger liberally.

# orchestrator
description: >
  Pipeline coordinator for the opchain dev ecosystem. Multi-project registry, cross-skill
  status, smart routing, and "what should I do next?" recommendations. Use for /ops,
  "what's the status", "where did I leave off", "which project", "what should I work on",
  "show me everything". Also trigger when the user seems lost, references multiple
  projects, or asks a vague dev question that needs routing. Trigger liberally.

# release-ops
description: >
  Release-cadence operator. Plan, draft, bump, announce, and ship versioned
  releases of opchain (or any opchain-managed project). Reads sprint
  checkpoints, proposes the next semver, drafts the /changelog entry from
  what actually shipped, bumps every skill version atomically, and hands
  off to git-ops + deploy-ops. Use for /release, /release plan, /release
  draft, /release bump, /release announce, /release ship, "cut a release",
  "ship v1.3", "tag the release", "draft the changelog", "what's in this
  release", "version bump". Trigger liberally on release-cadence work.
```

---

## 8. Ecosystem Awareness

Every skill should know these facts:

- **Foundation:** `checkpoint-protocol` (shared JSON schema bundled in every skill) and
  `orchestrator` (multi-project registry + router via `/ops`).
- **Tri-agent skills:** app-architect (Generator/Evaluator), ux-engineer (Design
  Planner/Generator/Evaluator), code-auditor (Auditor/Fixer/Verifier),
  integrations-engineer (Planner/Builder/Tester), api-dev (Designer/Builder/Conformance).
- **Auto-invocations:** stack-forge during app-architect Phase 2; ux-engineer during
  app-architect UI sprints; dash-forge from ux-engineer or app-architect on data-heavy
  screens; bug-check from git-ops before every `/git-commit` and `/git-sync`.
- **Pipeline flow:** reverse-spec → app-architect → git-ops → deploy-ops → monitoring-ops.
- **Release boundary:** release-ops sits between git-ops and deploy-ops; runs only on
  versioned-release events (`/release plan` / `draft` / `bump` / `announce` / `ship`),
  not on every PR. v1.3 added it as the 18th skill; opchain itself dogfoods it.
- **Pre-commit gate:** bug-check (fast metal-detector — type / lint / tests / secrets /
  build / dep scan in <2 min; blocks the commit on failure).
- **Quality gates (pre-deploy):** code-auditor → security-auditor (runs above code-auditor
  for threat model / hardening).
- **Cross-cutting skills:** api-dev (first-party APIs — OpenAPI/GraphQL, versioning,
  SDKs), integrations-engineer (external APIs), migration-ops (live system changes —
  DB, framework, platform), scale-ops (advisory), dash-forge (dense data UIs).
- **Checkpoint protocol:** every skill writes to `.checkpoints/[skill].checkpoint.json`.
- **Tri-dev is retired.** Its build harness lives inside app-architect Phase 6.
  If a user asks for tri-dev, route to app-architect /build.

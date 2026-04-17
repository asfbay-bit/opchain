# Orchestrator Protocol

Shared reference for all aidops dev skills. Read this on first invocation of any skill
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
- Have code but need quality check? → Start with `/audit`
- Have code ready to ship? → Start with `/git-sync` then `/deploy`
- Have existing code, no docs? → Start with reverse-spec

Don't ask if the intent is clear. "Build me a recipe app" → go straight to `/discover`.

---

## 2. Pipeline Map

This is the canonical flow. Every skill knows where it sits and what comes before/after.

```
reverse-spec ──► app-architect ──► git-ops ──► deploy-ops
                      │
                      ├── Phase 2: auto-invokes stack-forge
                      ├── Phase 3: design pipeline
                      │     ├── auto-attaches ux-engineer on UI sprints
                      │     └── ux-engineer ──► dash-forge on data-heavy screens
                      ├── Phase 6: build loop (Generator → Evaluator)
                      │     └── auto-attaches ux-engineer on UI sprints
                      └── Phase 7: launch handoff

code-auditor ──► runs at any stage, required before deploy
integrations-engineer ──► runs when external APIs needed
scale-ops ──► runs when scaling questions arise
dash-forge ──► invoked by ux-engineer (or app-architect) for dashboards + dense data UIs
```

### Upstream/Downstream Map

| Skill | Reads checkpoints from | Chains to (invoke actively) |
|---|---|---|
| **app-architect** | reverse-spec | git-ops (after build), deploy-ops (at launch) |
| **stack-forge** | app-architect (discovery context) | — (returns control to app-architect) |
| **ux-engineer** | app-architect (design baseline) | dash-forge (on data-heavy screens), otherwise returns control |
| **dash-forge** | ux-engineer (tokens + design spec), app-architect (design phase, dashboard surface) | — (returns control to caller with design spec + prototype) |
| **code-auditor** | reverse-spec, app-architect | deploy-ops (pre-deploy gate) |
| **integrations-engineer** | app-architect (integration spec) | code-auditor (verify integration) |
| **git-ops** | app-architect (sprint context) | deploy-ops (post-push) |
| **deploy-ops** | code-auditor (audit grade), git-ops (branch status) | — (end of pipeline) |
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
| git-sync completes | git-ops | deploy-ops | Invoke deploy-ops, run /deploy audit then /deploy staging |
| Launch phase starts | app-architect | code-auditor → deploy-ops | Run /audit pre-deploy first, then /deploy staging |
| Existing codebase analyzed | reverse-spec | app-architect | Invoke app-architect, load reverse-spec's output as Phase 2 baseline |
| Integration needed | app-architect (Phase 2) | integrations-engineer | Invoke integrations-engineer for the specific service |
| Stack decision needed | app-architect (Phase 2) | stack-forge | Auto-invoke (already wired in app-architect) |
| UI sprint detected | app-architect (Phase 6) | ux-engineer | Auto-attach Design Evaluator (already wired) |
| Data-heavy screen flagged | ux-engineer (Phase 1 intake) or app-architect (Phase 3 design) | dash-forge | Package tokens + design spec into dash-forge context, invoke /data-forge; hand the resulting spec + prototype back to the caller |

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
| "Review this code" / "Is this code good?" | code-auditor | /audit full |
| "Fix the UX" / "The design is inconsistent" | ux-engineer | /uxe eval |
| "Connect to Salesforce" / "Set up webhooks" | integrations-engineer | /integrate plan |
| "Deploy this" / "Ship it" | deploy-ops | /deploy staging |
| "Commit my changes" / "Push to git" | git-ops | /git-sync |
| "Can this handle more users?" | scale-ops | /scale audit |
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

# code-auditor
description: >
  Code quality auditor with Auditor/Fixer/Verifier loop. Use for /audit, "audit this",
  "find bugs", "security audit", "code review", "pre-deploy check", "what's wrong with
  this code", or any code quality question. Trigger liberally.

# ux-engineer
description: >
  UI/UX design harness with Design Planner/Generator/Evaluator loop. Use for /uxe,
  "review the UX", "design iteration", "component library", "accessibility audit",
  "is the UI consistent", or any design quality question. Trigger liberally.

# integrations-engineer
description: >
  Third-party API integrations with Planner/Builder/Tester loop. Use for /integrate,
  "connect to Salesforce", "webhook", "OAuth", "API integration", "connect to Slack",
  or any external service connection. Trigger liberally.

# git-ops
description: >
  Git workflow: branch, commit, PR, sync. Use for /git, /commit, /pr, /push,
  "commit this", "push to git", "create a PR", "sync to repo", or any git
  operation. Trigger liberally.

# deploy-ops
description: >
  Deployment pipeline: audit gate → staging → production → monitoring. Use for
  /deploy, "deploy this", "ship it", "push to production", "staging", "rollback",
  "health check", or any deployment task. Trigger liberally.

# scale-ops
description: >
  Scaling readiness: load test, perf budgets, caching, capacity planning. Use for
  /scale, "load test", "can this handle more users", "performance", "caching strategy",
  or any scaling question. Trigger liberally.
```

---

## 8. Ecosystem Awareness

Every skill should know these facts:

- **Total skills:** 10 skills + 1 protocol (checkpoint)
- **Tri-agent skills:** app-architect (Generator/Evaluator), ux-engineer (Design
  Planner/Generator/Evaluator), code-auditor (Auditor/Fixer/Verifier),
  integrations-engineer (Planner/Builder/Tester)
- **Auto-invocations:** stack-forge during app-architect Phase 2, ux-engineer during
  app-architect UI sprints
- **Pipeline flow:** reverse-spec → app-architect → git-ops → deploy-ops
- **Quality plugins:** code-auditor, ux-engineer, scale-ops (run at any stage)
- **Integration plugin:** integrations-engineer (run when external APIs needed)
- **Checkpoint protocol:** every skill writes to `.checkpoints/[skill].checkpoint.json`
- **Tri-dev is retired.** Its build harness lives inside app-architect Phase 6.
  If a user asks for tri-dev, route to app-architect /build.

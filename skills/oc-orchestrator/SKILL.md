---
name: oc-orchestrator
displayName: OC · Orchestrator
version: 1.3.0
shortDesc: Pipeline coordinator — registry, status, routing. v1.2 reads `pm_refs` across skills; routes by ticket id.
phases: [foundation]
triAgent: false
tryable: true
commands:
  - /oc-ops
  - /oc-ops status
  - /oc-ops next
  - /oc-ops route
  - /oc-ops projects
  - /oc-ops register
  - /oc-ops scan
  - /oc-ops switch
  - /oc-ops pipeline
  - /oc-ops blockers
  - /oc-ops recent
description: >
  Pipeline coordinator for the opchain dev ecosystem. Multi-project registry, cross-skill
  status, smart routing, and "what should I do next?" recommendations. Use for /ops,
  "what's the status", "where did I leave off", "which project", "what should I work on",
  "show me everything", or any question about pipeline state across projects. Also trigger
  when the user seems lost, references multiple projects, or asks a vague dev question
  that needs routing. Trigger liberally.
---

# Orchestrator

Pipeline coordinator for the opchain dev ecosystem. This skill does NOT build, audit,
deploy, or design — it reads every other skill's checkpoints, maintains a project
registry, and answers three questions:

1. **Where am I?** — Cross-skill status across all registered projects.
2. **What's next?** — The single highest-priority action based on pipeline position.
3. **Route me.** — Smart dispatch to the right skill based on intent.

This is an **additive layer**. Every existing skill retains its own welcome protocol
and works independently. The oc-orchestrator provides a better front door and a unified
view across projects — it doesn't replace any skill's internal logic.

---

## /ops — Command Reference

```
ORCHESTRATOR COMMANDS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  STATUS
  /ops                 Show all projects + active skill state
  /ops status          Same as /ops — full status dashboard
  /ops status [project] Status for one project (all skills)

  ROUTING
  /ops next            Recommend the single highest-priority action
  /ops next [project]  Next action for a specific project
  /ops route [intent]  Route a vague request to the right skill + phase

  PROJECT REGISTRY
  /ops projects        List all registered projects with health
  /ops register        Register a new project (path + name)
  /ops unregister      Remove a project from the registry
  /ops switch [project] Set the active project for this session
  /ops scan            Auto-discover projects by scanning workspace

  PIPELINE
  /ops pipeline        Show the canonical pipeline DAG
  /ops pipeline [project] Show where a project sits in the pipeline
  /ops blockers        Show all blockers across all projects
  /ops recent          Last-known state per skill (sorted by recency)

  META
  /ops health          Self-check: are all skill files accessible?
  /ops skills          List all installed opchain skills with versions
  /checkpoint          Show oc-orchestrator state (memory registry + session cache)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Type any command, or just describe what you need.
```

---

## Session-Start Protocol

Run this on every new session, before doing any other oc-orchestrator work:

```bash
npm run checkpoint:status
```

That command prints a markdown summary of every `.checkpoints/<skill>.checkpoint.json`
in the project — phase, step, status, `next_actions`, and blockers. It
**is** the registry scanner for a single project; the architecture
diagram below describes how the same protocol scales to multi-project.

If the project doesn't have `npm run checkpoint:status` wired up
(common on cold projects), fall back to:

```bash
ls .checkpoints/*.checkpoint.json 2>/dev/null && cat .checkpoints/*.checkpoint.json
```

If `.checkpoints/` doesn't exist at all, this is a cold start —
delegate to `oc-checkpoint-protocol` to scaffold the schema, README,
`scripts/checkpoint.mjs`, and the post-merge auto-stamp workflow
before doing anything else.

**Do not** start routing or dispatching work until you've read the
checkpoint state. The whole point of the protocol is that the next
session resumes from the prior session's `next_actions[0]`, not from
chat history.

---

## Architecture

```
┌──────────────────────────────────────────────────────┐
│                    ORCHESTRATOR                       │
│                                                      │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────┐  │
│  │   Project    │  │  Checkpoint  │  │   Router    │  │
│  │   Registry   │  │   Scanner    │  │   Engine    │  │
│  │              │  │              │  │             │  │
│  │  Multi-proj  │  │  Reads ALL   │  │  Intent →   │  │
│  │  tracking    │  │  skill CPs   │  │  skill +    │  │
│  │              │  │  per project │  │  phase      │  │
│  └──────────────┘  └──────────────┘  └────────────┘  │
│           │                │                │         │
│           ▼                ▼                ▼         │
│  ┌─────────────────────────────────────────────────┐  │
│  │              Priority Engine                    │  │
│  │  Blockers > Failed > In-progress > Not-started  │  │
│  │  Pipeline order breaks ties                     │  │
│  └─────────────────────────────────────────────────┘  │
│                          │                            │
│                          ▼                            │
│                   /ops next output                    │
│                   /ops status output                  │
│                   /ops route → active invocation      │
└──────────────────────────────────────────────────────┘
         │ reads                        │ dispatches to
         ▼                              ▼
  .checkpoints/*.json            Other opchain skills
  (all projects)                 (oc-app-architect, oc-code-auditor, etc.)
```

### Design Constraints

1. **Read-only coordinator.** Orchestrator reads other skills' checkpoints but NEVER
   writes to them. It persists its own state via memory (registry) and session files
   (routing history, scan cache).
2. **Additive, not gating.** Skills work without the oc-orchestrator installed. The
   oc-orchestrator makes the ecosystem smarter, not dependent.
3. **No build artifacts.** Orchestrator produces status reports and routing decisions,
   never code, specs, designs, or documents.
4. **Dispatch, don't duplicate.** When routing, actively invoke the target skill
   (read its SKILL.md, execute its command). Don't re-implement skill logic.

---

## Project Registry

The registry tracks all projects the user is actively working on.

### Persistence Model

**Critical constraint:** Claude's filesystem resets between conversations. A global
checkpoint file would be wiped every session. The oc-orchestrator uses a two-layer
persistence strategy:

1. **Primary: `memory_user_edits`** — The project registry (names, paths, priority,
   monorepo structure) is stored as a memory edit. This survives across conversations.
   Format: one compact JSON line per `memory_user_edits add` call.

2. **Session cache: `~/.opchain/oc-orchestrator.session.json`** — Ephemeral per-session
   file for routing history, last scan results, and active project state. Rebuilt
   from memory + checkpoint scanning at session start.

On session start, the oc-orchestrator reads its memory edit for the registry, then scans
each registered path's `.checkpoints/` directory for live skill state. The session
cache is a performance optimization, not a persistence layer.

### Registry Schema (stored in memory)

```jsonc
{
  "projects": [
    {
      "id": "aidops-core",
      "name": "aidops-core",
      "path": "/home/claude/aidops",
      "type": "monorepo",
      "priority": "primary",
      "apps": ["gtrackr", "dose", "pintrack", "get-ripped", "career-ops"],
      "notes": "Main platform monorepo — Workers + D1 + KV"
    },
    {
      "id": "penthreshold",
      "name": "PenThreshold",
      "path": "/home/claude/penthreshold",
      "type": "app",
      "priority": "secondary",
      "apps": null,
      "notes": "SharePoint training compliance platform"
    }
  ],
  "default_project": "aidops-core"
}
```

Schema design rationale:
- **No `last_activity` or `tags`** — derived at runtime from checkpoint timestamps
  and manifest scanning. Caching derivable data creates staleness.
- **`priority` instead of boolean `active`** — values: `primary`, `secondary`,
  `archived`. Primary projects surface first in `/ops next` cross-project recommendations.
- **`apps` array** — for monorepos, lists sub-applications. Single-app projects
  set this to `null`. Enables per-app checkpoint scanning and status grouping.
- **`active_project` is session state, not registry** — it starts as `default_project`
  each session and can be switched with `/ops switch`. Only `default_project` persists.

### Monorepo Sub-Project Handling

For monorepos like aidops-core with multiple apps, the scanner checks for
app-scoped checkpoints using **subdirectories** within `.checkpoints/`:

```
aidops-core/
├── .checkpoints/
│   ├── oc-reverse-spec.checkpoint.json       ← project-wide (applies to whole repo)
│   ├── oc-git-ops.checkpoint.json            ← project-wide
│   ├── gtrackr/
│   │   ├── oc-app-architect.checkpoint.json  ← app-specific
│   │   └── oc-code-auditor.checkpoint.json
│   └── dose/
│       └── oc-app-architect.checkpoint.json
├── apps/
│   ├── gtrackr/
│   ├── dose/
│   └── pintrack/
```

This follows the existing checkpoint protocol convention (each skill writes
`{skill}.checkpoint.json`) — the oc-orchestrator just adds an app-level directory
grouping. Skills writing app-specific checkpoints set `project_dir` to
`{monorepo}/.checkpoints/{app}/` instead of `{monorepo}/.checkpoints/`.

**Migration note:** This requires a minor amendment to the checkpoint protocol
(v1.1) to support subdirectory scoping. Until then, the oc-orchestrator can also
fall back to scanning the `project` field inside each checkpoint to group by
app when all checkpoints are flat in `.checkpoints/`.

Status output groups by app within a monorepo:

```
▶ aidops-core                             [active]
  Project-wide:
    ✅ oc-reverse-spec    complete     Specs for 4 apps
    ⏳ oc-git-ops         not started

  gtrackr:
    🔄 oc-app-architect   in_progress  Sprint 2/4
    ✅ oc-code-auditor    complete     Grade B+
    🚫 BLOCKER: F-003 rate limiting

  dose:
    🔄 oc-app-architect   in_progress  Phase 3 design
```

### Registration Flow (`/ops register`)

1. Ask for project path (or detect from conversation context)
2. Scan `{path}/.checkpoints/` for existing skill checkpoints
3. Read `package.json`, `wrangler.toml`, or other manifests for metadata
4. Detect monorepo structure (workspace config, `apps/` directory)
5. If monorepo: inventory sub-applications, confirm app list with user
6. Determine priority (`primary` if first project, `secondary` otherwise)
7. Write to `memory_user_edits`
8. Display initial status scan

### Auto-Discovery

When any opchain skill is invoked and the project directory is NOT in the registry,
the oc-orchestrator should auto-register it on next `/ops` invocation. Detection:
checkpoint files exist at a path not in the registry → suggest registration.

### Cold Start (First-Ever Invocation)

When the oc-orchestrator is invoked with no memory edit and no checkpoint files found
anywhere:

```
No projects registered yet. Let's set up your workspace.

I can scan for existing opchain checkpoints, or you can register a project manually.

  /ops register [path]  — Register a specific project
  /ops scan             — Scan common paths for checkpoint files
```

`/ops scan` checks: `/home/claude/*/`, looking for `.checkpoints/` directories or
`package.json` / `wrangler.toml` files. Presents discovered projects for confirmation.

---

## Checkpoint Scanner

The core read engine. For a given project, scans all skill checkpoints and produces
a unified status view.

### Scan Process

```bash
# For each registered project:
ls {project.path}/.checkpoints/*.checkpoint.json 2>/dev/null
# For monorepos, also scan subdirectories:
ls {project.path}/.checkpoints/*/checkpoint.json 2>/dev/null
```

For each checkpoint found:
1. Read header: skill, updated_at, status
2. Read progress_table: phase completion
3. Read blockers: any unresolved?
4. Read next_actions: what's queued?
5. Do NOT read skill_state (private to owning skill)

### Scan Caching

Scanning all checkpoints on every command is cheap for 2-3 projects (<50ms) but
could slow down with many projects or slow filesystems. Strategy:

- On first `/ops` invocation per session: full scan, write to session cache
- On subsequent invocations: read from session cache unless >5 minutes stale
- `/ops status --fresh` forces a re-scan
- Any routing dispatch invalidates the cache (the dispatched skill may write a checkpoint)

### Unified Status Output (`/ops status`)

```
OPCHAIN STATUS — All Projects
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

▶ aidops-core                              [active]
  ✅ oc-reverse-spec      complete     Specs generated for 4 apps
  🔄 oc-app-architect     in_progress  Sprint 2/4 — CRUD API (gtrackr)
  ✅ oc-code-auditor      complete     Grade B+, 2 HIGH findings open
  ⏳ oc-deploy-ops        not started
  ⏳ oc-git-ops           not started
  🚫 BLOCKER: rate limiting gap (oc-code-auditor F-003)
  → Next: Fix F-003, then resume oc-app-architect sprint 2

▶ GET RIPPED
  🔄 oc-app-architect     in_progress  Phase 3 — design pipeline
  ⏳ oc-code-auditor      not started
  → Next: Complete design approval gate

▶ penthreshold
  ✅ oc-dash-forge        complete     Exec archetype, prototype delivered
  ⏳ oc-app-architect     not started
  → Next: Feed oc-dash-forge handoff into oc-app-architect Phase 3d

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  3 projects | 2 active pipelines | 1 blocker
```

### Single-Project Status (`/ops status [project]`)

Deeper view for one project — shows full progress tables per skill, all blockers
with proposed resolutions, and the complete next_actions queue.

---

## Priority Engine (`/ops next`)

Recommends the single most important action across all projects (or for a specific
project). Priority rules, in order:

### Priority Hierarchy

```
1. BLOCKED items needing user_decision     (you're the bottleneck)
2. FAILED skills needing recovery          (something broke)
3. IN_PROGRESS skills at a gate            (approval needed to continue)
4. IN_PROGRESS skills mid-work             (resume where you left off)
5. Pipeline-next for completed skills      (chain to the next skill)
6. NOT_STARTED skills in pipeline order    (start the next logical skill)
```

### Pipeline Order (tie-breaker)

When two actions have the same priority level, the one earlier in the canonical
pipeline wins:

```
oc-reverse-spec → oc-app-architect → oc-git-ops → oc-deploy-ops
                    ↕
          oc-code-auditor (required before deploy)
          oc-integrations-engineer (when needed)
          oc-scale-ops (advisory)
```

### Cross-Project Priority

When recommending across projects, the priority engine layers project weight on top
of the action-level hierarchy:

1. **Project priority class** — `primary` projects outrank `secondary` at the same
   action priority level. A blocker on a secondary project still outranks routine
   progress on a primary project (action priority wins first), but two in-progress
   items tie-break to the primary project.
2. **Recency** — within the same priority class, the more recently active project
   gets slight priority (user momentum).
3. **Session context** — if the user has been working on project X this conversation,
   favor project X for `/ops next` unless another project has a strictly higher-priority
   action.

The user can override priority class with `/ops register` or by editing the memory
edit directly.

### Output Format

```
NEXT ACTION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Project: aidops-core (gtrackr)
Skill:   oc-code-auditor
Action:  Fix finding F-003 (missing rate limiting on /api/auth/*)
Why:     Blocks oc-app-architect sprint 2 evaluator pass + oc-deploy-ops gate
Command: /audit fix F-003

Run it now? (Y) proceeds, (N) shows the next item in the queue.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

On (Y): oc-orchestrator actively invokes the recommended skill with the right context.

---

## Router Engine (`/ops route`)

Smart dispatch for vague or multi-skill requests. This operationalizes the routing
table currently in orchestrator.md.

### Routing Table

| Intent Signal | Route to | Phase |
|---|---|---|
| "build me an app", "I have an idea" | oc-app-architect | /discover |
| "document this codebase", "backfill specs" | oc-reverse-spec | /rev-full |
| "what stack should I use" | oc-stack-forge | /stack-decide |
| "review this code", "find bugs", "audit" | oc-code-auditor | /audit full |
| "fix the UX", "design is inconsistent" | oc-ux-engineer | /uxe eval |
| "connect to [service]", "webhook", "OAuth" | oc-integrations-engineer | /integrate plan |
| "deploy this", "ship it" | oc-deploy-ops | /deploy staging |
| "commit", "push to git", "create a PR" | oc-git-ops | /git-sync |
| "can this handle more users", "performance" | oc-scale-ops | /scale audit |
| "dashboard", "analytics UI", "BI design" | oc-dash-forge | /data-forge |
| "continue where I left off" | [scan checkpoints] | [resume most recent] |
| "what should I work on" | oc-orchestrator | /ops next |

### Routing Process

1. Parse the user's intent from their message
2. Check if a project context is clear (active project, or mentioned by name)
3. If project is ambiguous AND multiple projects exist, ask which project
4. Match intent to routing table
5. Check the target skill's checkpoint for that project (resume vs. fresh start)
6. **Actively invoke** the target skill — read its SKILL.md, execute the command

### Fallback: No Match

If the intent doesn't match any routing table entry:

1. Check if it's a general question (not a pipeline action) → answer directly, no routing
2. If it seems like a pipeline action but is ambiguous → ask ONE clarifying question
   using `ask_user_input` with 2-3 options mapped to the most likely skills
3. Never guess — a wrong route wastes more time than a clarifying question

### Ambiguity Handling

If the intent is genuinely ambiguous (maps to 2+ skills equally), present the
options with one-line explanations:

```
That could go a few directions:

1. oc-code-auditor /audit security — if you want to find vulnerabilities
2. oc-security-auditor /scan — if you want a full security posture review (coming soon)
3. oc-code-auditor /audit fix-all — if you already know the issues and want fixes

Which one?
```

Never present more than 3 options.

---

## Pipeline Visualization (`/ops pipeline`)

Shows the canonical pipeline DAG with the project's current position highlighted.

### Text-Based Pipeline View

```
PIPELINE — aidops-core (gtrackr)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  ✅ oc-reverse-spec ──► 🔄 oc-app-architect ──► ⏳ oc-git-ops ──► ⏳ oc-deploy-ops
                           │
                           ├── ✅ oc-stack-forge (Phase 2)
                           ├── ⏳ oc-ux-engineer (Phase 3/6)
                           └── 🔄 Sprint 2/4 in progress
                                  └── 🚫 Blocked: F-003

  Quality plugins:
    ✅ oc-code-auditor     Grade B+ (2 HIGH open)
    ⏳ oc-scale-ops        Not run
    ⏳ integrations     Not needed (no external APIs)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## Blockers Dashboard (`/ops blockers`)

Aggregates all blockers from all checkpoints across all projects.

```
BLOCKERS — All Projects
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  aidops-core (gtrackr)
  🚫 B1: Missing rate limiting on auth endpoints
     Source: oc-code-auditor F-003
     Blocking: oc-app-architect sprint 2
     Needs: code_fix
     Resolution: Add rate-limit middleware → /audit fix F-003

  GET RIPPED
  🚫 B1: Design direction not approved
     Source: oc-app-architect Phase 3 gate
     Blocking: oc-app-architect punch list
     Needs: user_decision
     Resolution: Review style book + wireframes → /approve

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  2 blockers | 1 code fix | 1 user decision
```

---

## Skill Health Check (`/ops health`)

Verifies the ecosystem is intact:

```bash
# For each known opchain skill:
# 1. Check SKILL.md exists in available skills
# 2. Check orchestrator.md reference exists
# 3. Check checkpoint.sh script exists
# 4. Verify YAML frontmatter is parseable
# 5. Report version numbers
```

```
ECOSYSTEM HEALTH
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  ✅ oc-app-architect     v1.1.0   SKILL.md ✓  checkpoint.sh ✓
  ✅ oc-stack-forge       v1.0.0   SKILL.md ✓  checkpoint.sh ✓
  ✅ oc-reverse-spec      v1.0.0   SKILL.md ✓  checkpoint.sh ✓
  ✅ oc-ux-engineer       v1.1.0   SKILL.md ✓  checkpoint.sh ✓
  ✅ oc-dash-forge        v1.0.0   SKILL.md ✓  checkpoint.sh ✓
  ✅ oc-code-auditor      v1.0.0   SKILL.md ✓  checkpoint.sh ✓
  ✅ integrations-eng  v1.0.0   SKILL.md ✓  checkpoint.sh ✓
  ✅ oc-git-ops           v1.0.0   SKILL.md ✓  checkpoint.sh ✓
  ✅ oc-deploy-ops        v1.0.0   SKILL.md ✓  checkpoint.sh ✓
  ✅ oc-scale-ops         v1.0.0   SKILL.md ✓  checkpoint.sh ✓
  ✅ checkpoint-proto  v1.0.0   SKILL.md ✓  checkpoint.sh ✓
  ✅ oc-orchestrator      v1.0.0   SKILL.md ✓  (self)

  11 skills + 1 protocol | all healthy
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## Activity Snapshot (`/ops recent`)

Checkpoints store only their most recent `updated_at` — there's no historical event
log. `/ops recent` reconstructs a snapshot from what's available: each skill's last
update timestamp and progress_summary, sorted reverse-chronologically.

```
LAST KNOWN STATE — Per Skill
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  15:30 today   aidops-core    oc-code-auditor   Audit complete, grade B+
  14:45 today   aidops-core    oc-app-architect  Sprint 2/4 in progress
  yesterday     GET RIPPED     oc-app-architect  Phase 3 design started
  3 days ago    penthreshold   oc-dash-forge     Prototype delivered
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

This is a "last seen" view, not a timeline. If you need a true activity log, the
routing_history in the session cache tracks dispatches within the current conversation.

---

## Checkpoint Integration

### Two-Layer Persistence

| Layer | Location | Survives session reset? | Contents |
|---|---|---|---|
| Memory | `memory_user_edits` | Yes | Project registry (names, paths, priority, apps) |
| Session | `~/.opchain/oc-orchestrator.session.json` | No | Active project, routing history, last scan cache |

The oc-orchestrator does NOT use the standard `{project}/.checkpoints/` convention for
its own state because it's cross-project. It reads other skills' checkpoints at those
standard locations but stores its own registry in memory and its session state in an
ephemeral file.

### Session File Schema

```jsonc
{
  "session_started": "2026-04-21T15:00:00Z",
  "active_project": "aidops-core",
  "last_scan": "2026-04-21T15:30:00Z",
  "scan_cache": {
    "aidops-core": {
      "skills_found": ["oc-reverse-spec", "oc-app-architect", "oc-code-auditor"],
      "blocker_count": 1,
      "status_summary": "Sprint 2/4, 1 blocker"
    }
  },
  "routing_history": [
    {
      "at": "2026-04-21T15:30:00Z",
      "intent": "audit the code",
      "routed_to": "oc-code-auditor",
      "project": "aidops-core"
    }
  ]
}
```

### Session Start Sequence

1. Read `memory_user_edits` for project registry
2. If registry exists: create `~/.opchain/`, scan all project paths for checkpoints
3. If registry is empty: cold start flow (see Project Registry § Cold Start)
4. Write session file with scan results

### Error Handling

| Error | Detection | Recovery |
|---|---|---|
| Registered path doesn't exist | `stat {path}` fails | Flag project as unreachable, skip in status, suggest `/ops unregister` |
| Checkpoint file is malformed JSON | JSON parse error | Skip that skill, flag in status: "⚠️ {skill} checkpoint corrupt" |
| Memory edit is stale (references deleted project) | Path scan fails | Remove from registry, update memory edit |
| No checkpoints at registered path | Empty `.checkpoints/` dir | Show project as registered but no pipeline activity |

### Cross-Skill Reads

| Reads from | Why |
|---|---|
| **Every skill** | Checkpoint status, progress, blockers, next_actions |

| Read by | Why |
|---|---|
| No skill reads oc-orchestrator state | It's a coordinator, not a dependency. Skills that need project context get it from their own checkpoints or conversation context. |

### When to Write

| Event | Write to memory? | Write to session? |
|---|---|---|
| Project registered/unregistered | Yes | Yes |
| Active project changed | No | Yes |
| `/ops next` computed | No | Yes (routing_history) |
| `/ops status` scanned | No | Yes (scan_cache) |
| Routing dispatched | No | Yes (routing_history) |

### `/checkpoint` Behavior

Unlike other skills, the oc-orchestrator doesn't have a single checkpoint file. When
`/checkpoint` is invoked, it shows both persistence layers:

```
ORCHESTRATOR STATE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Memory (persistent):
  Registry: 3 projects (aidops-core [primary], penthreshold, GET RIPPED)
  Default: aidops-core

Session (ephemeral):
  Active: aidops-core
  Last scan: 2 min ago
  Routing history: 3 dispatches this session
  Session file: ~/.opchain/oc-orchestrator.session.json
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## Smart Behaviors

### Session Start Detection

When the oc-orchestrator is invoked at the start of a conversation (no prior messages),
run an automatic scan and present the most relevant status:

```
Welcome back. Here's where things stand:

▶ aidops-core has a blocker (rate limiting fix needed)
▶ GET RIPPED is waiting on your design approval

/ops next recommends: Fix F-003 on aidops-core (unblocks the build pipeline)
```

### Stale Checkpoint Detection

If a checkpoint's `updated_at` is >7 days old and status is `in_progress`:

```
⚠️ aidops-core / oc-app-architect hasn't been updated in 9 days.
   Last status: Sprint 2 in progress.
   This might be stale. Resume or reset?
```

### Pipeline Completion Detection

Not every project uses every skill. The oc-orchestrator determines the **applicable
pipeline** for a project by checking which skills have ever written a checkpoint
(or were referenced in another skill's checkpoint as a dependency).

A project is "pipeline complete" when all skills that have checkpoints show
`status: complete` AND no skill's `next_actions` references an uninvoked skill.

When detected:

```
🎉 penthreshold — pipeline complete!
   oc-dash-forge ✅ → oc-app-architect ✅ → oc-git-ops ✅ → oc-deploy-ops ✅
   (oc-scale-ops, oc-integrations-engineer not applicable — no checkpoints)
   Archive this project? (/ops unregister penthreshold)
```

### Implicit Project Detection

If the user says "deploy gtrackr" and gtrackr is a known app in the aidops-core
monorepo, the oc-orchestrator should:
1. Set active project to aidops-core
2. Route to oc-deploy-ops with the gtrackr app context
3. No extra question needed

---

## Relationship to orchestrator.md

The existing `orchestrator.md` file bundled in every skill remains as-is. It defines:
- Welcome protocol (each skill's own entry behavior)
- Pipeline map (reference for all skills)
- Active chaining protocol (how skills invoke each other)
- Novice mode (guided walkthrough)

The oc-orchestrator **skill** adds:
- Multi-project registry (orchestrator.md has no concept of multiple projects)
- Cross-project status aggregation (orchestrator.md scans one project at a time)
- Priority engine (orchestrator.md has no prioritization logic)
- Routing with project context (orchestrator.md's routing table doesn't consider which project)
- Activity history (orchestrator.md has no temporal tracking)

Over time, skills may choose to delegate their welcome protocol to the oc-orchestrator
(check if oc-orchestrator checkpoint exists → read active project from it → skip own
project detection). But this is opt-in, not required.

---

## PM-Tool MCP Integration (v1.2+)

The oc-orchestrator already reads every skill's checkpoint to answer
"where did I leave off?". v1.2 makes it PM-aware by reading the
`pm_refs` field added in oc-checkpoint-protocol v1.2 — the oc-orchestrator
becomes a router by ticket id, not just by project / phase.

### Cross-skill PM thread aggregation

`/ops` reads `pm_refs` across every skill checkpoint in every
registered project, then aggregates:

```
Active threads (by ticket):

  PLAT-4471 — Add CSV export to /api/customers
    oc-app-architect     spec-approved   (source)
    oc-git-ops           PR opened       (linked)
    oc-deploy-ops        shipped         (deploy: PLAT-4485)
    oc-monitoring-ops    resolved        (incident: PLAT-4503)

  AEGIS-9 — Migrate auth provider Auth0 → Clerk
    oc-migration-ops     step 4/9        (parent + 9 children)
    oc-deploy-ops        ─               (waiting)

  EXP-12 — Image-search prototype
    oc-app-architect     /discover       (source)
    oc-stack-forge       decided         (ADR-7)
```

The view collapses by project but is queryable by ticket: `/ops
ticket PLAT-4471` shows that thread alone.

### `/ops resume TICKET-ID` — route by ticket

New verb (v1.2). User says "resume work on PLAT-4471" and the
oc-orchestrator:

1. Searches `pm_refs` across all skill checkpoints for the
   ticket id.
2. Identifies which skill last touched it + what phase.
3. Recommends the next action, citing the specific skill and
   command. Examples:
   - "Last touched by `oc-git-ops` 2 days ago — PR is in review.
     Run `/git-sync --refresh` to update."
   - "Last touched by `oc-app-architect` Phase 4. Next: `/build`."

### `/ops next` (existing verb, v1.2-enhanced)

`/ops next` already considers project + phase. v1.2 also
considers PM-ticket priority:

- A ticket marked `Urgent` or `priority:high` in the PM tool
  surfaces ahead of lower-priority backlog work.
- Tickets with an unblocked dependency surface ahead of blocked
  ones.
- Stale-but-active threads (no checkpoint write in > 7d) get a
  `stale?` annotation.

### `/ops pm-status` — what does the PM tool say?

New advisory verb. Queries the configured PM-MCP for the user's
assigned tickets in `In Progress` state, cross-references with
checkpoint state, and reports inconsistencies:

```
PM ↔ checkpoint reconciliation:

  PLAT-4471 — In Progress (PM)   ↔   shipped (oc-deploy-ops)
    ⚠  PM ticket should be Done. Likely auto-transition failed.
    Suggested: /git-sync --retry-pm

  AEGIS-9 — In Progress (PM)     ↔   step 4/9 (oc-migration-ops)
    ✓  In sync.

  CHURN-3 — In Progress (PM)     ↔   no checkpoint
    ⚠  PM says you're working on this; no opchain skill
       has a checkpoint. Did you start outside opchain?
```

This is a hygiene tool, not an enforcement layer. Reconciliation
problems are usually transient (deferred PM writes, MCP outages
during a transition).

### Multi-project routing

In a multi-project setup (oc-orchestrator's existing strength),
`pm_refs` are namespaced by project so the oc-orchestrator never
confuses `PLAT-1` from project A with `PLAT-1` from project B
(different PM workspaces, different broker scopes).

### Failure modes

- No PM-MCP configured anywhere → `/ops` operates as v1.1; no
  PM aggregation; the existing project / phase view is the
  full picture.
- PM-MCP available but `pm_refs` field absent in a skill's
  checkpoint → that skill simply doesn't appear in the PM
  thread view; oc-checkpoint-protocol v1.2 backfill happens on
  the skill's next write.
- Cross-project PM ambiguity → oc-orchestrator prompts the user
  to disambiguate when a ticket id appears in multiple PM
  workspaces.

---

## Principles

1. **Read everything, write only your own state.** The oc-orchestrator's power
   comes from its cross-skill read access. It never modifies another skill's
   checkpoints. Its own state lives in memory (registry) and session files (cache).
2. **Recommend, don't block.** `/ops next` is a recommendation, not a gate. The user
   can always invoke any skill directly.
3. **One answer per question.** `/ops next` returns ONE action, not a list. The user
   can ask again for the next item in the queue.
4. **Project context is first-class.** Every command accepts an optional project
   argument. If omitted, use active_project (session state) or default_project (memory).
5. **Pipeline order is the tie-breaker.** When priority is equal, earlier pipeline
   position wins. Unblock downstream skills first.
6. **Dispatch, don't duplicate.** When routing, read the target skill's SKILL.md and
   invoke its command. Don't re-implement skill logic inside the oc-orchestrator.
7. **Stale data is worse than no data.** Flag old checkpoints. Don't present week-old
   status as current truth.

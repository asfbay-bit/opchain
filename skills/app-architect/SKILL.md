---
name: app-architect
displayName: App Architect
version: 1.2.0
shortDesc: Idea → spec → design → build → launch in one skill. v1.2 reads PM tickets and writes sprints back via PM-MCP.
phases: [plan, build]
triAgent: true
tryable: true
commands:
  - /app
  - /discover
  - /spec
  - /design
  - /roadmap
  - /scaffold
  - /build
  - /launch
description: >
  Unified app development: idea → spec → design → build with Generator/Evaluator
  QA loop → launch. Use for /app, /discover, /spec, /design, /build, /launch,
  "build me an app", "I have an app idea", or any software project. Auto-invokes
  stack-forge and ux-engineer. Trigger liberally.
---

# App Architect

**On first invocation, read `references/orchestrator.md` and follow its welcome protocol.**

Unified planning + build skill. Takes a concept from idea through spec, design, and
roadmap (planning phases with user approval gates), then builds it sprint-by-sprint
using a Generator → Evaluator harness (build phase with automated QA).

This is one skill, not two. Planning and building are the same pipeline.

## /app — Command Reference

```
APP ARCHITECT COMMANDS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  PLANNING PHASES
  /discover       Discovery interview (Phase 1)
  /spec           Spec generation + stack-forge (Phase 2)
  /design         Design pipeline — style book, wireframes, prototypes (Phase 3)
                    auto-routes data-heavy screens to /data-forge
  /roadmap        Sprint plan generation (Phase 4)

  BUILD PHASES
  /scaffold       Generate runnable project structure (Phase 5)
  /build          Start or resume Generator → Evaluator sprint loop (Phase 6)
  /eval           Run Evaluator on current sprint (ad-hoc QA)
  /launch         Launch checklist + deploy handoff (Phase 7)

  UTILITIES
  /status         Current phase, gates passed, sprint scores, next action
  /approve        Approve current gate and advance
  /export-spec    Generate master spec document (.docx)
  /punch-list     View or edit the screen & component punch list
  /contract       View or edit current sprint contract

  SESSION
  /checkpoint     Show checkpoint status
  /checkpoint show    Full checkpoint JSON
  /checkpoint reset   Archive and restart

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## Architecture

```
CONCEPT
  │
  ▼
┌─────────────────── PLANNING (user-driven, gate-controlled) ──────────┐
│                                                                      │
│  Phase 1: Discovery ──► Phase 2: Spec ──► Phase 3: Design           │
│  (interview)      ★GATE  (+ stack-forge) ★GATE  (style+wireframes)  │
│                                                    ★GATE             │
│  Phase 4: Sprint Plan                                                │
│  (roadmap → sprint decomposition)  ★GATE                             │
│                                                                      │
└──────────────────────────────┬───────────────────────────────────────┘
                               │
                               ▼
┌─────────────────── BUILD (agent-driven, evaluator-controlled) ──────┐
│                                                                      │
│  Phase 5: Scaffold (one-time project setup)                          │
│                                                                      │
│  Phase 6: Sprint Build Loop (repeat per sprint)                      │
│  ┌────────────┐  contract   ┌─────────────┐                         │
│  │ GENERATOR  │◄──negotiate──►│ EVALUATOR  │                         │
│  │ builds +   │              │ grades +    │                         │
│  │ tests      │──code+tests─►│ reports     │                         │
│  │            │◄──feedback───│ (skeptical) │                         │
│  └────────────┘              └─────────────┘                         │
│       PASS → next sprint | FAIL → iterate | MAX → escalate          │
│                                                                      │
│  Phase 7: Launch                                                     │
│  (audit gate → deploy → monitor)                                     │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

### Why One Skill?

Previously this was two skills (app-architect for planning, tri-dev for building) with
a fuzzy handoff between them. Both produced specs. Both decomposed sprints. Both tried
to scaffold. Merging them eliminates:
- Duplicate spec generation
- Conflicting sprint formats
- The "which skill do I use now?" question
- Context loss at the planning → building transition

The planning phases remain user-driven with approval gates (you stay involved in every
design decision). The build phases use the Generator → Evaluator loop (automated QA
that catches what single-pass generation misses). Same skill, different operating modes.

---

## Session Persistence (Checkpoint Protocol)

Checkpoint: `{project-dir}/.checkpoints/app-architect.checkpoint.json`

### Resume on Start

When any command is invoked:
1. Check for checkpoint
2. If exists: show phase, gates, sprint scores, next action
3. Ask: "Continue, restart, or show full checkpoint?"

### progress_table

```json
[
  { "id": "discovery",       "label": "Discovery interview",      "status": "not_started" },
  { "id": "spec",            "label": "Spec + stack-forge",        "status": "not_started" },
  { "id": "spec-gate",       "label": "★ Spec approval",           "status": "not_started" },
  { "id": "design",          "label": "Design pipeline",           "status": "not_started" },
  { "id": "design-gate",     "label": "★ Design approval",         "status": "not_started" },
  { "id": "punch-list",      "label": "Punch list",                "status": "not_started" },
  { "id": "punch-gate",      "label": "★ Punch list approval",     "status": "not_started" },
  { "id": "sprint-plan",     "label": "Sprint plan",               "status": "not_started" },
  { "id": "sprint-gate",     "label": "★ Sprint plan approval",    "status": "not_started" },
  { "id": "scaffold",        "label": "Scaffold generation",       "status": "not_started" },
  { "id": "sprint-1",        "label": "Sprint 1: [name]",          "status": "not_started" },
  { "id": "sprint-2",        "label": "Sprint 2: [name]",          "status": "not_started" },
  { "id": "sprint-3",        "label": "Sprint 3: [name]",          "status": "not_started" },
  { "id": "launch",          "label": "Launch & deploy",           "status": "not_started" }
]
```

Write checkpoint after every gate approval, sprint contract, evaluation round, and
sprint completion.

---

## Phase 1: Discovery Interview (`/discover`)

Conduct a structured interview. Group questions 2-3 per round. Skip what's already
known from context.

**Core Concept:** Problem, pitch, prior art, existing workflow being replaced.
**Users & Scope:** Primary users (role, context, goals, anti-goals), single/multi-user,
MVP vs. full vision.
**Technical Context:** Framework preferences, existing systems, hard constraints, offline/
real-time/data-heavy requirements.
**Business Context:** Personal/internal/commercial, monetization, success metrics.

Summarize back to user in 3-5 sentences. Confirm before proceeding.
Write checkpoint: phase "discovery".

---

## Phase 2: Spec Generation (`/spec`)

### Stack Selection (auto-invokes stack-forge)

Before generating spec files, **automatically run stack-forge's decision tree** using
discovery context. Stack-forge walks: platform → backend → database → auth → frontend.
Web searches for current framework status before recommending.

If user already stated preferences during discovery, stack-forge validates the choice
against requirements rather than re-interviewing.

Present stack recommendation → user confirms → stack informs all remaining spec files.

### Spec Documents

Generate each as a separate markdown file:

| File | Contents | Source |
|---|---|---|
| 00-project-overview.md | Problem, personas, success metrics, scope | Discovery interview |
| 01-tech-stack.md | Stack recommendation + rationale | Stack-forge output |
| 02-architecture.md | System diagram, data model, API design | architecture-patterns.md |
| 03-security-auth.md | Auth (from stack-forge), authorization, OWASP | spec-template |
| 04-integrations.md | Third-party services, webhooks, retry logic | spec-template |
| 05-monetization.md | Pricing, payments (if applicable) | spec-template |
| 06-testing.md | Test strategy for chosen stack | stack-forge patterns |
| 07-devops.md | Deploy pattern for chosen platform | stack-forge patterns |
| 08-analytics.md | Tracking, metrics (if warranted) | — |
| 09-cost-estimate.md | Infra costs from stack-forge projection | stack-forge |
| 10-documentation-plan.md | Docs plan (if warranted) | — |

### ★ Spec Approval Gate

User reviews: data model, API contract, security model, scope.
Do not proceed until explicitly approved.
Write checkpoint: phase "spec-approved".

---

## Phase 3: Design Pipeline (`/design`)

Read `references/ux-design-guide.md` for the full methodology.

### 3a. Style Book
Interactive HTML showing all design tokens live: colors, typography, spacing, borders,
component examples (buttons, forms, cards in all variants × states).

**Token discipline:**
- **Colors must be semantic, not aesthetic.** Every color has a role: chrome / state / accent / series. Do not ship a palette of 12 brand hues without role assignment.
- **Type ramp ≤ 5 steps.** Display / headline / body / caption / micro. More sizes = more cognitive tax.
- **Spacing on a scale.** 4/8/12/16/24/32/48/64 — not arbitrary px values per component.
- **Dark mode is a separate palette.** If dark mode is in scope, design both palettes in the style book. Don't invert at build time.

### 3b. Wireframe Review & Dashboard Detection
Text + ASCII layout sketches per screen: purpose, layout zones, key elements, states,
navigation paths.

**For each screen, declare:**
- Primary question / action the screen serves (one sentence)
- Above-the-fold vs. scroll content
- Empty / loading / error / success states (all four)
- Responsive behavior at 375 / 768 / 1280px (or declare "desktop only" with reason)

**As part of this review, scan for data-heavy surfaces:**

- Any screen where the primary job is "show data" rather than "enable action"
- Screens with ≥3 charts or ≥5 KPIs on one view
- Any "dashboard", "analytics", "BI", "monitoring", or "report" screen
- Any screen downstream of a data-architect handoff

For each detected surface, route to dash-forge (`/data-forge`):

```
Detected data-heavy screen: [screen name]
Suggested routing: dash-forge for specialized design

dash-forge produces:
  - Archetype-appropriate design (exec / ops / analyst)
  - Density + semantic color + chart selection
  - Working React prototype with mock data

  (Y) Route to dash-forge
  (N) Handle in app-architect design pipeline
```

When routed, skip detailed wireframes for that screen — mark it `source: dash-forge` and dash-forge's handoff bundle plugs into the Phase 3e punch list directly.

### 3c. Wireframe Mockup Build
Interactive HTML prototypes: clickable navigation, real layout, realistic data,
all states, responsive at 375/768/1280px.

**Realistic data rule:** Mock data must match the domain — real entity names, plausible distributions, realistic volumes. `[1, 2, 3]` arrays and "Customer A / B / C" are failure modes.

**Skip for dash-forge-routed screens** — they're handled separately.

### ★ Design Direction Approval Gate
Write checkpoint: phase "design-approved".

### 3d. Screen & Component Punch List
Exhaustive build checklist: every screen, component, variant, prop, state, interaction.
The punch list IS the scope — if it's not listed, it doesn't get built.

**For dashboard surfaces routed to dash-forge**, the punch list references the dash-forge handoff bundle instead of re-specifying. Format:

```
Screen: Executive Compliance Dashboard
  Source: dash-forge handoff at ./dash-forge-handoff/
  Components: see prototype.tsx + component inventory
  Integration: see integration-notes.md
```

### ★ Punch List Approval Gate
Write checkpoint: phase "punch-list-approved".

---

## Phase 4: Sprint Plan (`/roadmap`)

Convert the punch list and spec into an ordered sprint plan. Each sprint is a coherent,
demoable chunk of work. This replaces both app-architect's old roadmap AND tri-dev's
planner — one sprint plan, one format.

### Sprint Structure

```markdown
## Sprint 1: [Name] — [Goal in one sentence]

### Features
[Which spec features / punch list items this covers]

### Deliverables
- [Specific things to build]

### Test Requirements
- Unit tests for: [core functions/endpoints]
- Integration test for: [key flow]

### Definition of Done
[Testable criteria the Evaluator will grade against]

### Dependencies
[What must exist before this sprint starts]

### Estimated Effort
CLAUDE: [hours] | USER: [hours]
```

### Build Order

Sprints follow the design pipeline's build order:
1. Scaffold + design tokens + base components
2. Composite components + layouts
3. Screen pages from punch list
4. Navigation + routing
5. Backend hookup (auth → reads → writes → real-time → errors)
6. Polish + edge cases + accessibility

### ★ Sprint Plan Approval Gate
Write checkpoint: phase "sprint-plan-approved".

---

## Phase 5: Scaffold (`/scaffold`)

One-time project setup. Read `references/scaffold-guide.md`.

Generates: directory structure, package manifest, config files, .env.example, initial
migrations, test infrastructure, CI/CD config, .gitignore (includes `.checkpoints/`),
README with setup instructions.

Scaffold must be immediately runnable after USER setup tasks (create DB, fill .env, etc).

Write checkpoint: phase "scaffold".

---

## Phase 6: Build Loop (`/build`)

This is the core of the skill. For each sprint from the sprint plan, run a
Generator → Evaluator loop.

### Build Configuration

| Setting | Default |
|---|---|
| max_iterations | 3 |
| pass_threshold | All criteria ≥ 6/10 |
| eval_mode | auto+manual |
| ux_evaluator | auto-attach on UI sprints |

### Step 1: Sprint Contract Negotiation

**Generator proposes** a contract for the current sprint:

```markdown
## Sprint [N] Contract

### Deliverables
- [Specific things to build]

### Testable Criteria
1. [Criterion]: [How to verify]

### Test Requirements
- [ ] Unit tests for: [list]
- [ ] Integration test for: [list]
- [ ] All tests pass before handing off

### Technical Approach
[Brief implementation plan]
```

**Evaluator reviews** and pushes back if:
- Criteria are vague or untestable
- Scope doesn't match the sprint plan
- Test requirements missing or insufficient
- Edge cases not covered

Iterate until aligned. Save to `sprints/sprint-N/contract.md`.

### Step 2: Generator Builds

The Generator implements the sprint against the contract:

- Work through deliverables methodically
- Write tests DURING the build (not after)
- Minimum: 1 happy-path + 1 error-path test per function/endpoint
- Use project's test framework (set up Vitest/pytest if none exists)
- Mock external dependencies
- No snapshot tests, no framework-testing tests
- Self-check against contract before handing off (but don't self-grade)
- If hitting a wall, document the blocker

### Step 3: Evaluator QA

The Evaluator grades the sprint against four criteria with **isolated context** —
it reads the contract and the code fresh, not the generator's exploration.

| Criterion | Weight | Measures |
|---|---|---|
| **Functionality** | 30% | Does it work? Can users complete intended flows? |
| **Feature Completeness** | 30% | Matches the sprint contract deliverables? |
| **Code Quality** | 20% | Clean structure, no anti-patterns, test coverage |
| **Visual/UX Quality** | 20% | Looks intentional, not generic AI slop |

**Test penalty:** < 50% contracted tests delivered → Code Quality capped at 5/10.

**Automated checks:**
- Run full test suite → report pass/fail/skip
- Test failures → Functionality auto-capped at 5/10
- Check coverage if tooling exists
- Start dev server, hit endpoints
- Build errors, lint issues, type errors
- Read code-auditor checkpoint for pre-existing issues

**Manual review:**
- Read code changes
- Check each contract criterion
- Look for stubs, TODOs, half-implementations
- Assess visual quality

**UX Evaluator** (auto-attaches on UI sprints):
If the sprint contract mentions UI/component/screen/page, the UX Engineer's Design
Evaluator also runs. Grades visual hierarchy, state completeness, consistency, and
accessibility. Sprint must pass BOTH evaluators.

**Evaluation report** saved to `sprints/sprint-N/eval-round-M.md`:

```markdown
## Sprint [N] — Evaluation Round [M]

### Code Scores
- Functionality: [X]/10 — [justification]
- Feature Completeness: [X]/10 — [justification]
- Code Quality: [X]/10 — [justification]
- Visual/UX Quality: [X]/10 — [justification]
- **Code Score: [X]/10**

### Design Scores (if UI sprint)
- Visual Hierarchy: [X]/10
- State Completeness: [X]/10
- Consistency: [X]/10
- Accessibility: [X]/10
- **Design Score: [X]/10**

### Test Results
- Tests run: [X passed, Y failed, Z skipped]
- New tests: [count]
- Coverage: [X% or "not measured"]

### Bugs Found
1. [Bug with location and reproduction]

### Gaps vs Contract
1. [Criterion] — [PASS/FAIL] — [Evidence]

### Verdict: PASS / FAIL
[If FAIL: specific, actionable feedback]
```

**Evaluator behaviors:**
- Skeptical by default. Fight the natural tendency to approve mediocre work.
- Never approve "mostly works." Broken core feature = FAIL.
- Specific feedback: "sidebar collapses at 768px because no min-width" not "UI needs work."
- Check the running app, not just the code.
- 5/10 means mediocre. Give it.

### Step 4: Iterate or Advance

- **PASS**: Brief the user, advance to next sprint.
- **FAIL + iterations remaining**: Feed eval report to Generator, fix, re-evaluate.
- **FAIL + max iterations**: Escalate to user with all eval reports.

After each outcome: update checkpoint, suggest git-ops commit if appropriate.

### Scoring Calibration

| Score | Meaning |
|---|---|
| 9-10 | Would impress a senior engineer in review |
| 7-8 | Solid, clean, minor polish items |
| 5-6 | Functional but rough edges |
| 3-4 | Major issues, stubs, broken flows |
| 1-2 | Doesn't run, wrong approach |

---

## Phase 7: Launch (`/launch`)

### Pre-Launch Pipeline

Suggest the full pipeline:
1. `/audit pre-deploy` — quality gate
2. `/git-sync` — commit and push
3. `/deploy staging` — staging + smoke tests
4. `/deploy prod` — production with user confirmation

### Launch Checklist
- [ ] DNS configured
- [ ] SSL/HTTPS working
- [ ] Error monitoring live
- [ ] Database backups verified
- [ ] Rollback plan tested
- [ ] Environment variables set
- [ ] Rate limiting + CORS configured
- [ ] Analytics tracking verified
- [ ] README published
- [ ] User tested production URL

### Post-Launch
- Day 1: Monitor error rates
- Week 1: Review analytics, collect feedback, fix critical issues
- Week 2-4: Address feedback, plan v2
- Monthly: Dependency updates, security patches

Write checkpoint: status "complete".

---

## /status

Read checkpoint. Display compact status:

```
APP ARCHITECT — [project name]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Planning:
  ✅ Discovery
  ✅ Spec + stack-forge (Next.js + Supabase)
  ✅ Design (style book + wireframes approved)
  ✅ Punch list (24 components, 8 screens)
  ✅ Sprint plan (4 sprints)

Build:
  ✅ Scaffold
  ✅ Sprint 1: Auth        8.2/10 (2 rounds) — 12 tests
  🔄 Sprint 2: CRUD API   eval round 1 in progress
  ⏳ Sprint 3: UI
  ⏳ Sprint 4: Polish

Next: Read evaluator report for Sprint 2
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## File Structure

```
project-dir/
├── .checkpoints/
│   └── app-architect.checkpoint.json
├── spec/
│   ├── 00-project-overview.md ... 10-documentation-plan.md
├── design/
│   ├── style-book.html
│   ├── wireframes.html
│   ├── punch-list.md
│   └── component-registry.json
├── sprints/
│   ├── sprint-plan.md
│   ├── sprint-1/
│   │   ├── contract.md
│   │   ├── eval-round-1.md
│   │   └── eval-round-2.md
│   └── sprint-2/ ...
├── checklists/
│   └── launch-checklist.md
├── src/ ...
├── master-spec.docx
└── GOVERNANCE.md
```

---

## Cross-Skill Integration

| Skill | How it connects |
|---|---|
| **stack-forge** | Auto-invoked during Phase 2. Produces stack recommendation that informs all specs. |
| **ux-engineer** | Design Evaluator auto-attaches during UI sprints in Phase 6. Also usable standalone for design iteration. |
| **code-auditor** | Evaluator reads code-auditor checkpoint for pre-existing issues. Phase 7 suggests `/audit pre-deploy`. |
| **git-ops** | Suggested after each sprint passes. Phase 7 suggests `/git-sync`. |
| **deploy-ops** | Phase 7 hands off to deploy pipeline. |
| **integrations-engineer** | Phase 2 spec `04-integrations.md` can trigger integration planning (third-party APIs we *consume*). |
| **api-dev** | Phase 2 spec `02-architecture.md` "API Design" + `03-architecture.md` data model trigger api-dev to elaborate the first-party API contract (OpenAPI/GraphQL, versioning, SDK). |
| **scale-ops** | Phase 2 spec `09-cost-estimate.md` uses scale-ops projections. |
| **reverse-spec** | For existing projects: reverse-spec produces the spec docs, then app-architect picks up at Phase 4 (sprint plan) or Phase 6 (build). |

---

## Quick Start Modes

### Full pipeline (new project)
```
/discover → /spec → /design → /roadmap → /scaffold → /build → /launch
```

### From existing specs (reverse-spec output)
```
/roadmap → /scaffold → /build → /launch
```

### Quick feature (existing project)
```
/build [feature description]
→ Generates sprint plan for just this feature
→ Runs build loop
```

### Spec-only (no build)
```
/discover → /spec → /design → /export-spec
→ Produces master-spec.docx without building
```

---

## PM-Tool MCP Integration (v1.2+)

This skill consumes the patterns defined in `integrations-engineer`'s
"PM-Tool MCP Integration" section. Three phases are PM-aware:

### Phase 1 — `/discover` reads ticket context

If the user's prompt includes a recognised ticket id (or
`/discover --ticket TICKET-1234`):

1. Detect provider from `.opchain/pm.yaml`; default Linear if missing
   and ticket pattern is `[A-Z]+-\d+`.
2. Call `mcp.<provider>.get_issue` for the id.
3. Use `title`, `description`, `labels`, recent comments as discovery
   seed. Treat the ticket as user-authored input — do not skip the
   normal Discovery questions, but pre-fill answers where the ticket
   is explicit, and lead with "the ticket says X — is that still
   correct?" rather than re-asking from scratch.
4. Cite the ticket id in `00-project-overview.md` under "Source ticket".

If the ticket has child tickets (Linear sub-issues, Jira sub-tasks,
GitHub linked issues), fetch them too — they often define the
sprint-level decomposition that Phase 4 wants.

### Phase 4 — `/roadmap` writes sprint plan back

When the sprint plan is approved:

1. For each sprint, compose a structured comment on the source ticket:
   ```
   Sprint N: [Name]
   Deliverables: ...
   Test requirements: ...
   Definition of done: ...
   Effort: CLAUDE Xh / USER Yh
   Generated by app-architect /roadmap on {date}.
   ```
2. Call `add_comment` on the source ticket.
3. If the PM tool supports child tickets and project config has
   `create_child_tickets: true`, create a child ticket per sprint
   linked back to the source.
4. Record the comment id (and child ticket ids, if any) in the
   `app-architect.checkpoint.json` for traceability.

### Phase 6 — `/build` updates sprint state

On each sprint pass / fail:

- Pass → transition the corresponding child ticket to `done`
  (state names from `.opchain/pm.yaml`); add a comment with the
  evaluator score.
- Fail (max iterations) → transition to `blocked` (or
  `needs-attention`); add a comment with the failure summary;
  surface the user-facing escalation as usual.

### Failure modes

- No ticket reference in user prompt → skill operates as v1.1
  (no PM context). Never invents a ticket.
- MCP call fails → log to checkpoint as deferred PM action; user
  can `/roadmap --retry-pm` later. Phase output is unchanged.
- Cross-team scope-violation (broker 403) → surface the error;
  the spec docs and sprint plan are still produced locally.

---

## Principles

1. **Actionability > completeness.** Every output answers "what do I build next?"
2. **Gates in planning, loops in building.** Planning needs human judgment (gates).
   Building needs automated QA (evaluator loops).
3. **One sprint plan, one format.** No duplicate specs. No conflicting roadmaps.
4. **Design before code.** Catch UX problems in HTML prototypes, not React refactors.
5. **Tests during the build.** The Generator writes tests alongside code, not after.
6. **Skeptical evaluation.** The Evaluator's job is to find problems. 5/10 is fine.
7. **Stack decisions are automatic.** Stack-forge runs inside Phase 2, not as a separate step.
8. **Checkpoint at every event.** Session state survives across conversations.
9. **Hand off, don't dead-end.** Every phase suggests the next pipeline step.
10. **Name assumptions.** Hidden assumptions become hidden bugs.

---
name: bug-check
displayName: Bug Check
version: 1.0.0
shortDesc: Pre-commit QA gate — fast checks on every commit.
phases: [build]
triAgent: false
tryable: true
commands:
  - /bugcheck
  - /bugcheck run
  - /bugcheck fix
  - /bugcheck config
  - /bugcheck report
  - /bugcheck history
  - /bugcheck bypass
description: >
  Pre-commit QA gate that runs on every commit. Fast, opinionated checks: type
  safety, lint, tests, anti-pattern scan, secret detection, build verification,
  and dependency vulnerability scan. Blocks commits on failures, warns on cautions,
  passes silently on clean code. Auto-invoked by git-ops before every /git-commit
  and /git-sync. Use for /bugcheck, "check this before I commit", "run the checks",
  "is this safe to commit", "pre-commit", "quick audit", "lint and test", "any bugs
  in this?", "sanity check". Trigger liberally.
---

# Bug Check

**On first invocation, read `references/orchestrator.md` and follow its welcome protocol.**

Fast pre-commit QA gate. Runs in under 2 minutes. Catches the bugs, type errors,
test failures, and anti-patterns that shouldn't make it into a commit — before they
cost real debugging time downstream.

This is NOT code-auditor. Code-auditor runs a deep tri-agent sweep (Auditor → Fixer →
Verifier) that takes 30+ minutes and produces a graded report. Bug-check is the metal
detector at the door — fast, blunt, binary: every check resolves to **PASS** or **FAIL**.
Individual checks may emit advisory **WARN** notes (e.g. "no test suite detected")
that are surfaced in the report but do not affect the gate verdict — only FAIL blocks
the commit.

## /bugcheck — Command Reference

```
BUG CHECK COMMANDS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  GATE
  /bugcheck              Run all checks on staged/changed files
  /bugcheck run          Same as /bugcheck
  /bugcheck run --all    Run on entire codebase (not just changes)
  /bugcheck fix          Auto-fix what's fixable (lint, formatting)

  CONFIG
  /bugcheck config       Show or edit check configuration
  /bugcheck config strict    Enable strict mode (zero warnings allowed)
  /bugcheck config lenient   Allow warnings, block only on errors

  REPORT
  /bugcheck report       Show last run results from checkpoint
  /bugcheck history      Show pass/fail trend from checkpoint

  OVERRIDE
  /bugcheck bypass       Skip gate this once (logs the bypass in checkpoint)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Runs automatically before /git-commit and /git-sync.
```

---

## Session Persistence (Checkpoint Protocol)

Checkpoint: `{project-dir}/.checkpoints/bug-check.checkpoint.json`

### Resume on Start

When `/bugcheck` is invoked:
1. Check for checkpoint
2. If exists: show last verdict, streak, carried debt count
3. If carried debt > 0: surface bypassed issues before running new checks
4. Run the check suite (no "continue/restart" prompt — bug-check always runs fresh)

Bug-check differs from other opchain skills: there's no "resume" decision. The gate
always runs the full check suite. The checkpoint provides context (streak, debt, history),
not resumable state.

---

## How This Skill Fits the Pipeline

```
app-architect /build ──► BUG-CHECK (gate) ──► git-ops /commit ──► deploy-ops
                              │
                         ┌────┴────┐
                         │         │
                      PASS →    FAIL →
                    proceed    block commit,
                    silently   show what broke
```

**Auto-invocation:** git-ops calls bug-check before every `/git-commit` and `/git-sync`.
If bug-check fails, the commit is blocked with a clear failure report. The user can
override with `/bugcheck bypass` (logged, not silent).

**Relationship to code-auditor:** Bug-check is a subset. It runs the checks that are
fast enough for every commit. Code-auditor's deep sweep runs before deploy (gate) or
on demand (ad-hoc). They complement, not compete:

| | Bug Check | Code Auditor |
|---|---|---|
| **When** | Every commit | Before deploy, on demand |
| **Speed** | <2 min | 30+ min |
| **Depth** | Surface: types, lint, tests, patterns | Deep: tri-agent, security, architecture |
| **Verdict** | PASS / FAIL (binary) | Grade A-F (nuanced) |
| **Fixes** | Auto-fix lint/format | Fixer → Verifier loop |
| **Scope** | Changed files by default | Full codebase |

---

## The Check Suite

Seven checks, run in order. Each produces PASS, WARN, or FAIL.

### Check 1: Type Safety

```bash
npx tsc --noEmit
```

| Result | Verdict |
|---|---|
| Exit 0 | PASS |
| Type errors | FAIL — list errors with file:line |

**Why it blocks:** Type errors propagate. A wrong type in a utility function breaks
every consumer. Catching at commit is 10x cheaper than catching at runtime.

### Check 2: Lint

```bash
npx eslint . --ext .ts,.tsx --max-warnings 0
```

| Result | Verdict |
|---|---|
| Exit 0, no warnings | PASS |
| Warnings only | WARN (pass in lenient mode, fail in strict) |
| Errors | FAIL — list errors with file:line |

**Auto-fixable?** Yes. `/bugcheck fix` runs `eslint --fix` and `prettier --write`.

### Check 3: Test Suite

```bash
npx vitest run --reporter=verbose 2>&1
```

| Result | Verdict |
|---|---|
| All pass | PASS (report count: "42 tests passed") |
| Any fail | FAIL — list failing test names + assertion errors |
| No tests found | WARN — "No test suite detected" |

**Why no tests is a warning, not a pass:** Zero tests means zero regression protection.
The warning nudges toward coverage without blocking early-stage commits.

### Check 4: Anti-Pattern Scan

Fast grep-based checks for patterns that indicate bugs, not style preferences:

```bash
# console.log in production code (not test files)
grep -rn "console\.log\b" --include="*.ts" --include="*.tsx" \
  --exclude-dir=test --exclude-dir=__tests__ --exclude-dir=node_modules src/

# Debugger statements
grep -rn "debugger" --include="*.ts" --include="*.tsx" \
  --exclude-dir=node_modules src/

# TODO/FIXME/HACK in changed files
git diff --cached --name-only | xargs grep -n "TODO\|FIXME\|HACK" 2>/dev/null

# .only on test files (focused tests that skip the rest)
grep -rn "\.only\b" --include="*.test.*" --include="*.spec.*" \
  --exclude-dir=node_modules .

# any type in TypeScript (explicit any, not inferred)
grep -rn ": any\b\|as any\b\|<any>" --include="*.ts" --include="*.tsx" \
  --exclude-dir=node_modules --exclude="*.d.ts" src/

# @ts-ignore / @ts-nocheck
grep -rn "@ts-ignore\|@ts-nocheck\|@ts-expect-error" --include="*.ts" --include="*.tsx" \
  --exclude-dir=node_modules src/

# Empty catch blocks
grep -rn "catch.*{[[:space:]]*}" --include="*.ts" --include="*.tsx" \
  --exclude-dir=node_modules src/
```

| Pattern | Verdict | Rationale |
|---|---|---|
| `console.log` in src/ | WARN | Debug artifact, remove before commit |
| `debugger` | FAIL | Will pause execution in production |
| `.only` in tests | FAIL | Silently skips other tests |
| Explicit `any` | WARN | Type safety hole |
| `@ts-ignore` | WARN | Suppressed type error may hide real bug |
| Empty catch `{}` | WARN | Swallowed error, invisible failure |
| `TODO`/`FIXME` in diff | WARN | Acknowledged tech debt in new code |

### Check 5: Secret Detection

```bash
# API keys, tokens, passwords in source
grep -rn --include="*.ts" --include="*.tsx" --include="*.js" --include="*.json" \
  -E "(api[_-]?key|secret|password|token|credential).*['\"][A-Za-z0-9+/=]{16,}['\"]" \
  --exclude-dir=node_modules --exclude=".env*" .

# AWS-style keys
grep -rn -E "AKIA[0-9A-Z]{16}" --exclude-dir=node_modules .

# Private keys
grep -rn "BEGIN (RSA |EC |DSA )?PRIVATE KEY" --exclude-dir=node_modules .

# Common service prefixes
grep -rn -E "(sk-|sk_live_|pk_live_|ghp_|gho_|github_pat_)" \
  --exclude-dir=node_modules --exclude=".env*" .
```

| Result | Verdict |
|---|---|
| No matches | PASS |
| Any match | FAIL — **always blocks**, no override without `/bugcheck bypass` |

**Why secrets are always FAIL:** A committed secret is a security incident. There's
no "warning" threshold for leaked credentials.

### Check 6: Build Verification

```bash
npm run build 2>&1
```

| Result | Verdict |
|---|---|
| Exit 0 | PASS |
| Build failure | FAIL — show error output |
| No build script | PASS (skip) |

### Check 7: Dependency Vulnerability Scan

```bash
npm audit --audit-level=critical 2>&1
```

| Result | Verdict |
|---|---|
| No critical/high | PASS |
| High vulnerabilities | WARN |
| Critical vulnerabilities | FAIL |

---

## Verdicts

The gate produces one of three verdicts:

### PASS

All checks pass. No output needed — silence is the signal. Git-ops proceeds to commit.

```
BUG CHECK — PASS ✅
━━━━━━━━━━━━━━━━━━━━
  7 checks passed (1.2s)
  Proceeding to commit.
```

### WARN

No blocking issues, but warnings exist. Show them briefly, proceed to commit.

```
BUG CHECK — PASS with warnings ⚠️
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  ⚠️ 2 console.log statements in src/routes/users.ts:14, src/lib/utils.ts:28
  ⚠️ 1 TODO in src/middleware/auth.ts:42
  ⚠️ npm audit: 1 high vulnerability in lodash (update recommended)

  5 checks passed, 2 warnings. Proceeding to commit.
```

In strict mode, warnings become failures.

### FAIL

Blocking issues found. Commit is blocked. Show what broke with actionable fixes.

```
BUG CHECK — FAIL ❌
━━━━━━━━━━━━━━━━━━━━
  ❌ TypeScript: 3 errors
     src/routes/users.ts:14 — Type 'string' is not assignable to type 'number'
     src/lib/auth.ts:28 — Property 'userId' does not exist on type 'Session'
     src/db/schema.ts:42 — Cannot find module 'drizzle-orm/sqlite-core'

  ❌ Tests: 2 failing
     GET /api/users — expected 200, got 500
     auth middleware — session token validation fails

  ❌ Secret detected
     src/config.ts:8 — possible API key: sk_live_...

  Fix these before committing. Run /bugcheck fix for auto-fixable issues.
```

---

## Auto-Fix (`/bugcheck fix`)

Fixes what's auto-fixable, then re-runs the check suite:

```bash
# Fix lint errors
npx eslint . --ext .ts,.tsx --fix

# Fix formatting
npx prettier --write "src/**/*.{ts,tsx}"

# Re-run checks
/bugcheck run
```

**What's auto-fixable:**

| Check | Auto-fixable? |
|---|---|
| Type errors | No — requires code changes |
| Lint errors | Partially — style rules yes, logic rules no |
| Formatting | Yes |
| Test failures | No — requires debugging |
| Anti-patterns | `console.log` removal: only if `src/lib/logger.ts` exists (structured logger available as replacement). Others: no |
| Secrets | No — requires manual removal + rotation |
| Build errors | No |
| Dep vulnerabilities | Partially — `npm audit fix` for compatible updates |

---

## Bypass Protocol (`/bugcheck bypass`)

Sometimes you need to commit WIP or unblock a pipeline. `/bugcheck bypass` allows it,
but with accountability:

1. User confirms they want to bypass
2. Bug-check logs the bypass in the checkpoint: which checks failed, when, who bypassed
3. The commit message gets a `[BYPASS]` prefix: `[BYPASS] feat(auth): WIP session handling`
4. Next `/bugcheck run` shows: "Last commit bypassed gate — N issues carried forward"

**Bypass is NOT silent.** It creates visible debt that surfaces on every subsequent run
until resolved. This prevents bypass-as-habit.

### Bypass Tracking

```json
{
  "bypasses": [
    {
      "at": "2026-04-23T15:30:00Z",
      "commit": "abc1234",
      "failed_checks": ["type_safety", "tests"],
      "reason": "WIP — types incomplete, will fix in next commit"
    }
  ]
}
```

---

## Configuration (`/bugcheck config`)

Stored in `.bugcheck.json` at project root:

```json
{
  "mode": "lenient",
  "checks": {
    "type_safety": { "enabled": true, "verdict_on_fail": "FAIL" },
    "lint": { "enabled": true, "verdict_on_fail": "FAIL", "warnings_as": "WARN" },
    "tests": { "enabled": true, "verdict_on_fail": "FAIL", "no_tests_as": "WARN" },
    "anti_patterns": {
      "enabled": true,
      "console_log": "WARN",
      "debugger": "FAIL",
      "test_only": "FAIL",
      "explicit_any": "WARN",
      "ts_ignore": "WARN",
      "empty_catch": "WARN",
      "todo_in_diff": "WARN"
    },
    "secrets": { "enabled": true, "verdict_on_fail": "FAIL" },
    "build": { "enabled": true, "verdict_on_fail": "FAIL" },
    "dependencies": { "enabled": true, "critical_as": "FAIL", "high_as": "WARN" }
  },
  "scope": "changed",
  "auto_fix_on_fail": false
}
```

### Modes

| Mode | Behavior |
|---|---|
| **lenient** (default) | Warnings don't block. Good for active development. |
| **strict** | Warnings become failures. Good for pre-merge or production branches. |

### Per-Project Overrides

Projects can override individual check verdicts. Example: a prototype with no tests
can set `"no_tests_as": "PASS"` to suppress the warning. But secrets are never
configurable — they always FAIL.

---

## Scope: Changed vs. All

By default, bug-check only checks **changed files** (staged + unstaged changes).
This keeps runs fast (<30s for typical commits).

**Scope-aware vs. full-project checks:** Not all checks support file-level scoping.
Type safety (`tsc --noEmit`) and build verification always process the full project
because TypeScript and bundlers resolve the complete dependency graph. The "changed
files" scope applies to lint (via `--file` flag where supported), anti-patterns,
secrets, and tests (via `--changed` or related-test detection).

`/bugcheck run --all` checks the entire codebase explicitly. Use for:
- First run on a new project
- Before a major release
- After merging a large PR
- When code-auditor's last checkpoint is stale

### Detecting Changed Files

```bash
# Staged files
git diff --cached --name-only --diff-filter=ACMR | grep -E '\.(ts|tsx|js|jsx)$'

# All changed (staged + unstaged)
git diff --name-only --diff-filter=ACMR HEAD | grep -E '\.(ts|tsx|js|jsx)$'

# If no git context (new project, no commits)
# Fall back to --all mode
```

---

## Git-Ops Integration

### Auto-Invocation

When git-ops receives `/git-commit` or `/git-sync`:

1. Check for `.bugcheck.json` at project root (or use defaults)
2. Run `/bugcheck run`
3. If PASS or WARN (lenient mode): proceed to commit
4. If FAIL: block commit, show failure report, suggest `/bugcheck fix`
5. User can `/bugcheck bypass` to force, or fix and re-run

### Commit Message Annotation

If bug-check ran and passed, git-ops appends to the commit footer:

```
bugcheck: pass (7/7, 0 warnings, 1.2s)
```

If bypassed:

```
bugcheck: bypassed (type_safety FAIL, tests FAIL)
```

This creates an audit trail in git history.

---

## Checkpoint Schema

Extends the session persistence section above with full schema details.

| Field | Purpose |
|---|---|
| `last_run` | Timestamp + verdict + duration + per-check results |
| `run_history` | Last 10 runs with verdicts (trend tracking) |
| `bypasses` | Every bypass with failed checks and reason |
| `carried_debt` | Issues from bypassed commits still unresolved |
| `config_hash` | Hash of `.bugcheck.json` to detect config drift |

### skill_state

```json
{
  "last_run": {
    "at": "2026-04-23T15:30:00Z",
    "verdict": "PASS",
    "duration_ms": 1200,
    "checks": {
      "type_safety": "PASS",
      "lint": "PASS",
      "tests": "PASS",
      "anti_patterns": "WARN",
      "secrets": "PASS",
      "build": "PASS",
      "dependencies": "PASS"
    },
    "warnings": 2,
    "errors": 0
  },
  "run_history": [
    { "at": "2026-04-23T15:30:00Z", "verdict": "PASS", "warnings": 2 },
    { "at": "2026-04-23T14:00:00Z", "verdict": "FAIL", "errors": 3 },
    { "at": "2026-04-22T16:00:00Z", "verdict": "PASS", "warnings": 0 }
  ],
  "bypasses": [],
  "carried_debt": 0,
  "streak": { "passes": 5, "since": "2026-04-20T10:00:00Z" }
}
```

### Cross-Skill Reads

| Reads from | Why |
|---|---|
| code-auditor | Known findings → don't re-report what code-auditor already flagged |
| app-architect | Sprint contract → know which files are in-scope for this commit |
| deploy-ops | Environment config → which build command to use |

| Read by | Why |
|---|---|
| git-ops | Gate verdict → commit or block |
| code-auditor | Bug-check pass rate → skip basic checks in deep audit |
| deploy-ops | Last bug-check status → deploy confidence |
| orchestrator | Pass/fail trend, carried debt → project health |

---

## Streak Tracking

Bug-check tracks consecutive passes as a streak. This is a dopamine hack — seeing
"12 clean commits in a row" creates positive momentum.

```
BUG CHECK — PASS ✅  (streak: 12)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  7 checks passed (0.9s)
```

A bypass or fail resets the streak. The highest streak is preserved in the checkpoint
for bragging rights.

---

## Report (`/bugcheck report`)

Shows the last run and trend:

```
BUG CHECK REPORT — [project]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Last run:     2 min ago — PASS ✅
  Streak:       12 clean commits
  Carried debt: 0 (no bypass backlog)

  Last 10 runs:
    ✅ ✅ ✅ ❌ ✅ ✅ ✅ ⚠️ ✅ ✅

  Most common failure: type_safety (3 of last 20 fails)
  Auto-fix rate: 60% of warnings resolved by /bugcheck fix
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## Stack-Specific Adaptations

Bug-check auto-detects the stack from config files and adapts:

| Stack | Type Check | Lint | Test | Build |
|---|---|---|---|---|
| TypeScript (Hono, React, Next.js) | `tsc --noEmit` | `eslint` | `vitest run` | `npm run build` |
| Python (FastAPI) | `mypy .` or `pyright .` | `ruff check .` | `pytest` | N/A |
| Go | `go vet ./...` | `golangci-lint run` | `go test ./...` | `go build ./...` |

If no recognized stack is detected, bug-check runs only the universal checks:
anti-patterns, secrets, and dependency scan.

### Python Adaptations

```bash
# Type check
mypy . --ignore-missing-imports 2>&1 || pyright . 2>&1

# Lint
ruff check . 2>&1

# Tests
python -m pytest --tb=short 2>&1

# Anti-patterns
grep -rn "import pdb\|breakpoint()" --include="*.py" --exclude-dir=venv .
grep -rn "print(" --include="*.py" --exclude-dir=venv --exclude-dir=test .
```

---

## Principles

1. **Fast or useless.** If bug-check takes >2 minutes, developers will bypass it
   every time. Speed is the feature.
2. **Binary verdict.** Pass or fail. No grades, no nuance, no "mostly good." That's
   code-auditor's job.
3. **Changed files by default.** Checking the whole codebase on every commit is slow
   and noisy. Check what changed. Run `--all` periodically.
4. **Secrets always block.** There is no "warning" for leaked credentials. This is
   the one check with no configurable severity.
5. **Bypass is accountable, not forbidden.** Sometimes you need to commit WIP. The
   system tracks it and reminds you until the debt is resolved.
6. **Silence is success (with one exception).** A passing gate should be invisible.
   The streak counter is the deliberate exception — a small dopamine reward for
   maintaining quality momentum. Everything else stays quiet on pass.
7. **Complement, don't compete.** Bug-check catches the easy stuff fast. Code-auditor
   catches the hard stuff thoroughly. Both have a job.

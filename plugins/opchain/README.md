# opchain (Claude Code plugin)

The opchain skill pipeline **plus the gates that enforce it**.

## Why this exists

opchain shipped as a zip of markdown. Markdown cannot enforce anything, and the
measurement was unambiguous: across 87 transcripts and 23 days, **zero** skills
invoked another skill autonomously. `oc-git-ops` fired 0 times while `git commit`
ran 290 times. Cross-skill "auto-invokes" declarations — 21 of them — never fired
once.

The cause was not weak wording. `oc-git-ops/SKILL.md:223` says, imperatively:
*"**Before staging files or running `git commit`, invoke the oc-bug-check skill.**"*
That text was loaded in full, in context, immediately before seven commits and a
PR — and nothing happened. Prose in a file read once does not bind a running agent.

One thing did work: a `PreToolUse` hook that blocked `git commit`. It worked every
time, because it is not a suggestion. But it lived in opchain's own
`.claude/settings.json`, registered by a repo-relative path, and
`make-skills-zip.sh` never packaged it — so it protected exactly one repository on
earth while every SKILL.md told users the safety net was there.

This plugin ships the mechanism instead of describing it.

## What you get

| | skills zip | this plugin |
|---|---|---|
| 29 skills | ✅ | ✅ |
| Commit gate that actually blocks | ❌ | ✅ |
| Pipeline state injected at session start | ❌ | ✅ |
| Real slash commands | ❌ (192 declared, 0 registered) | ✅ |

## Install

```
/plugin marketplace add asfbay-bit/opchain-skills
/plugin install opchain
```

## The gates

**`PreToolUse` → commit gate** (`hooks/pre-commit-gate.cjs`). Blocks `git commit`
unless oc-bug-check recorded a PASS *for the tree you are committing*.

- **Node, not bash+jq.** The repo-local ancestor soft-skipped when `jq` was
  missing, so a fresh container silently had no gate. Claude Code runs on Node.
- **Tree-bound verdicts.** A checkpoint is written by the agent, and
  `write_checkpoint` is a public MCP tool — a bare `verdict: PASS` is
  self-attestation, not evidence. The verdict is bound to `git write-tree` output,
  so re-staging different code invalidates it automatically. A forged or stale
  PASS is *non-matching*, not merely old.
- **Opt-in per repo.** Plugins install globally. A gate that denies commits in
  every repo gets uninstalled within a day, taking the protection with it. Only
  repos with `.checkpoints/` or `.opchain/` are gated (override: `OPCHAIN_GATE=1`).
- **Command-position matching.** `echo "git commit"` and `grep -rn 'git commit'`
  are not commits. The ancestor matched them by substring; false positives train
  people to bypass, which costs you the true positives too.
- **UNSUPPORTED ≠ PASS.** A gate that could not read your stack must not report
  green.

**`SessionStart` → pipeline state** (`hooks/session-state.cjs`). Computes and
injects what `CLAUDE.md` merely *asks* someone to go run:

```
opchain pipeline state (from .checkpoints/, computed at session start):
  repo: main @ 85abb64 (last tag v1.8.1)
  open findings: oc-code-auditor: 14 critical / 41 high open — but marked complete
  stale checkpoints: oc-orchestrator (complete, 30d), oc-git-ops (complete, 30d), …
```

Silent when there is nothing to say. An empty nudge every session is how nudges
get ignored.

## Honest limits

- **Claude Code only.** A second agent (Codex authored 78 of 101 commits in one
  audited repo) never sees a `PreToolUse` hook. CI is the only cross-agent
  enforcer, and it is post-hoc: the unverified commit gets written, it just cannot
  merge.
- **Gate edges only.** A hook can intercept `git commit`. Nothing intercepts "you
  are about to design a screen, consult ux-engineer" — there is no tool call to
  hang it on. Composition skills stay user-invoked; the commands make them
  reachable, not automatic.
- **`--no-verify` still works,** deliberately. A gate with no escape hatch gets
  uninstalled. It logs to stderr.

## Testing

```
node hooks/test-gate.cjs
```

The harness distinguishes ALLOW from CRASHED — a hook that throws writes nothing
to stdout, and "nothing on stdout" is how a hook says *allow*. A broken gate looks
exactly like a passing one. That fail-open silently neutered this gate for its
first three test runs; the suite exists so it cannot happen again.

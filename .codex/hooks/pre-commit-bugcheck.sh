#!/usr/bin/env bash
# .claude/hooks/pre-commit-bugcheck.sh
#
# PreToolUse hook for the Bash tool. Blocks `git commit` calls unless
# bug-check has run recently with a PASS verdict (or a logged bypass).
# The Stop hook (checkpoint-hygiene.sh) is post-hoc; this hook is the
# real gate.
#
# Reads stdin JSON: { tool_name, tool_input: { command }, cwd, ... }
# Outputs JSON on block: { "decision": "block", "reason": "..." }
# Exits 0 silently when the call is allowed.
#
# Allow rules:
#   - command doesn't match `git commit` → allow
#   - bug-check checkpoint exists, status=complete, last_run_verdict=PASS,
#     updated_at within 10 minutes → allow
#   - bug-check checkpoint has skill_state.bypass=true and bypass is fresh
#     (within 10 minutes) → allow
#   - all other cases → block with a reason that tells the assistant
#     to invoke bug-check first
#
# Dependencies: bash, jq, date, grep. `command -v` guards make a missing
# dep a soft skip (allow), since we don't want a missing dep to silently
# wedge every commit.

set -euo pipefail

# Soft-skip if dependencies are missing — don't wedge commits on a
# fresh container that lacks jq.
if ! command -v jq >/dev/null 2>&1; then
  exit 0
fi

INPUT="$(cat)"
TOOL_NAME="$(jq -r '.tool_name // empty' <<<"$INPUT")"
COMMAND="$(jq -r '.tool_input.command // empty' <<<"$INPUT")"
PROJECT_DIR="$(jq -r '.cwd // empty' <<<"$INPUT")"
PROJECT_DIR="${PROJECT_DIR:-$(pwd)}"

# Only gate Bash invocations.
if [[ "$TOOL_NAME" != "Bash" ]]; then
  exit 0
fi

# Match `git commit` at start of command, or chained after && / ; / | with
# leading whitespace. Common patterns:
#   git commit -m "..."
#   git add . && git commit -m "..."
#   cd foo; git commit
# Excludes `git commit-tree`, `git commit-graph` (different subcommands).
if ! grep -qE '(^|[[:space:];|&])git[[:space:]]+commit([[:space:]]|$)' <<<"$COMMAND"; then
  exit 0
fi

# Allow `git commit --amend` only if the assistant explicitly passes
# --no-verify-bugcheck (escape hatch for fixing pre-commit hook output).
# This is intentionally undocumented to discourage casual use.
if grep -qE -- '--no-verify-bugcheck\b' <<<"$COMMAND"; then
  exit 0
fi

CHECKPOINT="$PROJECT_DIR/.checkpoints/bug-check.checkpoint.json"

block() {
  local reason="$1"
  jq -n --arg reason "$reason" '{
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: $reason
    }
  }'
  exit 0
}

if [[ ! -f "$CHECKPOINT" ]]; then
  block "Pre-commit gate: bug-check has not run in this project. Invoke the bug-check skill before committing:

  Skill(skill=\"bug-check\", args=\"/bugcheck run\")

If bug-check returns PASS, retry the commit. If FAIL, fix the surfaced issues or run \`/bugcheck bypass\` (logged) before committing."
fi

# Read verdict and timestamp from skill_state.last_run (canonical
# bug-check schema, see skills/bug-check/SKILL.md "Checkpoint Schema").
VERDICT="$(jq -r '.skill_state.last_run.verdict // empty' "$CHECKPOINT" 2>/dev/null || echo "")"
LAST_AT="$(jq -r '.skill_state.last_run.at // .updated_at // empty' "$CHECKPOINT" 2>/dev/null || echo "")"

# A fresh bypass entry (within 10min) clears the gate. The bypasses[]
# array is append-only; check the last entry.
BYPASS_AT="$(jq -r '(.skill_state.bypasses // []) | last | .at // empty' "$CHECKPOINT" 2>/dev/null || echo "")"

if [[ -z "$LAST_AT" ]]; then
  block "Pre-commit gate: bug-check checkpoint exists but skill_state.last_run.at is missing. Run /bugcheck before committing."
fi

# Compute age in seconds. GNU date and BSD date have different flags; try both.
NOW_EPOCH="$(date -u +%s)"
parse_iso() {
  local ts="$1"
  date -u -d "$ts" +%s 2>/dev/null \
    || date -u -j -f "%Y-%m-%dT%H:%M:%SZ" "${ts%.*Z}Z" +%s 2>/dev/null \
    || echo "0"
}
LAST_EPOCH="$(parse_iso "$LAST_AT")"

if [[ "$LAST_EPOCH" == "0" ]]; then
  block "Pre-commit gate: cannot parse bug-check last_run.at='$LAST_AT'. Re-run /bugcheck."
fi

MAX_AGE=600  # 10 minutes

# Fresh bypass clears the gate.
if [[ -n "$BYPASS_AT" ]]; then
  BYPASS_EPOCH="$(parse_iso "$BYPASS_AT")"
  if [[ "$BYPASS_EPOCH" != "0" ]] && [[ $((NOW_EPOCH - BYPASS_EPOCH)) -le "$MAX_AGE" ]]; then
    exit 0
  fi
fi

AGE=$((NOW_EPOCH - LAST_EPOCH))
if [[ "$AGE" -gt "$MAX_AGE" ]]; then
  block "Pre-commit gate: last bug-check run was $((AGE / 60)) minutes ago (max age 10min). Re-run:

  Skill(skill=\"bug-check\", args=\"/bugcheck run\")

before retrying the commit."
fi

if [[ "$VERDICT" != "PASS" ]]; then
  block "Pre-commit gate: bug-check last verdict is '${VERDICT:-unknown}', not PASS. Fix the failing checks (or run \`/bugcheck bypass\` to override with a logged bypass) before committing."
fi

# Verdict=PASS, fresh, no bypass needed → allow the commit.
exit 0

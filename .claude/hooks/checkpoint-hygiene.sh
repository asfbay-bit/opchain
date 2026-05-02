#!/usr/bin/env bash
# .claude/hooks/checkpoint-hygiene.sh
#
# Stop hook: enforces that any opchain skill invoked this session has a
# matching .checkpoints/<skill>.checkpoint.json file. Read-only sessions
# (no opchain skill activity) pass silently. Built-in / non-opchain skills
# (e.g. update-config, orchestrator, checkpoint-protocol) are not enforced.
#
# Reads stdin JSON: { session_id, transcript_path, cwd, ... }
# Outputs JSON on block: { "decision": "block", "reason": "..." }
# Exits 0 silently when nothing is missing.

set -euo pipefail

# Soft-skip if jq is missing — we'd rather let a session end than wedge
# it on a missing dep. The CI validator (npm run checkpoint:validate)
# is the backstop.
if ! command -v jq >/dev/null 2>&1; then
  exit 0
fi

INPUT="$(cat)"
TRANSCRIPT_PATH="$(jq -r '.transcript_path // empty' <<<"$INPUT")"
PROJECT_DIR="$(jq -r '.cwd // empty' <<<"$INPUT")"
PROJECT_DIR="${PROJECT_DIR:-$(pwd)}"

# Bail silently if no transcript (ephemeral / SDK / CI). Without a transcript
# we can't tell which skills were invoked, so enforcement would be a guess.
if [[ -z "$TRANSCRIPT_PATH" || ! -f "$TRANSCRIPT_PATH" ]]; then
  exit 0
fi

CHECKPOINT_DIR="$PROJECT_DIR/.checkpoints"

# Skills expected to write checkpoints. orchestrator is excluded — its own
# SKILL.md says it's read-only. checkpoint-protocol is excluded — it's the
# meta-protocol with no own state.
ENFORCED_SKILLS=(
  api-dev
  app-architect
  bug-check
  code-auditor
  dash-forge
  deploy-ops
  git-ops
  integrations-engineer
  migration-ops
  monitoring-ops
  reverse-spec
  scale-ops
  security-auditor
  stack-forge
  ux-engineer
)

# Find skills invoked in this session's transcript. Use jq to parse each
# JSONL line as a structured object — match only entries where
# .message.content[*].type == "tool_use" AND .name == "Skill" AND
# .input.skill == <skill>. Substring matching on raw lines was brittle:
# any prose containing both '"name":"Skill"' and '"skill":"<name>"' would
# false-positive.
#
# Empty/unparseable lines are tolerated via `?` in the path expressions.
INVOKED_RAW=$(jq -r '
  .message.content[]?
  | select(.type == "tool_use" and .name == "Skill")
  | .input.skill // empty
' "$TRANSCRIPT_PATH" 2>/dev/null | sort -u || true)

INVOKED=()
for skill in "${ENFORCED_SKILLS[@]}"; do
  if grep -Fxq -- "$skill" <<<"$INVOKED_RAW"; then
    INVOKED+=("$skill")
  fi
done

if [[ ${#INVOKED[@]} -eq 0 ]]; then
  exit 0  # Read-only / conversational session.
fi

# Each invoked skill must have a checkpoint file at the expected path.
# Existence is the floor — freshness/staleness checks are deliberately
# skipped to avoid false positives. The dogfooding goal is "you wrote at
# least one checkpoint", not "you wrote one in the last N minutes".
MISSING=()
for skill in "${INVOKED[@]}"; do
  if [[ ! -f "$CHECKPOINT_DIR/${skill}.checkpoint.json" ]]; then
    MISSING+=("$skill")
  fi
done

if [[ ${#MISSING[@]} -eq 0 ]]; then
  exit 0
fi

# Block the stop. Emit JSON on stdout — the harness shows `reason` to the
# assistant as a system-reminder so it can write the missing checkpoints
# and try again.
#
# We point at `node scripts/checkpoint.mjs update` (the canonical writer
# that validates + auto-stamps updated_at) rather than the per-skill
# .sh writers, which do shallow merges with no schema validation and
# can produce checkpoints that CI's validator then rejects.
LIST=$(printf -- "  - %s\n" "${MISSING[@]}")
REASON=$(cat <<EOF
Checkpoint hygiene: the following opchain skills were invoked this session but have no checkpoint at .checkpoints/<skill>.checkpoint.json:

${LIST}
Write each checkpoint with the canonical CLI before ending the session:

  node scripts/checkpoint.mjs update <skill> \\
    --status=complete \\
    --phase=<phase> \\
    --step=<step> \\
    --progress_summary='<one paragraph>'

This validates the schema, stamps updated_at, and is the same tool CI runs in npm run checkpoint:validate. The .checkpoints/ directory is tracked in git so the next session can resume from the prior session's next_actions[0].
EOF
)

jq -n --arg reason "$REASON" '{decision:"block", reason:$reason}'

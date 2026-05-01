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
#
# Dependencies: bash, jq, grep. Portable across macOS + Linux.

set -euo pipefail

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

# Find skills invoked in this session's transcript. The harness logs a
# "Launching skill: <name>" line when a skill loads, and Skill tool-use
# entries also include the skill name. Either signal counts.
INVOKED=()
for skill in "${ENFORCED_SKILLS[@]}"; do
  if grep -q -E "(Launching skill: ${skill}\b|\"skill\"[[:space:]]*:[[:space:]]*\"${skill}\")" "$TRANSCRIPT_PATH" 2>/dev/null; then
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
LIST=$(printf -- "  - %s\n" "${MISSING[@]}")
REASON=$(cat <<EOF
Checkpoint hygiene: the following opchain skills were invoked this session but have no checkpoint at .checkpoints/<skill>.checkpoint.json:

${LIST}
Run .claude/skills/<skill>/scripts/checkpoint.sh write <project-dir> <skill> '<json>' for each before ending the session. The .checkpoints/ directory is gitignored, so this is a local-only state file.
EOF
)

jq -n --arg reason "$REASON" '{decision:"block", reason:$reason}'

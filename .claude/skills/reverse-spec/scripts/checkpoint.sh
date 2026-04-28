#!/usr/bin/env bash
# checkpoint.sh — Cross-skill checkpoint read/write utility
# Usage:
#   checkpoint.sh write <project-dir> <skill-name> <json-string>
#   checkpoint.sh read  <project-dir> <skill-name>
#   checkpoint.sh status <project-dir> [skill-name]
#   checkpoint.sh list  <project-dir>
#   checkpoint.sh reset <project-dir> <skill-name>
#   checkpoint.sh exists <project-dir> <skill-name>  (exit 0 if exists, 1 if not)

set -euo pipefail

CMD="${1:-help}"
PROJECT_DIR="${2:-}"
SKILL="${3:-}"

CHECKPOINT_DIR="${PROJECT_DIR}/.checkpoints"

case "$CMD" in
  write)
    JSON_DATA="${4:-}"
    if [[ -z "$PROJECT_DIR" || -z "$SKILL" || -z "$JSON_DATA" ]]; then
      echo "Usage: checkpoint.sh write <project-dir> <skill-name> '<json>'" >&2
      exit 1
    fi
    mkdir -p "$CHECKPOINT_DIR"
    FILE="${CHECKPOINT_DIR}/${SKILL}.checkpoint.json"
    # Validate JSON before writing
    if ! echo "$JSON_DATA" | python3 -m json.tool > /dev/null 2>&1; then
      echo "ERROR: Invalid JSON provided" >&2
      exit 1
    fi
    # Merge with existing if present (updated_at always refreshed)
    if [[ -f "$FILE" ]]; then
      python3 -c "
import json, sys
existing = json.load(open('$FILE'))
incoming = json.loads(sys.argv[1])
existing.update(incoming)
print(json.dumps(existing, indent=2))
" "$JSON_DATA" > "${FILE}.tmp" && mv "${FILE}.tmp" "$FILE"
    else
      echo "$JSON_DATA" | python3 -m json.tool > "$FILE"
    fi
    echo "Checkpoint written: $FILE"
    ;;

  read)
    if [[ -z "$PROJECT_DIR" || -z "$SKILL" ]]; then
      echo "Usage: checkpoint.sh read <project-dir> <skill-name>" >&2
      exit 1
    fi
    FILE="${CHECKPOINT_DIR}/${SKILL}.checkpoint.json"
    if [[ -f "$FILE" ]]; then
      cat "$FILE"
    else
      echo "No checkpoint found for skill '$SKILL' in $PROJECT_DIR" >&2
      exit 1
    fi
    ;;

  status)
    if [[ -z "$PROJECT_DIR" ]]; then
      echo "Usage: checkpoint.sh status <project-dir> [skill-name]" >&2
      exit 1
    fi
    if [[ -n "$SKILL" ]]; then
      # Single skill status
      FILE="${CHECKPOINT_DIR}/${SKILL}.checkpoint.json"
      if [[ -f "$FILE" ]]; then
        python3 -c "
import json
cp = json.load(open('$FILE'))
print(f\"Skill:    {cp.get('skill', '?')}\")
print(f\"Project:  {cp.get('project', '?')}\")
print(f\"Phase:    {cp.get('phase', '?')}\")
print(f\"Step:     {cp.get('step', '?')}\")
print(f\"Status:   {cp.get('status', '?')}\")
print(f\"Updated:  {cp.get('updated_at', '?')}\")
print(f\"Summary:  {cp.get('progress_summary', '—')}\")
print()
table = cp.get('progress_table', [])
if table:
    icons = {'complete':'✅','in_progress':'🔄','not_started':'⏳','blocked':'🚫','failed':'❌'}
    for row in table:
        icon = icons.get(row.get('status',''), '?')
        print(f\"  {icon} {row.get('label', row.get('id','?'))}\")
print()
actions = cp.get('next_actions', [])
if actions:
    print('Next actions:')
    for i, a in enumerate(actions, 1):
        print(f'  {i}. {a}')
"
      else
        echo "No checkpoint for '$SKILL'" >&2
        exit 1
      fi
    else
      # All skills status
      if [[ -d "$CHECKPOINT_DIR" ]]; then
        for f in "$CHECKPOINT_DIR"/*.checkpoint.json; do
          [[ -f "$f" ]] || continue
          python3 -c "
import json, os
cp = json.load(open('$f'))
icons = {'in_progress':'🔄','blocked':'🚫','complete':'✅','failed':'❌'}
status = cp.get('status','?')
icon = icons.get(status, '?')
print(f\"{icon} {cp.get('skill','?'):20s} {status:14s} {cp.get('progress_summary','—')[:60]}\")
" "$f"
        done
      else
        echo "No checkpoints directory in $PROJECT_DIR"
      fi
    fi
    ;;

  list)
    if [[ -z "$PROJECT_DIR" ]]; then
      echo "Usage: checkpoint.sh list <project-dir>" >&2
      exit 1
    fi
    if [[ -d "$CHECKPOINT_DIR" ]]; then
      for f in "$CHECKPOINT_DIR"/*.checkpoint.json; do
        [[ -f "$f" ]] || continue
        basename "$f" .checkpoint.json
      done
    else
      echo "No checkpoints directory in $PROJECT_DIR"
    fi
    ;;

  reset)
    if [[ -z "$PROJECT_DIR" || -z "$SKILL" ]]; then
      echo "Usage: checkpoint.sh reset <project-dir> <skill-name>" >&2
      exit 1
    fi
    FILE="${CHECKPOINT_DIR}/${SKILL}.checkpoint.json"
    if [[ -f "$FILE" ]]; then
      BACKUP="${FILE}.$(date +%Y%m%d-%H%M%S).bak"
      mv "$FILE" "$BACKUP"
      echo "Archived: $BACKUP"
    else
      echo "No checkpoint to reset for '$SKILL'"
    fi
    ;;

  exists)
    if [[ -z "$PROJECT_DIR" || -z "$SKILL" ]]; then
      exit 1
    fi
    FILE="${CHECKPOINT_DIR}/${SKILL}.checkpoint.json"
    [[ -f "$FILE" ]] && exit 0 || exit 1
    ;;

  help|*)
    cat <<'EOF'
checkpoint.sh — Cross-skill checkpoint utility

Commands:
  write  <dir> <skill> '<json>'   Write/merge checkpoint
  read   <dir> <skill>            Read checkpoint (stdout)
  status <dir> [skill]            Show progress summary
  list   <dir>                    List all skill checkpoints
  reset  <dir> <skill>            Archive and clear checkpoint
  exists <dir> <skill>            Exit 0 if checkpoint exists

Examples:
  checkpoint.sh status /home/claude/gtrack
  checkpoint.sh read /home/claude/gtrack tri-dev
  checkpoint.sh reset /home/claude/gtrack app-architect
EOF
    ;;
esac

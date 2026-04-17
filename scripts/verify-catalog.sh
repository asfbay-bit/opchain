#!/usr/bin/env bash
# Verify the three sources of truth for the skill catalog are in sync.
# Replaces itself with a typed content collection in Sprint 1.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

cd "$ROOT"

# 1. IDs from skills/<id>/SKILL.md (the product source of truth).
fs_ids=()
for d in skills/*/; do
  [[ -f "${d}SKILL.md" ]] || continue
  fs_ids+=("$(basename "$d")")
done
IFS=$'\n' sorted_fs=($(printf '%s\n' "${fs_ids[@]}" | sort)); unset IFS

# 2. IDs declared in public/skills.js (the site catalog).
js_ids=$(grep -E "^\s+id:\s*'[^']+'" public/skills.js | sed -E "s/.*'([^']+)'.*/\1/" | sort)

# 3. IDs declared in src/opchain-try.js SKILL_PROMPTS (demo-eligible skills).
prompt_ids=$(grep -E "^\s+'[a-z-]+':\s*\`" src/opchain-try.js | sed -E "s/.*'([^']+)'.*/\1/" | sort)

# `checkpoint-protocol` lives in skills/ but is intentionally absent from
# SKILL_PROMPTS (it's a substrate, not a chattable skill).
expected_prompts=$(printf '%s\n' "${sorted_fs[@]}" | grep -v '^checkpoint-protocol$' | sort)

fail=0

if [[ "$(printf '%s\n' "${sorted_fs[@]}")" != "$js_ids" ]]; then
  echo "✗ Mismatch between skills/ and public/skills.js:"
  diff <(printf '%s\n' "${sorted_fs[@]}") <(printf '%s\n' "$js_ids") || true
  fail=1
fi

if [[ "$expected_prompts" != "$prompt_ids" ]]; then
  echo "✗ Mismatch between skills/ (minus checkpoint-protocol) and src/opchain-try.js SKILL_PROMPTS:"
  diff <(printf '%s\n' "$expected_prompts") <(printf '%s\n' "$prompt_ids") || true
  fail=1
fi

if [[ $fail -ne 0 ]]; then
  echo ""
  echo "Fix the drift above or update this script. Sprint 1 replaces it with a typed collection."
  exit 1
fi

echo "✓ Catalog in sync: ${#sorted_fs[@]} skills across skills/, public/skills.js, and SKILL_PROMPTS."

#!/usr/bin/env bash
# Bundle opchain SKILL.md files into public/opchain-skills.zip for download.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SKILLS="$ROOT/skills"
OUT="$ROOT/public/opchain-skills.zip"
mkdir -p "$(dirname "$OUT")"
rm -f "$OUT"
(
  cd "$SKILLS" || exit 1
  shopt -s nullglob
  files=(*/SKILL.md)
  if [[ ${#files[@]} -eq 0 ]]; then
    echo "make-skills-zip: no SKILL.md files found" >&2
    exit 1
  fi
  zip -q -9 "$OUT" "${files[@]}"
)
echo "Wrote $OUT"

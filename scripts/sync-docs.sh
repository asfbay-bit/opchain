#!/usr/bin/env bash
# Copy opchain SKILL.md files from skills/ into public/docs/ for static serving.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$ROOT/skills"
DEST="$ROOT/public/docs"
mkdir -p "$DEST"
for d in "$SRC"/*/; do
  [[ -f "${d}SKILL.md" ]] || continue
  name="$(basename "$d")"
  mkdir -p "$DEST/$name"
  cp "${d}SKILL.md" "$DEST/$name/SKILL.md"
done
echo "Synced skill docs to $DEST"

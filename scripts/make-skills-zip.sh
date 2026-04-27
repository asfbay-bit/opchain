#!/usr/bin/env bash
# Bundle opchain skills into:
#   public/opchain-skills.zip            — combined bundle (all SKILL.md files)
#   public/skills/<id>.zip               — per-skill bundle (full skill directory tree)
#
# Per-skill zips power the "Download skill" button on /skills/<id>; the combined
# zip powers the "download all" button on /skills.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SKILLS="$ROOT/skills"
PUBLIC="$ROOT/public"
COMBINED="$PUBLIC/opchain-skills.zip"
PER_SKILL_DIR="$PUBLIC/skills"

mkdir -p "$PER_SKILL_DIR"
rm -f "$COMBINED"
rm -f "$PER_SKILL_DIR"/*.zip

# ── Combined bundle (every SKILL.md) ─────────────────────────────────
(
  cd "$SKILLS" || exit 1
  shopt -s nullglob
  files=(*/SKILL.md)
  if [[ ${#files[@]} -eq 0 ]]; then
    echo "make-skills-zip: no SKILL.md files found" >&2
    exit 1
  fi
  zip -q -9 "$COMBINED" "${files[@]}"
)
echo "Wrote $COMBINED"

# ── Per-skill bundles (full directory tree per skill) ────────────────
# Each zip contains the skill's full folder so users get SKILL.md plus
# any references/, scripts/, examples/, TRYIT.md, etc. — everything
# Claude Code needs to operate the skill. Filename matches the skill's
# directory name so the URL is /skills/<id>.zip.
for dir in "$SKILLS"/*/; do
  id="$(basename "$dir")"
  # Skip anything that doesn't have a SKILL.md (defensive — schema requires it
  # for valid skills, but keeps loose files / scratch dirs out of the build).
  [[ -f "$dir/SKILL.md" ]] || continue
  out="$PER_SKILL_DIR/$id.zip"
  (
    cd "$SKILLS" || exit 1
    zip -q -9 -r "$out" "$id"
  )
  echo "Wrote $out"
done

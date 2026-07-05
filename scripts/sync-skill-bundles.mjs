#!/usr/bin/env node
// sync-skill-bundles.mjs
//
// Keeps every skill's bundled `references/orchestrator.md` and
// `references/checkpoint-protocol.md` in sync with their canonical sources.
//
// Sources of truth:
//   - skills/orchestrator.md                    (bundled verbatim)
//   - skills/oc-checkpoint-protocol/SKILL.md    (bundled with YAML frontmatter stripped)
//
// Run:        node scripts/sync-skill-bundles.mjs
// CI check:   node scripts/sync-skill-bundles.mjs --check   (exit 1 if drift)

import { readFileSync, writeFileSync, readdirSync, statSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SKILLS_DIR = join(REPO_ROOT, 'skills');
const ORCHESTRATOR_SRC = join(SKILLS_DIR, 'orchestrator.md');
const PROTOCOL_SRC = join(SKILLS_DIR, 'oc-checkpoint-protocol', 'SKILL.md');
// The skill whose SKILL.md IS the protocol source — it must not bundle a copy of
// itself as references/checkpoint-protocol.md (it still gets orchestrator.md).
const PROTOCOL_SOURCE_SKILL = 'oc-checkpoint-protocol';

const checkMode = process.argv.includes('--check');

function stripFrontmatter(md) {
  if (!md.startsWith('---\n')) return md;
  const end = md.indexOf('\n---\n', 4);
  if (end === -1) return md;
  return md.slice(end + 5).replace(/^\n+/, '');
}

function listSkills() {
  return readdirSync(SKILLS_DIR)
    .filter((entry) => {
      const path = join(SKILLS_DIR, entry);
      try {
        return statSync(path).isDirectory();
      } catch {
        return false;
      }
    })
    .sort();
}

function syncTarget(targetPath, expected, label) {
  let actual = '';
  let missing = false;
  try {
    actual = readFileSync(targetPath, 'utf8');
  } catch {
    actual = null;
    missing = true;
  }
  if (actual === expected) return { changed: false };

  if (checkMode) {
    return { changed: true, drift: true, missing };
  }
  mkdirSync(dirname(targetPath), { recursive: true });
  writeFileSync(targetPath, expected);
  return { changed: true, missing };
}

const orchestratorContent = readFileSync(ORCHESTRATOR_SRC, 'utf8');
const protocolContent = stripFrontmatter(readFileSync(PROTOCOL_SRC, 'utf8'));

const drift = [];
const updated = [];

// Every skill directory bundles the shared protocol files so the skill is
// self-contained once installed into ~/.claude/skills. `references/` is created
// if absent — a skill shipping without these files is the drift this guards against.
for (const skill of listSkills()) {
  const refsDir = join(SKILLS_DIR, skill, 'references');

  const targets = [
    {
      path: join(refsDir, 'orchestrator.md'),
      expected: orchestratorContent,
      label: `${skill}/references/orchestrator.md`,
    },
  ];
  // The protocol source skill must not bundle a copy of its own body.
  if (skill !== PROTOCOL_SOURCE_SKILL) {
    targets.push({
      path: join(refsDir, 'checkpoint-protocol.md'),
      expected: protocolContent,
      label: `${skill}/references/checkpoint-protocol.md`,
    });
  }

  for (const t of targets) {
    const result = syncTarget(t.path, t.expected, t.label);
    if (result.drift) drift.push(`${t.label}${result.missing ? ' (missing)' : ''}`);
    else if (result.changed) updated.push(`${t.label}${result.missing ? ' (created)' : ''}`);
  }
}

if (checkMode) {
  if (drift.length) {
    console.error('Bundled skill references are out of sync with source:');
    drift.forEach((d) => console.error(`  ${d}`));
    console.error('\nFix: npm run sync-bundles');
    process.exit(1);
  }
  console.log('All bundled skill references are in sync.');
  process.exit(0);
}

if (updated.length === 0) {
  console.log('All bundled skill references already in sync.');
} else {
  console.log(`Synced ${updated.length} bundled file(s):`);
  updated.forEach((u) => console.log(`  ${u}`));
}

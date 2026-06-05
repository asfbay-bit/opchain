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

import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SKILLS_DIR = join(REPO_ROOT, 'skills');
const ORCHESTRATOR_SRC = join(SKILLS_DIR, 'orchestrator.md');
const PROTOCOL_SRC = join(SKILLS_DIR, 'oc-checkpoint-protocol', 'SKILL.md');

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
  try {
    actual = readFileSync(targetPath, 'utf8');
  } catch {
    actual = null;
  }
  if (actual === expected) return { changed: false };

  if (checkMode) {
    return { changed: true, drift: true };
  }
  writeFileSync(targetPath, expected);
  return { changed: true };
}

const orchestratorContent = readFileSync(ORCHESTRATOR_SRC, 'utf8');
const protocolContent = stripFrontmatter(readFileSync(PROTOCOL_SRC, 'utf8'));

const drift = [];
const updated = [];

for (const skill of listSkills()) {
  const refsDir = join(SKILLS_DIR, skill, 'references');
  try {
    if (!statSync(refsDir).isDirectory()) continue;
  } catch {
    continue;
  }

  const targets = [
    {
      path: join(refsDir, 'orchestrator.md'),
      expected: orchestratorContent,
      label: `${skill}/references/orchestrator.md`,
    },
    {
      path: join(refsDir, 'checkpoint-protocol.md'),
      expected: protocolContent,
      label: `${skill}/references/checkpoint-protocol.md`,
    },
  ];

  for (const t of targets) {
    let exists = true;
    try { statSync(t.path); } catch { exists = false; }
    if (!exists) continue;

    const result = syncTarget(t.path, t.expected, t.label);
    if (result.drift) drift.push(t.label);
    else if (result.changed) updated.push(t.label);
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

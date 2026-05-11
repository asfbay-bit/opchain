/**
 * Equivalence tests for the 5 backfilled language packs (ADEV-329, v1.4 PR 2).
 *
 * These run against the REAL skills/stack-forge/packs/<id>/ tree (not the
 * synthetic fixtures used by stack-packs.test.js). The intent is to lock in:
 *
 *   1. The exact set of language packs that ship in this release.
 *   2. The canonical testRunner / buildCmd / lintCmd commands stack-forge
 *      will recommend for each (per stack-forge.checkpoint.json
 *      next_actions[0]).
 *   3. The langRef doc is present, non-empty, and under the 50KB soft cap
 *      so the per-skill zip stays lean.
 *   4. The generated coverage-flags.json is byte-stable for the 5 stable
 *      language packs.
 *
 * Why "equivalence" instead of "snapshot": the v1.2 stack-forge output was
 * hardcoded prose in SKILL.md, not machine-readable. Byte-for-byte equality
 * with v1.2 is unreachable by design — PR 2 lifts the copy into pack.yml +
 * langRef so it can be code-validated. These tests instead lock in the
 * machine-readable contract (what stack-forge recommends, mechanically) so
 * future PRs catch accidental drift.
 */
import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import yaml from "js-yaml";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PACKS_DIR = join(ROOT, "skills", "stack-forge", "packs");
const SCRIPT = join(ROOT, "scripts", "gen-stack-packs.mjs");
const REF_SOFT_BYTES = 50 * 1024;

const EXPECTED_LANGUAGE_PACKS = [
  {
    id: "typescript",
    displayName: "TypeScript",
    testRunner: "vitest",
    buildCmd: "npm run build",
    lintCmd: "eslint .",
  },
  {
    id: "python",
    displayName: "Python",
    testRunner: "pytest",
    buildCmd: "python -m build",
    lintCmd: "ruff check .",
  },
  {
    id: "ruby",
    displayName: "Ruby",
    testRunner: "rspec",
    buildCmd: "bundle exec rake build",
    lintCmd: "bundle exec rubocop",
  },
  {
    id: "go",
    displayName: "Go",
    testRunner: "go test",
    buildCmd: "go build ./...",
    lintCmd: "golangci-lint run",
  },
  {
    id: "rust",
    displayName: "Rust",
    testRunner: "cargo test",
    buildCmd: "cargo build",
    lintCmd: "cargo clippy -- -D warnings",
  },
];

function loadPack(id) {
  const file = join(PACKS_DIR, id, "pack.yml");
  return yaml.load(readFileSync(file, "utf8"));
}

describe("stack-forge packs — ADEV-329 backfill equivalence", () => {
  for (const expected of EXPECTED_LANGUAGE_PACKS) {
    describe(expected.id, () => {
      it("pack.yml declares the expected canonical fields", () => {
        const pack = loadPack(expected.id);
        expect(pack.id).toBe(expected.id);
        expect(pack.kind).toBe("language");
        expect(pack.status).toBe("stable");
        expect(pack.since).toBe("1.4.0");
        expect(pack.displayName).toBe(expected.displayName);
        expect(pack.testRunner).toBe(expected.testRunner);
        expect(pack.buildCmd).toBe(expected.buildCmd);
        expect(pack.lintCmd).toBe(expected.lintCmd);
        expect(pack.langRef).toBe("language.md");
      });

      it("does not declare a frameworks list (those land in later v1.4 PRs)", () => {
        // PR 2 is the language-pack dogfood. Framework packs and the
        // bidirectional `frameworks: [...]` entries arrive in PRs 4-7.
        // If a framework reference sneaks in here, gen-stack-packs will
        // fail when the framework pack doesn't yet exist.
        const pack = loadPack(expected.id);
        expect(pack.frameworks).toBeUndefined();
      });

      it("langRef file exists and is under the 50KB soft cap", () => {
        const refPath = join(PACKS_DIR, expected.id, "language.md");
        expect(existsSync(refPath)).toBe(true);
        const size = statSync(refPath).size;
        expect(size).toBeGreaterThan(0);
        expect(size).toBeLessThanOrEqual(REF_SOFT_BYTES);
      });
    });
  }

  it("real packs/ tree validates and emits exactly the 5 expected coverage flags", () => {
    const outDir = mkdtempSync(join(tmpdir(), "opchain-real-packs-out-"));
    const result = spawnSync("node", [SCRIPT], {
      cwd: ROOT,
      encoding: "utf8",
      env: {
        ...process.env,
        // Run gen-stack-packs against the real packs/ tree (default),
        // but write its output to a tempdir so the test does not race
        // with concurrent prebuild runs.
        OPCHAIN_OUT_DIR: outDir,
      },
    });
    const detail = `stdout:\n${result.stdout}\nstderr:\n${result.stderr}`;
    expect(result.status, detail).toBe(0);
    expect(result.stdout).toMatch(/5 pack\(s\), 5 coverage flag\(s\)/);

    const flags = JSON.parse(readFileSync(join(outDir, "coverage-flags.json"), "utf8"));
    const byId = Object.fromEntries(flags.map((f) => [f.id, f]));
    for (const expected of EXPECTED_LANGUAGE_PACKS) {
      expect(byId[expected.id]).toEqual({
        id: expected.id,
        kind: "language",
        status: "stable",
        displayName: expected.displayName,
      });
    }
  });
});

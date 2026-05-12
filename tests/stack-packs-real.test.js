/**
 * Equivalence tests for the language + framework packs shipped in v1.4.
 *
 * These run against the REAL skills/stack-forge/packs/<id>/ tree (not the
 * synthetic fixtures used by stack-packs.test.js). The intent is to lock in:
 *
 *   1. The exact set of language + framework packs that ship in this release.
 *      PR 2 (ADEV-329) backfilled 5 language packs (typescript/python/ruby/
 *      go/rust). PR 4 (ADEV-334) adds 3 more language packs (elixir/bun/deno)
 *      and 4 framework packs (phoenix/remix/sveltekit/solid).
 *   2. The canonical testRunner / buildCmd / lintCmd commands stack-forge
 *      will recommend for each language.
 *   3. Every ref doc is present, non-empty, and under the 50KB soft cap so
 *      the per-skill zip stays lean.
 *   4. The generated coverage-flags.json is byte-stable for all stable packs.
 *   5. The framework ↔ language bidirectional invariant — every framework
 *      lists its language, and every language lists its frameworks.
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

// Map of language id → expected list of framework pack ids that target it.
// PR 2 (ADEV-329) shipped languages with no frameworks; PR 4 (ADEV-334) adds
// the first framework backfill: typescript gains remix/sveltekit/solid, and
// the new elixir pack ships with phoenix. The rest stay frameworks-empty
// until PR 5+ lands additional framework packs.
const EXPECTED_FRAMEWORKS_BY_LANGUAGE = {
  typescript: ["remix", "sveltekit", "solid"],
  python: [],
  ruby: [],
  go: [],
  rust: [],
  elixir: ["phoenix"],
  bun: [],
  deno: [],
};

const EXPECTED_LANGUAGE_PACKS = [
  // PR 2 (ADEV-329) backfill.
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
  // PR 4 (ADEV-334) modern web bulk languages.
  {
    id: "elixir",
    displayName: "Elixir",
    testRunner: "mix test",
    buildCmd: "mix compile",
    lintCmd: "mix credo --strict",
  },
  {
    id: "bun",
    displayName: "Bun",
    testRunner: "bun test",
    buildCmd: "bun run build",
    lintCmd: "biome check .",
  },
  {
    id: "deno",
    displayName: "Deno",
    testRunner: "deno test",
    buildCmd: "deno task build",
    lintCmd: "deno lint",
  },
];

// PR 4 (ADEV-334) framework packs. Each lists its underlying language pack;
// the framework pack body lives in framework.md.
const EXPECTED_FRAMEWORK_PACKS = [
  { id: "phoenix",   displayName: "Phoenix",    language: "elixir" },
  { id: "remix",     displayName: "Remix",      language: "typescript" },
  { id: "sveltekit", displayName: "SvelteKit",  language: "typescript" },
  { id: "solid",     displayName: "SolidStart", language: "typescript" },
];

const EXPECTED_TOTAL_PACKS = EXPECTED_LANGUAGE_PACKS.length + EXPECTED_FRAMEWORK_PACKS.length;

function loadPack(id) {
  const file = join(PACKS_DIR, id, "pack.yml");
  return yaml.load(readFileSync(file, "utf8"));
}

describe("stack-forge packs — language pack equivalence (ADEV-329 + ADEV-334)", () => {
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

      it("frameworks list matches the v1.4 expected mapping", () => {
        // PR 2 packs landed frameworks-empty; PR 4 backfills the first
        // framework references (typescript→remix/sveltekit/solid,
        // elixir→phoenix). Anything else means drift.
        const pack = loadPack(expected.id);
        const expectedFrameworks = EXPECTED_FRAMEWORKS_BY_LANGUAGE[expected.id];
        if (expectedFrameworks.length === 0) {
          expect(pack.frameworks).toBeUndefined();
        } else {
          expect(pack.frameworks).toEqual(expectedFrameworks);
        }
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
});

describe("stack-forge packs — framework pack equivalence (ADEV-334)", () => {
  for (const expected of EXPECTED_FRAMEWORK_PACKS) {
    describe(expected.id, () => {
      it("pack.yml declares the expected canonical fields", () => {
        const pack = loadPack(expected.id);
        expect(pack.id).toBe(expected.id);
        expect(pack.kind).toBe("framework");
        expect(pack.status).toBe("stable");
        expect(pack.since).toBe("1.4.0");
        expect(pack.displayName).toBe(expected.displayName);
        expect(pack.language).toBe(expected.language);
        expect(pack.frameworkRef).toBe("framework.md");
      });

      it("language pack lists this framework (bidirectional invariant)", () => {
        const lang = loadPack(expected.language);
        expect(Array.isArray(lang.frameworks)).toBe(true);
        expect(lang.frameworks).toContain(expected.id);
      });

      it("frameworkRef file exists and is under the 50KB soft cap", () => {
        const refPath = join(PACKS_DIR, expected.id, "framework.md");
        expect(existsSync(refPath)).toBe(true);
        const size = statSync(refPath).size;
        expect(size).toBeGreaterThan(0);
        expect(size).toBeLessThanOrEqual(REF_SOFT_BYTES);
      });
    });
  }
});

describe("stack-forge packs — generator output", () => {
  it("real packs/ tree validates and emits exactly the expected coverage flags", () => {
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
    // language packs + framework packs are all kind ∈ {language, framework},
    // so the coverage-flag count equals the total pack count (no mobile or
    // deploy-target packs yet — those land in PR 6 and PR 7 respectively).
    expect(result.stdout).toMatch(
      new RegExp(`${EXPECTED_TOTAL_PACKS} pack\\(s\\), ${EXPECTED_TOTAL_PACKS} coverage flag\\(s\\)`),
    );

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
    for (const expected of EXPECTED_FRAMEWORK_PACKS) {
      expect(byId[expected.id]).toEqual({
        id: expected.id,
        kind: "framework",
        status: "stable",
        displayName: expected.displayName,
      });
    }
  });
});

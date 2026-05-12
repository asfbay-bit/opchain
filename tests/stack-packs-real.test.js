/**
 * Equivalence tests for the language + framework + deploy-target packs
 * shipped in v1.4.
 *
 * These run against the REAL skills/stack-forge/packs/<id>/ tree (not the
 * synthetic fixtures used by stack-packs.test.js). The intent is to lock in:
 *
 *   1. The exact set of language + framework + deploy-target packs that
 *      ship in this release. PR 2 (ADEV-329) backfilled 5 language packs
 *      (typescript/python/ruby/go/rust). PR 4 (ADEV-334) added 3 more
 *      language packs (elixir/bun/deno) and 4 framework packs
 *      (phoenix/remix/sveltekit/solid). PR 5 (ADEV-335) added 4 enterprise
 *      language packs (java/csharp/kotlin/php) and 4 framework packs
 *      (spring-java/dotnet-aspnet/spring-kotlin/laravel-php). PR 7
 *      (ADEV-337) adds 4 deploy-target packs (railway/netlify/heroku/
 *      aws-amplify) — these emit no coverage flag (kind=deploy-target is a
 *      sub-selection only).
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
// the new elixir pack ships with phoenix. PR 5 (ADEV-335) adds the enterprise
// languages each with one framework pack: java→spring-java, csharp→
// dotnet-aspnet, kotlin→spring-kotlin, php→laravel-php.
const EXPECTED_FRAMEWORKS_BY_LANGUAGE = {
  typescript: ["remix", "sveltekit", "solid"],
  python: [],
  ruby: [],
  go: [],
  rust: [],
  elixir: ["phoenix"],
  bun: [],
  deno: [],
  java: ["spring-java"],
  csharp: ["dotnet-aspnet"],
  kotlin: ["spring-kotlin"],
  php: ["laravel-php"],
  swift: ["swiftui"],
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
  // PR 5 (ADEV-335) enterprise bulk languages.
  {
    id: "java",
    displayName: "Java",
    testRunner: "mvn test",
    buildCmd: "mvn package",
    lintCmd: "mvn checkstyle:check",
  },
  {
    id: "csharp",
    displayName: "C#",
    testRunner: "dotnet test",
    buildCmd: "dotnet build",
    lintCmd: "dotnet format --verify-no-changes",
  },
  {
    id: "kotlin",
    displayName: "Kotlin",
    testRunner: "gradle test",
    buildCmd: "gradle build",
    lintCmd: "ktlint",
  },
  {
    id: "php",
    displayName: "PHP",
    testRunner: "phpunit",
    buildCmd: "composer install --no-dev",
    lintCmd: "phpcs",
  },
  // PR 6 (ADEV-336) Apple/iOS language.
  {
    id: "swift",
    displayName: "Swift",
    testRunner: "swift test",
    buildCmd: "swift build",
    lintCmd: "swiftlint",
  },
];

// the framework pack body lives in framework.md. PR 5 (ADEV-335) added the
// enterprise framework packs; PR 6 (ADEV-336) added `swiftui` on the new
// `swift` language pack.
const EXPECTED_FRAMEWORK_PACKS = [
  { id: "phoenix",       displayName: "Phoenix",              language: "elixir" },
  { id: "remix",         displayName: "Remix",                language: "typescript" },
  { id: "sveltekit",     displayName: "SvelteKit",            language: "typescript" },
  { id: "solid",         displayName: "SolidStart",           language: "typescript" },
  { id: "spring-java",   displayName: "Spring Boot (Java)",   language: "java" },
  { id: "dotnet-aspnet", displayName: "ASP.NET Core",         language: "csharp" },
  { id: "spring-kotlin", displayName: "Spring Boot (Kotlin)", language: "kotlin" },
  { id: "laravel-php",   displayName: "Laravel",              language: "php" },
  { id: "swiftui",       displayName: "SwiftUI",              language: "swift" },
];

// PR 6 (ADEV-336) mobile packs. kind=mobile emits a coverage flag and
// dispatches via dispatchMobile(); platform references resolve to
// deploy-target packs (e.g. app-store).
const EXPECTED_MOBILE_PACKS = [
  {
    id: "ios-swiftui",
    displayName: "iOS (SwiftUI)",
    mobilePlatform: "ios",
    defaultPlatform: "app-store",
    supportedPlatforms: ["app-store"],
  },
];

// Deploy-target packs (kind=deploy-target) do NOT emit coverage flags
// (sub-selections under language / framework / mobile packs — see
// COVERAGE_KINDS in scripts/gen-stack-packs.mjs). PR 7 (ADEV-337) added
// the hosting adapters (railway/netlify/heroku/aws-amplify); PR 6
// (ADEV-336) added app-store.
const EXPECTED_DEPLOY_TARGET_PACKS = [
  { id: "railway",     displayName: "Railway" },
  { id: "netlify",     displayName: "Netlify" },
  { id: "heroku",      displayName: "Heroku" },
  { id: "aws-amplify", displayName: "AWS Amplify" },
  { id: "app-store",   displayName: "App Store" },
];

const EXPECTED_TOTAL_PACKS =
  EXPECTED_LANGUAGE_PACKS.length +
  EXPECTED_FRAMEWORK_PACKS.length +
  EXPECTED_MOBILE_PACKS.length +
  EXPECTED_DEPLOY_TARGET_PACKS.length;

// kind=deploy-target packs do NOT emit a coverage flag. The other three
// kinds (language / framework / mobile) do. Keep this formula explicit so
// future PRs adding deploy-targets don't accidentally bump the count.
const EXPECTED_COVERAGE_FLAGS =
  EXPECTED_LANGUAGE_PACKS.length +
  EXPECTED_FRAMEWORK_PACKS.length +
  EXPECTED_MOBILE_PACKS.length;

function loadPack(id) {
  const file = join(PACKS_DIR, id, "pack.yml");
  return yaml.load(readFileSync(file, "utf8"));
}

describe("stack-forge packs — language pack equivalence (ADEV-329 + ADEV-334 + ADEV-335)", () => {
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

describe("stack-forge packs — framework pack equivalence (ADEV-334 + ADEV-335)", () => {
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

describe("stack-forge packs — mobile pack equivalence (ADEV-336)", () => {
  for (const expected of EXPECTED_MOBILE_PACKS) {
    describe(expected.id, () => {
      it("pack.yml declares the expected canonical fields", () => {
        const pack = loadPack(expected.id);
        expect(pack.id).toBe(expected.id);
        expect(pack.kind).toBe("mobile");
        expect(pack.status).toBe("stable");
        expect(pack.since).toBe("1.4.0");
        expect(pack.displayName).toBe(expected.displayName);
        expect(pack.mobilePlatform).toBe(expected.mobilePlatform);
        expect(pack.defaultPlatform).toBe(expected.defaultPlatform);
        expect(pack.supportedPlatforms).toEqual(expected.supportedPlatforms);
        expect(pack.mobileRef).toBe("mobile.md");
      });

      it("defaultPlatform + supportedPlatforms resolve to real deploy-target packs", () => {
        // The graph pass in gen-stack-packs enforces this at build time;
        // pinning it here gives a faster signal during pack authoring.
        const dt = loadPack(expected.defaultPlatform);
        expect(dt.kind).toBe("deploy-target");
        for (const platformId of expected.supportedPlatforms) {
          const sp = loadPack(platformId);
          expect(sp.kind).toBe("deploy-target");
        }
      });

      it("mobileRef file exists and is under the 50KB soft cap", () => {
        const refPath = join(PACKS_DIR, expected.id, "mobile.md");
        expect(existsSync(refPath)).toBe(true);
        const size = statSync(refPath).size;
        expect(size).toBeGreaterThan(0);
        expect(size).toBeLessThanOrEqual(REF_SOFT_BYTES);
      });
    });
  }
});

describe("stack-forge packs — deploy-target pack equivalence (ADEV-336 + ADEV-337)", () => {
  for (const expected of EXPECTED_DEPLOY_TARGET_PACKS) {
    describe(expected.id, () => {
      it("pack.yml declares the expected canonical fields", () => {
        const pack = loadPack(expected.id);
        expect(pack.id).toBe(expected.id);
        expect(pack.kind).toBe("deploy-target");
        expect(pack.status).toBe("stable");
        expect(pack.since).toBe("1.4.0");
        expect(pack.displayName).toBe(expected.displayName);
        expect(pack.deployRef).toBe("deploy.md");
      });

      it("deployRef file exists and is under the 50KB soft cap", () => {
        const refPath = join(PACKS_DIR, expected.id, "deploy.md");
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
    // Pack total = language + framework + mobile + deploy-target.
    // Coverage flag total = language + framework + mobile only — deploy-target
    // packs are sub-selections under another offer and emit no flag (see
    // COVERAGE_KINDS in scripts/gen-stack-packs.mjs).
    expect(result.stdout).toMatch(
      new RegExp(`${EXPECTED_TOTAL_PACKS} pack\\(s\\), ${EXPECTED_COVERAGE_FLAGS} coverage flag\\(s\\)`),
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
    for (const expected of EXPECTED_MOBILE_PACKS) {
      expect(byId[expected.id]).toEqual({
        id: expected.id,
        kind: "mobile",
        status: "stable",
        displayName: expected.displayName,
      });
    }
    // deploy-target packs MUST NOT appear in coverage flags.
    for (const expected of EXPECTED_DEPLOY_TARGET_PACKS) {
      expect(byId[expected.id]).toBeUndefined();
    }
  });
});

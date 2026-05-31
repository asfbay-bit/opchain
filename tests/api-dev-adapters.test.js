/**
 * Tests for scripts/gen-api-dev-adapters.mjs (v1.4 PR 3 — api-dev half
 * of the hybrid driver semantics).
 *
 * Two layers:
 *   1. Real packs/ tree → assert the codegen emits the expected language
 *      adapters with the canonical command set. PR 2 (ADEV-329) locked in
 *      typescript/python/ruby/go/rust; PR 4 (ADEV-334) added elixir, bun,
 *      and deno. PR 5 (ADEV-335) added java, csharp, kotlin, php. Framework
 *      packs (phoenix/remix/sveltekit/solid + spring-java/dotnet-aspnet/
 *      spring-kotlin/laravel-php) shipped alongside the language packs but
 *      are intentionally SKIPPED — api-dev inherits a framework's adapter
 *      from its language pack.
 *   2. Synthetic fixture → assert kind:framework / kind:deploy-target /
 *      kind:mobile packs are SKIPPED (only kind=language goes through).
 */
import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SCRIPT = join(ROOT, "scripts", "gen-api-dev-adapters.mjs");

function runWithPacks(packs) {
  const work = mkdtempSync(join(tmpdir(), "opchain-api-dev-adapters-"));
  const packsRoot = join(work, "packs");
  const outRoot = join(work, "out");
  mkdirSync(packsRoot, { recursive: true });
  mkdirSync(outRoot, { recursive: true });

  for (const [id, files] of Object.entries(packs)) {
    const dir = join(packsRoot, id);
    mkdirSync(dir, { recursive: true });
    for (const [name, body] of Object.entries(files)) {
      writeFileSync(join(dir, name), body, "utf8");
    }
  }

  const result = spawnSync("node", [SCRIPT], {
    cwd: ROOT,
    encoding: "utf8",
    env: {
      ...process.env,
      OPCHAIN_PACKS_DIR: packsRoot,
      OPCHAIN_OUT_DIR: outRoot,
    },
  });
  const out = join(outRoot, "api-dev-adapters.json");
  return {
    status: result.status,
    stdout: result.stdout,
    stderr: result.stderr,
    adapters: result.status === 0 ? JSON.parse(readFileSync(out, "utf8")) : null,
  };
}

function packYml(obj) {
  return Object.entries(obj)
    .map(([k, v]) => {
      if (Array.isArray(v)) return `${k}: [${v.join(", ")}]`;
      return `${k}: ${v}`;
    })
    .join("\n") + "\n";
}

describe("gen-api-dev-adapters — real packs", () => {
  it("emits 13 language adapters with the canonical command set", () => {
    // Run against the real packs/ tree but write to a tempdir.
    const work = mkdtempSync(join(tmpdir(), "opchain-api-dev-adapters-real-"));
    const result = spawnSync("node", [SCRIPT], {
      cwd: ROOT,
      encoding: "utf8",
      env: { ...process.env, OPCHAIN_OUT_DIR: work },
    });
    expect(result.status, `stderr:\n${result.stderr}`).toBe(0);
    expect(result.stdout).toMatch(/13 language pack\(s\)/);

    const adapters = JSON.parse(readFileSync(join(work, "api-dev-adapters.json"), "utf8"));
    expect(adapters).toHaveLength(13);

    const byId = Object.fromEntries(adapters.map((a) => [a.id, a]));
    // PR 2 (ADEV-329) backfill.
    expect(byId.typescript).toEqual({
      id: "typescript", displayName: "TypeScript", status: "stable",
      testRunner: "vitest", buildCmd: "npm run build", lintCmd: "eslint .",
      langRef: "language.md",
    });
    expect(byId.python).toEqual({
      id: "python", displayName: "Python", status: "stable",
      testRunner: "pytest", buildCmd: "python -m build", lintCmd: "ruff check .",
      langRef: "language.md",
    });
    expect(byId.ruby).toEqual({
      id: "ruby", displayName: "Ruby", status: "stable",
      testRunner: "rspec", buildCmd: "bundle exec rake build", lintCmd: "bundle exec rubocop",
      langRef: "language.md",
    });
    expect(byId.go).toEqual({
      id: "go", displayName: "Go", status: "stable",
      testRunner: "go test", buildCmd: "go build ./...", lintCmd: "golangci-lint run",
      langRef: "language.md",
    });
    expect(byId.rust).toEqual({
      id: "rust", displayName: "Rust", status: "stable",
      testRunner: "cargo test", buildCmd: "cargo build", lintCmd: "cargo clippy -- -D warnings",
      langRef: "language.md",
    });
    // PR 4 (ADEV-334) modern web bulk language packs.
    expect(byId.elixir).toEqual({
      id: "elixir", displayName: "Elixir", status: "stable",
      testRunner: "mix test", buildCmd: "mix compile", lintCmd: "mix credo --strict",
      langRef: "language.md",
    });
    expect(byId.bun).toEqual({
      id: "bun", displayName: "Bun", status: "stable",
      testRunner: "bun test", buildCmd: "bun run build", lintCmd: "biome check .",
      langRef: "language.md",
    });
    expect(byId.deno).toEqual({
      id: "deno", displayName: "Deno", status: "stable",
      testRunner: "deno test", buildCmd: "deno task build", lintCmd: "deno lint",
      langRef: "language.md",
    });
    // PR 5 (ADEV-335) enterprise bulk language packs.
    expect(byId.java).toEqual({
      id: "java", displayName: "Java", status: "stable",
      testRunner: "mvn test", buildCmd: "mvn package", lintCmd: "mvn checkstyle:check",
      langRef: "language.md",
    });
    expect(byId.csharp).toEqual({
      id: "csharp", displayName: "C#", status: "stable",
      testRunner: "dotnet test", buildCmd: "dotnet build", lintCmd: "dotnet format --verify-no-changes",
      langRef: "language.md",
    });
    expect(byId.kotlin).toEqual({
      id: "kotlin", displayName: "Kotlin", status: "stable",
      testRunner: "gradle test", buildCmd: "gradle build", lintCmd: "ktlint",
      langRef: "language.md",
    });
    expect(byId.php).toEqual({
      id: "php", displayName: "PHP", status: "stable",
      testRunner: "phpunit", buildCmd: "composer install --no-dev", lintCmd: "phpcs",
      langRef: "language.md",
    });
    // PR 6 (ADEV-336) Apple/iOS language pack.
    expect(byId.swift).toEqual({
      id: "swift", displayName: "Swift", status: "stable",
      testRunner: "swift test", buildCmd: "swift build", lintCmd: "swiftlint",
      langRef: "language.md",
    });
  });

  it("skips framework, mobile, and deploy-target packs in the real packs/ tree", () => {
    // PR 4 (ADEV-334) added phoenix/remix/sveltekit/solid as kind=framework.
    // PR 5 (ADEV-335) added spring-java/dotnet-aspnet/spring-kotlin/laravel-php.
    // PR 6 (ADEV-336) added swiftui (framework), ios-swiftui (mobile), and
    // app-store (deploy-target). PR 6.5 (ADEV-343) added kotlin-android/
    // flutter/react-native-expo as mobile packs + play-store as deploy-target.
    // api-dev codegens scaffolds per *language* only; everything else is
    // skipped — frameworks inherit their language adapter, mobile is
    // checklist-dispatched via dispatchMobile(), and deploy-targets are
    // sub-selections. This pin guards the real packs/ tree against drift.
    const work = mkdtempSync(join(tmpdir(), "opchain-api-dev-adapters-skip-nonlang-"));
    const result = spawnSync("node", [SCRIPT], {
      cwd: ROOT,
      encoding: "utf8",
      env: { ...process.env, OPCHAIN_OUT_DIR: work },
    });
    expect(result.status, `stderr:\n${result.stderr}`).toBe(0);

    const adapters = JSON.parse(readFileSync(join(work, "api-dev-adapters.json"), "utf8"));
    const ids = adapters.map((a) => a.id);
    // Framework packs (PR 4 + PR 5 + PR 6).
    for (const fw of [
      "phoenix", "remix", "sveltekit", "solid",
      "spring-java", "dotnet-aspnet", "spring-kotlin", "laravel-php",
      "swiftui",
    ]) {
      expect(ids).not.toContain(fw);
    }
    // Mobile packs (PR 6 + PR 6.5) — dispatched as release checklists, not adapters.
    for (const m of ["ios-swiftui", "kotlin-android", "flutter", "react-native-expo"]) {
      expect(ids).not.toContain(m);
    }
    // Deploy-target packs (PR 6 + PR 6.5 + PR 7) — sub-selections, never adapters.
    for (const dt of ["app-store", "play-store", "railway", "netlify", "heroku", "aws-amplify"]) {
      expect(ids).not.toContain(dt);
    }
  });
});

describe("gen-api-dev-adapters — synthetic fixtures", () => {
  it("zero packs → empty adapter list", () => {
    const result = runWithPacks({});
    expect(result.status, `stderr:\n${result.stderr}`).toBe(0);
    expect(result.adapters).toEqual([]);
  });

  it("skips kind=framework, kind=deploy-target, and kind=mobile packs", () => {
    const result = runWithPacks({
      python: {
        "pack.yml": packYml({
          id: "python", kind: "language", status: "stable",
          since: "1.4.0", testRunner: "pytest",
        }),
      },
      // framework pack — should be ignored even though it has language ancestry.
      "django-x": {
        "pack.yml": packYml({
          id: "django-x", kind: "framework", status: "stable",
          since: "1.4.0", language: "python",
        }),
      },
      // deploy-target pack — never emitted.
      "fly-io-x": {
        "pack.yml": packYml({
          id: "fly-io-x", kind: "deploy-target", status: "stable", since: "1.4.0",
        }),
      },
      // mobile pack — stack-forge dispatches these via dispatchMobile.
      "ios-x": {
        "pack.yml": packYml({
          id: "ios-x", kind: "mobile", mobilePlatform: "ios",
          status: "stable", since: "1.4.0",
        }),
      },
    });
    expect(result.status, `stderr:\n${result.stderr}`).toBe(0);
    expect(result.adapters).toHaveLength(1);
    expect(result.adapters[0].id).toBe("python");
  });

  it("preserves displayName, falling back to id when displayName is omitted", () => {
    const result = runWithPacks({
      foo: {
        "pack.yml": packYml({
          id: "foo", kind: "language", status: "beta",
          since: "1.4.0", testRunner: "footest",
        }),
      },
      bar: {
        "pack.yml": packYml({
          id: "bar", displayName: "Bar Lang",
          kind: "language", status: "stable",
          since: "1.4.0", testRunner: "bartest",
        }),
      },
    });
    expect(result.status, `stderr:\n${result.stderr}`).toBe(0);
    const byId = Object.fromEntries(result.adapters.map((a) => [a.id, a]));
    expect(byId.foo.displayName).toBe("foo");
    expect(byId.bar.displayName).toBe("Bar Lang");
  });

  it("output is sorted by id (deterministic across runs)", () => {
    const result = runWithPacks({
      zeta: {
        "pack.yml": packYml({
          id: "zeta", kind: "language", status: "stable",
          since: "1.4.0", testRunner: "ztest",
        }),
      },
      alpha: {
        "pack.yml": packYml({
          id: "alpha", kind: "language", status: "stable",
          since: "1.4.0", testRunner: "atest",
        }),
      },
      mu: {
        "pack.yml": packYml({
          id: "mu", kind: "language", status: "stable",
          since: "1.4.0", testRunner: "mtest",
        }),
      },
    });
    expect(result.status, `stderr:\n${result.stderr}`).toBe(0);
    expect(result.adapters.map((a) => a.id)).toEqual(["alpha", "mu", "zeta"]);
  });

  it("null out buildCmd / lintCmd / langRef when the pack omits them", () => {
    const result = runWithPacks({
      minimal: {
        "pack.yml": packYml({
          id: "minimal", kind: "language", status: "stable",
          since: "1.4.0", testRunner: "minrunner",
        }),
      },
    });
    expect(result.status, `stderr:\n${result.stderr}`).toBe(0);
    expect(result.adapters[0]).toEqual({
      id: "minimal", displayName: "minimal", status: "stable",
      testRunner: "minrunner", buildCmd: null, lintCmd: null, langRef: null,
    });
  });
});

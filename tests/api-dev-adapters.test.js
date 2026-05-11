/**
 * Tests for scripts/gen-api-dev-adapters.mjs (v1.4 PR 3 — api-dev half
 * of the hybrid driver semantics).
 *
 * Two layers:
 *   1. Real packs/ tree → assert the codegen emits the exact 5 language
 *      adapters with the canonical command set (locked in PR 2).
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
  it("emits 5 language adapters with the canonical command set", () => {
    // Run against the real packs/ tree but write to a tempdir.
    const work = mkdtempSync(join(tmpdir(), "opchain-api-dev-adapters-real-"));
    const result = spawnSync("node", [SCRIPT], {
      cwd: ROOT,
      encoding: "utf8",
      env: { ...process.env, OPCHAIN_OUT_DIR: work },
    });
    expect(result.status, `stderr:\n${result.stderr}`).toBe(0);
    expect(result.stdout).toMatch(/5 language pack\(s\)/);

    const adapters = JSON.parse(readFileSync(join(work, "api-dev-adapters.json"), "utf8"));
    expect(adapters).toHaveLength(5);

    const byId = Object.fromEntries(adapters.map((a) => [a.id, a]));
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

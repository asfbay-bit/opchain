/**
 * Validates scripts/gen-stack-packs.mjs against a battery of pack-fixture
 * cases. Each test writes a synthetic packs/<id>/pack.yml tree into a temp
 * directory and spawns the real script with OPCHAIN_PACKS_DIR /
 * OPCHAIN_OUT_DIR pointing at the fixture — no node_modules shim needed.
 */
import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SCRIPT = join(ROOT, "scripts", "gen-stack-packs.mjs");

function runWithPacks(packs) {
  const work = mkdtempSync(join(tmpdir(), "opchain-stack-packs-"));
  try {
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

    return spawnSync("node", [SCRIPT], {
      cwd: ROOT,
      encoding: "utf8",
      env: {
        ...process.env,
        OPCHAIN_PACKS_DIR: packsRoot,
        OPCHAIN_OUT_DIR: outRoot,
      },
    });
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

function packYml(fields) {
  return Object.entries(fields).map(([k, v]) => {
    if (Array.isArray(v)) return `${k}: [${v.map((s) => JSON.stringify(s)).join(", ")}]`;
    if (typeof v === "object" && v !== null) {
      const inner = Object.entries(v).map(([ik, iv]) => `  ${ik}: ${JSON.stringify(iv)}`).join("\n");
      return `${k}:\n${inner}`;
    }
    return `${k}: ${JSON.stringify(v)}`;
  }).join("\n") + "\n";
}

describe("gen-stack-packs", () => {
  it("zero-pack baseline passes", () => {
    const result = runWithPacks({});
    const detail = `stdout:\n${result.stdout}\nstderr:\n${result.stderr}`;
    expect(result.status, detail).toBe(0);
    expect(result.stdout).toMatch(/0 pack\(s\), 0 coverage flag\(s\)/);
  });

  it("valid language pack passes and synthesizes one coverage flag", () => {
    const result = runWithPacks({
      python: {
        "pack.yml": packYml({
          id: "python", kind: "language", status: "stable",
          since: "1.4.0", testRunner: "pytest",
        }),
      },
    });
    const detail = `stdout:\n${result.stdout}\nstderr:\n${result.stderr}`;
    expect(result.status, detail).toBe(0);
    expect(result.stdout).toMatch(/1 pack\(s\), 1 coverage flag\(s\)/);
  });

  it("deploy-target pack passes but does NOT synthesize a coverage flag", () => {
    const result = runWithPacks({
      "fly-io": {
        "pack.yml": packYml({
          id: "fly-io", kind: "deploy-target", status: "stable", since: "1.4.0",
        }),
      },
    });
    const detail = `stdout:\n${result.stdout}\nstderr:\n${result.stderr}`;
    expect(result.status, detail).toBe(0);
    expect(result.stdout).toMatch(/1 pack\(s\), 0 coverage flag\(s\)/);
  });

  it("framework pack with bidirectional language reference passes", () => {
    const result = runWithPacks({
      python: {
        "pack.yml": packYml({
          id: "python", kind: "language", status: "stable",
          since: "1.4.0", testRunner: "pytest",
          frameworks: ["django"],
        }),
      },
      django: {
        "pack.yml": packYml({
          id: "django", kind: "framework", status: "stable",
          since: "1.4.0", language: "python",
        }),
      },
    });
    const detail = `stdout:\n${result.stdout}\nstderr:\n${result.stderr}`;
    expect(result.status, detail).toBe(0);
    expect(result.stdout).toMatch(/2 pack\(s\), 2 coverage flag\(s\)/);
  });

  it("rejects kind=framework without `language`", () => {
    const result = runWithPacks({
      django: {
        "pack.yml": packYml({
          id: "django", kind: "framework", status: "stable", since: "1.4.0",
        }),
      },
    });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toMatch(/kind=framework requires language/);
  });

  it("rejects kind=language without `testRunner`", () => {
    const result = runWithPacks({
      python: {
        "pack.yml": packYml({
          id: "python", kind: "language", status: "stable", since: "1.4.0",
        }),
      },
    });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toMatch(/kind=language requires testRunner/);
  });

  it("rejects kind=mobile without `mobilePlatform`", () => {
    const result = runWithPacks({
      "ios-swiftui": {
        "pack.yml": packYml({
          id: "ios-swiftui", kind: "mobile", status: "stable", since: "1.4.0",
        }),
      },
    });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toMatch(/kind=mobile requires mobilePlatform/);
  });

  it("rejects a reference to a missing pack", () => {
    const result = runWithPacks({
      django: {
        "pack.yml": packYml({
          id: "django", kind: "framework", status: "stable",
          since: "1.4.0", language: "ghost",
        }),
      },
    });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toMatch(/references missing pack `ghost`/);
  });

  it("rejects bidirectional inconsistency (language doesn't list framework back)", () => {
    const result = runWithPacks({
      python: {
        "pack.yml": packYml({
          id: "python", kind: "language", status: "stable",
          since: "1.4.0", testRunner: "pytest",
        }),
      },
      django: {
        "pack.yml": packYml({
          id: "django", kind: "framework", status: "stable",
          since: "1.4.0", language: "python",
        }),
      },
    });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toMatch(/that language pack's frameworks list does not include `django`/);
  });

  it("rejects pack id mismatch with directory name", () => {
    const result = runWithPacks({
      python: {
        "pack.yml": packYml({
          id: "py3", kind: "language", status: "stable",
          since: "1.4.0", testRunner: "pytest",
        }),
      },
    });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toMatch(/does not match directory name/);
  });

  it("rejects a *Ref pointing at a missing file", () => {
    const result = runWithPacks({
      python: {
        "pack.yml": packYml({
          id: "python", kind: "language", status: "stable",
          since: "1.4.0", testRunner: "pytest",
          langRef: "language.md",
        }),
      },
    });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toMatch(/langRef → `language\.md` does not exist/);
  });

  it("rejects defaultPlatform not in supportedPlatforms", () => {
    const result = runWithPacks({
      "fly-io": {
        "pack.yml": packYml({
          id: "fly-io", kind: "deploy-target", status: "stable", since: "1.4.0",
        }),
      },
      "render": {
        "pack.yml": packYml({
          id: "render", kind: "deploy-target", status: "stable", since: "1.4.0",
        }),
      },
      python: {
        "pack.yml": packYml({
          id: "python", kind: "language", status: "stable",
          since: "1.4.0", testRunner: "pytest", frameworks: ["django"],
        }),
      },
      django: {
        "pack.yml": packYml({
          id: "django", kind: "framework", status: "stable",
          since: "1.4.0", language: "python",
          defaultPlatform: "fly-io",
          supportedPlatforms: ["render"],
        }),
      },
    });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toMatch(/defaultPlatform `fly-io` must be a member of supportedPlatforms/);
  });

  it("two valid packs with different statuses both produce flags", () => {
    const result = runWithPacks({
      python: {
        "pack.yml": packYml({
          id: "python", kind: "language", status: "stable",
          since: "1.4.0", testRunner: "pytest",
        }),
      },
      ruby: {
        "pack.yml": packYml({
          id: "ruby", kind: "language", status: "beta",
          since: "1.4.0", testRunner: "rspec",
        }),
      },
    });
    const detail = `stdout:\n${result.stdout}\nstderr:\n${result.stderr}`;
    expect(result.status, detail).toBe(0);
    expect(result.stdout).toMatch(/2 pack\(s\), 2 coverage flag\(s\)/);
  });
});

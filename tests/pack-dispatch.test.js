/**
 * Tests for src/lib/pack-dispatch.js (v1.4 PR 3 — runtime half of
 * the hybrid driver semantics).
 *
 *   getLanguagePack(id)   — load + parse pack.yml; null if missing.
 *   getDispatchTarget(id) — extract defaultPlatform + supportedPlatforms.
 *   dispatchMobile(id)    — render checklist envelope for kind=mobile.
 *
 * Real packs/ + synthetic fixtures (env-var swap).
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { getLanguagePack, getDispatchTarget, dispatchMobile } from "../src/lib/pack-dispatch.js";

function packYml(obj) {
  return Object.entries(obj)
    .map(([k, v]) => {
      if (Array.isArray(v)) return `${k}: [${v.join(", ")}]`;
      return `${k}: ${v}`;
    })
    .join("\n") + "\n";
}

function makeFixture(packs) {
  const work = mkdtempSync(join(tmpdir(), "opchain-pack-dispatch-"));
  for (const [id, files] of Object.entries(packs)) {
    const dir = join(work, id);
    mkdirSync(dir, { recursive: true });
    for (const [name, body] of Object.entries(files)) {
      writeFileSync(join(dir, name), body, "utf8");
    }
  }
  return work;
}

// All language packs that ship in the current release. PR 2 (ADEV-329) seeded
// the first 5; PR 4 (ADEV-334) added elixir/bun/deno alongside the modern web
// framework packs; PR 5 (ADEV-335) added java/csharp/kotlin/php alongside the
// enterprise framework packs. None of them declare deploy-target platforms
// yet — those land in PR 7. Until then deploy-ops falls back to the SKILL.md
// matrix.
const REAL_LANGUAGE_PACKS = [
  "typescript", "python", "ruby", "go", "rust",
  "elixir", "bun", "deno",
  "java", "csharp", "kotlin", "php",
];

describe("pack-dispatch — real packs (PR 2 + PR 4 + PR 5 backfill)", () => {
  // No env override — read the real skills/stack-forge/packs/ tree.
  beforeEach(() => { delete process.env.OPCHAIN_PACKS_DIR; });

  it("getLanguagePack returns every backfilled language pack", () => {
    for (const id of REAL_LANGUAGE_PACKS) {
      const pack = getLanguagePack(id);
      expect(pack, `pack ${id}`).not.toBeNull();
      expect(pack.id).toBe(id);
      expect(pack.kind).toBe("language");
      expect(pack.status).toBe("stable");
    }
  });

  it("getLanguagePack returns the parsed pack regardless of kind (framework packs included)", () => {
    // The helper is named for its dominant caller but is a generic
    // "load pack by id". Framework packs come back with kind=framework
    // and the language field set — callers that need a language shape
    // check `pack.kind === "language"` themselves.
    for (const [id, expectedLanguage] of [
      ["phoenix", "elixir"], ["remix", "typescript"],
      ["sveltekit", "typescript"], ["solid", "typescript"],
      ["spring-java", "java"], ["dotnet-aspnet", "csharp"],
      ["spring-kotlin", "kotlin"], ["laravel-php", "php"],
    ]) {
      const pack = getLanguagePack(id);
      expect(pack, `pack ${id}`).not.toBeNull();
      expect(pack.kind).toBe("framework");
      expect(pack.language).toBe(expectedLanguage);
    }
  });

  it("getLanguagePack returns null for a missing pack", () => {
    expect(getLanguagePack("does-not-exist")).toBeNull();
  });

  it("getLanguagePack throws on invalid id pattern", () => {
    expect(() => getLanguagePack("BAD-ID")).toThrow(/invalid pack id/);
    expect(() => getLanguagePack("")).toThrow(/invalid pack id/);
    expect(() => getLanguagePack("1bad")).toThrow(/invalid pack id/);
  });

  it("getDispatchTarget returns {defaultPlatform:null, supportedPlatforms:[]} for every language pack", () => {
    // Language packs do not declare platforms — those land with the
    // deploy-target packs in PR 7. deploy-ops should treat this as "fall
    // back to the SKILL.md hardcoded matrix".
    for (const id of REAL_LANGUAGE_PACKS) {
      expect(getDispatchTarget(id), `pack ${id}`).toEqual({
        defaultPlatform: null,
        supportedPlatforms: [],
      });
    }
  });

  it("getDispatchTarget returns {defaultPlatform:null, supportedPlatforms:[]} for the PR 4 + PR 5 framework packs", () => {
    // PR 4 + PR 5 framework packs ship without declared platforms either —
    // they're a no-op for deploy-ops until PR 7's hosting adapters land.
    for (const id of [
      "phoenix", "remix", "sveltekit", "solid",
      "spring-java", "dotnet-aspnet", "spring-kotlin", "laravel-php",
    ]) {
      expect(getDispatchTarget(id), `pack ${id}`).toEqual({
        defaultPlatform: null,
        supportedPlatforms: [],
      });
    }
  });

  it("getDispatchTarget returns null for a missing pack", () => {
    expect(getDispatchTarget("ghost")).toBeNull();
  });
});

describe("pack-dispatch — synthetic fixtures", () => {
  let savedEnv;
  beforeEach(() => { savedEnv = process.env.OPCHAIN_PACKS_DIR; });
  afterEach(() => {
    if (savedEnv === undefined) delete process.env.OPCHAIN_PACKS_DIR;
    else process.env.OPCHAIN_PACKS_DIR = savedEnv;
  });

  it("getDispatchTarget surfaces declared defaultPlatform + supportedPlatforms", () => {
    process.env.OPCHAIN_PACKS_DIR = makeFixture({
      "fly-io": {
        "pack.yml": packYml({
          id: "fly-io", kind: "deploy-target", status: "stable", since: "1.4.0",
        }),
      },
      render: {
        "pack.yml": packYml({
          id: "render", kind: "deploy-target", status: "stable", since: "1.4.0",
        }),
      },
      django: {
        "pack.yml": packYml({
          id: "django", kind: "framework", status: "stable", since: "1.4.0",
          language: "python",
          defaultPlatform: "render",
          supportedPlatforms: ["render", "fly-io"],
        }),
      },
    });
    expect(getDispatchTarget("django")).toEqual({
      defaultPlatform: "render",
      supportedPlatforms: ["render", "fly-io"],
    });
  });
});

describe("dispatchMobile", () => {
  let savedEnv;
  beforeEach(() => { savedEnv = process.env.OPCHAIN_PACKS_DIR; });
  afterEach(() => {
    if (savedEnv === undefined) delete process.env.OPCHAIN_PACKS_DIR;
    else process.env.OPCHAIN_PACKS_DIR = savedEnv;
  });

  it("returns a checklist envelope for kind=mobile packs", () => {
    process.env.OPCHAIN_PACKS_DIR = makeFixture({
      "ios-swiftui": {
        "pack.yml": packYml({
          id: "ios-swiftui",
          displayName: "iOS (SwiftUI)",
          kind: "mobile", mobilePlatform: "ios",
          status: "stable", since: "1.4.0",
          mobileRef: "mobile.md",
        }),
        "mobile.md": "# iOS SwiftUI release checklist\n",
      },
    });
    const out = dispatchMobile("ios-swiftui");
    expect(out).toMatchObject({
      kind: "mobile",
      platform: "ios",
      displayName: "iOS (SwiftUI)",
      mobileRef: "mobile.md",
    });
    expect(out.releaseChecklist).toContain("checklist-driven, not automated");
    expect(out.releaseChecklist).toContain("App Store");
  });

  it("returns kind:not-mobile for a non-mobile pack (caller should fall back)", () => {
    process.env.OPCHAIN_PACKS_DIR = makeFixture({
      python: {
        "pack.yml": packYml({
          id: "python", kind: "language", status: "stable",
          since: "1.4.0", testRunner: "pytest",
        }),
      },
    });
    expect(dispatchMobile("python")).toEqual({ kind: "not-mobile", actualKind: "language" });
  });

  it("returns null for a missing pack", () => {
    process.env.OPCHAIN_PACKS_DIR = makeFixture({});
    expect(dispatchMobile("ghost")).toBeNull();
  });

  it("works for android / flutter / react-native platforms (PR 6.5 preview)", () => {
    for (const platform of ["android", "flutter", "react-native"]) {
      const dir = makeFixture({
        [`m-${platform}`]: {
          "pack.yml": packYml({
            id: `m-${platform}`, kind: "mobile",
            mobilePlatform: platform,
            status: "experimental", since: "1.4.0",
          }),
        },
      });
      process.env.OPCHAIN_PACKS_DIR = dir;
      const out = dispatchMobile(`m-${platform}`);
      expect(out).toMatchObject({ kind: "mobile", platform });
    }
  });
});

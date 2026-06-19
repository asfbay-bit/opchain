import { describe, it, expect } from "vitest";
import { FLAGS, FLAG_NAMES, PUBLIC_FLAG_NAMES, getDefault, isKnown, CATEGORIES } from "../src/lib/flags/registry.js";

describe("flag registry", () => {
  it("declares at least one flag", () => {
    expect(FLAG_NAMES.length).toBeGreaterThan(0);
  });

  it("every flag has the required shape", () => {
    for (const name of FLAG_NAMES) {
      const def = FLAGS[name];
      expect(def.name).toBe(name);
      expect(["boolean", "string", "number"]).toContain(def.type);
      expect(typeof def.default).toBe(def.type);
      expect(CATEGORIES).toContain(def.category);
      expect(typeof def.owner).toBe("string");
      expect(def.owner.length).toBeGreaterThan(0);
      expect(typeof def.description).toBe("string");
      expect(def.description.length).toBeGreaterThan(0);
    }
  });

  it("flag names match the dot-namespaced regex", () => {
    const re = /^[a-z][a-z0-9-]*(\.[a-z][a-z0-9-]*)+$/;
    for (const name of FLAG_NAMES) expect(name).toMatch(re);
  });

  it("FLAG_NAMES has no duplicates", () => {
    expect(new Set(FLAG_NAMES).size).toBe(FLAG_NAMES.length);
  });

  it("every public flag is also in the main registry", () => {
    for (const name of PUBLIC_FLAG_NAMES) expect(isKnown(name)).toBe(true);
  });

  it("ops-category flags default to false (kill switches off in steady state)", () => {
    for (const name of FLAG_NAMES) {
      const def = FLAGS[name];
      if (def.category === "ops" && name.endsWith(".kill")) {
        expect(def.default).toBe(false);
      }
    }
  });

  it("getDefault returns the registered default", () => {
    expect(getDefault("site.feature.feedback-widget")).toBe(true);
    expect(getDefault("site.ops.api-feedback.kill")).toBe(false);
  });

  it("getDefault throws on unknown flag", () => {
    expect(() => getDefault("not.a.flag")).toThrow(/unknown flag/);
  });

  it("isKnown discriminates", () => {
    expect(isKnown("site.feature.feedback-widget")).toBe(true);
    expect(isKnown("site.feature.does-not-exist")).toBe(false);
  });

  it("public list excludes ops + permission flags", () => {
    for (const name of PUBLIC_FLAG_NAMES) {
      const def = FLAGS[name];
      expect(def.category).not.toBe("ops");
      expect(def.category).not.toBe("permission");
    }
  });

  it("includes a flag for every skill in the registry", () => {
    const expected = [
      "oc-api-dev", "oc-app-architect", "oc-bug-check", "oc-checkpoint-protocol",
      "oc-code-auditor", "oc-dash-forge", "oc-deploy-ops", "oc-git-ops",
      "oc-integrations-engineer", "oc-migration-ops", "oc-monitoring-ops",
      "oc-orchestrator", "oc-reverse-spec", "oc-scale-ops", "oc-security-auditor",
      "oc-stack-forge", "oc-ux-engineer",
    ];
    for (const id of expected) {
      expect(isKnown(`skills.registry.${id}.enabled`)).toBe(true);
    }
  });
});

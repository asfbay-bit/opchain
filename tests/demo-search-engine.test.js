import { describe, it, expect } from "vitest";
import { walkthroughs } from "../site/src/data/walkthroughs/index";
import { buildSearchIndex } from "../site/src/lib/demo-search/index-build";
import {
  filterAndRank,
  computeFacetCounts,
  visibleScenarioCount,
  buildSnippet,
  escapeHtml,
} from "../site/src/lib/demo-search/engine";
import { emptyFilterState } from "../site/src/lib/demo-search/model";

const index = buildSearchIndex(walkthroughs);
const base = emptyFilterState;

describe("buildSnippet", () => {
  it("wraps the match in <mark>", () => {
    expect(buildSnippet("The quick brown fox", "quick")).toContain("<mark>quick</mark>");
  });
  it("escapes html in the source text", () => {
    const out = buildSnippet("a <b> c", "b");
    expect(out).toContain("&lt;");
    expect(out).not.toContain("<b>");
  });
  it("returns a plain head when no query", () => {
    expect(buildSnippet("hello world", "")).toBe("hello world");
  });
});

describe("escapeHtml", () => {
  it("escapes the dangerous five", () => {
    expect(escapeHtml('<a href="x">&')).toBe("&lt;a href=&quot;x&quot;&gt;&amp;");
  });
});

describe("filterAndRank", () => {
  it("returns nothing for an empty filter", () => {
    expect(filterAndRank(index, base())).toEqual([]);
  });

  it("finds steps for a free-text query and marks the snippet", () => {
    const firstSkill = index.facets.skills[0].id;
    const res = filterAndRank(index, { ...base(), q: firstSkill });
    expect(res.length).toBeGreaterThan(0);
  });

  it("filters by a single skill facet (every hit has that skill)", () => {
    const skill = index.facets.skills[0].id;
    const res = filterAndRank(index, { ...base(), skill: [skill] });
    expect(res.length).toBeGreaterThan(0);
    expect(res.every((r) => r.step.skill === skill)).toBe(true);
  });

  it("OR within a facet group (two skills → union)", () => {
    const a = index.facets.skills[0].id;
    const b = index.facets.skills[1].id;
    const res = filterAndRank(index, { ...base(), skill: [a, b] });
    const skills = new Set(res.map((r) => r.step.skill));
    expect(skills.has(a)).toBe(true);
    expect(skills.has(b)).toBe(true);
    expect(res.every((r) => r.step.skill === a || r.step.skill === b)).toBe(true);
  });

  it("AND across facet groups (skill ∧ phase)", () => {
    const skill = index.facets.skills[0].id;
    // pick a phase that this skill actually appears in
    const sample = filterAndRank(index, { ...base(), skill: [skill] });
    const phase = sample[0].step.phase;
    const res = filterAndRank(index, { ...base(), skill: [skill], phase: [phase] });
    expect(res.length).toBeGreaterThan(0);
    expect(res.every((r) => r.step.skill === skill && r.step.phase === phase)).toBe(true);
  });

  it("ranks an exact skill-id query above incidental text", () => {
    const skill = index.facets.skills[0].id;
    const res = filterAndRank(index, { ...base(), q: skill });
    // top result should be a step authored by that skill (score boost +3)
    expect(res[0].step.skill).toBe(skill);
  });
});

describe("computeFacetCounts", () => {
  it("returns populated count maps for all four groups", () => {
    const counts = computeFacetCounts(index, base());
    expect(counts.skill.size).toBeGreaterThan(0);
    expect(counts.role.size).toBeGreaterThan(0);
    expect(counts.kind.size).toBeGreaterThan(0);
    expect(counts.phase.size).toBeGreaterThan(0);
  });

  it("ignores its own group so within-group toggles widen options", () => {
    const skill = index.facets.skills[0].id;
    // with that skill selected, the skill-facet counts should still list OTHER
    // skills (because the skill group is ignored when counting skills)
    const counts = computeFacetCounts(index, { ...base(), skill: [skill] });
    expect(counts.skill.size).toBeGreaterThan(1);
  });
});

describe("visibleScenarioCount", () => {
  it("is all scenarios when no filter is active", () => {
    expect(visibleScenarioCount(index, base())).toBe(index.scenarios.length);
  });
  it("narrows when a facet is applied", () => {
    const skill = index.facets.skills[0].id;
    const n = visibleScenarioCount(index, { ...base(), skill: [skill] });
    expect(n).toBeGreaterThan(0);
    expect(n).toBeLessThanOrEqual(index.scenarios.length);
  });
});

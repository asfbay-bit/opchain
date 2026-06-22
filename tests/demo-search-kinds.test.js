import { describe, it, expect } from "vitest";
import { walkthroughs } from "../site/src/data/walkthroughs/index";
import { normalizeKind, ARTIFACT_KIND_ORDER } from "../site/src/lib/demo-search/kinds";

describe("normalizeKind", () => {
  const corpusKinds = new Set();
  for (const w of walkthroughs) {
    for (const o of w.outputs) if (o.kind) corpusKinds.add(o.kind);
  }

  it("maps every artifact kind in the corpus to a non-'other' bucket", () => {
    const unmapped = [...corpusKinds].filter((k) => normalizeKind(k) === "other");
    expect(unmapped).toEqual([]);
  });

  it("every mapped value is a member of the canonical vocabulary", () => {
    for (const k of corpusKinds) {
      expect(ARTIFACT_KIND_ORDER).toContain(normalizeKind(k));
    }
  });

  it("returns 'other' for empty / nullish / nonsense", () => {
    expect(normalizeKind("")).toBe("other");
    expect(normalizeKind(undefined)).toBe("other");
    expect(normalizeKind(null)).toBe("other");
    expect(normalizeKind("qqzz-not-a-real-kind")).toBe("other");
  });

  it("buckets representative raws correctly", () => {
    expect(normalizeKind("linear.md")).toBe("ticket");
    expect(normalizeKind("spec.md")).toBe("spec");
    expect(normalizeKind("threat-model.md")).toBe("audit");
    expect(normalizeKind("render.yaml")).toBe("config");
    expect(normalizeKind("pull-request")).toBe("pull-request");
    expect(normalizeKind("runbook")).toBe("runbook");
    expect(normalizeKind("deploy.log")).toBe("data");
  });
});

import { gzipSync } from "node:zlib";
import { describe, it, expect } from "vitest";
import { walkthroughs } from "../site/src/data/walkthroughs/index";
import { buildSearchIndex } from "../site/src/lib/demo-search/index-build";
import { PHASE_ORDER } from "../site/src/lib/demo-search/phases";

const index = buildSearchIndex(walkthroughs);

describe("buildSearchIndex", () => {
  it("indexes every scenario and every step", () => {
    expect(index.scenarios).toHaveLength(walkthroughs.length);
    index.scenarios.forEach((s, i) => {
      expect(s.steps).toHaveLength(walkthroughs[i].steps.length);
    });
  });

  it("gives every step a phase from the controlled vocabulary", () => {
    for (const s of index.scenarios) {
      for (const st of s.steps) {
        expect(PHASE_ORDER).toContain(st.phase);
      }
    }
  });

  it("assigns stable, unique s{n} step ids in order", () => {
    for (const s of index.scenarios) {
      const ids = s.steps.map((st) => st.id);
      expect(ids).toEqual(s.steps.map((_, i) => `s${i}`));
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it("inherits the nearest preceding beat's phase for exchanges", () => {
    walkthroughs.forEach((w, i) => {
      let running =
        w.steps.find((s) => s.type === "beat")?.phase ?? "discover";
      w.steps.forEach((raw, si) => {
        if (raw.type === "beat") running = raw.phase;
        expect(index.scenarios[i].steps[si].phase).toBe(running);
      });
    });
  });

  it("indexes artifact kinds against the referencing claude step", () => {
    // Find a claude step that references at least one artifact and assert its
    // artifactKinds are populated and canonical.
    let checked = 0;
    walkthroughs.forEach((w, i) => {
      w.steps.forEach((raw, si) => {
        if (raw.type === "exchange" && raw.role === "claude" && (raw.artifacts ?? []).length) {
          const step = index.scenarios[i].steps[si];
          expect(step.kind).toBe("claude");
          expect(step.artifactKinds.length).toBeGreaterThan(0);
          checked++;
        }
      });
    });
    expect(checked).toBeGreaterThan(0);
  });

  it("builds non-empty facet universes", () => {
    expect(index.facets.skills.length).toBeGreaterThan(0);
    expect(index.facets.roles.length).toBeGreaterThan(0);
    expect(index.facets.kinds.length).toBeGreaterThan(0);
    expect(index.facets.phases.length).toBeGreaterThan(0);
    // phase facet ids are valid phases, ordered by the pipeline
    const order = index.facets.phases.map((f) => f.id);
    const expected = PHASE_ORDER.filter((p) => order.includes(p));
    expect(order).toEqual(expected);
  });

  it("stays within the inlined-index payload budget (≤120KB gzipped)", () => {
    // The index ships inline in /demo as a JSON <script>; this guards against
    // it bloating the page. Tripwire, not a guess — see 06-testing.md.
    const gz = gzipSync(Buffer.from(JSON.stringify(index))).length;
    expect(gz).toBeLessThan(120 * 1024);
  });

  it("strips markdown from claude step text", () => {
    const withCode = index.scenarios
      .flatMap((s) => s.steps)
      .find((st) => st.kind === "claude" && st.display.length > 0);
    expect(withCode).toBeTruthy();
    // no fence/asterisk noise left in the searchable text
    expect(withCode.text).not.toMatch(/```/);
  });
});

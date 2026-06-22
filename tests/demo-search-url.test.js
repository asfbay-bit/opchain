import { describe, it, expect } from "vitest";
import { parseUrlState, serializeUrlState } from "../site/src/lib/demo-search/url-state";
import { emptyFilterState } from "../site/src/lib/demo-search/model";

describe("url-state round trip", () => {
  it("serializes then parses back to the same state", () => {
    const state = {
      q: "rollback",
      skill: ["oc-deploy-ops", "oc-git-ops"],
      role: ["audit-gate"],
      kind: ["runbook"],
      phase: ["ship"],
      target: { scenario: "runtime-pm-loop", step: "s12" },
    };
    const url = serializeUrlState(state);
    const i = url.indexOf("#");
    const search = i === -1 ? url : url.slice(0, i);
    const hash = i === -1 ? "" : url.slice(i);
    expect(parseUrlState(search, hash)).toEqual(state);
  });

  it("empty state serializes to empty string", () => {
    expect(serializeUrlState(emptyFilterState())).toBe("");
  });

  it("drops unknown facet values rather than throwing", () => {
    const s = parseUrlState("?role=not-a-role&kind=nope&phase=bogus&skill=oc-x", "");
    expect(s.role).toEqual([]);
    expect(s.kind).toEqual([]);
    expect(s.phase).toEqual([]);
    // skill is open-ended, kept verbatim (engine simply won't match it)
    expect(s.skill).toEqual(["oc-x"]);
  });

  it("parses a comma list as OR-within-facet", () => {
    const s = parseUrlState("?skill=a,b,c", "");
    expect(s.skill).toEqual(["a", "b", "c"]);
  });

  it("ignores a malformed hash target", () => {
    expect(parseUrlState("", "#no-colon-here").target).toBeNull();
    expect(parseUrlState("", "#scenario:notastep").target).toBeNull();
    expect(parseUrlState("", "").target).toBeNull();
  });

  it("parses a well-formed deep-link hash", () => {
    expect(parseUrlState("", "#postgres-migration:s8").target).toEqual({
      scenario: "postgres-migration",
      step: "s8",
    });
  });
});

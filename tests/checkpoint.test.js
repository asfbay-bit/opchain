import { describe, it, expect } from "vitest";
import {
  validate,
  rankCheckpoint,
  pickNext,
  recommendedAction,
  actionText,
  SCHEMA_VERSION,
} from "../scripts/checkpoint.mjs";

// A minimal, fully-valid in_progress checkpoint to clone per-test.
function base(overrides = {}) {
  const now = "2026-06-01T12:00:00Z";
  return {
    protocol_version: SCHEMA_VERSION,
    skill: "demo",
    project: "demo",
    project_dir: "/tmp/demo",
    created_at: now,
    updated_at: now,
    phase: "build",
    step: "sprint-1",
    status: "in_progress",
    progress_summary: "Working on sprint 1.",
    next_actions: ["Do the next thing"],
    ...overrides,
  };
}
const PATH = ".checkpoints/demo.checkpoint.json";
const errs = (data, path = PATH) => validate(path, data, 0).errors;

describe("checkpoint validator — required fields & schema version", () => {
  it("accepts a valid in_progress checkpoint", () => {
    expect(errs(base())).toEqual([]);
  });

  it("flags a missing required field", () => {
    const d = base();
    delete d.progress_summary;
    expect(errs(d).some((e) => /progress_summary/.test(e))).toBe(true);
  });

  it("rejects a wrong protocol_version and explains schema-vs-release", () => {
    const e = errs(base({ protocol_version: "1.2" }));
    expect(e.some((x) => /schema version/.test(x))).toBe(true);
  });

  it("rejects a bad top-level status enum", () => {
    expect(errs(base({ status: "done" })).some((e) => /status must be/.test(e))).toBe(true);
  });

  it("enforces filename ↔ skill consistency", () => {
    expect(errs(base({ skill: "other" })).some((e) => /does not match skill/.test(e))).toBe(true);
  });
});

describe("checkpoint validator — next_actions (resume linchpin)", () => {
  it("requires non-empty next_actions when in_progress", () => {
    expect(errs(base({ next_actions: [] })).some((e) => /next_actions must be a non-empty/.test(e))).toBe(true);
  });

  it("allows empty next_actions when complete", () => {
    expect(errs(base({ status: "complete", next_actions: [] }))).toEqual([]);
  });

  it("accepts the { text, done_when } action form", () => {
    const d = base({ next_actions: [{ text: "ship", done_when: "curl -f /api/health" }] });
    expect(errs(d)).toEqual([]);
  });

  it("rejects a non-string done_when", () => {
    const d = base({ next_actions: [{ text: "ship", done_when: 42 }] });
    expect(errs(d).some((e) => /done_when must be a string/.test(e))).toBe(true);
  });
});

describe("checkpoint validator — blockers, pm_refs, timestamps", () => {
  it("validates the blockers[].needs enum (drives the priority engine)", () => {
    const d = base({ blockers: [{ id: "b1", description: "x", needs: "wat" }] });
    expect(errs(d).some((e) => /needs must be one of/.test(e))).toBe(true);
  });

  it("accepts a well-formed pm_refs entry and rejects a bad role", () => {
    expect(errs(base({ pm_refs: [{ provider: "linear", id: "ADEV-1", role: "source" }] }))).toEqual([]);
    expect(errs(base({ pm_refs: [{ provider: "linear", id: "ADEV-1", role: "nope" }] }))
      .some((e) => /role must be one of/.test(e))).toBe(true);
  });

  it("rejects updated_at before created_at", () => {
    const d = base({ created_at: "2026-06-02T12:00:00Z", updated_at: "2026-06-01T12:00:00Z" });
    expect(errs(d).some((e) => /before created_at/.test(e))).toBe(true);
  });
});

describe("priority engine", () => {
  it("ranks a user_decision blocker highest, not-started lowest", () => {
    const decision = base({ blockers: [{ id: "b1", description: "approve?", needs: "user_decision" }] });
    const failed = base({ status: "failed" });
    const midwork = base();
    const notStarted = base({ status: "complete", next_actions: [] });
    expect(rankCheckpoint(decision)).toBe(1);
    expect(rankCheckpoint(failed)).toBe(2);
    expect(rankCheckpoint(midwork)).toBe(4);
    expect(rankCheckpoint(notStarted)).toBe(6);
  });

  it("treats a gate step as higher priority than mid-work", () => {
    const gate = base({ step: "spec-gate awaiting approval" });
    expect(rankCheckpoint(gate)).toBe(3);
  });

  it("pickNext surfaces the bottleneck across checkpoints", () => {
    const cps = [
      { data: base({ skill: "a" }) },
      { data: base({ skill: "b", blockers: [{ id: "b1", description: "approve?", needs: "user_decision" }] }) },
    ];
    expect(pickNext(cps).data.skill).toBe("b");
  });

  it("recommendedAction explains a user_decision blocker", () => {
    const d = base({ blockers: [{ id: "b1", description: "pick A or B", needs: "user_decision", proposed_resolution: "go with A" }] });
    const rec = recommendedAction(d);
    expect(rec.why).toMatch(/pick A or B/);
    expect(rec.action).toMatch(/go with A/);
  });
});

describe("actionText", () => {
  it("normalizes string and object actions", () => {
    expect(actionText("hello")).toBe("hello");
    expect(actionText({ text: "hi", done_when: "x" })).toBe("hi");
  });
});

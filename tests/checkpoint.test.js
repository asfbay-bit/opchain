import { describe, it, expect } from "vitest";
import {
  validate,
  rankCheckpoint,
  pickNext,
  recommendedAction,
  actionText,
  actionDrift,
  buildDriftContext,
  budgetExceeded,
  SCHEMA_VERSION,
  ACCEPTED_SCHEMA_VERSIONS,
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

  it("stamps the current wire version 1.1 and accepts both 1.0 and 1.1", () => {
    expect(SCHEMA_VERSION).toBe("1.1");
    expect(ACCEPTED_SCHEMA_VERSIONS).toEqual(["1.0", "1.1"]);
    // 1.0 checkpoints predate the v1.1 fields and must stay valid.
    expect(errs(base({ protocol_version: "1.0" }))).toEqual([]);
    expect(errs(base({ protocol_version: "1.1" }))).toEqual([]);
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

describe("checkpoint validator — v1.1 additive fields (cost / eval_scores / telemetry_handle)", () => {
  it("omitting all three keeps a checkpoint valid (they're optional)", () => {
    expect(errs(base())).toEqual([]);
  });

  it("accepts a well-formed cost block and rejects negative / non-number spend", () => {
    expect(errs(base({ cost: { currency: "USD", total_usd: 12.34, budget_usd: 50, by_phase: { spec: 3.1 }, by_model: { "claude-opus-4-8": 8 } } }))).toEqual([]);
    expect(errs(base({ cost: { total_usd: -1 } })).some((e) => /cost\.total_usd must be a non-negative/.test(e))).toBe(true);
    expect(errs(base({ cost: { by_phase: { spec: "lots" } } })).some((e) => /cost\.by_phase\["spec"\] must be a non-negative/.test(e))).toBe(true);
    expect(errs(base({ cost: [1, 2] })).some((e) => /cost must be an object/.test(e))).toBe(true);
  });

  it("warns (does not error) when total_usd exceeds budget_usd — the budget gate", () => {
    const { errors, warnings } = validate(PATH, base({ cost: { total_usd: 80, budget_usd: 50 } }), 0);
    expect(errors).toEqual([]);
    expect(warnings.some((w) => /budget gate tripped/.test(w))).toBe(true);
  });

  it("accepts eval_scores and rejects missing rubric / non-number / over-max", () => {
    expect(errs(base({ eval_scores: [{ rubric: "oc-code-auditor", score: 8.2, max: 10, at: "2026-06-25T12:00:00Z", dimensions: { functionality: 9 } }] }))).toEqual([]);
    expect(errs(base({ eval_scores: [{ rubric: "oc-prompt-ops", score: 0.93, max: 1 }] }))).toEqual([]); // 0..1 scale
    expect(errs(base({ eval_scores: [{ score: 8 }] })).some((e) => /rubric required/.test(e))).toBe(true);
    expect(errs(base({ eval_scores: [{ rubric: "x", score: "high" }] })).some((e) => /score must be a number/.test(e))).toBe(true);
    expect(errs(base({ eval_scores: [{ rubric: "x", score: 11, max: 10 }] })).some((e) => /exceeds max/.test(e))).toBe(true);
    expect(errs(base({ eval_scores: { rubric: "x", score: 8 } })).some((e) => /eval_scores must be an array/.test(e))).toBe(true);
  });

  it("accepts telemetry_handle as a string or an opt-in object, rejects bad shapes", () => {
    expect(errs(base({ telemetry_handle: "anon-7f3a" }))).toEqual([]);
    expect(errs(base({ telemetry_handle: { enabled: false } }))).toEqual([]);
    expect(errs(base({ telemetry_handle: { enabled: true, id: "anon-7f3a", sink: ".checkpoints/usage.sqlite", since: "2026-06-25T12:00:00Z" } }))).toEqual([]);
    expect(errs(base({ telemetry_handle: { enabled: "yes" } })).some((e) => /enabled must be a boolean/.test(e))).toBe(true);
    expect(errs(base({ telemetry_handle: 42 })).some((e) => /telemetry_handle must be a string handle or an object/.test(e))).toBe(true);
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

  it("detects stale next_actions that reference completed PRs", () => {
    const completed = base({
      skill: "release",
      status: "complete",
      next_actions: [],
      progress_table: [{ id: "pr-351", label: "PR #351 merged", status: "complete" }],
    });
    const stale = base({ skill: "architect", next_actions: ["Watch PR #351 CI to green"] });
    const drift = buildDriftContext([{ data: completed }, { data: stale }], { gitTokens: new Set() });

    expect(actionDrift(stale.next_actions[0], drift)).toMatchObject({ token: "#351" });
  });

  it("recommendedAction refuses to recommend completed PR work", () => {
    const completed = base({
      skill: "release",
      status: "complete",
      next_actions: [],
      progress_table: [{ id: "pr-351", label: "PR #351 merged", status: "complete" }],
    });
    const stale = base({ skill: "architect", next_actions: ["Watch PR #351 CI to green"] });
    const drift = buildDriftContext([{ data: completed }, { data: stale }], { gitTokens: new Set() });
    const rec = recommendedAction(stale, drift);

    expect(rec.why).toMatch(/completed\/merged/);
    expect(rec.action).toMatch(/Reconcile/);
    expect(rec.action).not.toMatch(/Watch PR #351/);
  });

  it("recommendedAction skips stale queued work and uses the first fresh action", () => {
    const completed = base({
      skill: "release",
      status: "complete",
      next_actions: [],
      progress_table: [{ id: "pr-351", label: "PR #351 merged", status: "complete" }],
    });
    const mixed = base({
      skill: "architect",
      next_actions: ["Watch PR #351 CI to green", "Plan the next checkpoint reconciliation PR"],
    });
    const drift = buildDriftContext([{ data: completed }, { data: mixed }], { gitTokens: new Set() });
    const rec = recommendedAction(mixed, drift);

    expect(rec.why).toMatch(/Skipped stale next_action/);
    expect(rec.action).toBe("Plan the next checkpoint reconciliation PR");
  });

  it("pickNext prefers a fresh candidate over a stale-only candidate at the same rank", () => {
    const completed = base({
      skill: "release",
      status: "complete",
      next_actions: [],
      progress_table: [{ id: "pr-351", label: "PR #351 merged", status: "complete" }],
    });
    const stale = base({ skill: "stale", updated_at: "2026-06-03T12:00:00Z", next_actions: ["Watch PR #351 CI"] });
    const fresh = base({ skill: "fresh", updated_at: "2026-06-01T12:00:00Z", next_actions: ["Do fresh work"] });
    const drift = buildDriftContext([{ data: completed }, { data: stale }, { data: fresh }], { gitTokens: new Set() });

    expect(pickNext([{ data: stale }, { data: fresh }], { drift }).data.skill).toBe("fresh");
  });
});

describe("cost/budget awareness (v1.6 — /oc-ops next)", () => {
  it("budgetExceeded is true only when total exceeds a positive budget", () => {
    expect(budgetExceeded(base({ cost: { total_usd: 80, budget_usd: 50 } }))).toBe(true);
    expect(budgetExceeded(base({ cost: { total_usd: 30, budget_usd: 50 } }))).toBe(false);
    expect(budgetExceeded(base({ cost: { total_usd: 80 } }))).toBe(false); // no budget set
    expect(budgetExceeded(base())).toBe(false); // no cost field
  });

  it("recommendedAction prepends an over-budget note when the budget is tripped", () => {
    const rec = recommendedAction(base({ cost: { total_usd: 80, budget_usd: 50 } }));
    expect(rec.why).toMatch(/over budget/);
  });

  it("over-budget sorts first within the same rank (tiebreaker, not a rank change)", () => {
    const cps = [
      { data: base({ skill: "under", cost: { total_usd: 10, budget_usd: 50 }, updated_at: "2026-06-02T12:00:00Z" }) },
      { data: base({ skill: "over",  cost: { total_usd: 80, budget_usd: 50 }, updated_at: "2026-06-01T12:00:00Z" }) },
    ];
    expect(pickNext(cps).data.skill).toBe("over"); // over-budget wins the tie despite older updated_at
  });

  it("does not override the rank hierarchy — a decision blocker still wins over an over-budget mid-work item", () => {
    const cps = [
      { data: base({ skill: "over", cost: { total_usd: 80, budget_usd: 50 } }) },
      { data: base({ skill: "decision", blockers: [{ id: "b1", description: "approve?", needs: "user_decision" }] }) },
    ];
    expect(pickNext(cps).data.skill).toBe("decision");
  });
});

describe("actionText", () => {
  it("normalizes string and object actions", () => {
    expect(actionText("hello")).toBe("hello");
    expect(actionText({ text: "hi", done_when: "x" })).toBe("hi");
  });
});

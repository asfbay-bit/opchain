// Exercises the oc-code-auditor AI-safety tripwire signatures against a labeled
// fixture set (10 positive + 10 negative per category). This is the runnable
// distillation of the v1.5 Sprint 3 requirement that the rule pack flag injected
// prompts / unsafe tool wiring without firing on benign code.
//
// The signatures are a NECESSARY-NOT-SUFFICIENT pre-screen (the full audit is
// LLM-driven per ai-safety-rules.md). The grade asserted here is the pre-screen's
// detection quality: recall on positives and 1-FPR on negatives. The Sprint 3
// plan requires grade >= B+.

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SIGNATURES = JSON.parse(
  readFileSync(join(ROOT, "skills", "oc-code-auditor", "references", "ai-safety-signatures.json"), "utf8"),
);
const RULE_PACK = readFileSync(
  join(ROOT, "skills", "oc-code-auditor", "references", "ai-safety-rules.md"),
  "utf8",
);
const FIXTURES = readFileSync(join(ROOT, "tests", "fixtures", "ai-safety.jsonl"), "utf8")
  .split("\n")
  .map((l) => l.trim())
  .filter(Boolean)
  .map((l) => JSON.parse(l));

const CATEGORIES = ["prompt-injection", "tool-use"];

// Compile each category's signatures once.
const compiled = Object.fromEntries(
  CATEGORIES.map((cat) => [
    cat,
    SIGNATURES.categories[cat].map((s) => ({ ...s, re: new RegExp(s.pattern, s.flags || "") })),
  ]),
);

// Which signature ids (if any) a text trips within its category.
function tripped(category, text) {
  return compiled[category].filter((s) => s.re.test(text)).map((s) => s.id);
}

// Letter grade from (recall, falsePositiveRate). A >= B+ >= B …
function grade(recall, fpr) {
  if (recall >= 0.95 && fpr <= 0.05) return "A";
  if (recall >= 0.85 && fpr <= 0.15) return "B+";
  if (recall >= 0.75 && fpr <= 0.25) return "B";
  return "C";
}
const PASSING = new Set(["A", "B+"]); // Sprint 3 requires >= B+.

describe("ai-safety signatures — structure", () => {
  it("defines both categories with compiled patterns", () => {
    for (const cat of CATEGORIES) {
      expect(Array.isArray(SIGNATURES.categories[cat])).toBe(true);
      expect(SIGNATURES.categories[cat].length).toBeGreaterThan(0);
    }
  });

  it("the rule pack documents every signature rule id", () => {
    for (const cat of CATEGORIES) {
      for (const s of SIGNATURES.categories[cat]) {
        expect(RULE_PACK.includes(s.id), `ai-safety-rules.md is missing ${s.id}`).toBe(true);
      }
    }
  });
});

describe("ai-safety fixtures — coverage", () => {
  for (const cat of CATEGORIES) {
    it(`${cat}: has >= 10 positive and >= 10 negative cases`, () => {
      const pos = FIXTURES.filter((f) => f.category === cat && f.label === "positive");
      const neg = FIXTURES.filter((f) => f.category === cat && f.label === "negative");
      expect(pos.length).toBeGreaterThanOrEqual(10);
      expect(neg.length).toBeGreaterThanOrEqual(10);
    });
  }

  it("every fixture has a unique id", () => {
    const ids = FIXTURES.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("ai-safety signatures — detection quality (>= B+ per category)", () => {
  for (const cat of CATEGORIES) {
    it(`${cat}: catches positives, passes negatives, grade >= B+`, () => {
      const pos = FIXTURES.filter((f) => f.category === cat && f.label === "positive");
      const neg = FIXTURES.filter((f) => f.category === cat && f.label === "negative");

      const tp = pos.filter((f) => tripped(cat, f.text).length > 0).length;
      const fn = pos.length - tp;
      const fp = neg.filter((f) => tripped(cat, f.text).length > 0).length;
      const tn = neg.length - fp;

      const recall = tp / (tp + fn);
      const fpr = fp / (fp + tn);
      const g = grade(recall, fpr);

      // Surface offenders in the failure message.
      const missed = pos.filter((f) => tripped(cat, f.text).length === 0).map((f) => f.id);
      const falsePos = neg.filter((f) => tripped(cat, f.text).length > 0).map((f) => f.id);
      expect(
        PASSING.has(g),
        `${cat}: grade ${g} (recall ${recall.toFixed(2)}, fpr ${fpr.toFixed(2)}). ` +
          `missed positives: ${missed.join(", ") || "none"}; false positives: ${falsePos.join(", ") || "none"}`,
      ).toBe(true);
    });
  }
});

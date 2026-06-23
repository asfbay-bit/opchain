import type { Walkthrough } from "./types";

/**
 * Scenario (v1.5 AI-native) — a legaltech SaaS runs a Claude-powered contract-
 * review feature and must move off a deprecating model. oc-claude-api produces
 * the migration playbook + the diff PR; oc-prompt-ops runs the golden eval set
 * on the old and new model, proves the delta, and catches the one metric that
 * regressed — fixed as a reviewable prompt-as-code diff with a measured score
 * change. oc-release-ops ships the swap as a versioned release. The thesis:
 * a model swap is a regression-gated change, not a hope.
 */
export const modelMigration: Walkthrough = {
  id: "model-migration",
  title: "Migrate a Claude feature to a new model without regressing",
  tagline: "Model swap, regression-gated",
  summary:
    "A contract-review feature has to move off a deprecating model. oc-claude-api writes the migration playbook; oc-prompt-ops runs the golden set on old vs. new, catches the one metric that dropped, and fixes it as a prompt diff with a measured +score; oc-release-ops ships it.",
  description:
    "Clause is a legaltech SaaS whose core feature extracts clauses from uploaded contracts and flags risky terms — all running on Claude (Sonnet 4.5). The provider posts a deprecation notice: Sonnet 4.5 retires in 90 days. The team is terrified, because the feature is load-bearing and 'just swap the model id' has burned them before — a silent quality drop in clause extraction is a legal-liability event, not a cosmetic regression. oc-claude-api runs the migration: it produces a playbook (what actually changes between 4.5 and 4.6 — token limits, pricing, prompt-compat notes) and a diff PR that makes model selection config, not a literal. Then oc-prompt-ops runs the existing 120-example golden set against both models and reports a per-metric delta: extraction recall and risk-flag precision both improved, but citation-span exactness regressed 4 points on one clause type. That regression is fixed as a prompt-as-code diff (a two-line instruction change) re-scored to a measured +6, and the whole change is gated so it can't merge while any metric is below baseline. oc-release-ops bumps, drafts the changelog, and ships. The artifact set is the migration playbook, the before/after eval, the prompt diff that closed the regression, and the release.",
  inputs: [
    "Legaltech SaaS · contract clause-extraction + risk-flagging feature on Claude (Sonnet 4.5)",
    "Provider deprecation notice: Sonnet 4.5 retires in 90 days",
    "Existing: a 120-example golden set (contract → expected clauses + risk flags) from launch",
    "Hard requirement: no quality regression on extraction — a silent drop is a liability event",
  ],
  outputs: [
    {
      id: "migration-playbook",
      label: "Model migration playbook + diff PR",
      kind: "playbook.md",
      body:
`# Migration Playbook — Sonnet 4.5 → 4.6 (Clause)

**Produced by** oc-claude-api · **Trigger:** provider deprecation notice (Sonnet 4.5 EOL in 90 days) · **Target:** \`claude-sonnet-4-6\` · **Output:** this playbook + a diff PR

## 1. What actually changes (not "just the id")

| Dimension | Sonnet 4.5 (current) | Sonnet 4.6 (target) | Action needed |
|---|---|---|---|
| Model id | \`claude-sonnet-4-5\` | \`claude-sonnet-4-6\` | swap (config, not literal — see §3) |
| Max output tokens | 8,192 | 16,384 | none required; we cap at 4,096 (clause JSON) |
| Pricing (in / out per MTok) | baseline | ~same in / slightly lower out | cost neutral-to-better |
| Prompt-caching behavior | supported | supported, same breakpoints | none |
| Tool-use format | unchanged | unchanged | none |
| Known prompt-compat notes | — | tends to be **more literal** about output schemas; slightly terser by default | re-validate the extraction prompt (§ eval) |

The single behavioral note that matters: 4.6 is more literal about schema instructions and a touch terser. For a JSON-extraction feature that's usually good — but "terser" can clip citation spans, which is exactly what the eval (§ eval-delta) needs to check. **No assumptions: we measure.**

## 2. Migration steps

1. **Make model selection config.** Today the id is a literal in three files. Move it to one place so a swap is a one-line change and a rollback is too.
2. **Pin both ids behind a flag** so the eval harness can run old and new side-by-side on the same inputs.
3. **Run the golden set on both** (handed to oc-prompt-ops, § eval-delta).
4. **Close any regression** as a prompt diff, re-scored (§ prompt-diff).
5. **Gate the swap** on "no metric below baseline."
6. **Ship as a versioned release** (handed to oc-release-ops).

## 3. The diff (model id → config)

\`\`\`diff
# lib/llm/config.ts  (new — single source of truth)
+ export const MODELS = {
+   clauseExtract: process.env.CLAUSE_MODEL ?? "claude-sonnet-4-6",
+   riskFlag:      process.env.RISK_MODEL   ?? "claude-sonnet-4-6",
+ } as const;

# lib/clause/extract.ts
- const resp = await anthropic.messages.create({ model: "claude-sonnet-4-5", ... });
+ const resp = await anthropic.messages.create({ model: MODELS.clauseExtract, ... });

# lib/clause/risk.ts
- model: "claude-sonnet-4-5",
+ model: MODELS.riskFlag,

# lib/clause/summarize.ts
- model: "claude-sonnet-4-5",
+ model: MODELS.riskFlag,
\`\`\`

After this PR, the migration itself is an **env-var change**, and so is the rollback. The eval harness sets \`CLAUSE_MODEL\` per run to compare.

## 4. Prompt-caching check

The system prompt + the clause taxonomy (~2,900 tokens) are a cache breakpoint and remain so on 4.6 — no change. Prompt caching stays on by default; cached-prefix economics are unchanged by the migration.

## 5. Rollback

\`export CLAUSE_MODEL=claude-sonnet-4-5\` and redeploy → instant revert (valid for the 90-day deprecation window). After 4.5 EOL, rollback is forward-only (to a different current model), which is why the eval gate must be green *before* we ship, not after.

## 6. Handoff

Diff PR open. The behavioral question — does 4.6 extract as well as 4.5? — is not answerable from a changelog; it's answerable from the golden set. Handing to **oc-prompt-ops** to run it on both models. Checkpoint: \`.checkpoints/oc-claude-api.checkpoint.json\`.`,
    },
    {
      id: "eval-delta",
      label: "Before/after eval (golden set, per-metric delta)",
      kind: "eval.md",
      body:
`# Model Eval — Sonnet 4.5 vs 4.6 (Clause)

**Produced by** oc-prompt-ops · **Golden set:** 120 contracts, each labelled with expected clauses + risk flags + citation spans · **Models:** \`claude-sonnet-4-5\` vs \`claude-sonnet-4-6\`, same prompts, same temperature · **Gate:** ship only if NO metric is below the 4.5 baseline

## 1. Why this eval is the whole point

"Swap the model id" is a one-line diff. The risk isn't the diff — it's that the new model is silently worse at the one thing that matters and nobody notices until a customer's contract review misses a liability clause. The golden set turns "is 4.6 as good?" from a hope into a per-metric number measured on the same 120 inputs.

## 2. Results — 4.5 → 4.6 (prompts unchanged)

| Metric | 4.5 (baseline) | 4.6 | Δ | Verdict |
|---|---:|---:|---:|---|
| Clause extraction recall | 0.91 | 0.94 | **+3** | better |
| Clause extraction precision | 0.93 | 0.95 | **+2** | better |
| Risk-flag precision | 0.88 | 0.91 | **+3** | better |
| Risk-flag recall | 0.85 | 0.86 | +1 | better |
| **Citation-span exactness (all clauses)** | 0.90 | 0.87 | **−3** | ⚠ regression |
| — of which: \`indemnification\` clauses | 0.92 | 0.84 | **−8** | 🔴 the real regression |
| Schema-valid JSON rate | 0.997 | 1.000 | +0.3 | better |
| Cost / contract | \$0.041 | \$0.038 | −7% | cheaper |
| p95 latency | 4.1 s | 3.6 s | −12% | faster |

**The migration is mostly a win** — recall, precision, cost, latency all improve — **except citation-span exactness regressed**, concentrated almost entirely in \`indemnification\` clauses (−8). That single red cell is why you don't ship a model swap on vibes.

## 3. Root cause of the regression

4.6 is terser (per the playbook's compat note). On long \`indemnification\` clauses it was returning the *operative sentence* as the citation span instead of the *full clause boundary* the 4.5 prompt happened to elicit. The expected behavior (full clause span) was always implicit in the prompt; 4.5 inferred it, 4.6 took the instruction literally and clipped. **Not a model defect — an under-specified prompt the old model was forgiving about.**

## 4. The gate

\`\`\`
 GATE: ship only if every metric ≥ 4.5 baseline
 STATUS: BLOCKED — citation-span exactness 0.87 < 0.90 baseline
 ACTION: fix the prompt (§ prompt-diff), re-run, must clear the gate
\`\`\`

The gate is mechanical: \`/oc-prompt regress\` compares each metric to the committed 4.5 baseline and **fails the build** if any is below it. The model swap PR literally cannot merge in this state.

## 5. After the prompt fix (§ prompt-diff)

| Metric | 4.5 baseline | 4.6 + fixed prompt | Δ vs baseline |
|---|---:|---:|---:|
| Citation-span exactness (all) | 0.90 | 0.93 | **+3** |
| — \`indemnification\` | 0.92 | 0.95 | **+3** |
| (all other metrics) | — | held or improved | ✓ |

\`\`\`
 GATE: ship only if every metric ≥ 4.5 baseline
 STATUS: PASS — every metric ≥ baseline; net improvement across the board
\`\`\`

## 6. What ships

4.6 + the one-clause-span prompt fix. Net: better extraction, better risk-flagging, cheaper, faster, and citation exactness *up* from where 4.5 was. Handing to oc-release-ops to ship it as a versioned release with this eval as the evidence. Checkpoint: \`.checkpoints/oc-prompt-ops.checkpoint.json\`.`,
    },
    {
      id: "prompt-diff",
      label: "The prompt diff that closed the regression (+score)",
      kind: "prompt.diff",
      body:
`# Prompt Diff — clause-extract.v7 → v8 (Clause)

**Produced by** oc-prompt-ops · **Why:** close the citation-span regression on \`indemnification\` clauses (§ eval-delta) · **Discipline:** prompts are versioned, diffable, and scored — a prompt change is a reviewable PR with a measured delta, the same as code

## 1. The change (prompts are code)

\`\`\`diff
# prompts/clause-extract/system.md   v7 → v8
  When you extract a clause, return its citation span: the exact text
- of the clause as it appears in the contract.
+ of the clause as it appears in the contract. The span MUST cover the
+ COMPLETE clause from its opening boundary (the numbered/lettered
+ heading or the sentence that introduces the obligation) through its
+ closing boundary (the end of the final sentence of that clause),
+ INCLUDING all sub-clauses. Do not return only the operative sentence;
+ indemnification and limitation-of-liability clauses often span several
+ sentences and all of them are part of the span.
\`\`\`

Two sentences. That's the entire fix. 4.5 inferred "full clause" from the looser wording; 4.6 needed it spelled out. Making the requirement explicit helps *both* models — it's a strictly better prompt, not a 4.6 workaround.

## 2. Versioning + provenance

\`\`\`
 prompt:        clause-extract/system
 version:       v8  (was v7)
 changed_by:    oc-prompt-ops (regression fix during 4.5→4.6 migration)
 eval_ref:      prompts/clause-extract/eval.yaml  (120-example golden set)
 baseline:      v7 on claude-sonnet-4-5
 measured_delta:
   citation-span exactness (all):           0.87 → 0.93  (+6 vs the regressed 4.6; +3 vs 4.5 baseline)
   citation-span exactness (indemnification): 0.84 → 0.95  (+11)
   extraction recall:                       0.94 → 0.94  (held)
   risk-flag precision:                     0.91 → 0.91  (held)
   schema-valid JSON:                       1.000 → 1.000 (held)
\`\`\`

Every prompt version carries its measured score delta. "We changed the prompt and it feels better" is not a thing here — the diff ships with the number.

## 3. Regression set updated

The two \`indemnification\` contracts that exposed the clip are promoted to **anchor cases** in the golden set (tagged \`regression:citation-span-v8\`). Any future prompt edit or model swap that re-clips them fails \`/oc-prompt regress\` — the bug can't come back silently.

## 4. Drift watch

oc-prompt-ops snapshots the prompt + its score on every change. If a later edit moves citation-span exactness by more than ±2 without a corresponding prompt-version bump, the drift detector flags it in CI. Prompts don't quietly rot.

Checkpoint: \`.checkpoints/oc-prompt-ops.checkpoint.json\` (prompt clause-extract @ v8).`,
    },
    {
      id: "migration-release",
      label: "oc-release-ops ship (changelog + bump)",
      kind: "release.md",
      body:
`# Release — Clause v4.2.0 (model migration to Sonnet 4.6)

**Produced by** oc-release-ops · **Trigger:** migration gate PASS (§ eval-delta) · **Type:** minor (behavioral improvement, no API change) · **Rollback:** env-var (within deprecation window)

## 1. Why this ships as a release, not a hotfix

A model swap changes the behavior of a load-bearing, customer-facing feature. It deserves a version, a changelog entry customers can read, and a recorded evidence trail — not a silent env-var flip in prod. oc-release-ops gives it all three.

## 2. /oc-release plan → draft → ship

\`\`\`
 plan    detected: model migration (claude-api) + 1 prompt version bump (prompt-ops)
         semver:   minor → v4.2.0 (behavior improves; no breaking API change)
 draft   changelog entry generated from the migration playbook + eval delta
 bump    CLAUSE_MODEL/RISK_MODEL defaults → claude-sonnet-4-6; prompt v7 → v8
 ship    hand to git-ops (PR) → deploy-ops (staging → prod)
\`\`\`

## 3. Changelog entry (customer-facing)

> ### v4.2.0 — Faster, sharper contract review
> We upgraded the model behind clause extraction and risk-flagging. In our
> 120-contract evaluation set, this release **improves clause extraction
> recall (+3), risk-flag precision (+3), and citation accuracy (+3)** while
> running **12% faster** — at no change to your workflow or pricing.
> Citation spans on indemnification and limitation-of-liability clauses are
> notably tighter. No action needed on your side.

The numbers in the changelog are the eval numbers. Marketing copy that's literally the measured delta.

## 4. Evidence trail (attached to the release)

| Artifact | What it proves |
|---|---|
| Migration playbook | what changed and why (§ migration-playbook) |
| Before/after eval | every metric ≥ baseline on 120 contracts (§ eval-delta) |
| Prompt diff v7→v8 | the regression closed, with score (§ prompt-diff) |
| \`/oc-prompt regress\` CI run | the gate that blocks any future regression |

For a legaltech product this trail is also the answer to "prove your AI didn't get worse" — a question their customers' compliance teams ask.

## 5. Deploy + watch

- \`/oc-deploy staging\` → smoke on 10 sample contracts → \`/oc-deploy\` prod.
- Post-deploy: shadow-run the new model on the next 200 real contracts and compare extraction counts to the 4.5 trailing average; alert on > 5% drift.
- Rollback: \`CLAUSE_MODEL=claude-sonnet-4-5\` (valid until the 90-day EOL); the gate-green new model is the forward-fix after that.

## 6. Cadence note

The deprecation gave 90 days; this migration took **one session** because the golden set already existed. The lesson for the team: the eval set built at launch is what makes every future model migration a measured, low-drama event. The next deprecation notice is a Tuesday, not a fire drill.

Checkpoint: \`.checkpoints/oc-release-ops.checkpoint.json\` (v4.2.0 shipped).`,
    },
  ],
  skills: ["oc-claude-api", "oc-prompt-ops", "oc-code-auditor", "oc-release-ops"],
  runtime: "≈ 12 exchanges",
  steps: [
    { type: "beat", phase: "operate", label: "01 · Assess", caption: "oc-claude-api reads the deprecation notice", skills: ["oc-claude-api"] },
    {
      type: "exchange", role: "user",
      content: "We just got a deprecation notice — the model behind our contract-review feature (Sonnet 4.5) retires in 90 days. This thing extracts clauses and flags risky terms; if it silently gets worse at that, it's a legal-liability problem, not a UI nit. Last time we swapped a model it quietly regressed and we found out from a customer. How do we not do that again?",
    },
    {
      type: "exchange", role: "claude", skill: "oc-claude-api",
      artifacts: ["migration-playbook"],
      content:
`This is exactly what oc-claude-api's migration path is for, and your fear is the right one: the danger isn't the diff, it's a silent quality drop. So we don't "swap and hope" — we **measure on your golden set** before anything ships.

Migration playbook (attached). What actually changes 4.5 → 4.6:
- Output token ceiling doubles (irrelevant — you cap at 4k).
- Cost slightly *lower*, latency likely *faster*.
- One behavioral note: **4.6 is more literal about output schemas and a touch terser.** For JSON extraction that's usually good, but "terser" can clip citation spans — so that's the thing we have to check, not assume.

First the diff makes model selection **config, not a literal** (so the swap *and* the rollback are one line). Then I hand your 120-example golden set to **oc-prompt-ops** to run on both 4.5 and 4.6 side by side. You'll get a per-metric delta, and the swap can't merge while any metric is below baseline. Pulling that eval now.`,
    },
    { type: "beat", phase: "audit", label: "02 · Eval old vs new", caption: "oc-prompt-ops runs the golden set on both models", skills: ["oc-prompt-ops"] },
    {
      type: "exchange", role: "claude", skill: "oc-prompt-ops",
      artifacts: ["eval-delta"],
      content:
`Ran your 120-contract golden set on \`claude-sonnet-4-5\` and \`claude-sonnet-4-6\`, same prompts, same temperature. The delta:

\`\`\`
 extraction recall        0.91 → 0.94   +3   better
 extraction precision     0.93 → 0.95   +2   better
 risk-flag precision      0.88 → 0.91   +3   better
 cost / contract          $0.041 → $0.038  -7%
 p95 latency              4.1s → 3.6s   -12%
 citation-span exactness  0.90 → 0.87   -3   ⚠ regression
   └─ indemnification     0.92 → 0.84   -8   🔴 the real one
\`\`\`

Almost everything improves — **except citation spans regressed, concentrated in indemnification clauses.** Root cause: 4.6 took your prompt literally and returned the operative sentence instead of the full clause; 4.5 was inferring "full clause" from looser wording. That's an under-specified prompt the old model was forgiving about — not a model defect.

\`\`\`
 GATE: every metric ≥ 4.5 baseline → BLOCKED (citation-span 0.87 < 0.90)
\`\`\`

The swap **cannot merge** in this state. Fixing the prompt now.`,
    },
    {
      type: "exchange", role: "claude", skill: "oc-prompt-ops",
      artifacts: ["prompt-diff"],
      content:
`Fixed as a versioned prompt diff (v7 → v8) — two sentences making "the span must cover the COMPLETE clause including sub-clauses" explicit:

\`\`\`
 citation-span exactness (all)            0.87 → 0.93   (+3 vs the 4.5 baseline)
 citation-span exactness (indemnification) 0.84 → 0.95   (+11)
 every other metric                        held or better
\`\`\`

\`\`\`
 GATE: every metric ≥ 4.5 baseline → PASS
\`\`\`

The prompt change ships with its measured delta (no "feels better"), and the two indemnification contracts that exposed the clip are now anchor cases in the regression set — \`/oc-prompt regress\` will fail any future edit or model swap that re-clips them. Handing to oc-release-ops to ship the migration.`,
    },
    { type: "beat", phase: "ship", label: "03 · Ship", caption: "oc-release-ops bumps, drafts the changelog, ships", skills: ["oc-release-ops"] },
    {
      type: "exchange", role: "user",
      content: "Good. Ship it — and I want something I can show a customer's compliance team that proves it didn't get worse.",
    },
    {
      type: "exchange", role: "claude", skill: "oc-release-ops",
      artifacts: ["migration-release"],
      content:
`Shipping as **v4.2.0** (minor — behavior improves, no API change).

\`\`\`
 plan   model migration + 1 prompt version bump
 bump   CLAUSE_MODEL default → claude-sonnet-4-6; prompt v7 → v8
 draft  changelog written from the eval delta
 ship   git-ops PR → deploy-ops staging → prod
\`\`\`

The changelog numbers ARE the eval numbers: "+3 recall, +3 risk-flag precision, +3 citation accuracy, 12% faster, no price change." And the compliance answer you asked for is the **evidence trail** attached to the release — playbook + before/after eval on 120 contracts + the prompt diff + the CI regression gate. That bundle IS the proof your AI didn't get worse; it got measurably better, on the record.

Post-deploy I shadow the new model on the next 200 real contracts vs. the 4.5 trailing average and alert on >5% drift. Rollback is one env var until the 90-day EOL.

**Bottom line:** a model deprecation that used to be a fire drill was a one-session, regression-gated, fully-evidenced release — because the golden set already existed. Checkpoint written.`,
    },
  ],
};

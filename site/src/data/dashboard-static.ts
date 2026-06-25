/**
 * Dashboard sample aggregate (v1.6).
 *
 * Shape mirrors the oc-telemetry-ops anonymized export
 * (skills/oc-telemetry-ops/references/aggregation.md → "opchain-usage-aggregate/1").
 * `sample: true` marks this as illustrative seed data — the /dashboard page
 * labels it clearly and swaps to a live export when one is published. We never
 * present sample numbers as real.
 *
 * Every value here is a count / sum / share — no raw runs, no identity — exactly
 * what the aggregate guarantees. Numbers are plausible, opchain-shaped placeholders.
 */

export interface UsageAggregate {
  schema: "opchain-usage-aggregate/1";
  sample: boolean;
  generated_at: string;
  window: { from: string; to: string };
  totals: {
    pipelines_run: number;
    skill_runs: number;
    avg_cost_per_feature_usd: number;
  };
  by_skill: { skill: string; runs: number }[];
  model_tier_distribution: { tier: "haiku" | "sonnet" | "opus" | "fable"; share: number }[];
  eval_score_trend: { week: string; avg: number }[];
}

export interface ReplayVignette {
  title: string;
  skillPath: string; // the pipeline the run exercised
  costUsd: number; // attributed by oc-cost-ops
  durationLabel: string;
  evalScore: number; // 0..10
  summary: string;
}

export const usage: UsageAggregate = {
  schema: "opchain-usage-aggregate/1",
  sample: true,
  generated_at: "2026-06-25T00:00:00Z",
  window: { from: "2026-05-01", to: "2026-06-25" },
  totals: {
    pipelines_run: 1284,
    skill_runs: 5310,
    avg_cost_per_feature_usd: 7.41,
  },
  // COUNT(*) GROUP BY skill, desc — small cells (<k=5) would fold into "other".
  by_skill: [
    { skill: "oc-app-architect", runs: 980 },
    { skill: "oc-bug-check", runs: 872 },
    { skill: "oc-git-ops", runs: 814 },
    { skill: "oc-code-auditor", runs: 533 },
    { skill: "oc-stack-forge", runs: 421 },
    { skill: "oc-deploy-ops", runs: 388 },
    { skill: "oc-claude-api", runs: 296 },
    { skill: "oc-prompt-ops", runs: 241 },
    { skill: "oc-ux-engineer", runs: 224 },
    { skill: "other", runs: 541 },
  ],
  // share of runs by model tier (tier, never the full model id)
  model_tier_distribution: [
    { tier: "sonnet", share: 0.52 },
    { tier: "opus", share: 0.31 },
    { tier: "haiku", share: 0.15 },
    { tier: "fable", share: 0.02 },
  ],
  // avg eval score by week, normalized 0..1 across rubrics
  eval_score_trend: [
    { week: "2026-W18", avg: 0.83 },
    { week: "2026-W19", avg: 0.85 },
    { week: "2026-W20", avg: 0.86 },
    { week: "2026-W21", avg: 0.88 },
    { week: "2026-W22", avg: 0.87 },
    { week: "2026-W23", avg: 0.9 },
    { week: "2026-W24", avg: 0.91 },
  ],
};

// Replays section (site.feature.replays-section): real pipeline runs with cost
// overlays. Sample vignettes until live transcripts are published.
export const replays: ReplayVignette[] = [
  {
    title: "Ship a RAG answer-bot",
    skillPath: "oc-app-architect → oc-stack-forge → oc-rag-forge → oc-deploy-ops",
    costUsd: 9.12,
    durationLabel: "~1 week (part-time)",
    evalScore: 8.6,
    summary:
      "Discovery → vector-DB pack pick (pgvector) → retrieval eval goldset → staging → prod. Cost overlay shows spec on Opus, build on Sonnet, bulk embedding-eval batched.",
  },
  {
    title: "Reverse-spec a Django monolith, ship a change",
    skillPath: "oc-reverse-spec → oc-app-architect → oc-bug-check → oc-deploy-ops",
    costUsd: 5.74,
    durationLabel: "~1 afternoon",
    evalScore: 8.1,
    summary:
      "40k-line app, no docs → backfilled specs → one scoped feature → pre-commit gate → Render deploy. Most spend was the one-time reverse-spec sweep (Sonnet, high-throughput).",
  },
  {
    title: "Build a triage agent on the Agent SDK",
    skillPath: "oc-app-architect → oc-agent-forge → oc-prompt-ops → oc-deploy-ops",
    costUsd: 11.38,
    durationLabel: "~3 days",
    evalScore: 8.4,
    summary:
      "Subagent topology + tool budgets + a capped dedupe loop, gated on an agent eval goldset. Cost overlay flags the eval suite as the largest line — batched to halve it.",
  },
];

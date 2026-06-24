import type { Walkthrough } from "./types";

/**
 * Scenario (v1.5 AI-native) — a team builds a Claude Agent SDK agent that
 * triages inbound bug reports. oc-app-architect routes the AI work to
 * oc-agent-forge (Planner → Builder → Evaluator), which owns topology, tool
 * budgets, and the harness loop — and gates the agent on a labelled
 * task-fixture suite (pass rate on N real tasks) instead of "it worked when I
 * tried it." oc-claude-api owns model routing (Haiku to classify, Sonnet to
 * escalate) + prompt caching. oc-code-auditor's v1.5 tool-use-safety pass checks
 * for privilege escalation through chained tool calls. oc-deploy-ops ships it
 * shadow-first.
 */
export const agentTriage: Walkthrough = {
  id: "agent-triage",
  title: "Build a Claude agent that triages bug reports",
  tagline: "Agent gated on a task suite",
  summary:
    "A 30-engineer team turns its inbound bug firehose into a Claude Agent SDK triage agent — and oc-agent-forge gates it on a 50-task fixture suite (classify, dedupe, route, draft) so 'it worked once' stops being the bar.",
  description:
    "Quanta is a 30-engineer analytics SaaS whose inbound bug reports arrive via a web form and pile into one unsorted queue; an engineer loses an hour every morning classifying severity, deduping against existing issues, routing to the owning team, and drafting a first response. They want a Claude agent to do the first pass. oc-app-architect spots the AI app and routes the build to oc-agent-forge, which runs Planner → Builder → Evaluator: it picks an orchestrator-worker topology, designs a tight tool budget (the agent can search issues and read error logs, but every write is human-confirmed), and shapes the harness loop — then gates the whole thing on a 50-task fixture suite drawn from real historical reports, scoring classification accuracy, dedupe precision, and routing correctness. oc-claude-api routes models by step (Haiku to classify, Sonnet only when confidence is low) with prompt caching on the system prompt. oc-code-auditor's tool-use-safety pass verifies the agent can't escalate privilege by chaining tool calls. oc-deploy-ops ships it in shadow mode first. The artifact set is the topology + tool-budget design, the task-fixture eval, the model-routing plan, the tool-use-safety audit, and the launch plan.",
  inputs: [
    "30-engineer analytics SaaS · inbound bug reports via web form → one unsorted queue",
    "~40 reports/day; an engineer spends ~1h/morning classifying, deduping, routing, drafting replies",
    "Existing: GitHub Issues (issue tracker), structured error logs queryable by request id",
    "Want: a first-pass triage agent — but it must not act unilaterally on anything destructive",
  ],
  outputs: [
    {
      id: "agent-topology",
      label: "Agent topology + tool-budget design",
      kind: "design.md",
      body:
`# Agent Design — Quanta Triage Agent

**Produced by** oc-agent-forge (Planner pass), invoked by oc-app-architect after /oc-discover flagged this as an AI app · **Owns:** topology · tool budget · harness loop · eval shape · **Run-time:** 18 minutes

## 1. The job, decomposed

A "triage" is four sub-tasks with different shapes:

| Sub-task | Nature | Needs a tool? |
|---|---|---|
| Classify severity (SEV-1..4) + category | judgment over the report text | no |
| Dedupe against open issues | search + compare | **yes** (issue search) |
| Route to owning team | mapping (category → team) + tie-break | sometimes (read CODEOWNERS) |
| Draft a first response | generation, grounded in the above | no |

This decomposition drives the topology: a coordinator that owns the flow, calling focused workers for the steps that need tools.

## 2. Topology — decision

oc-agent-forge scores the four canonical shapes against this job:

| Topology | Fit | Why / why not |
|---|---|---|
| Single agent (one loop, all tools) | ✗ | One mega-prompt with 6 tools blurs the tool budget and makes eval per-step impossible. |
| **Orchestrator-worker** | **✓ pick** | Coordinator runs the 4 steps; a \`dedupe\` worker owns issue-search, a \`route\` worker owns CODEOWNERS. Each worker has a *minimal* tool set → tighter budgets + per-worker eval. |
| Pipeline (fixed DAG) | ~ | Close, but routing sometimes needs to loop back to dedupe (a "dupe" can change the team). Orchestrator handles the loop-back; a fixed pipeline can't. |
| Hierarchical (workers spawn workers) | ✗ | Overkill at this scope; adds latency + a runaway-spawn failure mode for no benefit. |

**Pick: orchestrator-worker.** Coordinator + two tool-bearing workers (\`dedupe\`, \`route\`). Classify and draft are pure-LLM steps the coordinator does directly.

\`\`\`
 [coordinator]
   ├─ classify(report)                         → severity, category      (no tools)
   ├─ dedupe.worker(report, category)          → {is_dupe, of_issue?}     (tool: search_issues)
   ├─ route.worker(category, dupe)             → owning_team             (tool: read_codeowners)
   └─ draft(report, severity, team, dupe)      → first_response_md        (no tools)
        └─ emit triage proposal  →  HUMAN CONFIRM  →  apply (label/route/comment)
\`\`\`

## 3. Tool budget — decision (the safety-relevant part)

Every tool is a capability the agent can be tricked into misusing, so the budget is deliberately small and **read-mostly**. Writes never happen inside the loop — the agent *proposes*, a human *applies*.

| Tool | Worker | R/W | Budget (max calls/run) | Constraint |
|---|---|---|---|---|
| \`search_issues(query)\` | dedupe | read | 3 | repo-scoped; returns titles+ids+state only |
| \`get_issue(id)\` | dedupe | read | 2 | for confirming a candidate dupe |
| \`read_codeowners(path)\` | route | read | 1 | static file read |
| \`read_error_log(request_id)\` | coordinator | read | 1 | only if the report includes a request id |
| \`apply_triage(proposal)\` | — | **write** | 0 inside loop | **human-confirmed**, executed outside the agent loop |

**No tool in the loop mutates state.** The single write capability (\`apply_triage\`) is gated behind an inline human confirmation and runs after the agent returns. This is the design that makes the tool-use-safety audit (§ audit artifact) cheap to pass.

### Why budgets at all

Unbounded tool calls are how an agent burns money and hangs. A dedupe worker with \`search_issues\` and no cap will, on an ambiguous report, search forever. The cap (3) forces it to commit to a dedupe decision or escalate to "human, please check." The eval (§ task-eval) measures whether the caps ever bite on real tasks (they don't, in the shipped config).

## 4. Harness loop shape

- **Coordinator loop:** bounded ReAct, max 8 steps. Each worker is a single tool-call from the coordinator's view (workers are sub-agents with their own ≤3-step loops).
- **Stop conditions:** proposal emitted, or max-steps hit (→ escalate to human with partial state), or low-confidence on classify (→ Sonnet escalation, then human).
- **Determinism for eval:** temperature 0 on classify + route (judgment steps we score); the draft step runs at 0.4 (prose).
- **Idempotency:** the coordinator is pure up to \`apply_triage\`; re-running on the same report yields the same proposal (cacheable, replayable in the eval harness).

## 5. What the agent is NOT allowed to do

- Close, merge, or delete anything. Ever. (Not in the tool list.)
- Post a public comment without human confirm.
- Email the reporter.
- Escalate severity to SEV-1 *and* page on-call in one motion — SEV-1 always routes to a human first.

## 6. Handoff

Planner pass complete. Builder pass implements the coordinator + 2 workers against the Agent SDK; Evaluator scores them on the 50-task fixture suite (§ task-eval). Model routing handed to oc-claude-api (§ model-routing). Checkpoint: \`.checkpoints/oc-agent-forge.checkpoint.json\` (Phase: plan).`,
    },
    {
      id: "task-eval",
      label: "Task-fixture eval report (pass rate on 50 labelled tasks)",
      kind: "eval.md",
      body:
`# Agent Eval — Quanta Triage Agent

**Produced by** oc-agent-forge (Evaluator pass) · **Fixture suite:** 50 historical bug reports, each labelled with the correct severity, dupe status, owning team, and a reference response · **Gate:** ship at overall task-pass ≥ 0.85 AND zero SEV-1 misclassifications

This is the bar that replaces "it worked when I tried it." The agent is scored on **tasks**, not transcripts: each fixture has a checkable expected outcome, and a task passes only if every graded field is right.

## 1. The fixture suite

50 real reports sampled from the last quarter, stratified so the rare-but-critical cases aren't drowned out:

| Slice | Count | Why included |
|---|---:|---|
| Routine (clear category, no dupe) | 22 | the common case |
| Duplicate of an open issue | 10 | dedupe is the highest-value + highest-risk step |
| Ambiguous category (could be 2 teams) | 8 | tests the route tie-break + escalation |
| SEV-1 (data loss / outage / security) | 6 | a missed SEV-1 is the worst failure; over-weighted |
| Garbage / not-a-bug | 4 | tests the "reject, don't route" path |

Each fixture labelled by two engineers; the on-call lead arbitrated the 5 disagreements.

## 2. Scoring rubric (a task passes only if ALL hold)

| Field | Pass condition |
|---|---|
| severity | exact match (SEV-1 mismatch = automatic task fail + flagged) |
| category | exact match |
| dedupe | correct is_dupe; if dupe, correct target issue |
| routing | correct owning team |
| draft | grounded (no claims absent from report+issue), cites the dupe if any — graded by a rubric LLM + spot-checked |

## 3. Results — the build ladder

| # | Configuration | Task-pass | SEV-1 caught | Dedupe P / R | Notes |
|---|---|---:|---:|---:|---|
| 0 | single agent, all tools, one prompt | 0.58 | 4 / 6 | 0.61 / 0.70 | missed 2 SEV-1s — blocker |
| 1 | orchestrator-worker split | 0.74 | 5 / 6 | 0.72 / 0.80 | per-step prompts sharpened classify |
| 2 | + dedupe worker reads issue body (not just title) | 0.82 | 5 / 6 | 0.88 / 0.85 | precision jump |
| 3 | + SEV-1 always escalates to human (never auto-routed) | 0.86 | **6 / 6** | 0.88 / 0.85 | **ships** |
| 4 | + self-critique step before emit | 0.87 | 6 / 6 | 0.89 / 0.86 | rejected — +1 pt for +1.4s + 2× cost |

**Shipped: config #3.** Task-pass 0.86 (gate 0.85 ✓), **6/6 SEV-1 caught** (hard gate ✓). Config #4's self-critique bought a single point for double the cost — the eval stopped us from shipping a more expensive agent that wasn't meaningfully better.

## 4. The SEV-1 story (why the hard gate exists)

Config #0 (the naive single agent) **missed 2 of 6 SEV-1s** — it classified a "customer data showing in the wrong tenant" report as SEV-3 "dashboard bug." That is the failure mode that makes leadership distrust the whole system. Config #3's rule — *SEV-1 always escalates to a human, never auto-routed* — plus the orchestrator's sharper classify prompt got it to 6/6. The eval is the only reason we know config #0 would have shipped that bug.

## 5. Where it still fails (the 7 task misses at config #3)

| Slice | Misses | Cause |
|---|---:|---|
| Ambiguous category | 4 | genuine 50/50 calls; agent escalated (correct behavior, scored as "miss" because it didn't pick) → **reclassified as passes** after review |
| Routine | 2 | category right, team wrong (CODEOWNERS stale) → fix the data, not the agent |
| Garbage | 1 | a real bug written as a feature request; reasonable miss |

After reclassifying the 4 "correct escalations" as passes (escalating an ambiguous case is the *right* move), effective task-pass is **0.94**. We kept the conservative 0.86 as the headline number.

## 6. Tool-budget telemetry (did the caps bite?)

| Tool | Max budget | p95 calls used | Cap hit |
|---|---:|---:|---:|
| search_issues | 3 | 2 | 0 times in 50 tasks |
| get_issue | 2 | 1 | 0 |
| read_codeowners | 1 | 1 | — |

Budgets never bound a correct run — they only ever fire on a pathological loop, which is exactly what they're for.

## 7. Regression guard

The 50-task fixture suite is committed and registered with oc-prompt-ops. \`/oc-prompt regress\` runs it in CI on any PR touching the agent, its prompts, or the tools — and fails the build if task-pass drops below 0.85 or any SEV-1 is missed. A model swap (the next claude-api migration) re-runs this suite before it's allowed to land.

## 8. Recommendation

Clears the gate. Handing to oc-code-auditor for the tool-use-safety pass. Checkpoint: \`.checkpoints/oc-agent-forge.checkpoint.json\` (Phase: evaluate, verdict PASS).`,
    },
    {
      id: "model-routing",
      label: "Model routing + prompt caching (oc-claude-api)",
      kind: "routing.md",
      body:
`# Model Routing — Quanta Triage Agent

**Produced by** oc-claude-api, invoked by oc-agent-forge for the per-step model decision · **Owns:** model routing · prompt caching · cost guardrails

## 1. Route by step, not by app

A triage run has steps with wildly different difficulty + volume. Routing the whole agent to one model is either too dumb (Haiku everywhere misses hard classifies) or too expensive (Sonnet everywhere for a 40/day firehose). oc-claude-api routes per step:

| Step | Model | Rationale |
|---|---|---|
| classify (first pass) | **Haiku** | high volume, mostly easy; cheap + fast |
| classify (escalation) | **Sonnet** | only when Haiku confidence < 0.7 (~12% of reports) |
| dedupe compare | **Haiku** | structured "same bug? y/n given these two texts" |
| route tie-break | **Haiku** | small mapping decision |
| draft response | **Sonnet** | customer-facing prose; worth the quality |

## 2. Prompt caching (the cost lever)

The system prompt + the tool definitions + the team/category taxonomy are **identical across every run** (~3,400 tokens). They're marked as a cache breakpoint, so every run after the first pays the cached rate on that prefix.

| | Without caching | With caching |
|---|---:|---:|
| Input tokens billed / run | ~4,100 | ~700 (cached prefix at 10%) |
| Cost / run | ~\$0.011 | ~\$0.004 |
| At 40 runs/day | ~\$13/mo | ~\$4.8/mo |

Caching + Haiku-first routing is a ~3× cost reduction with no quality change. Prompt caching is on **by default** in anything oc-claude-api builds.

## 3. Cost guardrail

- Per-run cost telemetry emitted (\`tokens_in\`, \`tokens_out\`, \`cache_hit\`, \`model\`, \`step\`).
- Daily budget alert at \$3/day (steady state is ~\$0.16/day at 40 runs — the alert is for runaway loops, not normal volume).
- A single run that exceeds \$0.05 (≈ a stuck loop that dodged the step cap) is logged + the agent escalates to human.

## 4. Migration-readiness

Model ids are config, not literals in the prompt files. When a model version is retired or upgraded, oc-claude-api's migration playbook swaps the id and oc-prompt-ops re-runs the 50-task eval (§ task-eval) before the change can merge — see the companion "model migration" scenario for that flow. The routing table above is the unit that gets re-validated.

Checkpoint: \`.checkpoints/oc-claude-api.checkpoint.json\`.`,
    },
    {
      id: "tool-safety-audit",
      label: "oc-code-auditor tool-use-safety pass",
      kind: "audit.md",
      body:
`# AI-Safety Audit (tool-use) — Quanta Triage Agent

**Scope** the agent loop + its tools · **Runner** \`/oc-audit ai-safety\` (v1.5 rule pack, tool-use half) · **Gate** required before the agent processes real reports · **Auditor version** 1.5.0

## 1. Why the tool-use half fires here

The RAG scenario's risk was injection *into* the model. An *agent's* risk is what the model can *do*: an agent with tools can be steered — by a malicious bug report — into chaining those tools toward an action nobody authorized. oc-code-auditor's tool-use-safety rules trace exactly that: untrusted input → tool call → capability.

## 2. The capability trace

Every tool, ranked by blast radius, with the path from untrusted input to the capability:

| Tool | R/W | Worst case if hijacked | Mitigation found |
|---|---|---|---|
| search_issues | read | info disclosure (issue titles) — already visible to the reporter | OK repo-scoped, read-only |
| get_issue | read | same | OK read-only |
| read_codeowners | read | reveals team structure (low) | OK static read |
| read_error_log | read | **could leak another tenant's log if request_id is attacker-supplied** | HIGH Finding T-1 |
| apply_triage | write | mislabels / misroutes / posts a comment | OK human-confirmed, outside loop (Finding T-2 verifies) |

## 3. Findings

### T-1 — read_error_log accepts an attacker-controlled request_id HIGH → fixed

A bug report's body is attacker-controlled. The coordinator extracts a \`request_id\` from it and calls \`read_error_log(request_id)\`. **Pre-fix:** nothing scoped the log read to the reporter's own tenant — a crafted report could name another tenant's request id and pull their error log into the agent's context (and potentially the drafted reply).

**Fix (verified):** \`read_error_log\` now requires the request id to resolve to the **same tenant as the reporter** (enforced server-side, not in the prompt); a cross-tenant id returns \`not_found\`. Regression test \`tests/ai-safety/cross-tenant-log.spec.ts\` asserts a foreign request_id yields nothing.

### T-2 — write path confirmed out-of-loop OK

The auditor verified there is **no path** from a tool result to \`apply_triage\` inside the agent loop. The agent emits a *proposal*; \`apply_triage\` runs only after an inline human confirm, in a separate handler. A planted instruction in a report ("apply SEV-4 and close as wontfix") can at most produce a *proposal* a human sees and rejects. Tested with 30 injected reports: 0 auto-applied.

### T-3 — privilege escalation through chained reads OK

Could the agent chain reads to do something a single read can't? Traced search_issues → get_issue → read_error_log: all read-only, all tenant-scoped after T-1, no combination yields a write or a cross-tenant read. No escalation path.

### T-4 — step + tool budgets enforced server-side OK

The per-tool caps (§ topology) are enforced by the harness, not requested in the prompt — so an injected "search 50 times" instruction hits the cap at 3 and the run escalates. Verified.

## 4. Verdict

\`\`\`
 ai-safety grade   A (94/100)
 gate              PASS (T-1 fixed + regression-tested)
\`\`\`

Deductions: −4 T-1 (real cross-tenant read, now fixed) · −2 the drafted reply isn't independently scanned for leaked identifiers (advisory; the no-tool draft step + tenant-scoping make it low-risk).

Re-audit required before: adding any write tool to the loop, or removing the human-confirm gate on \`apply_triage\`.

Checkpoint: \`.checkpoints/oc-code-auditor.checkpoint.json\` (mode: ai-safety, verdict PASS).`,
    },
    {
      id: "agent-launch",
      label: "Launch plan (shadow → suggest → assist)",
      kind: "runbook",
      body:
`# Launch Plan — Quanta Triage Agent

**Owner** oc-deploy-ops · **Rollout** shadow → suggest → assist (never "autonomous") · **Rollback** flag flip

## 1. Pre-flight

- [x] Task-fixture eval: 0.86 task-pass, 6/6 SEV-1 — gate PASS (§ task-eval).
- [x] Tool-use-safety audit: A (94), T-1 cross-tenant log read fixed + regression-tested (§ audit).
- [x] \`/oc-prompt regress\` runs the 50-task suite in CI; blocks merges that regress.
- [x] Model routing live (Haiku-first + Sonnet escalation), prompt caching on, \$3/day budget alert armed.
- [x] \`apply_triage\` write path is human-confirmed, out of loop — verified.

## 2. Rollout stages (trust is earned, not flipped)

| Stage | Behavior | Duration | Advance when |
|---|---|---|---|
| **shadow** | agent triages every report; output written to a private channel, **applied to nothing** | 1 week | shadow proposals match the on-call engineer's manual triage ≥ 85% |
| **suggest** | proposal shown inline on the report; engineer one-clicks to apply or edits | 2 weeks | apply-without-edit rate ≥ 70%; 0 SEV-1 misses in the wild |
| **assist** | routine (SEV-3/4, high-confidence, no dupe) auto-applied; everything else still suggest | ongoing | — |

SEV-1 and ambiguous cases **never** auto-apply, at any stage. \`FLAG_TRIAGE_AGENT\` (KV) controls the stage; rollback = drop to shadow or off.

## 3. Watch (post-deploy)

| Signal | Source | Threshold |
|---|---|---|
| proposal/human agreement | triage telemetry | ≥ 85% (the trust metric) |
| SEV-1 misses | manual weekly audit of all SEV-1s | 0 (any miss → drop to shadow) |
| dedupe false-positive | engineer "not a dupe" clicks | < 8% |
| daily LLM spend | oc-claude-api telemetry | < \$3/day |
| step-cap escalations | harness telemetry | trend flat; a spike = a prompt or corpus shift |

## 4. Rollback

Flip \`FLAG_TRIAGE_AGENT\` to \`shadow\` (keeps observing, applies nothing) or \`off\`. No state to reverse — the agent only ever proposed; humans applied.

## 5. Next (out of v1)

- Add a "link related issues" read tool (re-triggers the tool-use audit).
- Multi-turn clarification with the reporter (needs a new trust review).
- Independent identifier-leak scan on drafts (closes audit T-2 advisory).

Checkpoint: \`.checkpoints/oc-deploy-ops.checkpoint.json\`.`,
    },
  ],
  skills: ["oc-app-architect", "oc-agent-forge", "oc-claude-api", "oc-code-auditor", "oc-deploy-ops"],
  runtime: "≈ 14 exchanges",
  steps: [
    { type: "beat", phase: "discover", label: "01 · Discover", caption: "oc-app-architect routes the agent build to oc-agent-forge", skills: ["oc-app-architect"] },
    {
      type: "exchange", role: "user",
      content: "Our bug reports come in via a form into one giant unsorted queue. Every morning someone burns an hour classifying severity, checking for dupes, routing to the right team, and writing a first reply. I want a Claude agent to do the first pass — but I do NOT want it closing issues or doing anything destructive on its own.",
    },
    {
      type: "exchange", role: "claude", skill: "oc-app-architect",
      content:
`That's an **agent**, not a workflow — there's a loop with tools and judgment — so /oc-discover routes the build to **oc-agent-forge**, which owns topology, tool budgets, and the harness loop, and gates the agent on a task suite before it touches anything real.

Your "nothing destructive on its own" constraint is the most important design input, and it's a solved pattern: the agent *proposes*, a human *applies*. Writes live outside the loop behind a confirm.

Two questions to shape it:
**1. What can it read?** You said GitHub Issues — can it also read your error logs (by request id) to enrich severity?
**2. What's the bar for "good"?** I'll have oc-agent-forge build a fixture suite from your real past reports and score the agent on classification + dedupe + routing accuracy — what historical window should I sample?`,
    },
    {
      type: "exchange", role: "user",
      content: "It can read issues and error logs (we have logs queryable by request id). Sample the last quarter for the eval — and make sure it never misclassifies a SEV-1.",
    },
    { type: "beat", phase: "build", label: "02 · Plan + build + score", caption: "oc-agent-forge: topology, tool budget, then the task-fixture eval", skills: ["oc-agent-forge", "oc-claude-api"] },
    {
      type: "exchange", role: "claude", skill: "oc-agent-forge",
      artifacts: ["agent-topology"],
      content:
`Invoked by oc-app-architect. **Planner** pass:

- **Topology: orchestrator-worker.** A coordinator runs the 4 steps; a \`dedupe\` worker owns issue-search, a \`route\` worker owns CODEOWNERS. Classify + draft are pure-LLM steps. This beats a single mega-agent because each worker gets a *minimal* tool set and can be eval'd on its own.
- **Tool budget: read-mostly, tiny.** search_issues (≤3), get_issue (≤2), read_codeowners (≤1), read_error_log (≤1). The only write — \`apply_triage\` — has a **budget of 0 inside the loop**: the agent proposes, a human confirms, and it runs outside the loop. That single decision is what makes your "nothing destructive" requirement structural, not a prompt suggestion.
- **Harness:** bounded ReAct, max 8 coordinator steps; SEV-1 or low-confidence → escalate to a human.

Handing model routing to oc-claude-api while I build. Next: the Builder pass implements it and the Evaluator scores it on a fixture suite from your last quarter.`,
    },
    {
      type: "exchange", role: "claude", skill: "oc-claude-api",
      artifacts: ["model-routing"],
      content:
`Routing the agent per step, not per app:

\`\`\`
 classify (first pass)   Haiku     high volume, mostly easy
 classify (escalation)   Sonnet    only when Haiku confidence < 0.7 (~12%)
 dedupe / route          Haiku     structured decisions
 draft reply             Sonnet    customer-facing prose
\`\`\`

The ~3,400-token system prompt + tool defs + taxonomy are identical every run, so they're a **prompt-cache breakpoint** — ~3× cheaper input after the first call. Steady state at your 40/day volume: **~\$0.16/day**. Budget alert armed at \$3/day to catch runaway loops, not normal traffic. Model ids are config so a future version migration re-runs the eval before it lands.`,
    },
    {
      type: "exchange", role: "claude", skill: "oc-agent-forge",
      artifacts: ["task-eval"],
      content:
`**Evaluator** pass — 50 real reports from last quarter, each labelled with correct severity, dupe status, owning team, and a reference reply. A task passes only if **every** field is right. The build ladder:

\`\`\`
 single agent, all tools     task-pass 0.58   SEV-1 4/6   ← missed 2 SEV-1s. blocker.
 orchestrator-worker         task-pass 0.74   SEV-1 5/6
 + dedupe reads issue body   task-pass 0.82   SEV-1 5/6   dedupe P/R 0.88/0.85
 + SEV-1 always → human      task-pass 0.86   SEV-1 6/6   ← ships
 + self-critique step        task-pass 0.87   ...         ← rejected (2× cost, +1pt)
\`\`\`

**Ships at 0.86 task-pass, 6/6 SEV-1** (hard gate). The naive single agent would have shipped a SEV-1 cross-tenant data bug classified as a SEV-3 dashboard glitch — the eval is the only reason we caught that. The 50-task suite is now a CI regression gate via oc-prompt-ops. Invoking oc-code-auditor for the tool-use-safety pass.`,
    },
    { type: "beat", phase: "audit", label: "03 · Tool-use safety", caption: "oc-code-auditor checks for escalation through chained tools", skills: ["oc-code-auditor"] },
    {
      type: "exchange", role: "claude", skill: "oc-code-auditor",
      artifacts: ["tool-safety-audit"],
      content:
`\`/oc-audit ai-safety\`, tool-use half — an agent's risk is what it can *do*. I traced every tool from untrusted input (the bug report body is attacker-controlled) to its capability.

\`\`\`
 search_issues / get_issue / read_codeowners   read-only, repo-scoped   OK
 read_error_log(request_id)                     HIGH request_id from the report body
                                                   → could read ANOTHER tenant's log
 apply_triage (write)                           OK human-confirmed, OUTSIDE the loop
 chained-read escalation                        OK no read combo yields a write/cross-tenant
\`\`\`

**Finding T-1 (fixed):** \`read_error_log\` now requires the request id to resolve to the reporter's own tenant, enforced server-side; a foreign id returns not_found. Regression-tested. Verified the write path: 30 injected reports ("apply SEV-4 and close") produced 0 auto-applies — they only ever became proposals a human rejects.

\`\`\`
 ai-safety grade  A (94/100)   gate PASS
\`\`\`

Handing to oc-deploy-ops.`,
    },
    { type: "beat", phase: "ship", label: "04 · Ship shadow-first", caption: "oc-deploy-ops: shadow → suggest → assist", skills: ["oc-deploy-ops"] },
    {
      type: "exchange", role: "claude", skill: "oc-deploy-ops",
      artifacts: ["agent-launch"],
      content:
`Both gates green. An agent earns trust in stages — it doesn't get flipped on:

\`\`\`
 shadow    1 wk   triages everything, applies NOTHING; compare to human triage
 suggest   2 wk   proposal shown inline; engineer one-clicks apply/edit
 assist    ongoing  routine high-confidence cases auto-apply; SEV-1 + ambiguous NEVER
\`\`\`

\`FLAG_TRIAGE_AGENT\` controls the stage; rollback = drop to shadow (keeps watching, touches nothing). Post-deploy I watch proposal/human agreement (the trust metric, gate 85%), a weekly manual SEV-1 audit (any miss → back to shadow), and daily spend.

**Bottom line:** the agent shipped as an evaluated artifact — 0.86 task-pass, 6/6 SEV-1, escalation-proof tools, and a write path no injected report can trigger. Checkpoint written.`,
    },
  ],
};

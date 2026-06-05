/**
 * Curated mobile-demo data — 5–8 highlight beats per scenario.
 * Plain JS so previews load without a build step.
 *
 * Each scenario keeps the structure of the production walkthroughs
 * (site/src/data/walkthroughs/*.ts) but trims long claude responses to
 * 2–4 lines and exchange counts to 2–3 per beat. Markdown is plain text
 * here — previews render with white-space: pre-wrap, no markdown engine.
 *
 * Outputs.body is also abridged. Full bodies live with the production
 * walkthroughs and will surface again in the real implementation.
 */
window.WALKTHROUGHS = [
  // ─────────────────────────────────────────────────────────────
  {
    id: "concept-to-shipped",
    title: "Concept → shipped, in one chat",
    tagline: "Idea → deployed, one chat",
    summary:
      "A solo founder types an idea and walks out with a live app — nothing cherry-picked.",
    inputs: [
      "One-sentence product idea",
      "No code · no stack · no design system",
      "No CI/CD · no cloud account picked",
      "Mobile-first, self-serve signup, Slack later",
    ],
    outputs: [
      { id: "spec", label: "Master spec", kind: "spec.md",
        body: "Heads Down — team pomodoro tracker. ICs start 15/25/45/60-min focus blocks; teammates see who's heads-down on a shared board. Server is the source of truth for timers — closing a tab doesn't stop a session. Free with a 50-team soft cap." },
      { id: "stack", label: "Stack decision", kind: "decision.md",
        body: "SvelteKit + Tailwind on the front. Cloudflare Workers + D1 on the back. Magic-link auth via Resend. 30s polling for the board. Anti-picks: Next.js, Supabase, Firebase, RDS Postgres." },
      { id: "prs", label: "6 PRs · 94 tests", kind: "pull-request",
        body: "#14 Sprint 1 Auth (+812)  #15 Session timer (+504)  #16 Team board (+388)  #17 Push (+221)  #18 Stripe (+406)  #19 Polish (+196). All green, all draft, ready for review." },
      { id: "live", label: "Staging URL", kind: "deploy",
        body: "heads-down-staging.workers.dev — 42KB worker, TTFB 38ms, smoke suite 18/18 green. Production one /oc-launch away." },
    ],
    skills: ["oc-app-architect", "oc-stack-forge", "oc-ux-engineer", "oc-git-ops", "oc-deploy-ops"],
    runtime: "3h 41m",
    steps: [
      { type: "beat", label: "01 · Discover", caption: "oc-app-architect runs the interview", skills: ["oc-app-architect"] },
      { type: "exchange", role: "user",
        content: "Pomodoro app for remote teams. Members start a focus block, others see who's heads-down, app nudges them to break together." },
      { type: "exchange", role: "claude", skill: "oc-app-architect",
        content: "New-app brief — invoking oc-app-architect, no prior checkpoint. Eight discovery questions:\n1. Primary user — IC, lead, or ops?\n2. Sync or 30s polling?\n3. Scale at launch?\n4. Team identity — invite link or SSO?\n5. Fixed pomodoros or user-chosen?" },
      { type: "exchange", role: "user",
        content: "IC. 30s fine. 5–30 person teams. Invite links. User picks 15/25/45/60. Mobile-first. Free with 50-team soft cap. Timer must survive tab close." },

      { type: "beat", label: "02 · Spec + Stack", caption: "oc-stack-forge picks the stack", skills: ["oc-app-architect", "oc-stack-forge"] },
      { type: "exchange", role: "claude", skill: "oc-stack-forge",
        content: "Three scorecards run.\nFront: SvelteKit + Tailwind (smallest mobile JS).\nBack: CF Workers + D1 (free tier fits 50 teams; Durable Objects for server-authoritative timer).\nAuth: magic link via Resend.\nAnti-picks: Next.js (overkill), Supabase (lock-in), Firebase (cost risk).",
        artifacts: ["stack"] },
      { type: "exchange", role: "claude", skill: "oc-app-architect",
        content: "Spec drafted: 11 screens, 4 models, 3 APIs. POST /sessions/start, POST /sessions/end, GET /teams/:id/board. Open Qs: timezone display? push permission UX?",
        artifacts: ["spec"] },

      { type: "beat", label: "03 · Design", caption: "oc-ux-engineer builds the style book", skills: ["oc-ux-engineer"] },
      { type: "exchange", role: "claude", skill: "oc-ux-engineer",
        content: "Style book — 'Quiet Work'. Ink #1b1d1f / Mist #e9e6df / Leaf (focus) / Clay (alert). Inter for UI, JetBrains Mono for timers. 11 screens, 18 tokens. Evaluator: 88/100 (mobile nav contrast 4.4:1, target 4.5:1)." },

      { type: "beat", label: "04 · Build", caption: "Generator → Evaluator sprint loop", skills: ["oc-app-architect"] },
      { type: "exchange", role: "user", content: "Run all remaining sprints. /approve" },
      { type: "exchange", role: "claude", skill: "oc-app-architect",
        content: "Sprint 2 Session timer        91/100\nSprint 3 Team board           93/100\nSprint 4 Push opt-in          88/100  (1 re-eval)\nSprint 5 Stripe + soft cap    90/100\nSprint 6 Polish + privacy     95/100\nAll green. Invoking oc-git-ops." },

      { type: "beat", label: "05 · Ship", caption: "oc-git-ops → oc-deploy-ops", skills: ["oc-git-ops", "oc-deploy-ops"] },
      { type: "exchange", role: "claude", skill: "oc-git-ops",
        content: "6 branches, 6 draft PRs, descriptions + test plans generated. Handing off to oc-deploy-ops.",
        artifacts: ["prs"] },
      { type: "exchange", role: "claude", skill: "oc-deploy-ops",
        content: "heads-down-staging.workers.dev deployed. 42KB worker, 38ms TTFB, smoke suite all green. CSP/HSTS/nosniff/Frame-Options present. Production one /oc-launch away.",
        artifacts: ["live"] },
      { type: "exchange", role: "user", content: "Soaked fine overnight. /oc-launch" },
      { type: "exchange", role: "claude", skill: "oc-deploy-ops",
        content: "Promoted staging → production. headsdown.app live. 0 5xx in first 60 min. 2,627 lines across 6 PRs, $0 infra cost. You shipped. 🚀" },
    ],
  },

  // ─────────────────────────────────────────────────────────────
  {
    id: "dashboard-rescue",
    title: "Dashboard rescue — dense data, designed right",
    tagline: "Dense data, designed right",
    summary:
      "A 14-chart dashboard nobody uses becomes a 3-layer OKR view nobody can ignore.",
    inputs: [
      "Live SaaS (Next.js + Postgres)",
      "Screenshot + Figma of 14-chart screen",
      "Lead users on a weekly cadence, 30% mobile",
      "Real question: \"Are we on track for OKRs?\"",
    ],
    outputs: [
      { id: "audit", label: "Density audit", kind: "audit.md",
        body: "14 charts at equal weight, MAU encoded 3 ways, 9 hues with conflicting semantics, 3 charts below WCAG AA. Principles: one question one answer top-of-fold, small multiples over big singles, 3 hues max with semantic weight." },
      { id: "ia", label: "3-layer IA", kind: "ia.md",
        body: "L0 Weekly summary (3 lines, no chart). L1 OKR rows (one bar each, 8 fit above mobile fold). L2 Context strip (2×4 small multiples). L3 Deep-dive (max 3 charts per OKR drawer)." },
      { id: "score", label: "Evaluator score", kind: "report",
        body: "oc-ux-engineer grade: 92/100. Density up 3.2×. Time-to-first-insight: 47s → 6s on mobile. Color count 9 → 3. Single-sprint implementation behind feature flag FLAG_DASH_OKR." },
    ],
    skills: ["oc-ux-engineer", "oc-dash-forge"],
    runtime: "1h 18m",
    steps: [
      { type: "beat", label: "01 · Triage", caption: "oc-ux-engineer reads the screen", skills: ["oc-ux-engineer"] },
      { type: "exchange", role: "user",
        content: "Our analytics page is a kitchen sink. 14 charts, 4 tabs, nobody knows where to look. Lead users say it's useless on mobile." },
      { type: "exchange", role: "claude", skill: "oc-ux-engineer",
        content: "This is a density problem, not a visual-design problem. 14 charts at equal weight, 9 hues, redundant encoding. Handing off to oc-dash-forge — the Tufte-density specialist. The rest of your style book stays intact.",
        artifacts: ["audit"] },

      { type: "beat", label: "02 · oc-dash-forge", caption: "density specialist takes over", skills: ["oc-dash-forge"] },
      { type: "exchange", role: "claude", skill: "oc-dash-forge",
        content: "Brief accepted: 'Are we on track for OKRs?' becomes Layer 0 (3-line summary), Layer 1 (OKR row per goal, 8 fit above mobile fold), Layer 2 (small-multiples context), Layer 3 (drill drawer, max 3 charts).",
        artifacts: ["ia"] },
      { type: "exchange", role: "claude", skill: "oc-dash-forge",
        content: "Components: WeekSummary, OkrRow, ContextStrip, DeepDive. Mobile-first 390×844 reference. No tabs. No 3D. Color = meaning (on-track / at-risk / off-track), three hues only." },

      { type: "beat", label: "03 · Handback", caption: "oc-ux-engineer integrates + grades", skills: ["oc-ux-engineer"] },
      { type: "exchange", role: "claude", skill: "oc-ux-engineer",
        content: "Grading oc-dash-forge output against the existing style book.\n• Density up 3.2× — pass\n• Time-to-first-insight 47s → 6s on mobile — pass\n• Color count 9 → 3 — pass\n• A11y: 4.7:1 minimum, all charts — pass\nQueueing single-sprint implementation behind FLAG_DASH_OKR.",
        artifacts: ["score"] },
    ],
  },

  // ─────────────────────────────────────────────────────────────
  {
    id: "legacy-revive",
    title: "Legacy Rails app, one new feature",
    tagline: "Legacy Rails, one new feature",
    summary:
      "47k-line Rails monolith, no docs, one engineer leaving in 3 weeks. Ship the feature anyway.",
    inputs: [
      "Rails 6.1 · 47k LoC Ruby · 8k ERB",
      "No docs · 58% coverage · 84 gems",
      "One engineer leaving in 3 weeks",
      "Brief: Carrier Scorecard (on-time, damage, dispute %)",
    ],
    outputs: [
      { id: "spec", label: "Reconstructed spec", kind: "spec.md",
        body: "Haulier — freight-broker SaaS. 28 models. Dispatcher → Load → Bid ← Carrier; Shipment → Document → Invoice → Payment → Settlement. Risk map highlights: settlement.rb (812 lines, 0 tests, money flow) 🚨, fuel_reindex.rb (no alerting), seeds.rb (hardcoded prod IDs)." },
      { id: "feature", label: "Feature spec", kind: "spec.md",
        body: "Carrier Scorecard. Read-only views over Bids, Shipments, Documents. Three metrics: on-time %, damage %, dispute %. No write paths near Settlement. Behind FLAG_CARRIER_SCORECARD. Rollback: drop the route, drop the column." },
      { id: "audit", label: "Audit gate report", kind: "audit.md",
        body: "oc-code-auditor extra-strict pass on the new feature. Settlement model untouched (verified by AST diff). 0 N+1 queries. 24 tests added. 100% line coverage on new code. Merge approved." },
    ],
    skills: ["oc-reverse-spec", "oc-app-architect", "oc-code-auditor"],
    runtime: "2h 12m",
    steps: [
      { type: "beat", label: "01 · Survey", caption: "oc-reverse-spec reads the code", skills: ["oc-reverse-spec"] },
      { type: "exchange", role: "user",
        content: "3-year-old Rails app. No docs. Engineer leaves in 3 weeks. Board wants Carrier Scorecard before she goes. We're terrified of touching anything." },
      { type: "exchange", role: "claude", skill: "oc-reverse-spec",
        content: "Crawling 47k lines. Reconstructing spec from models, controllers, naming patterns. ETA 12 minutes. Marking confidence per section: ★★★★★ for machine-extractable inventories, ★★★ where I had to infer." },
      { type: "exchange", role: "claude", skill: "oc-reverse-spec",
        content: "Done. 142-page spec. Risk map: settlement.rb (812 lines, 0 tests, money flow) 🚨. fuel_reindex.rb (nightly, no alerting). seeds.rb (hardcoded prod Carrier IDs — delete before prod). Three open questions flagged in honest uncertainty.",
        artifacts: ["spec"] },

      { type: "beat", label: "02 · Plan the new feature", caption: "oc-app-architect reads the spec as baseline", skills: ["oc-app-architect"] },
      { type: "exchange", role: "claude", skill: "oc-app-architect",
        content: "Reading oc-reverse-spec output as Phase-1 baseline. Carrier Scorecard scoped surgically: read-only over existing Bid/Shipment/Document tables. Zero touch to settlement.rb. New routes namespaced under /api/v1/scorecards. Behind FLAG_CARRIER_SCORECARD.",
        artifacts: ["feature"] },

      { type: "beat", label: "03 · Build", caption: "with an extra-strict audit gate", skills: ["oc-app-architect", "oc-code-auditor"] },
      { type: "exchange", role: "claude", skill: "oc-app-architect",
        content: "Generator pass 1 — 8 files. Read-only controllers + service object + ERB partials. 24 RSpec cases including a regression test that diffs Settlement bytecode pre/post." },
      { type: "exchange", role: "claude", skill: "oc-code-auditor",
        content: "Extra-strict gate engaged for this codebase. AST-diffed Settlement model: untouched. 0 N+1 queries. 100% line coverage on new code. Verified seeds.rb still has the hardcoded prod IDs (separate ticket — not this PR's job). Merge approved.",
        artifacts: ["audit"] },
    ],
  },

  // ─────────────────────────────────────────────────────────────
  {
    id: "stripe-ship",
    title: "Ship Stripe subscriptions by Friday",
    tagline: "Stripe subscriptions by Friday",
    summary:
      "Two tiers, per-seat billing, webhook signatures, audit gate — five days, one session.",
    inputs: [
      "Live Next.js app · Prisma on Postgres",
      "Pro $19/mo · Team $49/mo per seat",
      "No prior Stripe experience",
      "One 40-hour week until launch",
    ],
    outputs: [
      { id: "contract", label: "Integration contract", kind: "contract.md",
        body: "POST /api/billing/checkout creates checkout.sessions. Webhooks: checkout.session.completed, subscription.updated, subscription.deleted, invoice.payment_failed. Idempotency via StripeEvent.stripe_event_id unique index. Per-tenant invariants: one active sub, seats sync within 60s, past_due gates writes." },
      { id: "boundary", label: "Boundary layer", kind: "code.md",
        body: "lib/billing/{stripe.ts, mock.ts, contract.ts}. Mock-first: every test runs against mock.ts. Live wiring touches only stripe.ts. Webhooks routed through verifySignature() before any handler runs." },
      { id: "audit", label: "oc-code-auditor money pass", kind: "audit.md",
        body: "Money-flow supplementary pass. Checked: signature verification, replay safety, currency precision (cents), seat reconciliation race, refund path. 2 findings, both fixed: missing idempotency on subscription.updated, off-by-one on seat downgrade. Re-run: green." },
    ],
    skills: ["oc-integrations-engineer", "oc-code-auditor", "oc-deploy-ops"],
    runtime: "5d / 4h chat",
    steps: [
      { type: "beat", label: "01 · Brief", caption: "oc-integrations-engineer sizes the job", skills: ["oc-integrations-engineer"] },
      { type: "exchange", role: "user",
        content: "Need Stripe subs by Friday. Pro $19, Team $49 per seat. Never wired Stripe. Don't want to break prod." },
      { type: "exchange", role: "claude", skill: "oc-integrations-engineer",
        content: "5-phase protocol: recon → contract → scaffold → wire → proof. We'll build mock-first; no real keys touch the codebase until Phase 4. Contract gets an audit-gate review before live wiring." },

      { type: "beat", label: "02 · Contract", caption: "design the boundary before any code", skills: ["oc-integrations-engineer"] },
      { type: "exchange", role: "claude", skill: "oc-integrations-engineer",
        content: "Inputs → Stripe: POST /api/billing/checkout. Outputs ← Stripe: 4 webhooks via /api/billing/webhook (raw body, signature-verified). Invariants: one active sub per Team/User, seats sync ≤60s, idempotent replay, past_due gates writes.",
        artifacts: ["contract"] },

      { type: "beat", label: "03 · Scaffold + wire", caption: "boundary layer first, live keys last", skills: ["oc-integrations-engineer"] },
      { type: "exchange", role: "claude", skill: "oc-integrations-engineer",
        content: "Scaffold: lib/billing/{stripe.ts, mock.ts, contract.ts}. Mock-first — every test runs against mock.ts. Live wiring touches only stripe.ts when FLAG_STRIPE_LIVE flips. Fixture clock for Stripe test mode.",
        artifacts: ["boundary"] },

      { type: "beat", label: "04 · Audit gate", caption: "oc-code-auditor before merge", skills: ["oc-code-auditor"] },
      { type: "exchange", role: "claude", skill: "oc-code-auditor",
        content: "Money-flow supplementary pass. 2 findings:\n• subscription.updated missing idempotency check — fixed\n• seat downgrade off-by-one (rounding cents) — fixed\nRe-run: green. Approved for merge.",
        artifacts: ["audit"] },

      { type: "beat", label: "05 · Go-live", caption: "feature flag flipped", skills: ["oc-integrations-engineer", "oc-deploy-ops"] },
      { type: "exchange", role: "user", content: "Friday. Flip it on for 5%." },
      { type: "exchange", role: "claude", skill: "oc-integrations-engineer",
        content: "FLAG_STRIPE_LIVE=true at 5% rollout. First webhook arrived 47s after first checkout. Idempotency ledger: 0 duplicates. 2 hours later: 5% → 100%. Subscriptions live." },
    ],
  },

  // ─────────────────────────────────────────────────────────────
  {
    id: "postgres-migration",
    title: "Swap D1 for Postgres without downtime",
    tagline: "D1 → Postgres without the outage",
    summary:
      "A live Workers app outgrew D1. oc-migration-ops writes the cutover plan, oc-deploy-ops runs it, oc-monitoring-ops watches.",
    inputs: [
      "Live CF Worker + D1 (~2.1M rows, 14 tables)",
      "Three tenants hit D1 row limit last week",
      "Target: Supabase Postgres us-east",
      "Zero downtime — no read errors, no lost writes",
    ],
    outputs: [
      { id: "plan", label: "Migration plan", kind: "plan.md",
        body: "5 phases, 5 rollbacks. P1 schema mirror. P2 dual-write. P3 backfill + verify (md5 row hashes). P4 read cutover (10/50/100% staged). P5 write cutover + 7-day D1 retire window. Every phase gated by KV flag, rollback ≤30s." },
      { id: "verify", label: "Verification gates", kind: "checks.md",
        body: "oc-monitoring-ops watches p99 latency, error rate, row-count drift per phase. Drift > 0.1% → Slack alert. p99 regression > 20ms → auto-rollback to prior phase. Backfill parity: row counts + md5(concat(columns)) must match per table." },
      { id: "ledger", label: "Cutover ledger", kind: "log",
        body: "P1 12 min · P2 38 min · P3 1h 47m (14 tables, all parity-clean) · P4 28 min staged · P5 18 min. Total wall-clock: 3h 23m. Zero user-facing errors. D1 retired 7 days later, clean." },
    ],
    skills: ["oc-migration-ops", "oc-deploy-ops", "oc-monitoring-ops", "oc-orchestrator"],
    runtime: "1 Wednesday",
    steps: [
      { type: "beat", label: "01 · Assess", caption: "oc-migration-ops sizes the engine swap", skills: ["oc-migration-ops"] },
      { type: "exchange", role: "user",
        content: "Three tenants hit D1's per-database row limit. We picked Supabase. Need to cut over without downtime. Today, ideally." },
      { type: "exchange", role: "claude", skill: "oc-migration-ops",
        content: "Assessment → plan → execute → verify loop. Slicing into 5 phases with rollback at every step:\n1. Schema mirror (read-only)\n2. Dual-write (D1 source of truth)\n3. Backfill + parity verify\n4. Read cutover (10/50/100%)\n5. Write cutover + 7-day D1 retire window",
        artifacts: ["plan"] },

      { type: "beat", label: "02 · Execute + verify", caption: "oc-deploy-ops runs; oc-monitoring-ops watches", skills: ["oc-deploy-ops", "oc-monitoring-ops"] },
      { type: "exchange", role: "claude", skill: "oc-deploy-ops",
        content: "Phase 1 done — Supabase provisioned, schema applied via drizzle-kit. Phase 2 — FLAG_PG_DUAL_WRITE=true. Drift checker every 5 min. Postgres writes best-effort this phase (alerts on failure, not user errors)." },
      { type: "exchange", role: "claude", skill: "oc-monitoring-ops",
        content: "Phase 3 backfill: 14 tables snapshotted to Workers Object Storage as JSONL, stream-inserted into Postgres in single-table transactions. Parity check via md5(concat(columns)): all 14 tables clean.",
        artifacts: ["verify"] },

      { type: "beat", label: "03 · Cross-project view", caption: "oc-orchestrator summarizes state", skills: ["oc-orchestrator"] },
      { type: "exchange", role: "user", content: "/oc-ops status" },
      { type: "exchange", role: "claude", skill: "oc-orchestrator",
        content: "Across all projects:\n• heads-down: P3 complete, P4 ready (read cutover staged)\n• stripe-app: stable, no migrations queued\n• ops dashboard: Postgres now primary read\nNext recommended action: P4 read cutover at 10%." },

      { type: "beat", label: "04 · Cut over + retire", caption: "oc-deploy-ops ships; oc-monitoring-ops watches the 7-day window", skills: ["oc-deploy-ops", "oc-monitoring-ops"] },
      { type: "exchange", role: "claude", skill: "oc-deploy-ops",
        content: "P4: 10% → 50% → 100% over 30 min. Background dual-read continues for 48h. P5: writes go Postgres-only, D1 read-only. 7-day retire window starts.",
        artifacts: ["ledger"] },
      { type: "exchange", role: "claude", skill: "oc-monitoring-ops",
        content: "Day 7: zero D1 reads in 96h, zero parity drift, zero rollback signals. wrangler d1 delete + binding stripped from wrangler.jsonc. Engine swapped, no outage." },
    ],
  },

  // ─────────────────────────────────────────────────────────────
  {
    id: "security-hardening",
    title: "Pass a security review before SOC2 audit",
    tagline: "SOC2-ready in one pass",
    summary:
      "STRIDE threat model, OWASP mapping, CSP + TLS + WAF hardening, ranked remediation backlog.",
    inputs: [
      "Live Next.js SaaS · CF in front · Supabase",
      "First SOC2 Type I audit in ~6 weeks",
      "Founder read OWASP Top 10 once",
      "No threat model · default WAF · no CSP",
    ],
    outputs: [
      { id: "threat", label: "STRIDE threat model", kind: "threat-model.md",
        body: "8 STRIDE findings ranked by exploitability × impact. CRITICAL: service-role key bypassing RLS for tenant-isolated queries. HIGH: no CSP, default WAF, stack traces in 500s. OWASP map: A01 FAIL, A05 FAIL, A04 PARTIAL, A09 PARTIAL — others PASS." },
      { id: "harden", label: "Hardening plan", kind: "hardening.md",
        body: "CSP: default-src 'self'; script-src 'self' nonce-…; report-uri /csp-report. Cloudflare WAF: managed rules + rate-limit on /api/* (60/min/IP). TLS: HSTS preload, TLS 1.3 only. DNS: CAA pinned. Cookies: SameSite=Strict on state-changers. RLS: per-tenant JWT replaces service role." },
      { id: "backlog", label: "Remediation backlog", kind: "backlog.md",
        body: "P0 RLS bypass (1d). P0 CSP rollout (0.5d). P1 WAF rate-limit (0.25d). P1 stack-trace sanitizer (0.5d). P2 admin audit log (1d). P2 SameSite=Strict (0.25d). P3 webhook IP pin (0.25d). Total: 4 dev-days. SOC2 Type I clears at P0+P1." },
    ],
    skills: ["oc-security-auditor", "oc-code-auditor", "oc-deploy-ops"],
    runtime: "2h 04m",
    steps: [
      { type: "beat", label: "01 · Threat model", caption: "oc-security-auditor runs STRIDE + OWASP", skills: ["oc-security-auditor"] },
      { type: "exchange", role: "user",
        content: "First SOC2 Type I in 6 weeks. Sales already promised it'd be ready. What's going to fail before the auditor finds it?" },
      { type: "exchange", role: "claude", skill: "oc-security-auditor",
        content: "4-stage sweep: STRIDE → OWASP map → infra hardening → attack surface. Three trust boundaries:\n[browser] → [CF edge] → [Vercel] → [Supabase]\nRunning STRIDE per boundary. ETA 14 min." },
      { type: "exchange", role: "claude", skill: "oc-security-auditor",
        content: "8 findings, ranked.\n#1 CRITICAL — service-role key bypassing RLS for tenant queries. Auditor will flag in 10 min.\n#2 HIGH — no CSP header, any script injection has full reign.\n#3 HIGH — default Cloudflare WAF, no rate-limit on /api/*.\n#4 HIGH — stack traces in production 500s.",
        artifacts: ["threat"] },

      { type: "beat", label: "02 · Code-level chain", caption: "oc-code-auditor sweeps underneath", skills: ["oc-code-auditor"] },
      { type: "exchange", role: "claude", skill: "oc-code-auditor",
        content: "Chained from oc-security-auditor. RLS bypass (Finding #1) is reachable from 4 routes — confirmed, not theoretical. No SQL injection. No hardcoded secrets in repo. 1 weak randomness usage in /invite (Math.random) — flagged as P2." },

      { type: "beat", label: "03 · Hardening plan", caption: "oc-security-auditor writes the infra playbook", skills: ["oc-security-auditor"] },
      { type: "exchange", role: "claude", skill: "oc-security-auditor",
        content: "Infra hardening:\n• CSP nonced, report-uri wired\n• CF WAF managed rules + 60/min/IP rate-limit on /api/*\n• HSTS preload + TLS 1.3 only\n• CAA pinned\n• SameSite=Strict on state-changing cookies\n• Per-tenant JWT replaces service role for RLS",
        artifacts: ["harden"] },

      { type: "beat", label: "04 · Remediation + deploy gate", caption: "oc-security-auditor → build pipeline", skills: ["oc-security-auditor", "oc-deploy-ops"] },
      { type: "exchange", role: "claude", skill: "oc-security-auditor",
        content: "Backlog ranked by SOC2 weight × dev-cost.\nP0: RLS bypass (1d), CSP (0.5d) — SOC2 blockers\nP1: WAF rate-limit, stack-trace sanitizer (0.75d) — CC6.1\nP2: admin audit log, SameSite=Strict, webhook IP pin\nTotal 4 dev-days. SOC2 Type I clears at P0+P1.",
        artifacts: ["backlog"] },
      { type: "exchange", role: "claude", skill: "oc-deploy-ops",
        content: "Next prod deploy gated on both: oc-code-auditor green AND oc-security-auditor backlog P0/P1 closed. Deploy pipeline updated. .checkpoints/oc-security-auditor.checkpoint.json written." },
    ],
  },
];

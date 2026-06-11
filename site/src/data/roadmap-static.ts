/**
 * Static, curated roadmap for the /changelog roadmap timeline.
 *
 * This replaces the build-time Linear pull (`scripts/gen-roadmap.mjs` →
 * `roadmap.json`, read via `loadRoadmap()`) as the data source for
 * RoadmapTimeline. The Linear plumbing is left in place but bypassed;
 * the roadmap is now hand-maintained here so it tells a clean
 * release-arc story (v1.5 next → v1.6 / v1.7 / v1.8 planned) without
 * depending on label hygiene in Linear at build time.
 *
 * 2026-06-11 renumber: "Opchain for Codex" (the MCP server, PR #260 —
 * originally slated as the v1.4.3 patch, then tabled to v1.8) is promoted
 * to v1.5 and ships immediately. Everything previously scheduled moves
 * down one release: Build the AI app v1.5 → v1.6, the instrumented
 * pipeline v1.6 → v1.7, the distribution play v1.7 → v1.8.
 *
 * Bucket = release status, NOT a release number. "Shipped" means live in
 * production (those live in the release-history list on /changelog, so the
 * shipped bucket here is empty). v1.5 is built but NOT yet deployed, so it
 * sits in "in-progress"; v1.6 through v1.8 are "planned". Every forward
 * item is votable.
 *
 * Voting: vote buttons POST /api/votes/<id> and the Worker dedups
 * per-IP/day in KV keyed on the id. IDs use an `OPC-` prefix (matches the
 * Worker's `^[A-Z]{2,8}-\d{1,6}$` validation) so they write to their own
 * fresh count keys, independent of any Linear identifier. Ids are sticky —
 * OPC-150/16x/17x keep their accumulated votes through the renumber, so
 * the id no longer encodes the milestone number.
 *
 * Shape matches `Roadmap` in roadmap-types.ts so RoadmapTimeline can
 * consume either source interchangeably.
 */
import type { Roadmap } from "./roadmap-types";

export const staticRoadmap: Roadmap = {
  generated_at: "2026-06-11T00:00:00.000Z",
  note: null,
  items: {
    // Empty: shipped releases live in the release-history list on
    // /changelog, not in the forward-looking roadmap timeline.
    shipped: [],
    "in-progress": [
      {
        // OPC-143 nods to the original 1.4.3 slating of this release.
        id: "OPC-143",
        title: "v1.5 — Opchain for Codex (MCP server)",
        blurb:
          "The opchain pipeline beyond Claude Code: skill catalog, /oc-* command + intent routing, the orchestrator protocol, and cross-session checkpoints exposed over MCP — for Codex and any MCP-aware agent. Hosted (POST /mcp) and local stdio transports. Built in PR #260 — shipping now.",
        url: "/changelog#v1-5",
        bucket: "in-progress",
        milestone: "v1.5",
        milestoneSort: 1500,
        // Built and merged — shipping immediately.
        targetDate: null,
        labels: [],
        priority: 2,
        updatedAt: "2026-06-11T00:00:00.000Z",
      },
    ],
    planned: [
      {
        id: "OPC-150",
        title: "Build the AI app — four AI-native skills",
        blurb:
          "Four new AI-native skills (claude-api, rag-forge, agent-forge, prompt-ops), vector-DB packs, and an AI-app branch in /oc-discover. Built and lockstep-bumped (22 skills) on its release branch — renumbered from v1.5 to v1.6 when Opchain for Codex took the v1.5 slot.",
        url: "/changelog#v1-6",
        bucket: "planned",
        milestone: "v1.6",
        milestoneSort: 1600,
        // Built, awaiting release — no firm public ship date yet.
        targetDate: null,
        labels: [],
        priority: 2,
        updatedAt: "2026-06-11T00:00:00.000Z",
      },
      {
        id: "OPC-160",
        title: "cost-ops — per-phase LLM cost attribution",
        blurb:
          "New /cost skill: attributes Anthropic spend to each skill phase, adds budget gates to checkpoints, and recommends model-tier routing (Haiku for cheap phases, Opus for spec/audit).",
        url: "/changelog#v1-7",
        bucket: "planned",
        milestone: "v1.7",
        milestoneSort: 1700,
        targetDate: "2026-07-15",
        labels: [],
        priority: 2,
        updatedAt: "2026-06-11T00:00:00.000Z",
      },
      {
        id: "OPC-161",
        title: "telemetry-ops — opt-in local usage metering",
        blurb:
          "New /telemetry skill: opt-in metering to .checkpoints/usage.sqlite, aggregating anonymized 'skills people actually use' stats that power a public /dashboard.",
        url: "/changelog#v1-7",
        bucket: "planned",
        milestone: "v1.7",
        milestoneSort: 1700,
        targetDate: "2026-07-15",
        labels: [],
        priority: 2,
        updatedAt: "2026-06-11T00:00:00.000Z",
      },
      {
        id: "OPC-162",
        title: "oc-checkpoint-protocol v1.3 — cost + eval fields",
        blurb:
          "First protocol bump since v1.2: adds cost, eval_scores, and telemetry_handle fields. oc-bug-check and oc-code-auditor start emitting eval scores against a stable rubric, not just pass/fail.",
        url: "/changelog#v1-7",
        bucket: "planned",
        milestone: "v1.7",
        milestoneSort: 1700,
        targetDate: "2026-07-15",
        labels: [],
        priority: 3,
        updatedAt: "2026-06-11T00:00:00.000Z",
      },
      {
        id: "OPC-170",
        title: "marketplace — community-contributed skills",
        blurb:
          "A marketplace site surface for community skills. Every contributed skill adds breadth at zero core-team cost; opchain itself is the first marketplace.",
        url: "/changelog#v1-8",
        bucket: "planned",
        milestone: "v1.8",
        milestoneSort: 1800,
        targetDate: "2026-09-01",
        labels: [],
        priority: 3,
        updatedAt: "2026-06-11T00:00:00.000Z",
      },
      {
        id: "OPC-171",
        title: "template-ops — opinionated project starters",
        blurb:
          "New skill for project starters that pre-wire a whole pipeline (stack + skills + checkpoints) so a new project lands ready to run from the first commit.",
        url: "/changelog#v1-8",
        bucket: "planned",
        milestone: "v1.8",
        milestoneSort: 1800,
        targetDate: "2026-09-01",
        labels: [],
        priority: 3,
        updatedAt: "2026-06-11T00:00:00.000Z",
      },
    ],
    backlog: [],
  },
  milestones: [],
};

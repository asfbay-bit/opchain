/**
 * Static, curated roadmap for the /changelog roadmap timeline.
 *
 * This replaces the build-time Linear pull (`scripts/gen-roadmap.mjs` →
 * `roadmap.json`, read via `loadRoadmap()`) as the data source for
 * RoadmapTimeline. The Linear plumbing is left in place but bypassed;
 * the roadmap is now hand-maintained here so it tells a clean
 * release-arc story (v1.6 building → v1.7 planned) without depending
 * on label hygiene in Linear at build time.
 *
 * Bucket = release status, NOT a release number. "Shipped" means live in
 * production (those live in the release-history list on /changelog, so the
 * shipped bucket here is empty). v1.5 and v1.6 have both shipped, so they have
 * left the forward timeline. v1.7 is the next release — "Seams & Signals", a
 * scoped plan of three new skills (oc-signal-forge ships first; the
 * oc-modularize-ops → oc-fleet-ops chain follows in 1.7.1). The distribution-
 * play theme vote v1.7 used to hold moved out to v1.8. Forward items live in
 * "planned" (the bucket /changelog renders). v1.7 is decided (no vote); the
 * v1.8 theme is still votable.
 *
 * Voting: vote buttons POST /api/votes/<id> and the Worker dedups
 * per-IP/day in KV keyed on the id. IDs use an `OPC-` prefix (matches the
 * Worker's `^[A-Z]{2,8}-\d{1,6}$` validation) so they write to their own
 * fresh count keys, independent of any Linear identifier.
 *
 * Shape matches `Roadmap` in roadmap-types.ts so RoadmapTimeline can
 * consume either source interchangeably.
 */
import type { Roadmap } from "./roadmap-types";

export const staticRoadmap: Roadmap = {
  generated_at: "2026-06-26T00:00:00.000Z",
  note: null,
  items: {
    // Empty: shipped releases (incl. v1.5 and v1.6) live in the release-history
    // list on /changelog, not in the forward-looking timeline.
    shipped: [],
    // Empty: the next release (v1.7 "Seams & Signals") is surfaced as
    // "Coming Next" and its scoped items live in `planned` (the bucket
    // /changelog renders). v1.7 is decided, so it is not votable.
    "in-progress": [],
    planned: [
      // v1.7 "Seams & Signals" — the next release; scoped, not votable.
      {
        id: "OPC-190",
        title: "oc-signal-forge — question → trustworthy metric",
        blurb:
          "New skill owning the product-analytics backend: instrument a metric, harvest it, and adversarially prove it answers the question before wiring it to oc-dash-forge. Ships first as 1.7.",
        url: "/changelog#v1-7",
        bucket: "planned",
        milestone: "v1.7",
        milestoneSort: 1700,
        targetDate: "2026-09-01",
        labels: [],
        priority: 2,
        updatedAt: "2026-06-26T00:00:00.000Z",
      },
      {
        id: "OPC-191",
        title: "oc-modularize-ops — decompose a monolith, provably",
        blurb:
          "New skill that splits a live monolith with zero functionality/data loss, using golden fixtures from real traffic as the equivalence oracle, then hands the code-move + cutover to oc-migration-ops. Lands in 1.7.1.",
        url: "/changelog#v1-7",
        bucket: "planned",
        milestone: "v1.7",
        milestoneSort: 1700,
        targetDate: "2026-09-01",
        labels: [],
        priority: 3,
        updatedAt: "2026-06-26T00:00:00.000Z",
      },
      {
        id: "OPC-192",
        title: "oc-fleet-ops — operate a fleet on self-managed infra",
        blurb:
          "New skill to provision, deploy, and operate one-or-more containers across self-managed infra (k8s/Nomad/Compose, IaC, on-prem VMs, GCE) — the bare-metal territory oc-deploy-ops routes away. Lands in 1.7.1.",
        url: "/changelog#v1-7",
        bucket: "planned",
        milestone: "v1.7",
        milestoneSort: 1700,
        targetDate: "2026-09-01",
        labels: [],
        priority: 3,
        updatedAt: "2026-06-26T00:00:00.000Z",
      },
      // v1.8 "The distribution play" — theme vote, pushed out a release by the
      // 1.7 "Seams & Signals" plan. Still votable on /changelog.
      {
        id: "OPC-170",
        title: "marketplace — community-contributed skills",
        blurb:
          "A marketplace site surface for community skills. Every contributed skill adds breadth at zero core-team cost; opchain itself is the first marketplace.",
        url: "/changelog#v1-8",
        bucket: "planned",
        milestone: "v1.8",
        milestoneSort: 1800,
        targetDate: null,
        labels: [],
        priority: 3,
        updatedAt: "2026-06-26T00:00:00.000Z",
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
        targetDate: null,
        labels: [],
        priority: 3,
        updatedAt: "2026-06-26T00:00:00.000Z",
      },
    ],
    backlog: [],
  },
  milestones: [],
};

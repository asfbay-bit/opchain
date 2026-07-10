/**
 * Static, curated roadmap for the /changelog roadmap timeline.
 *
 * This replaces the build-time Linear pull (`scripts/gen-roadmap.mjs` →
 * `roadmap.json`, read via `loadRoadmap()`) as the data source for
 * RoadmapTimeline. The Linear plumbing is left in place but bypassed;
 * the roadmap is now hand-maintained here so it tells a clean
 * release-arc story without depending on label hygiene in Linear at
 * build time.
 *
 * Release arc (keep in sync with site/src/pages/changelog.astro, the
 * canonical rendering, and skills/CHANGELOG.md, the canonical release log):
 *   v1.7 "Seams & Signals" — shipped 2026-07-01.
 *   v1.8 "The quality-gate rail" (rendered on /changelog as
 *        "Documentation & repo hygiene") — oc-docs-forge + oc-repo-ops,
 *        the every-PR documentation + repo-readiness gate. Decided, not
 *        votable, so it carries no items here.
 *   v1.9 "The distribution play" — the theme vote formerly labelled v1.8,
 *        pushed one slot by the quality-gate release. Its three competing
 *        options live in `planned` (the bucket /changelog renders).
 *
 * Bucket = release status, NOT a release number. "Shipped" means live in
 * production (those live in the release-history list on /changelog, so the
 * shipped bucket here is empty).
 *
 * Voting: vote buttons POST /api/votes/<id> and the Worker dedups
 * per-IP/day in KV keyed on the id. IDs use an `OPC-` prefix (matches the
 * Worker's `^[A-Z]{2,8}-\d{1,6}$` validation). OPC-170/173/174 must match
 * the v1.9 theme-option ids in changelog.astro — they share live vote
 * counts. (OPC-171 "template-ops" was folded into OPC-170
 * "Marketplace + templates" when the theme options were consolidated.)
 *
 * Shape matches `Roadmap` in roadmap-types.ts so RoadmapTimeline can
 * consume either source interchangeably.
 */
import type { Roadmap } from "./roadmap-types";

export const staticRoadmap: Roadmap = {
  generated_at: "2026-07-10T00:00:00.000Z",
  note: null,
  items: {
    // Empty: shipped releases (v1.7 and earlier) live in the release-history
    // list on /changelog, not in the forward-looking timeline.
    shipped: [],
    // Empty: v1.8 "The quality-gate rail" (oc-docs-forge + oc-repo-ops) is
    // decided and surfaced as "Coming Next" on /changelog with no vote
    // buttons, so it contributes no votable items here.
    "in-progress": [],
    planned: [
      // v1.9 "The distribution play" — theme vote: three growth options
      // compete and the winner becomes the v1.9 flagship. Votable on
      // /changelog; ids mirror the v19Options array in changelog.astro.
      {
        id: "OPC-170",
        title: "marketplace + templates — community skills and starters",
        blurb:
          "A community skill/pack registry plus opinionated project starters. Every contribution adds breadth at zero core-team cost; opchain itself is the first marketplace.",
        url: "/changelog#v1-9",
        bucket: "planned",
        milestone: "v1.9",
        milestoneSort: 1900,
        targetDate: null,
        labels: [],
        priority: 3,
        updatedAt: "2026-07-10T00:00:00.000Z",
      },
      {
        id: "OPC-173",
        title: "agency play — multi-client pipelines",
        blurb:
          "oc-monorepo-ops, multi-project checkpoint scoping, a /for-agencies expansion, and a client-handoff demo scenario.",
        url: "/changelog#v1-9",
        bucket: "planned",
        milestone: "v1.9",
        milestoneSort: 1900,
        targetDate: null,
        labels: [],
        priority: 3,
        updatedAt: "2026-07-10T00:00:00.000Z",
      },
      {
        id: "OPC-174",
        title: "pipeline depth — discovery-ops and qa-ops",
        blurb:
          "oc-discovery-ops (JTBD / opportunity trees, upstream of app-architect) and oc-qa-ops, splitting test-pyramid design out of oc-bug-check.",
        url: "/changelog#v1-9",
        bucket: "planned",
        milestone: "v1.9",
        milestoneSort: 1900,
        targetDate: null,
        labels: [],
        priority: 3,
        updatedAt: "2026-07-10T00:00:00.000Z",
      },
    ],
    backlog: [],
  },
  milestones: [],
};

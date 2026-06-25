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
 * left the forward timeline. v1.7 is the next release — its theme is being
 * chosen via the vote surfaced as "Coming Next" on /changelog. v1.7 items live
 * in "planned" because that is the bucket /changelog renders + makes votable.
 * Every forward (rendered) item is votable.
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
  generated_at: "2026-06-25T00:00:00.000Z",
  note: null,
  items: {
    // Empty: shipped releases (incl. v1.5 and v1.6) live in the release-history
    // list on /changelog, not in the forward-looking timeline.
    shipped: [],
    // Empty: the next release (v1.7) is surfaced as "Coming Next" and its
    // votable theme options live in `planned` (the bucket /changelog renders).
    "in-progress": [],
    planned: [
      {
        id: "OPC-170",
        title: "marketplace — community-contributed skills",
        blurb:
          "A marketplace site surface for community skills. Every contributed skill adds breadth at zero core-team cost; opchain itself is the first marketplace.",
        url: "/changelog#v1-7",
        bucket: "planned",
        milestone: "v1.7",
        milestoneSort: 1700,
        targetDate: "2026-09-01",
        labels: [],
        priority: 3,
        updatedAt: "2026-05-25T00:00:00.000Z",
      },
      {
        id: "OPC-171",
        title: "template-ops — opinionated project starters",
        blurb:
          "New skill for project starters that pre-wire a whole pipeline (stack + skills + checkpoints) so a new project lands ready to run from the first commit.",
        url: "/changelog#v1-7",
        bucket: "planned",
        milestone: "v1.7",
        milestoneSort: 1700,
        targetDate: "2026-09-01",
        labels: [],
        priority: 3,
        updatedAt: "2026-05-25T00:00:00.000Z",
      },
    ],
    backlog: [],
  },
  milestones: [],
};

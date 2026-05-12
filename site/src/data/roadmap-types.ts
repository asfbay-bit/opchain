/**
 * Types for the build-time roadmap pull (`scripts/gen-roadmap.mjs` →
 * `site/src/data/roadmap.json`).
 *
 * The JSON is gitignored. CI's prebuild step regenerates it before every
 * `astro check` / `astro build`. Locally, the JSON ships as an empty
 * placeholder if `LINEAR_API_KEY` isn't in the shell.
 */

export type RoadmapBucket = "shipped" | "in-progress" | "planned" | "backlog";

export interface RoadmapItem {
  /** Linear identifier, e.g. "OPCHN-217". */
  id: string;
  title: string;
  /** First line of the Linear issue description, truncated to 240 chars. */
  blurb: string;
  /** Linear permalink — opens the canonical issue. */
  url: string;
  bucket: RoadmapBucket;
  /** Linear projectMilestone.name (e.g. "v1.5") — null when unscoped. */
  milestone: string | null;
  milestoneSort: number | null;
  targetDate: string | null;
  labels: string[];
  /** Linear's 0–4 priority (0 = none, 1 = urgent, 4 = low). */
  priority: number;
  updatedAt: string;
}

export interface RoadmapMilestone {
  name: string;
  sortOrder: number | null;
  targetDate: string | null;
  counts: Record<RoadmapBucket, number>;
}

export interface Roadmap {
  generated_at: string;
  /** Set when the build pulled with no LINEAR_API_KEY or a failed fetch. */
  note: string | null;
  items: Record<RoadmapBucket, RoadmapItem[]>;
  milestones: RoadmapMilestone[];
}

/**
 * Loader for `site/src/data/roadmap.json`. Returns an empty shape if the
 * JSON is missing (i.e. prebuild hasn't run yet) so consumers never throw.
 */
export async function loadRoadmap(): Promise<Roadmap> {
  try {
    const mod = await import("./roadmap.json");
    return (mod.default ?? mod) as Roadmap;
  } catch {
    return {
      generated_at: new Date().toISOString(),
      note: "roadmap.json missing — run `npm run gen-roadmap` (or the full prebuild).",
      items: { shipped: [], "in-progress": [], planned: [], backlog: [] },
      milestones: [],
    };
  }
}

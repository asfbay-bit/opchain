/**
 * Types + loader for the build-time roadmap pull
 * (`scripts/gen-roadmap.mjs` → `site/src/data/roadmap.json`).
 *
 * The JSON is gitignored. CI's prebuild step regenerates it before every
 * `astro check` / `astro build`. Locally and in CI runs that haven't
 * regenerated yet, `loadRoadmap()` reads the file from disk via fs and
 * falls back to an empty shape if the file isn't there — so type-check
 * passes regardless of whether the JSON exists at the moment.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROADMAP_PATH = path.join(__dirname, "roadmap.json");

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
 * Loads `roadmap.json` synchronously from the filesystem at build time.
 * Astro is in static-output mode, so this only runs during SSG and the
 * result is baked into the rendered HTML. Returns an empty roadmap if
 * the file is missing (e.g. prebuild hasn't run yet, or CI's site job
 * ran astro check before gen-roadmap).
 */
export function loadRoadmap(): Roadmap {
  try {
    const raw = fs.readFileSync(ROADMAP_PATH, "utf8");
    return JSON.parse(raw) as Roadmap;
  } catch {
    return {
      generated_at: new Date().toISOString(),
      note: "roadmap.json missing — run `npm run gen-roadmap` (or the full prebuild) to refresh.",
      items: { shipped: [], "in-progress": [], planned: [], backlog: [] },
      milestones: [],
    };
  }
}

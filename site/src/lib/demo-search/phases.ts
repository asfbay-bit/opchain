// Pipeline-phase facet metadata. The Phase union itself is defined alongside
// the walkthrough data model (data/walkthroughs/types.ts); this module owns
// display order + labels for the facet UI and transcript chapter tags.

import type { Phase } from "../../data/walkthroughs/types";

/** Canonical pipeline order — drives facet chip ordering. */
export const PHASE_ORDER: Phase[] = [
  "discover",
  "spec",
  "design",
  "plan",
  "build",
  "audit",
  "ship",
  "monitor",
  "operate",
];

export const PHASE_LABEL: Record<Phase, string> = {
  discover: "Discover",
  spec: "Spec",
  design: "Design",
  plan: "Plan",
  build: "Build",
  audit: "Audit",
  ship: "Ship",
  monitor: "Monitor",
  operate: "Operate",
};

export type { Phase };

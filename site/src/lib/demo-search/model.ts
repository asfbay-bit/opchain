// Shared types for the /demo search index + engine. Kept dependency-light
// (only type imports) so both the build-time index builder and the
// browser-side engine import from here without pulling extra runtime code.

import type { Role } from "../roles";
import type { Phase } from "../../data/walkthroughs/types";
import type { ArtifactKind } from "./kinds";

export type { Role, Phase, ArtifactKind };

export type FacetKey = "skill" | "role" | "kind" | "phase";

export interface FacetValue {
  id: string;
  label: string;
  count: number;
  /** Present for skill + role chips so the UI can role-tint them. */
  role?: Role;
}

export interface IndexStep {
  /** Stable anchor within its scenario: "s{index}" (index into steps[]). */
  id: string;
  kind: "beat" | "user" | "claude";
  phase: Phase;
  /** claude steps only. */
  skill?: string;
  role?: Role;
  /** Lowercased, markdown-stripped text used for matching. */
  text: string;
  /** Original-case text used to build result snippets. */
  display: string;
  /** Canonical kinds of any artifacts referenced at this step. */
  artifactKinds: ArtifactKind[];
}

export interface IndexScenario {
  id: string;
  title: string;
  tagline: string;
  summary: string;
  skills: string[];
  roles: Role[];
  phases: Phase[];
  kinds: ArtifactKind[];
  steps: IndexStep[];
}

export interface SearchIndex {
  version: 1;
  generatedAt: string;
  scenarios: IndexScenario[];
  facets: {
    skills: FacetValue[];
    roles: FacetValue[];
    kinds: FacetValue[];
    phases: FacetValue[];
  };
}

export interface FilterState {
  q: string;
  skill: string[];
  role: Role[];
  kind: ArtifactKind[];
  phase: Phase[];
  /** Deep-link navigation target parsed from the URL hash. */
  target: { scenario: string; step: string } | null;
}

export interface ResultHit {
  scenarioId: string;
  scenarioTitle: string;
  step: IndexStep;
  score: number;
  /** HTML-safe snippet with the matched term wrapped in <mark>. */
  snippet: string;
}

export function emptyFilterState(): FilterState {
  return { q: "", skill: [], role: [], kind: [], phase: [], target: null };
}

export function isActiveFilter(s: FilterState): boolean {
  return (
    s.q.trim() !== "" ||
    s.skill.length > 0 ||
    s.role.length > 0 ||
    s.kind.length > 0 ||
    s.phase.length > 0
  );
}

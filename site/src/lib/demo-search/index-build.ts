// Build the /demo search index from the walkthrough corpus, at build time.
// Pure: imports only the (pure) walkthrough data + role map + this folder's
// helpers, so it runs in Astro SSG and in Node-environment Vitest alike.

import type { Walkthrough, Step, Phase } from "../../data/walkthroughs/types";
import { getSkillRole, getRoleLabel, type Role } from "../roles";
import { normalizeKind, ARTIFACT_KIND_ORDER, ARTIFACT_KIND_LABEL, type ArtifactKind } from "./kinds";
import { PHASE_ORDER, PHASE_LABEL } from "./phases";
import { stripMarkdown } from "./strip";
import type { SearchIndex, IndexScenario, IndexStep, FacetValue } from "./model";

const ROLE_ORDER: Role[] = [
  "workflow",
  "tri-agent",
  "audit-gate",
  "specialist",
  "advisor",
  "orchestrator",
  "success",
];

function stepText(step: Step): { match: string; display: string } {
  if (step.type === "beat") {
    const parts = [step.label, step.caption ?? "", ...(step.skills ?? [])];
    const display = parts.filter(Boolean).join(" — ");
    return { match: display.toLowerCase(), display };
  }
  if (step.role === "user") {
    return { match: step.content.toLowerCase(), display: step.content };
  }
  const display = stripMarkdown(step.content);
  return { match: display.toLowerCase(), display };
}

export function buildSearchIndex(walkthroughs: Walkthrough[]): SearchIndex {
  // Facet tallies across the whole corpus (the initial chip counts; the
  // client recomputes live counts against the active filter set).
  const skillCount = new Map<string, number>();
  const roleCount = new Map<Role, number>();
  const phaseCount = new Map<Phase, number>();
  const kindCount = new Map<ArtifactKind, number>();

  const scenarios: IndexScenario[] = walkthroughs.map((w) => {
    // artifact id → canonical kind
    const artifactKind = new Map<string, ArtifactKind>();
    const scenarioKinds = new Set<ArtifactKind>();
    for (const o of w.outputs) {
      const k = normalizeKind(o.kind);
      artifactKind.set(o.id, k);
      scenarioKinds.add(k);
    }

    // Fallback phase for any exchange that precedes the first beat.
    const firstBeatPhase =
      (w.steps.find((s) => s.type === "beat") as { phase?: Phase } | undefined)?.phase ??
      "discover";
    let currentPhase: Phase = firstBeatPhase;

    const scenarioPhases = new Set<Phase>();
    const steps: IndexStep[] = w.steps.map((step, si) => {
      if (step.type === "beat") currentPhase = step.phase;
      const phase = currentPhase;
      scenarioPhases.add(phase);
      phaseCount.set(phase, (phaseCount.get(phase) ?? 0) + 1);

      const { match, display } = stepText(step);
      const id = `s${si}`;

      if (step.type === "beat") {
        return { id, kind: "beat", phase, text: match, display, artifactKinds: [] };
      }
      if (step.role === "user") {
        return { id, kind: "user", phase, text: match, display, artifactKinds: [] };
      }
      // claude exchange
      const skill = step.skill || undefined;
      const role = skill ? getSkillRole(skill) : undefined;
      if (skill) skillCount.set(skill, (skillCount.get(skill) ?? 0) + 1);
      if (role) roleCount.set(role, (roleCount.get(role) ?? 0) + 1);

      const kinds = Array.from(
        new Set((step.artifacts ?? []).map((aid) => artifactKind.get(aid)).filter(Boolean) as ArtifactKind[])
      );
      for (const k of kinds) kindCount.set(k, (kindCount.get(k) ?? 0) + 1);

      return { id, kind: "claude", phase, skill, role, text: match, display, artifactKinds: kinds };
    });

    const roles = Array.from(new Set(w.skills.map(getSkillRole)));
    return {
      id: w.id,
      title: w.title,
      tagline: w.tagline,
      summary: w.summary,
      skills: w.skills,
      roles,
      phases: PHASE_ORDER.filter((p) => scenarioPhases.has(p)),
      kinds: ARTIFACT_KIND_ORDER.filter((k) => scenarioKinds.has(k)),
      steps,
    };
  });

  const skills: FacetValue[] = Array.from(skillCount.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([id, count]) => ({ id, label: id, count, role: getSkillRole(id) }));

  const roles: FacetValue[] = ROLE_ORDER.filter((r) => roleCount.has(r)).map((r) => ({
    id: r,
    label: getRoleLabel(r),
    count: roleCount.get(r) ?? 0,
    role: r,
  }));

  const kinds: FacetValue[] = ARTIFACT_KIND_ORDER.filter((k) => kindCount.has(k)).map((k) => ({
    id: k,
    label: ARTIFACT_KIND_LABEL[k],
    count: kindCount.get(k) ?? 0,
  }));

  const phases: FacetValue[] = PHASE_ORDER.filter((p) => phaseCount.has(p)).map((p) => ({
    id: p,
    label: PHASE_LABEL[p],
    count: phaseCount.get(p) ?? 0,
  }));

  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    scenarios,
    facets: { skills, roles, kinds, phases },
  };
}

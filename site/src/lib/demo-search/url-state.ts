// URL ⇄ FilterState. Query params drive filters; the hash drives the
// jump-to-exchange target. Shareable + reload-safe. Unknown facet values are
// dropped (never thrown) so a stale/hand-edited link degrades gracefully.
//
//   /demo?q=rollback&skill=oc-deploy-ops,oc-git-ops&role=audit-gate
//        &kind=runbook&phase=ship#runtime-pm-loop:s12

import type { FilterState, Role, ArtifactKind, Phase } from "./model";
import { emptyFilterState } from "./model";
import { PHASE_ORDER } from "./phases";
import { ARTIFACT_KIND_ORDER } from "./kinds";

const ROLES: Role[] = [
  "workflow",
  "tri-agent",
  "audit-gate",
  "specialist",
  "advisor",
  "orchestrator",
  "success",
];
const ROLE_SET = new Set<string>(ROLES);
const KIND_SET = new Set<string>(ARTIFACT_KIND_ORDER);
const PHASE_SET = new Set<string>(PHASE_ORDER);
const STEP_RE = /^s\d+$/;

function splitList(v: string | null): string[] {
  if (!v) return [];
  return v
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function parseTarget(hash: string): FilterState["target"] {
  const h = hash.replace(/^#/, "");
  if (!h) return null;
  const i = h.lastIndexOf(":");
  if (i === -1) return null;
  const scenario = h.slice(0, i);
  const step = h.slice(i + 1);
  if (!scenario || !STEP_RE.test(step)) return null;
  return { scenario, step };
}

/** Parse a search string ("?a=b" or "a=b") + hash ("#x:sN") into FilterState. */
export function parseUrlState(search: string, hash: string): FilterState {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const state = emptyFilterState();
  state.q = (params.get("q") ?? "").slice(0, 200);
  state.skill = splitList(params.get("skill"));
  state.role = splitList(params.get("role")).filter((r) => ROLE_SET.has(r)) as Role[];
  state.kind = splitList(params.get("kind")).filter((k) => KIND_SET.has(k)) as ArtifactKind[];
  state.phase = splitList(params.get("phase")).filter((p) => PHASE_SET.has(p)) as Phase[];
  state.target = parseTarget(hash);
  return state;
}

/** Serialize FilterState into a relative URL suffix ("?…#…" or ""). */
export function serializeUrlState(state: FilterState): string {
  const params = new URLSearchParams();
  if (state.q.trim()) params.set("q", state.q.trim());
  if (state.skill.length) params.set("skill", state.skill.join(","));
  if (state.role.length) params.set("role", state.role.join(","));
  if (state.kind.length) params.set("kind", state.kind.join(","));
  if (state.phase.length) params.set("phase", state.phase.join(","));
  const qs = params.toString();
  const hash = state.target ? `#${state.target.scenario}:${state.target.step}` : "";
  return (qs ? `?${qs}` : "") + hash;
}

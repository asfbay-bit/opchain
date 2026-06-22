// Pure search/filter/rank engine over a built SearchIndex. No DOM, no Astro —
// imported by both the browser client (demo-search.client.ts) and the Vitest
// unit suite. Filter semantics: OR within a facet group, AND across groups;
// a free-text query is AND-ed on top.

import type { SearchIndex, IndexScenario, IndexStep, FilterState, ResultHit, FacetKey } from "./model";
import { isActiveFilter } from "./model";

const MAX_RESULTS = 80;
const SNIPPET_LEN = 140;
const SNIPPET_LEAD = 48;

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function countOccurrences(haystackLower: string, needleLower: string): number {
  if (!needleLower) return 0;
  let n = 0;
  let i = haystackLower.indexOf(needleLower);
  while (i !== -1) {
    n++;
    i = haystackLower.indexOf(needleLower, i + needleLower.length);
  }
  return n;
}

/** Build an HTML-safe snippet centered on the first match, match in <mark>. */
export function buildSnippet(display: string, query: string): string {
  const q = query.trim();
  if (!q) {
    const head = display.slice(0, SNIPPET_LEN);
    return escapeHtml(head) + (display.length > SNIPPET_LEN ? "…" : "");
  }
  const lower = display.toLowerCase();
  const idx = lower.indexOf(q.toLowerCase());
  let start = 0;
  let prefix = "";
  if (idx > SNIPPET_LEAD) {
    start = idx - SNIPPET_LEAD;
    prefix = "…";
  }
  const slice = display.slice(start, start + SNIPPET_LEN);
  const suffix = start + SNIPPET_LEN < display.length ? "…" : "";
  const escaped = escapeHtml(slice);
  const re = new RegExp(`(${escapeRegExp(escapeHtml(q))})`, "ig");
  return prefix + escaped.replace(re, "<mark>$1</mark>") + suffix;
}

function scoreStep(scenario: IndexScenario, step: IndexStep, ql: string, titleLower: string): number {
  let s = 0;
  if (step.skill && step.skill.toLowerCase().includes(ql)) s += 3;
  const occ = countOccurrences(step.text, ql);
  if (occ > 0) s += occ * (step.kind === "beat" ? 2 : 1.5);
  if (titleLower.includes(ql)) s += 1;
  return s;
}

interface RawHit {
  scenario: IndexScenario;
  scenarioOrder: number;
  step: IndexStep;
  stepOrder: number;
  score: number;
}

function stepOrder(step: IndexStep): number {
  const n = parseInt(step.id.slice(1), 10);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Walk the index applying facets (optionally ignoring one group, for live
 * facet-count computation) and the query. Returns matching steps with scores.
 */
function collect(index: SearchIndex, state: FilterState, ignore?: FacetKey): RawHit[] {
  const ql = state.q.trim().toLowerCase();
  const hits: RawHit[] = [];
  index.scenarios.forEach((scenario, scenarioOrder) => {
    const titleLower = `${scenario.title} ${scenario.tagline} ${scenario.id}`.toLowerCase();
    for (const step of scenario.steps) {
      if (ignore !== "skill" && state.skill.length && !(step.skill && state.skill.includes(step.skill))) continue;
      if (ignore !== "role" && state.role.length && !(step.role && state.role.includes(step.role))) continue;
      if (ignore !== "phase" && state.phase.length && !state.phase.includes(step.phase)) continue;
      if (ignore !== "kind" && state.kind.length && !step.artifactKinds.some((k) => state.kind.includes(k))) continue;
      let score = 0;
      if (ql) {
        score = scoreStep(scenario, step, ql, titleLower);
        if (score <= 0) continue;
      }
      hits.push({ scenario, scenarioOrder, step, stepOrder: stepOrder(step), score });
    }
  });
  return hits;
}

/** Ranked result list for the current filter state. Empty when nothing active. */
export function filterAndRank(index: SearchIndex, state: FilterState): ResultHit[] {
  if (!isActiveFilter(state)) return [];
  const hits = collect(index, state);
  hits.sort(
    (a, b) =>
      b.score - a.score ||
      a.scenarioOrder - b.scenarioOrder ||
      a.stepOrder - b.stepOrder
  );
  return hits.slice(0, MAX_RESULTS).map((h) => ({
    scenarioId: h.scenario.id,
    scenarioTitle: h.scenario.title,
    step: h.step,
    score: h.score,
    snippet: buildSnippet(h.step.display, state.q),
  }));
}

export type FacetCounts = Record<FacetKey, Map<string, number>>;

/** Live facet counts — each group computed against the filter set that
 *  ignores that same group (so toggling within a group widens, not narrows). */
export function computeFacetCounts(index: SearchIndex, state: FilterState): FacetCounts {
  const tally = (ignore: FacetKey, pick: (s: IndexStep) => string[] | string | undefined): Map<string, number> => {
    const m = new Map<string, number>();
    for (const h of collect(index, state, ignore)) {
      const v = pick(h.step);
      const arr = Array.isArray(v) ? v : v ? [v] : [];
      for (const id of arr) m.set(id, (m.get(id) ?? 0) + 1);
    }
    return m;
  };
  return {
    skill: tally("skill", (s) => s.skill),
    role: tally("role", (s) => s.role),
    phase: tally("phase", (s) => s.phase),
    kind: tally("kind", (s) => s.artifactKinds),
  };
}

/** Distinct scenarios present in the current filtered set (for "N / 12"). */
export function visibleScenarioCount(index: SearchIndex, state: FilterState): number {
  if (!isActiveFilter(state)) return index.scenarios.length;
  return new Set(collect(index, state).map((h) => h.scenario.id)).size;
}

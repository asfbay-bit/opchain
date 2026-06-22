// /demo workbench Search & Filter — browser controller.
//
// Reads the build-time index inlined as <script type="application/json"
// id="demo-search-index">, then drives both the DesktopWorkbench (rail tabs +
// sidebar panels) and the MobileWorkbench (topbar button + Find overlay) from
// one shared filter state. Filtering/ranking is pure (engine.ts); this file
// owns DOM, URL state, and the jump-to-exchange handoff to each workbench's
// openStep() API.

import type { SearchIndex, FilterState, FacetKey } from "./model";
import { emptyFilterState, isActiveFilter } from "./model";
import {
  filterAndRank,
  computeFacetCounts,
  visibleScenarioCount,
  escapeHtml,
  type FacetCounts,
} from "./engine";
import { parseUrlState, serializeUrlState } from "./url-state";

interface WorkbenchApi {
  openStep(scenarioId: string, stepId: string): void;
}
declare global {
  interface Window {
    __ocDemoDesktop?: WorkbenchApi;
    __ocDemoMobile?: WorkbenchApi;
  }
}

(() => {
  const raw = document.getElementById("demo-search-index");
  if (!raw || !raw.textContent) return;
  let index: SearchIndex;
  try {
    index = JSON.parse(raw.textContent) as SearchIndex;
  } catch {
    return;
  }

  const FACET_GROUPS: FacetKey[] = ["skill", "role", "kind", "phase"];
  const FACET_GROUP_LABEL: Record<FacetKey, string> = {
    skill: "skills",
    role: "roles",
    kind: "artifact kind",
    phase: "pipeline phase",
  };
  const totalSteps = index.scenarios.reduce((n, s) => n + s.steps.length, 0);

  let state: FilterState = emptyFilterState();

  const $$ = <T extends Element = Element>(sel: string) =>
    Array.from(document.querySelectorAll<T>(sel));

  // ── rendering ──────────────────────────────────────────────────────────
  function resultsHtml(): string {
    const hits = filterAndRank(index, state);
    if (hits.length === 0) {
      const q = state.q.trim();
      return `<div class="ocs-empty">No matches${q ? ` for “${escapeHtml(q)}”` : " for these filters"}. <button type="button" class="ocs-link" data-ocs-clear>clear</button></div>`;
    }
    let html = "";
    let currentScn = "";
    for (const h of hits) {
      if (h.scenarioId !== currentScn) {
        currentScn = h.scenarioId;
        html += `<div class="ocs-res-group">${escapeHtml(h.scenarioTitle)}</div>`;
      }
      const skill = h.step.skill
        ? `<span class="ocs-chip-mini role-${h.step.role}">${escapeHtml(h.step.skill)}</span>`
        : "";
      html += `<button type="button" class="ocs-res" data-ocs-go="${h.scenarioId}:${h.step.id}">
        <span class="ocs-snip">▸ ${h.snippet}</span>
        <span class="ocs-res-meta">${skill}<span class="ocs-phase">${h.step.phase}</span><span class="ocs-step-id">${h.step.id}</span></span>
      </button>`;
    }
    return html;
  }

  function promptHtml(): string {
    return `<div class="ocs-empty">Search <strong>${totalSteps}</strong> steps across ${index.scenarios.length} scenarios — or filter by skill, role, artifact kind, and pipeline phase.</div>`;
  }

  function pillsHtml(): string {
    const out: string[] = [];
    for (const g of FACET_GROUPS) {
      for (const v of state[g] as string[]) {
        out.push(
          `<button type="button" class="ocs-pill" data-ocs-rm="${g}:${escapeHtml(v)}" aria-label="Remove ${g} filter ${escapeHtml(v)}">${g}: ${escapeHtml(v)} ✕</button>`
        );
      }
    }
    return out.join("");
  }

  function facetsHtml(counts: FacetCounts): string {
    let html = "";
    for (const g of FACET_GROUPS) {
      const values = index.facets[`${g}s` as "skills" | "roles" | "kinds" | "phases"];
      const selected = new Set(state[g] as string[]);
      const chips = values
        .map((v) => {
          const live = counts[g].get(v.id) ?? 0;
          const on = selected.has(v.id);
          const roleCls = v.role ? ` role-${v.role}` : "";
          const dis = live === 0 && !on ? " disabled" : "";
          return `<button type="button" class="ocs-chip${roleCls}" data-ocs-facet="${g}:${escapeHtml(v.id)}" aria-pressed="${on}"${dis}>${escapeHtml(v.label)}<span class="ocs-ct">${live}</span></button>`;
        })
        .join("");
      html += `<div class="ocs-facet-group"><h4>${FACET_GROUP_LABEL[g]}</h4><div class="ocs-chips">${chips}</div></div>`;
    }
    return html;
  }

  function render() {
    const active = isActiveFilter(state);
    const hits = active ? filterAndRank(index, state) : [];
    const resHtml = active ? resultsHtml() : promptHtml();
    const countText = active ? `results · ${hits.length}` : `${totalSteps} steps · 12 scenarios`;

    $$("[data-ocs-results]").forEach((el) => (el.innerHTML = resHtml));
    $$("[data-ocs-count]").forEach((el) => (el.textContent = countText));
    $$("[data-ocs-pills]").forEach((el) => (el.innerHTML = pillsHtml()));

    const counts = computeFacetCounts(index, state);
    const fHtml = facetsHtml(counts);
    $$("[data-ocs-facets]").forEach((el) => (el.innerHTML = fHtml));
    const vis = visibleScenarioCount(index, state);
    $$("[data-ocs-scn-count]").forEach(
      (el) => (el.textContent = `showing ${vis} / ${index.scenarios.length}`)
    );

    // keep all search inputs in sync without disturbing the focused caret
    $$("[data-ocs-input]").forEach((el) => {
      const input = el as HTMLInputElement;
      if (input.value !== state.q) input.value = state.q;
    });
  }

  // ── URL state ────────────────────────────────────────────────────────────
  let urlTimer = 0;
  function writeUrl(immediate = false) {
    const apply = () => {
      const suffix = serializeUrlState(state);
      const url = window.location.pathname + suffix;
      window.history.replaceState(null, "", url || window.location.pathname);
    };
    window.clearTimeout(urlTimer);
    if (immediate) apply();
    else urlTimer = window.setTimeout(apply, 250);
  }

  // ── facet + query mutations ───────────────────────────────────────────────
  function toggleFacet(group: FacetKey, value: string) {
    const arr = state[group] as string[];
    const i = arr.indexOf(value);
    if (i === -1) arr.push(value);
    else arr.splice(i, 1);
    render();
    writeUrl();
  }

  function clearAll() {
    const target = state.target;
    state = emptyFilterState();
    state.target = target;
    render();
    writeUrl();
  }

  // ── jump-to-exchange ──────────────────────────────────────────────────────
  function openStep(scenarioId: string, stepId: string) {
    const mobile = window.matchMedia("(max-width: 767px)").matches;
    const api = mobile ? window.__ocDemoMobile : window.__ocDemoDesktop;
    api?.openStep(scenarioId, stepId);
    state.target = { scenario: scenarioId, step: stepId };
    writeUrl(true);
  }

  // ── desktop rail mode switching ───────────────────────────────────────────
  function setDesktopMode(mode: string) {
    $$("[data-ocs-mode]").forEach((b) => {
      const on = b.getAttribute("data-ocs-mode") === mode;
      b.classList.toggle("is-active", on);
      b.setAttribute("aria-selected", on ? "true" : "false");
    });
    $$("[data-ocs-mode-panel]").forEach((p) => {
      p.classList.toggle("is-active", p.getAttribute("data-ocs-mode-panel") === mode);
    });
    if (mode === "search") {
      const inp = document.querySelector<HTMLInputElement>(".dw-desktop [data-ocs-input]");
      inp?.focus();
    }
  }

  // ── mobile Find overlay ───────────────────────────────────────────────────
  let lastOverlayTrigger: HTMLElement | null = null;
  function openOverlay() {
    const ov = document.querySelector<HTMLElement>("[data-ocs-overlay]");
    if (!ov) return;
    lastOverlayTrigger = document.activeElement as HTMLElement | null;
    ov.hidden = false;
    document.documentElement.style.overflow = "hidden";
    ov.querySelector<HTMLInputElement>("[data-ocs-input]")?.focus();
  }
  function closeOverlay() {
    const ov = document.querySelector<HTMLElement>("[data-ocs-overlay]");
    if (!ov) return;
    ov.hidden = true;
    document.documentElement.style.overflow = "";
    if (lastOverlayTrigger && document.contains(lastOverlayTrigger)) lastOverlayTrigger.focus();
  }

  // ── event delegation ──────────────────────────────────────────────────────
  document.addEventListener("input", (e) => {
    const t = e.target as HTMLElement;
    if (!(t instanceof HTMLInputElement) || !t.hasAttribute("data-ocs-input")) return;
    state.q = t.value;
    render();
    writeUrl();
  });

  document.addEventListener("click", (e) => {
    const el = e.target instanceof Element ? e.target : null;
    if (!el) return;

    const facet = el.closest<HTMLElement>("[data-ocs-facet]");
    if (facet) {
      const [g, v] = (facet.getAttribute("data-ocs-facet") || "").split(/:(.+)/);
      if (g && v) toggleFacet(g as FacetKey, v);
      return;
    }
    const rm = el.closest<HTMLElement>("[data-ocs-rm]");
    if (rm) {
      const [g, v] = (rm.getAttribute("data-ocs-rm") || "").split(/:(.+)/);
      if (g && v) toggleFacet(g as FacetKey, v);
      return;
    }
    if (el.closest("[data-ocs-clear]")) {
      clearAll();
      return;
    }
    const go = el.closest<HTMLElement>("[data-ocs-go]");
    if (go) {
      const raw = go.getAttribute("data-ocs-go") || "";
      const i = raw.lastIndexOf(":");
      if (i !== -1) openStep(raw.slice(0, i), raw.slice(i + 1));
      if (window.matchMedia("(max-width: 767px)").matches) closeOverlay();
      return;
    }
    const clearX = el.closest<HTMLElement>("[data-ocs-x]");
    if (clearX) {
      state.q = "";
      render();
      writeUrl();
      return;
    }
    const mode = el.closest<HTMLElement>("[data-ocs-mode]");
    if (mode) {
      setDesktopMode(mode.getAttribute("data-ocs-mode") || "scenarios");
      return;
    }
    if (el.closest("[data-ocs-open]")) {
      openOverlay();
      return;
    }
    if (el.closest("[data-ocs-overlay-close]")) {
      closeOverlay();
      return;
    }
    // scrim click on the overlay backdrop
    const ov = el.closest<HTMLElement>("[data-ocs-overlay]");
    if (ov && el === ov) closeOverlay();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    const ov = document.querySelector<HTMLElement>("[data-ocs-overlay]");
    if (ov && !ov.hidden) {
      e.preventDefault();
      closeOverlay();
    }
  });

  window.addEventListener("popstate", () => {
    state = parseUrlState(window.location.search, window.location.hash);
    render();
    if (state.target) openStepFromState();
  });

  function openStepFromState() {
    if (!state.target) return;
    const mobile = window.matchMedia("(max-width: 767px)").matches;
    const api = mobile ? window.__ocDemoMobile : window.__ocDemoDesktop;
    api?.openStep(state.target.scenario, state.target.step);
  }

  // ── init ──────────────────────────────────────────────────────────────────
  state = parseUrlState(window.location.search, window.location.hash);
  render();
  if (isActiveFilter(state)) setDesktopMode("search");
  if (state.target) {
    // defer so the workbench scripts have wired their APIs + layout settled
    window.requestAnimationFrame(() => window.requestAnimationFrame(openStepFromState));
  }
})();

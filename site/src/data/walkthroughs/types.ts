/**
 * Shared types for In Action walkthroughs.
 * A walkthrough is a scripted transcript between a user and Claude Code,
 * with occasional "beat" markers the UI renders as chapter dividers.
 *
 * Each exchange alternates user/assistant. The assistant's content is
 * markdown (rendered through site/src/lib/markdown.ts).
 */

/**
 * Pipeline phase a chapter belongs to. Controlled vocabulary in pipeline
 * order — powers the /demo workbench phase facet and the transcript chapter
 * labels. Beats are tagged explicitly; exchanges inherit the nearest
 * preceding beat's phase at search-index build time.
 */
export type Phase =
  | "discover" // idea → requirements (oc-discover, reverse-spec intake)
  | "spec" // spec + stack + architecture
  | "design" // UX, wireframes, dashboards
  | "plan" // roadmap / sprint decomposition / scaffold
  | "build" // generator → evaluator implementation
  | "audit" // code-auditor / security-auditor / bug-check gates
  | "ship" // git-ops + release-ops + deploy-ops
  | "monitor" // monitoring-ops, incident, post-deploy
  | "operate"; // migration, scale, integrations, day-2 ops

export type Beat = {
  type: "beat";
  /** Short label for the chapter divider. */
  label: string;
  /** Optional caption under the label. */
  caption?: string;
  /** Skill badge(s) for this chapter. */
  skills?: string[];
  /** Pipeline phase this chapter belongs to (required — see {@link Phase}). */
  phase: Phase;
};

export type Exchange = {
  type: "exchange";
  /** Speaker — "user" or "claude". */
  role: "user" | "claude";
  /** Optional skill label shown next to the claude bubble. */
  skill?: string;
  /** Message body — markdown for claude, plain text for user. */
  content: string;
  /**
   * Artifacts produced by this exchange. Ids reference the parent
   * walkthrough's `outputs[].id`. Renders inline as clickable chips that
   * expand the full artifact body within the chat.
   */
  artifacts?: string[];
};

export type Step = Beat | Exchange;

/**
 * A "real" artifact the session produces — a spec, a sprint ledger, an
 * audit report, a pull-request list, a runbook. The card shows only the
 * label + kind tag; clicking expands to the full body (markdown).
 */
export type Artifact = {
  /** Stable id; exchanges reference these via `Exchange.artifacts`. */
  id: string;
  /** Short title rendered on the collapsed row. */
  label: string;
  /** Tiny badge shown next to the label — e.g. "spec.md", "pull-request", "runbook". */
  kind?: string;
  /** Markdown body rendered on expansion — meant to look like the real output. */
  body: string;
};

export interface Walkthrough {
  /** URL-friendly id, used in the scenario pill `data-scenario`. */
  id: string;
  /** Display title — used in the player header once a scenario is selected. */
  title: string;
  /** 3–6 word phrase shown on the collapsed card at the top of the page. */
  tagline: string;
  /** One-line summary shown as the opener of the detail panel. */
  summary: string;
  /** Multi-paragraph description shown in the detail panel when selected. */
  description: string;
  /** What the user brings in — shown as a bullet list in the detail panel. */
  inputs: string[];
  /** What they walk out with — each expandable into a full artifact body. */
  outputs: Artifact[];
  /** Skills this walkthrough exercises. */
  skills: string[];
  /** Estimated runtime if played at one-press-per-second. */
  runtime: string;
  steps: Step[];
}

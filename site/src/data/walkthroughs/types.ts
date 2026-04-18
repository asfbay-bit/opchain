/**
 * Shared types for In Action walkthroughs.
 * A walkthrough is a scripted transcript between a user and Claude Code,
 * with occasional "beat" markers the UI renders as chapter dividers.
 *
 * Each exchange alternates user/assistant. The assistant's content is
 * markdown (rendered through site/src/lib/markdown.ts).
 */

export type Beat = {
  type: "beat";
  /** Short label for the chapter divider. */
  label: string;
  /** Optional caption under the label. */
  caption?: string;
  /** Skill badge(s) for this chapter. */
  skills?: string[];
};

export type Exchange = {
  type: "exchange";
  /** Speaker — "user" or "claude". */
  role: "user" | "claude";
  /** Optional skill label shown next to the claude bubble. */
  skill?: string;
  /** Message body — markdown for claude, plain text for user. */
  content: string;
};

export type Step = Beat | Exchange;

export interface Walkthrough {
  /** URL-friendly id, used in the scenario pill `data-scenario`. */
  id: string;
  /** Display title. */
  title: string;
  /** One-line summary shown on the scenario card. */
  summary: string;
  /** Skills this walkthrough exercises. */
  skills: string[];
  /** Estimated runtime if played at one-press-per-second. */
  runtime: string;
  steps: Step[];
}

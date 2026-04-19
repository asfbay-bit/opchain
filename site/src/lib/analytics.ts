/**
 * Client-side analytics wrapper — typed facade over `window.posthog`.
 *
 * The PostHog SDK only loads after the user accepts the consent banner
 * (see `ConsentBanner.astro`). This wrapper:
 *   - No-ops silently when consent is declined or the SDK hasn't loaded.
 *   - Never throws. Analytics must never break a user flow.
 *   - Keeps the event taxonomy in one place so new callers don't invent
 *     ad-hoc event names.
 *
 * Server-side events (demo_email_submitted, demo_chat_*, zip_downloaded,
 * feedback_submitted) are emitted by the Worker — see `src/lib/analytics.js`.
 * Client-side events here are UI-only signals that never touch the Worker.
 */

export type ClientEvent =
  | "install_copy_clicked"
  | "skill_filter_used"
  | "skill_detail_viewed"
  | "in_action_scenario_opened"
  | "tryit_prompt_selected";

type PostHog = {
  capture: (event: string, properties?: Record<string, unknown>) => void;
};

function getPosthog(): PostHog | null {
  if (typeof window === "undefined") return null;
  const ph = (window as unknown as { posthog?: PostHog }).posthog;
  return ph && typeof ph.capture === "function" ? ph : null;
}

export function track(event: ClientEvent, properties: Record<string, unknown> = {}): void {
  try {
    const ph = getPosthog();
    if (!ph) return;
    ph.capture(event, properties);
  } catch {
    // Analytics never surfaces failures.
  }
}

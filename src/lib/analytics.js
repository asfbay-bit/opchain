/**
 * PostHog server-side analytics — thin wrapper around the `/capture/` HTTP
 * endpoint. No SDK; the SDK pulls in heavy Node shims that don't work on
 * Workers. Failures are swallowed so analytics never breaks a user flow.
 *
 * Events:
 *   zip_downloaded         — GET *.zip
 *   feedback_submitted     — /api/feedback 2xx
 *
 * (The Try-It chat events `demo_email_submitted` / `demo_chat_started` /
 * `demo_chat_completed` were removed with the surface in
 * `claude/remove-try-it`.)
 */

/**
 * Hash an email into a stable PostHog distinct_id. Using SHA-256 keeps the
 * user pseudonymous in PostHog while still letting us join events for the
 * same user across sessions.
 */
export async function hashDistinctId(email) {
  const lower = String(email || "").trim().toLowerCase();
  const bytes = new TextEncoder().encode(lower);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Fire-and-forget PostHog capture. Returns a promise but callers should
 * typically hand it to `ctx.waitUntil` so the worker doesn't block on it.
 *
 * @param {object} env    – Worker env (POSTHOG_PROJECT_API_KEY + POSTHOG_HOST)
 * @param {object} input  – { distinctId, event, properties? }
 */
export async function capture(env, { distinctId, event, properties = {} }) {
  const apiKey = env?.POSTHOG_PROJECT_API_KEY;
  if (!apiKey) return; // analytics disabled — noop
  const host = (env.POSTHOG_HOST || "https://eu.i.posthog.com").replace(/\/$/, "");
  try {
    const res = await fetch(`${host}/capture/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: apiKey,
        event,
        distinct_id: distinctId,
        properties: {
          $lib: "opchain-worker",
          ...properties,
        },
        timestamp: new Date().toISOString(),
      }),
    });
    if (!res.ok) {
      // Drain and discard — we don't want a stuck body.
      res.body?.cancel?.();
    }
  } catch {
    // Never surface analytics failures to the caller.
  }
}

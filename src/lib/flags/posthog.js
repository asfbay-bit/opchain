/**
 * Server-side PostHog feature-flag client.
 *
 * Calls POST {host}/decide?v=3 with { api_key, distinct_id }, returns the
 * map of flag name → value. Fails closed: any timeout, network error, or
 * non-2xx response returns an empty map so the caller falls back to the
 * registry default.
 *
 * No SDK; the official posthog-node pulls in heavy Node shims that don't
 * work on Workers. We mirror the shape of `analytics.js` (same env vars,
 * same fail-closed posture).
 */

const DEFAULT_TIMEOUT_MS = 1500;

/**
 * @param {object} env  Worker env. Reads POSTHOG_PROJECT_API_KEY + POSTHOG_HOST.
 * @param {string} distinctId
 * @param {object} [opts]
 * @param {number} [opts.timeoutMs]
 * @returns {Promise<Record<string, boolean | string | number>>}
 */
export async function decide(env, distinctId, opts = {}) {
  const apiKey = env?.POSTHOG_PROJECT_API_KEY;
  if (!apiKey) return {};
  if (!distinctId) return {};
  const host = (env.POSTHOG_HOST || "https://eu.i.posthog.com").replace(/\/$/, "");
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${host}/decide?v=3`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ api_key: apiKey, distinct_id: distinctId }),
      signal: ctrl.signal,
    });
    if (!res.ok) {
      res.body?.cancel?.();
      return {};
    }
    const data = /** @type {any} */ (await res.json());
    // PostHog returns featureFlags as either string-valued (variant) or
    // boolean-valued. Both are passed through verbatim.
    const flags = data?.featureFlags;
    return flags && typeof flags === "object" ? flags : {};
  } catch {
    return {};
  } finally {
    clearTimeout(t);
  }
}

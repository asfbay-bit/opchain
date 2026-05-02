/**
 * Stable visitor id for flag eval. Used as the PostHog `distinct_id` so a
 * percentage rollout sticks: the same browser keeps landing on the same
 * side of the bucket across page loads.
 *
 * Stored in the `oc_id` cookie (UUID, 1 yr, SameSite=Lax, Secure, no HttpOnly
 * because the client also needs to read it for client-side flag evaluation).
 *
 * Read flow:
 *   1. Try the cookie.
 *   2. Fall back to a CF-Connecting-IP-derived hash if no cookie.
 *   3. Fall back to a fresh UUID — generated, returned, and signalled via
 *      a Set-Cookie that the caller is expected to attach to the response.
 */

const COOKIE = "oc_id";
const ONE_YEAR_S = 60 * 60 * 24 * 365;

export function readOcId(request) {
  const cookieHeader = request.headers.get("Cookie") || "";
  const match = cookieHeader.match(/(?:^|;\s*)oc_id=([A-Za-z0-9_-]+)/);
  return match ? match[1] : null;
}

export function newOcId() {
  return crypto.randomUUID();
}

export function setCookieHeader(id) {
  return `${COOKIE}=${id}; Path=/; Max-Age=${ONE_YEAR_S}; SameSite=Lax; Secure`;
}

/**
 * Get-or-mint the visitor id and return both it and the optional Set-Cookie
 * header value the caller should attach (null when no cookie needs to be set).
 */
export function ensureOcId(request) {
  const existing = readOcId(request);
  if (existing) return { id: existing, setCookie: null };
  const id = newOcId();
  return { id, setCookie: setCookieHeader(id) };
}

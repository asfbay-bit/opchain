/**
 * Request ID — a UUID stamped on every request the Worker handles.
 * Logged on every console line so Cloudflare log search can correlate
 * upstream errors with a specific user request. Mirrored in the
 * `X-Opchain-Request-Id` response header so the client can include it
 * when reporting bugs.
 */

export function newRequestId() {
  return crypto.randomUUID();
}

/** Build a logger bound to a request id. Use instead of console.* directly. */
export function bindLogger(requestId) {
  return {
    info: (...args) => console.log(`[req:${requestId}]`, ...args),
    warn: (...args) => console.warn(`[req:${requestId}]`, ...args),
    error: (...args) => console.error(`[req:${requestId}]`, ...args),
  };
}

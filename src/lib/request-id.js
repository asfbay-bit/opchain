/**
 * Request ID + structured logger.
 *
 * Every request gets a UUID that is:
 *   - stamped on every log line emitted by this module's logger
 *   - mirrored in the `X-Opchain-Request-Id` response header
 *   - propagated to outbound calls as a correlation id where useful
 *
 * The structured logger emits a single JSON line per event so Cloudflare
 * log search and downstream ingestion (Datadog / BigQuery / Honeycomb) can
 * parse it without regex. Keep keys short and stable.
 */

export function newRequestId() {
  return crypto.randomUUID();
}

/** Build a logger bound to a request id. */
export function bindLogger(requestId) {
  const base = { request_id: requestId };
  return {
    /** Free-form log with request id prefix; for messages that don't fit a schema. */
    info: (...args) => console.log(`[req:${requestId}]`, ...args),
    warn: (...args) => console.warn(`[req:${requestId}]`, ...args),
    error: (...args) => console.error(`[req:${requestId}]`, ...args),
    /** Structured JSON log — one line, parseable downstream. */
    event: (event, fields) => emit("info", { ...base, event, ...fields }),
    eventWarn: (event, fields) => emit("warn", { ...base, event, ...fields }),
    eventError: (event, fields) => emit("error", { ...base, event, ...fields }),
  };
}

function emit(level, payload) {
  const line = JSON.stringify({ level, ts: new Date().toISOString(), ...payload });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

/**
 * Canonical event names. Keeping these in one place so log queries stay
 * stable as we add new events.
 */
export const EVENTS = {
  FEEDBACK_SUBMITTED: "feedback_submitted",
  FEEDBACK_FAILED:    "feedback_failed",
  CHAT_STARTED:       "chat_started",
  CHAT_COMPLETED:     "chat_completed",
  RATE_LIMIT_HIT:     "rate_limit_hit",
  UPSTREAM_FAILED:    "upstream_failed",
  VALIDATION_FAILED:  "validation_failed",
  NOTIFY_CAPTURED:    "notify_captured",
  NOTIFY_RATELIMITED: "notify_ratelimited",
  NOTIFY_NO_KV:       "notify_no_kv",
  PIPELINE_EMAIL_SENT:        "pipeline_email_sent",
  PIPELINE_EMAIL_FAILED:      "pipeline_email_failed",
  PIPELINE_EMAIL_RATELIMITED: "pipeline_email_ratelimited",
  PIPELINE_EMAIL_NOT_CONFIGURED: "pipeline_email_not_configured",
};

// HTTP response helpers for the Worker — CORS, baseline security headers, and
// the CSP-nonce machinery. Extracted from src/index.js so the Worker entry
// module exports ONLY its default handler: workerd (wrangler 4.98+) rejects
// named exports on the entry module that aren't functions or ExportedHandlers
// (a bare `export const NONCE_PLACEHOLDER = "…"` fails module validation at
// startup). Lib modules like this one can export freely — only the entry is
// validated.

export const ALLOWED_ORIGINS = [
  "https://opchain.dev",
  "https://www.opchain.dev",
  "https://staging.opchain.dev",
  "https://opchain-dev.4fstpkkw72.workers.dev",
  "https://aidops.dev",
  "https://www.aidops.dev",
  "http://localhost:8787",
  "http://localhost:3000",
  "http://localhost:4321",
];

export function corsHeaders(origin, requestId) {
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Opchain-Request-Id",
    "Access-Control-Expose-Headers": "X-Opchain-Request-Id, X-Opchain-Version",
    "Access-Control-Max-Age": "86400",
  };
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
  }
  if (requestId) headers["X-Opchain-Request-Id"] = requestId;
  return headers;
}

// Baseline headers — safe for every response (HTML, JSON, binary).
export const BASELINE_SECURITY_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy":
    "camera=(), microphone=(), geolocation=(), payment=(), usb=(), accelerometer=(), gyroscope=(), magnetometer=()",
};

export function applyBaselineHeaders(res) {
  for (const [k, v] of Object.entries(BASELINE_SECURITY_HEADERS)) {
    res.headers.set(k, v);
  }
  return res;
}

// Sprint 7c — CSP nonce. The placeholder `__OPCHAIN_NONCE__` is stamped onto
// every <script> tag at build time by scripts/inject-nonce-placeholder.mjs.
// On every HTML response we generate a fresh nonce, substitute the placeholder
// in the body, and emit it in the CSP header. `'strict-dynamic'` lets a
// nonce-blessed script load further scripts; the explicit hosts remain for
// older browsers. `style-src` keeps `'unsafe-inline'` because Tailwind 4
// emits inline `style=` attributes; converting that is backlog item B-08.
export const NONCE_PLACEHOLDER = "__OPCHAIN_NONCE__";

export function generateNonce() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  // base64url, no padding — safe inside CSP and HTML attributes.
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function buildCspHtml(nonce) {
  return (
    "default-src 'self'; " +
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' https://*.i.posthog.com https://static.cloudflareinsights.com; ` +
    "connect-src 'self' https://*.i.posthog.com https://cloudflareinsights.com; " +
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
    "img-src 'self' data:; " +
    "font-src 'self' https://fonts.gstatic.com; " +
    "frame-ancestors 'none'; " +
    "base-uri 'self'; " +
    "form-action 'self'"
  );
}

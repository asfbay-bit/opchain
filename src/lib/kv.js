/**
 * Typed KV wrappers. Handlers should never touch `env.DATA.*` directly —
 * all reads and writes go through these helpers so key shapes stay in one
 * place and schema changes are easy to audit.
 *
 * Keys:
 *   opchain-try-ip:{ip}       → { count, start } window
 *   opchain-try-email:{email} → { count } exchange usage
 *   opchain-leads:{email}     → { email, first_seen, source } lead record
 */

const K_IP = (ip) => `opchain-try-ip:${ip}`;
const K_EMAIL = (email) => `opchain-try-email:${email.toLowerCase()}`;
const K_LEAD = (email) => `opchain-leads:${email.toLowerCase()}`;

async function getJson(kv, key) {
  const raw = await kv.get(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function putJson(kv, key, value, options) {
  await kv.put(key, JSON.stringify(value), options);
}

// ── IP rate window ──────────────────────────────────────────────────────────

/**
 * Read the IP rate window. Returns `{ count, start }` or `{ count: 0, start: now }`
 * if the record is stale or absent.
 */
export async function readIpWindow(kv, ip, windowSec) {
  const now = Math.floor(Date.now() / 1000);
  const data = await getJson(kv, K_IP(ip));
  if (data && typeof data.start === "number" && now - data.start < windowSec) {
    return { count: Number(data.count) || 0, start: data.start };
  }
  return { count: 0, start: now };
}

export async function writeIpWindow(kv, ip, windowSec, window) {
  await putJson(kv, K_IP(ip), window, { expirationTtl: windowSec });
}

// ── Email exchange usage ────────────────────────────────────────────────────

export async function readEmailUsage(kv, email) {
  const data = await getJson(kv, K_EMAIL(email));
  return { count: (data && Number(data.count)) || 0 };
}

export async function writeEmailUsage(kv, email, ttlSec, usage) {
  await putJson(kv, K_EMAIL(email), usage, { expirationTtl: ttlSec });
}

// ── Lead record ─────────────────────────────────────────────────────────────

export async function readLead(kv, email) {
  return getJson(kv, K_LEAD(email));
}

export async function writeLeadIfNew(kv, email, source, ttlSec) {
  const existing = await readLead(kv, email);
  if (existing) return false;
  const record = {
    email: email.toLowerCase(),
    first_seen: new Date().toISOString(),
    source,
  };
  const options = ttlSec ? { expirationTtl: ttlSec } : undefined;
  await putJson(kv, K_LEAD(email), record, options);
  return true;
}

export const KEYS = { ip: K_IP, email: K_EMAIL, lead: K_LEAD };

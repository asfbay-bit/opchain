/**
 * Flag evaluation. Layered, fail-closed, per-request memoised.
 *
 * Order of precedence:
 *   1. Wrangler env override `FLAG_<UPPER_SNAKE>` — wins over PostHog. Useful
 *      for staging-only kill switches and for forcing a value in tests.
 *      Boolean flags accept "true" / "false" / "1" / "0".
 *   2. PostHog `/decide` value for this distinct_id.
 *   3. Registry default.
 *
 * The PostHog round-trip happens at most once per (request, distinct_id) and
 * is cached on `ctx.flagsCache`. Callers pass `ctx` from the Worker fetch
 * handler — the cache lives only as long as the request.
 */

import { FLAGS, getDefault, isKnown } from "./registry.js";
import { decide } from "./posthog.js";

const CACHE_KEY = Symbol.for("opchain.flags.cache");

function envOverride(env, name) {
  if (!env) return undefined;
  const key = "FLAG_" + name.replace(/[.-]/g, "_").toUpperCase();
  const raw = env[key];
  if (raw === undefined || raw === null || raw === "") return undefined;
  return raw;
}

function coerce(raw, type) {
  if (type === "boolean") {
    if (raw === true || raw === "true" || raw === "1") return true;
    if (raw === false || raw === "false" || raw === "0") return false;
    return undefined;
  }
  if (type === "number") {
    const n = Number(raw);
    return Number.isFinite(n) ? n : undefined;
  }
  return String(raw);
}

function getCache(ctx) {
  if (!ctx) return null;
  if (!ctx[CACHE_KEY]) ctx[CACHE_KEY] = { decided: null };
  return ctx[CACHE_KEY];
}

async function getDecidedMap(env, ctx, distinctId) {
  const cache = getCache(ctx);
  if (cache?.decided) return cache.decided;
  const promise = decide(env, distinctId).catch(() => ({}));
  if (cache) cache.decided = promise;
  return promise;
}

/**
 * Evaluate a single flag.
 *
 * @param {string} name
 * @param {{ env: object, ctx?: object, distinctId?: string }} input
 */
export async function evalFlag(name, { env, ctx, distinctId }) {
  if (!isKnown(name)) throw new Error(`unknown flag: ${name}`);
  const def = FLAGS[name];

  const override = envOverride(env, name);
  if (override !== undefined) {
    const coerced = coerce(override, def.type);
    if (coerced !== undefined) return coerced;
  }

  if (distinctId) {
    const decided = await getDecidedMap(env, ctx, distinctId);
    if (Object.prototype.hasOwnProperty.call(decided, name)) {
      const coerced = coerce(decided[name], def.type);
      if (coerced !== undefined) return coerced;
    }
  }

  return getDefault(name);
}

/**
 * Evaluate a batch of flags. Single PostHog round-trip across all of them.
 *
 * @param {string[]} names
 * @param {{ env: object, ctx?: object, distinctId?: string }} input
 * @returns {Promise<Record<string, boolean|string|number>>}
 */
export async function evalFlags(names, { env, ctx, distinctId }) {
  // Pre-warm the decide cache once so the per-name awaits are local.
  if (distinctId) await getDecidedMap(env, ctx, distinctId);
  const out = {};
  for (const n of names) {
    out[n] = await evalFlag(n, { env, ctx, distinctId });
  }
  return out;
}

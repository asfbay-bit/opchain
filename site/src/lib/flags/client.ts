// Client-side flag accessor. Two-layer: build-time defaults are read from
// the inline <meta name="opchain-flags"> tag injected by Base.astro; PostHog
// (loaded post-consent) overrides at runtime.
//
// No-ops gracefully when:
//   - the meta tag is missing (returns the hard-coded default from registry)
//   - PostHog hasn't loaded yet (consent declined or pre-accept)
//   - the flag name is unknown (returns null and console.warns once)

import { FLAGS, type FlagName, type FlagValue } from "./registry";

declare global {
  interface Window {
    posthog?: {
      isFeatureEnabled?(name: string): boolean | undefined;
      getFeatureFlag?(name: string): boolean | string | undefined;
      onFeatureFlags?(cb: () => void): void;
    };
  }
}

let metaCache: Record<string, FlagValue> | null = null;

function readMeta(): Record<string, FlagValue> {
  if (metaCache) return metaCache;
  if (typeof document === "undefined") return {};
  const tag = document.querySelector('meta[name="opchain-flags"]');
  const raw = tag?.getAttribute("content");
  if (!raw) {
    metaCache = {};
    return metaCache;
  }
  try {
    metaCache = JSON.parse(raw);
    return metaCache!;
  } catch {
    metaCache = {};
    return metaCache;
  }
}

function fromPostHog(name: FlagName): FlagValue | undefined {
  if (typeof window === "undefined") return undefined;
  const ph = window.posthog;
  if (!ph) return undefined;
  const def = FLAGS[name];
  try {
    if (def.type === "boolean") {
      const v = ph.isFeatureEnabled?.(name);
      return typeof v === "boolean" ? v : undefined;
    }
    const v = ph.getFeatureFlag?.(name);
    if (v === undefined) return undefined;
    if (def.type === "number") {
      const n = Number(v);
      return Number.isFinite(n) ? n : undefined;
    }
    return String(v);
  } catch {
    return undefined;
  }
}

export function getFlag<T extends FlagValue = FlagValue>(name: FlagName): T {
  const ph = fromPostHog(name);
  if (ph !== undefined) return ph as T;
  const meta = readMeta();
  if (Object.prototype.hasOwnProperty.call(meta, name)) return meta[name] as T;
  return FLAGS[name].default as T;
}

export function isEnabled(name: FlagName): boolean {
  return Boolean(getFlag(name));
}

/** Subscribe to PostHog's flag-loaded callback. Useful after consent flips. */
export function onFlagsReady(cb: () => void): void {
  if (typeof window === "undefined") return;
  const ph = window.posthog;
  if (!ph?.onFeatureFlags) {
    cb();
    return;
  }
  ph.onFeatureFlags(cb);
}

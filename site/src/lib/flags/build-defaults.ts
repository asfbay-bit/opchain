// Build-time flag defaults — used by SSG pages so the initial HTML always
// has a deterministic value. Client-side hydration via `client.ts` may
// override these once PostHog is loaded post-consent.

import { FLAGS, FLAG_NAMES, PUBLIC_FLAG_NAMES, type FlagName, type FlagValue } from "./registry";

export function defaultFor(name: FlagName): FlagValue {
  return FLAGS[name].default;
}

export function allDefaults(): Record<FlagName, FlagValue> {
  const out = {} as Record<FlagName, FlagValue>;
  for (const n of FLAG_NAMES) out[n] = FLAGS[n].default;
  return out;
}

export function publicDefaults(): Record<string, FlagValue> {
  const out: Record<string, FlagValue> = {};
  for (const n of PUBLIC_FLAG_NAMES) out[n] = FLAGS[n].default;
  return out;
}

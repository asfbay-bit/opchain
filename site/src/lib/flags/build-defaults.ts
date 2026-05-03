// Build-time flag defaults — used by SSG pages so the initial HTML always
// has a deterministic value. Client-side hydration via `client.ts` may
// override these once PostHog is loaded post-consent.

import { FLAGS, FLAG_NAMES, PUBLIC_FLAG_NAMES, isKnown, type FlagName, type FlagValue } from "./registry";

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

// Return false only if the capability flag exists AND defaults to false.
// Unknown names are treated as enabled — a missing registry entry means
// the gate doesn't exist yet, not that it's disabled.
export function isCapabilityEnabled(name: string): boolean {
  const flag = `skills.capability.${name}`;
  if (!isKnown(flag)) return true;
  return Boolean(FLAGS[flag as FlagName].default);
}

// Verb gate: pass either "/foo" or "foo". Subcommands (e.g. "/foo bar")
// inherit the parent verb's flag — strip everything after the first space.
export function isCommandEnabled(command: string): boolean {
  const verb = command.trim().split(/\s+/)[0].replace(/^\//, "");
  if (!verb) return true;
  const flag = `skills.command.${verb}.enabled`;
  if (!isKnown(flag)) return true;
  return Boolean(FLAGS[flag as FlagName].default);
}

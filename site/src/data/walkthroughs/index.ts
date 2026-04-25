import { conceptToShipped } from "./concept-to-shipped";
import { dashboardRescue } from "./dashboard-rescue";
import { legacyRevive } from "./legacy-revive";
import { postgresMigration } from "./postgres-migration";
import { securityHardening } from "./security-hardening";
import { stripeShip } from "./stripe-ship";
import type { Walkthrough } from "./types";

/** Stable display order — left-to-right on the scenario picker. */
export const walkthroughs: Walkthrough[] = [
  conceptToShipped,
  dashboardRescue,
  legacyRevive,
  stripeShip,
  postgresMigration,
  securityHardening,
];

export type { Walkthrough } from "./types";

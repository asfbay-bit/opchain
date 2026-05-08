import { conceptToShipped } from "./concept-to-shipped";
import { dashboardRescue } from "./dashboard-rescue";
import { djangoRenderShipped } from "./django-render-shipped";
import { legacyRevive } from "./legacy-revive";
import { mcpEnterpriseDefense } from "./mcp-enterprise-defense";
import { mcpEnterpriseF500 } from "./mcp-enterprise-f500";
import { pmPipelineLinear } from "./pm-pipeline-linear";
import { postgresMigration } from "./postgres-migration";
import { releaseOpsDogfood } from "./release-ops-dogfood";
import { runtimePmLoop } from "./runtime-pm-loop";
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
  mcpEnterpriseF500,
  mcpEnterpriseDefense,
  pmPipelineLinear,
  runtimePmLoop,
  releaseOpsDogfood,
  djangoRenderShipped,
];

export type { Walkthrough } from "./types";

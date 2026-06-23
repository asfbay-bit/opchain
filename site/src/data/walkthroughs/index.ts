import { agentTriage } from "./agent-triage";
import { aiSafetyGate } from "./ai-safety-gate";
import { conceptToShipped } from "./concept-to-shipped";
import { dashboardRescue } from "./dashboard-rescue";
import { djangoRenderShipped } from "./django-render-shipped";
import { legacyRevive } from "./legacy-revive";
import { modelMigration } from "./model-migration";
import { postgresMigration } from "./postgres-migration";
import { ragAnswerBot } from "./rag-answer-bot";
import { runtimePmLoop } from "./runtime-pm-loop";
import { securityHardening } from "./security-hardening";
import { stripeShip } from "./stripe-ship";
import type { Walkthrough } from "./types";

/** Stable display order — left-to-right on the scenario picker. */
export const walkthroughs: Walkthrough[] = [
  conceptToShipped,
  // v1.5 AI-native cluster — front-loaded to showcase the "build the AI app" release.
  ragAnswerBot,
  agentTriage,
  modelMigration,
  aiSafetyGate,
  dashboardRescue,
  legacyRevive,
  stripeShip,
  postgresMigration,
  securityHardening,
  runtimePmLoop,
  djangoRenderShipped,
];

export type { Walkthrough } from "./types";

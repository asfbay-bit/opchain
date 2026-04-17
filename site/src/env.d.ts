/// <reference types="astro/client" />

type KVNamespace = import("@cloudflare/workers-types").KVNamespace;

type Runtime = import("@astrojs/cloudflare").Runtime<{
  DATA: KVNamespace;
  LINEAR_API_KEY?: string;
  ANTHROPIC_API_KEY?: string;
  DEPLOY_API_TOKEN?: string;
  ANTHROPIC_MODEL?: string;
  LEAD_TTL_DAYS?: string;
  POSTHOG_PROJECT_API_KEY?: string;
  POSTHOG_HOST?: string;
}>;

declare namespace App {
  interface Locals extends Runtime {}
}

// @ts-check
import { defineConfig } from "astro/config";
import cloudflare from "@astrojs/cloudflare";

// Sprint 0 scaffold. Real integrations (Tailwind 4, MDX, content collections)
// land in Sprints 1-3. Keep this file small and additive.
export default defineConfig({
  site: "https://opchain.dev",
  output: "server",
  adapter: cloudflare({
    imageService: "compile",
    platformProxy: { enabled: true },
  }),
});

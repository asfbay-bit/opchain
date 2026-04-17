// @ts-check
import { defineConfig } from "astro/config";
import cloudflare from "@astrojs/cloudflare";
import tailwindcss from "@tailwindcss/vite";

// Sprint 2 — Tailwind 4 wired via Vite plugin. Design tokens live in
// site/src/styles/tokens.css and are exposed as Tailwind utilities by
// site/src/styles/global.css's @theme block.
export default defineConfig({
  site: "https://opchain.dev",
  output: "server",
  adapter: cloudflare({
    imageService: "compile",
    platformProxy: { enabled: true },
  }),
  vite: {
    plugins: [tailwindcss()],
  },
});

// @ts-check
import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";
import tailwindcss from "@tailwindcss/vite";

// Sprint 6 — the cutover. Static output; the Worker at src/index.js handles
// /api/* and serves the Astro build as static assets via the ASSETS binding.
// Keeping the build static means no cold-start latency on page views and
// lets Cloudflare cache everything at the edge.
export default defineConfig({
  site: "https://opchain.dev",
  output: "static",
  trailingSlash: "never",
  integrations: [sitemap()],
  vite: {
    plugins: [tailwindcss()],
  },
});

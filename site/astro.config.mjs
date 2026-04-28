// @ts-check
import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";
import tailwindcss from "@tailwindcss/vite";
import { rehypeTaskListLabels } from "./src/lib/rehype-task-list-labels.mjs";

// Sprint 6 — the cutover. Static output; the Worker at src/index.js handles
// /api/* and serves the Astro build as static assets via the ASSETS binding.
// Keeping the build static means no cold-start latency on page views and
// lets Cloudflare cache everything at the edge.
export default defineConfig({
  site: "https://opchain.dev",
  output: "static",
  trailingSlash: "never",
  integrations: [sitemap()],
  markdown: {
    // GFM task-list checkboxes (`- [ ] item`) render as bare disabled
    // <input type="checkbox"> elements; this plugin gives them an
    // aria-label so axe's `label` rule passes. See B-11 in
    // roadmap/05-post-sprint-7-backlog.md.
    rehypePlugins: [rehypeTaskListLabels],
  },
  vite: {
    plugins: [tailwindcss()],
  },
});

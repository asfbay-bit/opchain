// @ts-check
import { defineConfig } from "astro/config";
import cloudflare from "@astrojs/cloudflare";
import sitemap from "@astrojs/sitemap";
import tailwindcss from "@tailwindcss/vite";

// Sprint 3 — sitemap + Tailwind. Tokens live in site/src/styles/tokens.css.
export default defineConfig({
  site: "https://opchain.dev",
  output: "server",
  adapter: cloudflare({
    imageService: "compile",
    platformProxy: { enabled: true },
  }),
  integrations: [sitemap()],
  vite: {
    plugins: [tailwindcss()],
  },
});

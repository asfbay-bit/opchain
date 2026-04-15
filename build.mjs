import { build } from "esbuild";

await build({
  entryPoints: ["src/index.js"],
  bundle: true,
  outdir: "dist",
  format: "esm",
  target: "esnext",
  external: [],
  conditions: ["workerd", "worker", "browser"],
});

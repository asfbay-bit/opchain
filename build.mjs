import { build } from "esbuild";
import { execSync } from "node:child_process";

function getVersion() {
  // Prefer an explicit env var (e.g. set by CI to the commit SHA). Fall back to
  // reading git locally. Fall back to "dev" if neither is available.
  if (process.env.OPCHAIN_VERSION) return process.env.OPCHAIN_VERSION;
  try {
    return execSync("git rev-parse --short HEAD", { encoding: "utf8" }).trim();
  } catch {
    return "dev";
  }
}

const version = getVersion();
console.log(`building opchain-dev worker @ ${version}`);

await build({
  entryPoints: ["src/index.js"],
  bundle: true,
  outdir: "dist",
  format: "esm",
  target: "esnext",
  external: [],
  conditions: ["workerd", "worker", "browser"],
  define: {
    __OPCHAIN_VERSION__: JSON.stringify(version),
  },
});

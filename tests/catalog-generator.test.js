import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// Running the generator in a subprocess validates schema for *every* skill
// directory — not just the ones already baked into src/generated/. Without
// this, a skill that's on disk but broken (missing frontmatter, directory
// name ≠ `name`, etc.) only surfaces when someone runs `npm run build`.
// That's the class of failure that wedged the deploy pipeline when skills
// were uploaded via the GitHub web UI — no PR, no CI, and the build step
// finds out too late.

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const SCRIPT = join(ROOT, "scripts", "gen-skills-catalog.mjs");

describe("skill catalog generator", () => {
  it("parses every skills/<id>/SKILL.md without schema errors", () => {
    const result = spawnSync("node", [SCRIPT], {
      cwd: ROOT,
      encoding: "utf8",
    });
    const detail = `stdout:\n${result.stdout}\nstderr:\n${result.stderr}`;
    expect(result.status, `generator exited non-zero — ${detail}`).toBe(0);
  });
});

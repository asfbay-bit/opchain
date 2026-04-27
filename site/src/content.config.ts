// Astro 5 content collection — skill metadata read from skills/<id>/SKILL.md.
// Validates the frontmatter on every build; a missing or mistyped field fails
// `astro build` with a readable error.
//
// This collection is the *site's* source of truth. SKILL.md files are also
// what Claude Code reads on disk after install, so any new field here should
// be a no-op for the model (or behind a model-aware section of the file).

import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";

const PHASES = ["foundation", "plan", "build"] as const;

const skills = defineCollection({
  loader: glob({
    pattern: "*/SKILL.md",
    base: "../skills",
  }),
  schema: z.object({
    name: z.string(),
    displayName: z.string(),
    version: z.string().regex(/^\d+\.\d+\.\d+$/, "version must be semver (e.g. 1.0.0)"),
    shortDesc: z.string().min(1).max(120),
    phases: z.array(z.enum(PHASES)).nonempty(),
    triAgent: z.boolean(),
    // `tryable` was used by the now-removed Try-It chat. Kept on the schema
    // as `optional()` so existing SKILL.md frontmatter continues to validate;
    // the field is no longer surfaced anywhere on the site.
    tryable: z.boolean().optional(),
    commands: z.array(z.string()),
    description: z.string(),
  }),
});

export const collections = { skills };

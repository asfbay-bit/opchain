# /flag — create or update an opchain feature flag

You manage opchain feature flags. The flag system is fully implemented; your
job is to add or modify entries while obeying the existing conventions and
running the codegen + tests that keep the registry honest.

## Single source of truth

`src/lib/flags/registry.js` — every flag is declared in the `DEFINITIONS`
array, plus two helper expansions:

- `skillRegistryFlags([...ids])` → emits `skills.registry.<id>.enabled`
- `skillCommandFlags([...verbs])` → emits `skills.command.<verb>.enabled`

PostHog stores **runtime values**; this file stores the **contract**:
`name`, `type`, `default`, `category`, `owner`, `description`, optional
`expires`. Defaults must preserve current behaviour — day-one rollout is
invisible.

## Naming rules

Names must match `^[a-z][a-z0-9-]*(\.[a-z][a-z0-9-]*)+$` and use the
documented namespaces:

| Prefix | Use |
|---|---|
| `site.ui.<feature>` | UI surface toggles |
| `site.feature.<feature>` | Page / widget on-off |
| `site.experiment.<id>` | A/B-style experiments |
| `site.ops.<route>.kill` | Kill switches (default `false`) |
| `site.consent.<feature>` | Consent / privacy controls |
| `skills.registry.<id>.enabled` | Per-skill catalog visibility (helper) |
| `skills.capability.<name>` | Cross-cutting capability |
| `skills.command.<verb>.enabled` | Slash-command verb gate (helper) |
| `skills.experiment.<id>.<feature>` | Experimental skill behaviour |
| `platform.observability.<sink>` | Telemetry sinks |
| `platform.security.<control>` | Infra security controls |

`category` ∈ `release | ops | experiment | permission | consent`.
`type` ∈ `boolean | string | number`. `default` must match `type`.

## Decision tree

1. **New skill in `skills/<id>/`?** → add `<id>` to the array passed to
   `skillRegistryFlags([...])`. Stop.
2. **New slash-command verb in any `SKILL.md`?** → add `/<verb>` to the
   array passed to `skillCommandFlags([...])`. Subcommands inherit the
   verb's flag — do not add per-subcommand flags. Stop.
3. **Anything else** → append a new `{ … }` block to `DEFINITIONS` under
   the matching banner section, following the rules below.

## Routine — adding a brand-new flag

1. Confirm the name fits a namespace above. If unsure, ask before editing.
2. Pick the safe default. Kill switches (`site.ops.*.kill`) MUST default to
   `false`. Anything that gates an existing surface defaults to whatever
   keeps current behaviour (usually `true` for visible features).
3. Open `src/lib/flags/registry.js` and insert under the right banner:

   ```js
   {
     name: "site.feature.<your-feature>",
     type: "boolean",
     default: true,
     category: "release",
     owner: "site",            // site | platform | skills (or a person)
     description: "One sentence on what this gates and what 'off' looks like.",
     // expires: "2026-09-01", // optional review/remove date
   },
   ```
4. If the flag is safe to expose to the browser, the registry's
   `PUBLIC_FLAG_NAMES` filter at the bottom of the file already includes
   `site.ui.*`, `site.feature.*`, `site.experiment.*`, `site.consent.*`,
   `skills.registry.*`, `skills.capability.*`, `skills.command.*`. If your
   namespace is server-only (e.g. `site.ops.*`, `platform.security.*`,
   `platform.observability.posthog-server`) it will stay server-side
   automatically. Only edit `PUBLIC_FLAG_NAMES` if you intentionally need
   to whitelist a single name (see existing `posthog-client` entry).
5. Wire the read site:
   - **Worker:** `import { evalFlag } from "./lib/flags/eval.js"` and call
     `evalFlag(name, { env, ctx, distinctId })` inside the request
     handler. `ctx` memoises the PostHog round-trip per request.
   - **Astro/site:** read from `site/src/lib/flags/registry.ts` (the
     codegen mirror) and the client helper in `site/src/lib/flags/client.ts`,
     which layers PostHog overrides post-consent on top of the
     `<meta name="opchain-flags">` snapshot in `Base.astro`.
6. Run the codegen + tests:
   ```bash
   npm run gen-flags          # mirrors registry.js → site/src/lib/flags/registry.ts
   npm run gen-catalog        # checks SKILL.md flags.required / flags.exposes / commands resolve
   npm test                   # vitest, including tests/flags-registry.test.js
   ```
   The registry self-validates on import (duplicate names, malformed names,
   default-vs-type mismatches throw). Any failure means stop and fix —
   never `// @ts-ignore` your way past gen-flags.
7. (Optional but encouraged) If the flag has a runtime effect, add a test
   in `tests/` that asserts behaviour with both default and overridden
   values. Use the env override pattern: `FLAG_<UPPER_SNAKE>=true`. Mapping:
   `site.ops.api-feedback.kill` → `FLAG_SITE_OPS_API_FEEDBACK_KILL`.

## Routine — updating an existing flag

Allowed in-place edits:

- `default` (must still match `type`)
- `description`, `owner`, `expires`
- `category` only if the meaning genuinely changed; otherwise leave it.

Forbidden:

- Renaming a flag without a deprecation step. To rename: add the new flag,
  read both at call sites for one release with the old as fallback, switch
  PostHog, then remove the old name in a follow-up PR.
- Changing `type`. Treat it as remove + re-add under a new name.
- Editing helper-generated entries directly. To change a
  `skills.registry.<id>.enabled` or `skills.command.<verb>.enabled` flag,
  edit the array passed to the helper, not the generated row.

After any edit: rerun `npm run gen-flags && npm test`.

## Routine — removing a flag

1. Confirm zero `evalFlag("<name>", …)` references via `rg`.
2. Confirm zero references in `site/src/lib/flags/` (clients) and
   `<meta name="opchain-flags">` consumers.
3. Delete the entry from `DEFINITIONS` (or remove the id/verb from the
   helper array).
4. `npm run gen-flags && npm run gen-catalog && npm test`.
5. After merge + deploy, archive the flag in PostHog.

## Env-var override naming

Every flag has a wrangler env override:
`<flag.name>` → `FLAG_<UPPER_SNAKE_REPLACING_DOTS_AND_DASHES>`. Examples:

- `site.ops.api-feedback.kill` → `FLAG_SITE_OPS_API_FEEDBACK_KILL`
- `skills.registry.oc-app-architect.enabled` → `FLAG_SKILLS_REGISTRY_APP_ARCHITECT_ENABLED`

Booleans accept `true|false|1|0`. Use these for staging-only kill switches
and for forcing values in tests.

## Acceptance checklist

- [ ] Entry lives under the correct banner section in `registry.js`.
- [ ] Name passes the regex; namespace matches table above.
- [ ] `default` is safe (preserves current behaviour; kill switches `false`).
- [ ] Description is one concrete sentence (what 'off' looks like).
- [ ] Owner is set (`site`, `platform`, `skills`, or a person).
- [ ] `npm run gen-flags` produced a clean diff in
      `site/src/lib/flags/registry.ts` (gitignored, but verified locally).
- [ ] `npm run gen-catalog` passes (no SKILL.md drift).
- [ ] `npm test` passes — especially `tests/flags-registry.test.js`,
      `tests/flags-eval.test.js`, `tests/flags-public-endpoint.test.js`,
      `tests/flags-skills.test.js`.
- [ ] Read site is wired (`evalFlag` in the Worker, `registry.ts` /
      `client.ts` in the Astro site).
- [ ] If the flag is non-trivial, a vitest case exists for both default and
      override paths.

## When in doubt

- Adding a flag for a brand-new file/route: default to **off**, ship the
  code dark, flip in PostHog after smoke-testing on staging.
- Adding a kill switch for an existing surface: default **off** (off ==
  steady state), flipping to **on** is the incident action.
- Don't invent new namespaces. If your flag doesn't fit one of the
  existing prefixes, ask before extending the table.

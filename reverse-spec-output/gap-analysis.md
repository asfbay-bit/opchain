# Gap Analysis — opchain.dev

Prioritized list of everything that's missing, risky, or ambiguous.

## Severity key

- **HIGH** — production risk, security, or high-probability user-visible breakage.
- **MED** — correctness, maintainability, or growth blocker.
- **LOW** — polish, hygiene, nice-to-have.

---

## HIGH

### H1. Hardcoded fallback HMAC secret
**File:** `src/opchain-try.js` L285, L306
**Problem:** If `DEPLOY_API_TOKEN` is unset in prod, session tokens are signed with the literal string `'opchain-dev-secret'`. Anyone could forge tokens.
**Fix:** Remove the fallback; throw a 500 at request time if unset. Add a startup sanity check or a `wrangler.jsonc` required secret assertion.

### H2. No CI, no automated tests
**Problem:** A broken Worker will merge to `main` and deploy to prod with zero guardrails. `npm run deploy` is the only gate.
**Fix:** GitHub Actions workflow running `npm run build`, plus a minimal `vitest` unit suite (see `spec/06-testing.md`). Block `main` merge on green.

### H3. Single environment (no staging, no preview)
**Problem:** Every change goes live. No dress-rehearsal surface for Linear or Anthropic integration changes.
**Fix:** Add a `staging` env to `wrangler.jsonc` with its own worker name (`opchain-staging`) and its own KV preview namespace.

### H4. No input validation on Worker handlers
**Problem:** `handleFeedback`, `handleStart`, `handleChat` trust `body.*` shapes. Malformed payloads may crash handlers or be forwarded to Linear/Anthropic.
**Fix:** Schema validation per endpoint (Zod/Valibot, or hand-rolled shape guards).

---

## MED

### M1. KV production namespace bound in `wrangler dev`
**File:** `wrangler.jsonc` L18–L23
**Problem:** No `preview_id` set; `wrangler dev` reads/writes prod KV by default. Risk of lead-table pollution during local testing.
**Fix:** Add a `preview_id` for `DATA`.

### M2. Catalog drift between `public/skills.js`, `src/opchain-try.js`, and `public/tryit.js`
**Problem:** Three separate sources of truth for the skill list. Adding a skill requires edits in three files; missing one causes silent drift.
**Fix:** Generate `public/skills.js` and the Try-It `STARTERS`/`INTROS`/`SKILL_PROMPTS` from `skills/*/SKILL.md` frontmatter. Wire into `prebuild`.

### M3. `architecture.html` and `install.html` are stubs
**Problem:** Top-level nav advertises sections that are a single paragraph. First-time visitors click through and find nothing useful.
**Fix:** Expand with the content this reverse-spec produced (architecture diagram, install-for-claude-code steps, install-for-claude-desktop steps).

### M4. XSS surface through `renderMarkdown`
**File:** `public/tryit.js` L411–L470
**Problem:** Bespoke regex-based renderer. Current code escapes HTML first, but fragile across future changes. LLM output is the input.
**Fix:** Replace with a vetted renderer (e.g. `marked` + `DOMPurify`) or add a minimal sanitization pass as a safety net.

### M5. No CSP / frame-ancestors / Referrer-Policy / Permissions-Policy
**File:** `src/index.js` L73–L78
**Problem:** Two of the cheap, high-value security headers are set, but the rest are missing.
**Fix:** Add a single `Content-Security-Policy` tailored to the current asset set.

### M6. Lead data has no TTL
**File:** `src/opchain-try.js` L277–L281
**Problem:** Email addresses persist forever. Privacy/compliance risk.
**Fix:** Set a TTL (e.g. 1 year) or document a retention policy.

### M7. Linear team/project/label IDs hardcoded
**File:** `src/index.js` L16–L24
**Problem:** Moving to a staging Linear workspace is a code change.
**Fix:** Env vars (`LINEAR_TEAM_ID`, `LINEAR_PROJECT_ID`, and a JSON label map).

### M8. Anthropic model is hardcoded
**File:** `src/opchain-try.js` L8
**Problem:** Upgrading to a newer Haiku/Opus requires a code change.
**Fix:** Env var override, e.g. `ANTHROPIC_MODEL` defaulted to `claude-haiku-4-5-20251001`.

### M9. Stub "API types" contract
See `stack-forge-audit.md`.

### M10. No per-skill versioning
**Problem:** Skills are consumed via `SKILL.md` copy-paste. A breaking change to e.g. the checkpoint JSON shape is immediately live for all consumers.
**Fix:** Add a `version:` field in each skill's YAML frontmatter. Bump on breaking changes. Publish a CHANGELOG.

---

## LOW

### L1. No `.env.example`
**Fix:** Add one; reference in `CLAUDE.md`.

### L2. No focus-visible ring on buttons and pills
**Fix:** A single `:focus-visible` rule in `styles.css`.

### L3. Error color `#e85c5c` not tokenized
**Fix:** Add `--danger` to `:root`.

### L4. No retry on Linear and Anthropic calls
**Fix:** Single retry with 500ms backoff for 5xx.

### L5. No request-id / User-Agent on outbound calls
**Fix:** Set `User-Agent: opchain-dev/<short-sha>` and log any upstream request-ids (e.g. `anthropic-request-id`).

### L6. `observability.enabled` is on but logs are unstructured
**Fix:** `console.log(JSON.stringify({ event, data }))` for key events (feedback submitted, chat started, chat completed, rate-limited).

### L7. No visible version identifier on the site or `/api/health`
**Fix:** Inject a git SHA at build time; surface in the health response.

### L8. No `robots.txt` / `sitemap.xml` / OpenGraph meta
**Fix:** Add OG meta to each page for social sharing; add `robots.txt` + `sitemap.xml`.

### L9. `browsers` not narrowed for esbuild
**File:** `build.mjs`
**Problem:** `target: esnext` is fine for workerd; no front-end bundling happens.
**Fix:** Nothing needed; call out that front-end JS is hand-compatible with modern browsers only.

### L10. `wrangler.jsonc` `$schema` relies on a local `node_modules` path
**File:** `wrangler.jsonc` L2
**Problem:** Works when `node_modules` is present; meaningless once the file is viewed elsewhere.
**Fix:** Use the public schema URL, e.g. `https://unpkg.com/wrangler/config-schema.json` (verify current path).

---

## Cross-cutting

- **Documentation**: this reverse-spec output is richer than any doc currently in the repo, including the "Architecture" page. Once reviewed for accuracy, the diagrams and tables here should feed `public/architecture.html` and `public/install.html`.
- **Tri-dev retirement**: `orchestrator.md` notes tri-dev is retired and now lives inside `app-architect` Phase 6. Worth a one-liner on the Architecture page so visitors don't expect a standalone tri-dev skill.

# Stack-Forge Audit — Typed Pipeline

Stack-forge's typed pipeline audit checks the chain:

```
DB Schema → ORM/Migrations → API Types → OpenAPI Spec → Generated TS Types → Frontend Types → CI Enforcement
```

opchain has no DB, but the Worker still has an API surface and a frontend that calls
it — the "typed pipeline" still applies. Here's where each link sits.

| Pipeline Link | Status | Evidence | Gap / Action |
|---|---|---|---|
| DB Schema | ⏭️ N/A | No database (KV only) | None — design choice. |
| KV schema | ⚠️ Implicit | 3 KV key patterns in `src/opchain-try.js` L201–L239, L270–L282 | Add a `src/kv.js` module exporting typed getters/setters so key formats and value shapes are defined once. |
| ORM types | ⏭️ N/A | N/A | — |
| API input validation | ❌ Missing | `handleFeedback` spot-checks `type` + `title` only; `handleStart` only checks email regex; `handleChat` checks `skill` in list + `messages` is array | Add a lightweight validator (Zod, Valibot, or hand-rolled shape checks) per endpoint. Current code happily accepts `null` priority, extra fields, etc. |
| API output types | ❌ Missing | Handlers return `JSON.stringify(plainObject)` with no typed shape | Define response type objects (even as JSDoc) to pin the contract. |
| OpenAPI spec | ❌ Missing | No `openapi.json`, no route generation | **High priority for pipeline readiness.** The Worker has only 5 endpoints; OpenAPI would take an hour. It's the missing piece for downstream codegen. |
| Generated TS types | ❌ Missing | No `.ts` files, no codegen script | Blocked on OpenAPI. |
| Frontend types | ❌ Missing (no types) | `public/tryit.js` reads `data.session_token`, `data.remaining`, `event.text`, `event.done`, `event.remaining`, `event.error` with no typed contract | Once OpenAPI/types exist, swap hand-written fetch wrappers for generated clients. |
| CI type-check step | ❌ Missing | No `.github/workflows`, no `tsc` | Blocked on introducing TypeScript (or at least `// @ts-check` JSDoc). |
| CI schema-drift check | ❌ Missing | No script verifies that `public/skills.js` matches `skills/*/SKILL.md` | Easy win: a `scripts/verify-catalog.sh` comparing the catalog to the filesystem, wired into `prebuild`. |
| Runtime client validation | ❌ Missing | Client `tryit.js` trusts SSE payloads and Gate API responses | Wrap responses in a schema check or at least narrow JSON shape guards. |

## Priority ordering

1. **Validator for API inputs** — prevents malformed POSTs from reaching the handlers.
   No new dependency needed; a 40-line hand-rolled validator covers it.
2. **`scripts/verify-catalog.sh`** — guarantees `public/skills.js` and
   `src/opchain-try.js`'s `SKILL_PROMPTS` stay in sync with `skills/*/SKILL.md`.
   Can be added today; small and valuable.
3. **OpenAPI spec** — even a hand-written `openapi.json` unlocks the whole downstream
   story (typed client, Postman collection, docs page).
4. **`// @ts-check` + JSDoc types** — a no-build-step way to add type safety to the
   Worker.
5. **Full TypeScript** — only if the Worker grows past its current size.

## Summary

- Half of the pipeline links are **N/A** because this app is small and stateless.
- The links that DO apply are mostly **missing**. The codebase is typed only by
  convention.
- The risk this creates is proportional to pace of change: with low change frequency,
  the implicit contracts hold. With rapid iteration, drift will bite.

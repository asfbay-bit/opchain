# 06 — Testing

## Current State

**There are no automated tests in this repository.** This is an explicit, high-confidence finding.

Evidence:

- No `test`, `tests`, `__tests__`, or `spec/` directory (spec in this repo refers to this reverse-spec output, not test specs).
- No test runner in `package.json` (`vitest`, `jest`, `mocha`, `ava`, `playwright`, `cypress` all absent).
- No `test` or `lint` script in `package.json` (`package.json` L6–L14).
- No CI workflow directory (`.github/workflows/` does not exist).
- No config files for any test framework (no `vitest.config.*`, `jest.config.*`, `playwright.config.*`).
- No `tsconfig.json` (so no type-check step either).

### Manual testing surface

Two `curl`-able endpoints support smoke tests, but there is no script that runs them:

```bash
# Health check
curl https://opchain.dev/api/health
# → { "ok": true, "service": "opchain-dev" }

# Download skills bundle
curl -I https://opchain.dev/opchain-skills.zip
# → Content-Disposition: attachment; filename="opchain-skills.zip"
```

### What *would* be testable right now

| Surface | Test type | Difficulty |
|---|---|---|
| `isValidEmail` (`src/opchain-try.js` L149) | unit | trivial (pure function) |
| `createSessionToken` / `verifySessionToken` | unit | easy (pure + WebCrypto) |
| `checkIPRate` / `getEmailUsage` | unit | easy with KV mock |
| `handleFeedback` 400/503/500 branches | unit with fetch mock | easy |
| `handleStart` full flow | integration (Miniflare) | moderate |
| `handleChat` streaming | integration + SSE parsing | hard |
| Skill card filter logic (`skills-app.js`) | unit (DOM) | easy |
| `renderMarkdown` in `tryit.js` | unit (DOM) | moderate (many regex branches) |

### Confidence

| Claim | Confidence |
|---|---|
| Zero automated tests | HIGH |
| No CI enforcement | HIGH |
| No type-check step | HIGH — no `tsc` anywhere |

## Gaps & Recommendations

This is the single largest quality gap in the codebase.

**Minimum viable test setup:**

1. **Unit tests** with `vitest` (edge-runtime-compatible, fast, zero-config for ESM):
   - `isValidEmail` positive + negative cases.
   - HMAC round-trip: sign → verify returns email.
   - HMAC tamper: mutate middle → verify returns null.
   - Label/priority maps: unknown `type` returns empty labels, unknown priority → 0.
   - Markdown renderer: fixed inputs produce expected HTML, no XSS regression cases.

2. **Integration tests** with Miniflare or `unstable_dev`:
   - `GET /api/health` returns 200.
   - `POST /api/feedback` with missing fields returns 400.
   - `POST /api/try/start` happy path, IP limit, email-exhausted paths.
   - Static asset passthrough (`GET /index.html` returns HTML).

3. **Smoke tests** post-deploy:
   - Hit `/api/health` on the deployed worker.
   - Fetch `/` and confirm HTML contains expected strings ("opchain", nav links).
   - Fetch `/opchain-skills.zip` and confirm Content-Disposition header.

4. **Sync validation** (runs as part of `prebuild`):
   - Assert every skill in `skills/` has a matching entry in `public/skills.js` and vice versa.
   - Assert every `SKILL_PROMPTS` key in `src/opchain-try.js` has a matching `STARTERS` + `INTROS` entry in `public/tryit.js`.

5. **CI:**
   - GitHub Actions workflow running `npm ci && npm run build && npm test` on every PR.
   - Cloudflare Pages preview deployments per PR for visual QA.

**Testing the skills themselves** is a deeper, separate problem (skills are prompts, not code). For the site, the above is the baseline.

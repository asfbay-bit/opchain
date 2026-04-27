# 04 — Integrations

_Refreshed 2026-04-28 by `/reverse-spec` targeted update. Replaces the
2026-04-17 version, which still listed the Anthropic Messages API as a
core integration. The Try-It chat (and its Anthropic surface) was
removed in `claude/remove-try-it`._

## Current State

The Worker integrates with **two** external services. PostHog is
fire-and-forget; Linear is the only blocking outbound call. No
webhooks, no OAuth, no inbound integrations.

### 1. Linear (feedback → issue creation)

| Aspect | Value |
|---|---|
| Endpoint | `https://api.linear.app/graphql` |
| Method | `POST` |
| Auth | `Authorization: {LINEAR_API_KEY}` (raw key, no `Bearer` prefix — Linear convention) |
| Mutation | `issueCreate(input: IssueCreateInput!)` returning `{ success, issue { id, identifier, url } }` |
| Team / project | `LINEAR_TEAM_ID` / `LINEAR_PROJECT_ID` env vars; defaults baked in (`src/index.js` L25–L26) |
| Label map | 4 labels (`bug`, `feature`, `improvement`, `general`), each pinned to a Linear UUID (`LABEL_MAP`, L28–L33) |
| Priority map | `0 → 0`, `1 → 4`, `2 → 3`, `3 → 2`, `4 → 1` (opchain priority → Linear priority, `PRIORITY_MAP`, L35) |
| Description enrichment | If `skill` field present, appends `**Skill:** <slug>` to the body. `email`, `requestId`, and "_Submitted via opchain.dev_" are also appended |
| Response | `201 { ok, id, url }` on success; `503 not_configured` if `LINEAR_API_KEY` unset; `502 upstream_unreachable` on fetch error; `500 upstream_error` on Linear error response |
| Retries | None |
| Outbound headers | `Content-Type: application/json`, `Authorization: <key>`. No `User-Agent`, no `X-Request-Id` correlation |

Source: `src/index.js` L22–L54, L157–L247.

### 2. PostHog (analytics — server-side capture)

| Aspect | Value |
|---|---|
| Endpoint | `${POSTHOG_HOST}/capture/` (default `https://eu.i.posthog.com`) |
| Method | `POST` |
| Auth | `api_key` field in JSON body (`POSTHOG_PROJECT_API_KEY`) |
| Events emitted | `feedback_submitted` (when `email` provided), `notify_submitted`, `zip_downloaded` |
| `distinct_id` | `sha256(lower(email))` (lead context) or `sha256(\`ip:${ip}\`)` (anonymous downloads) — keeps users pseudonymous in PostHog |
| Properties | Always include `$lib: "opchain-worker"` plus event-specific fields (e.g. `request_id`, `source`, `path`, `priority`) |
| Failure mode | Fire-and-forget via `ctx.waitUntil`. Non-2xx responses drain and discard the body. All exceptions swallowed — analytics never breaks a user flow |
| Disabled mode | If `POSTHOG_PROJECT_API_KEY` unset, `capture()` returns immediately without making a request |

Source: `src/lib/analytics.js` (full file).

### Client-side PostHog (consent-gated)

The Astro site loads the PostHog browser SDK only after the user
accepts the consent banner. Build-time env: `PUBLIC_POSTHOG_KEY`,
`PUBLIC_POSTHOG_HOST`. If `PUBLIC_POSTHOG_KEY` is empty (e.g. LHCI
build, where third-party network noise would drag scores), the consent
banner still renders but the accept button is a no-op.

Source: `site/src/components/ConsentBanner.astro`,
`site/src/lib/analytics.ts`.

### Data flow

```
/api/feedback (POST JSON, Zod-validated)
   ↓
   Linear GraphQL mutation
   ↓
   201 { ok, id (LINEAR-123), url }
   ↓ (waitUntil, only if email provided)
   PostHog capture(feedback_submitted)

/api/notify (POST JSON, Zod-validated)
   ↓
   Per-IP rate-limit check (KV NOTIFY)
   ↓
   Lead capture (KV NOTIFY, lead:sha256(email))
   ↓
   200 { ok: true }
   ↓ (waitUntil)
   PostHog capture(notify_submitted)

GET *.zip (Workers Assets passthrough)
   ↓
   Add Content-Disposition + Cache-Control
   ↓
   200 binary
   ↓ (waitUntil, only on 2xx)
   PostHog capture(zip_downloaded)
```

### Confidence

| Claim | Confidence |
|---|---|
| Only two external integrations (Linear, PostHog) | HIGH — exhaustive scan, no other `fetch(` to a third-party domain |
| No retries on Linear | HIGH — direct observation, single try/catch |
| No outbound webhooks | HIGH — no HMAC signing for outbound, no `handleWebhook` |
| Anthropic surface fully removed | HIGH — `git grep -i anthropic` returns only docs/comments |
| PostHog is fire-and-forget and never blocks | HIGH — every call is wrapped in `ctx.waitUntil` and a try/catch that returns void |
| Consent gate is a hard prerequisite for client-side PostHog | HIGH — banner-blocked init, no PostHog `<script>` until accept |

## Gaps & Recommendations

- **No retry on Linear.** A single transient 5xx drops feedback. Add
  one retry with ~500ms backoff on 5xx; document why we don't retry
  4xx (validation failures shouldn't loop). Tracked in
  `gap-analysis.md` M5.
- **No `User-Agent` on outbound calls.** Linear's request log shows
  generic `cloudflare-workers/<version>`. Setting
  `User-Agent: opchain-dev/<__OPCHAIN_VERSION__>` would let us trace
  errors back to a specific deploy without ambiguity.
- **No upstream-id correlation.** Neither Linear's nor PostHog's
  response headers are forwarded into our structured logs. For Linear
  in particular, capturing the response request-id on a 4xx/5xx would
  let us cross-reference with Linear support without re-running the
  request. Tracked in `gap-analysis.md` M5.
- **Hardcoded fallback team / project IDs.** `DEFAULT_TEAM_ID` and
  `DEFAULT_PROJECT_ID` are baked into `src/index.js`. The env vars
  override them, but a forked deploy that forgets to set them will
  silently post into the canonical opchain Linear project. Tracked in
  `gap-analysis.md` L3 (consider failing-closed instead).
- **PostHog event taxonomy is small but inconsistent in shape.**
  `notify_submitted` carries `team_size` (snake-case) while
  `feedback_submitted` carries `priority` (numeric). Useful to
  formalize the shape per event in `src/lib/analytics.js` (or move to
  `src/lib/events.ts`) so dashboards don't have to special-case.

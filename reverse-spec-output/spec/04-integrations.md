# 04 — Integrations

## Current State

The Worker integrates with **two** external services. No webhooks, no OAuth, no
inbound integrations.

### 1. Linear (feedback → issue creation)

| Aspect | Value |
|---|---|
| Endpoint | `https://api.linear.app/graphql` |
| Method | `POST` |
| Auth | `Authorization: {LINEAR_API_KEY}` (raw API key, no `Bearer` prefix — Linear convention) |
| Mutation | `issueCreate(input: IssueCreateInput!)` returning `{ success, issue { id, identifier, url } }` |
| Fixed config | `TEAM_ID = "7548a4f9-6ed3-42a6-9130-3b2b45db3c5c"`, `PROJECT_ID = "7a8ea196-9a52-4efb-b997-003cb48a3f1a"` |
| Label map | 4 labels: `bug`, `feature`, `improvement`, `general` (each with a fixed Linear label UUID) |
| Priority map | `0 → 0`, `1 → 4`, `2 → 3`, `3 → 2`, `4 → 1` (opchain priority → Linear priority) |
| Response | 201 `{ ok, id, url }` on success, 500 `{ error }` on Linear failure |
| Skill enrichment | If `skill` field present, maps slug → display name via `SKILL_NAMES` and appends `**Skill:** X` to the Linear issue description |

Source: `src/index.js` L16–L56, L95–L167.

### 2. Anthropic Messages API (Try It chat)

| Aspect | Value |
|---|---|
| Endpoint | `https://api.anthropic.com/v1/messages` |
| Method | `POST` (streaming) |
| Auth | `x-api-key: {ANTHROPIC_API_KEY}` |
| API version | `anthropic-version: 2023-06-01` |
| Model | `claude-haiku-4-5-20251001` (constant `MODEL`) |
| `max_tokens` | 2048 |
| `system` | Skill-specific system prompt from `SKILL_PROMPTS` |
| `messages` | Cleaned (role + content only), trimmed to last 10, 4000 char cap per message |
| Streaming | Yes (`stream: true`), SSE parsed line by line |
| Client protocol | Server re-emits simplified SSE: `{text: "..."}` per delta, `{done: true, remaining: N}` on stop |
| Error mapping | 429 Anthropic → 503 `"AI service is busy"`; other non-OK → 502 `"AI service error"` |

Source: `src/opchain-try.js` L8, L17–L136, L353–L445.

### System prompts per skill

9 of the 10 opchain skills have a demo system prompt. Each prompt:

1. Names the skill (bolded).
2. Caps the demo at 5 exchanges (`MAX_EXCHANGES`).
3. Specifies first-turn behavior (discovery questions).
4. Specifies subsequent-turn behavior (the deliverable — mini-spec, stack
   recommendation, audit report, etc.).
5. Requests markdown output.

The one skill **not** in Try It: `checkpoint-protocol` (it's a substrate, not a standalone interaction).

Source: `src/opchain-try.js` L17–L136, `public/tryit.js` L6–L54 (matching starter prompts).

### Data flow

```
/api/feedback (POST JSON)
  ↓
  Linear GraphQL mutation
  ↓
  Response: { ok, id (LINEAR-123), url }

/api/try/start (POST email)
  ↓
  IP rate check (KV)
  ↓
  Email usage check (KV)
  ↓
  Lead capture (KV, first seen only)
  ↓
  HMAC-signed token returned

/api/try/chat (POST skill+messages+token)
  ↓
  Verify HMAC on token → email
  ↓
  Email usage check (KV)
  ↓
  Increment usage (KV)
  ↓
  Anthropic /v1/messages (stream=true)
  ↓
  SSE translation → client
```

### Confidence

| Claim | Confidence |
|---|---|
| Only 2 external integrations | HIGH — exhaustive file scan |
| Linear team/project IDs are the canonical ones for this team | MEDIUM — UUIDs exist but not documented; assume correct |
| `claude-haiku-4-5-20251001` is the chosen model | HIGH — constant, pinned |
| No retries on either integration | HIGH — direct observation |
| No outbound webhooks | HIGH — no HMAC signing for outbound, no `handleWebhook` |

## Gaps & Recommendations

- **No retry policy.** Both Linear and Anthropic calls fail fast. For the marketing
  feedback endpoint, a single retry with backoff would reduce lost feedback on
  transient failures.
- **No circuit breaker / degraded mode** for the Try It chat. If Anthropic is down,
  every call 502s. Consider caching a "service degraded" flag in KV for short-term
  fast-fail.
- **Hardcoded `TEAM_ID` and `PROJECT_ID`.** Moving these to env vars would let staging
  or test deploys write to a separate Linear project without code changes.
- **No observability on Linear success rate.** `observability.enabled = true` in
  `wrangler.jsonc` gives request-level logs, but no structured events for feedback
  submission outcomes.
- **Try It prompts duplicated across files.** The list of demoable skills lives in
  `src/opchain-try.js` (`SKILL_PROMPTS` keys), `public/tryit.js` (`STARTERS` and
  `INTROS` keys), and `public/skills.js`. Any new skill requires three edits.
- **No Anthropic model migration path.** Hardcoding `claude-haiku-4-5-20251001`
  means every model upgrade is a code change. Consider an env var override.
- **No request-id propagation.** Neither integration call sets `User-Agent` or
  `X-Request-Id`, making debugging harder from the Linear/Anthropic side.

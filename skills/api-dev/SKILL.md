---
name: api-dev
displayName: API Developer
version: 1.0.0
shortDesc: First-party API design, OpenAPI, versioning, SDKs.
phases: [plan, build]
triAgent: true
tryable: true
commands:
  - /api
  - /api design
  - /api spec
  - /api scaffold
  - /api lint
  - /api test
  - /api version
  - /api deprecate
  - /api sdk
  - /api docs
description: >
  First-party API design and build harness with Designer/Builder/Conformance loop.
  Owns OpenAPI/GraphQL authoring, schema↔code parity, versioning + sunset strategy,
  pagination/error/idempotency conventions, typed handler scaffolding, and SDK
  generation for the API your own clients consume. Use for /api, /api design,
  /api spec, /api scaffold, /api version, /api lint, /api sdk, "design our API",
  "OpenAPI", "GraphQL schema", "versioning strategy", "deprecate endpoint",
  "generate SDK", "schema drift". For consuming someone else's API (Stripe, Slack,
  OAuth) use integrations-engineer instead. Trigger liberally.
---

# API Developer

**On first invocation, read `references/orchestrator.md` and follow its welcome protocol.**

Tri-agent first-party API harness: Designer authors the contract (OpenAPI / GraphQL
schema) → Builder scaffolds typed handlers, validation, and an SDK against it →
Conformance hits the running server, validates responses against the spec, and
diffs the new spec against the previously-shipped one to flag undeclared breaking
changes.

This is the producer-side counterpart to `integrations-engineer`. If you're
consuming someone else's API (Stripe, Slack, Salesforce, OAuth providers), use
`integrations-engineer`. If you're designing/building the API your own clients,
customers, or partners consume, use this skill.

---

## /api — Command Reference

```
API DEVELOPER COMMANDS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  TRI-AGENT HARNESS
  /api design         Author the API contract (Designer agent)
  /api build          Scaffold + conformance loop (Builder → Conformance)
  /api test           Run Conformance against an existing server

  AUTHOR
  /api spec           Generate / update OpenAPI or GraphQL schema from data model
  /api scaffold       Generate typed handlers + validation middleware from spec
  /api lint           Run spectral / redocly lint on the spec

  LIFECYCLE
  /api version        Plan a new version (URL or header strategy)
  /api deprecate      Mark endpoints deprecated; emit Sunset/Deprecation headers
  /api docs           Render human-readable docs from the spec
  /api sdk            Generate TypeScript / Python / Go SDK from the spec

  UTILITIES
  /api list           Show all endpoints with version + deprecation status
  /api drift          Compare spec to running code; report mismatches
  /checkpoint         Show checkpoint status

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Type any command to begin. /api to see this again.
```

---

## Tri-Agent Architecture

```
API DESIGN INTENT
(from app-architect 02-architecture.md API Design section)
        │
        ▼
┌──────────────────┐
│   API            │  Authors contract: OpenAPI / GraphQL schema.
│   DESIGNER       │  Decides versioning, pagination, error envelope,
│                  │  idempotency, rate-limit policy declarations.
└────────┬─────────┘
         │
         ▼
┌──────────────────────────────────────────────┐
│     BUILD LOOP (per API surface)             │
│                                              │
│  ┌────────────┐  contract   ┌─────────────┐  │
│  │    API     │◄─negotiate──►│    API     │  │
│  │  BUILDER   │             │ CONFORMANCE │  │
│  │            │──code──────►│             │  │
│  │  Scaffolds │             │  Hits live  │  │
│  │  handlers  │◄──failures──│  server +   │  │
│  │  + SDK     │             │  diffs spec │  │
│  └────────────┘             └─────────────┘  │
│       │                           │          │
│       │    All checks pass?       │          │
│       └───────────────────────────┘          │
└──────────────────────────────────────────────┘
         │
         └──► Drift monitoring (ongoing)
```

### Why Three Agents for First-Party APIs?

1. **Optimistic authorship bias.** When the same person writes both the spec and
   the code, they "agree" because nothing forces disagreement. In practice handlers
   drift from OpenAPI within hours: a field gets renamed, an optional becomes
   required, an enum gains a value. Conformance hits the running server with
   schema-validating fuzz and asserts response shapes match the published spec.

2. **Breaking-change blindness.** The Builder thinks "I added a field, that's
   backwards-compatible" without checking that *removing nullability* on a
   response field is a breaking change for consumers. Conformance diffs the
   new spec against the previously-shipped one and labels every change
   (additive / behavior / breaking) per the taxonomy in
   `references/versioning-and-deprecation.md`.

3. **Generated SDK ≠ working SDK.** The Builder generates a TypeScript SDK from
   the spec; that doesn't prove the SDK round-trips successfully against the
   running server. Conformance runs an end-to-end SDK call for each operation.

---

## Phase 1: API Designer (`/api design`)

### Designer Persona

The Designer is a senior API architect who has shipped public APIs to thousands of
consumers. Key behaviors:

- **Read the data model first.** Open `03-data-model.md` (or the ORM schema if it
  exists) and design resources around the actual entities, not invented ones.
- **Pick one style and stick to it.** REST + OpenAPI 3.1, GraphQL, or gRPC. No
  "REST-ish but with one GraphQL endpoint over here." Mixed styles double the
  surface area.
- **Cursor pagination by default.** Offset pagination is for tools the user
  controls end-to-end. For external consumers, opaque cursors (see
  `references/pagination-and-filtering.md`).
- **One error envelope.** RFC 9457 problem+json, used by every endpoint, every
  status code. Don't ship two error shapes.
- **Idempotency-Key on every unsafe operation.** Not "POSTs that look retryable" —
  every POST/PATCH/DELETE that mutates state. See `references/error-and-idempotency.md`.
- **Version on day one, not day fifty.** Pick URL (`/v1/`) or header
  (`API-Version: 2026-04-27`) before shipping the first endpoint. Adding versioning
  retroactively is a migration project.

### Designer Workflow

1. Read upstream context: `02-architecture.md` API Design section, `03-data-model.md`,
   stack-forge's chosen framework + typed-pipeline tooling, reverse-spec inventory
   (if retrofitting).
2. Confirm style (REST/GraphQL/gRPC), versioning strategy, auth scheme.
3. Author the contract — every operation, every shape, every error code.
4. Lint with spectral / redocly.
5. Write to `api/openapi.yaml` (or `api/schema.graphql`) and present for approval.

### OpenAPI 3.1 Contract Skeleton

```yaml
openapi: 3.1.0
info:
  title: [Project] API
  version: '1'
  description: |
    Versioning: URL-based (/v1/, /v2/). Sunset headers on deprecation.
    Errors: RFC 9457 problem+json. Pagination: opaque cursor.
servers:
  - url: https://api.example.com/v1
security:
  - bearerAuth: []
paths:
  /widgets:
    get:
      operationId: listWidgets
      parameters:
        - { in: query, name: cursor, schema: { type: string } }
        - { in: query, name: limit,  schema: { type: integer, default: 50, maximum: 200 } }
      responses:
        '200':
          description: Page of widgets
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/WidgetPage'
        default: { $ref: '#/components/responses/Problem' }
    post:
      operationId: createWidget
      parameters:
        - { in: header, name: Idempotency-Key, required: true, schema: { type: string } }
      requestBody:
        required: true
        content:
          application/json:
            schema: { $ref: '#/components/schemas/WidgetCreate' }
      responses:
        '201':
          description: Created
          content:
            application/json:
              schema: { $ref: '#/components/schemas/Widget' }
        default: { $ref: '#/components/responses/Problem' }
components:
  securitySchemes:
    bearerAuth: { type: http, scheme: bearer, bearerFormat: JWT }
  schemas:
    Widget:
      type: object
      required: [id, name, created_at]
      properties:
        id:         { type: string, format: uuid }
        name:       { type: string }
        created_at: { type: string, format: date-time }
    WidgetCreate:
      type: object
      required: [name]
      properties:
        name: { type: string, minLength: 1, maxLength: 200 }
    WidgetPage:
      type: object
      required: [data]
      properties:
        data:        { type: array, items: { $ref: '#/components/schemas/Widget' } }
        next_cursor: { type: [string, 'null'] }
    Problem:
      type: object
      required: [type, title, status]
      properties:
        type:     { type: string, format: uri }
        title:    { type: string }
        status:   { type: integer }
        detail:   { type: string }
        instance: { type: string }
  responses:
    Problem:
      description: Error response (RFC 9457)
      content:
        application/problem+json:
          schema: { $ref: '#/components/schemas/Problem' }
```

### Gate: Contract Approval

Present the spec. Confirm resources, auth, error envelope, pagination shape, and
versioning strategy with the user. Write checkpoint: phase `designed`.

---

## Phase 2: Build Loop (`/api build`)

### Step 1: Build Contract

**Builder proposes:**

```markdown
## API Build Contract

### Deliverables
- Typed handlers per operationId, generated from the OpenAPI spec
- Request validation middleware (Zod / Pydantic / equivalent for chosen stack)
- RFC 9457 problem+json error formatter applied uniformly
- Idempotency-Key middleware backed by KV / Redis (24h TTL by default)
- Generated SDK (TypeScript via openapi-typescript + openapi-fetch)
- Reference docs (Redoc or Stoplight Elements) at /docs

### Testable Criteria
1. Every operationId has a handler and a request-validation test
2. Every error path returns problem+json with correct `type` URI and `status`
3. Repeated POST with the same Idempotency-Key returns the original response
4. Generated SDK round-trips against the live server for every operation
5. `spectral lint` and `openapi-diff` (vs previous version) report no errors
```

**Conformance reviews** and pushes back if:
- Criteria don't include a live-server test (mocks ≠ real running app)
- No previous-version diff (breaking changes will slip through)
- No SDK round-trip (generated ≠ working)
- Error envelope shape isn't asserted on every status code

### Step 2: Builder Implements

Builder reads the chosen stack from stack-forge's checkpoint and uses the
typed-pipeline tooling that stack-forge already recommended:

| Stack (from stack-forge) | Spec authoring | Server validation | SDK generation |
|---|---|---|---|
| Hono + D1 + Workers | `@hono/zod-openapi` (Zod → OpenAPI) | Hono middleware | `openapi-typescript` + `openapi-fetch` |
| FastAPI + Postgres | Pydantic → built-in OpenAPI | FastAPI middleware | `openapi-typescript` |
| Django + DRF | `drf-spectacular` | DRF serializers | `openapi-typescript` |
| Express / Fastify + TS | `zod-to-openapi` | Zod middleware | `openapi-typescript` |
| Rails | `rswag` | Rails strong params | `openapi-typescript` |

Don't reinvent the toolchain. Read `stack-forge/references/typed-pipeline.md` for
detailed implementation per stack and pick from that menu.

### Step 3: Conformance Agent

Conformance has **isolated context** — it reads the spec and runs against the
live server without seeing the Builder's implementation choices.

**Conformance Persona.** A QA engineer who specialises in API contract testing.
Key behaviors:

- **Hit a running server.** Spin up the dev server, run every operation, validate
  every response against the OpenAPI schema. Mocks are forbidden in this phase.
- **Diff the spec.** `openapi-diff <prev> <new>` — any breaking change must be
  declared (new major version, or explicit Sunset on the old endpoint).
- **Round-trip the SDK.** For each operationId, call the generated SDK against the
  live server and assert the typed response matches.
- **Force the error envelope.** Trigger a 400, 401, 404, 409, 422, 429, 500. Each
  response must be valid problem+json with the correct `type` and `status`.
- **Fuzz idempotency.** Send the same POST with the same Idempotency-Key twice.
  The second response must be byte-identical to the first.
- **Lint.** `spectral lint` with the project's ruleset must pass clean.

**Conformance Report** saved to `api/conformance-round-M.md`:

```markdown
## API Conformance — Round [M]

### Spec → Code Drift
| Operation | Spec status codes | Code status codes | Drift? |
|---|---|---|---|
| listWidgets | 200, 4xx, 5xx | 200, 4xx, 5xx | None |
| createWidget | 201, 4xx, 5xx | 200, 4xx, 5xx | DRIFT — code returns 200 |

### Spec Diff vs Previous Version
- Additive: 2 (new optional fields on Widget)
- Behavior: 0
- Breaking: 1 — `WidgetPage.next_cursor` nullability changed

### SDK Round-Trip
| Operation | SDK call | Response valid | Latency |
|---|---|---|---|
| listWidgets | PASS | PASS | 47ms |
| createWidget | FAIL | — | — |

### Error Envelope
| Status | Triggered? | problem+json valid? |
|---|---|---|
| 400 | Yes | PASS |
| 422 | Yes | FAIL — missing `type` URI |

### Idempotency
| Operation | Repeat returns same body | Status |
|---|---|---|
| createWidget | Yes | PASS |

### Lint
- spectral: 0 errors, 2 warnings
- openapi-diff: 1 breaking change UNDECLARED

### Verdict: PASS / FAIL
[If FAIL: specific failures for Builder to fix]
```

### Step 4: Iterate or Advance

- **PASS**: API is shippable. Publish docs, register SLO + drift manifest with
  monitoring-ops, hand off to deploy-ops.
- **FAIL + rounds remaining**: Feed report to Builder, fix, re-run Conformance.
- **FAIL + max rounds**: Escalate to user.

Max iterations: 3.

---

## Lifecycle Commands

### `/api version` — plan a new version

Read `references/versioning-and-deprecation.md`. Pick URL (`/v2/`) or header
(`API-Version: 2026-04-27`) — match what's already in production; never mix.
Output: a new spec file (`api/v2/openapi.yaml`) plus a migration guide template
under `api/migrations/v1-to-v2.md`.

### `/api deprecate` — mark endpoints deprecated

For each deprecated endpoint:
- Set `deprecated: true` in the spec.
- Emit `Deprecation: <date>` (RFC 9745) and `Sunset: <date>` (RFC 8594) response
  headers.
- Add a `Link` header pointing at the migration guide.
- Open a tracked deprecation entry in `api/deprecations.md` with the sunset date,
  the replacement endpoint, and the consumer-notification plan.

### `/api docs` — render human-readable docs

Default: Redoc, served at `/docs` from the spec file. The Builder must wire the
docs route during scaffolding so the rendered docs are always in sync with the
shipped spec.

### `/api sdk` — generate SDK

TypeScript via `openapi-typescript` + `openapi-fetch` is the default; other
languages on request. SDK version tracks the API version (`v1.x` SDK ↔ `/v1`
API). Publish to a registry only after Conformance round-trip passes.

### `/api drift` — code-vs-spec drift report

Run between commits, in CI, or on demand. Outputs:
- Operations missing handlers
- Handlers returning shapes the spec doesn't declare
- Status codes the code returns but the spec doesn't list
- Response fields with mismatched types or nullability

deploy-ops gates production deploys on this command returning zero drift.

---

## Boundaries (what api-dev does NOT own)

| Concern | Owner | Why |
|---|---|---|
| OAuth flow / API-key handling for *consuming* a third-party | `integrations-engineer` | Consumer side |
| Webhook receivers tied to a single integration | `integrations-engineer` | Lives only because of that third-party |
| Stack/framework recommendation, typed-pipeline tooling | `stack-forge` | Recommends; api-dev materialises |
| Discovery-level "API design" intent in `02-architecture.md` | `app-architect` Phase 2 | Intent; api-dev elaborates |
| Rate-limit *infrastructure* and capacity math | `scale-ops` | api-dev declares the policy in the spec; scale-ops sizes / implements |
| Threat model of the API surface | `security-auditor` | api-dev emits the surface; security-auditor reviews |
| Per-endpoint SLO *implementation* + alert pipelines | `monitoring-ops` | api-dev emits SLO targets + drift-rule manifest; monitoring-ops wires alerts |
| Secret rotation procedures | `integrations-engineer` `/integrate secrets` | Already owned |

api-dev's outputs (rate-limit policy, CORS policy, SLO targets, drift manifest)
are *declarations* in the spec. Sibling skills implement them.

---

## Checkpoint Integration

### Checkpoint Location
`{project-dir}/.checkpoints/api-dev.checkpoint.json`

### When to Write

| Event | What to Save |
|---|---|
| Contract authored | Style (REST/GraphQL), versioning strategy, auth, operation count |
| Build contract negotiated | Deliverables, criteria, chosen toolchain |
| Builder completes | Files generated, SDK published version, docs URL |
| Conformance runs | Per-operation pass/fail, spec diff classification, lint results |
| Version planned | New version number, breaking changes list, sunset dates |
| Endpoint deprecated | Operation, deprecation date, sunset date, replacement |

### skill_state

```json
{
  "style": "rest+openapi3.1",
  "versioning": "url",
  "current_version": "v1",
  "auth": "bearer-jwt",
  "operations": 14,
  "spec_path": "api/openapi.yaml",
  "sdk": { "language": "typescript", "version": "1.3.0" },
  "last_conformance": {
    "round": 2,
    "verdict": "PASS",
    "drift_operations": 0,
    "spec_diff": { "additive": 1, "behavior": 0, "breaking": 0 }
  },
  "deprecations": [
    { "operation": "listWidgetsLegacy", "sunset": "2026-10-01" }
  ]
}
```

### Cross-Skill Reads

| Reads from | Why |
|---|---|
| app-architect | `02-architecture.md` API Design + `03-data-model.md` → discovery baseline |
| stack-forge | Chosen framework + typed-pipeline tooling |
| reverse-spec | Existing-endpoint inventory when retrofitting |
| integrations-engineer | `04-integrations.md` carve-outs (inbound webhook receivers stay there) |

| Read by | Why |
|---|---|
| code-auditor | Audits scaffolded handlers against the spec |
| security-auditor | Reads CORS + rate-limit policy as posture inputs |
| monitoring-ops | Ingests SLO targets + drift-alert manifest |
| deploy-ops | Drift gate — `api-dev /api drift` must report zero before prod |
| integrations-engineer | When a sibling app integrates *this* API, the published spec is the source of truth |

---

## Principles

1. **Spec first, code second.** The OpenAPI / GraphQL contract is the source of
   truth. Generate types and SDK from it. Don't write them by hand and hope
   they agree.
2. **Conformance against a running server.** Spec-vs-code parity is verified
   against a live process, not a unit test. Mocks ≠ real.
3. **One error envelope, one pagination shape, one auth scheme.** Variations
   double the surface area for consumers.
4. **Idempotency on every unsafe verb.** Not optional. Not "for retryable
   operations." Every POST/PATCH/DELETE.
5. **Version before shipping.** URL or header — pick before the first call.
6. **Breaking changes are declared, not snuck.** Every breaking change ships
   a new major version with Sunset headers and a migration guide.
7. **Declare policy, don't implement infrastructure.** Rate-limit policy and
   SLO targets live in the spec. Sibling skills (scale-ops, monitoring-ops)
   implement the runtime.
8. **Read the consumer's side too.** A clean spec that produces a painful SDK
   isn't done. Round-trip the SDK against the live server.

---
name: deploy-ops
description: >
  Deployment pipeline: audit gate → staging → production → monitoring. Use for
  /deploy, "deploy this", "ship it", "push to production", "staging", "rollback",
  "health check", or any deployment task. Trigger liberally.
---

# Deploy Ops

**On first invocation, read `references/orchestrator.md` and follow its welcome protocol.**

Orchestrate the full deployment lifecycle: pre-deploy quality gate → staging deploy →
smoke test → production promotion → health check → rollback if needed. Built for
Cloudflare Workers + D1 + Pages, with the aidops-core monorepo as the primary target.

## /deploy — Command Reference

When the user types `/deploy`, display this menu:

```
DEPLOY OPS COMMANDS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  PIPELINE
  /deploy staging    Deploy to staging environment
  /deploy prod       Promote staging to production (or direct deploy)
  /deploy rollback   Revert to previous production version
  /deploy status     Show current deployment state

  GATES
  /deploy audit      Run pre-deploy audit (calls code-auditor)
  /deploy smoke      Run post-deploy smoke tests
  /deploy health     Check production health

  SETUP
  /deploy init       Set up deployment config for a project
  /deploy env        Manage environment variables and secrets

  UTILITIES
  /checkpoint        Show checkpoint status

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Type any command to begin. /deploy to see this again.
```

---

## How This Skill Works

```
CODE (committed)
    │
    ▼
┌────────────┐     FAIL → block
│ Pre-deploy │─────────────────► Fix issues first
│ audit gate │
└─────┬──────┘
      │ PASS
      ▼
┌────────────┐
│  Staging   │──► smoke tests ──► FAIL → fix + redeploy
│  deploy    │
└─────┬──────┘
      │ PASS
      ▼
┌────────────┐
│ Production │──► health check ──► FAIL → auto-rollback
│  promote   │
└─────┬──────┘
      │ PASS
      ▼
  Monitoring
  (ongoing)
```

---

## Phase 0: Setup (/deploy init)

### Project Detection

Read the project's config to determine the deployment target:

```bash
# Check for wrangler.toml (Cloudflare Workers)
[[ -f wrangler.toml ]] && echo "Cloudflare Workers project detected"

# Check for Pages config
grep -q "pages" wrangler.toml 2>/dev/null && echo "Pages deployment detected"

# Check for existing deploy scripts
grep -q '"deploy"' package.json 2>/dev/null && echo "Deploy script found in package.json"
```

### Deploy Config

Create or update `.deploy-ops.json`:

```json
{
  "project_name": "gtrack",
  "platform": "cloudflare-workers",
  "monorepo": true,
  "monorepo_root": "/home/claude/aidops-core",
  "app_path": "apps/gtrack",

  "environments": {
    "staging": {
      "wrangler_env": "staging",
      "d1_database": "gtrack-staging",
      "url": "https://gtrack-staging.aidops.workers.dev",
      "auto_deploy_branch": "staging"
    },
    "production": {
      "wrangler_env": null,
      "d1_database": "gtrack-prod",
      "url": "https://gtrack.aidops.workers.dev",
      "auto_deploy_branch": "main"
    }
  },

  "deploy_order": [
    "migrate",
    "deploy-api",
    "deploy-frontend"
  ],

  "smoke_tests": [
    { "name": "API health", "url": "/api/health", "expect_status": 200 },
    { "name": "Auth endpoint", "url": "/api/auth/status", "expect_status": 401 },
    { "name": "Frontend loads", "url": "/", "expect_contains": "<html" }
  ],

  "rollback": {
    "strategy": "wrangler-rollback",
    "keep_versions": 3
  }
}
```

### First-Time Setup Checklist

1. **Detect platform** from config files
2. **Check auth** — `wrangler whoami` or CF API token in env
3. **Check environments** — staging/prod wrangler.toml configured?
4. **Check D1 databases** — staging and prod DBs exist?
5. **Generate .deploy-ops.json** — ask user to confirm/adjust
6. **Verify deploy works** — dry-run `wrangler deploy --dry-run`
7. **Set up smoke test URLs** — derive from wrangler.toml routes

---

## Pre-Deploy Audit Gate (/deploy audit)

Before any deploy, run the code-auditor in pre-deploy mode:

```bash
# Check if code-auditor checkpoint exists and is recent
bash checkpoint.sh exists <project-dir> code-auditor
# If exists and < 1 hour old, reuse. Otherwise run fresh.
```

### Gate Rules

| Audit Result | Deploy Decision |
|---|---|
| No CRITICAL findings | ✅ Proceed |
| CRITICAL findings exist | 🚫 Block — must fix before deploy |
| HIGH findings (≤ 3) | ⚠️ Warn — proceed with user confirmation |
| HIGH findings (> 3) | 🚫 Block — too many unresolved issues |
| No audit run | ⚠️ Warn — suggest running audit first |

When blocked, show the specific findings and fix commands. When warned, list
the findings and ask for explicit confirmation before proceeding.

---

## Staging Deploy (/deploy staging)

### Deploy Sequence (Cloudflare Workers + D1)

```bash
cd <project-dir>

# 1. Pre-flight
npm ci
npx tsc --noEmit          # Type check — fail fast
npx vitest run            # Tests — fail fast

# 2. Migrate (staging DB)
npx wrangler d1 migrations apply <staging-db> --remote --env staging

# 3. Deploy Worker (staging)
npx wrangler deploy --env staging

# 4. Deploy Pages frontend (if applicable)
if [[ -d frontend ]]; then
  cd frontend && npm ci && npm run build
  npx wrangler pages deploy dist --project-name=<project>-staging
  cd ..
fi

# 5. Smoke tests (immediate)
```

### Monorepo Deploy (aidops-core)

For the aidops monorepo with the deploy API:

```bash
curl -X POST "https://deploy.aidops.workers.dev/deploy" \
  -H "Authorization: Bearer <deploy-token>" \
  -H "Content-Type: application/json" \
  -d '{"app": "<app-name>", "env": "staging"}'
```

Fallback to direct wrangler if deploy API isn't available.

### Post-Staging Smoke Tests (/deploy smoke)

Run immediately after staging deploy:

```bash
STAGING_URL="<staging-url>"
PASS=0; FAIL=0

run_smoke() {
  local name="$1" url="$2" expect="$3"
  local status=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "${STAGING_URL}${url}")
  if [[ "$status" == "$expect" ]]; then
    echo "  ✅ $name: $status"; ((PASS++))
  else
    echo "  ❌ $name: $status (expected $expect)"; ((FAIL++))
  fi
}

echo "Smoke tests: $STAGING_URL"
run_smoke "API health"     "/api/health"      "200"
run_smoke "Auth guard"     "/api/auth/status"  "401"

# Content check
BODY=$(curl -s "${STAGING_URL}/")
echo "$BODY" | grep -q "<html" && { echo "  ✅ Frontend loads"; ((PASS++)); } || { echo "  ❌ Frontend missing"; ((FAIL++)); }

echo "Result: $PASS passed, $FAIL failed"
[[ $FAIL -eq 0 ]] && echo "Ready for production." || echo "Fix failures before promoting."
```

---

## Production Promotion (/deploy prod)

### Pre-Promotion Checklist

1. Staging smoke tests passed (read checkpoint)
2. Code audit clear (no CRITICAL)
3. User explicitly confirms

Always ask before production deploy — never auto-promote.

### Deploy Sequence

```bash
cd <project-dir>
git checkout main && git pull origin main

# Record current version for rollback
PREV_VERSION=$(npx wrangler deployments list --json 2>/dev/null | \
  python3 -c "import json,sys;d=json.load(sys.stdin);print(d[0]['id'] if d else 'unknown')")

# Migrate → Deploy → Smoke (same as staging but against prod)
npx wrangler d1 migrations apply <prod-db> --remote
npx wrangler deploy

# Run health check
```

### Post-Deploy Health (/deploy health)

```bash
PROD_URL="<production-url>"
STATUS=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "$PROD_URL/api/health")
LATENCY=$(curl -s -o /dev/null -w "%{time_total}" --max-time 5 "$PROD_URL/api/health")

echo "Production: $STATUS (${LATENCY}s)"

[[ "$STATUS" != "200" ]] && echo "❌ UNHEALTHY — consider rollback"
(( $(echo "$LATENCY > 2.0" | bc -l 2>/dev/null) )) && echo "⚠️ High latency"
```

---

## Rollback (/deploy rollback)

### Wrangler Rollback

```bash
npx wrangler rollback
# Verify
curl -s -o /dev/null -w "%{http_code}" "<production-url>/api/health"
```

### Migration Rollback

D1 migrations are forward-only. If a migration needs reversal:
1. Create a new "revert" migration
2. Apply it
3. Roll back the Worker code

### Auto-Rollback

If production health check fails after deploy:
1. Wait 30 seconds (propagation)
2. Re-check
3. If still failing → `wrangler rollback` + notify user

---

## Monitoring (Phase 4 extension)

### On-Demand Health Check

`/deploy health` runs the full suite:
- HTTP status check on all smoke test URLs
- Latency measurement
- CF Workers analytics via API (request count, error rate) if token available
- Comparison against baseline (if prior checkpoint exists)

### Cloudflare Analytics

```bash
# Requires CF_API_TOKEN and CF_ACCOUNT_ID
curl -s "https://api.cloudflare.com/client/v4/accounts/$CF_ACCOUNT_ID/workers/analytics/stored" \
  -H "Authorization: Bearer $CF_API_TOKEN" | python3 -c "
import json, sys
data = json.load(sys.stdin)
if data.get('success'):
  t = data['result']['totals']
  r = t.get('requests', {})
  print(f'Requests: {r.get(\"count\",0)}, Errors: {r.get(\"errors\",0)}')
"
```

### Notification (Telegram)

For projects with Telegram integration:

```bash
notify() {
  local msg="$1"
  [[ -n "$TELEGRAM_BOT_TOKEN" && -n "$TELEGRAM_CHAT_ID" ]] && \
    curl -s -X POST "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/sendMessage" \
      -d "chat_id=$TELEGRAM_CHAT_ID" -d "text=$msg" -d "parse_mode=Markdown"
}

notify "✅ *gtrack* deployed to production — $(git rev-parse --short HEAD)"
```

---

## Checkpoint Integration

### Checkpoint Location
`{project-dir}/.checkpoints/deploy-ops.checkpoint.json`

### When to Write

| Event | What to Save |
|---|---|
| Init complete | Platform, environments, URLs, auth |
| Audit gate result | Pass/fail, finding count |
| Staging deployed | Version, timestamp, smoke results |
| Production promoted | Version, previous version, timestamp |
| Health check | Status, latency, error count |
| Rollback executed | From → to, reason |

### skill_state Template

```json
{
  "current_env": "staging",
  "staging_version": "abc123",
  "prod_version": "def456",
  "prev_prod_version": "ghi789",
  "last_deploy": "2026-04-01T10:00:00Z",
  "smoke_results": { "health": "pass", "auth": "pass", "frontend": "pass" },
  "rollback_available": true
}
```

### Cross-Skill Reads

| Reads from | Why |
|---|---|
| code-auditor | Audit grade → deploy gate |
| tri-dev | Sprint pass → deploy confidence |
| git-ops | Branch merged → ready to deploy |

### Triggered By

Deploy-ops can be invoked directly, but also gets suggested by other skills:
- **git-ops**: After `/git-sync` completes, git-ops suggests `/deploy staging`
- **tri-dev**: After final sprint passes, tri-dev suggests `/audit pre-deploy` → `/deploy`
- **app-architect**: Phase 7 (Launch) suggests the deploy pipeline

When triggered by another skill's suggestion, read that skill's checkpoint for context
(e.g., what was just pushed, what audit results exist) to skip redundant steps.

---

## GitHub Actions Template

For automated CI/CD, generate with `/deploy init`:

Read `references/github-actions.md` for full workflow. Structure:

```yaml
jobs:
  test:        # lint + types + unit tests
  audit:       # npm audit, secret scan
  staging:     # wrangler deploy --env staging (PR only)
  production:  # wrangler deploy (main push only)
  smoke:       # post-deploy smoke tests
  notify:      # telegram notification
```

---

## Principles

1. **Never deploy without a gate.** Even quick deploys run the audit check.
2. **Staging first.** Always. Even for "small changes."
3. **Rollback in 30 seconds.** Every deploy records the previous version.
4. **Health checks are non-negotiable.** Non-200 after deploy = something is wrong.
5. **Deploys should be boring.** The feature is the exciting part.
6. **Record everything.** The checkpoint is the deploy log.

# Runbook: `opchain.dev` is serving a Cloudflare challenge ("Just a moment…")

**Severity:** high — silently breaks the v1.4.3 Codex/MCP release and all programmatic access to the site.
**Symptom in one line:** you deploy, the worker updates, but nothing about the release is reachable to non-browser clients — and the deploy-lag canary never warns you.

## What's actually happening

A **Cloudflare Managed Challenge** (the "Just a moment…" bot interstitial) is applied to the
`opchain.dev` zone **at the edge, before requests reach the `opchain-dev` worker.** Real browsers
usually solve the JS challenge and pass, so the site *looks* fine when you click around. But every
**non-browser** client — `curl`, CI, monitoring, and crucially **Codex / Claude Desktop / Cursor /
any MCP client POSTing to `https://opchain.dev/mcp`** — gets an HTML challenge page instead of the
worker's JSON response.

This is the failure mode behind "I deployed v1.4.3 a dozen times and it still isn't live":
**the deploys were always fine; the front door was challenging automated traffic.** The entire point
of v1.4.3 is the hosted `/mcp` endpoint that MCP clients hit programmatically with no browser, no JS,
and no cookies — exactly the traffic a managed challenge blocks.

## How it was confirmed (2026-06-20)

- `.github/workflows/deploy-lag.yml` reads `version` from `https://opchain.dev/api/health` daily.
  Its job logs showed the response body on all 3 retries was the Cloudflare challenge page:
  `<title>Just a moment...</title>`, `cType: 'managed'`, `cZone: 'opchain.dev'`,
  `/cdn-cgi/challenge-platform/…`, "Enable JavaScript and cookies to continue."
- Because the canary could never parse a `version`, it hit its "skip, no false alarm" branch
  **every day** and opened no drift issue — so "zero open issues" was false comfort, not proof that
  prod was current. (Fixed: the canary now detects the challenge and fails loudly.)
- The `opchain-dev` worker itself was deploying correctly (Cloudflare showed it updated the same day).
  The block is a **zone-level security setting, not worker code or a deploy artifact** — so no amount
  of `wrangler deploy` fixes it.

## Fix (Cloudflare dashboard — this cannot be done from `wrangler` or the repo)

**Preferred — scope the exemption to the machine-facing paths so the rest of the site keeps bot
protection.** Security → WAF → **Custom rules → Create rule**:

- Expression:
  ```
  (http.host eq "opchain.dev" and (starts_with(http.request.uri.path, "/api/") or http.request.uri.path eq "/mcp"))
  ```
- Action: **Skip** → tick **Super Bot Fight Mode** and **Managed Challenge** (and "All remaining
  custom rules").
- Add the same rule for `staging.opchain.dev`.

**Blunt alternative:** Security → **Bots → turn Bot Fight Mode / Super Bot Fight Mode OFF** for the
zone. Also confirm Security → Settings → **Security Level is not "I'm Under Attack."**

## Verify after the change

```bash
# Must return JSON with a "version" field, NOT an HTML challenge page:
curl -sS https://opchain.dev/api/health

# Must return JSON-RPC, NOT a challenge page:
curl -sS -X POST https://opchain.dev/mcp \
  -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'

# Confirm the deployed version matches what you intend to be live:
git rev-parse --short HEAD
```

If `version` is older than `main` HEAD, redeploy from latest `main`
(`npm run deploy:staging` → eyeball → `npm run deploy`) and re-check.

## Prevention

- The deploy-lag canary now **fails loudly** when it sees a challenge page instead of silently
  skipping, so this can't hide again. A red "Deploy lag" run = go check the WAF/Bots config first.
- Any future tightening of Cloudflare bot/WAF settings on this zone must keep `/api/*` and `/mcp`
  exempt, or it will take the MCP product offline for every non-browser client.

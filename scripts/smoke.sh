#!/usr/bin/env bash
# Post-deploy smoke test. Hits the key surfaces and checks that security
# headers are present. Used by .github/workflows/deploy.yml after every
# deploy.
#
# Usage:  DEPLOY_URL=https://staging.opchain.dev scripts/smoke.sh
#         (or) scripts/smoke.sh https://opchain-dev.example.workers.dev

set -eu

URL="${DEPLOY_URL:-${1:-}}"
if [ -z "${URL}" ]; then
  echo "::error::no DEPLOY_URL provided"
  exit 1
fi
URL="${URL%/}"

fail=0
note() { echo "smoke: $*"; }
err()  { echo "::error::$*"; fail=1; }

# Retry a curl check a few times — Cloudflare edge takes a moment to pick up
# a fresh deploy. Tunable via env so tests can run fast and local sanity
# checks don't pay the full 15s-per-failed-check cost.
SMOKE_RETRIES="${SMOKE_RETRIES:-5}"
SMOKE_RETRY_SLEEP="${SMOKE_RETRY_SLEEP:-3}"
with_retry() {
  local i
  for (( i=1; i<=SMOKE_RETRIES; i++ )); do
    if "$@"; then return 0; fi
    [ "$i" -lt "$SMOKE_RETRIES" ] && sleep "$SMOKE_RETRY_SLEEP"
  done
  return 1
}

check_health() {
  local body
  local hdrs
  local bust
  # Unique query string per request — /api/health is Cache-Control: no-store
  # at the origin, but a zone-level cache rule can still serve a pre-deploy
  # HIT, which would smoke-test the OLD deploy and pass vacuously.
  bust="nocache=$$-$(date +%s)"
  body="$(curl -fsS "${URL}/api/health?${bust}-body")" || return 1
  echo "$body" | grep -q '"ok":true' || return 1
  # A past failure mode was the Worker returning 200 with a non-JSON body
  # (e.g. Cloudflare intercepting with an error page). Assert content-type
  # directly so the symptom is caught here, not in a downstream consumer.
  hdrs="$(curl -fsS -D - -o /dev/null "${URL}/api/health?${bust}-hdrs")" || return 1
  echo "$hdrs" | grep -qi '^content-type: *application/json'
}

check_homepage() {
  local hdrs status ct
  hdrs="$(curl -sS -D - -o /dev/null -w 'HTTP %{http_code}\n' "${URL}/" 2>/dev/null)" || return 1
  status="$(echo "$hdrs" | awk '/^HTTP /{print $2}' | tail -1)"
  [ "$status" = "200" ] || return 1
  # Guard against the "blank page, browser downloads a file" class of bug:
  # if the Worker returns 200 but serves the homepage as octet-stream (or
  # any non-HTML Content-Type), browsers treat it as a file download instead
  # of rendering. Fail smoke — better to block the deploy than promote a
  # broken staging to prod.
  ct="$(echo "$hdrs" | awk -F': ' 'tolower($1)=="content-type"{print tolower($2)}' | tr -d '\r' | tail -1)"
  case "$ct" in
    text/html*) return 0 ;;
    *)
      echo "smoke: homepage content-type is '${ct}' (expected text/html)"
      return 1
      ;;
  esac
}

check_zip() {
  local status
  status="$(curl -sS -o /dev/null -w '%{http_code}' -I "${URL}/opchain-skills.zip" 2>/dev/null || echo 000)"
  # Worker may serve 200 or a 3xx chain; accept anything < 400.
  [ "$status" -lt 400 ] 2>/dev/null
}

check_skill_redirect() {
  # Skills gained an `oc-` prefix; an old /skills/<id> URL must 301 to the
  # prefixed path so inbound + bookmarked links survive the rename.
  local loc
  loc="$(curl -sS -o /dev/null -w '%{redirect_url}' "${URL}/skills/code-auditor" 2>/dev/null || echo "")"
  case "$loc" in
    *"/skills/oc-code-auditor"*) return 0 ;;
    *)
      echo "smoke: /skills/code-auditor did not 301 to /skills/oc-code-auditor (got '${loc}')"
      return 1
      ;;
  esac
}

check_security_headers() {
  local hdrs
  hdrs="$(curl -fsS -D - -o /dev/null "${URL}/")"
  echo "$hdrs" | grep -qi '^x-content-type-options: nosniff'          || return 1
  echo "$hdrs" | grep -qi '^strict-transport-security: max-age='      || return 1
  echo "$hdrs" | grep -qi '^x-frame-options: deny'                    || return 1
  echo "$hdrs" | grep -qi '^referrer-policy: strict-origin'           || return 1
  echo "$hdrs" | grep -qi '^permissions-policy:'                      || return 1
  echo "$hdrs" | grep -qi '^content-security-policy:'                 || return 1
}

note "target  = ${URL}"
with_retry check_health           && note "health  OK" || err "health check failed — 200+{ok:true}+application/json"
with_retry check_homepage         && note "home    OK" || err "homepage failed — 200+text/html"
with_retry check_zip              && note "zip     OK" || err "zip download not reachable"
with_retry check_skill_redirect   && note "redirect OK" || err "old /skills/<id> did not 301 to /skills/oc-<id>"
with_retry check_security_headers && note "headers OK" || err "security headers missing on homepage"

if [ "$fail" -ne 0 ]; then
  echo "::error::smoke failed — see above"
  exit 1
fi
note "all checks passed"

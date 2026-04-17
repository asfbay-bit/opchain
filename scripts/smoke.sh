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
# a fresh deploy.
with_retry() {
  local i
  for i in 1 2 3 4 5; do
    if "$@"; then return 0; fi
    sleep 3
  done
  return 1
}

check_health() {
  local body
  body="$(curl -fsS "${URL}/api/health")" || return 1
  echo "$body" | grep -q '"ok":true'
}

check_homepage() {
  local status
  # `|| echo 000` keeps the var numeric when curl can't reach the host, so
  # the `-eq` / `-lt` comparisons below don't trip `set -eu`.
  status="$(curl -sS -o /dev/null -w '%{http_code}' "${URL}/" 2>/dev/null || echo 000)"
  [ "$status" = "200" ]
}

check_zip() {
  local status
  status="$(curl -sS -o /dev/null -w '%{http_code}' -I "${URL}/opchain-skills.zip" 2>/dev/null || echo 000)"
  # Worker may serve 200 or a 3xx chain; accept anything < 400.
  [ "$status" -lt 400 ] 2>/dev/null
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
with_retry check_health           && note "health  OK" || err "health never reported ok"
with_retry check_homepage         && note "home    OK" || err "homepage did not return 200"
with_retry check_zip              && note "zip     OK" || err "zip download not reachable"
with_retry check_security_headers && note "headers OK" || err "security headers missing on homepage"

if [ "$fail" -ne 0 ]; then
  echo "::error::smoke failed — see above"
  exit 1
fi
note "all checks passed"

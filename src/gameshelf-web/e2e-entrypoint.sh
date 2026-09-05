#!/usr/bin/env bash
# Entry point of the e2e container (docker-compose.test.yml).
# Waits until the API reports ready (database reachable, migrations applied) and the web server answers,
# then execs the container command so Playwright's exit code is the container's exit code.
set -euo pipefail

wait_for() {
  local name=$1 url=$2
  for _ in $(seq 1 90); do
    if node -e "fetch(process.argv[1]).then(r => process.exit(r.ok ? 0 : 1), () => process.exit(1))" "$url"; then
      echo "$name is ready: $url"
      return 0
    fi
    sleep 2
  done
  echo "$name did not become ready within 180s: $url" >&2
  return 1
}

wait_for "API" "${API_READY_URL:?API_READY_URL is required}"
wait_for "web" "${E2E_BASE_URL:?E2E_BASE_URL is required}"

exec "$@"

#!/usr/bin/env bash
# Entry point of the backend-tests container (docker-compose.test.yml).
#
# Runs each suite named in TEST_SUITES (default: "unit integration") and writes a .trx per suite to
# RESULTS_DIR. Every suite runs even if an earlier one fails; the exit code is non-zero if any failed.
# `docker compose up --exit-code-from backend-tests` turns that exit code into the command's exit code.
#
# SQL readiness is handled outside this script: compose only starts this container once the sqlserver
# healthcheck (a real CREATE DATABASE) has passed, and IntegrationApiFactory waits for the server again
# before applying migrations.
set -uo pipefail

RESULTS_DIR="${RESULTS_DIR:-/results}"
TEST_SUITES="${TEST_SUITES:-unit integration}"
mkdir -p "$RESULTS_DIR"

status=0
for suite in $TEST_SUITES; do
  case "$suite" in
    unit)        project=tests/GameShelf.Api.Tests ;;
    integration) project=tests/GameShelf.Api.IntegrationTests ;;
    *) echo "Unknown suite '$suite' (expected: unit, integration)" >&2; exit 2 ;;
  esac

  echo
  echo "=================================================================="
  echo " $suite  ($project)"
  echo "=================================================================="
  if ! dotnet test "$project" --no-build -c Release \
        --logger "trx;LogFileName=$suite.trx" \
        --logger "console;verbosity=normal" \
        --results-directory "$RESULTS_DIR"; then
    status=1
    echo "FAILED: $suite" >&2
  fi
done

exit $status

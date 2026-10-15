#!/usr/bin/env bash
set -euo pipefail

: "${CRON_SECRET:?CRON_SECRET must be set in the service environment}"
APP_URL="${APP_URL:-http://127.0.0.1:3000}"

curl --fail --silent --show-error \
  --retry 3 --retry-delay 5 --retry-connrefused \
  --max-time 300 \
  --request GET \
  --header "Authorization: Bearer ${CRON_SECRET}" \
  "${APP_URL%/}/api/internal/jobs/reconcile-call-limits"

#!/usr/bin/env bash
# Per-request timing decomposition (fresh connection vs keep-alive).
#
# Usage:
#   curl-timing.sh fresh <count> <path> [host]
#   curl-timing.sh ka    <count> <path> [host]
#
# Output per request: total / connect / TLS / TTFB(starttransfer) / remote IP / HTTP version.
# 'fresh' opens a new TCP+TLS connection per request; 'ka' reuses one connection
# (download time = total - ttfb; payloads here are tiny).
set -euo pipefail

MODE="${1:-ka}"
COUNT="${2:-30}"
PATH_="${3:-/api/ping}"
HOST="${4:-https://task-board-api.app-server.workers.dev}"
URL="${HOST}${PATH_}"

if [[ "$MODE" == "fresh" ]]; then
  for i in $(seq 1 "$COUNT"); do
    curl -s -o /dev/null --max-time 60 -w \
      "i=$i total=%{time_total}s connect=%{time_connect}s tls=%{time_appconnect}s ttfb=%{time_starttransfer}s ip=%{remote_ip} http=%{http_version}\n" \
      "$URL" || true
    sleep 0.25
  done
else
  # keep-alive: one curl invocation reuses the connection across URLs
  args=()
  for i in $(seq 1 "$COUNT"); do
    args+=(-o /dev/null "$URL")
  done
  curl -s -w "%{time_starttransfer}\n" "${args[@]}" --parallel-max 1
fi

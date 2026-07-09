#!/usr/bin/env sh
# Hits the local /api/generate endpoint with a sample topic.
# Usage: sh scripts/test-generate.sh [topic] [theme]
TOPIC="${1:-5 tips for better sleep}"
THEME="${2:-minimal}"

curl -sS -X POST http://localhost:3000/api/generate \
  -H "Content-Type: application/json" \
  -d "{\"topic\": \"$TOPIC\", \"theme\": \"$THEME\"}" \
  -w "\nHTTP status: %{http_code}\n"

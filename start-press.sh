#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js 20+ LTS required for local Press (trusted updates): https://nodejs.org/"
  echo "Demo peek only (not a locked install): https://ihelpmaybe.github.io/hearts-archive/"
  exit 1
fi

if [[ ! -d node_modules ]]; then
  echo "First run — installing dependencies (once)…"
  npm install
fi

echo "Heart's Archive Press — http://127.0.0.1:5177/"
echo "Leave this terminal open. Ctrl+C to stop."
if command -v open >/dev/null 2>&1; then
  (sleep 2 && open "http://127.0.0.1:5177/") &
elif command -v xdg-open >/dev/null 2>&1; then
  (sleep 2 && xdg-open "http://127.0.0.1:5177/") &
fi
npm run dev:press

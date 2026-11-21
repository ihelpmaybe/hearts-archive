#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

if [[ ! -f dist/index.html ]]; then
  echo ""
  echo "No built Press (dist/index.html missing)."
  echo "Users: download the Press release ZIP from"
  echo "  https://github.com/ihelpmaybe/hearts-archive/releases"
  echo "Developers: npm install && npm run build"
  echo ""
  exit 1
fi

PORT="${PORT:-5177}"
URL="http://127.0.0.1:${PORT}/"
echo ""
echo "Heart's Archive Press"
echo "  ${URL}"
echo "  Leave this terminal open. Ctrl+C to stop."
echo ""

if command -v open >/dev/null 2>&1; then (sleep 1 && open "$URL") &
elif command -v xdg-open >/dev/null 2>&1; then (sleep 1 && xdg-open "$URL") &
fi

cd dist
if command -v python3 >/dev/null 2>&1; then
  exec python3 -m http.server "$PORT" --bind 127.0.0.1
elif command -v python >/dev/null 2>&1; then
  exec python -m http.server "$PORT" --bind 127.0.0.1
else
  echo "Need python3 to serve the Press (or use START.cmd on Windows)."
  exit 1
fi

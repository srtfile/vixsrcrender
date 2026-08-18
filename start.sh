#!/bin/bash
set -e

echo "==> Starting FlareSolverr on port 8191..."
# Launch FlareSolverr in the background
/app/flaresolverr &

echo "==> Waiting for FlareSolverr to initialize..."
until curl -s http://127.0.0.1:8191/health > /dev/null; do
  sleep 1
done
echo "==> FlareSolverr is ready!"

echo "==> Starting Node.js Stream Proxy on port ${PORT:-10000}..."
exec node server.js

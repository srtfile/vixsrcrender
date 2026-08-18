#!/bin/bash
set -e

echo "==> Locating FlareSolverr binary/script..."

if [ -f "/app/flaresolverr.py" ]; then
    echo "Starting FlareSolverr via python (/app/flaresolverr.py)..."
    python3 -u /app/flaresolverr.py &
elif [ -f "/opt/flaresolverr/flaresolverr" ]; then
    echo "Starting FlareSolverr via /opt/flaresolverr/flaresolverr..."
    /opt/flaresolverr/flaresolverr &
elif [ -f "/flaresolverr/flaresolverr" ]; then
    echo "Starting FlareSolverr via /flaresolverr/flaresolverr..."
    /flaresolverr/flaresolverr &
elif which flaresolverr > /dev/null 2>&1; then
    echo "Starting FlareSolverr via PATH..."
    flaresolverr &
else
    echo "Starting FlareSolverr via python module..."
    python3 -u -m flaresolverr &
fi

echo "==> Waiting for FlareSolverr to initialize on http://127.0.0.1:8191/health..."
MAX_RETRIES=40
COUNT=0

until curl -s http://127.0.0.1:8191/health > /dev/null 2>&1; do
    sleep 1
    COUNT=$((COUNT + 1))
    if [ $COUNT -ge $MAX_RETRIES ]; then
        echo "[!] Warning: FlareSolverr healthcheck took longer than expected. Continuing..."
        break
    fi
done

echo "==> FlareSolverr is online!"
echo "==> Starting Node.js Stream Proxy on port ${PORT:-10000}..."
exec node /node_app/server.js

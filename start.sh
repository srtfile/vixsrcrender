#!/bin/bash
set -e

# Save the public port for Node.js (provided by Railway / Render)
APP_PORT="${PORT:-10000}"

echo "==> Starting FlareSolverr on internal port 8191..."

# Force FlareSolverr to ONLY bind to internal port 8191 on localhost
if [ -f "/app/flaresolverr.py" ]; then
    PORT=8191 HOST=127.0.0.1 python3 -u /app/flaresolverr.py &
elif [ -f "/opt/flaresolverr/flaresolverr" ]; then
    PORT=8191 HOST=127.0.0.1 /opt/flaresolverr/flaresolverr &
elif [ -f "/flaresolverr/flaresolverr" ]; then
    PORT=8191 HOST=127.0.0.1 /flaresolverr/flaresolverr &
elif which flaresolverr > /dev/null 2>&1; then
    PORT=8191 HOST=127.0.0.1 flaresolverr &
else
    PORT=8191 HOST=127.0.0.1 python3 -u -m flaresolverr &
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

echo "==> FlareSolverr is online on 127.0.0.1:8191!"
echo "==> Starting Node.js Stream Proxy on public port ${APP_PORT}..."
export PORT="${APP_PORT}"
export FLARESOLVERR_URL="http://127.0.0.1:8191/v1"
exec node /node_app/server.js


#!/bin/bash

# Public port for Node.js (provided by Railway or Render)
APP_PORT="${PORT:-10000}"

echo "==> Starting FlareSolverr on internal port 8191 (background)..."

# Run FlareSolverr with internal port 8191
if [ -x "/app/flaresolverr" ]; then
    PORT=8191 HOST=127.0.0.1 /app/flaresolverr &
elif [ -f "/app/flaresolverr.py" ]; then
    PORT=8191 HOST=127.0.0.1 python3 -u /app/flaresolverr.py &
elif [ -x "/opt/flaresolverr/flaresolverr" ]; then
    PORT=8191 HOST=127.0.0.1 /opt/flaresolverr/flaresolverr &
elif [ -x "/flaresolverr/flaresolverr" ]; then
    PORT=8191 HOST=127.0.0.1 /flaresolverr/flaresolverr &
elif command -v flaresolverr > /dev/null 2>&1; then
    PORT=8191 HOST=127.0.0.1 flaresolverr &
else
    PORT=8191 HOST=127.0.0.1 python3 -u -m flaresolverr &
fi

echo "==> Starting Node.js proxy server immediately on 0.0.0.0:${APP_PORT}..."
export PORT="${APP_PORT}"
export FLARESOLVERR_URL="http://127.0.0.1:8191/v1"

exec node /node_app/server.js



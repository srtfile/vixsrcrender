# VixSrc Ad-Free Stream Relay (Render Deployable)

A unified Docker-based stream extraction and relay server with integrated **FlareSolverr** and a mobile-friendly HTML5 player.

## Included Files
- `Dockerfile`: Multi-service Dockerfile containing FlareSolverr + Node.js 20.
- `server.js`: Express server handling Cloudflare challenge extraction, `.m3u8` playlist chunk rewriting, and Referer headers.
- `start.sh`: Container entrypoint that launches FlareSolverr in the background and starts the server.
- `package.json`: Node dependencies (`express`, `axios`, `cors`).
- `render.yaml`: Blueprint configuration for Render.com.

## How to Deploy to Render.com

1. Push this folder to a GitHub repository.
2. Log into [Render Dashboard](https://dashboard.render.com/) and click **New +** -> **Web Service**.
3. Connect your repository.
4. Select **Docker** as the Runtime and choose the **Free** instance plan.
5. Click **Create Web Service**.

## Watching Streams

Once deployed, visit your service URL:
- Home: `https://<YOUR_RENDER_URL>/`
- Watch: `https://<YOUR_RENDER_URL>/watch/254`
- M3U8 Stream Endpoint: `https://<YOUR_RENDER_URL>/play/254.m3u8`

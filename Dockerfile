# Base image: Official FlareSolverr container with Chromium & Python pre-configured
FROM ghcr.io/flaresolverr/flaresolverr:latest

USER root

# Install Node.js & npm
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    ca-certificates \
    gnupg \
    && mkdir -p /etc/apt/keyrings \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Set up Node app directory
WORKDIR /app

# Install app dependencies
COPY package.json ./
RUN npm install --production

# Copy application files
COPY server.js ./
COPY start.sh ./
RUN chmod +x start.sh

# Render exposes PORT dynamically (default: 10000)
ENV PORT=10000
ENV FLARESOLVERR_URL=http://127.0.0.1:8191/v1
ENV LOG_LEVEL=info
ENV CAPTCHA_SOLVER=none

EXPOSE 10000

CMD ["./start.sh"]

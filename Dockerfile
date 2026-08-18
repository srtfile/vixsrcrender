# Base image: Official FlareSolverr container with pre-configured Chromium & Python
FROM ghcr.io/flaresolverr/flaresolverr:latest

USER root

# Install Node.js 20 & required tools
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    ca-certificates \
    gnupg \
    procps \
    && mkdir -p /etc/apt/keyrings \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Put our Node app in /node_app to prevent overwriting FlareSolverr files
WORKDIR /node_app

# Install app dependencies
COPY package.json ./
RUN npm install --omit=dev

# Copy application files
COPY server.js ./
COPY start.sh ./
RUN chmod +x start.sh

# Environment settings
ENV PORT=10000
ENV FLARESOLVERR_URL=http://127.0.0.1:8191/v1
ENV LOG_LEVEL=info
ENV CAPTCHA_SOLVER=none

EXPOSE 10000

CMD ["./start.sh"]

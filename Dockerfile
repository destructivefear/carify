# Playwright image bundles Chromium + all system deps + Xvfb, and its browser
# binaries are pinned to the same version we lock in package-lock.json (1.61.1).
FROM mcr.microsoft.com/playwright:v1.61.1-noble

WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Install deps (incl. dev — needed for `next build` and the `playwright` package).
COPY package.json package-lock.json ./
RUN npm ci --include=dev

COPY . .
RUN npm run build && chmod +x docker-entrypoint.sh

EXPOSE 3000

# Entrypoint boots a background Xvfb (for lib/copart.ts headed Chromium) and
# then execs Next so node is the main process with working logs/signals.
ENTRYPOINT ["./docker-entrypoint.sh"]

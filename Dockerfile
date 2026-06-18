# syntax=docker/dockerfile:1

# ---- Build stage: install all workspace deps and build the dashboard ----
FROM node:22-slim AS build
WORKDIR /app

# Install dependencies first (better layer caching).
COPY package.json package-lock.json* ./
COPY shared/package.json ./shared/
COPY server/package.json ./server/
COPY web/package.json ./web/
RUN npm install --no-audit --no-fund

# Build the web dashboard (outputs to web/dist).
COPY . .
RUN npm run build -w web

# ---- Runtime stage ----
FROM node:22-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

# The server runs the TypeScript entry directly via tsx (a runtime dependency),
# so we ship the built workspace including node_modules and web/dist.
COPY --from=build /app /app

# DigitalOcean App Platform injects PORT (default 8080); the server honours it.
ENV PORT=8080
EXPOSE 8080

# Lightweight healthcheck for orchestrators.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8080)+'/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["npm", "run", "start", "-w", "server"]

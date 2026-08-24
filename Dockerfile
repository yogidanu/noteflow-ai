# -------------------------------------------------------------
# Stage 1: Build & Dependencies
# -------------------------------------------------------------
FROM node:22-alpine AS builder

WORKDIR /app

# Install build dependencies
COPY package*.json tsconfig*.json vite.config.ts ./
RUN npm ci

# Copy source files and compile production frontend & desktop types
COPY . .
RUN npm run build

# -------------------------------------------------------------
# Stage 2: Production Minimal Runtime Container
# -------------------------------------------------------------
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=4000

# Install production-only dependencies
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Copy compiled frontend and server source files
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server ./server
COPY --from=builder /app/src/types ./src/types

# Create data directory for persistent vault fallback
RUN mkdir -p /app/.data && chown -R node:node /app/.data

# Security Hardening: Run as unprivileged non-root user
USER node

EXPOSE 4000

# Container Healthcheck Probe
HEALTHCHECK --interval=15s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:4000/health || exit 1

# Start Production Backend Ingress Server
CMD ["npx", "tsx", "server/index.ts"]

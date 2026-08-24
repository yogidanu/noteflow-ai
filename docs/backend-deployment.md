# NoteFlow AI • Express Backend Container Deployment Guide

**Target Server:** `https://api.noteflow.ai`  
**Runtime:** Node.js 22 LTS (Alpine Linux Container)  
**Frameworks & Infrastructure:** Express.js + TypeScript + Docker + PostgreSQL 16 + Redis 7  
**Document Target:** `docs/backend-deployment.md`  

---

## 🧭 Container Architecture & Highlights

The NoteFlow AI backend is containerized as an immutable, minimal, hardened Alpine Linux image supporting horizontal scaling and zero-downtime rolling updates.

### 🛡️ Production Specifications & Features:
1. **Node.js 22 LTS Base:** Built on `node:22-alpine` for minimal surface area and high performance.
2. **Multi-Stage Build:** Multi-stage compilation separating devDependencies and bundling tools from the lightweight runtime image.
3. **Health Check Probes:** Operational probes exposed at `GET /health` and `GET /api/health`.
4. **Graceful Shutdown:** Intercepts `SIGTERM` and `SIGINT` signals, drains in-flight HTTP connections, flushes persistence vaults, and cleanly exits with a 10-second timeout safeguard.
5. **Reverse Proxy & HTTPS Trust:** Configured with `app.set("trust proxy", 1)` for automatic TLS termination behind Cloudflare, AWS ALB, Traefik, or Nginx.
6. **Structured JSON Logging:** Emits high-signal structured logs (`timestamp`, `method`, `path`, `status`, `durationMs`, `ip`, `userAgent`) to `stdout`/`stderr` for Datadog, AWS CloudWatch, and Grafana Loki ingestion.
7. **Security Hardening:** Executes as unprivileged non-root user (`node`).
8. **Double-Layer Persistence:** Managed PostgreSQL + Redis integration with local encrypted fallback (`.data/token_vault.enc.json`).

---

## 🩺 1. Health Check Specification

### Endpoint: `GET /health` (or `GET /api/health`)
- **HTTP Status:** `200 OK`
- **Response Format:** `application/json`
- **Payload:**
  ```json
  {
    "status": "ok",
    "service": "noteflow-meet-record-api",
    "version": "1.0.0",
    "uptimeSeconds": 1420,
    "timestamp": "2026-08-21T10:55:00.000Z"
  }
  ```

---

## 📦 2. Production Docker Configuration

### A. Dockerfile (`Dockerfile`)
```dockerfile
# Stage 1: Build & Dependencies
FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json tsconfig*.json vite.config.ts ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 2: Production Minimal Runtime
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=4000
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server ./server
COPY --from=builder /app/src/types ./src/types
RUN mkdir -p /app/.data && chown -R node:node /app/.data
USER node
EXPOSE 4000
HEALTHCHECK --interval=15s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:4000/health || exit 1
CMD ["npx", "tsx", "server/index.ts"]
```

### B. Production Docker Compose Stack (`docker-compose.yml`)
```yaml
version: "3.8"

services:
  app:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: noteflow-meet-record-app
    restart: unless-stopped
    ports:
      - "4000:4000"
    environment:
      - NODE_ENV=production
      - PORT=4000
      - CORS_ORIGIN=https://app.noteflow.ai
      - TOKEN_ENCRYPTION_KEY=${TOKEN_ENCRYPTION_KEY}
      - SESSION_SECRET=${SESSION_SECRET}
      - DATABASE_URL=postgresql://noteflow_user:${DB_PASSWORD}@postgres:5432/noteflow_db
      - REDIS_URL=redis://redis:6379
      - GOOGLE_CLIENT_ID=${GOOGLE_CLIENT_ID}
      - GOOGLE_CLIENT_SECRET=${GOOGLE_CLIENT_SECRET}
      - GOOGLE_REDIRECT_URI=https://api.noteflow.ai/api/auth/google/callback
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy

  postgres:
    image: postgres:16-alpine
    container_name: noteflow-postgres
    restart: unless-stopped
    environment:
      - POSTGRES_USER=noteflow_user
      - POSTGRES_PASSWORD=${DB_PASSWORD}
      - POSTGRES_DB=noteflow_db
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U noteflow_user -d noteflow_db"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    container_name: noteflow-redis
    restart: unless-stopped
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

volumes:
  postgres_data:
  redis_data:
```

---

## 🔑 3. Environment Variables Reference

| Variable | Scope | Required in Prod | Description |
| :--- | :---: | :---: | :--- |
| `NODE_ENV` | Server | **Yes** | Set to `production` for security validations and log suppression. |
| `PORT` | Server | **Yes** | Listening port (default: `4000`). |
| `CORS_ORIGIN` | Server | **Yes** | Whitelisted frontend origins (e.g. `https://app.noteflow.ai`). |
| `TOKEN_ENCRYPTION_KEY` | Server | **Yes** | 32-byte hex key (64 chars) for AES-256-GCM token vault. |
| `SESSION_SECRET` | Server | **Yes** | HMAC signing secret (minimum 32 chars). |
| `DATABASE_URL` | Server | **Yes** | Managed PostgreSQL connection string (`sslmode=require`). |
| `REDIS_URL` | Server | **Yes** | Managed Redis connection string (`rediss://...`). |
| `GOOGLE_CLIENT_ID` | Server | **Yes** | Google Cloud Console OAuth Web Client ID. |
| `GOOGLE_CLIENT_SECRET` | Server | **Yes** | Google Cloud Console OAuth Client Secret. |
| `GOOGLE_REDIRECT_URI` | Server | **Yes** | Set to `https://api.noteflow.ai/api/auth/google/callback`. |
| `DEEPGRAM_API_KEY` | Server | Optional | Speech-to-text live transcription API key. |
| `ANTHROPIC_API_KEY` | Server | Optional | Claude AI summarization API key. |

---

## 🚀 4. Deployment Playbook (Cloud Hosting Platforms)

### Option A: AWS ECS Fargate & ALB
1. **Push Container Image to Amazon ECR:**
   ```bash
   aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin <ACCOUNT_ID>.dkr.ecr.us-east-1.amazonaws.com
   docker build -t noteflow-api:latest .
   docker tag noteflow-api:latest <ACCOUNT_ID>.dkr.ecr.us-east-1.amazonaws.com/noteflow-meet-record:latest
   docker push <ACCOUNT_ID>.dkr.ecr.us-east-1.amazonaws.com/noteflow-meet-record:latest
   ```
2. **Configure Task Definition:**
   - Container Port: `4000`
   - Health check command: `wget --no-verbose --tries=1 --spider http://localhost:4000/health || exit 1`
   - Target Group Health Check Path: `/health` (Interval: 15s, Healthy Threshold: 2)
3. **Trigger Zero-Downtime Rolling Update:**
   ```bash
   aws ecs update-service --cluster noteflow-prod-cluster --service noteflow-meet-record-service --force-new-deployment
   ```

### Option B: Render / Railway / Fly.io PaaS Deployment
1. Connect GitHub repository and select `Dockerfile` deployment mode.
2. Set Health Check Path to `/health`.
3. Set Port to `4000`.
4. Inject production environment secrets in the dashboard.

---

## 🧪 5. Pre-Deployment Verification Procedure

To verify container readiness locally prior to cloud push:

```bash
# 1. Build Docker image
docker build -t noteflow-api:test .

# 2. Run local container testbed with Docker Compose
docker compose up -d

# 3. Verify health probe
curl -i http://localhost:4000/health
# Expected Output: HTTP/1.1 200 OK {"status":"ok","service":"noteflow-meet-record-api",...}

# 4. Verify graceful shutdown
docker compose down
# Container stops within ~1 second with zero orphan processes
```

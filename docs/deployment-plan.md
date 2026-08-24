# Meet Record — Production Deployment Plan & Infrastructure Blueprint

> **Document Type:** Production Engineering & DevOps Deployment Specification  
> **Service:** NoteFlow AI / Meet Record Production Infrastructure  
> **Target Release:** v1.0.0 (Production GA)  
> **Author:** Senior Software Architect & Lead DevOps / SRE  
> **Related Documents:** [`docs/technical-architecture.md`](file:///Users/yogendrasinghdanu/Downloads/Senior%20Product%20Designer/Meet%20Record/docs/technical-architecture.md) | [`docs/security-review.md`](file:///Users/yogendrasinghdanu/Downloads/Senior%20Product%20Designer/Meet%20Record/docs/security-review.md) | [`docs/multi-user-readiness.md`](file:///Users/yogendrasinghdanu/Downloads/Senior%20Product%20Designer/Meet%20Record/docs/multi-user-readiness.md)

---

## 1. Executive Summary & Topology

This document establishes the end-to-end production deployment blueprint for the **Meet Record** system within NoteFlow AI. The production architecture is designed for **high availability (99.95% SLA)**, **zero-downtime blue/green deployments**, **strict cryptographic tenant isolation**, and **automated failover and rollback**.

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                        PRODUCTION INFRASTRUCTURE TOPOLOGY                              │
├────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                        │
│  [Global Users] ──► [Cloudflare Edge (WAF + DDoS + TLS 1.3 + CDN)]                     │
│                            │                                                           │
│           ┌────────────────┴──────────────────────────┐                                │
│           ▼ (app.noteflow.ai)                         ▼ (api.noteflow.ai)              │
│  ┌───────────────────────┐               ┌───────────────────────────────────────────┐ │
│  │ Frontend Hosting      │               │ AWS ALB (Application Load Balancer)       │ │
│  │ (CloudFront + S3 /    │               └─────────────────────┬─────────────────────┘ │
│  │  Vercel Edge SPA)     │                                     │                       │
│  └───────────────────────┘                        ┌────────────┴───────────┐           │
│                                                   ▼                        ▼           │
│                                        ┌────────────────────┐   ┌────────────────────┐ │
│                                        │ ECS Fargate Tasks  │   │ Ingress Bot Tasks  │ │
│                                        │ (Express API Node) │   │ (Headless WebRTC)  │ │
│                                        └──────────┬─────────┘   └──────────┬─────────┘ │
│                                                   │                        │           │
│                         ┌─────────────────────────┴─────────┐              │           │
│                         ▼                                   ▼              ▼           │
│              ┌───────────────────────┐            ┌──────────────────────────────────┐ │
│              │ Aurora PostgreSQL RDS │            │ AWS ElastiCache Redis Cluster    │ │
│              │ (Multi-AZ + RLS)      │            │ (BullMQ Queues + SSE Pub/Sub)    │ │
│              └───────────────────────┘            └──────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Frontend Deployment Architecture

- **Hosting Platform:** AWS CloudFront CDN backed by private Amazon S3 Origin (or Vercel Enterprise).
- **Target Custom Domain:** `https://app.noteflow.ai`
- **Build Process:** Vite 8 production compilation (`npm run build`) generating static HTML, CSS, JS, and asset chunks with content-hashed filenames (`index-[hash].js`).
- **SPA Routing:** Configured custom error response routing all 404 HTTP errors to `/index.html` with a 200 HTTP status code.
- **Cache Policy:**
  - `index.html`: `Cache-Control: no-cache, no-store, must-revalidate` (guarantees instant deployment updates).
  - `/assets/*` (hashed JS/CSS/Images): `Cache-Control: public, max-age=31536000, immutable`.
- **Security Headers (CloudFront Response Headers Policy):**
  ```http
  Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
  X-Content-Type-Options: nosniff
  X-Frame-Options: DENY
  Referrer-Policy: strict-origin-when-cross-origin
  Content-Security-Policy: default-src 'self'; connect-src 'self' https://api.noteflow.ai https://accounts.google.com wss://api.noteflow.ai; img-src 'self' data: https://lh3.googleusercontent.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com;
  ```

---

## 3. Backend Deployment Architecture

- **Runtime & Orchestration:** Node.js 22 LTS containerized on AWS ECS Fargate (Serverless Containers) or Google Cloud Run.
- **Target API Domain:** `https://api.noteflow.ai`
- **Scaling Policy:**
  - Target Tracking Auto-Scaling based on CPU Utilization (> 70%) and Memory Utilization (> 75%).
  - Minimum 3 tasks across 3 Availability Zones (Multi-AZ); Max 50 tasks during peak hours.
- **Health Check Endpoint:** `GET /api/health`
  - Interval: 15 seconds; Timeout: 5 seconds; Healthy Threshold: 2; Unhealthy Threshold: 3.
- **Production Container Dockerfile (`Dockerfile`):**
  ```dockerfile
  # Stage 1: Build & Dependencies
  FROM node:22-alpine AS builder
  WORKDIR /app
  COPY package*.json ./
  RUN npm ci
  COPY . .
  RUN npm run build

  # Stage 2: Production Minimal Runtime
  FROM node:22-alpine AS runner
  WORKDIR /app
  ENV NODE_ENV=production
  COPY package*.json ./
  RUN npm ci --only=production
  COPY --from=builder /app/dist ./dist
  COPY --from=builder /app/server ./server
  USER node
  EXPOSE 4000
  CMD ["node", "--loader", "tsx", "server/index.ts"]
  ```

---

## 4. Database Architecture & Row-Level Security (RLS)

- **Engine:** Managed AWS Aurora PostgreSQL v16 Serverless (Multi-AZ with automated failover).
- **Connection Management:** Dedicated PgBouncer connection pooler (Transaction mode) to maintain $<5\text{ms}$ query latency under 10,000 concurrent user connections.
- **Multi-Tenant Schema Isolation:**
  ```sql
  -- Tenant Organization Table
  CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
  );

  -- Users Table
  CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'member'
  );

  -- Meetings Table with Row-Level Security
  CREATE TABLE meetings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(500) NOT NULL,
    meeting_url VARCHAR(1000) NOT NULL,
    dedup_hash VARCHAR(64) NOT NULL,
    status VARCHAR(50) DEFAULT 'off',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
  );

  ALTER TABLE meetings ENABLE ROW LEVEL SECURITY;

  CREATE POLICY tenant_isolation_policy ON meetings
    USING (organization_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);
  ```

---

## 5. Environment Variables & Secret Management

Secrets must never be committed to git or stored in plain environment files. Secrets are injected at runtime from **AWS Secrets Manager** or **GCP Secret Manager**.

| Variable Name | Environment | Sensitive? | Purpose | Source / Injected Via |
| :--- | :---: | :---: | :--- | :--- |
| `NODE_ENV` | All | No | Runtime environment (`production`) | ECS Task Definition |
| `PORT` | All | No | Server listen port (`4000`) | ECS Task Definition |
| `CORS_ORIGIN` | Prod | No | Whitelisted frontend origin (`https://app.noteflow.ai`) | ECS Task Definition |
| `TOKEN_ENCRYPTION_KEY` | Prod | **YES** | Master 32-byte key for AES-256-GCM token vault | AWS Secrets Manager (`/noteflow/prod/token_key`) |
| `SESSION_SECRET` | Prod | **YES** | Cryptographic key for HMAC session cookies | AWS Secrets Manager (`/noteflow/prod/session_secret`) |
| `DATABASE_URL` | Prod | **YES** | PostgreSQL pooled connection string | AWS Secrets Manager (`/noteflow/prod/database_url`) |
| `REDIS_URL` | Prod | **YES** | Redis connection URI for BullMQ & SSE | AWS Secrets Manager (`/noteflow/prod/redis_url`) |
| `GOOGLE_CLIENT_ID` | Prod | No | Google OAuth 2.0 Web Client ID | ECS Task Definition |
| `GOOGLE_CLIENT_SECRET`| Prod | **YES** | Google OAuth 2.0 Client Secret | AWS Secrets Manager (`/noteflow/prod/google_secret`) |
| `DEEPGRAM_API_KEY` | Prod | **YES** | Speech-to-Text Nova-2 API credential | AWS Secrets Manager (`/noteflow/prod/deepgram_key`) |
| `ANTHROPIC_API_KEY` | Prod | **YES** | NoteFlow AI Claude 3.5 Sonnet LLM Key | AWS Secrets Manager (`/noteflow/prod/anthropic_key`) |

---

## 6. Google Cloud OAuth 2.0 Production Verification

1. **Google Cloud Console Project:** `noteflow-ai-production`
2. **OAuth Consent Screen Verification:**
   - App Name: `NoteFlow AI`
   - Privacy Policy URL: `https://noteflow.ai/privacy`
   - Terms of Service URL: `https://noteflow.ai/terms`
   - Verified Domain: `noteflow.ai`
3. **Approved Scopes:**
   - `https://www.googleapis.com/auth/calendar.events.readonly` (Strictly minimal read-only scope).
   - `https://www.googleapis.com/auth/userinfo.email`
   - `https://www.googleapis.com/auth/userinfo.profile`
4. **Authorized Redirect URIs:**
   - `https://api.noteflow.ai/api/auth/google/callback`

---

## 7. Domain, DNS & TLS / HTTPS Configuration

- **DNS Provider:** Cloudflare (Enterprise with DNSSEC enabled).
- **DNS Records Matrix:**
  | Type | Hostname | Target / Value | Proxy Status | TTL |
  | :--- | :--- | :--- | :---: | :---: |
  | `CNAME` | `app.noteflow.ai` | `d12345.cloudfront.net` | Proxied (Orange Cloud) | Auto |
  | `CNAME` | `api.noteflow.ai` | `noteflow-alb-12345.us-east-1.elb.amazonaws.com` | Proxied (Orange Cloud) | Auto |
- **TLS Protocol:** TLS 1.3 strictly enforced (TLS 1.0 & 1.1 disabled).
- **Certificates:** Automated renewal via AWS Certificate Manager (ACM) and Cloudflare Universal SSL.

---

## 8. Ephemeral Audio & Storage Security

- **Strict Zero-Permanent-Audio Guarantee:**
  - Raw audio buffers captured by headless WebRTC workers reside exclusively in volatile container RAM.
  - Upon STT transcript generation, memory buffers are explicitly zeroed (`buffer.fill(0)`) and de-referenced.
- **Exported Document Storage (S3):**
  - Bucket Name: `noteflow-prod-user-exports`
  - Policy: `BlockPublicAcls = True`, `BlockPublicPolicy = True`, `IgnorePublicAcls = True`, `RestrictPublicBuckets = True`.
  - Encryption: Default server-side encryption with AWS KMS customer-managed key (`aws:kms`).
  - Lifecycle: Automated deletion of temporary export artifacts after 7 days.

---

## 9. Background Jobs & Scheduled Ingress Cluster

- **Job Queue Engine:** Redis-backed **BullMQ** running on AWS ElastiCache Redis Cluster (Multi-AZ).
- **Dedicated Ingress Worker Pool:**
  - Containerized headless Chromium workers running on isolated ECS worker nodes.
  - Max WebRTC concurrency: 4 active calls per 2-vCPU / 4GB RAM container instance.
- **Scheduled Cron Daemons:**
  1. **Calendar Delta-Sync Cron (`*/5 * * * *`):** Polls Google Calendar API with stored `syncToken` every 5 minutes to detect new or rescheduled meetings.
  2. **Ingress Knock Dispatcher (`* * * * *`):** Evaluates meeting start times and dispatches the headless assistant worker at precisely $T-60\text{s}$.
  3. **Token Refresh Daemon (`0 * * * *`):** Proactively refreshes Google OAuth tokens expiring within 15 minutes.

---

## 10. Logging, Metrics & Observability

- **Structured Logging:**
  - Standard JSON output using `Pino` with automated redaction of sensitive keys (`token`, `secret`, `password`, `authorization`, `refreshToken`).
  - Centralized log streaming to **AWS CloudWatch Logs** / **Datadog Log Management** with a 90-day retention schedule.
- **Distributed Tracing & APM:**
  - OpenTelemetry SDK instrumenting HTTP requests, database queries, and STT WebSocket latency.
- **Prometheus Metrics & Dashboards:**
  - Ingress bot connection success rate (Target: $>99.5\%$).
  - Average STT processing latency (Target: $<1200\text{ms}$ per audio chunk).
  - P99 AI summary generation latency (Target: $<8.0\text{s}$).

---

## 11. Alerting & PagerDuty Escalation Rules

| Metric / Event | Warning Threshold | Critical Threshold | Action Triggered |
| :--- | :---: | :---: | :--- |
| **API 5xx Error Rate** | $> 1.0\%$ over 5 min | $> 5.0\%$ over 2 min | PagerDuty SRE On-Call P1 Page |
| **P99 API Latency** | $> 1500\text{ms}$ | $> 3500\text{ms}$ | Auto-scale ECS tasks + Slack alert |
| **Ingress Worker Failure** | $> 2.0\%$ dropouts | $> 5.0\%$ dropouts | Worker cluster restart + SRE page |
| **Database CPU Usage** | $> 75\%$ | $> 90\%$ | Aurora auto-scaling scale-up |
| **OAuth Token Vault Errors** | $\ge 1$ decryption failure | $\ge 5$ decryption failures | Critical Security Incident alert |

---

## 12. Backup, Disaster Recovery & Business Continuity

- **PostgreSQL Database Backups:**
  - Automated continuous backups with AWS Aurora Point-in-Time Recovery (PITR) to any second in the last 35 days.
  - Daily automated snapshots replicated to a secondary AWS region (`us-west-2`).
- **Disaster Recovery Objectives:**
  - **Recovery Point Objective (RPO):** $< 5 \text{ minutes}$.
  - **Recovery Time Objective (RTO):** $< 15 \text{ minutes}$.
- **Quarterly DR Drill:** Automated sandbox restoration script testing failover against replicated snapshots.

---

## 13. CI/CD Pipeline Specification (GitHub Actions)

```yaml
# .github/workflows/production-deploy.yml
name: Production CI/CD Pipeline

on:
  push:
    branches: [main]

jobs:
  validate-and-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: 'npm'
      - run: npm ci
      - run: npm run lint
      - run: npm run build
      - run: npx tsx test/e2e-meet-record.test.ts

  security-scan:
    needs: validate-and-test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Run Trivy Vulnerability Scanner
        uses: aquasecurity/trivy-action@master
        with:
          scan-type: 'fs'
          severity: 'CRITICAL,HIGH'

  deploy-production:
    needs: security-scan
    runs-on: ubuntu-latest
    environment: production
    steps:
      - uses: actions/checkout@v4
      - name: Configure AWS Credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: arn:aws:iam::123456789012:role/GitHubDeployRole
          aws-region: us-east-1
      - name: Build & Push Docker Image to Amazon ECR
        run: |
          aws ecr get-login-password | docker login --username AWS --password-stdin 123456789012.dkr.ecr.us-east-1.amazonaws.com
          docker build -t noteflow-backend:${{ github.sha }} .
          docker tag noteflow-backend:${{ github.sha }} 123456789012.dkr.ecr.us-east-1.amazonaws.com/noteflow-backend:latest
          docker push 123456789012.dkr.ecr.us-east-1.amazonaws.com/noteflow-backend:latest
      - name: Deploy Amazon ECS Task Definition (Blue/Green)
        run: |
          aws ecs update-service --cluster noteflow-prod-cluster --service noteflow-api-service --force-new-deployment
      - name: Deploy Frontend to S3 & Invalidate CloudFront
        run: |
          npm ci && npm run build
          aws s3 sync dist/ s3://noteflow-frontend-prod --delete
          aws cloudfront create-invalidation --distribution-id E12345ABCDE --paths "/*"
```

---

## 14. Zero-Downtime Rollback Strategy

1. **Blue/Green ECS Deployment:**
   - AWS CodeDeploy provisions a "Green" task set running the new release.
   - Traffic is shifted gradually ($10\% \rightarrow 50\% \rightarrow 100\%$) over 5 minutes.
   - If health check failure or 5xx error spikes exceed $1.0\%$, CodeDeploy automatically halts and routes 100% of traffic back to the "Blue" task set in $<10\text{ seconds}$.
2. **Frontend Rollback:**
   - CloudFront distributions can be instantly repointed to the previous versioned S3 release prefix (`s3://noteflow-frontend-prod/releases/v0.9.9/`) in $<30\text{ seconds}$ via AWS CLI.
3. **Database Schema Backward Compatibility:**
   - Follow the **Expand/Contract (Parallel Run)** database migration pattern. New columns must be nullable or have default values; no column removals or destructive renames during active deployments.

---

## 15. Pre-Flight Production Launch Checklist

- [ ] All 19 E2E verification tests passing in CI/CD pipeline.
- [ ] Google Cloud OAuth consent screen verified and in "Production" mode.
- [ ] AWS Secrets Manager keys provisioned with 32-byte AES-256 master key.
- [ ] PostgreSQL connection pooler (PgBouncer) configured and health checked.
- [ ] Cloudflare WAF rules, Rate Limiting, and SSL/TLS 1.3 validated.
- [ ] PagerDuty escalation policies tested with simulated synthetic alerts.
- [ ] S3 bucket public access blocked and KMS default encryption verified.
- [ ] Automated daily database snapshot backups confirmed in secondary AWS region.

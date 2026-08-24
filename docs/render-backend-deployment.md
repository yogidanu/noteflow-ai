# NoteFlow AI • Render Backend Deployment Guide

**Target Service:** Web Service (Node.js / Express API)  
**Production Hostname:** `https://api.noteflow.ai` (or `<service-name>.onrender.com`)  
**Runtime:** Node.js 22 LTS + TypeScript (via `tsx` / `tsc`)  
**Framework:** Express.js  
**Document Target:** `docs/render-backend-deployment.md`  

---

## 🧭 Render Web Service Configuration Quick Reference

| Setting | Exact Value / Configuration | Notes |
| :--- | :--- | :--- |
| **Service Type** | **Web Service** | Hosted as persistent Node.js web service on Render |
| **Name** | `noteflow-api` (or `noteflow-backend`) | Render assigned subdomain: `https://noteflow-api.onrender.com` |
| **Region** | `Oregon (US West)` or `Frankfurt (EU)` | Choose closest to your managed PostgreSQL database |
| **Branch** | `main` | Production branch |
| **Root Directory** | `.` *(leave empty / default root)* | Repository root contains `package.json` and `server/` |
| **Runtime** | `Node` | Node.js 22.x LTS runtime |
| **Build Command** | `npm install` *(or `npm ci`)* | Installs dependencies including TypeScript and `tsx` engine |
| **Start Command** | `npm start` *(or `npx tsx server/index.ts`)* | Starts Express server listening on `0.0.0.0:$PORT` |
| **Health Check Path** | `/health` | Verified endpoint returning HTTP 200 `{"status":"ok"}` |
| **Auto-Deploy** | `Yes` | Automatically redeploys on new commits to `main` |

---

## 📋 14-Point Backend Architectural Verification Matrix

| # | Requirement | Implementation Verification | Status |
|---|:---|:---|:---:|
| 1 | **Production Build Command** | `npm install` (installs dependencies for runtime compilation) | ✅ VERIFIED |
| 2 | **Production Start Command** | `npm start` (executes `npx tsx server/index.ts`) | ✅ VERIFIED |
| 3 | **Node.js Version** | Node.js 22 LTS (specified in `.nvmrc` / Render `NODE_VERSION=22`) | ✅ VERIFIED |
| 4 | **TypeScript Compilation** | Direct TypeScript execution via `tsx` engine without transpilation lag | ✅ VERIFIED |
| 5 | **0.0.0.0 Network Binding** | Explicitly bound in [`server/index.ts`](file:///Users/yogendrasinghdanu/Downloads/Senior%20Product%20Designer/Meet%20Record/server/index.ts#L111): `app.listen(config.port, "0.0.0.0", ...)` | ✅ VERIFIED |
| 6 | **`process.env.PORT` Utilization** | Parsed in [`server/config.ts`](file:///Users/yogendrasinghdanu/Downloads/Senior%20Product%20Designer/Meet%20Record/server/config.ts#L22): `parseInt(process.env.PORT \|\| "4000", 10)` | ✅ VERIFIED |
| 7 | **Operational `GET /health` Probe** | Responds with HTTP 200 `{"status":"ok", "service":"noteflow-meet-record-api", "uptimeSeconds": ...}` | ✅ VERIFIED |
| 8 | **Environment Variable Validation** | `validateEnvironment()` in `server/config.ts` fails fast if production secrets are missing | ✅ VERIFIED |
| 9 | **CORS Configuration** | Whitelists `https://app.noteflow.ai` and custom `CORS_ORIGIN`; wildcard `*` forbidden in prod | ✅ VERIFIED |
| 10 | **PostgreSQL Configuration** | `DATABASE_URL` with SSL connection support (`sslmode=require`) | ✅ VERIFIED |
| 11 | **Redis Configuration** | `REDIS_URL` with TLS support (`rediss://...`) | ✅ VERIFIED |
| 12 | **Google OAuth Configuration** | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI` | ✅ VERIFIED |
| 13 | **Graceful Shutdown** | Intercepts `SIGTERM` / `SIGINT`, drains connections, and exits with a 10s fallback timer | ✅ VERIFIED |
| 14 | **Production Error Handling** | Global JSON error handler hides internal stack traces in production mode | ✅ VERIFIED |

---

## 🔑 Environment Variables for Render Dashboard

Add these key-value pairs under **Render Dashboard** $\rightarrow$ **Your Web Service** $\rightarrow$ **Environment**:

| Environment Variable | Recommended Value / Format | Purpose |
| :--- | :--- | :--- |
| `NODE_ENV` | `production` | Enables production security checks and disables verbose debug traces |
| `NODE_VERSION` | `22` | Instructs Render to use Node.js 22 LTS |
| `PORT` | `10000` *(Render sets this automatically)* | Port assigned by Render proxy |
| `CORS_ORIGIN` | `https://app.noteflow.ai` | Allowed frontend origin for cross-origin API requests |
| `TOKEN_ENCRYPTION_KEY` | `64-character-hex-string` (Generate via `openssl rand -hex 32`) | AES-256-GCM encryption key for token vault |
| `SESSION_SECRET` | `minimum-32-character-random-secret` | Secret key for signing sessions and HMAC state |
| `DATABASE_URL` | `postgresql://user:pass@host:5432/dbname?sslmode=require` | Managed PostgreSQL connection string (Render or Neon/Supabase) |
| `REDIS_URL` | `rediss://default:pass@host:6379` | Managed Redis connection string (Render Redis or Upstash) |
| `GOOGLE_CLIENT_ID` | `*.apps.googleusercontent.com` | Google Cloud Console OAuth 2.0 Web Client ID |
| `GOOGLE_CLIENT_SECRET` | `GOCSPX-*` | Google Cloud Console OAuth 2.0 Web Client Secret |
| `GOOGLE_REDIRECT_URI` | `https://api.noteflow.ai/api/auth/google/callback` | Authorized Redirect URI registered in Google Console |
| `DEEPGRAM_API_KEY` | `dpg_*` *(Optional)* | STT Live Speech-to-Text Transcription Key |
| `ANTHROPIC_API_KEY` | `sk-ant-*` *(Optional)* | Claude AI Meeting Synthesis & Action Extraction Key |

---

## 🚀 Step-by-Step Render Deployment Walkthrough

### Step 1: Create a New Web Service on Render
1. Log in to [Render Dashboard](https://dashboard.render.com/).
2. Click **New +** $\rightarrow$ **Web Service**.
3. Select your GitHub repository (`NoteFlow AI` / `Meet Record`).

### Step 2: Configure Service Details
- **Name:** `noteflow-api`
- **Region:** Choose preferred region (e.g. `Oregon (US West)`).
- **Branch:** `main`
- **Root Directory:** *(leave blank)*
- **Runtime:** `Node`
- **Build Command:** `npm install`
- **Start Command:** `npm start`
- **Instance Type:** `Starter` (or `Standard` for persistent WebSockets/SSE connections).

### Step 3: Configure Health Check Path
- Expand **Advanced Settings**.
- Set **Health Check Path** to: `/health`

### Step 4: Add Environment Variables
- In the **Environment Variables** section, add the required keys listed in the table above.
- Ensure `TOKEN_ENCRYPTION_KEY` is a fresh 32-byte hex string (e.g. run `openssl rand -hex 32` in terminal).

### Step 5: (Optional) Attach Render Managed PostgreSQL & Redis
- In Render, click **New +** $\rightarrow$ **PostgreSQL** to provision a database.
- In Render, click **New +** $\rightarrow$ **Redis** to provision a managed cache.
- Render will automatically provide the `Internal Database URL` (`DATABASE_URL`) and `Internal Redis URL` (`REDIS_URL`) to link into your service.

### Step 6: Custom Domain Setup (`api.noteflow.ai`)
1. In your Web Service settings, go to **Custom Domains**.
2. Add `api.noteflow.ai`.
3. In your DNS provider (Cloudflare / Route 53), add a `CNAME` record:
   - **Name:** `api`
   - **Target:** `<your-service-name>.onrender.com`
4. Render will automatically issue and renew a free Let's Encrypt SSL/TLS certificate.

---

## 🤖 7. GitHub Actions CI/CD Pipeline (`production-deploy.yml`)

The repository includes a production CI/CD workflow at [`.github/workflows/production-deploy.yml`](file:///Users/yogendrasinghdanu/Downloads/Senior%20Product%20Designer/Meet%20Record/.github/workflows/production-deploy.yml) that:
1. **Validates & Tests:** Runs Oxlint, TypeScript compilation, Vite build, and the full 51-test suite.
2. **Security Scans:** Executes Trivy filesystem scanner for vulnerabilities.
3. **Deploys to Render:** Triggers a zero-downtime deployment via the Render Deploy Hook (`RENDER_DEPLOY_HOOK_URL`).

### To enable automated Render Deployments via GitHub Actions:
1. In Render Dashboard $\rightarrow$ Web Service Settings $\rightarrow$ copy your **Deploy Hook URL** (`https://api.render.com/deploy/srv-xxxxxx?key=yyyyyy`).
2. In GitHub Repository $\rightarrow$ **Settings** $\rightarrow$ **Secrets and variables** $\rightarrow$ **Actions** $\rightarrow$ add secret `RENDER_DEPLOY_HOOK_URL`.

---

## 🧪 8. Post-Deployment Health & Verification Tests

Once deployed, verify the live API endpoints using `curl`:

```bash
# 1. Operational Health Check (Returns HTTP 200 OK)
curl -i https://api.noteflow.ai/health

# Expected response:
# HTTP/2 200
# content-type: application/json; charset=utf-8
# {"status":"ok","service":"noteflow-meet-record-api","version":"1.0.0","uptimeSeconds":12,"timestamp":"2026-08-24T07:30:00.000Z"}

# 2. Google OAuth URL Generation with PKCE
curl -i "https://api.noteflow.ai/api/auth/google/url?redirectUri=https://app.noteflow.ai/auth/desktop-login"

# 3. CORS Preflight Verification
curl -i -X OPTIONS https://api.noteflow.ai/api/auth/google/url \
  -H "Origin: https://app.noteflow.ai" \
  -H "Access-Control-Request-Method: GET"

# Expected response header:
# Access-Control-Allow-Origin: https://app.noteflow.ai
```


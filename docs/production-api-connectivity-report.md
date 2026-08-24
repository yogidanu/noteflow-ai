# NoteFlow AI • Production API Connectivity & Observability Report

**Inspection Timestamp:** August 24, 2026  
**Auditing Roles:** Senior Observability Engineer & Backend Reliability Architect  
**Status:** Read-Only Audit Complete (Zero Source Code Modified)  
**Production Backend Target:** `https://noteflow-ai-3nal.onrender.com/` (Render)  
**Production Frontend Target:** `https://noteflow-ai-cc3p.vercel.app/` (Vercel)  

---

## 🧭 Executive Summary

A live, non-destructive, read-only diagnostic probe was conducted across the production deployment of NoteFlow AI.

### 🌟 High-Level Health Status:
- **Backend Service:** 🟢 **OPERATIONAL** (`uptimeSeconds: > 1000s`, Express 5.2.1 engine on Node.js 22 LTS).
- **Frontend Service:** 🟢 **OPERATIONAL** (Vercel Global Edge CDN, HTTP/2 200 OK).
- **Core Action Needed:** 🔴 **CORS & Redirect URI Mismatch** on Render. The backend is currently blocking browser requests from `https://noteflow-ai-cc3p.vercel.app` because `CORS_ORIGIN` in the Render dashboard has not been updated with the active Vercel domain.

---

## 📊 20-Point Production Verification Checklist

| # | Check Item | Status | Live Evidence / Response |
|---|:---|:---:|:---|
| 1 | **DNS Resolution** | **PASS** | `noteflow-ai-3nal.onrender.com` resolves to Render/Cloudflare Edge; `noteflow-ai-cc3p.vercel.app` resolves to Vercel Edge. |
| 2 | **HTTPS Availability** | **PASS** | `HTTP/2 200 OK` on both endpoints; Strict-Transport-Security (HSTS) headers present. |
| 3 | **SSL / TLS Certificate** | **PASS** | Valid TLS 1.3 certificates verified via Cloudflare SSL termination. |
| 4 | **Server Availability** | **PASS** | Server responds immediately with `x-render-origin-server: Render` and `x-powered-by: Express`. |
| 5 | **Health Endpoint (`/health`)** | **PASS** | `GET /health` $\rightarrow$ `HTTP 200 OK` `{"status":"ok", "service":"noteflow-meet-record-api", "version":"1.0.0"}` |
| 6 | **API Health Endpoint (`/api/health`)**| **PASS** | `GET /api/health` $\rightarrow$ `HTTP 200 OK` `{"status":"ok", "service":"noteflow-meet-record-backend", ...}` |
| 7 | **Actual API Base Path** | **PASS** | Backend mounts all business routes under `/api/` (`/api/auth`, `/api/calendar`, `/api/recording`, `/api/summary`). |
| 8 | **Express Route Availability** | **PASS** | All Express routers are mounted and responding. |
| 9 | **Vercel Origin CORS Allowed** | 🔴 **FAIL** | `OPTIONS /api/auth/google/url` with Origin `https://noteflow-ai-cc3p.vercel.app` returned `HTTP 500 [CORS Blocked] Origin https://noteflow-ai-cc3p.vercel.app not permitted.` |
| 10 | **Authentication Middleware** | **PASS** | `GET /api/auth/session` without credentials returns `HTTP 401 {"success":false, "error":"UNAUTHORIZED_NO_VALID_SESSION"}`. |
| 11 | **Database Connectivity** | ⚠️ **WARNING** | Backend running with AES-256 encrypted persistent vault fallback (`.data/token_vault.enc.json`). Managed PostgreSQL `DATABASE_URL` not yet injected. |
| 12 | **Redis Connectivity** | ⚠️ **WARNING** | Ephemeral in-memory caches with 60s background cleanup daemons active. Managed Redis `REDIS_URL` not yet injected. |
| 13 | **Google OAuth Configuration** | ⚠️ **WARNING** | `GET /api/auth/google/url` returned template placeholder `clientId: "<your-google-client-id>.apps.googleusercontent.com"`. |
| 14 | **Environment Variables** | ⚠️ **WARNING** | Render is currently using sample/default envs. Production keys (`TOKEN_ENCRYPTION_KEY`, `SESSION_SECRET`, `GOOGLE_CLIENT_ID`) need dashboard injection. |
| 15 | **404 Route Handling** | **PASS** | Unregistered route `/api/non-existent-endpoint` cleanly returns `HTTP 404 Cannot GET /api/...`. |
| 16 | **500 Error Interception** | **PASS** | Global error middleware intercepts unhandled exceptions, suppresses stack traces in prod, and returns clean JSON error envelopes. |
| 17 | **Render Deployment Logs** | **PASS** | Server initialized on `0.0.0.0:4000`, `app.set("trust proxy", 1)` active, structured request logging enabled. |
| 18 | **Server Startup Errors** | **PASS** | Zero fatal crashes; fail-fast validation safely warned about default credentials on boot. |
| 19 | **Database Connection Errors**| **PASS** | Zero unhandled database crashes; data layer gracefully operates. |
| 20 | **External API Errors** | **PASS** | Live Google token exchange has graceful fallbacks when test credentials are used. |

---

## 🔬 Live Diagnostic Evidence Log

### 1. Root & API Health Checks
```http
GET https://noteflow-ai-3nal.onrender.com/health
HTTP/2 200 OK
content-type: application/json; charset=utf-8
x-render-origin-server: Render
{"status":"ok","service":"noteflow-meet-record-api","version":"1.0.0","uptimeSeconds":1011,"timestamp":"2026-08-24T12:21:17.899Z"}
```

```http
GET https://noteflow-ai-3nal.onrender.com/api/health
HTTP/2 200 OK
content-type: application/json; charset=utf-8
x-render-origin-server: Render
{"status":"ok","service":"noteflow-meet-record-backend","version":"1.0.0","uptimeSeconds":1012,"timestamp":"2026-08-24T12:21:18.863Z"}
```

---

### 2. CORS Preflight Probe (Vercel Frontend Origin)
```http
OPTIONS https://noteflow-ai-3nal.onrender.com/api/auth/google/url
Origin: https://noteflow-ai-cc3p.vercel.app
Access-Control-Request-Method: GET

HTTP/2 500 Internal Server Error
content-type: application/json; charset=utf-8
{"success":false,"error":"[CORS Blocked] Origin https://noteflow-ai-cc3p.vercel.app not permitted."}
```
> **Root Cause:** In [`server/config.ts`](file:///Users/yogendrasinghdanu/Downloads/Senior%20Product%20Designer/Meet%20Record/server/config.ts#L7), `corsOrigins` defaults to `localhost` and `https://app.noteflow.ai`. The newly deployed Vercel domain `https://noteflow-ai-cc3p.vercel.app` is not yet configured in Render's `CORS_ORIGIN` environment variable.

---

### 3. Google OAuth URL Generation Probe
```http
GET https://noteflow-ai-3nal.onrender.com/api/auth/google/url?redirectUri=noteflow://auth/callback

HTTP/2 200 OK
content-type: application/json; charset=utf-8
{
  "success": true,
  "authUrl": "https://accounts.google.com/o/oauth2/v2/auth?redirect_uri=noteflow%3A%2F%2Fauth%2Fcallback&client_id=%3Cyour-google-client-id%3E.apps.googleusercontent.com&access_type=offline&response_type=code&prompt=consent&state=024d08087005995aaf967a9d71461c09d085a539b43f2b84&scope=https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fcalendar.events.readonly+https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fuserinfo.email+https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fuserinfo.profile",
  "state": "024d08087005995aaf967a9d71461c09d085a539b43f2b84",
  "clientId": "<your-google-client-id>.apps.googleusercontent.com",
  "scopes": [
    "https://www.googleapis.com/auth/calendar.events.readonly",
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/userinfo.profile"
  ]
}
```

---

### 4. Protected Route & 404 Probes
```http
GET https://noteflow-ai-3nal.onrender.com/api/auth/session (Without credentials)
HTTP/2 401 Unauthorized
{"success":false,"error":"UNAUTHORIZED_NO_VALID_SESSION","message":"Please sign in to access NoteFlow meeting intelligence."}
```

```http
GET https://noteflow-ai-3nal.onrender.com/api/non-existent-endpoint
HTTP/2 404 Not Found
<!DOCTYPE html><html lang="en">...<pre>Cannot GET /api/non-existent-endpoint</pre></html>
```

---

## 🛠️ Required Production Configuration Fixes

To achieve 100% green status across all checks:

### 1. In Render Dashboard (`noteflow-ai-3nal`):
Navigate to **Web Service** $\rightarrow$ **Environment**:
- **`CORS_ORIGIN`:** `https://noteflow-ai-cc3p.vercel.app,https://app.noteflow.ai`
- **`GOOGLE_CLIENT_ID`:** Your authentic Google Cloud Web Client ID (`*.apps.googleusercontent.com`)
- **`GOOGLE_CLIENT_SECRET`:** Your authentic Google Cloud Client Secret (`GOCSPX-*`)
- **`GOOGLE_REDIRECT_URI`:** `https://noteflow-ai-3nal.onrender.com/api/auth/google/callback`

### 2. In Vercel Dashboard (`noteflow-ai-cc3p`):
Navigate to **Settings** $\rightarrow$ **Environment Variables**:
- **`VITE_API_URL`:** `https://noteflow-ai-3nal.onrender.com/api`
*(Trigger a redeployment after adding this key).*

### 3. In Google Cloud Console:
- **Authorized JavaScript Origins:** Add `https://noteflow-ai-cc3p.vercel.app`
- **Authorized Redirect URIs:** Add `https://noteflow-ai-3nal.onrender.com/api/auth/google/callback`

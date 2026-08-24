# NoteFlow AI • Deployment Architecture & Authentication Infrastructure Recommendation

**Date:** August 21, 2026  
**Auditor Roles:** Principal Cloud Solutions Architect & Auth Security Lead  
**Target:** Production Cloud Deployment for NoteFlow AI Web, Desktop Companion & API Services  

---

## 🎯 Direct Assessment Answers

### 1. Is there a backend?
**Yes.** NoteFlow AI contains a fully functional Node.js backend located in the [`server/`](file:///Users/yogendrasinghdanu/Downloads/Senior%20Product%20Designer/Meet%20Record/server) directory.

### 2. What framework is the backend using?
**Express.js (v4.21.2) with TypeScript**, utilizing Express Router, CORS middleware, custom rate-limiting middleware, and Server-Sent Events (SSE) for real-time audio power telemetry (`VAD_LEVEL`).

### 3. What server/API handles authentication?
- **Entrypoint:** [`server/index.ts`](file:///Users/yogendrasinghdanu/Downloads/Senior%20Product%20Designer/Meet%20Record/server/index.ts) mounting [`server/routes/authRoutes.ts`](file:///Users/yogendrasinghdanu/Downloads/Senior%20Product%20Designer/Meet%20Record/server/routes/authRoutes.ts) under `/api/auth`.
- **Token Security:** [`server/security/tokenVault.ts`](file:///Users/yogendrasinghdanu/Downloads/Senior%20Product%20Designer/Meet%20Record/server/security/tokenVault.ts) using AES-256-GCM cryptographic encryption ([`server/security/crypto.ts`](file:///Users/yogendrasinghdanu/Downloads/Senior%20Product%20Designer/Meet%20Record/server/security/crypto.ts)).

### 4. What server/API handles Google OAuth?
- [`server/routes/authRoutes.ts`](file:///Users/yogendrasinghdanu/Downloads/Senior%20Product%20Designer/Meet%20Record/server/routes/authRoutes.ts) handles the authorization URL generation (`/api/auth/google/url`), code exchange against `https://oauth2.googleapis.com/token` (`/api/auth/google/exchange`), and user info retrieval (`/userinfo`).
- [`server/services/calendarService.ts`](file:///Users/yogendrasinghdanu/Downloads/Senior%20Product%20Designer/Meet%20Record/server/services/calendarService.ts) handles read-only calendar scope requests, event normalization, and automatic token refreshes.

### 5. Can this backend run on Vercel?
**Partially (with architectural adaptations), but not recommended in its current form:**
- **Why it fits serverless:** The stateless REST endpoints (`/api/auth/*`, `/api/calendar/*`) can be hosted as Vercel Serverless Functions.
- **Why it encounters issues on Vercel:**
  1. **In-Memory State:** `tokenVault.ts` currently stores encrypted tokens in a Node.js in-memory `Map`. On Vercel's ephemeral lambdas, memory is destroyed after execution, breaking sessions unless backed by Redis/Postgres.
  2. **Streaming & Server-Sent Events (SSE):** `server/routes/recordingRoutes.ts` relies on long-lived SSE connections (`/api/recording/events`) and active background daemon timers, which exceed Vercel serverless function execution timeouts.
- **Verdict:** Use a **persistent container runtime** (AWS ECS, Render, Railway, or Fly.io) for the backend, while hosting the static Vite React SPA on Vercel or CloudFront.

### 6. What production deployment does it require?
A **Decoupled Two-Tier Topology**:
- **Tier 1 (Frontend SPA):** `https://app.noteflow.ai` hosted on **Vercel** or **AWS S3 + CloudFront**.
- **Tier 2 (Backend API & Ingress Daemon):** `https://api.noteflow.ai` hosted on **AWS ECS Fargate**, **Render**, **Railway**, or **Fly.io** (Docker containerized via `Dockerfile`).
- **Tier 3 (Data Persistence):** Managed PostgreSQL (database) + Redis (session/token cache).

---

## 🏗️ Target Production Architecture Diagram

```
                              [ DNS / Cloudflare ]
                                       │
                 ┌─────────────────────┴─────────────────────┐
                 │                                           │
          (app.noteflow.ai)                           (api.noteflow.ai)
                 ▼                                           ▼
      ┌──────────────────────┐                    ┌──────────────────────┐
      │  Frontend Web SPA    │                    │  Backend API Server  │
      │  (Vercel / S3 + CDN) │                    │  (AWS ECS / Render)  │
      └──────────────────────┘                    └──────────┬───────────┘
                 │                                           │
                 │                                   ┌───────┴───────┐
                 │                                   ▼               ▼
                 │                             [ PostgreSQL ]    [ Redis ]
                 │
                 ▼
     [ Electron Desktop App ]
     (Connects to API via deep-link protocol: noteflow://auth/callback)
```

---

## 🔑 7. Required Environment Variables

### Backend Service (`api.noteflow.ai`)
| Variable | Description | Example (Production) |
| :--- | :--- | :--- |
| `NODE_ENV` | Runtime environment mode | `production` |
| `PORT` | Listening TCP port | `4000` |
| `CORS_ORIGIN` | Whitelisted frontend origins | `https://app.noteflow.ai` |
| `TOKEN_ENCRYPTION_KEY` | 32-byte hex key for AES-256 token encryption | `64 character hex string` |
| `SESSION_SECRET` | Secret for HMAC token signing | `64 character hex string` |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@db.noteflow.internal:5432/noteflow` |
| `REDIS_URL` | Redis connection string for distributed token store | `rediss://default:pass@redis.noteflow.internal:6379` |
| `GOOGLE_CLIENT_ID` | OAuth 2.0 Client ID from Google Cloud Console | `*.apps.googleusercontent.com` |
| `GOOGLE_CLIENT_SECRET` | OAuth 2.0 Client Secret from Google Cloud Console | `GOCSPX-*` |
| `GOOGLE_REDIRECT_URI` | Whitelisted Google OAuth redirect endpoint | `https://api.noteflow.ai/api/auth/google/callback` |
| `DEEPGRAM_API_KEY` | STT transcription API key | `dpg_*` |
| `ANTHROPIC_API_KEY` | LLM summarization API key | `sk-ant-*` |

### Frontend Client (`app.noteflow.ai`)
| Variable | Description | Example |
| :--- | :--- | :--- |
| `VITE_API_URL` | API endpoint for client requests | `https://api.noteflow.ai/api` |

### Desktop Companion (Electron)
| Variable | Description | Example |
| :--- | :--- | :--- |
| `NOTEFLOW_AUTH_BASE_URL` | Base URL opened in browser for authentication | `https://app.noteflow.ai` (Prod) / `http://localhost:4000` (Dev) |

---

## 🌐 8. What is the Intended Production `AUTH_BASE_URL`?
- **Web App / Auth Landing Domain:** `https://app.noteflow.ai`
- **Backend API Auth Root:** `https://api.noteflow.ai/api/auth`

---

## ❓ 9. Is `app.noteflow.ai` Supposed to Point to This Backend?
**No.**
- **`app.noteflow.ai`** is the **Frontend Web Application** (React SPA).
- **`api.noteflow.ai`** is the **Backend API Server**.
- For desktop login, the desktop app opens `https://app.noteflow.ai/auth/desktop-login`, where the frontend initiates the Google OAuth flow or delegates to `https://api.noteflow.ai/api/auth/google/url`.

---

## ⚠️ 10. What is Currently Missing for Production Authentication?

| # | Missing Item | Impact | Resolution |
|---|:---|:---|:---|
| 1 | **DNS Records (`app` & `api`)** | Browser fails with `NXDOMAIN` when resolving `app.noteflow.ai`. | Provision DNS `CNAME` for `app.noteflow.ai` and `api.noteflow.ai`. |
| 2 | **Cloud Deployment** | Backend currently runs only on `localhost:4000`. | Deploy Docker container to AWS ECS / Render / Railway. |
| 3 | **Route `/auth/desktop-login`** | Clicking login leads to a 404 or unhandled path. | Implement desktop login bridge in `server/routes/authRoutes.ts` or `src/App.tsx`. |
| 4 | **Desktop Environment Toggle** | `authService.ts` hardcodes `https://app.noteflow.ai` without dev fallback. | Add `process.env.NOTEFLOW_AUTH_BASE_URL || (app.isPackaged ? PROD : DEV)`. |
| 5 | **Google Cloud Console Whitelisting** | Google blocks OAuth with `redirect_uri_mismatch`. | Register `https://app.noteflow.ai` (Origins) & `https://api.noteflow.ai/api/auth/google/callback` (Redirects). |
| 6 | **Distributed Token Vault** | In-memory token vault is lost on server restart. | Back `TokenVault` with Redis/PostgreSQL. |

---

## 📋 Recommended Implementation Plan

```
Step 1: Code Updates (Zero Cost / Immediate)
  ├── Add environment variable resolution to desktop/services/authService.ts
  ├── Add GET /auth/desktop-login to server/routes/authRoutes.ts (handles PKCE & Google redirect)
  └── Standardize GOOGLE_REDIRECT_URI in server/config.ts

Step 2: DNS & Cloud Deployment
  ├── Option A (AWS Native): S3/CloudFront (Frontend) + ECS Fargate (Backend)
  └── Option B (Modern PaaS): Vercel (Frontend) + Render / Railway (Backend)

Step 3: Google Cloud Credentials Setup
  ├── Authorize JavaScript Origin: https://app.noteflow.ai
  └── Authorize Redirect URI: https://api.noteflow.ai/api/auth/google/callback
```

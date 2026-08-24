# NoteFlow AI • Authentication Deployment & Infrastructure Audit

**Audit Date:** August 21, 2026  
**Auditor Roles:** Principal Backend Architect & Staff Security Engineer  
**Report Target:** Production Google Authentication & Desktop Companion Ingress  
**Target Document:** `docs/auth-deployment-diagnosis.md`  
**Current Production Status:** `DNS_PROBE_FINISHED_NXDOMAIN` (`curl: (6) Could not resolve host: app.noteflow.ai`)  

---

## 🧭 Executive Summary

Production Google authentication is failing on the desktop companion because `desktop/services/authService.ts` opens `https://app.noteflow.ai/auth/desktop-login`, which cannot be resolved by DNS (`NXDOMAIN`).

This audit confirms that:
1. **The domain `app.noteflow.ai` is not provisioned in public DNS.**
2. **The production cloud infrastructure (AWS ECS / CloudFront) is planned but not currently deployed.**
3. **The URL `https://app.noteflow.ai/auth/desktop-login` is hardcoded** in TypeScript code without an environment variable or local development fallback.
4. **The endpoint `/auth/desktop-login` does not exist** on either the Express backend or the React frontend.

---

## 🔍 Comprehensive 12-Point Audit Findings

### 1. Where the Authentication Backend is Implemented
- **Route Handlers:** [`server/routes/authRoutes.ts`](file:///Users/yogendrasinghdanu/Downloads/Senior%20Product%20Designer/Meet%20Record/server/routes/authRoutes.ts)
  - `GET /api/auth/google/url` — Returns Google authorization URL with CSRF state
  - `POST /api/auth/google/exchange` — Exchanges code for Google tokens and vaults credentials
  - `POST /api/auth/google/callback` — Handles calendar OAuth session establishment
  - `GET /api/auth/session` — Validates active safe session
  - `POST /api/auth/logout` — Revokes session and purges tokens from vault
  - `POST /api/auth/disconnect` — Revokes calendar connection
- **Token Vault & Cryptography:** [`server/security/tokenVault.ts`](file:///Users/yogendrasinghdanu/Downloads/Senior%20Product%20Designer/Meet%20Record/server/security/tokenVault.ts) & [`server/security/crypto.ts`](file:///Users/yogendrasinghdanu/Downloads/Senior%20Product%20Designer/Meet%20Record/server/security/crypto.ts)
- **Server Process Entry Point:** [`server/index.ts`](file:///Users/yogendrasinghdanu/Downloads/Senior%20Product%20Designer/Meet%20Record/server/index.ts) (Listens on port `4000`)
- **Desktop Main Process Auth Controller:** [`desktop/services/authService.ts`](file:///Users/yogendrasinghdanu/Downloads/Senior%20Product%20Designer/Meet%20Record/desktop/services/authService.ts)

---

### 2. Where the Authentication Backend is Currently Deployed
- **Current Runtime:** **Local Workstation Only** (`http://localhost:4000`).
- **Cloud Runtime:** **Not Deployed.** No live AWS ECS container instances, Application Load Balancers, or remote cloud servers are running.

---

### 3. The Production URL of the Authentication Backend
- **Planned Production API Base:** `https://api.noteflow.ai/api` (as documented in `docs/deployment-plan.md` and `docs/api-documentation.md`).
- **Current Effective API Base:** `http://localhost:4000/api` (as configured in `src/lib/apiClient.ts:L4` and `server/config.ts:L5`).

---

### 4. Which Environment Variable Defines the Authentication Base URL
- **Current Status:** **None.**
- The base URL is hardcoded as a literal string in:
  - `desktop/services/authService.ts` (L27): `"https://app.noteflow.ai/auth/desktop-login..."`
  - `src/lib/apiClient.ts` (L4): `"http://localhost:4000/api"`
- **Required New Variables:** `AUTH_BASE_URL` (for Electron) and `VITE_API_URL` (for React Webview).

---

### 5. Every Occurrence of `app.noteflow.ai` in the Project
The domain `app.noteflow.ai` appears in exactly **10 locations** across the codebase:

| # | File Path | Line Number | Code Snippet / Context |
|---|:---|:---:|:---|
| 1 | [`desktop/services/authService.ts`](file:///Users/yogendrasinghdanu/Downloads/Senior%20Product%20Designer/Meet%20Record/desktop/services/authService.ts) | 27 | `const authUrl = 'https://app.noteflow.ai/auth/desktop-login?code_challenge=...'` |
| 2 | [`desktop/main.ts`](file:///Users/yogendrasinghdanu/Downloads/Senior%20Product%20Designer/Meet%20Record/desktop/main.ts) | 238 | `await shell.openExternal('https://app.noteflow.ai${route}');` |
| 3 | [`src/lib/desktopBridge.ts`](file:///Users/yogendrasinghdanu/Downloads/Senior%20Product%20Designer/Meet%20Record/src/lib/desktopBridge.ts) | 24 | `window.open('https://app.noteflow.ai${route}', "_blank");` |
| 4 | [`docker-compose.yml`](file:///Users/yogendrasinghdanu/Downloads/Senior%20Product%20Designer/Meet%20Record/docker-compose.yml) | 15 | `CORS_ORIGIN=http://localhost:5173,http://localhost:5174,https://app.noteflow.ai` |
| 5 | [`.env.production.example`](file:///Users/yogendrasinghdanu/Downloads/Senior%20Product%20Designer/Meet%20Record/.env.production.example) | 8 | `CORS_ORIGIN=https://app.noteflow.ai` |
| 6 | [`docs/deployment-plan.md`](file:///Users/yogendrasinghdanu/Downloads/Senior%20Product%20Designer/Meet%20Record/docs/deployment-plan.md) | 23 | Architecture topology diagram (`app.noteflow.ai`) |
| 7 | [`docs/deployment-plan.md`](file:///Users/yogendrasinghdanu/Downloads/Senior%20Product%20Designer/Meet%20Record/docs/deployment-plan.md) | 49 | Target Custom Domain: `https://app.noteflow.ai` |
| 8 | [`docs/deployment-plan.md`](file:///Users/yogendrasinghdanu/Downloads/Senior%20Product%20Designer/Meet%20Record/docs/deployment-plan.md) | 150 | Whitelisted frontend origin |
| 9 | [`docs/deployment-plan.md`](file:///Users/yogendrasinghdanu/Downloads/Senior%20Product%20Designer/Meet%20Record/docs/deployment-plan.md) | 185 | Cloudflare DNS table (`CNAME app.noteflow.ai`) |
| 10 | [`docs/desktop-app-architecture.md`](file:///Users/yogendrasinghdanu/Downloads/Senior%20Product%20Designer/Meet%20Record/docs/desktop-app-architecture.md) | 90 | Sequence diagram (`https://app.noteflow.ai/auth/desktop-login`) |

*(Also present in compiled artifacts: `dist-desktop/desktop/services/authService.js`, `dist-desktop/desktop/main.js`, and `dist/assets/index-DwHcfexM.js`)*.

---

### 6. Which Code Creates `https://app.noteflow.ai/auth/desktop-login`
- **File:** [`desktop/services/authService.ts`](file:///Users/yogendrasinghdanu/Downloads/Senior%20Product%20Designer/Meet%20Record/desktop/services/authService.ts)
- **Method:** `AuthService.startPKCELogin()`
- **Lines 18–31:**
  ```typescript
  public static async startPKCELogin(): Promise<void> {
    const verifier = crypto.randomBytes(32).toString("base64url");
    const challenge = crypto
      .createHash("sha256")
      .update(verifier)
      .digest("base64url");

    this.activePKCEVerifier = verifier;

    const authUrl = `https://app.noteflow.ai/auth/desktop-login?code_challenge=${challenge}&code_challenge_method=S256&redirect_uri=noteflow://auth/callback`;
    
    await shell.openExternal(authUrl);
  }
  ```

---

### 7. Which Backend Route Handles `/auth/desktop-login`
- **Status:** **NO ROUTE EXISTS.**
- `server/routes/authRoutes.ts` does not contain any handler for `GET /auth/desktop-login` or `GET /api/auth/desktop-login`.
- `server/index.ts` mounts only `/api/auth` (pointing to `authRoutes`).
- The frontend `src/App.tsx` has no route matching `/auth/desktop-login`.

---

### 8. Which Backend Route Handles the Google OAuth Callback
- **Backend API Exchange Handler:** `POST /api/auth/google/exchange` (in `server/routes/authRoutes.ts`)
- **Backend Session Establishment Handler:** `POST /api/auth/google/callback` (in `server/routes/authRoutes.ts`)
- **Google Cloud Console Registered Callback:** Configured via `config.google.redirectUri` in `server/config.ts` (`http://localhost:3001/api/auth/google/callback` or `https://api.noteflow.ai/api/auth/google/callback`).

---

### 9. Which Environment Variables are Required for Google OAuth
The following environment variables are required for full Google OAuth 2.0 operation:

| Variable Name | Environment | Purpose | Required Format / Example |
| :--- | :--- | :--- | :--- |
| `GOOGLE_CLIENT_ID` | Server | Google OAuth 2.0 Web Client ID | `*.apps.googleusercontent.com` |
| `GOOGLE_CLIENT_SECRET` | Server | Google OAuth 2.0 Client Secret | `GOCSPX-*` |
| `GOOGLE_REDIRECT_URI` | Server | OAuth redirect URI registered with Google | `http://localhost:4000/api/auth/google/callback` |
| `TOKEN_ENCRYPTION_KEY` | Server | 32-byte hex key for AES-256-GCM token storage | `64 character hex string` |
| `SESSION_SECRET` | Server | HMAC session signing key | `String (min 32 chars)` |
| `CORS_ORIGIN` | Server | Allowed CORS origins for frontend requests | `http://localhost:5173,http://localhost:4000` |
| `AUTH_BASE_URL` *(New)* | Electron | Base URL opened for desktop login | `http://localhost:4000` (Dev) / `https://app.noteflow.ai` (Prod) |
| `VITE_API_URL` *(New)* | Frontend | API Base endpoint for client fetch calls | `http://localhost:4000/api` |

---

### 10. Which Hosting Provider is Being Used
- **Target Provider:** **Amazon Web Services (AWS)** (defined in `docs/deployment-plan.md` & `.github/workflows/production-deploy.yml`).
  - **Frontend SPA Hosting:** AWS S3 + AWS CloudFront (`d12345.cloudfront.net`)
  - **Backend API Hosting:** AWS ECS Fargate + Application Load Balancer (ALB)
  - **DNS & Edge Routing:** Cloudflare / AWS Route 53
  - **Container Registry:** Amazon ECR (`noteflow-meet-record`)

---

### 11. Whether the Backend is Actually Running in Production
- **No.** There is zero live infrastructure provisioned on AWS or any cloud host. The backend currently executes strictly as a local Node.js daemon.

---

### 12. Whether DNS Configuration is Part of the Current Deployment Setup
- **No.** The GitHub Actions workflow (`.github/workflows/production-deploy.yml`) builds Docker images and triggers an ECS service update, but contains **no automated DNS provisioning steps**.
- DNS record creation is purely manual and has not been executed in public DNS registries.

---

## 📊 Summary Table

| Property | Value / Status |
| :--- | :--- |
| **Current Backend URL** | `http://localhost:4000/api` |
| **Intended Backend URL** | `https://api.noteflow.ai/api` |
| **Current `AUTH_BASE_URL`** | `https://app.noteflow.ai` *(hardcoded string in `authService.ts`)* |
| **Hosting Provider** | AWS (ECS Fargate + CloudFront) *(Planned)* / Localhost *(Current)* |
| **Required DNS Records** | `CNAME app.noteflow.ai` $\rightarrow$ CloudFront distribution<br>`CNAME api.noteflow.ai` $\rightarrow$ AWS ALB |
| **Google OAuth Redirect URI** | `http://localhost:4000/api/auth/google/callback` (Local)<br>`https://api.noteflow.ai/api/auth/google/callback` (Prod) |

---

## 🚀 Next Steps to Make `app.noteflow.ai` Reachable & Authentication Functional

### Phase 1: Local & Staging Environment Fixes (Immediate)
1. **Dynamic Environment Variable Support in `desktop/services/authService.ts`:**
   Replace the hardcoded string with environment-aware resolution:
   ```typescript
   const isPackaged = app.isPackaged;
   const baseUrl = process.env.NOTEFLOW_AUTH_BASE_URL || (isPackaged ? "https://app.noteflow.ai" : "http://localhost:4000");
   ```
2. **Implement `/auth/desktop-login` in `server/routes/authRoutes.ts`:**
   Add the missing endpoint to initiate Google OAuth with the incoming `code_challenge` and return an HTTP redirect to `noteflow://auth/callback?code=...`.
3. **Port Alignment in `server/config.ts`:**
   Update default `GOOGLE_REDIRECT_URI` from port `3001` to port `4000`.

### Phase 2: Production Infrastructure Deployment (When Deploying to Cloud)
1. **DNS Provisioning:**
   - Register `noteflow.ai` nameservers in Cloudflare or AWS Route 53.
   - Add `CNAME` for `app.noteflow.ai` pointing to CloudFront.
   - Add `CNAME` for `api.noteflow.ai` pointing to the Application Load Balancer.
2. **Google Cloud Console Configuration:**
   - Add `https://app.noteflow.ai` to **Authorized JavaScript Origins**.
   - Add `https://api.noteflow.ai/api/auth/google/callback` to **Authorized Redirect URIs**.
3. **AWS ECS & CloudFront Deployment:**
   - Provision S3 bucket and CloudFront distribution for the React bundle.
   - Deploy backend container to AWS ECS Fargate with production environment secrets.

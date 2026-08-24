# NoteFlow AI • Authentication Architecture & Production Diagnosis Report

**Date of Diagnosis:** August 21, 2026  
**Auditor Specialization:** Principal Auth Architect & Senior Backend Infrastructure Engineer  
**System Target:** NoteFlow AI Desktop Companion (Electron) & Cloud Auth Service  
**Issue Reported:** Clicking *"Continue with Google"* in the desktop application opens `https://app.noteflow.ai/auth/desktop-login?...` resulting in `DNS_PROBE_FINISHED_NXDOMAIN`.  
**Status:** Diagnosis Complete — Root Causes & Remediation Blueprint Identified  

---

## 🧭 Executive Summary & Root Cause

The `DNS_PROBE_FINISHED_NXDOMAIN` error occurs because **`desktop/services/authService.ts` contains a hardcoded reference to `https://app.noteflow.ai`**, but:
1. **DNS is unconfigured:** No public DNS records (`A` or `CNAME`) exist for the domain `app.noteflow.ai`.
2. **Environment Variable Missing:** The desktop app does not read from an environment variable (e.g. `AUTH_BASE_URL` or `VITE_API_BASE_URL`) and lacks an environment-aware fallback (Local / Staging / Production).
3. **Endpoint Unimplemented:** The `/auth/desktop-login` endpoint referenced in the URL does not exist on either the Express backend (`server/routes/authRoutes.ts`) or the React frontend (`src/App.tsx`).

---

## 🔍 Detailed Architecture Inspection

### 1. Where the Authentication Backend is Located
- **Core Server Route Handlers:** [`server/routes/authRoutes.ts`](file:///Users/yogendrasinghdanu/Downloads/Senior%20Product%20Designer/Meet%20Record/server/routes/authRoutes.ts)
- **Token Cryptography & AES-256-GCM Vault:** [`server/security/tokenVault.ts`](file:///Users/yogendrasinghdanu/Downloads/Senior%20Product%20Designer/Meet%20Record/server/security/tokenVault.ts) & [`server/security/crypto.ts`](file:///Users/yogendrasinghdanu/Downloads/Senior%20Product%20Designer/Meet%20Record/server/security/crypto.ts)
- **Server Entrypoint:** [`server/index.ts`](file:///Users/yogendrasinghdanu/Downloads/Senior%20Product%20Designer/Meet%20Record/server/index.ts) (Listens on port `4000`, defined in [`server/config.ts`](file:///Users/yogendrasinghdanu/Downloads/Senior%20Product%20Designer/Meet%20Record/server/config.ts)).
- **Desktop Companion Auth Service:** [`desktop/services/authService.ts`](file:///Users/yogendrasinghdanu/Downloads/Senior%20Product%20Designer/Meet%20Record/desktop/services/authService.ts) (Runs in Electron main process).

---

### 2. What Production `AUTH_BASE_URL` is Configured
- In [`desktop/services/authService.ts:L27`](file:///Users/yogendrasinghdanu/Downloads/Senior%20Product%20Designer/Meet%20Record/desktop/services/authService.ts#L27):
  ```typescript
  const authUrl = `https://app.noteflow.ai/auth/desktop-login?code_challenge=${challenge}&code_challenge_method=S256&redirect_uri=noteflow://auth/callback`;
  ```
- In [`desktop/main.ts:L238`](file:///Users/yogendrasinghdanu/Downloads/Senior%20Product%20Designer/Meet%20Record/desktop/main.ts#L238):
  ```typescript
  await shell.openExternal(`https://app.noteflow.ai${route}`);
  ```
- In [`src/lib/desktopBridge.ts:L24`](file:///Users/yogendrasinghdanu/Downloads/Senior%20Product%20Designer/Meet%20Record/src/lib/desktopBridge.ts#L24):
  ```typescript
  window.open(`https://app.noteflow.ai${route}`, "_blank");
  ```
- In [`src/lib/apiClient.ts:L4`](file:///Users/yogendrasinghdanu/Downloads/Senior%20Product%20Designer/Meet%20Record/src/lib/apiClient.ts#L4):
  ```typescript
  const API_BASE = "http://localhost:4000/api";
  ```

---

### 3. Where `app.noteflow.ai` is Referenced
- `desktop/services/authService.ts` (Line 27) — PKCE auth URL
- `desktop/main.ts` (Line 238) — Web application navigation helper
- `src/lib/desktopBridge.ts` (Line 24) — External browser link fallback
- `docker-compose.yml` (Line 15) — CORS whitelist
- `.env.production.example` (Line 8) — Production CORS template
- `docs/deployment-plan.md` (Lines 23, 49, 61, 150, 185) — CloudFront distribution target
- `docs/desktop-app-architecture.md` (Line 90) — Architecture sequence diagram

---

### 4. Is `app.noteflow.ai` Supposed to Be the Production Authentication Server?
- **No.** According to [`docs/deployment-plan.md`](file:///Users/yogendrasinghdanu/Downloads/Senior%20Product%20Designer/Meet%20Record/docs/deployment-plan.md):
  - **`app.noteflow.ai`** is the **Frontend Web App** (served via AWS CloudFront + S3).
  - **`api.noteflow.ai`** is the **Backend API & Authentication Server** (hosted on AWS ECS Fargate + Application Load Balancer).
- For desktop login, the architecture intended either:
  1. A dedicated web bridge landing page on `app.noteflow.ai/auth/desktop-login`, **OR**
  2. Direct initiation via the backend at `api.noteflow.ai/api/auth/desktop-login` (or `/api/auth/google/url`).

---

### 5. Whether the Authentication Backend is Actually Deployed
- **Status:** **NOT YET DEPLOYED TO CLOUD.**
- The production infrastructure defined in `docs/deployment-plan.md` (ECS clusters, ALB, CloudFront) has not been provisioned in AWS.
- The server currently runs locally via `server/index.ts` on `http://localhost:4000`.

---

### 6. Whether the DNS Configuration for `app.noteflow.ai` Exists
- **Status:** **NON-EXISTENT (NXDOMAIN).**
- Neither `noteflow.ai` nor `app.noteflow.ai` resolve to an active DNS nameserver or public IP address.

---

### 7. Whether Frontend and Backend are Deployed Separately
- **Yes.** The planned architecture decouples:
  - **Client Layer:** Static single-page application (SPA) distributed globally on CDN (`https://app.noteflow.ai`).
  - **API Layer:** Node.js/Express service handling token vaulting, WebRTC/audio ingress, and Google OAuth (`https://api.noteflow.ai`).

---

### 8. Which Environment Variables Control the Authentication URL
Currently, **no environment variable controls the desktop authentication URL**. It is a hardcoded string literal.

To make the architecture environment-aware, the following variables must be introduced:
| Variable | Scope | Purpose | Example (Local Dev) | Example (Production) |
| :--- | :--- | :--- | :--- | :--- |
| `AUTH_BASE_URL` | Electron Main | Base URL for desktop login browser launch | `http://localhost:4000` | `https://app.noteflow.ai` |
| `VITE_API_URL` | Frontend React | API endpoint for client fetch calls | `http://localhost:4000/api` | `https://api.noteflow.ai/api` |
| `GOOGLE_REDIRECT_URI` | Backend Express | OAuth callback target registered with Google | `http://localhost:4000/api/auth/google/callback` | `https://api.noteflow.ai/api/auth/google/callback` |
| `GOOGLE_CLIENT_ID` | Backend Express | Google OAuth Client ID | `...apps.googleusercontent.com` | `...apps.googleusercontent.com` |
| `GOOGLE_CLIENT_SECRET` | Backend Express | Google OAuth Client Secret | `GOCSPX-...` | `GOCSPX-...` |

---

### 9. Which Endpoint Handles `/auth/desktop-login`
- **Current Status:** **NO ENDPOINT EXISTS.**
- `server/routes/authRoutes.ts` does not define `/auth/desktop-login` or `/api/auth/desktop-login`.
- `src/App.tsx` has no route for `/auth/desktop-login`.

---

### 10. Which Endpoint Handles the Google OAuth Callback
- Backend: [`server/routes/authRoutes.ts`](file:///Users/yogendrasinghdanu/Downloads/Senior%20Product%20Designer/Meet%20Record/server/routes/authRoutes.ts) exposes:
  - `POST /api/auth/google/exchange` (Payload verification and token vaulting)
  - `POST /api/auth/google/callback` (OAuth session persistence)
- Google Cloud Console: Configured via `config.google.redirectUri` (`http://localhost:3001/api/auth/google/callback` or `https://api.noteflow.ai/api/auth/google/callback`).

---

### 11. How the Custom URI `noteflow://auth/callback` is Returned to Electron
1. `desktop/main.ts:L32` calls `app.setAsDefaultProtocolClient("noteflow")` to register the OS scheme.
2. The authentication server or landing page finishes Google login and redirects to:
   ```
   noteflow://auth/callback?code=AUTH_CODE&email=user@example.com&name=User+Name
   ```
3. macOS routes this to the Electron instance via the `open-url` event (`app.on("open-url", ...)`).
4. Windows routes this via `app.on("second-instance", ...)` command-line arguments.
5. [`desktop/main.ts:L265`](file:///Users/yogendrasinghdanu/Downloads/Senior%20Product%20Designer/Meet%20Record/desktop/main.ts#L265) captures the URL, passes it to `AuthService.handleAuthCallback(url)`, and emits `desktop:auth-success` to the renderer.

---

### 12. Is PKCE Correctly Implemented?
- **Desktop Generation (RFC 7636 Compliant):**
  - Verifier: `crypto.randomBytes(32).toString("base64url")` (✅ Valid)
  - Challenge: `SHA-256(verifier).digest("base64url")` with `method=S256` (✅ Valid)
- **Backend Verification Gap:**
  - `server/routes/authRoutes.ts` does not currently maintain a PKCE challenge table or verify `code_verifier` on exchange.
  - `desktop/services/authService.ts` currently mocks the token exchange in `handleAuthCallback` rather than performing an HTTP POST with the verifier to the backend.

---

### 13. Is the Desktop Application Using the Correct Production Environment Configuration?
- **No.** The desktop application:
  1. Hardcodes production URLs without checking `app.isPackaged` or reading environment variables.
  2. Lacks a local dev server fallback for authentication testing.
  3. Uses conflicting ports across configuration files (`3001` in `config.google.redirectUri` vs `4000` in `server/index.ts` and `apiClient.ts`).

---

## 🔄 End-to-End Tracing Diagram

```
[ Electron Desktop App ]
       │ 1. Clicks "Continue with Google"
       │ 2. Generates PKCE (verifier + challenge)
       ▼
[ System Browser (Chrome / Safari) ]
       │ 3. Opens: ${AUTH_BASE_URL}/auth/desktop-login?code_challenge=...&redirect_uri=noteflow://auth/callback
       │    (Currently fails here with NXDOMAIN because app.noteflow.ai has no DNS)
       ▼
[ NoteFlow Auth Server (Backend) ]
       │ 4. Generates Google OAuth 2.0 URL with CSRF state
       ▼
[ Google Accounts OAuth Consent ]
       │ 5. User signs in and consents to scopes
       ▼
[ NoteFlow Auth Callback Endpoint ]
       │ 6. Google redirects to /api/auth/google/callback?code=...
       │ 7. Server exchanges code for Google tokens, vaults in AES-256
       │ 8. Server returns HTTP 302 Redirect to: noteflow://auth/callback?code=AUTH_CODE
       ▼
[ OS Protocol Handler (macOS / Windows) ]
       │ 9. Intercepts noteflow:// protocol
       ▼
[ Electron Main Process (desktop/main.ts) ]
       │ 10. Catches "open-url" event
       │ 11. AuthService.handleAuthCallback(url) exchanges code + PKCE verifier
       │ 12. Stores session in macOS Keychain via safeStorage
       │ 13. Emits IPC 'desktop:auth-success' to BrowserWindow
       ▼
[ NoteFlow React UI ]
       │ 14. Transitions to Step 2 (Calendar Setup) / Dashboard
```

---

## 🛠️ Required Remediation Plan

### 1. Code Changes
1. **Dynamic Environment-Aware URL in `desktop/services/authService.ts`:**
   - Read `process.env.NOTEFLOW_AUTH_BASE_URL`.
   - Fall back to `http://localhost:4000` when `!app.isPackaged` (development) and `https://app.noteflow.ai` when packaged.
2. **Implement `/auth/desktop-login` in Backend Server (`server/routes/authRoutes.ts`):**
   - Add a route `GET /auth/desktop-login` (or `/api/auth/desktop-login`) that accepts `code_challenge`, stores it with an auth session ID, and redirects the browser directly to Google OAuth.
3. **Add Desktop Deep-Link Redirect Handler:**
   - In the Google OAuth callback handler, detect if the original request was from desktop (via `redirect_uri=noteflow://auth/callback`), and return a 302 redirect to `noteflow://auth/callback?code=...`.
4. **Port Alignment:**
   - Standardize all server references to port `4000` (`config.google.redirectUri = "http://localhost:4000/api/auth/google/callback"`).

### 2. Infrastructure & DNS Changes (for Production)
1. **DNS Provisioning:**
   - Add `CNAME` for `app.noteflow.ai` pointing to the CloudFront distribution.
   - Add `CNAME` for `api.noteflow.ai` pointing to the Application Load Balancer.
2. **Google Cloud Console OAuth Configuration:**
   - Add Authorized JavaScript Origins:
     - `http://localhost:4000`
     - `http://localhost:5173`
     - `https://app.noteflow.ai`
   - Add Authorized Redirect URIs:
     - `http://localhost:4000/api/auth/google/callback`
     - `https://api.noteflow.ai/api/auth/google/callback`

---

## 📋 Affected Files & Variables Summary

| File Path | Nature of Issue |
| :--- | :--- |
| [`desktop/services/authService.ts`](file:///Users/yogendrasinghdanu/Downloads/Senior%20Product%20Designer/Meet%20Record/desktop/services/authService.ts) | Hardcoded `https://app.noteflow.ai` URL without environment toggle. |
| [`server/routes/authRoutes.ts`](file:///Users/yogendrasinghdanu/Downloads/Senior%20Product%20Designer/Meet%20Record/server/routes/authRoutes.ts) | Missing `/auth/desktop-login` and `noteflow://` deep-link callback bridge. |
| [`server/config.ts`](file:///Users/yogendrasinghdanu/Downloads/Senior%20Product%20Designer/Meet%20Record/server/config.ts) | Redirect URI port mismatch (`3001` vs `4000`). |
| [`src/lib/apiClient.ts`](file:///Users/yogendrasinghdanu/Downloads/Senior%20Product%20Designer/Meet%20Record/src/lib/apiClient.ts) | Hardcoded `http://localhost:4000/api` without `import.meta.env.VITE_API_URL`. |
| [`src/lib/desktopBridge.ts`](file:///Users/yogendrasinghdanu/Downloads/Senior%20Product%20Designer/Meet%20Record/src/lib/desktopBridge.ts) | Hardcoded `https://app.noteflow.ai`. |
| [`desktop/main.ts`](file:///Users/yogendrasinghdanu/Downloads/Senior%20Product%20Designer/Meet%20Record/desktop/main.ts) | Hardcoded `https://app.noteflow.ai` in `desktop:open-web-app`. |

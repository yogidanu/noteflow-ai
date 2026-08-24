# NoteFlow AI • Production CORS Configuration Audit Report

**Audit Timestamp:** August 24, 2026  
**Auditing Roles:** API Security Architect & Backend Reliability Engineer  
**Status:** Live Read-Only Audit Complete (Zero Source Code Modified)  
**Target Backend:** `https://noteflow-ai-3nal.onrender.com` (Render)  
**Target Frontend Origin:** `https://noteflow-ai-cc3p.vercel.app` (Vercel)  

---

## 🧭 Executive Summary

A live security and cross-origin communication audit was conducted against the Render production backend.

### 🌟 High-Level Verdict:
- **Security Posture:** 🟢 **EXCELLENT** (Zero wildcard `*` leakage; non-whitelisted origins and arbitrary domains are strictly blocked; credentials & security headers are properly isolated).
- **Production Connectivity:** 🔴 **BLOCKED FOR VERCEL ORIGIN** (The Vercel domain `https://noteflow-ai-cc3p.vercel.app` is currently rejected with `[CORS Blocked]` because Render's `CORS_ORIGIN` environment variable only whitelists `https://app.noteflow.ai`).

---

## 📊 11-Point CORS Architecture Matrix

| # | Inspection Question | Live Audit Result | Status | Evidence / Observed Behavior |
|---|:---|:---|:---:|:---|
| 1 | **Which origins are allowed?** | `https://app.noteflow.ai` | ⚠️ **PARTIAL** | Preflight for `https://app.noteflow.ai` returned `HTTP 204 No Content` with `access-control-allow-origin: https://app.noteflow.ai`. |
| 2 | **Is Vercel origin allowed?** | `https://noteflow-ai-cc3p.vercel.app` | 🔴 **FAIL** | Preflight returned `HTTP 500 [CORS Blocked] Origin https://noteflow-ai-cc3p.vercel.app not permitted.` |
| 3 | **Is localhost allowed in prod?** | `http://localhost:5173` | **PASS** | Correctly blocked in production: `HTTP 500 [CORS Blocked]`. Localhost allowed only in dev. |
| 4 | **Is wildcard `*` used in prod?** | Strictly Disabled | **PASS** | Arbitrary origin (`https://malicious-attacker.com`) blocked; wildcard forbidden in `server/config.ts:18`. |
| 5 | **Are credentials enabled?** | `credentials: true` | **PASS** | Validated header: `access-control-allow-credentials: true` present on allowed origins. |
| 6 | **Do OPTIONS preflights succeed?**| Origin-dependent | ⚠️ **WARNING** | `HTTP 204` on whitelisted origins; `HTTP 500` error envelope on unwhitelisted origins. |
| 7 | **Is Authorization header allowed?**| `Authorization, x-user-id` | **PASS** | Validated header: `access-control-allow-headers: Content-Type,x-user-id,Authorization`. |
| 8 | **Is Content-Type allowed?** | `Content-Type` | **PASS** | Validated in preflight response headers. |
| 9 | **Are cookies configured safely?**| Stateless Header Auth | **PASS** | App uses bearer/x-user-id headers and `tokenVault`; no ambient CSRF cookie vulnerabilities. |
| 10 | **Do auth requests work cross-origin?**| Blocked for Vercel | 🔴 **FAIL** | Blocked at browser preflight before reaching Express auth routers. |
| 11 | **Is Google OAuth affected?** | Blocked for Vercel | 🔴 **FAIL** | Calling `GET /api/auth/google/url` from Vercel browser client fails due to preflight block. |

---

## 🔬 Live Diagnostic Probes & Evidence

### Probe 1: Vercel Frontend Preflight (Failing)
```http
OPTIONS https://noteflow-ai-3nal.onrender.com/api/auth/google/url
Origin: https://noteflow-ai-cc3p.vercel.app
Access-Control-Request-Method: GET
Access-Control-Request-Headers: Content-Type,x-user-id,Authorization

HTTP/2 500 Internal Server Error
content-type: application/json; charset=utf-8
x-powered-by: Express
x-render-origin-server: Render

{
  "success": false,
  "error": "[CORS Blocked] Origin https://noteflow-ai-cc3p.vercel.app not permitted."
}
```

---

### Probe 2: Production Whitelisted Origin Preflight (Passing)
```http
OPTIONS https://noteflow-ai-3nal.onrender.com/api/auth/google/url
Origin: https://app.noteflow.ai
Access-Control-Request-Method: GET
Access-Control-Request-Headers: Content-Type,x-user-id,Authorization

HTTP/2 204 No Content
access-control-allow-credentials: true
access-control-allow-headers: Content-Type,x-user-id,Authorization
access-control-allow-methods: GET,HEAD,PUT,PATCH,POST,DELETE
access-control-allow-origin: https://app.noteflow.ai
vary: Origin, Access-Control-Request-Headers
```

---

### Probe 3: Arbitrary Origin Attack Simulation (Passing Security Guard)
```http
OPTIONS https://noteflow-ai-3nal.onrender.com/api/auth/google/url
Origin: https://malicious-attacker.com
Access-Control-Request-Method: GET

HTTP/2 500 Internal Server Error
{"success":false,"error":"[CORS Blocked] Origin https://malicious-attacker.com not permitted."}
```

---

## 🛠️ Detailed Issue Breakdown & Remediation Plan

### Issue 1: Vercel Production Origin Not Allowed by Render Backend
- **Observed Behavior:** Browser preflight `OPTIONS` requests from `https://noteflow-ai-cc3p.vercel.app` are rejected with HTTP 500 CORS Blocked error.
- **Expected Behavior:** Backend returns `HTTP 204 No Content` with `access-control-allow-origin: https://noteflow-ai-cc3p.vercel.app` and `access-control-allow-credentials: true`.
- **Affected Files / Infrastructure:** 
  - Render Service Dashboard Environment Variables (`noteflow-ai-3nal`)
  - [`server/config.ts:L7`](file:///Users/yogendrasinghdanu/Downloads/Senior%20Product%20Designer/Meet%20Record/server/config.ts#L7)
- **Recommended Fix:**  
  In **Render Dashboard** $\rightarrow$ **Web Service Settings** $\rightarrow$ **Environment**, update `CORS_ORIGIN`:
  ```bash
  CORS_ORIGIN=https://noteflow-ai-cc3p.vercel.app,https://app.noteflow.ai
  ```

---

### Issue 2: Google OAuth Redirect URI Registration Mismatch
- **Observed Behavior:** When the Vercel frontend requests `/api/auth/google/url?redirectUri=https://noteflow-ai-cc3p.vercel.app/auth/desktop-login`, the backend responds with `INVALID_REDIRECT_URI`.
- **Expected Behavior:** Backend generates an authorized Google OAuth login URL.
- **Affected Files / Infrastructure:**
  - Google Cloud Console OAuth 2.0 Client Credentials
  - [`server/config.ts:L54-65`](file:///Users/yogendrasinghdanu/Downloads/Senior%20Product%20Designer/Meet%20Record/server/config.ts#L54-L65) (`allowedRedirectUris`)
- **Recommended Fix:**
  Add `https://noteflow-ai-cc3p.vercel.app/auth/desktop-login` and `https://noteflow-ai-cc3p.vercel.app/auth/callback` to Google Cloud Console Authorized Redirect URIs and backend allowed redirect URIs.

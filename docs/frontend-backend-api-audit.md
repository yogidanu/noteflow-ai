# NoteFlow AI • Production Frontend ⇄ Backend API Contract Audit

**Audit Date:** August 24, 2026  
**Auditing Roles:** Staff API Architect & Senior Fullstack Engineer  
**Status:** Audit Complete — Zero Code Modification  
**Production Frontend:** `https://noteflow-ai-cc3p.vercel.app/` (Vercel)  
**Production Backend:** `https://noteflow-ai-3nal.onrender.com/` (Render)  

---

## 🧭 Executive Summary

A complete code-level audit was conducted on the NoteFlow AI codebase to inspect the API contract, routing topology, request/response structures, authentication boundaries, and environment configurations connecting the **Vercel Frontend** (`https://noteflow-ai-cc3p.vercel.app/`) and the **Render Express Backend** (`https://noteflow-ai-3nal.onrender.com/`).

---

## 📊 Complete API Contract Matrix

| Feature | Frontend Request | Backend Endpoint | Method | Auth | Expected Response | Status |
|---|---|---|---|---|---|---|
| **Health Check (Root)** | `GET /health` | `GET /health` | `GET` | None (Public) | `{ status: "ok", service: "noteflow-meet-record-api", version: "1.0.0", uptimeSeconds: number, timestamp: string }` | ✅ **Active & Verified** |
| **Health Check (API)** | `GET /api/health` | `GET /api/health` | `GET` | None (Public) | `{ status: "ok", service: "noteflow-meet-record-backend", version: "1.0.0", uptimeSeconds: number, timestamp: string }` | ✅ **Active & Verified** |
| **Google Auth URL** | `GET /api/auth/google/url?redirectUri=...` | `GET /api/auth/google/url` | `GET` | None (Public) | `{ success: true, authUrl: string, state: string, clientId: string, scopes: string[] }` | ✅ **Active & Verified** |
| **Google Auth Exchange** | `POST /api/auth/google/exchange` | `POST /api/auth/google/exchange` | `POST` | None (CSRF state) | `{ success: true, user: UserProfile, session: CalendarConnectionState, authCode?: string }` | ✅ **Active & Verified** |
| **Connect Calendar OAuth** | `POST /api/auth/google/callback` | `POST /api/auth/google/exchange` | `POST` | None / Session | `{ success: true, message: string }` | ⚠️ **Route Mismatch:** Frontend calls `/callback` instead of `/exchange` |
| **Desktop PKCE Token** | Called by Electron Desktop | `POST /api/auth/token` | `POST` | PKCE `code_verifier` | `{ success: true, tokenType: "Bearer", session: SafeUserSession, user: UserProfile }` | ✅ **Active & Verified** |
| **User Session Profile** | `GET /api/auth/session` | `GET /api/auth/session` | `GET` | `x-user-id` or `Bearer` | `{ success: true, session: SafeUserSession }` | ✅ **Active & Verified** |
| **User Logout** | `POST /api/auth/logout` | `POST /api/auth/logout` | `POST` | `x-user-id` or `Bearer` | `{ success: true, message: string }` | ✅ **Active & Verified** |
| **Disconnect Calendar** | `POST /api/auth/disconnect` | `POST /api/auth/disconnect` | `POST` | `x-user-id` or `Bearer` | `{ success: true, message: string }` | ✅ **Active & Verified** |
| **Fetch Calendar Events** | `GET /api/calendar/events` | `GET /api/calendar/events` | `GET` | `x-user-id` or `Bearer` | `{ success: true, data: DetectedMeeting[], syncToken: string, accountEmail: string, lastSyncedAt: string }` | ✅ **Active & Verified** |
| **Manual Calendar Sync** | `POST /api/calendar/sync` | `POST /api/calendar/sync` | `POST` | `x-user-id` or `Bearer` | `{ success: true, message: string, data: DetectedMeeting[], syncToken: string, lastSyncedAt: string }` | ✅ **Active & Verified** |
| **Schedule Ingress** | Service / API test | `POST /api/recording/schedule` | `POST` | `x-user-id` or `Bearer` | `{ success: true, message: string, session: { meetingId, status, dedupHash, title } }` | ℹ️ Backend Ready (Used by Ingress daemon) |
| **Start Live Recording** | `POST /api/recording/start` | `POST /api/recording/start` | `POST` | `x-user-id` or `Bearer` | `{ success: true, message: string, session: { meetingId, status, dedupHash, durationSeconds, audioPowerLevel } }` | ✅ **Active & Verified** |
| **Toggle Pause Recording**| Service / API test | `POST /api/recording/pause` | `POST` | `x-user-id` or `Bearer` | `{ success: true, isPaused: boolean, status: string }` | ℹ️ Backend Ready (IDOR protected) |
| **Stop Recording & AI** | `POST /api/recording/stop` | `POST /api/recording/stop` | `POST` | `x-user-id` or `Bearer` | `{ success: true, message: string, data: { meetingId, title, status, transcript, summary } }` | ✅ **Active & Verified** |
| **Recording Status by ID**| Service / API test | `GET /api/recording/status/:id`| `GET` | `x-user-id` or `Bearer` | `{ success: true, session: { meetingId, status, durationSeconds, isPaused, audioPowerLevel, dedupHash } }` | ℹ️ Backend Ready (IDOR protected) |
| **Live Telemetry (SSE)** | `GET /api/recording/events` | `GET /api/recording/events` | `GET` | `x-user-id` or `Bearer` | Server-Sent Events stream (`text/event-stream`) | ✅ **Active & Verified** |
| **Generate AI Summary** | Direct API / Bridge | `POST /api/summary/generate` | `POST` | `x-user-id` or `Bearer` | `{ success: true, data: AIAnalysisResult }` | ✅ **Active & Verified** |
| **Desktop Auth Redirect** | Browser navigation | `GET /auth/desktop-login` | `GET` | None (Public) | HTTP 302 Redirect to `http://localhost:5173/auth/desktop-login?...` | ⚠️ Hardcoded local dev URL in redirect |

---

## 🔎 19-Point Codebase Inspection Details

### 1. Every API Endpoint Exposed by Backend:
- `GET /health` (Root probe)
- `GET /api/health` (Namespace probe)
- `GET /auth/desktop-login` (Redirect helper)
- `GET /api/auth/google/url`
- `POST /api/auth/token`
- `POST /api/auth/google/exchange`
- `GET /api/auth/session`
- `POST /api/auth/logout`
- `POST /api/auth/disconnect`
- `GET /api/calendar/events`
- `POST /api/calendar/sync`
- `POST /api/recording/schedule`
- `POST /api/recording/start`
- `POST /api/recording/pause`
- `POST /api/recording/stop`
- `GET /api/recording/status/:id`
- `GET /api/recording/events` (SSE)
- `POST /api/summary/generate`

### 2. Every API Endpoint Called by Frontend ([`src/lib/apiClient.ts`](file:///Users/yogendrasinghdanu/Downloads/Senior%20Product%20Designer/Meet%20Record/src/lib/apiClient.ts)):
- `GET /health` & `GET /api/health` (via `checkAvailability()`)
- `GET /api/auth/google/url` (via `getGoogleAuthUrl()`)
- `POST /api/auth/google/exchange` (via `exchangeGoogleAuth()`)
- `GET /api/auth/session` (via `getSession()`)
- `POST /api/auth/logout` (via `logout()`)
- `POST /api/auth/google/callback` (via `connectGoogleOAuth()`)
- `GET /api/calendar/events` (via `fetchCalendarEvents()`)
- `POST /api/calendar/sync` (via `syncCalendar()`)
- `POST /api/recording/start` (via `startLiveRecording()`)
- `POST /api/recording/stop` (via `stopRecording()`)
- `GET /api/recording/events` (via `subscribeToEvents()`)

### 3. HTTP Methods for Each Request:
- `GET`: Read-only queries (`/health`, `/google/url`, `/session`, `/calendar/events`, `/recording/events`).
- `POST`: Stateful mutations & token exchanges (`/google/exchange`, `/token`, `/logout`, `/disconnect`, `/calendar/sync`, `/recording/start`, `/recording/stop`, `/summary/generate`).

### 4. Complete Production Request URLs:
With backend target `https://noteflow-ai-3nal.onrender.com`:
- `https://noteflow-ai-3nal.onrender.com/health`
- `https://noteflow-ai-3nal.onrender.com/api/auth/google/url`
- `https://noteflow-ai-3nal.onrender.com/api/auth/google/exchange`
- `https://noteflow-ai-3nal.onrender.com/api/auth/session`
- `https://noteflow-ai-3nal.onrender.com/api/auth/logout`
- `https://noteflow-ai-3nal.onrender.com/api/auth/disconnect`
- `https://noteflow-ai-3nal.onrender.com/api/calendar/events`
- `https://noteflow-ai-3nal.onrender.com/api/calendar/sync`
- `https://noteflow-ai-3nal.onrender.com/api/recording/start`
- `https://noteflow-ai-3nal.onrender.com/api/recording/stop`
- `https://noteflow-ai-3nal.onrender.com/api/recording/events`
- `https://noteflow-ai-3nal.onrender.com/api/summary/generate`

### 5. Request Headers:
- `Content-Type: application/json` (Required on all POST requests)
- `x-user-id: <userId>` (Tenant identification header)
- `Authorization: Bearer <accessToken>` (Standard OAuth token header)
- `Accept: text/event-stream` (For SSE live audio power stream)

### 6. Authentication Requirements:
- **Public:** `/health`, `/api/health`, `/api/auth/google/url`, `/api/auth/google/exchange`, `/api/auth/token`.
- **Protected (via `requireAuth`):** All `/api/calendar/*`, `/api/recording/*`, `/api/summary/*`, and session/logout routes.

### 7. Request Body Formats:
- `POST /api/auth/google/exchange`: `{ "code"?: string, "state"?: string, "email"?: string, "name"?: string, "avatarUrl"?: string, "code_challenge"?: string }`
- `POST /api/auth/token`: `{ "code": string, "code_verifier": string, "state"?: string }`
- `POST /api/recording/start`: `{ "meetingUrl"?: string, "dedupHash"?: string }`
- `POST /api/recording/stop`: `{ "dedupHash": string }`
- `POST /api/summary/generate`: `{ "transcript": string | object, "refinement"?: string }`

### 8. Query Parameters:
- `GET /api/auth/google/url`: `?redirectUri=...&code_challenge=...&code_challenge_method=S256`
- `GET /api/calendar/events`: `?syncToken=...`

### 9. Expected Response Structure:
Standard JSON envelope: `{ "success": true, "data": ..., "message"?: string }`

### 10. Error Response Structure:
Standard JSON error: `{ "success": false, "error": "ERROR_CODE_STRING", "message"?: string }`

### 11. CORS Configuration:
- Configured in [`server/config.ts:L7-27`](file:///Users/yogendrasinghdanu/Downloads/Senior%20Product%20Designer/Meet%20Record/server/config.ts#L7-L27) and [`server/index.ts:L37-49`](file:///Users/yogendrasinghdanu/Downloads/Senior%20Product%20Designer/Meet%20Record/server/index.ts#L37-L49).
- Dynamically splits comma-separated `CORS_ORIGIN` environment variable.
- In production, wildcard `*` is strictly blocked.

### 12. Frontend API Environment Variables:
- `VITE_API_URL` (consumed in [`src/lib/apiClient.ts:L4`](file:///Users/yogendrasinghdanu/Downloads/Senior%20Product%20Designer/Meet%20Record/src/lib/apiClient.ts#L4)).
- Must be set in Vercel to `https://noteflow-ai-3nal.onrender.com/api`.

### 13. Backend Environment Variables:
- `PORT` (assigned by Render)
- `NODE_ENV=production`
- `CORS_ORIGIN` (must include `https://noteflow-ai-cc3p.vercel.app`)
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`
- `TOKEN_ENCRYPTION_KEY` (AES-256-GCM 32-byte hex)
- `SESSION_SECRET` (HMAC secret)
- `DATABASE_URL` (Managed PostgreSQL)
- `REDIS_URL` (Managed Redis)

### 14. Localhost References Found:
- `src/lib/apiClient.ts:4`: Fallback `"http://localhost:4000/api"`
- `server/index.ts:83`: Redirect to `http://localhost:5173/auth/desktop-login`
- `server/config.ts:7`: Default CORS string `"http://localhost:5173,http://localhost:5174,http://localhost:3000"`
- `server/config.ts:46`: Default Google redirect URI `"http://localhost:4000/api/auth/google/callback"`
- `desktop/services/authService.ts:25`: Development fallback `"http://localhost:4000"`

### 15. Old Production URL References Found:
- `desktop/services/authService.ts:26`: `https://app.noteflow.ai`
- `server/config.ts:14, 45, 57, 58, 63`: `https://app.noteflow.ai` and `https://api.noteflow.ai`

### 16. Hardcoded API URLs Found:
- `src/lib/apiClient.ts:4`: `http://localhost:4000/api` is used only as default when `VITE_API_URL` is undefined.

### 17. Frontend Endpoints That Do Not Exist in Backend:
- `POST /api/auth/google/callback`: Called in [`src/lib/apiClient.ts:L163`](file:///Users/yogendrasinghdanu/Downloads/Senior%20Product%20Designer/Meet%20Record/src/lib/apiClient.ts#L163). Backend only accepts `POST /api/auth/google/exchange`.

### 18. Backend Endpoints Expected by Frontend but Missing:
- Zero core endpoints are missing. All required frontend flows are supported by the Express backend.

### 19. API Route Prefix Mismatch:
- The Express backend mounts all business logic under `/api/` (`/api/auth`, `/api/calendar`, `/api/recording`, `/api/summary`).
- Health probes are mounted at both `/health` and `/api/health`.

---

## 🎯 Specific Required Sections

### 1. Correct Frontend API URL:
- **`VITE_API_URL` Value for Vercel:**  
  `https://noteflow-ai-3nal.onrender.com/api`

### 2. Incorrect URLs Found:
- `http://localhost:4000/api` (Used as local fallback when `VITE_API_URL` is missing).
- `https://app.noteflow.ai` (Referenced in desktop companion prior to custom DNS configuration).
- `https://api.noteflow.ai` (Referenced in server defaults prior to custom DNS configuration).

### 3. Missing Endpoints:
- `POST /api/auth/google/callback` does not exist as a `POST` handler on the backend (the backend handler is named `POST /api/auth/google/exchange`).

### 4. Route Mismatches:
- In [`src/lib/apiClient.ts:L163`](file:///Users/yogendrasinghdanu/Downloads/Senior%20Product%20Designer/Meet%20Record/src/lib/apiClient.ts#L163), `connectGoogleOAuth` calls `${API_BASE}/auth/google/callback`, but the Express router in [`server/routes/authRoutes.ts:L193`](file:///Users/yogendrasinghdanu/Downloads/Senior%20Product%20Designer/Meet%20Record/server/routes/authRoutes.ts#L193) defines `/google/exchange`.

### 5. Authentication Mismatches:
- None. Both frontend and backend standardize on the `x-user-id` tenant header and `Bearer` token authorization.

### 6. CORS Issues:
- If `CORS_ORIGIN` is not set on Render, the backend defaults to `http://localhost:5173...` and `https://app.noteflow.ai`.
- Calls from `https://noteflow-ai-cc3p.vercel.app/` will trigger `CORS Blocked: Origin not permitted` unless `CORS_ORIGIN` on Render is set to:  
  `https://noteflow-ai-cc3p.vercel.app,https://app.noteflow.ai`

### 7. Environment Variable Issues:
- **Vercel Missing Variable Risk:** If `VITE_API_URL` is omitted in Vercel settings, the browser attempts to call `http://localhost:4000/api`, resulting in `ERR_CONNECTION_REFUSED`.
- **Render Missing Variable Risk:** If `CORS_ORIGIN` is omitted in Render settings, cross-origin requests from Vercel are rejected with HTTP 500 / CORS error.
- **Google OAuth Redirect URI Risk:** `GOOGLE_REDIRECT_URI` must match `https://noteflow-ai-3nal.onrender.com/api/auth/google/callback`.

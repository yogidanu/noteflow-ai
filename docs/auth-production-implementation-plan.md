# NoteFlow AI • Production Authentication & Infrastructure Implementation Plan

**Document Version:** 1.0.0 (Production Blueprint)  
**Authors:** Principal Backend Architect & Staff Security Engineer  
**Status:** Approved Architectural Blueprint — Ready for Phased Implementation  
**Approved Architecture:**
- **Frontend SPA:** `https://app.noteflow.ai` (React + Vite)
- **Backend API & Ingress Daemon:** `https://api.noteflow.ai` (Express.js + TypeScript + Node.js)
- **Primary Database:** PostgreSQL (Managed RDS / Cloud SQL)
- **Cache & Token Session Store:** Redis (Managed ElastiCache / Upstash / Redis Cluster)
- **Desktop Companion:** Electron Native Application (macOS & Windows)

---

## 🧭 Desired End-to-End Authentication Flow

```mermaid
sequenceDiagram
    autonumber
    participant D as Desktop Companion (Electron)
    participant B as System Browser (Chrome / Safari)
    participant F as Web Frontend (app.noteflow.ai)
    participant API as Backend Auth API (api.noteflow.ai)
    participant G as Google OAuth 2.0 (accounts.google.com)
    participant DB as Redis / PostgreSQL
    participant V as macOS Keychain / DPAPI (safeStorage)

    D->>D: 1. User clicks "Continue with Google"
    D->>D: 2. Generates PKCE (verifier + challenge S256) & state nonce
    D->>B: 3. Opens https://app.noteflow.ai/auth/desktop-login?code_challenge=...&state=...&redirect_uri=noteflow://auth/callback
    
    B->>F: 4. Renders /auth/desktop-login landing page
    F->>API: 5. GET /api/auth/google/url?code_challenge=...&state=...
    API->>DB: 6. Stores {state, code_challenge, redirect_uri} in Redis (TTL: 10m)
    API-->>F: 7. Returns official Google OAuth URL
    F->>B: 8. Redirects browser to Google Accounts Consent
    
    B->>G: 9. User authenticates & grants minimal scopes (email, profile, calendar)
    G->>API: 10. Google redirects to https://api.noteflow.ai/api/auth/google/callback?code=...&state=...
    
    API->>DB: 11. Validates state in Redis, fetches stored code_challenge
    API->>G: 12. Exchanges Google code for access_token & refresh_token
    API->>DB: 13. Stores encrypted Google tokens in Redis/PostgreSQL vault
    API->>API: 14. Generates one-time authorization auth_code linked to code_challenge
    API->>B: 15. Returns HTTP 302 Redirect to noteflow://auth/callback?code=AUTH_CODE&state=STATE
    
    B->>D: 16. OS Protocol Handler delegates noteflow:// URI to Electron process
    D->>API: 17. POST /api/auth/token (auth_code + PKCE code_verifier)
    API->>API: 18. Verifies SHA256(code_verifier) === code_challenge
    API-->>D: 19. Returns JWT SafeSession + User Profile
    D->>V: 20. Stores session securely using safeStorage
    D->>D: 21. Emits 'desktop:auth-success' to React UI (Advances to Onboarding / Dashboard)
```

---

## 🛠️ 1. Frontend Changes (`app.noteflow.ai`)

### A. Dedicated `/auth/desktop-login` Route Component
- **Path:** `src/components/auth/DesktopLoginBridge.tsx` (or route in `src/App.tsx`).
- **Functionality:**
  1. Parses query parameters from window URL: `code_challenge`, `code_challenge_method`, `state`, `redirect_uri`.
  2. Renders a calm, branded NoteFlow AI authentication bridge screen (*"Connecting NoteFlow Desktop with Google Workspace..."*).
  3. Calls `GET https://api.noteflow.ai/api/auth/google/url?code_challenge=...&state=...` to retrieve the Google OAuth authorization URL.
  4. Automatically redirects the browser to the Google OAuth consent screen.
  5. Includes manual fallback button `[Continue to Google Sign-In]` in case of popup/redirect blockers.

### B. Dynamic Environment Configuration
- **File:** `src/lib/apiClient.ts`
- **Change:** Replace hardcoded `http://localhost:4000/api` with:
  ```typescript
  const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:4000/api";
  ```
- **File:** `src/lib/desktopBridge.ts`
- **Change:** Support `VITE_APP_URL || "https://app.noteflow.ai"`.

---

## ⚙️ 2. Backend Changes (`api.noteflow.ai`)

### A. Desktop OAuth Initiation Endpoint
- **Route:** `GET /api/auth/google/url`
- **Enhancement:** Accept optional query parameters:
  - `code_challenge` (string)
  - `code_challenge_method` (`S256`)
  - `desktop_redirect_uri` (`noteflow://auth/callback`)
- **Action:** Store PKCE challenge with the generated CSRF state in Redis with a 10-minute TTL.

### B. Google OAuth Callback & Deep-Link Bridge
- **Route:** `GET /api/auth/google/callback` (Browser Redirect Handler)
- **Enhancement:**
  1. Google redirects user's browser here with `code` and `state`.
  2. Validate state in Redis.
  3. If state originated from desktop login (`desktop_redirect_uri === "noteflow://auth/callback"`):
     - Generate an ephemeral one-time auth code (`auth_code`).
     - Store `{ auth_code, userId, code_challenge }` in Redis (TTL: 5 minutes).
     - Issue HTTP 302 redirect:
       ```
       noteflow://auth/callback?code=${auth_code}&state=${state}
       ```
     - Include a fallback HTML page with a clickable deep-link button (`[Open NoteFlow AI Desktop]`) and automatic JavaScript redirect (`window.location.href`).

### C. PKCE Token Exchange Endpoint
- **Route:** `POST /api/auth/token`
- **Payload:** `{ code, code_verifier, state }`
- **Verification Logic:**
  1. Retrieve stored `{ auth_code, userId, code_challenge }` from Redis.
  2. Compute `hash = base64url(SHA256(code_verifier))`.
  3. Validate `hash === code_challenge`.
  4. Burn the one-time `auth_code` in Redis (prevent replay).
  5. Return sanitized `SafeUserSession` + JWT access token to Desktop.

### D. CORS & Port Standardization
- **File:** `server/config.ts`
- Standardize `GOOGLE_REDIRECT_URI` default to `http://localhost:4000/api/auth/google/callback`.
- Configure `corsOrigin` to support comma-separated origins (`https://app.noteflow.ai,http://localhost:5173,http://localhost:4000`).

---

## 💻 3. Desktop Companion Changes (Electron)

### A. Environment-Aware Base URL Resolution
- **File:** `desktop/services/authService.ts`
- **Change:**
  ```typescript
  export class AuthService {
    private static getAuthBaseUrl(): string {
      if (process.env.NOTEFLOW_AUTH_BASE_URL) {
        return process.env.NOTEFLOW_AUTH_BASE_URL;
      }
      return app.isPackaged ? "https://app.noteflow.ai" : "http://localhost:4000";
    }

    public static async startPKCELogin(): Promise<void> {
      const verifier = crypto.randomBytes(32).toString("base64url");
      const challenge = crypto.createHash("sha256").update(verifier).digest("base64url");
      const state = crypto.randomBytes(16).toString("hex");

      this.activePKCEVerifier = verifier;

      const baseUrl = this.getAuthBaseUrl();
      const authUrl = `${baseUrl}/auth/desktop-login?code_challenge=${challenge}&code_challenge_method=S256&state=${state}&redirect_uri=noteflow://auth/callback`;
      
      await shell.openExternal(authUrl);
    }
  }
  ```

### B. Real PKCE Token Exchange in `handleAuthCallback`
- **File:** `desktop/services/authService.ts`
- **Change:**
  1. Capture `code` and `state` from `noteflow://auth/callback?code=...`.
  2. Perform `POST https://api.noteflow.ai/api/auth/token` (or `http://localhost:4000/api/auth/token` in dev) sending `{ code, code_verifier: this.activePKCEVerifier, state }`.
  3. Save received `DesktopAuthSession` to OS encrypted store (`safeStorage`).
  4. Clear `this.activePKCEVerifier`.

---

## 🗄️ 4. Database Requirements (PostgreSQL)

The primary relational database stores persistent user records and meeting metadata.

### Target Schema:
1. **`users` Table:**
   - `id` (UUID / text, Primary Key, e.g. `usr_...`)
   - `email` (VARCHAR(255), Unique, Indexed)
   - `name` (VARCHAR(255))
   - `avatar_url` (TEXT)
   - `organization` (VARCHAR(255))
   - `created_at` (TIMESTAMPTZ)
   - `last_login_at` (TIMESTAMPTZ)
2. **`user_oauth_credentials` Table:**
   - `user_id` (Foreign Key to `users.id`, Unique)
   - `encrypted_access_token` (TEXT)
   - `encrypted_refresh_token` (TEXT)
   - `token_expires_at` (BIGINT)
   - `scopes` (TEXT[])
   - `updated_at` (TIMESTAMPTZ)
3. **`meetings` Table:**
   - `id` (UUID, Primary Key)
   - `user_id` (Foreign Key to `users.id`)
   - `title` (TEXT)
   - `platform` (`google_meet` | `zoom` | `teams`)
   - `meeting_url` (TEXT)
   - `recording_status` (`off` | `scheduled` | `recording` | `completed` | `error`)
   - `dedup_hash` (VARCHAR(64), Indexed)
   - `start_time` (TIMESTAMPTZ)
   - `end_time` (TIMESTAMPTZ)

---

## ⚡ 5. Redis Cache & Distributed State Requirements

Redis is required for high-throughput, low-latency, and distributed state coordination.

### Key Workloads:
1. **OAuth CSRF Nonce & PKCE Storage:**
   - Key: `oauth:state:{state}`
   - Value: `{ code_challenge, redirect_uri, createdAt }`
   - TTL: `600` seconds (10 minutes)
2. **Ephemeral One-Time Auth Codes:**
   - Key: `auth:code:{auth_code}`
   - Value: `{ userId, code_challenge }`
   - TTL: `300` seconds (5 minutes)
3. **Token Vault Cache Layer:**
   - Key: `session:vault:{userId}`
   - Value: AES-256 encrypted token bundle
   - TTL: Synchronized with token expiration
4. **Ingress Mutex Locking (Single Recorder Deduplication):**
   - Key: `lock:ingress:{dedupHash}`
   - Value: `{ workerId, startedAt }`
   - TTL: `180` minutes (with heartbeat refresh)

---

## 🔐 6. Environment Variables Matrix

### A. Backend Service (`api.noteflow.ai`)
```bash
# Server Runtime
NODE_ENV=production
PORT=4000
CORS_ORIGIN=https://app.noteflow.ai,http://localhost:5173

# Cryptography & Security (32-byte / 64-hex chars)
TOKEN_ENCRYPTION_KEY=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef
SESSION_SECRET=noteflow-production-session-secret-key-2026

# Persistence
DATABASE_URL=postgresql://noteflow_user:password@db.noteflow.internal:5432/noteflow_prod?sslmode=require
REDIS_URL=rediss://default:password@redis.noteflow.internal:6379

# Google Cloud OAuth 2.0 Credentials
GOOGLE_CLIENT_ID=*.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-*
GOOGLE_REDIRECT_URI=https://api.noteflow.ai/api/auth/google/callback

# AI & Transcription Providers
DEEPGRAM_API_KEY=dpg_*
ANTHROPIC_API_KEY=sk-ant-*
```

### B. Frontend Application (`app.noteflow.ai`)
```bash
VITE_API_URL=https://api.noteflow.ai/api
VITE_APP_URL=https://app.noteflow.ai
```

### C. Desktop Companion (Electron)
```bash
# Injected during packaging or read from environment
NOTEFLOW_AUTH_BASE_URL=https://app.noteflow.ai
NOTEFLOW_API_BASE_URL=https://api.noteflow.ai/api
```

---

## 🌐 7. DNS & Networking Requirements

The root domain `noteflow.ai` must be managed via Cloudflare or AWS Route 53 with the following DNS records:

| Record Type | Hostname | Target / Value | Proxy Status | Purpose |
| :--- | :--- | :--- | :---: | :--- |
| `CNAME` | `app.noteflow.ai` | `<cloudfront-distribution-id>.cloudfront.net` (or Vercel CNAME) | Proxied (Orange Cloud) | Frontend React Single Page App |
| `CNAME` | `api.noteflow.ai` | `<alb-name>.us-east-1.elb.amazonaws.com` (or Render/Railway URL) | Proxied (Orange Cloud) | Express.js API & WebRTC Ingress |
| `A` / `CNAME` | `noteflow.ai` | `app.noteflow.ai` (Apex root redirect) | Proxied | Marketing / Product Root |

---

## ☁️ 8. Google Cloud Console Configuration Requirements

Under **Google Cloud Console** $\rightarrow$ **APIs & Services** $\rightarrow$ **Credentials** $\rightarrow$ **OAuth 2.0 Client IDs** (Web application type):

### 1. Authorized JavaScript Origins:
- `http://localhost:5173` (Frontend local dev)
- `http://localhost:4000` (Backend local dev)
- `https://app.noteflow.ai` (Production frontend)

### 2. Authorized Redirect URIs:
- `http://localhost:4000/api/auth/google/callback` (Local backend)
- `https://api.noteflow.ai/api/auth/google/callback` (Production backend)

### 3. Enabled OAuth Scopes:
- `openid`
- `https://www.googleapis.com/auth/userinfo.email`
- `https://www.googleapis.com/auth/userinfo.profile`
- `https://www.googleapis.com/auth/calendar.events.readonly` (Read-only Google Calendar)

---

## 🛡️ 9. Security & Compliance Guarantees

1. **RFC 7636 PKCE Enforcement:** All desktop logins require cryptographic code challenge verification.
2. **Zero Plaintext Token Storage:** OAuth access tokens and refresh tokens are encrypted at rest using AES-256-GCM prior to storage in Redis or PostgreSQL.
3. **Short-Lived Authorization Codes:** One-time `auth_code` values expire in 300 seconds and are permanently invalidated upon single use.
4. **CSRF Nonce Validation:** Every OAuth transaction requires an ephemeral cryptographic state parameter.
5. **No Client Token Leakage:** `SafeUserSession` payloads returned to clients completely omit raw Google tokens.

---

## 📦 10. Phased Execution Roadmap

```
Phase 1: Local Development Alignment (Zero Cloud Cost)
  ├── 1.1 Add DesktopLoginBridge component to React router (src/components/auth/DesktopLoginBridge.tsx)
  ├── 1.2 Implement GET /auth/desktop-login & POST /api/auth/token in server/routes/authRoutes.ts
  ├── 1.3 Update desktop/services/authService.ts with dynamic baseUrl & PKCE exchange
  └── 1.4 Verify complete flow locally with localhost:4000

Phase 2: Cloud Infrastructure & DNS Provisioning
  ├── 2.1 Provision DNS CNAMEs for app.noteflow.ai and api.noteflow.ai
  ├── 2.2 Configure Google Cloud Console OAuth Authorized Origins and Redirects
  ├── 2.3 Deploy PostgreSQL and Redis managed instances
  └── 2.4 Deploy Docker container to AWS ECS Fargate / PaaS (api.noteflow.ai) and SPA to S3/Vercel (app.noteflow.ai)

Phase 3: Production Release Verification
  ├── 3.1 Verify desktop companion PKCE login against live https://app.noteflow.ai
  ├── 3.2 Verify deep-link return to noteflow://auth/callback
  └── 3.3 Run production automated FTUX suite
```

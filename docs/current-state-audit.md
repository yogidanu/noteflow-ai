# NoteFlow AI • Current State & First-Time User Experience (FTUX) Audit

> **Document Type:** Product Architecture & State Audit  
> **Auditors:** Senior AI Product Designer & Product Manager Toolkit  
> **Date:** August 2026  
> **Purpose:** Comprehensive inspection of mock data, authentication mechanisms, state persistence, and routing to prepare NoteFlow AI for genuine real-user onboarding.  

---

## 1. Executive Summary

NoteFlow AI is currently configured in a **perpetual demo state**. When a new user launches the web application or desktop companion, they immediately land on an active dashboard with:
1. An established Google Calendar connection for `yogendra.danu@workspace.design`.
2. Three pre-populated detected meetings for today ("Sprint Planning", "Design System Tokens", "Architecture RFC").
3. Two pre-synthesized historical meetings in the sidebar with executive summaries, decisions, and action items.

To transition NoteFlow AI to production for real users, this pre-seeded state must be replaced with a **clean First-Time User Experience (FTUX)** featuring authentic sign-in, an unlinked calendar onboarding state, empty-state guidance, and explicit sample data sandbox separation.

---

## 2. Comprehensive 9-Point Audit

### 1. Where the logged-in user is being created
* **Frontend:**
  - [`src/hooks/useMeetRecord.ts`](file:///Users/yogendrasinghdanu/Downloads/Senior%20Product%20Designer/Meet%20Record/src/hooks/useMeetRecord.ts#L79-L91): `calendarState` default initializer returns `{ isConnected: true, accountEmail: "yogendra.danu@workspace.design", lastSyncedAt: "..." }`.
  - [`src/components/modals/OAuthConsentModal.tsx`](file:///Users/yogendrasinghdanu/Downloads/Senior%20Product%20Designer/Meet%20Record/src/components/modals/OAuthConsentModal.tsx#L12): Hardcodes `selectedAccount = "yogendra.danu@workspace.design"`.
  - [`src/hooks/useMeetRecord.ts`](file:///Users/yogendrasinghdanu/Downloads/Senior%20Product%20Designer/Meet%20Record/src/hooks/useMeetRecord.ts#L25-L67): Attendee lists in mock meetings hardcode `"Yogendra Singh (Lead Designer)"` and `"yogendra.danu@company.internal"`.
* **Backend:**
  - [`server/middleware/authMiddleware.ts`](file:///Users/yogendrasinghdanu/Downloads/Senior%20Product%20Designer/Meet%20Record/server/middleware/authMiddleware.ts#L24-L36): Injects fallback developer headers: `email: "yogendra.danu@workspace.design"`, `name: "Yogendra Singh"`, `userId: "user_default_workspace_id"`.
  - [`server/routes/authRoutes.ts`](file:///Users/yogendrasinghdanu/Downloads/Senior%20Product%20Designer/Meet%20Record/server/routes/authRoutes.ts#L39): Fallback default email.

---

### 2. Where sample/mock meeting data comes from
* **Sample Data Manifest:**
  - [`src/lib/sampleData.ts`](file:///Users/yogendrasinghdanu/Downloads/Senior%20Product%20Designer/Meet%20Record/src/lib/sampleData.ts): Defines `INITIAL_SAMPLE_MEETINGS` (2 fully synthesized meeting notes: "1-on-1 Reorg Pod Sync" and "Q3 Architecture Sync") and raw transcript presets (`SAMPLE_1ON1_REORG_TRANSCRIPT`, `SAMPLE_ZOOM_TRANSCRIPT`, `SAMPLE_BULLET_NOTES`).
* **Sidebar Note List:**
  - [`src/hooks/useMeetings.ts`](file:///Users/yogendrasinghdanu/Downloads/Senior%20Product%20Designer/Meet%20Record/src/hooks/useMeetings.ts#L9-L29): When `localStorage` is empty, state defaults to `INITIAL_SAMPLE_MEETINGS` and sets `activeMeetingId` to `INITIAL_SAMPLE_MEETINGS[0].id`.
* **Detected Calendar Feed:**
  - [`src/hooks/useMeetRecord.ts`](file:///Users/yogendrasinghdanu/Downloads/Senior%20Product%20Designer/Meet%20Record/src/hooks/useMeetRecord.ts#L13-L76): `INITIAL_DETECTED_MEETINGS` array defines 3 static upcoming Google Meet events.

---

### 3. Whether localStorage / sessionStorage contains mock state
Yes. The client initializes and synchronizes five keys in browser `localStorage`:

| `localStorage` Key | Default Value Loaded on First Run | Purpose |
| :--- | :--- | :--- |
| `noteflow_meetings_v1` | `INITIAL_SAMPLE_MEETINGS` (2 full meetings) | Persists user meeting notes |
| `noteflow_active_meeting_id` | `"meeting-sample-001"` | Active selection in workspace |
| `noteflow_calendar_state_v1` | `{ isConnected: true, accountEmail: "yogendra.danu@workspace.design" }` | Calendar connection status |
| `noteflow_detected_meetings_v1` | `INITIAL_DETECTED_MEETINGS` (3 items) | Detected calendar event feed |
| `noteflow_theme_preference` | `"light"` | User theme choice |

---

### 4. Whether there is a mock authentication mechanism
* **Frontend Modal Mock:** In [`src/components/modals/OAuthConsentModal.tsx`](file:///Users/yogendrasinghdanu/Downloads/Senior%20Product%20Designer/Meet%20Record/src/components/modals/OAuthConsentModal.tsx#L47-L54), clicking "Authorize Google Calendar" executes a `setTimeout` of 500ms and calls `onConfirm("yogendra.danu@workspace.design")` without initiating a real Google OAuth2 consent redirect.
* **Backend Mock:** In [`server/routes/authRoutes.ts`](file:///Users/yogendrasinghdanu/Downloads/Senior%20Product%20Designer/Meet%20Record/server/routes/authRoutes.ts#L46-L76), `/api/auth/google/callback` generates simulated JWTs (`ya29.sample_mock_access_token_...`).
* **Desktop Mock:** In [`desktop/services/authService.ts`](file:///Users/yogendrasinghdanu/Downloads/Senior%20Product%20Designer/Meet%20Record/desktop/services/authService.ts), PKCE challenge is generated, but callback exchanges simulated tokens.

---

### 5. Whether there is a demo mode
* **Current Status:** De facto, the **entire application currently operates in demo mode by default**.
* **Reset Trigger:** The header contains a "Reset Samples" button calling `resetToSamples()` in `useMeetings.ts`.
* **Missing Element:** There is no distinct separation between an **Empty/Clean Production Workspace** and an optional **"Load Demo Playground"** experience for trial users.

---

### 6. How routing currently works
* **Architecture:** Simple React Component State Switcher in [`src/App.tsx`](file:///Users/yogendrasinghdanu/Downloads/Senior%20Product%20Designer/Meet%20Record/src/App.tsx#L60).
* **View Modes:**
  1. `viewMode === "feed"`: Renders [`MeetRecordFeed.tsx`](file:///Users/yogendrasinghdanu/Downloads/Senior%20Product%20Designer/Meet%20Record/src/components/workspace/meet/MeetRecordFeed.tsx) (calendar detection & ingress).
  2. `viewMode === "workspace"`: Renders [`WorkspaceCanvas.tsx`](file:///Users/yogendrasinghdanu/Downloads/Senior%20Product%20Designer/Meet%20Record/src/components/workspace/WorkspaceCanvas.tsx) (note editor, transcript input, AI summary canvas).
* **Navigation Triggers:** Top navigation pills, sidebar note selection, keyboard shortcuts (`Cmd+K`, `Cmd+N`), and toast deep links. No URL hash or `react-router` is currently involved.

---

### 7. How application state is persisted
1. **Client Storage:** `localStorage` with reactive `useEffect` hooks saving changes on every state mutation.
2. **Server Storage:** In-memory encrypted Token Vault (`server/security/tokenVault.ts`) keyed by `userId`. State resets when Node server restarts.
3. **Desktop Storage:** Native OS `safeStorage` (Apple Keychain / Windows DPAPI).

---

### 8. How the existing meeting-summary functionality works
* **Pipeline:**
  1. Input: Raw text, paste, or file drop (.vtt, .txt, .md) in `UnifiedDropzone.tsx` or live recording ingress.
  2. Sanitization: [`src/lib/transcriptSanitizer.ts`](file:///Users/yogendrasinghdanu/Downloads/Senior%20Product%20Designer/Meet%20Record/src/lib/transcriptSanitizer.ts) detects timestamps, cleans VTT tags, identifies unique speakers, and computes duration estimates.
  3. AI Synthesis: [`src/lib/meetSummaryBridge.ts`](file:///Users/yogendrasinghdanu/Downloads/Senior%20Product%20Designer/Meet%20Record/src/lib/meetSummaryBridge.ts) attempts backend API `/api/summary/generate`, with seamless client-side fallback to [`src/lib/aiEngine.ts`](file:///Users/yogendrasinghdanu/Downloads/Senior%20Product%20Designer/Meet%20Record/src/lib/aiEngine.ts).
  4. Output: Produces structured 2-Tier output (Human Meeting Context + AI Insights: Executive Summary, Key Decisions with citations, Action Items with assignees, Unresolved Questions, Discussion Topics).

---

### 9. Production-Ready vs. Placeholder Status

| Subsystem / Feature | Status | Analysis |
| :--- | :---: | :--- |
| **Design System & Visual UI** | **Production-Ready** | Full tokenized Light/Dark theme, WCAG AAA contrast, responsive layout, accessible focus rings. |
| **AI Synthesis Engine & Citations** | **Production-Ready** | Resilient client/server parser, grounded citation bindings, formatting exports (Slack/Markdown). |
| **Desktop Companion Architecture** | **Production-Ready** | Electron 34, native tray, system notifications, auto-updater, secure deep links. |
| **User Authentication** | **Placeholder** | Pre-authenticated to `yogendra.danu@workspace.design`; no real SSO login screen. |
| **Calendar Ingress Connection** | **Placeholder** | Defaults to `isConnected: true`; mock OAuth modal with static timeout. |
| **Meeting Detection Feed** | **Placeholder** | Pre-populated with 3 static meetings; no live Google Calendar delta-sync polling in browser. |
| **Audio Capture / VAD** | **Placeholder** | VAD power level simulated via random math intervals (`35 + Math.random() * 55`). |
| **Sample Data Separation** | **Placeholder** | Sample meetings are bundled into primary meeting list rather than separated into an opt-in sandbox. |

---

## 3. Root Causes of Fake Logged-In State

1. **Eager Initial State in Hooks:** `useMeetRecord.ts` and `useMeetings.ts` use sample data as the default return value when `localStorage` is empty.
2. **Lack of an Unauthenticated Entry State:** The root `App.tsx` has no concept of an `isLoggedOut` / `onboarding` step.
3. **Hardcoded User Profile in Backend Middleware:** `server/middleware/authMiddleware.ts` automatically fabricates a verified admin session for every request without requiring an authorization header.

---

## 4. Files Responsible

1. [`src/hooks/useMeetRecord.ts`](file:///Users/yogendrasinghdanu/Downloads/Senior%20Product%20Designer/Meet%20Record/src/hooks/useMeetRecord.ts) — Default `calendarState` & `INITIAL_DETECTED_MEETINGS`.
2. [`src/hooks/useMeetings.ts`](file:///Users/yogendrasinghdanu/Downloads/Senior%20Product%20Designer/Meet%20Record/src/hooks/useMeetings.ts) — Default `INITIAL_SAMPLE_MEETINGS` fallback.
3. [`src/components/modals/OAuthConsentModal.tsx`](file:///Users/yogendrasinghdanu/Downloads/Senior%20Product%20Designer/Meet%20Record/src/components/modals/OAuthConsentModal.tsx) — Hardcoded mock user email.
4. [`server/middleware/authMiddleware.ts`](file:///Users/yogendrasinghdanu/Downloads/Senior%20Product%20Designer/Meet%20Record/server/middleware/authMiddleware.ts) — Default mock identity in request context.
5. [`server/routes/authRoutes.ts`](file:///Users/yogendrasinghdanu/Downloads/Senior%20Product%20Designer/Meet%20Record/server/routes/authRoutes.ts) — Mock token generation.

---

## 5. Recommended Architecture for Genuine FTUX

```
                                 New User First Launch
                                           │
                                           ▼
                       ┌──────────────────────────────────────┐
                       │       Unauthenticated / Welcome      │
                       │    - Clean value proposition         │
                       │    - "Sign in with Google / SSO"     │
                       │    - "Explore with Sample Data" CTA  │
                       └───────────────────┬──────────────────┘
                                           │
                        ┌──────────────────┴──────────────────┐
                        ▼ User Signs In                       ▼ User Chooses Sandbox
         ┌──────────────────────────────┐       ┌──────────────────────────────┐
         │     Clean Production State   │       │       Demo / Sandbox Mode    │
         │ - Calendar: Unconnected      │       │ - Sample 1-on-1 Reorg Notes  │
         │ - Sidebar: 0 Notes (Empty)   │       │ - Sample Zoom VTT Sync       │
         │ - Feed: "Connect Calendar"   │       │ - Banner: "Sandbox Mode"     │
         │ - Quick Record: Ready        │       │ - "Reset / Clear" CTA        │
         └──────────────────────────────┘       └──────────────────────────────┘
```

### Key Recommended Steps:
1. **Clean Default State:** Update `useMeetings` to default to an empty list `[]` for genuine new users, while keeping `INITIAL_SAMPLE_MEETINGS` accessible via explicit 1-click sample loaders in `EmptyState.tsx`.
2. **Unconnected Calendar Baseline:** Update `useMeetRecord` to default `calendarState` to `{ isConnected: false, accountEmail: null, lastSyncedAt: null }` and `detectedMeetings` to `[]`.
3. **Dedicated Onboarding / Sign-In Screen:** Introduce a clean login / welcome screen for first-time visitors before dropping into the workspace.
4. **Interactive Sandbox Toggle:** Provide a clear "Try Sample Data" banner/chip that lets users explore pre-filled summaries without polluting their real account storage.

---

## 6. Potential Risks & Mitigation

| Potential Risk | Impact | Mitigation Strategy |
| :--- | :--- | :--- |
| **Abrupt Empty Screen:** First-time users see a completely blank canvas and don't know what the product does. | High Bounce Rate | Ensure `EmptyState.tsx` displays rich interactive preview cards, value propositions, and 1-click "Try Sample Transcript" buttons. |
| **Accidental Data Loss on Reset:** Clearing mock state might erase genuine user notes. | Data Loss | Namespace real user meetings separately from sample presets; add confirmation dialog before reset. |
| **Offline / Local-Only Users:** Users wanting to try the tool without signing into Google Calendar. | Onboarding Friction | Keep the "Paste Notes / Drag Transcript" unified dropzone immediately available without requiring a calendar login. |

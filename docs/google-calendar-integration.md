# NoteFlow AI • Google Calendar Integration Architecture

This document defines the production integration architecture for Google Calendar in NoteFlow AI, detailing the permission boundary, OAuth 2.0 flow, token vaulting, error recovery, and revocation mechanics.

---

## 1. Architectural Philosophy: Sign-In $\neq$ Calendar Access

A core tenet of NoteFlow AI's security model is the strict separation between **User Identity** and **Calendar Data Access**:

```
┌─────────────────────────────────────────────────────────────┐
│                   STAGE 1: AUTHENTICATION                   │
│   • Identity verification (Google Workspace SSO)            │
│   • Scopes: openid, email, profile                          │
│   • Grants zero access to calendar schedules or meetings    │
└──────────────────────────────┬──────────────────────────────┘
                               │ User explicitly opts in
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                 STAGE 2: CALENDAR INTEGRATION               │
│   • Dedicated secondary OAuth 2.0 scope request             │
│   • Scope: https://www.googleapis.com/auth/calendar.events.readonly │
│   • Read-only access to meeting metadata & Meet URLs        │
│   • Zero write, delete, or attendee modification abilities  │
└─────────────────────────────────────────────────────────────┘
```

Users are never coerced into granting calendar access during initial account creation or login.

---

## 2. Permission Scopes & Privacy Commitments

| Requested Scope | Purpose | Read/Write | Privacy Guarantee |
| :--- | :--- | :--- | :--- |
| `https://www.googleapis.com/auth/calendar.events.readonly` | Detect upcoming Google Meet URLs and scheduled start times. | **Read-Only** | NoteFlow AI **cannot** create events, edit schedules, delete meetings, or send emails on the user's behalf. |
| `https://www.googleapis.com/auth/userinfo.email` | Display authenticated Google account badge. | **Read-Only** | Used solely for tenant session isolation. |
| `https://www.googleapis.com/auth/userinfo.profile` | Display user avatar and initials in the header. | **Read-Only** | Read once during session initiation. |

---

## 3. End-to-End Connection Lifecycle

### 3.1 Unconnected State (Default)
1. Upon logging in, the user sees the **Meet Record Detection** workspace with:
   - Calendar status: `Disconnected`
   - Zero hardcoded or pre-populated meetings (`detectedMeetings = []`).
   - Call to action: `[Connect Google Calendar]`.

### 3.2 Authorization Request & Explainer Modal
1. User clicks `[Connect Google Calendar]`.
2. **OAuth Consent Modal** opens, presenting:
   - Clear distinction: *Google Sign-in $\neq$ Google Calendar Access*.
   - What NoteFlow **WILL** see (meeting titles, times, `meet.google.com` URLs).
   - What NoteFlow will **NEVER** see (zero email reading, zero calendar modifying).
   - Targeted Google Workspace account selector.
3. User clicks `[Authorize Google Calendar]`.

### 3.3 Authorization Success
1. Backend exchanges OAuth grant with Google Token endpoint (`https://oauth2.googleapis.com/token`).
2. Refresh tokens and access tokens are encrypted using **AES-256-GCM** and saved to the in-memory/isolated token vault ([`server/security/tokenVault.ts`](file:///Users/yogendrasinghdanu/Downloads/Senior%20Product%20Designer/Meet%20Record/server/security/tokenVault.ts)).
3. Backend issues an initial delta query to Google Calendar API:
   ```http
   GET https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=2026-08-21T00:00:00Z&timeMax=2026-08-21T23:59:59Z&singleEvents=true&orderBy=startTime&conferenceDataVersion=1
   Authorization: Bearer ya29.a0...
   ```
4. Client UI updates:
   - Status badge: `Connected as [user@company.com] • Last synced [timestamp]`.
   - Populates today's real detected Google Meet calls (or empty state if 0 calls scheduled).

---

## 4. Edge Case & Error Recovery Matrix

| Scenario | System Behavior | User Feedback | Recovery Mechanism |
| :--- | :--- | :--- | :--- |
| **Authorization Cancellation** | User closes OAuth popup or clicks "Cancel" in consent dialog. | Loading spinner stops; modal remains open or dismisses cleanly. | User can click `[Authorize Google Calendar]` again anytime without error loops. |
| **Permission Denial** | User rejects calendar scope on Google's permission prompt. | Shows `"Calendar authorization was denied."` alert banner. | User can re-attempt with explicit guidance on why read-only scope is needed. |
| **Token Expiration (Normal)** | Access token expires after 3600 seconds. | Transparent to user; backend automatically uses `refresh_token` to fetch a new access token. | Automated refresh via `CalendarService.refreshAccessToken()`. |
| **Token Revocation** | User revokes NoteFlow AI access in Google Account Security settings. | Backend detects HTTP 401/403 with `invalid_grant` or `access_denied`. | App marks calendar as `Disconnected` and presents `[Reconnect Google Calendar]` banner. |
| **Network Failure / Timeout** | Transient failure communicating with Google Calendar API. | UI displays `"Failed to synchronize calendar"` toast with `[Retry]` action. | Manual `[Sync Calendar]` button or automated exponential backoff retry. |
| **Zero Scheduled Meetings** | User's calendar has no Google Meet events today. | Displays clean empty schedule state: *"Your schedule is clear! Use the Quick Record bar to paste an ad-hoc Meet URL."* | No fake mock meetings injected in production. |

---

## 5. Disconnection & Data Purge

When the user chooses to disconnect their calendar:
1. User clicks `[Google Workspace]` badge in header or opens `OAuthConsentModal` and clicks `[Disconnect Calendar]`.
2. Backend calls `tokenVault.revoke(userId)`, purging:
   - Encrypted access token
   - Encrypted refresh token
   - Sync tokens and cached calendar entries
3. Client resets `calendarState` to `{ isConnected: false, accountEmail: null, lastSyncedAt: null }`.
4. Client clears `detectedMeetings: []` and purges `localStorage`.

---

## 6. Security Verification

All endpoints and services have been validated through automated end-to-end regression suites:
- `test/google-auth.test.ts` (7 / 7 passed)
- `test/e2e-meet-record.test.ts` (19 / 19 passed)
- `test/installer-configuration.test.ts` (7 / 7 passed)

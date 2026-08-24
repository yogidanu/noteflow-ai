# Meet Record — Backend API Specification & External Dependencies

> **Document Type:** Backend API Reference & Integration Specification  
> **Service:** `noteflow-meet-record-backend`  
> **Status:** Production-Ready (MVP v1.0.0)  
> **Base URL:** `http://localhost:3001/api` (Local) / `https://api.noteflow.ai/api` (Production)  
> **Author:** Senior Software Architect  
> **Related Documents:** [`docs/technical-architecture.md`](file:///Users/yogendrasinghdanu/Downloads/Senior%20Product%20Designer/Meet%20Record/docs/technical-architecture.md) | [`docs/platform-decision.md`](file:///Users/yogendrasinghdanu/Downloads/Senior%20Product%20Designer/Meet%20Record/docs/platform-decision.md)

---

## 1. Architectural Topology & Security Model

The Meet Record backend orchestrates Google Calendar OAuth synchronization, automated Google Meet detection, headless WebRTC ingress dispatch, multi-speaker audio diarization, and grounded summary synthesis.

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                              BACKEND SERVICE ARCHITECTURE                              │
│                                                                                        │
│  [Client (React 19)] ────── REST (JSON) / SSE Telemetry ─────► [Express API Gateway]   │
│                                                                        │               │
│                                              ┌─────────────────────────┴─────────────┐ │
│                                              ▼                                       ▼ │
│                                    ┌───────────────────┐                 ┌───────────┐ │
│                                    │ Secure TokenVault │                 │ Ingress   │ │
│                                    │ (AES-256-GCM)     │                 │ Orch.     │ │
│                                    └─────────┬─────────┘                 └─────┬─────┘ │
│                                              │                                 │       │
│                                              ▼                                 ▼       │
│                                    ┌───────────────────┐                 ┌───────────┐ │
│                                    │ Google Calendar   │                 │ STT & VAD │ │
│                                    │ API v3 Client     │                 │ Pipeline  │ │
│                                    └───────────────────┘                 └───────────┘ │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

### 1.1 Core Security & Privacy Guarantees
1. **Zero Client Token Exposure:** OAuth `access_token` and `refresh_token` are stored exclusively inside the backend `TokenVault` encrypted using **AES-256-GCM** with unique 96-bit IVs and 128-bit authentication tags. The frontend never receives raw OAuth credentials.
2. **Ephemeral Audio Storage:** Audio streams captured during Google Meet calls are processed in volatile RAM buffers and **purged immediately ($<1\text{s}$)** following text transcript and diarization generation. Zero permanent audio files are retained.
3. **Transparent Notice Ingress:** The assistant joins Google Meet with display name `NoteFlow Assistant (Recording)` and transmits an automated chat disclaimer upon admission.

---

## 2. Authentication & Session Endpoints (`/api/auth`)

### 2.1 Get Google OAuth URL
- **Method / Path:** `GET /api/auth/google/url`
- **Description:** Returns the official Google OAuth 2.0 authorization URL with minimal read-only calendar scopes.
- **Response `200 OK`:**
  ```json
  {
    "success": true,
    "authUrl": "https://accounts.google.com/o/oauth2/v2/auth?redirect_uri=...&scope=https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fcalendar.events.readonly...",
    "scopes": [
      "https://www.googleapis.com/auth/calendar.events.readonly",
      "https://www.googleapis.com/auth/userinfo.email",
      "https://www.googleapis.com/auth/userinfo.profile"
    ]
  }
  ```

### 2.2 Google OAuth Callback & Token Vault Ingress
- **Method / Path:** `POST /api/auth/google/callback`
- **Description:** Exchanges authorization code for tokens, encrypts credentials via AES-256-GCM in the `TokenVault`, and returns a safe session profile.
- **Request Body:**
  ```json
  {
    "code": "4/0AeanS0...",
    "email": "yogendra.danu@workspace.design",
    "name": "Yogendra Singh"
  }
  ```
- **Response `200 OK`:**
  ```json
  {
    "success": true,
    "message": "Google Calendar OAuth session established securely",
    "session": {
      "userId": "user_default_workspace_id",
      "email": "yogendra.danu@workspace.design",
      "name": "Yogendra Singh",
      "isConnected": true,
      "expiresAt": 1787140800000,
      "scopes": ["https://www.googleapis.com/auth/calendar.events.readonly"],
      "lastSyncedAt": "10:30 AM"
    }
  }
  ```

### 2.3 Get Current Safe Session
- **Method / Path:** `GET /api/auth/session`
- **Description:** Returns active calendar connection status and user identity. Omits all tokens.
- **Response `200 OK`:**
  ```json
  {
    "success": true,
    "session": {
      "userId": "user_default_workspace_id",
      "email": "yogendra.danu@workspace.design",
      "name": "Yogendra Singh",
      "isConnected": true,
      "expiresAt": 1787140800000,
      "scopes": ["https://www.googleapis.com/auth/calendar.events.readonly"],
      "lastSyncedAt": "10:30 AM"
    }
  }
  ```

### 2.4 Disconnect & Revoke Session
- **Method / Path:** `POST /api/auth/disconnect`
- **Description:** Purges encrypted tokens from `TokenVault` and revokes calendar sync.
- **Response `200 OK`:**
  ```json
  {
    "success": true,
    "message": "Google Calendar connection revoked and tokens safely purged from vault."
  }
  ```

---

## 3. Calendar Integration Endpoints (`/api/calendar`)

### 3.1 Fetch Detected Upcoming Meetings
- **Method / Path:** `GET /api/calendar/events`
- **Query Parameters:** `syncToken` (optional, for delta-sync)
- **Description:** Queries Google Calendar API, extracts `meet.google.com` URLs, filters declined RSVPs, and returns standardized meeting entities.
- **Response `200 OK`:**
  ```json
  {
    "success": true,
    "data": [
      {
        "id": "meet-event-gcal_evt_101",
        "calendarEventId": "gcal_evt_101",
        "title": "Sprint Planning & Q3 Roadmap Alignment",
        "startTime": "10:00 AM",
        "endTime": "10:45 AM",
        "organizerName": "Sarah Chen",
        "organizerEmail": "sarah.chen@company.internal",
        "isExternalHost": false,
        "attendees": [
          { "name": "Sarah Chen", "email": "sarah.chen@company.internal", "rsvp": "accepted" },
          { "name": "Yogendra Singh", "email": "yogendra.danu@workspace.design", "rsvp": "accepted" },
          { "name": "Alex Miller", "email": "alex.m@company.internal", "rsvp": "accepted" }
        ],
        "platform": "google_meet",
        "meetingUrl": "https://meet.google.com/qrp-zvmk-sxc",
        "recordingStatus": "off",
        "dedupHash": "a3f5b7..."
      }
    ],
    "syncToken": "sync_token_1787130000000",
    "accountEmail": "yogendra.danu@workspace.design",
    "lastSyncedAt": "10:30 AM"
  }
  ```

### 3.2 Trigger Manual Calendar Sync
- **Method / Path:** `POST /api/calendar/sync`
- **Description:** Forces an immediate calendar refresh against Google Calendar API.
- **Response `200 OK`:**
  ```json
  {
    "success": true,
    "message": "Calendar synchronized successfully",
    "data": [...],
    "syncToken": "sync_token_1787130000000",
    "lastSyncedAt": "10:31 AM"
  }
  ```

---

## 4. Recording Lifecycle Endpoints (`/api/recording`)

### 4.1 Schedule Meeting Recording
- **Method / Path:** `POST /api/recording/schedule`
- **Request Body:**
  ```json
  {
    "meetingId": "meet-event-101",
    "title": "Sprint Planning & Q3 Roadmap Alignment",
    "meetingUrl": "https://meet.google.com/qrp-zvmk-sxc"
  }
  ```
- **Response `200 OK`:**
  ```json
  {
    "success": true,
    "message": "Assistant scheduled for recording",
    "session": {
      "meetingId": "meet-event-101",
      "status": "scheduled",
      "dedupHash": "a3f5b7...",
      "title": "Sprint Planning & Q3 Roadmap Alignment"
    }
  }
  ```

### 4.2 Start Live Ingress
- **Method / Path:** `POST /api/recording/start`
- **Request Body:**
  ```json
  {
    "dedupHash": "a3f5b7...",
    "meetingUrl": "https://meet.google.com/qrp-zvmk-sxc"
  }
  ```
- **Response `200 OK`:**
  ```json
  {
    "success": true,
    "message": "Live recording started",
    "session": {
      "meetingId": "meet-event-101",
      "status": "recording",
      "dedupHash": "a3f5b7...",
      "durationSeconds": 0,
      "audioPowerLevel": 65
    }
  }
  ```

### 4.3 Pause / Resume Ingress
- **Method / Path:** `POST /api/recording/pause`
- **Request Body:**
  ```json
  { "dedupHash": "a3f5b7..." }
  ```
- **Response `200 OK`:**
  ```json
  {
    "success": true,
    "isPaused": true,
    "status": "recording"
  }
  ```

### 4.4 Stop Recording & Synthesize
- **Method / Path:** `POST /api/recording/stop`
- **Request Body:**
  ```json
  { "dedupHash": "a3f5b7..." }
  ```
- **Response `200 OK`:**
  ```json
  {
    "success": true,
    "message": "Recording completed and synthesized",
    "data": {
      "meetingId": "meet-event-101",
      "title": "Sprint Planning & Q3 Roadmap Alignment",
      "status": "completed",
      "transcript": {
        "meetingId": "meet-event-101",
        "rawVtt": "WEBVTT\n...",
        "sanitizedText": "Sarah Chen [00:02]: Alright everyone...",
        "detectedSpeakers": ["Sarah Chen", "Marcus Brody", "Elena Rostova"],
        "durationSeconds": 1800,
        "segments": [...]
      },
      "summary": {
        "executiveSummary": "Context & Strategic Framing:\n...",
        "decisions": [...],
        "actionItems": [...],
        "unresolvedQuestions": [...],
        "modelConfidence": "high"
      }
    }
  }
  ```

### 4.5 Server-Sent Events (SSE) Live Telemetry Stream
- **Method / Path:** `GET /api/recording/events`
- **Headers:** `Accept: text/event-stream`
- **Description:** Real-time push stream broadcasting VAD audio levels, status transitions, and bot admission events.
- **Sample Stream Events:**
  ```text
  data: {"type":"CONNECTED","timestamp":"2026-08-19T10:30:00.000Z"}

  data: {"type":"AUDIO_STREAM_STARTED","meetingId":"meet-101","durationSeconds":0}

  data: {"type":"VAD_LEVEL","audioPowerLevel":72,"durationSeconds":14}
  ```

---

## 5. Summary & Perspective Synthesis Endpoints (`/api/summary`)

### 5.1 On-Demand Summary Synthesis & Refinement
- **Method / Path:** `POST /api/summary/generate`
- **Request Body:**
  ```json
  {
    "rawInput": "Sarah Chen: We decided to launch Sept 1st...",
    "refinement": "executive"
  }
  ```
- **Response `200 OK`:**
  ```json
  {
    "success": true,
    "data": {
      "executiveSummary": "Executive Briefing:\n• GA Launch Timeline: Locked to September 1st, 2026...",
      "decisions": [
        {
          "id": "dec-srv-1",
          "text": "The public GA release date is locked to September 1st, 2026.",
          "rationale": "Allows 10 additional business days to resolve SOC-2 pen-test items cleanly.",
          "confidence": "high",
          "citation": {
            "id": "cit-5",
            "speaker": "Sarah Chen",
            "timestamp": "00:31",
            "rawText": "Decision reached: We are officially locking the public release date to September 1st, 2026.",
            "lineIndex": 5
          }
        }
      ],
      "actionItems": [
        {
          "id": "act-srv-1",
          "task": "Update release milestone tracker in Jira and notify executive steering committee",
          "assignee": "Marcus Brody",
          "dueDate": "Friday by 3:00 PM",
          "isCompleted": false,
          "priority": "high",
          "citation": {
            "id": "cit-7",
            "speaker": "Marcus Brody",
            "timestamp": "00:45",
            "rawText": "I'll have the updated milestone doc out by Friday 3 PM.",
            "lineIndex": 7
          }
        }
      ],
      "unresolvedQuestions": [...],
      "modelConfidence": "high",
      "appliedRefinement": "executive"
    }
  }
  ```

---

## 6. External API Dependencies Matrix

| External Dependency | Provider / Protocol | API Surface Used | Purpose & Scope | Error & Fallback Strategy |
| :--- | :--- | :--- | :--- | :--- |
| **Google Calendar API** | Google LLC (REST v3) | `GET /calendars/primary/events` | Syncs upcoming event times, titles, and Google Meet URLs. | Falls back to cached local storage and manual URL entry. |
| **Google OAuth 2.0** | Google LLC (RFC 6749) | `https://oauth2.googleapis.com/token` | User authorization code token grant and session renewal. | Triggers `OAUTH_EXPIRED` card with 1-click reconnect CTA. |
| **Speech-to-Text (STT)** | Deepgram Nova-2 / Whisper | WebSocket Streaming / REST | High-speed multi-speaker audio diarization with timestamps. | Audio buffer retry with secondary STT provider fallback. |
| **NoteFlow AI LLM** | Anthropic / OpenAI / Vertex | REST JSON Completion | Grounded extraction of Executive Summary, Decisions, Actions, and Qs. | Local heuristic fallback & retry with exponential backoff. |

---

## 7. Verification & Health Check

The backend includes a health-check endpoint:
- **`GET /api/health`**
- **Response `200 OK`:**
  ```json
  {
    "status": "ok",
    "service": "noteflow-meet-record-backend",
    "version": "1.0.0",
    "timestamp": "2026-08-19T10:30:00.000Z"
  }
  ```

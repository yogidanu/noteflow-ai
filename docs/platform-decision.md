# Meet Record — Platform Evaluation & MVP Strategic Decision

> **Document Type:** Architectural Decision Record (ADR) & Platform Evaluation  
> **Status:** Final & Approved  
> **Decision:** **Target Google Meet as the Primary Platform for MVP (Phase 1)**  
> **Author:** Senior Software Architect & Senior Product Manager  
> **Related Documents:** [`docs/product-discovery.md`](file:///Users/yogendrasinghdanu/Downloads/Senior%20Product%20Designer/Meet%20Record/docs/product-discovery.md) | [`docs/requirements.md`](file:///Users/yogendrasinghdanu/Downloads/Senior%20Product%20Designer/Meet%20Record/docs/requirements.md) | [`docs/technical-architecture.md`](file:///Users/yogendrasinghdanu/Downloads/Senior%20Product%20Designer/Meet%20Record/docs/technical-architecture.md)

---

## 1. Executive Summary & Final Recommendation

To achieve a fast time-to-market, minimize user onboarding friction, and avoid enterprise IT administrative blockers, **Google Meet is selected as the initial platform for the Meet Record MVP**.

### The Core Rationale
1. **Zero IT Administrator Roadblocks:** Google Workspace allows individual product managers, designers, and engineers to connect their Google Calendar via standard OAuth 2.0 in under 30 seconds. In contrast, Microsoft Teams requires corporate Azure AD Global Administrator tenant consent, and Zoom requires paid host licenses and Zoom Marketplace app reviews.
2. **Native Web-First Alignment:** Google Meet runs 100% in standard web browsers (Chrome, Edge, Safari) without requiring native desktop client installations or native OS audio loopback drivers.
3. **Modular Foundation for v1.1:** The headless WebRTC ingress architecture, calendar sync state machine, and transcript sanitization pipeline built for Google Meet establish a reusable abstraction (`IMeetingResolver`, `ICalendarProvider`) that directly scales to Zoom and Microsoft Teams in subsequent phases.

---

## 2. Comprehensive Platform Evaluation Matrix

The evaluation below is based strictly on **official platform APIs, developer documentation, and real-world licensing constraints**.

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                              PLATFORM EVALUATION MATRIX                                │
├───────────────────────────┬──────────────────────┬──────────────────┬──────────────────┤
│ Evaluation Dimension      │ Google Meet (MVP)    │ Zoom (Phase 2)   │ MS Teams (Phase 3)│
├───────────────────────────┼──────────────────────┼──────────────────┼──────────────────┤
│ **1. Authentication**     │ Google OAuth 2.0 PKCE│ Zoom OAuth 2.0   │ Microsoft Entra  │
│                           │ (Standard user flow) │ (Marketplace app)│ ID (Azure AD MSAL│
├───────────────────────────┼──────────────────────┼──────────────────┼──────────────────┤
│ **2. Permissions & Admin**│ **Individual Consent**│ Individual OAuth │ **Mandatory IT   │
│                           │ (No IT admin needed) │ (Host license req│ Admin Consent**  │
├───────────────────────────┼──────────────────────┼──────────────────┼──────────────────┤
│ **3. Meeting Detection**  │ Google Calendar API  │ Zoom REST API or │ MS Graph API     │
│                           │ (Fast delta sync)    │ Linked Calendar  │ (`/me/events`)   │
├───────────────────────────┼──────────────────────┼──────────────────┼──────────────────┤
│ **4. Recording Method**   │ Headless WebRTC Bot  │ Cloud Rec Webhook│ Graph Calling Bot│
│                           │ (Universal ingress)  │ (Paid Host only) │ / Media SDK      │
├───────────────────────────┼──────────────────────┼──────────────────┼──────────────────┤
│ **5. Transcript Access**  │ External STT Stream  │ Zoom Native VTT  │ MS Graph API     │
│                           │ (Deepgram/Whisper)   │ or External STT  │ Transcripts      │
├───────────────────────────┼──────────────────────┼──────────────────┼──────────────────┤
│ **6. API Complexity**     │ **Low to Medium**    │ **Medium**       │ **Very High**    │
├───────────────────────────┼──────────────────────┼──────────────────┼──────────────────┤
│ **7. User Experience**    │ 100% Web-based;      │ Native App + Web;│ Heavy enterprise │
│                           │ <30s onboarding      │ license popups   │ friction & delays│
├───────────────────────────┼──────────────────────┼──────────────────┼──────────────────┤
│ **8. Scalability**        │ Auto-scale WebRTC ECS│ Cloud API scale  │ High Azure cost  │
├───────────────────────────┼──────────────────────┼──────────────────┼──────────────────┤
│ **9. Dev Effort (MVP)**   │ **2–3 Weeks**        │ **4–5 Weeks**    │ **6–8 Weeks**    │
├───────────────────────────┼──────────────────────┼──────────────────┼──────────────────┤
│ **OVERALL MVP SCORE**     │ ⭐️ **9.2 / 10**      │ ⚠️ **7.1 / 10**   │ ❌ **4.8 / 10**  │
└───────────────────────────┴──────────────────────┴──────────────────┴──────────────────┘
```

---

## 3. Deep-Dive Platform Breakdown

### 3.1 Google Meet (Recommended MVP Target)

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                               GOOGLE MEET ARCHITECTURE                                 │
│                                                                                        │
│   Google Calendar API v3 ──► Detect Meet URL (meet.google.com/xxx-xxxx-xxx)            │
│                                       │                                                │
│                                       ▼                                                │
│   Headless WebRTC Worker ──► Joins Call ──► In-Meeting Chat Notice                     │
│                                       │                                                │
│                                       ▼                                                │
│   Ephemeral Audio Stream ──► Multi-Speaker STT ──► NoteFlow AI Summary (<60s)          │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

#### Official Capabilities & Constraints
- **Authentication & OAuth:** Uses standard Google OAuth 2.0 with the incremental scope `https://www.googleapis.com/auth/calendar.events.readonly`.
- **Permissions:** Can be granted by any individual Google Workspace or personal `@gmail.com` user without requiring Workspace Domain Administrator approval.
- **Meeting Detection:** Google Calendar API v3 provides fast, structured `conferenceData` objects containing direct `meet.google.com` URLs and attendee lists with RSVP states.
- **Recording Mechanism:** Google Meet does not expose a public REST API endpoint for third parties to trigger cloud recordings. Ingress is achieved via a containerized headless Chromium client negotiating WebRTC peer streams.
- **Transcript Availability:** Captures PCM audio streams and feeds them into our multi-speaker diarization STT engine (Deepgram Nova-2 / Whisper Large-v3), generating standardized timestamped `.vtt` segments.
- **Key Advantages for MVP:**
  - Fast onboarding ($\le 30\text{ seconds}$).
  - Universal access across startups, tech companies, and individual designers/PMs.
  - Full control over audio quality, diarization fidelity, and citation timestamps.

---

### 3.2 Zoom (Phase 2 Target)

#### Official Capabilities & Constraints
- **Authentication & OAuth:** Requires creating a Zoom OAuth App in the Zoom App Marketplace.
- **Permissions & Licensing Bottleneck:** 
  - Zoom's Cloud Recording REST API (`/users/{userId}/recordings`) **only works if the user is the meeting host AND possesses a paid Zoom Pro, Business, or Enterprise license**.
  - If a NoteFlow user attends a meeting hosted by an external client or colleague, NoteFlow cannot trigger Cloud Recording via API.
- **Meeting Detection:** Requires dual integration (Zoom Meeting API + Google/Outlook Calendar sync) because users frequently schedule Zoom calls via external calendars.
- **Transcript Availability:** Zoom provides native WebVTT transcripts for Cloud Recordings, but transcript generation latency can take between **15 to 45 minutes** post-call, violating our MVP latency target ($\le 60\text{ seconds}$).
- **Verification Requirement:** Mandatory **Zoom App Marketplace Security Review** before non-developer accounts can authorize the app.

---

### 3.3 Microsoft Teams (Phase 3 Target)

#### Official Capabilities & Constraints
- **Authentication:** Microsoft Entra ID (Azure AD) with MSAL.
- **The Enterprise IT Admin Roadblock:**
  - Programmatic meeting recording and media stream access in Teams requires Microsoft Graph Calling APIs (`/communications/calls`) with application permissions (`Calls.AccessMedia.All`).
  - **Application permissions require Global Azure AD Administrator Consent**. An individual PM or designer cannot authorize NoteFlow on corporate Teams without IT department approval.
- **Meeting Detection:** Microsoft Graph Calendar API (`/me/events`) requires enterprise tenant policy compliance.
- **API Complexity:** Requires deploying an Azure Bot Framework bot, handling Microsoft Graph webhook validation tokens, and managing complex call state callbacks.
- **Verification Requirement:** Official Microsoft Partner Network (MPN) Publisher Verification and enterprise compliance audit.

---

## 4. Evaluation Criteria Comparison

```
+--------------------------+-----------------------+-----------------------+-----------------------+
| CRITERION                | GOOGLE MEET           | ZOOM                  | MICROSOFT TEAMS       |
+--------------------------+-----------------------+-----------------------+-----------------------+
| User Friction            | Extremely Low (<30s)  | Moderate (License req)| High (Admin block)    |
| Time-to-Value (TTV)      | < 60s post-meeting    | 15-45m (Cloud Rec API)| 5-10m (Graph API)     |
| Target User Fit          | Product, Design, Tech | Enterprise, Sales     | Enterprise IT, Corp   |
| Implementation Overhead  | 2-3 Weeks             | 4-5 Weeks             | 6-8 Weeks             |
| Risk Level               | Low                   | Medium                | High                  |
+--------------------------+-----------------------+-----------------------+-----------------------+
```

---

## 5. Strategic Roadmap & Rollout Sequence

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                              PLATFORM ROLLOUT ROADMAP                                  │
├──────────────────────────┬───────────────────────────┬─────────────────────────────────┤
│ Phase 1: MVP (Month 1)   │ Phase 2: Scale (Month 3)  │ Phase 3: Enterprise (Month 6)   │
├──────────────────────────┼───────────────────────────┼─────────────────────────────────┤
│ • **Google Meet**        │ • **Zoom**                │ • **Microsoft Teams**           │
│ • Google Calendar API    │ • Zoom Marketplace App    │ • Azure AD Graph API            │
│ • Headless WebRTC Bot    │ • Cloud Recording Webhooks│ • Microsoft Calling SDK Bot     │
│ • Deepgram / Whisper STT │ • Zoom Bot Ingress Fallbk │ • Outlook 365 Calendar Sync     │
│ • NoteFlow AI 5 Modes    │ • Dual Calendar Sync      │ • Enterprise Tenant Workspace   │
└──────────────────────────┴───────────────────────────┴─────────────────────────────────┘
```

---

## 6. Final Architecture Sign-Off

- **Selected Target:** Google Meet
- **Justification:** Highest user velocity, zero IT administrative barriers, web-native integration, and complete alignment with NoteFlow AI's grounded summarization pipeline.

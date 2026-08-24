# Product Discovery: Meet Record MVP

> **Document Type:** Product Discovery & Strategic Framing  
> **Role:** Senior Product Designer & Product Manager  
> **Status:** Draft for Review  
> **Target Feature:** Meet Record (Automated Detection & Explicit Recording Integration)  
> **Target Project:** NoteFlow AI / Meet Record  

---

## 1. User Problem

Currently, users who rely on our AI meeting summary application experience friction and high drop-off before they even reach our core value proposition:
1. **High Pre- & Post-Meeting Friction:** Users must manually trigger local or cloud recordings, wait for the call to finish, locate and download the raw `.vtt` / audio file, navigate to our application, and manually upload or paste the transcript.
2. **Cognitive Load & Forgetfulness:** In back-to-back schedules, users frequently forget to hit record or forget to export the transcript, losing crucial decisions and action items.
3. **Permission & Format Inconsistency:** Exporting meeting transcripts natively varies across host permissions, platform tiers, and file encodings, creating unnecessary technical hurdles for non-technical team members.

---

## 2. Primary Users & Personas

| Persona | Role / Context | Core Pain Point |
| :--- | :--- | :--- |
| **Product Managers (Primary)** | Leads sprint rituals, customer discovery calls, stakeholder alignments. | Overwhelmed by taking manual notes while facilitating high-stakes strategic conversations. |
| **Senior Product Designers (Primary)** | Conducts user interviews, usability testing, and cross-functional design critiques. | Needs verbatim user feedback and rapid extraction of pain points/action items without manual transcription. |
| **Engineering Leads & Architects (Secondary)** | Hosts technical architecture reviews, incident post-mortems, and sprint planning. | Needs precise decision logs and technical action items with clear ownership without losing focus during discussions. |

---

## 3. User Goals

1. **Effortless Detection:** See upcoming or ongoing meetings automatically detected without copying and pasting calendar invite links.
2. **Explicit, Frictionless Control:** Authorize recording for a specific meeting with a single explicit opt-in action before or at the start of the call.
3. **Trust & Participant Transparency:** Ensure all meeting participants are clearly notified that recording/transcription is active, establishing full trust and legal compliance (zero covert recording).
4. **Instant Value Delivery:** Receive a grounded, structured AI summary (Executive Summary, Key Decisions, Action Items, Open Questions) immediately after the meeting concludes.

---

## 4. Business Goals

1. **Transition from Utility to Workflow Hook:** Shift the product from a reactive, manual copy-paste summarizer into a proactive, end-to-end meeting intelligence partner.
2. **Accelerate Time-to-Value (TTV):** Reduce average time from meeting conclusion to actionable summary from >5 minutes (manual download/upload) to **<60 seconds**.
3. **Increase User Retention & Volume:** Boost Weekly Active Users (WAU) and 30-day retention by increasing the average number of meetings processed per user per week by **3x**.

---

## 5. MVP Scope (Approved Boundaries)

The MVP is strictly focused on establishing a rock-solid, privacy-first capture loop for **one single platform**:

- [x] **Calendar / Meeting Detection:** Detect scheduled upcoming and currently active meetings from the user's connected calendar.
- [x] **Explicit Recording Authorization:** A clear, user-controlled toggle ("Enable Recording for this Meeting") per event (Opt-in only; no forced global auto-recording).
- [x] **Participant Notification & Consent:** Automated in-meeting visible presence and transparent naming (e.g. `NoteFlow Assistant (Recording)`) so participants are aware.
- [x] **Automated Ingestion Pipeline:** Stream or fetch the completed transcript post-meeting directly into NoteFlow AI's summarization engine.
- [x] **Mandatory 6-State UI Handling:**
  - **Loading:** Fetching upcoming meetings, dispatching recorder, processing summary.
  - **Success:** Meeting captured, transcript generated, AI summary ready for review.
  - **Error:** Bot denied entry, calendar disconnect, transcription failure with actionable recovery.
  - **Empty:** No upcoming meetings detected for today; clear CTA to sync or paste link.
  - **Permission:** Explicit Google/Platform OAuth consent requests with transparent permission scopes.
  - **Retry:** One-click retry mechanism for failed transcription or reconnections.
- [x] **Reviewable & Identifiable AI Output:** AI-generated summary cards clearly marked with source grounding and inline editing controls.

---

## 6. Non-MVP Scope (Strictly Deferred)

To maintain a lean, high-velocity build and avoid premature complexity:

- [ ] Multi-platform simultaneous support (Teams + Zoom + Meet in v1.0).
- [ ] Unconditional background auto-record without per-meeting confirmation.
- [ ] Live real-time streaming transcription during the call (MVP delivers post-call summary).
- [ ] Raw video file storage, video streaming playback, or screen-recording hosting (audio/text only).
- [ ] Multi-language real-time translation during calls.
- [ ] Deep CRM / Issue tracker automatic sync (Salesforce, HubSpot, Jira, Notion).
- [ ] Organization-level enterprise admin dashboards and centralized workspace billing.

---

## 7. Key Assumptions

1. **User Willingness to Connect Calendar:** Users are comfortable connecting their primary work calendar (e.g., Google Calendar) to detect upcoming meetings.
2. **Participant Acceptance of Visible Recording Assistant:** External and internal meeting attendees are accustomed to visible AI meeting assistants when clearly labeled.
3. **API / Bot Reliability:** The selected platform allows consistent ingress for recording/transcription without requiring prohibitive enterprise tenant-wide admin approvals for early individual adopters.

---

## 8. Dependencies

1. **Calendar OAuth Provider:** Google Calendar API (for detecting events, meeting titles, start times, and meeting URLs).
2. **Meeting Ingestion / Capture Pipeline:** Headless meeting client or webhook ingress that joins authorized calls, records audio, and captures participant speaker streams.
3. **Speech-to-Text (STT) Engine:** Fast, high-accuracy transcription service (e.g., Deepgram, Whisper, or platform native captions) providing timestamped speaker diarization.
4. **Core AI Summarizer:** Existing NoteFlow AI summarizer engine (`src/lib/aiEngine.ts`).

---

## 9. Platform Constraints Comparison

| Factor | Google Meet | Zoom | Microsoft Teams |
| :--- | :--- | :--- | :--- |
| **OAuth & Calendar Friction** | **Very Low** (Google Workspace OAuth is familiar and widely accessible to individual users). | **Medium** (Requires Zoom Marketplace App approval / user OAuth). | **High** (Requires Azure AD tenant-wide admin consent for Graph API). |
| **Meeting Environment** | **100% Web-based** (No native client required; runs in Chrome). | Web client + Native Desktop app. | Web client + Native Desktop app. |
| **Bot Ingress & In-Meeting UI** | Clear in-meeting participant list presence; easy admission via host prompt. | Native recording disclaimer prompt ("Recording in progress"). | Strict tenant boundary policies often block external bots. |
| **Target Audience Fit** | Ubiquitous among modern product, design, and tech startups. | Widely used across enterprise and education. | Predominantly legacy enterprise and corporate IT. |

---

## 10. Privacy & Consent Considerations (Principles 6, 7, 8, 9)

Privacy and consent are non-negotiable architectural constraints:

1. **Zero Covert Recording:** No hidden audio sniffing, background microphone tapping without active UI cues, or undisclosed bot joins.
2. **Visible Identity:** The capture assistant must join with a standardized, descriptive display name:  
   `[AppName] Notetaker (Recording)`
3. **Participant Notice:** The assistant announces its presence in the meeting chat or relies on platform-level recording indicators so all attendees have immediate notice.
4. **Immediate Opt-Out / Expulsion:** If the host or any participant denies admission or ejects the assistant from the call, the system must immediately terminate capture, transition to an `Error / Cancelled` state, and discard partial audio.
5. **Data Minimization:** Raw audio is discarded or deleted immediately after accurate transcript generation unless explicitly retained by the user.

---

## 11. Risks & Mitigations

| Risk | Impact | Mitigation Strategy |
| :--- | :--- | :--- |
| **Bot Left in Waiting Room / Rejected by Host** | High (Meeting not recorded) | Provide clear visual status in-app ("Waiting for host admission"); if rejected, trigger graceful error state with prompt to upload manual transcript instead. |
| **OAuth Consent Scopes Triggering Hesitation** | Medium (Onboarding drop-off) | Request minimal incremental scopes (read-only calendar events initially); explain explicitly why each permission is required. |
| **Audio Diarization / Speaker Inaccuracy** | Medium (Lower summary fidelity) | Leverage transcript sanitizer and speaker normalization pipeline with interactive user inline-editing. |
| **Meeting Overruns or Schedule Changes** | Low (Premature disconnect) | Implement dynamic meeting end detection based on participant departure rather than strict calendar end times. |

---

## 12. Success Metrics

1. **Capture Success Rate:** $\ge 92\%$ of user-authorized meetings successfully record, transcribe, and synthesize without technical failure.
2. **Time to Summary:** $\le 60\text{ seconds}$ from meeting end to completed AI summary ready for review.
3. **Review & Action Rate:** $\ge 65\%$ of generated summaries are reviewed, edited, copied, or exported by the user.
4. **Weekly Habituation:** $\ge 3.5$ recorded meetings per active user per week.

---

## 13. Open Questions for Engineering & Product Alignment

1. **Bot Ingress Infrastructure:** Should we utilize a hosted meeting bot infrastructure (e.g. Recall.ai / custom headless Chromium instance) or a lightweight browser extension companion for client-side tab capture?
2. **Calendar Sync Cadence:** Should calendar sync poll on a 5-minute interval, or utilize Google Calendar Webhooks/push notifications for real-time schedule updates?
3. **Multi-Party Consent Handling:** Do we need an automated pre-meeting chat message posted into the meeting chat informing attendees of the recording privacy policy?

---

## 14. Strategic Recommendation: Initial Target Platform

### **Recommendation: Google Meet**

#### **Why Google Meet for MVP?**
1. **Lowest Onboarding & Administrative Friction:** Google Calendar and Google Meet integrations operate seamlessly via standard Google OAuth. Unlike Microsoft Teams (which requires corporate Azure AD tenant administrator intervention) or Zoom (which requires Zoom App Marketplace review/configuration), Google Workspace accounts allow individual product designers and PMs to connect in under 30 seconds.
2. **Native Web Alignment:** Google Meet operates entirely within modern web browsers without requiring native desktop app installations or SDK bridging. This perfectly matches our existing React web application.
3. **Extensible Architecture:** The data contracts for calendar event models, meeting state machines (Scheduled $\rightarrow$ Active $\rightarrow$ Recording $\rightarrow$ Transcribing $\rightarrow$ Ready), and transcript streaming built for Google Meet are 100% modular. They directly generalize to Zoom and Microsoft Teams in subsequent v1.1 releases.

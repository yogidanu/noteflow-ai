# Meet Record — Redesigned Active Recording Experience

> **Document Type:** Active Recording Experience & Interaction Architecture  
> **Aesthetic Philosophy:** Premium Productivity + Calm AI (Linear • Notion • Raycast • Superhuman)  
> **Status:** Fully Implemented & Verified  
> **Compliance:** WCAG 2.1 Level AA & AAA Accessible  

---

## 1. Design Objectives & Principles

The active recording state is the most sensitive and mission-critical interaction in Meet Record. It must satisfy five core user needs:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    ACTIVE RECORDING HEURISTIC CHECKLIST                     │
├─────────────────────────────────────────────────────────────────────────────┤
│  1. Unambiguous State: Immediately communicates recording is active.       │
│  2. Clear Association: Explicitly shows which meeting/URL is being captured.│
│  3. Duration Telemetry: Real-time tabular monospace counter (00:14:22).     │
│  4. Total User Control: 1-click pause, resume, and confirmable stop.        │
│  5. Visually Prominent, Not Disruptive: Premium light styling with          │
│     both Desktop Expanded and Compact Mini-Pill modes.                     │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. The 6 Core Recording States & Specifications

### 2.1 Desktop Recording State (Expanded Panel)
* **Location:** Floating dock fixed at `bottom-6 right-6 z-40` (`sm:w-[380px]`).
* **Surface:** `bg-white/95 backdrop-blur-md border border-slate-200/90 shadow-xl rounded-2xl p-4 text-slate-900`.
* **Telemetry & Metadata:**
  - **Live Indicator:** 3-stage pulsating emerald beacon (`w-2.5 h-2.5 bg-emerald-500 animate-ping / animate-pulse`).
  - **Status Label:** Monospace badge (`ACTIVE INGRESS` in `text-emerald-700 font-mono text-[10px] font-bold`).
  - **Duration:** Tabular monospace timer pill (`bg-slate-100 border-slate-200 text-slate-900 font-mono font-semibold px-2 py-0.5`).
  - **Meeting Identity:** Truncated meeting title with external Google Meet link icon (`meet.google.com/xxx-xxxx-xxx`).
  - **Voice Activity (VAD):** Equalizer waveform (`24 dynamic frequency bars in emerald, indigo, and teal`) showing live voice activity percentage.
* **Control Actions:**
  - **Pause Ingress:** `bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200` with Play/Pause icon.
  - **Stop & Synthesize:** `bg-rose-600 hover:bg-rose-700 text-white font-semibold shadow-xs`.
  - **Minimize to Compact Pill:** `p-1 rounded-lg text-slate-400 hover:text-slate-700`.

---

### 2.2 Compact Recording Indicator (Floating Mini-Pill)
* **Location:** Floating pill docked at `bottom-6 right-6 z-40`.
* **Surface:** `px-3.5 py-2 rounded-full bg-white/95 backdrop-blur-md border border-slate-200/90 shadow-xl text-slate-900 flex items-center gap-3`.
* **Content:**
  - Pulsating emerald dot.
  - Live timer (`00:14:22` in `font-mono font-bold text-xs text-slate-900`).
  - Meeting title snippet (`Sprint Planning...`).
  - Micro action buttons: Pause, Stop (`text-rose-600`), and Maximize/Expand (`Maximize2`).
* **Purpose:** Allows users to review notes, explore the workspace, or write without screen obstruction while maintaining 100% ambient awareness.

---

### 2.3 Global Header Persistent Indicator (`AppHeader.tsx`)
* **Location:** Embedded in the global top navigation bar (`AppHeader`).
* **Visual Styling:** `flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold`.
* **Elements:**
  - Green pulsing dot.
  - Label: `"Live Recording"`.
* **Guarantees:** Even if the floating widget is closed or minimized, the global header continuously communicates that audio ingress is live.

---

### 2.4 Confirmation Before Stopping Modal (`StopConfirmModal.tsx`)
* **Trigger:** Clicking `"Stop & Synthesize"` in the expanded panel, compact pill, or via emergency keyboard shortcut `Cmd+Shift+R`.
* **Surface:** Elevated white dialog (`bg-white border-slate-200/90 rounded-3xl p-6 sm:p-8 shadow-2xl`) with soft scrim (`bg-slate-900/30 backdrop-blur-xs`).
* **Content:**
  - **Heading:** `"Stop Recording & Synthesize?"` with rose icon badge.
  - **Session Metrics:** Meeting title, total recorded duration (`00:24:18 Recorded`), organizer, and attendee count.
  - **What Happens Next Notice:** Indigo callout explaining that the audio stream will be diarized by speaker and processed into Executive Summary, Key Decisions, Action Items, and Open Questions.
* **Actions:**
  - **Keep Recording:** `bg-transparent hover:bg-slate-100 text-slate-600 text-xs font-medium px-4 py-2 rounded-xl`.
  - **Stop & Generate Summary:** `bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs px-5 py-2.5 rounded-xl shadow-xs flex items-center gap-2`.

---

### 2.5 Recording Stopped & Handoff State
* **Transition:**
  1. Assistant cleanly leaves the Google Meet room.
  2. Floating widget transitions to the Progressive Synthesis Loader (`ProgressiveLoader.tsx`).
  3. Visual feedback displays 5 progressive stages:
     - Stage 1: Sanitizing transcript & identifying speakers (10%–25%)
     - Stage 2: Synthesizing executive summary (25%–50%)
     - Stage 3: Extracting key decisions & grounding quotes (50%–75%)
     - Stage 4: Assigning action items & due dates (75%–90%)
     - Stage 5: Cataloging unresolved questions (90%–100%)
  4. Instant notification toast fires upon completion with decision and action item counts.

---

### 2.6 Recording Failure & Recovery State (`MeetErrorCard.tsx`)
* **Surface:** Soft rose container (`bg-rose-50/80 border border-rose-200 text-slate-900 rounded-2xl p-5 shadow-xs`).
* **Failure Modes Handled:**
  - `HOST_DENIED_ENTRY`: Organizer declined bot admission $\rightarrow$ Action: `"Retry Knocking"`.
  - `WAITING_ROOM_TIMEOUT`: Bot waited 10m in lobby without admission $\rightarrow$ Action: `"Re-send Assistant"`.
  - `OAUTH_EXPIRED`: Google Calendar token revoked $\rightarrow$ Action: `"Reconnect Google Calendar"`.
  - `BOT_MUTED_SILENCE`: VAD detected prolonged silence $\rightarrow$ Action: `"Resume Audio Check"`.
  - `UNSUPPORTED_PLATFORM`: Non-Meet link $\rightarrow$ Action: `"Upload Transcript Instead"`.
* **Guarantees:** Notes and partial audio buffers are never lost.

---

## 3. Component Architecture & Code Links

| Component | File Path | Role |
| :--- | :--- | :--- |
| **Live Recording Widget** | [`src/components/workspace/meet/LiveRecordingWidget.tsx`](file:///Users/yogendrasinghdanu/Downloads/Senior%20Product%20Designer/Meet%20Record/src/components/workspace/meet/LiveRecordingWidget.tsx) | Expanded desktop dock & compact mini-pill |
| **Stop Confirmation Modal** | [`src/components/modals/StopConfirmModal.tsx`](file:///Users/yogendrasinghdanu/Downloads/Senior%20Product%20Designer/Meet%20Record/src/components/modals/StopConfirmModal.tsx) | Accidental stop prevention & pipeline handoff |
| **App Header Indicator** | [`src/components/layout/AppHeader.tsx`](file:///Users/yogendrasinghdanu/Downloads/Senior%20Product%20Designer/Meet%20Record/src/components/layout/AppHeader.tsx) | Persistent top-bar live status pill |
| **Error Card** | [`src/components/workspace/meet/MeetErrorCard.tsx`](file:///Users/yogendrasinghdanu/Downloads/Senior%20Product%20Designer/Meet%20Record/src/components/workspace/meet/MeetErrorCard.tsx) | Contextual recovery & failure modes |
| **Notification Toast** | [`src/components/feedback/NotificationToast.tsx`](file:///Users/yogendrasinghdanu/Downloads/Senior%20Product%20Designer/Meet%20Record/src/components/feedback/NotificationToast.tsx) | Status announcements |
| **Application Wiring** | [`src/App.tsx`](file:///Users/yogendrasinghdanu/Downloads/Senior%20Product%20Designer/Meet%20Record/src/App.tsx) | State management & keyboard shortcuts |

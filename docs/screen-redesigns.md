# Meet Record — Light Mode Screen Redesign Specifications

> **Document Type:** Comprehensive Screen Architecture & UI Specification  
> **Aesthetic Philosophy:** Premium Productivity + Calm AI (Linear • Notion • Raycast • Superhuman)  
> **Design Tokens Reference:** [`docs/light-theme-design-system.md`](file:///Users/yogendrasinghdanu/Downloads/Senior%20Product%20Designer/Meet%20Record/docs/light-theme-design-system.md)  
> **Status:** Specification Approved — Complete 12-Screen System Redesign  
> **Compliance Target:** WCAG 2.1 Level AA & AAA Contrast Standard  

---

## Executive Summary & System-Wide Cohesion

This specification establishes the light-mode UI architecture across all **12 core screens** of NoteFlow AI's Meet Record product. Every screen adheres to a cohesive 4-layer spatial model:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ LAYER 0: Canvas Base (#F8F9FA) — Warm neutral, non-glare foundation          │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │ LAYER 1: Panels & Bars (#F1F5F9 / #FFFFFF border-b) — Nav & Sidebars   │  │
│  │  ┌──────────────────────────────────────────────────────────────────┐  │  │
│  │  │ LAYER 2: Cards & Surfaces (#FFFFFF + border-slate-200/90)        │  │  │
│  │  │  ┌────────────────────────────────────────────────────────────┐  │  │  │
│  │  │  │ LAYER 3: Overlays & Docks (#FFFFFF + shadow-xl / shadow-modal)│  │  │  │
│  │  │  └────────────────────────────────────────────────────────────┘  │  │  │
│  │  └──────────────────────────────────────────────────────────────────┘  │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Screen 1: Home / Dashboard

### 1. Page Hierarchy
1. **Global App Header (Layer 1):** Workspace brand logo, active workspace selector, segmented view switcher (`Home` / `Feed` / `Synthesis`), notification bell, and user SSO avatar.
2. **Hero Ingress & Quick Capture Bar (Layer 2):** Top prominent card with instant Google Meet URL input, clipboard paste auto-detection, and "Join & Record" trigger.
3. **Active/Upcoming Meeting Spotlight (Layer 2 Hero):** Imminent meeting banner (if within $T-15\text{m}$) with live countdown and 1-click ingress opt-in toggle.
4. **Two-Column Dashboard Grid (Layer 2):**
   - *Left Column (60% width):* "Today's Schedule & Ingress Queue" (list of detected Google Meet calls).
   - *Right Column (40% width):* "Recent Synthesized Summaries" & "Pending Action Items" mini-matrix.

### 2. Primary Action
- **Visual Treatment:** `bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-semibold text-xs px-4 py-2 rounded-xl shadow-xs transition-all focus:ring-2 focus:ring-indigo-500`
- **Action:** "Quick Record URL" / "Enable Ingress" on the spotlighted meeting.

### 3. Secondary Actions
- **Sync Calendar:** `bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 shadow-2xs text-xs px-3.5 py-1.5 rounded-xl` with spinning refresh icon on active sync.
- **Upload Transcript Manually:** Text button `text-indigo-600 hover:text-indigo-800 text-xs font-medium`.
- **View All History:** Link button with chevron arrow `text-slate-500 hover:text-slate-900 text-xs`.

### 4. Typography Hierarchy
- **Greeting / View Title:** Display 1 (`24px/32px`, `font-bold`, `text-slate-900`, tracking `-0.03em`) — *"Good morning, Yogendra"*
- **Section Headers:** Heading 2 (`15px/22px`, `font-semibold`, `text-slate-900`, tracking `-0.02em`)
- **Card Titles:** Body Large (`14px/22px`, `font-semibold`, `text-slate-900`)
- **Metadata / Timestamps:** Caption (`12px/16px`, `font-medium`, `text-slate-500`)
- **Meeting URL & Tags:** Micro Monospace (`11px/14px`, `font-mono`, `text-slate-600`)

### 5. Component Structure
- `AppHeader`
- `DashboardContainer` (`max-w-6xl mx-auto space-y-6 p-6 sm:p-8`)
  - `QuickIngressBar` (`flex items-center bg-white border border-slate-200/90 rounded-2xl p-3 shadow-xs`)
  - `ImminentMeetingBanner` (`bg-indigo-50/60 border border-indigo-100 rounded-2xl p-5`)
  - `DashboardGrid` (`grid grid-cols-1 lg:grid-cols-12 gap-6`)
    - `UpcomingQueueCard` (`col-span-7 bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs`)
    - `RecentSummariesCard` (`col-span-5 bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs`)
    - `PendingActionItemsMiniCard` (`col-span-5 bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs`)

### 6. Spacing
- Page padding: `p-6` (tablet) / `p-8` (desktop)
- Component gap: `gap-6` (`24px`)
- Card internal padding: `p-5` (`20px`)
- Row items spacing: `gap-3` (`12px`)

### 7. Visual Emphasis
- Hero Quick Record bar and the Imminent Meeting Spotlight receive primary visual focus through soft indigo surface fills (`#EEF2FF`) and solid indigo CTA button.
- Subtle hairline borders (`border-slate-200/90`) delineate content without heavy dark shadows.

### 8. Status Indicators
- **Connected SSO:** Emerald badge `bg-emerald-50 text-emerald-700 border-emerald-200/80` with a 6px green beacon.
- **Recording Scheduled:** Indigo badge `bg-indigo-50 text-indigo-700 border-indigo-200/80` (`Scheduled T-60s`).
- **Live Ingress Active:** Emerald pulsating badge with `Radio` animated icon.

### 9. Responsive Behaviour
- **Desktop ($\ge 1280\text{px}$):** 2-column asymmetric layout (7:5 ratio), visible sidebar.
- **Tablet ($768\text{px}-1279\text{px}$):** Collapsible icon sidebar, single column stack for cards.
- **Mobile ($< 768\text{px}$):** Full-width stacked layout, floating mobile drawer navigation, quick URL input collapses to compact vertical stack.

---

## Screen 2: Upcoming Meetings (Feed View)

### 1. Page Hierarchy
1. **Calendar Connection Header Bar (Layer 2):** Google Workspace connection badge, sync status (`Last synced 2m ago`), manual sync button, and OAuth reconnect trigger.
2. **Filter & Date Strip (Layer 1):** Day segmented selector (`Today`, `Tomorrow`, `This Week`) and search query input.
3. **Chronological Meeting List (Layer 2):** Stack of detected Google Meet cards with start/end time chips, attendee badges, organizer metadata, and per-meeting opt-in toggle switch.
4. **Opt-In Policy Notice Footer:** Contextual note explaining autonomous assistant knock and disclaimer policies.

### 2. Primary Action
- **Toggle Switch (Per Meeting):** iOS-style segmented toggle switch (`h-6 w-11 rounded-full transition-colors`, `bg-emerald-600` when active, `bg-slate-300` when inactive) to opt-in to recording.
- **Start Ingress Now (Manual Test/Ad-hoc):** `bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 shadow-2xs text-xs px-3 py-1.5 rounded-xl`.

### 3. Secondary Actions
- **Open Google Meet External Link:** Icon link `text-indigo-600 hover:text-indigo-800 text-xs font-medium`.
- **Sync Now:** Header icon button `text-slate-600 hover:text-slate-900`.
- **Connect Other Calendar:** Secondary outline CTA when multiple calendars are unlinked.

### 4. Typography Hierarchy
- **Header Title:** Heading 1 (`18px/26px`, `font-semibold text-slate-900`)
- **Meeting Title:** Heading 2 (`15px/22px`, `font-semibold text-slate-900`)
- **Time Window Pill:** Monospace (`12px/16px`, `font-mono font-medium text-slate-700`)
- **Attendee Metadata:** Caption (`12px/16px`, `font-normal text-slate-500`)

### 5. Component Structure
- `FeedHeaderBar` (`bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs`)
- `DateFilterStrip` (`flex items-center justify-between py-2`)
- `MeetingCardList` (`space-y-3`)
  - `MeetingCard` (`bg-white border border-slate-200/90 hover:border-slate-300 rounded-2xl p-5 transition-all shadow-xs`)
    - `TimeBadge` + `StatusPill` + `ExternalMeetLink`
    - `MeetingTitle` (`text-sm font-semibold text-slate-900`)
    - `OrganizerAndAttendeesRow`
    - `ActionGroup` (`StartIngressButton` + `ToggleSwitch`)

### 6. Spacing
- Container padding: `p-6 sm:p-8`
- Meeting card vertical gap: `space-y-3.5` (`14px`)
- Metadata horizontal gap: `gap-3` (`12px`)

### 7. Visual Emphasis
- Active scheduled meetings highlight with an indigo tint border (`border-indigo-200`) and soft background tint (`bg-indigo-50/30`).
- Toggle switches provide immediate feedback via green fill transitions (`bg-emerald-600`).

### 8. Status Indicators
- **Record: ON:** `bg-emerald-50 text-emerald-700 border-emerald-200` with active green toggle.
- **Record: OFF:** `bg-slate-100 text-slate-600 border-slate-200` with neutral grey toggle.
- **Recording In Progress:** Pulsating emerald beacon with `Ingress in progress...` live status.

### 9. Responsive Behaviour
- **Desktop:** Horizontal layout within each meeting row (Metadata on left, actions & toggle on right).
- **Tablet/Mobile:** Row collapses into a 2-tier vertical stack: metadata on top, action button and full-width toggle bar at bottom.

---

## Screen 3: Meeting Detail

### 1. Page Hierarchy
1. **Meeting Detail Header (Layer 1):** Back navigation breadcrumb (`← All Meetings / Sprint Planning`), editable meeting title, date/duration badges, and quick export bar.
2. **Sub-Navigation Tabs (Layer 1):** Segmented navigation pills (`AI Summary`, `Full Transcript`, `Key Decisions`, `Action Matrix`, `Recording Audio`).
3. **Primary Canvas (Layer 2):** Selected view content container (Executive Summary or Transcript stream).
4. **Metadata & Participant Sidebar (Layer 1):** Right-hand collapsible panel displaying attendee list, RSVP states, organizer, recorded duration, and platform source.

### 2. Primary Action
- **Export & Share:** `bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs px-4 py-2 rounded-xl shadow-xs flex items-center gap-2`.

### 3. Secondary Actions
- **Copy for Slack:** `bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 shadow-2xs text-xs px-3 py-1.5 rounded-xl`.
- **Re-run AI Synthesis:** Outline button with sparkle icon `text-slate-700 hover:text-slate-900`.
- **Delete Meeting:** Ghost destructive button `text-slate-400 hover:text-rose-600`.

### 4. Typography Hierarchy
- **Breadcrumb:** Caption (`12px/16px`, `text-slate-500 font-medium`)
- **Meeting Title:** Display 1 (`24px/32px`, `font-bold text-slate-900 tracking-tight`)
- **Metadata Stats:** Monospace (`11px/14px`, `font-mono text-slate-500`)
- **Section Headers:** Heading 2 (`15px/22px`, `font-semibold text-slate-900`)

### 5. Component Structure
- `MeetingDetailToolbar` (`bg-white border-b border-slate-200/80 px-6 py-3.5`)
- `DetailMainContainer` (`flex-1 flex overflow-hidden`)
  - `ContentCanvas` (`flex-1 overflow-y-auto p-6 sm:p-8 space-y-6 max-w-4xl`)
  - `ParticipantMetaSidebar` (`w-72 bg-[#F9FAFB] border-l border-slate-200/80 p-5 hidden xl:block`)

### 6. Spacing
- Canvas container padding: `p-6` to `p-8`
- Section gap: `space-y-6` (`24px`)
- Sidebar list padding: `p-4` with `gap-2` between participant rows.

### 7. Visual Emphasis
- Pure white content canvas with subtle `#E2E8F0` borders.
- Top title allows 1-click inline editing on hover with a smooth border transition.

### 8. Status Indicators
- **State Pill:** `Synthesized & Ready` in teal (`bg-teal-50 text-teal-700 border-teal-200`).
- **Participant Badges:** `Accepted` (emerald check), `Tentative` (amber clock), `Declined` (slate minus).

### 9. Responsive Behaviour
- **Desktop:** Main canvas + right metadata sidebar.
- **Tablet/Mobile:** Sidebar collapses into a slide-over sheet or modal; toolbar actions collapse into a `...` overflow menu.

---

## Screen 4: Recording State (Live Ingress Active)

### 1. Page Hierarchy
1. **Live Header Banner:** Glowing emerald banner with `Live Audio Capture Active` and room name.
2. **Real-time Audio Visualizer Hero (Layer 2):** Large central Voice Activity Detection (VAD) equalizer waveform showing live decibel levels and speaker detection.
3. **Live Streaming Transcript Preview (Layer 2):** Monospace live scrolling caption feed with auto-scroll lock.
4. **Persistent Floating Dock (Layer 3):** Bottom right or bottom center floating dock with live timer, audio power level, Pause, and Stop & Synthesize controls.

### 2. Primary Action
- **Stop & Synthesize (End Ingress):** `bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs px-4 py-2 rounded-xl shadow-xs flex items-center gap-2`.

### 3. Secondary Actions
- **Pause / Resume Audio Ingress:** `bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium px-3.5 py-2 rounded-xl border border-slate-200`.
- **Mute Local Monitor:** Ghost toggle button.
- **Copy Live Meeting Link:** Icon action.

### 4. Typography Hierarchy
- **Recording Status:** Micro Monospace (`11px/14px`, `font-mono font-bold uppercase tracking-wider text-emerald-700`)
- **Live Tabular Timer:** Display Monospace (`28px/36px`, `font-mono font-bold text-slate-900`) — `00:24:18`
- **Current Speaker:** Heading 2 (`15px/22px`, `font-semibold text-slate-900`)
- **Realtime Captions:** Body Small Monospace (`13px/20px`, `font-mono text-slate-700`)

### 5. Component Structure
- `LiveRecordingHero` (`bg-white border border-emerald-200/90 rounded-2xl p-6 shadow-xs`)
  - `LiveStatusPulse` + `LiveTimerDisplay`
  - `VADWaveformVisualizer` (`h-16 flex items-center gap-1 overflow-hidden px-4 bg-slate-50 rounded-xl`)
  - `LiveSpeakerDetectionBar`
- `LiveTranscriptStream` (`bg-white border border-slate-200/90 rounded-2xl p-5 h-80 overflow-y-auto`)
- `LiveRecordingWidget` (Layer 3 Floating Dock: `fixed bottom-6 right-6 z-40 bg-white/95 backdrop-blur-md border border-slate-200 shadow-xl rounded-2xl p-4`)

### 6. Spacing
- Floating dock internal padding: `p-4` (`16px`)
- Equalizer bar spacing: `gap-1` (`4px`) with `w-1` bars.
- Canvas vertical spacing: `space-y-6`.

### 7. Visual Emphasis
- High-contrast emerald live indicators (`#059669`) with subtle 3-stage keyframe pulsing ring.
- Stop button in vibrant rose (`#E11D48`) to ensure critical termination control is unmissable.

### 8. Status Indicators
- **Active Capture:** Pulsating emerald beacon with `100% Client WebRTC Ingress`.
- **Paused Capture:** Amber beacon with `Capture Paused — Microphone Muted`.
- **Silence / No Audio:** Soft amber warning pill if no voice activity is detected for $>60\text{s}$.

### 9. Responsive Behaviour
- **Desktop:** Full visualizer canvas with floating dock at bottom-right.
- **Mobile:** Floating dock locks to the bottom viewport edge as a fixed bottom bar (`w-full rounded-none border-t shadow-2xl`).

---

## Screen 5: Transcript (Full Speaker Diarized View)

### 1. Page Hierarchy
1. **Transcript Sub-Toolbar (Layer 1):** Search bar (in-transcript keyword search), speaker filter dropdown, format toggle (`Sanitized Clean` vs `Raw .VTT / Timestamps`), and `Copy Full Transcript` button.
2. **Audio Playback Sync Bar (Layer 2 - Optional):** Mini waveform scrubber synced to transcript timestamps.
3. **Diarized Dialogue Stream (Layer 2):** Chronological chat-like dialogue bubbles grouped by speaker with timestamp chips and grounded citation highlight targets.
4. **Search Match Navigator:** Floating mini-stepper (`Match 3 of 12`, `↑` / `↓`).

### 2. Primary Action
- **Copy Formatted Transcript:** `bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 shadow-2xs text-xs px-3.5 py-1.5 rounded-xl font-medium flex items-center gap-2`.

### 3. Secondary Actions
- **Jump to Timestamp:** Click on timestamp pill `[14:22]` to sync playback.
- **Filter by Speaker:** Dropdown select `All Speakers (4)` $\rightarrow$ `Sarah Chen only`.
- **Export Raw .VTT:** Dropdown item.

### 4. Typography Hierarchy
- **Speaker Name:** Heading 2 (`14px/20px`, `font-semibold text-slate-900`)
- **Timestamp Pill:** Caption Monospace (`11px/14px`, `font-mono text-slate-500`)
- **Transcript Speech Body:** Body Large (`14px/22px`, `font-normal text-slate-700 leading-relaxed`)
- **Highlighted Citation Match:** `font-medium text-amber-950 bg-amber-100/90 rounded px-1`

### 5. Component Structure
- `TranscriptToolbar` (`flex items-center justify-between bg-white border border-slate-200/90 rounded-2xl p-3 shadow-xs`)
  - `SearchInputField` + `SpeakerFilterDropdown` + `FormatTogglePill` + `CopyButton`
- `DialogueStreamContainer` (`bg-white border border-slate-200/90 rounded-2xl p-6 space-y-5 shadow-xs`)
  - `SpeakerDialogueBlock` (`space-y-1.5`)
    - `SpeakerHeader` (`Avatar` + `SpeakerName` + `TimestampPill`)
    - `SpeechBubbleText` (`text-sm text-slate-700 leading-relaxed pl-8`)

### 6. Spacing
- Speaker blocks vertical gap: `space-y-5` (`20px`)
- Indentation from avatar: `pl-8` (`32px`)
- Transcript container padding: `p-6`

### 7. Visual Emphasis
- Alternating subtle speaker badge tints (`#EEF2FF` for Speaker 1, `#F0FDF4` for Speaker 2, `#FAF5FF` for Speaker 3) to enable rapid visual scanning.
- Highlighted citation anchor transitions smoothly with an amber outline ring when inspected from AI summary.

### 8. Status Indicators
- **Speaker Count Badge:** `4 Speakers Diarized` (`bg-slate-100 text-slate-700 border-slate-200 font-mono text-[11px]`).
- **Sanitized Indicator:** Green check icon indicating filler words (`"um"`, `"like"`) stripped.

### 9. Responsive Behaviour
- **Desktop:** Full two-tier speaker layout with sidebar search jump list.
- **Mobile:** Compact dialogue list, avatars reduced to 20px initials, search bar docks to top sticky header.

---

## Screen 6: AI Summary (Structured Canvas)

### 1. Page Hierarchy
1. **Refinement Chips Bar (Layer 2):** Top pill selector (`Standard Synthesis`, `Make Shorter`, `Technical Focus`, `Executive Brief`).
2. **Executive Summary Card (Layer 2 Hero):** Pure white card with 3px indigo left accent line and inline markdown editor toggle.
3. **Key Decisions Log Card (Layer 2):** Emerald badge header, structured list with decision statements, rationale callouts, and clickable grounding badges.
4. **Action Items Matrix Card (Layer 2):** Indigo badge header, interactive task checkboxes, `@assignee` tags, due date chips, and inline add/edit triggers.
5. **Unresolved Questions & Parking Lot Card (Layer 2):** Amber badge header, open items list with suggested async follow-up actions.
6. **Grounding Verification Footer (Layer 1):** Accuracy metrics badge (`Extracted with Source Grounding • 100% Citations Verified`).

### 2. Primary Action
- **Export & Share Summary:** `bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs px-4 py-2 rounded-xl shadow-xs flex items-center gap-2`.

### 3. Secondary Actions
- **1-Click Copy for Slack:** `bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 shadow-2xs text-xs px-3 py-1.5 rounded-xl`.
- **Add Manual Decision / Action Item:** Text button `+ Add Decision` in `text-slate-700 hover:text-slate-900 bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-lg`.
- **Refinement Preset Click:** Switch active summary persona instantly.

### 4. Typography Hierarchy
- **Card Section Header:** Heading 2 (`15px/22px`, `font-semibold text-slate-900`)
- **Executive Summary Copy:** Body Large (`14px/22px`, `font-normal text-slate-700 leading-relaxed`)
- **Decision / Task Statements:** Body Small (`13px/19px`, `font-semibold text-slate-900`)
- **Rationale / Follow-up:** Caption (`12px/16px`, `font-normal text-slate-600`)
- **Citation Badges:** Micro Monospace (`10px/14px`, `font-mono font-medium text-indigo-700`)

### 5. Component Structure
- `AIOutputCanvas` (`space-y-5`)
  - `RefinementChips` (`bg-white border border-slate-200/90 rounded-2xl p-3 shadow-2xs`)
  - `ExecutiveSummary` (`bg-white border border-slate-200/90 border-l-[3px] border-l-indigo-600 rounded-2xl p-5 shadow-xs`)
  - `DecisionsLog` (`bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs`)
  - `ActionItemsMatrix` (`bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs`)
  - `QuestionsParkingLot` (`bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs`)
  - `VerificationBadgeBar` (`bg-white border border-slate-200/80 rounded-xl p-3 text-xs`)

### 6. Spacing
- Vertical spacing between summary modules: `space-y-5` (`20px`)
- Card internal padding: `p-5` (`20px`)
- Nested list items padding: `p-3.5` (`14px`)

### 7. Visual Emphasis
- Executive Summary stands out via the solid indigo left border accent (`border-l-indigo-600`).
- Interactive checkboxes in Action Items give crisp tactile satisfaction with strike-through styling.
- Grounding citations (`CitationBadge`) appear as soft indigo pills (`bg-indigo-50 text-indigo-700 border-indigo-100`) that reveal floating source tooltips on hover.

### 8. Status Indicators
- **Decision Count:** `bg-emerald-50 text-emerald-700 border-emerald-200 font-mono text-[11px]`.
- **Pending Tasks:** `bg-indigo-50 text-indigo-700 border-indigo-200 font-mono text-[11px]` (`3 pending`).
- **Open Questions:** `bg-amber-50 text-amber-700 border-amber-200 font-mono text-[11px]`.

### 9. Responsive Behaviour
- **Desktop:** Full structured card column with ample whitespace.
- **Mobile:** Action items metadata tags wrap gracefully; refinement chips scroll horizontally on overflow (`overflow-x-auto no-scrollbar`).

---

## Screen 7: Meeting History (Archive & Directory)

### 1. Page Hierarchy
1. **Directory Header (Layer 1):** Page title, total meeting count badge, export archive button, and batch selection controls.
2. **Search & Multi-Filter Control Bar (Layer 2):** Full-text keyword search, date range picker, platform filter (`All Platforms`, `Google Meet`, `Zoom VTT`, `Manual Notes`), and status filter (`Completed`, `Drafts`, `Errors`).
3. **Data Table / Card Grid View Switcher:** Toggle between structured tabular row view and card view.
4. **Meeting Archive Table / List (Layer 2):** Rows containing Title, Date, Duration, Speakers, Decisions Count, Actions Count, and Quick Actions (`View`, `Copy Slack`, `Delete`).
5. **Pagination & Page Size Footer:** `Showing 1–10 of 48 meetings` + pagination controls (`← Prev`, `1`, `2`, `3`, `Next →`).

### 2. Primary Action
- **New Meeting Note / Start Blank:** `bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs px-4 py-2 rounded-xl shadow-xs flex items-center gap-2`.

### 3. Secondary Actions
- **Batch Export Selected:** Outline button `bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs px-3 py-1.5 rounded-xl`.
- **Filter by Tag / Project:** Dropdown menu.
- **Quick Row Actions:** Hover icons for `Copy Slack`, `Share`, and `Delete`.

### 4. Typography Hierarchy
- **Directory Title:** Display 1 (`24px/32px`, `font-bold text-slate-900 tracking-tight`)
- **Table Column Headers:** Micro Tag (`11px/14px`, `font-semibold uppercase tracking-wider text-slate-500`)
- **Row Title:** Body Small (`13px/19px`, `font-semibold text-slate-900 hover:text-indigo-600`)
- **Table Cell Text:** Caption (`12px/16px`, `font-normal text-slate-600`)
- **Monospace Metadata:** Monospace (`11px/14px`, `font-mono text-slate-500`)

### 5. Component Structure
- `HistoryPageHeader` (`flex items-center justify-between pb-6`)
- `FilterToolbar` (`bg-white border border-slate-200/90 rounded-2xl p-3.5 mb-5 shadow-xs flex flex-wrap items-center gap-3`)
- `ArchiveTableContainer` (`bg-white border border-slate-200/90 rounded-2xl overflow-hidden shadow-xs`)
  - `TableHeaderRow` (`bg-slate-50 border-b border-slate-200/80 px-5 py-3`)
  - `TableRowList` (`divide-y divide-slate-100`)
    - `MeetingRowItem` (`hover:bg-slate-50/70 transition-colors px-5 py-3.5 flex items-center justify-between`)
- `PaginationFooter` (`flex items-center justify-between px-5 py-3.5 bg-slate-50/60 border-t border-slate-200/80`)

### 6. Spacing
- Page padding: `p-6 sm:p-8`
- Table row internal padding: `px-5 py-3.5` (`20px / 14px`)
- Cell gap: `gap-4`

### 7. Visual Emphasis
- Clean white rows with subtle slate hover highlights (`hover:bg-slate-50/80`).
- Status badges give immediate clarity on meeting synthesis readiness.

### 8. Status Indicators
- **Completed:** Teal pill `bg-teal-50 text-teal-700 border-teal-200`.
- **Draft:** Slate pill `bg-slate-100 text-slate-600 border-slate-200`.
- **Error:** Rose pill `bg-rose-50 text-rose-700 border-rose-200`.

### 9. Responsive Behaviour
- **Desktop:** Full multi-column data table with complete metrics.
- **Tablet/Mobile:** Table transforms into stacked meeting cards with compact badge rows.

---

## Screen 8: Integration Settings (Google Meet & Calendar)

### 1. Page Hierarchy
1. **Settings Navigation Tab Bar:** Top/Side tab bar (`Integrations`, `Account & SSO`, `AI Models & Prompts`, `Data & Privacy`).
2. **Platform Integrations Directory (Layer 2):** List of integration modules:
   - *Google Workspace / Calendar (Primary - Active)*
   - *Zoom Video Communications (Phase 2 - Coming Soon)*
   - *Microsoft Teams (Phase 2 - Coming Soon)*
   - *Slack Bot & Webhooks (Active)*
3. **Active Connection Detail Panel (Layer 2):** Connection status card for Google Calendar with OAuth token validity, scopes granted, auto-join defaults, and disconnect option.
4. **Ingress Preferences Card (Layer 2):** Configurable defaults (e.g. `Auto-record meetings where I am the host`, `Dispatch assistant 60s before start`, `Post chat disclaimer`).

### 2. Primary Action
- **Save Ingress Preferences:** `bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs px-4 py-2 rounded-xl shadow-xs`.

### 3. Secondary Actions
- **Disconnect Google Calendar:** Destructive outline button `text-rose-600 hover:bg-rose-50 border border-rose-200 text-xs px-3 py-1.5 rounded-xl`.
- **Re-authenticate OAuth:** `bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs px-3 py-1.5 rounded-xl`.
- **Test Webhook:** Secondary button.

### 4. Typography Hierarchy
- **Section Title:** Heading 1 (`18px/26px`, `font-semibold text-slate-900`)
- **Card Title:** Heading 2 (`15px/22px`, `font-semibold text-slate-900`)
- **Description Copy:** Body Small (`13px/20px`, `font-normal text-slate-600 leading-relaxed`)
- **Scope Details:** Caption Monospace (`11px/14px`, `font-mono text-slate-500`)

### 5. Component Structure
- `SettingsLayout` (`max-w-4xl mx-auto space-y-6 p-6 sm:p-8`)
  - `ConnectedCalendarCard` (`bg-white border border-slate-200/90 rounded-2xl p-6 shadow-xs`)
    - `PlatformHeader` (`GoogleCalendarIcon` + `AccountEmail` + `ConnectedBadge`)
    - `ScopeSummaryBox` (`bg-indigo-50/50 border border-indigo-100 rounded-xl p-4`)
    - `ActionRow` (`ReauthButton` + `DisconnectButton`)
  - `AutomationPreferencesCard` (`bg-white border border-slate-200/90 rounded-2xl p-6 shadow-xs`)
    - `ToggleOptionRows` (3x setting rows with title, description, and iOS switch)
  - `UpcomingIntegrationsCard` (`bg-white border border-slate-200/90 rounded-2xl p-6 shadow-xs`)

### 6. Spacing
- Settings card gap: `space-y-6` (`24px`)
- Setting row padding: `py-3.5` with hairline dividers.

### 7. Visual Emphasis
- Connected status card highlighted with an emerald badge and secure lock iconography.
- Disabled "Coming Soon" integrations rendered with a soft muted slate wash (`opacity-60`).

### 8. Status Indicators
- **Connected & Synced:** `bg-emerald-50 text-emerald-700 border-emerald-200` with `Verified OAuth Token (AES-256 Encrypted)`.
- **OAuth Expired / Revoked:** `bg-rose-50 text-rose-700 border-rose-200`.

### 9. Responsive Behaviour
- Full-width stacked layout across desktop, tablet, and mobile with generous tap targets ($\ge 44\text{px}$) for toggle switches.

---

## Screen 9: Account Settings & Privacy Controls

### 1. Page Hierarchy
1. **User Profile Card (Layer 2):** Avatar upload/initials, full name, email address, role badge (`Workspace Admin`), and SSO provider info.
2. **Data Retention & Privacy Controls Card (Layer 2):**
   - Audio buffer retention setting (`Immediate purge after STT` vs `Keep for 7 days`).
   - AI Model Training Opt-Out toggle (Enforced ON by default).
   - Export all workspace data (GDPR / CCPA data takeout).
3. **Security & Session Management Card (Layer 2):** Active device sessions, last login IP, and 2FA status.
4. **Danger Zone Card (Layer 2 - Destructive):** Permanently delete account and all meeting recordings.

### 2. Primary Action
- **Update Account Profile:** `bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs px-4 py-2 rounded-xl shadow-xs`.

### 3. Secondary Actions
- **Request Data Export (.ZIP):** `bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 shadow-2xs text-xs px-3.5 py-1.5 rounded-xl`.
- **Log Out Other Sessions:** Ghost action button.
- **Delete Account:** Destructive button in `bg-rose-600 hover:bg-rose-700 text-white`.

### 4. Typography Hierarchy
- **Page Title:** Display 1 (`24px/32px`, `font-bold text-slate-900`)
- **Card Headings:** Heading 2 (`15px/22px`, `font-semibold text-slate-900`)
- **Form Labels:** Caption (`12px/16px`, `font-medium text-slate-700`)
- **Privacy Guarantees:** Caption (`12px/18px`, `font-normal text-slate-500`)

### 5. Component Structure
- `AccountSettingsContainer` (`max-w-4xl mx-auto space-y-6 p-6 sm:p-8`)
  - `ProfileCard` (`bg-white border border-slate-200/90 rounded-2xl p-6 shadow-xs`)
  - `PrivacyAndDataPolicyCard` (`bg-white border border-slate-200/90 rounded-2xl p-6 shadow-xs`)
  - `SessionSecurityCard` (`bg-white border border-slate-200/90 rounded-2xl p-6 shadow-xs`)
  - `DangerZoneCard` (`bg-rose-50/40 border border-rose-200 rounded-2xl p-6 shadow-xs`)

### 6. Spacing
- Vertical card separation: `space-y-6` (`24px`)
- Internal form grid gap: `gap-4` (`16px`)

### 7. Visual Emphasis
- Strict Privacy Guarantee callouts highlighted in soft indigo cards with `ShieldCheck` icons.
- Danger zone isolated in a dedicated soft rose card (`bg-rose-50/40 border-rose-200`).

### 8. Status Indicators
- **SSO Status:** `Google SSO Verified` badge in emerald.
- **2FA Active:** `Enabled` badge in emerald.

### 9. Responsive Behaviour
- Form grid collapses from 2 columns on desktop to 1 column on mobile.

---

## Screen 10: Empty States (Zero Data, No Calendar, No Meetings)

### 1. Page Hierarchy
1. **Empty State Illustrated Container (Layer 2):** Centered card on canvas with generous vertical padding.
2. **Subtle Feature Icon Hero:** 48px icon badge with soft colored tint (`bg-indigo-50 border border-indigo-100 text-indigo-600`).
3. **Contextual Heading & Subtitle:** Clear, encouraging text explaining the empty scenario without technical jargon.
4. **Feature Value Cards (3-Pill Grid):** Quick visual proof of what NoteFlow AI produces (`Key Decisions`, `Action Items`, `Open Questions`).
5. **Direct Call-to-Action Buttons (Primary + Sample Loaders):** Immediate 1-click paths to test the app without manual typing.

### 2. Primary Action
- **Connect Calendar / Start Blank Meeting:** `bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs px-5 py-2.5 rounded-xl shadow-xs flex items-center gap-2`.

### 3. Secondary Actions
- **Load Sample Meeting (1-on-1 Reorg Pod Sync):** `bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs px-4 py-2.5 rounded-xl font-medium`.
- **Load Zoom VTT Sample:** `bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 shadow-2xs text-xs px-4 py-2.5 rounded-xl`.

### 4. Typography Hierarchy
- **Empty State Headline:** Display 1 (`22px/30px`, `font-bold text-slate-900 tracking-tight`)
- **Descriptive Body:** Body Large (`14px/22px`, `font-normal text-slate-600 max-w-lg mx-auto`)
- **Pill Feature Titles:** Heading 2 (`13px/18px`, `font-semibold text-slate-900`)
- **Pill Feature Captions:** Caption (`11px/15px`, `font-normal text-slate-500`)

### 5. Component Structure
- `EmptyStateContainer` (`flex-1 flex flex-col items-center justify-center p-8 max-w-3xl mx-auto text-center`)
  - `HeroIconBadge` (`w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 mb-5`)
  - `TitleAndDescription`
  - `FeaturePillsGrid` (`grid grid-cols-1 sm:grid-cols-3 gap-3 my-8 w-full max-w-xl text-left`)
    - `FeatureCard` (x3: `p-3.5 rounded-xl bg-white border border-slate-200/90 shadow-2xs`)
  - `ActionButtonsCluster` (`flex flex-wrap items-center justify-center gap-2.5`)
  - `PrivacyNoticeFooter` (`text-[11px] font-mono text-slate-400 mt-8`)

### 6. Spacing
- Vertical container padding: `py-16 px-6`
- Gap between feature cards: `gap-3` (`12px`)
- Button cluster gap: `gap-2.5` (`10px`)

### 7. Visual Emphasis
- Clean, calm whitespace without distracting illustrations or full-page splash artwork.
- Soft indigo accents anchor user focus directly onto the sample triggers.

### 8. Status Indicators
- **Client-Side Processing Guarantee:** Muted shield tag at bottom.

### 9. Responsive Behaviour
- Feature cards stack vertically on mobile screens ($< 640\text{px}$) and expand to a 3-column row on tablet/desktop.

---

## Screen 11: Loading States (Progressive 5-Stage Synthesis & Skeletons)

### 1. Page Hierarchy
1. **Progressive Synthesis Hero Card (Layer 2):** Top loader card with spinning AI synthesis beacon, stage title, and percentage completion.
2. **Animated Multi-Stop Gradient Progress Bar:** 6px bar with smooth transition (`from-indigo-500 via-indigo-600 to-emerald-500`).
3. **5-Stage Sequential Checklist:** Live stage validation steps with checkmarks and active spinners:
   - *1. Sanitizing transcript & identifying speakers*
   - *2. Synthesizing executive summary*
   - *3. Extracting key decisions & grounding quotes*
   - *4. Assigning action items & due dates*
   - *5. Cataloging unresolved questions*
4. **Shimmer Skeleton Canvas Preview (Layer 2):** Muted pulsating placeholder cards mimicking the finished structured cards.

### 2. Primary Action
- No primary clickable action (State is non-blocking and automated). "Cancel Synthesis" available as secondary escape hatch.

### 3. Secondary Actions
- **Cancel Synthesis / Return to Draft:** Text link `text-slate-400 hover:text-slate-600 text-xs`.

### 4. Typography Hierarchy
- **Loader Header:** Heading 2 (`15px/22px`, `font-semibold text-slate-900`)
- **Stage Subtitle:** Caption (`12px/16px`, `font-normal text-slate-500`)
- **Percentage Counter:** Monospace (`12px/16px`, `font-mono font-semibold text-indigo-600`)
- **Checklist Step Labels:** Caption (`12px/16px`, active: `font-semibold text-indigo-700`, completed: `text-slate-700`, pending: `text-slate-400`)

### 5. Component Structure
- `ProgressiveLoader` (`bg-white border border-slate-200/90 rounded-2xl p-6 shadow-xs space-y-5 animate-fadeIn`)
  - `HeaderAndPercentageRow` (`LoaderIcon` + `TitleBlock` + `ProgressCounter`)
  - `ProgressBarTrack` (`h-1.5 w-full bg-slate-100 rounded-full overflow-hidden`)
  - `ChecklistStepList` (`space-y-2 pt-2 border-t border-slate-100`)
    - `StepRow` (x5: `CheckCircle2` / `SpinningRing` / `EmptyCircle` + `Label`)
  - `SkeletonShimmerCanvas` (`space-y-3 pt-3 border-t border-slate-100`)
    - `SkeletonBar` (`h-3.5 bg-slate-100 rounded-md animate-pulse`)

### 6. Spacing
- Internal card padding: `p-6` (`24px`)
- Step item gap: `py-1` (`4px`)

### 7. Visual Emphasis
- High-accuracy progress bar delivers immediate reassurance that the AI is progressing through exact linguistic passes.
- Skeleton pulses in neutral `#F1F5F9` without harsh flashing.

### 8. Status Indicators
- **Active Step:** Indigo spinning ring (`w-4 h-4 rounded-full border-2 border-indigo-600 border-t-transparent animate-spin`).
- **Completed Step:** Emerald checkmark (`CheckCircle2 text-emerald-600`).
- **Pending Step:** Slate wire circle (`border-slate-300`).

### 9. Responsive Behaviour
- Stays compact and responsive on all viewports, locking to `max-w-4xl mx-auto`.

---

## Screen 12: Error States (Ingress Failure, OAuth Revocation, Interrupted Capture)

### 1. Page Hierarchy
1. **Contextual Alert Hero (Layer 2):** Soft rose card (`bg-rose-50/80 border border-rose-200`) with distinct error icon (`Host Denied Entry`, `Waiting Room Timeout`, `OAuth Expired`, `Silence Detected`).
2. **Error Diagnostic Explainer:** Clear breakdown of why the event occurred, what data was preserved, and what action will resolve it.
3. **Data Preservation Guarantee Box:** Explicit reassurance box (`"Your notes and partial transcript are safely preserved"`).
4. **Action Recovery Button Cluster:** 1-click retry button, OAuth re-connection CTA, or fallback manual `.vtt` file dropzone.

### 2. Primary Action
- **Retry Ingress / Reconnect OAuth:** `bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs px-4 py-2 rounded-xl shadow-xs flex items-center gap-2 cursor-pointer`.

### 3. Secondary Actions
- **Upload Transcript Instead:** `bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs px-3.5 py-1.5 rounded-xl shadow-2xs`.
- **Dismiss Alert:** Ghost icon button.
- **Copy Diagnostic Log:** Monospace link button for support tickets.

### 4. Typography Hierarchy
- **Error Badge:** Micro Tag (`10px/14px`, `font-mono font-semibold uppercase tracking-wider text-rose-700 bg-rose-100 px-2 py-0.5 rounded-full border border-rose-200`)
- **Error Heading:** Heading 2 (`15px/22px`, `font-semibold text-slate-900`)
- **Error Explanation:** Body Small (`13px/20px`, `font-normal text-slate-600 leading-relaxed`)
- **Preservation Box:** Caption (`12px/16px`, `font-medium text-slate-800`)

### 5. Component Structure
- `MeetErrorCard` (`bg-rose-50/80 border border-rose-200 rounded-2xl p-5 shadow-xs space-y-4`)
  - `ErrorHeaderBlock` (`IconContainer` (`bg-rose-100 text-rose-600`) + `TitleAndBadge` + `Description`)
  - `SafePreservationBox` (`bg-white rounded-xl p-3 border border-rose-100 text-xs`)
  - `RecoveryActionRow` (`ManualUploadButton` + `PrimaryRetryButton`)

### 6. Spacing
- Error card padding: `p-5` (`20px`)
- Icon container: `p-2.5` (`10px`) with 20px icon.
- Actions gap: `gap-2` (`8px`)

### 7. Visual Emphasis
- Soft rose background tone (`#FFF1F2`) alerts the user without creating alarmist visual clutter.
- Action recovery buttons provide high contrast for immediate resolution.

### 8. Status Indicators
- **Error Code Tag:** `HOST_DENIED_ENTRY`, `OAUTH_EXPIRED`, `WAITING_ROOM_TIMEOUT`, or `BOT_MUTED_SILENCE` in monospace.

### 9. Responsive Behaviour
- Recovery buttons wrap into a full-width column on mobile screens for effortless thumb activation.

---

## Systematic Cross-Screen Consistency Matrix

| Dimension | Screen 1–3 (Home, Feed, Detail) | Screen 4–6 (Live, Transcript, AI) | Screen 7–9 (History, Settings) | Screen 10–12 (Empty, Loading, Error) |
| :--- | :--- | :--- | :--- | :--- |
| **Canvas Background** | `#F8F9FA` | `#F8F9FA` | `#F8F9FA` | `#F8F9FA` |
| **Card Surface** | `#FFFFFF` (`border-slate-200/90`) | `#FFFFFF` (`border-slate-200/90`) | `#FFFFFF` (`border-slate-200/90`) | `#FFFFFF` or `#FFF1F2` (Errors) |
| **Primary Button** | Indigo-600 (`#4F46E5`) | Indigo-600 / Rose-600 (Stop) | Indigo-600 (`#4F46E5`) | Indigo-600 / Rose-600 (Retry) |
| **Borders** | 1px Solid `#E2E8F0` | 1px Solid `#E2E8F0` | 1px Solid `#E2E8F0` | 1px Solid `#E2E8F0` / `#FECDD3` |
| **Card Radius** | `rounded-2xl` (`16px`) | `rounded-2xl` (`16px`) | `rounded-2xl` (`16px`) | `rounded-2xl` (`16px`) |
| **Elevation** | `shadow-xs` / `shadow-2xs` | `shadow-xs` / `shadow-xl` (Dock) | `shadow-xs` | `shadow-xs` / `shadow-2xs` |
| **Font Family** | `Outfit` (Headings) / `Inter` | `Outfit` / `Inter` / Monospace | `Outfit` / `Inter` | `Outfit` / `Inter` |

# Meet Record — Redesigned AI Meeting Summary Experience

> **Document Type:** AI Meeting Summary Architecture & Design Specification  
> **Aesthetic Philosophy:** Premium Productivity + Calm AI (Linear • Notion • Raycast • Superhuman)  
> **Design Tokens Reference:** [`docs/light-theme-design-system.md`](file:///Users/yogendrasinghdanu/Downloads/Senior%20Product%20Designer/Meet%20Record/docs/light-theme-design-system.md)  
> **Status:** Fully Implemented & Verified  

---

## 1. Design Overview & Objectives

The AI Meeting Summary redesign solves the fundamental challenge of modern meeting intelligence: **distinguishing human ground-truth context from AI-generated synthesis while maximizing readability and scanability.**

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                   HUMAN CONTENT VS AI INSIGHTS HIERARCHY                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  [LEVEL 1: HUMAN MEETING CONTEXT]                                           │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │ 1. Meeting Title (Editable Display Heading)                           │  │
│  │ 2. Date / Time / Duration (Monospace Pills)                           │  │
│  │ 3. Human Participants & Detected Speakers (Avatar Cluster + Host Tag) │  │
│  │ 4. Verbatim Transcript Access (Direct 1-Click Drawer Trigger)         │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  [LEVEL 2: AI-GENERATED INSIGHTS & SYNTHESIS]                               │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │ 5. AI Synthesis Header & Refinement Chips (Standard, Brief, Tech)    │  │
│  │ 6. Executive Summary (Editorial Left Indigo Accent + Inline Markdown) │  │
│  │ 7. Important Discussion Points & Agenda Topics (Contributor Tags)     │  │
│  │ 8. Key Decisions Log (Emerald Badges + Rationale + Citation Backlinks)│  │
│  │ 9. Action Items Matrix (Interactive Checkboxes + @Assignee + Dates)   │  │
│  │ 10. Open Questions & Parking Lot (Amber Badges + Async Next Steps)    │  │
│  │ 11. Grounding Verification Strip (100% Verified Citations Guarantee)  │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Detailed Structure of the 9 Core Summary Elements

### 1. Meeting Title
* **Type:** Human Ground-Truth Header.
* **Styling:** Display Heading (`text-xl font-bold text-slate-900 tracking-tight`).
* **Interaction:** 1-click inline editing on click or hover with smooth outline transitions.

### 2. Date / Time / Duration
* **Type:** Human Metadata.
* **Styling:** Formatted calendar string (`Mon, Aug 19, 2026 at 02:00 PM`) + Duration Monospace Pill (`~24 min duration`, `351 words`).

### 3. Human Participants & Detected Speakers
* **Type:** Human Identity.
* **Styling:** Rounded avatar pills with two-letter uppercase monogram (`YD`, `SC`, `MB`) and speaker name (`Sarah Chen (Host)`, `Marcus Brody`).

### 4. Direct Transcript Access
* **Type:** Ground-Truth Navigation.
* **Styling:** Prominent header button (`View Source Transcript (351 words)`) that slides open the verified transcript drawer with monospace line numbers and amber citation targets.

### 5. AI-Generated Summary (Executive Brief)
* **Type:** AI Synthesis.
* **Styling:** Pure white card with solid 3px indigo left-border accent (`border-l-[3px] border-l-indigo-600 bg-white p-5 shadow-xs`).
* **Prose:** High line-height (`leading-relaxed font-normal text-slate-700`), bold key takeaways, inline markdown editor toggle, and 1-click copy.

### 6. Important Discussion Points
* **Type:** AI Synthesis.
* **Styling:** Dedicated structured card ([`DiscussionPoints.tsx`](file:///Users/yogendrasinghdanu/Downloads/Senior%20Product%20Designer/Meet%20Record/src/components/workspace/output/DiscussionPoints.tsx)) grouping major topics, discussion summaries, contributing speaker pills, and grounded source quote links.

### 7. Key Decisions Log
* **Type:** AI Synthesis.
* **Styling:** Emerald badge header (`Key Decisions (2)` in `bg-emerald-50 text-emerald-700 border-emerald-200`), structured cards with bold decision statements, emerald rationale callout containers, and clickable `CitationBadge` pills (`@Sarah 00:31`).

### 8. Action Items Matrix
* **Type:** AI Synthesis.
* **Styling:** Indigo badge header (`Action Items (3 pending)`), tactile interactive custom checkboxes with strike-through completed styling, `@assignee` tags, priority chips, and due dates.

### 9. Open Questions & Parking Lot
* **Type:** AI Synthesis.
* **Styling:** Warm amber badge header (`Open Questions (2)` in `bg-amber-50 text-amber-700 border-amber-200`), cataloging open questions, unresolved dependencies, and suggested async next steps.

---

## 3. Readability, Scanability & Grounding Heuristics

1. **Restrained AI Visual Language:** Zero neon gradients, pulsating purple blobs, or gimmicky animations. AI content is dignified through crisp typography, whitespace, and clean hairline boundaries.
2. **100% Source Grounding:** Every extracted decision, action, and question includes a clickable citation pill (`CitationBadge`) that shows the verbatim transcript quote on hover and jumps to the exact line in the transcript drawer on click.
3. **Refinement Personas:** Users can toggle between `Standard Synthesis`, `Executive Brief`, `Technical Focus`, and `Make Shorter` with instant UI re-rendering.
4. **1-Click Slack / Markdown Export:** Instant copy formatted for team asynchronous channels.

---

## 4. Component Inventory

| Component | File Path | Responsibilities |
| :--- | :--- | :--- |
| **Meeting Header Banner** | [`src/components/workspace/output/MeetingHeaderBanner.tsx`](file:///Users/yogendrasinghdanu/Downloads/Senior%20Product%20Designer/Meet%20Record/src/components/workspace/output/MeetingHeaderBanner.tsx) | Title, date/time, participants, platform link, transcript CTA |
| **AI Output Canvas** | [`src/components/workspace/output/AIOutputCanvas.tsx`](file:///Users/yogendrasinghdanu/Downloads/Senior%20Product%20Designer/Meet%20Record/src/components/workspace/output/AIOutputCanvas.tsx) | Root structured canvas coordinating modules & refinement |
| **Executive Summary** | [`src/components/workspace/output/ExecutiveSummary.tsx`](file:///Users/yogendrasinghdanu/Downloads/Senior%20Product%20Designer/Meet%20Record/src/components/workspace/output/ExecutiveSummary.tsx) | Hero summary with left indigo accent and markdown editing |
| **Discussion Points** | [`src/components/workspace/output/DiscussionPoints.tsx`](file:///Users/yogendrasinghdanu/Downloads/Senior%20Product%20Designer/Meet%20Record/src/components/workspace/output/DiscussionPoints.tsx) | Agenda topics, discussion summaries, contributor tags |
| **Decisions Log** | [`src/components/workspace/output/DecisionsLog.tsx`](file:///Users/yogendrasinghdanu/Downloads/Senior%20Product%20Designer/Meet%20Record/src/components/workspace/output/DecisionsLog.tsx) | Key decisions, rationale callouts, grounded citations |
| **Action Items Matrix** | [`src/components/workspace/output/ActionItemsMatrix.tsx`](file:///Users/yogendrasinghdanu/Downloads/Senior%20Product%20Designer/Meet%20Record/src/components/workspace/output/ActionItemsMatrix.tsx) | Checkboxes, assignees, due dates, priority tags |
| **Questions Parking Lot** | [`src/components/workspace/output/QuestionsParkingLot.tsx`](file:///Users/yogendrasinghdanu/Downloads/Senior%20Product%20Designer/Meet%20Record/src/components/workspace/output/QuestionsParkingLot.tsx) | Unresolved questions, suggested async next steps |
| **Citation Badge** | [`src/components/workspace/output/CitationBadge.tsx`](file:///Users/yogendrasinghdanu/Downloads/Senior%20Product%20Designer/Meet%20Record/src/components/workspace/output/CitationBadge.tsx) | Clickable grounded quote pill with floating tooltip |
| **Source Drawer** | [`src/components/workspace/input/SourceDrawer.tsx`](file:///Users/yogendrasinghdanu/Downloads/Senior%20Product%20Designer/Meet%20Record/src/components/workspace/input/SourceDrawer.tsx) | Grounded verbatim transcript viewer |

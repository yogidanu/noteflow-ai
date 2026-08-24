# NoteFlow AI — Agent Guidelines & Repository Guide

Welcome to the **NoteFlow AI (Senior Product Designer)** codebase. This document outlines the project architecture, design system, core modules, data contracts, and development guidelines for AI agents and engineers working in this repository.

---

## 1. Project Overview

**NoteFlow AI** is a client-side AI meeting notes synthesizer and intelligence workspace built for product teams, designers, and engineering leads. It transforms raw, unstructured meeting notes, bullet points, and multi-speaker transcripts (Zoom `.vtt`, Teams, Google Meet) into grounded executive summaries, key decisions with rationales, actionable task matrices, and open question parking lots.

### Core Value Proposition
- **Deep Context & Grounding:** Accurately attributes speakers, preserves meeting context, and links decisions/tasks directly to exact transcript quotes via interactive citations.
- **Zero Artificial Filler:** Never fabricates fake default decisions or tasks when notes are purely informational.
- **Dynamic Refinement:** Tailors summaries across 5 operational perspectives (*Standard*, *Executive Briefing*, *Action-Focused*, *Technical & Scope*, *Shorter Digest*).
- **Client-Side Privacy:** All processing, parsing, and state management occurs locally in the browser with localStorage persistence.

---

## 2. Technology Stack

| Layer | Technology |
| :--- | :--- |
| **Framework** | React 19 (Hooks, Functional Components, Strict Mode) |
| **Language** | TypeScript (Strict mode, ES Modules) |
| **Build & Dev Tool** | Vite 8 + `@vitejs/plugin-react` |
| **Styling** | Tailwind CSS v4 (`@tailwindcss/postcss`, PostCSS) + Custom Design Tokens |
| **Animation & UX** | Framer Motion + Canvas Confetti |
| **Icons** | Lucide React |
| **Linter** | Oxlint (`npm run lint`) |

---

## 3. Directory Structure

```text
├── index.html
├── package.json
├── tsconfig.json
├── tsconfig.app.json
├── vite.config.ts
├── tailwind.config.js
├── postcss.config.js
├── public/
└── src/
    ├── main.tsx                         # App entry point
    ├── App.tsx                          # Root workspace container & global keyboard shortcuts
    ├── App.css
    ├── index.css                        # Design tokens, custom scrollbars, keyframe animations
    ├── types/
    │   └── meeting.ts                   # Core data interfaces (MeetingNote, AIAnalysisResult, ActionItem, etc.)
    ├── hooks/
    │   ├── useMeetings.ts               # CRUD state management, active selection, localStorage sync
    │   └── useAISummarizer.ts           # Generation lifecycle state machine & progress streaming
    ├── lib/
    │   ├── aiEngine.ts                  # Semantic extraction, contextual summarizer & refinement engine
    │   ├── transcriptSanitizer.ts       # Multi-format transcript parser & speaker normalization
    │   ├── sampleData.ts                # Curated sample meetings (1-on-1 Reorg, Q3 Architecture, Mobile V2)
    │   ├── exportFormatters.ts          # Markdown, Slack, Plain Text formatters & clipboard helper
    │   └── utils.ts                     # Utility functions (cn, class merger)
    └── components/
        ├── layout/
        │   ├── AppHeader.tsx            # Navigation header, sample reset, mobile drawer toggle
        │   └── Sidebar/
        │       ├── Sidebar.tsx          # Meeting list container, new meeting CTA, storage counts
        │       ├── MeetingCard.tsx      # Individual meeting item with delete, badge, and date
        │       └── SearchFilter.tsx     # Instant meeting search & filter input
        ├── workspace/
        │   ├── WorkspaceCanvas.tsx      # Central dynamic canvas switching between Draft, Loading, & Completed
        │   ├── MeetingToolbar.tsx       # Title editor, export trigger, source drawer toggle, metadata stats
        │   ├── EmptyState.tsx           # Zero-meeting & blank workspace state with quick sample presets
        │   ├── input/
        │   │   ├── UnifiedDropzone.tsx  # Drag-and-drop file ingestion, raw textarea, sample chips
        │   │   └── SourceDrawer.tsx     # Side drawer displaying grounded transcript with active quote highlighting
        │   ├── output/
        │   │   ├── AIOutputCanvas.tsx   # Structured output layout containing all synthesized cards
        │   │   ├── ExecutiveSummary.tsx # Multi-paragraph executive summary with inline editing & copy
        │   │   ├── DecisionsLog.tsx     # Decision items with confidence badges, rationales & citations
        │   │   ├── ActionItemsMatrix.tsx# Interactive task checklist with priority, assignee, due date
        │   │   ├── QuestionsParkingLot.tsx # Unresolved questions with suggested follow-up actions
        │   │   ├── RefinementChips.tsx  # Quick prompt refinement switcher (Executive, Technical, etc.)
        │   │   └── CitationBadge.tsx    # Clickable grounded quote badge linking to transcript
        │   ├── feedback/
        │   │   ├── ProgressiveLoader.tsx# 5-stage progressive synthesis progress bar
        │   │   └── ErrorCard.tsx        # Inline failure card with retry trigger
        └── modals/
            ├── ExportModal.tsx          # Multi-format export dialog (Markdown, Slack, JSON)
            └── ConfirmDeleteModal.tsx   # Destructive action confirmation dialog
```

---

## 4. Key Data Models (`src/types/meeting.ts`)

```typescript
export interface SourceCitation {
  id: string;
  speaker?: string;
  timestamp?: string; // e.g. "00:31"
  rawText: string;
  lineIndex?: number;
}

export interface DecisionItem {
  id: string;
  text: string;
  rationale?: string;
  confidence?: "high" | "tentative";
  citation?: SourceCitation;
  isEdited?: boolean;
}

export interface ActionItem {
  id: string;
  task: string;
  assignee?: string;
  dueDate?: string;
  isCompleted: boolean;
  priority?: "high" | "medium" | "low";
  citation?: SourceCitation;
  isEdited?: boolean;
}

export interface UnresolvedQuestion {
  id: string;
  question: string;
  suggestedFollowUp?: string;
  citation?: SourceCitation;
  isEdited?: boolean;
}

export interface AIAnalysisResult {
  executiveSummary: string;
  decisions: DecisionItem[];
  actionItems: ActionItem[];
  unresolvedQuestions: UnresolvedQuestion[];
  detectedSpeakers: string[];
  wordCount: number;
  estimatedMeetingDurationMinutes: number;
  modelConfidence: "high" | "moderate" | "low";
  appliedRefinement?: string;
}

export interface MeetingNote {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  rawInput: string;
  sanitizedInput: string;
  inputFormat: "vtt" | "teams" | "meet" | "bullets" | "raw";
  isSample?: boolean;
  status: "draft" | "generating" | "completed" | "error";
  errorMessage?: string;
  analysis?: AIAnalysisResult;
}
```

---

## 5. Architectural & Behavioral Guidelines

When making changes to this codebase, adhere strictly to the following principles:

### 1. Grounding & Anti-Hallucination
- **No Dummy Fillers:** If an input transcript or note contains no decisions, `decisions` must remain empty `[]`. Do not inject artificial default tasks or questions.
- **Speaker Resolution:** Maintain speaker normalization in `transcriptSanitizer.ts` so named speakers (`Robin`, `Yogesh`, `Sarah Chen`) are prioritized over generic `Speaker 1` identifiers.
- **Citation Linking:** When decisions or action items are extracted, bind them to a `SourceCitation` with `rawText` and `speaker`/`timestamp` so users can inspect the ground truth in the `SourceDrawer`.

### 2. Design & UX Aesthetics
- **Dark Theme Palette:** Background `#0b0d12`, surface cards `#14171f`/80 with `backdrop-blur-md`, borders `white/[0.08]`, and primary accents `indigo-500` / `emerald-400` / `blue-400` / `amber-400`.
- **Micro-Interactions:** Provide instant hover feedback, smooth transitions, interactive task checkboxes, and subtle celebratory confetti on successful generation.
- **Responsive Layout:** Ensure full responsiveness from desktop (1440px multi-column) down to mobile (375px drawer navigation and stacked canvas).

### 3. Keyboard Shortcuts
- **`Cmd/Ctrl + N`**: Instantly creates a new blank meeting draft.
- **`Cmd/Ctrl + Enter`**: Triggers AI synthesis when notes are present in the active meeting.

---

## 6. Development & Build Commands

```bash
# Start local Vite development server
npm run dev

# Typecheck and build production bundle
npm run build

# Run fast code linting via Oxlint
npm run lint

# Preview production build locally
npm run preview
```

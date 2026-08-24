# NoteFlow AI • Refined Welcome Experience & Visual Design Specification

> **Document Type:** Welcome Screen UI/UX & Visual Architecture Specification  
> **Frameworks Applied:** `@ui-ux-pro-max`, `@frontend-design`  
> **Product Category:** Premium AI Meeting Memory & Intelligence  
> **Aesthetic Reference:** Linear • Raycast • Superhuman • Apple Notes • Notion  
> **Status:** Design Specification Approved  

---

## 1. Product Positioning & Emotional Resonance

NoteFlow AI is designed as a **calm, reliable meeting-memory companion**. The first screen must not look like a generic marketing landing page, nor a dense B2B form. Instead, it must evoke the feeling of a **precision instrument**:

```
                       CALM PRECISION ARCHITECTURE
                       ───────────────────────────
   • Clear Purpose    ► Instantly communicates what NoteFlow does in < 3 seconds.
   • High Trust       ► Explicit privacy guarantees and transparent permission priming.
   • Zero Clutter     ► No promotional carousels, pricing tables, or marketing fluff.
   • Intentional Flow ► Direct single-action path: Google Workspace ➔ Workspace Ready.
```

---

## 2. Spatial Layout & Visual Architecture

The Welcome Screen uses a **focused vertical rhythm** set against our warm off-white canvas (`#F8F9FA`), housing an elevated monolithic pure white card (`#FFFFFF`) framed by a subtle 1px hairline border (`#E2E8F0`).

```
┌────────────────────────────────────────────────────────────────────────┐
│ Window Canvas (#F8F9FA)                                                │
│                                                                        │
│                   ┌──────────────────────────────────┐                 │
│                   │        [ ✨ Sparkle Icon ]       │                 │
│                   │           NoteFlow AI            │                 │
│                   │                                  │                 │
│                   │   "Your meetings, remembered."   │                 │
│                   │                                  │                 │
│                   │  Turn conversations into clear   │                 │
│                   │  summaries, decisions and action │                 │
│                   │  items.                          │                 │
│                   ├──────────────────────────────────┤                 │
│                   │  ┌────────────────────────────┐  │                 │
│                   │  │ [G] Continue with Google   │  │                 │
│                   │  └────────────────────────────┘  │                 │
│                   │                                  │                 │
│                   │  ┌────────────────────────────┐  │                 │
│                   │  │ [✉] Continue with Email    │  │                 │
│                   │  └────────────────────────────┘  │                 │
│                   ├──────────────────────────────────┤                 │
│                   │       WHAT HAPPENS NEXT          │                 │
│                   │  1. Secure Google sign-in        │                 │
│                   │  2. Read-only calendar sync      │                 │
│                   │  3. Automatic meeting memory     │                 │
│                   ├──────────────────────────────────┤                 │
│                   │ 🛡️ Read-Only • 🔒 Zero AI Training│                 │
│                   └──────────────────────────────────┘                 │
│                                                                        │
│                [ Explore Demo Sandbox (Sample Data) → ]                │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Screen Structure & Copy Hierarchy

### 3.1 Brand Identity & Hero Statement
* **Icon:** 48px rounded squircle (`bg-indigo-50`, `border border-indigo-100`, `text-indigo-600`) enclosing a geometric Sparkle mark.
* **Product Wordmark:** `NoteFlow AI` (14px, `font-semibold`, uppercase tracking `+0.06em`, `text-slate-500`).
* **Headline:** **"Your meetings, remembered."**
  - *Typography:* 32px / Line-height 1.15, `font-bold`, `tracking-tight` (`#0F172A`).
* **Supporting Value Statement:**
  - *"Turn conversations into clear summaries, decisions and action items."*
  - *Typography:* 15px / Line-height 1.5, `font-normal`, `text-slate-600`, max-width 380px.

---

### 3.2 Primary & Secondary Actions
1. **Primary CTA — `[Continue with Google]`:**
   - *Dimensions:* Full-width, 48px height, 12px border radius.
   - *Surface:* Tech Indigo (`#4F46E5` / `var(--primary-action)`) with subtle inset top highlight.
   - *Typography:* 14px, `font-semibold`, white (`#FFFFFF`).
   - *Leading Icon:* Official Google "G" multicolored vector logo.
   - *Hover State:* Background shifts to `#4338CA` with subtle $1\text{px}$ elevation lift.
   - *Focus State:* 2px offset focus ring in `#4F46E5`.

2. **Secondary Option — `[Continue with Work Email]`:**
   - *Dimensions:* Full-width, 44px height, 12px border radius.
   - *Surface:* Clean white (`#FFFFFF`), 1px hairline border (`#E2E8F0`).
   - *Typography:* 13px, `font-medium`, `text-slate-700`.
   - *Leading Icon:* Clean mail envelope icon (`text-slate-400`).

---

### 3.3 What Happens Next (Transparent 3-Step Journey Primer)
To eliminate onboarding hesitation, a compact, elegant 3-step timeline primes the user on the exact sequence ahead:

```
  WHAT HAPPENS NEXT
  ─────────────────
  ① Connect Workspace    ► Sign in securely with your work Google account.
  ② Sync Calendar        ► Read-only connection to detect upcoming Google Meet calls.
  ③ Memory On Standby    ► 1-click recording cues and instant cited summaries.
```

* *Container:* Inset subtle card (`bg-slate-50/70`, `border border-slate-100`, `rounded-2xl`, `p-4`).
* *Typography:* 12px `text-slate-600`, step numerals highlighted in `font-mono` indigo badges.

---

### 3.4 Trust & Privacy Reassurance Strip
Placed directly beneath the timeline, reinforcing enterprise privacy:
* 🛡️ **Read-Only Scope:** NoteFlow AI cannot create, edit, or delete calendar events.
* 🔒 **Zero Training:** Your meeting transcripts and notes are never used to train public AI models.
* 🔐 **Client-Side Security:** Tokens stored in AES-256 encrypted vaults.

---

### 3.5 Subtle Sandbox Entry Point
For users wanting to inspect the product without authenticating their calendar:
* *Position:* Below the main card as a quiet, secondary text link.
* *Copy:* `Want to test first? Explore Demo Sandbox with sample meetings →`
* *Styling:* 12px, `text-slate-400` hover `text-indigo-600`, transition-colors.

---

## 4. Design Tokens & Component Specifications

| Element | Design Token | Hex / Value | Purpose & Visual Weight |
| :--- | :--- | :--- | :--- |
| **Canvas Background** | `--bg-canvas` | `#F8F9FA` | Warm neutral foundation, zero glare. |
| **Card Surface** | `--surface-card` | `#FFFFFF` | Monolithic elevated hero card. |
| **Card Hairline** | `--border-default` | `#E2E8F0` | 1px border framing the container. |
| **Timeline Surface** | `--surface-subtle` | `#F1F5F9` | Subdued inner container for "What happens next". |
| **Headline Text** | `--text-primary` | `#0F172A` | High-contrast headline ($15.8:1$ ratio). |
| **Body / Subtitle** | `--text-secondary` | `#475569` | Calming descriptive text ($7.2:1$ ratio). |
| **Primary Accent** | `--primary-action` | `#4F46E5` | Tech Indigo for the primary Google CTA. |
| **Primary Button Text** | `white` | `#FFFFFF` | Pure white text on Indigo ($7.8:1$ ratio). |
| **Badge Hue** | `--primary-surface` | `#EEF2FF` | Soft indigo tint for numbers & brand mark. |
| **Trust Icon Hues** | `--color-success` | `#10B981` | Emerald green for verified security badges. |

---

## 5. Micro-Interactions & Motion Choreography

1. **Card Entrance:**
   - `opacity: 0` $\rightarrow$ `1`
   - `translateY: 12px` $\rightarrow$ `0px`
   - `transition: all 250ms cubic-bezier(0.16, 1, 0.3, 1)`
2. **Hero Stagger:** Brand Icon $\rightarrow$ Headline $\rightarrow$ Primary CTA $\rightarrow$ Timeline sequence fade in with 40ms stagger.
3. **Button Press Feedback:** Active scale `scale(0.985)` with smooth recovery on release.
4. **Hover Elevation:** Subtle ambient halo expands from `0 10px 25px -5px rgba(0,0,0,0.04)` to `0 20px 35px -10px rgba(79,70,229,0.08)`.

---

## 6. Accessibility & Assistive Technology Specification

* **Landmark Role:** `<main role="main" aria-labelledby="welcome-headline">`.
* **Heading Hierarchy:** Single `<h1>` tag containing `"Your meetings, remembered."`.
* **Keyboard Tab Sequence:**
  1. Primary Button: `[Continue with Google]`
  2. Secondary Button: `[Continue with Work Email]`
  3. Sandbox Link: `[Explore Demo Sandbox]`
* **Screen Reader Announcement:**
  > *"NoteFlow AI. Your meetings, remembered. Turn conversations into clear summaries, decisions and action items. Press Enter to continue with Google Workspace."*
* **Contrast Compliance:** All text and actionable elements exceed **WCAG 2.1 AAA standards** ($> 7.0:1$).

---

## 7. Responsive Breakpoint Adaptation

* **Desktop Viewport (> 1024px):**
  - Centered card width: $460\text{px}$.
  - Generous vertical whitespace ($80\text{px}$ top/bottom margins).
* **Tablet Viewport (640px – 1024px):**
  - Centered card width: $420\text{px}$.
  - Padding: $32\text{px}$.
* **Mobile Viewport (< 640px):**
  - Card width: $100\%$, edge padding $16\text{px}$.
  - Primary button pinned at comfortable thumb height.
  - Headline scaled to 26px for tight mobile viewports.

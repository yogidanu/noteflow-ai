# NoteFlow AI • First-Time User Experience (FTUX) UI/UX Design Specification

> **Document Type:** Comprehensive UI/UX & Interaction Specification  
> **Frameworks Applied:** `@ui-ux-pro-max`, `@frontend-design`, `@ui-a11y`  
> **Aesthetic Philosophy:** Premium Productivity + Calm AI (Linear • Notion • Raycast • Apple Notes)  
> **Design Tokens Reference:** [`docs/light-theme-design-system.md`](file:///Users/yogendrasinghdanu/Downloads/Senior%20Product%20Designer/Meet%20Record/docs/light-theme-design-system.md)  
> **Product Architecture Reference:** [`docs/onboarding-product-flow.md`](file:///Users/yogendrasinghdanu/Downloads/Senior%20Product%20Designer/Meet%20Record/docs/onboarding-product-flow.md)  
> **Accessibility Target:** WCAG 2.1 Level AA & Level AAA Strict Compliance  

---

## 1. Visual Design Architecture & Spatial Foundations

### 1.1 Aesthetic Pillars
* **Calm & Light-First:** Canvas base in soft warm off-white (`#F8F9FA`) with pure white elevated cards (`#FFFFFF`) to eliminate visual glare while maintaining crisp structural definition.
* **Hairline Precision:** 1px hairline borders (`#E2E8F0` / `var(--border-default)`) replace aggressive drop-shadows, creating an architectural, deliberate layout.
* **Focused Tech Indigo:** Primary accent (`#4F46E5` / `var(--primary-action)`) guides single-action cognitive flow without decorative distraction.
* **Intentional Typography:** Primary headings in **Inter Display** (`tracking-tight`), body in **Inter** (`font-normal`, `leading-relaxed`), and metadata/tags in **JetBrains Mono**.

---

### 1.2 Global Onboarding Shell Layout

All onboarding steps 1 through 11 render inside a centered, responsive **Onboarding Stage Container**:
```
┌─────────────────────────────────────────────────────────────┐
│ Window Canvas (#F8F9FA)                                     │
│                                                             │
│         ┌─────────────────────────────────────────┐         │
│         │ Top Brand Pill & Step Indicator (1/4)   │         │
│         ├─────────────────────────────────────────┤         │
│         │                                         │         │
│         │       Primary Card Surface (#FFFFFF)    │         │
│         │       Width: 480px (Mobile: 100%)       │         │
│         │       Border: 1px #E2E8F0               │         │
│         │       Radius: 24px (rounded-3xl)        │         │
│         │       Shadow: 0 20px 40px -15px rgba    │         │
│         │                                         │         │
│         │       [Header & Visual Icon]            │         │
│         │       [Title & Lead Paragraph]          │         │
│         │       [Context Body / Permission Card]  │         │
│         │       [Interactive Primary CTA]         │         │
│         │       [Secondary Text Action]           │         │
│         │                                         │         │
│         ├─────────────────────────────────────────┤         │
│         │ Footer Security & Privacy Guarantee Bar │         │
│         └─────────────────────────────────────────┘         │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Comprehensive 12-Screen Specification

---

### Screen 1: Welcome Screen

```
┌──────────────────────────────────────────────────┐
│                   [ ✨ Icon ]                    │
│             Welcome to NoteFlow AI               │
│   AI-native meeting intelligence and grounded    │
│   decision tracking for high-velocity teams.     │
│                                                  │
│  ┌────────────────────────────────────────────┐  │
│  │ [G] Continue with Google Workspace         │  │
│  └────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────┐  │
│  │ [✉] Continue with Work Email               │  │
│  └────────────────────────────────────────────┘  │
│                                                  │
│  ─────────────── OR EXPLORE FIRST ────────────── │
│                                                  │
│  ┌────────────────────────────────────────────┐  │
│  │ [🧭] Explore Demo Sandbox  [Sample Data]   │  │
│  │ Try with preloaded sprint & reorg notes.   │  │
│  └────────────────────────────────────────────┘  │
│                                                  │
│   🛡 Zero Training on Notes  •  🔒 Encrypted     │
└──────────────────────────────────────────────────┘
```

* **Hierarchy:**
  1. Centered brand badge with animated Sparkle glow.
  2. Level 1 Heading: `Welcome to NoteFlow AI` (28px Inter Semibold).
  3. Explainer text (14px Slate-500).
  4. Primary Google Workspace CTA.
  5. Secondary Work Email toggle.
  6. Demo Sandbox exploratory card.
  7. Trust pledge footer.
* **Layout:** Centered single-column card (`max-w-md`, `p-8`, `rounded-3xl`, `bg-white`, `border border-slate-200`).
* **Components:** `BrandIcon`, `Heading1`, `BodyText`, `GoogleAuthButton`, `EmailAuthButton`, `DividerWithLabel`, `SandboxCard`, `SecurityBadges`.
* **Copy:**
  - *Title:* "Welcome to NoteFlow AI"
  - *Subtitle:* "AI-native meeting intelligence, decision logging, and action tracking designed for modern product teams."
  - *Primary CTA:* "Continue with Google Workspace"
  - *Secondary CTA:* "Continue with Work Email"
  - *Sandbox Card:* "Explore Demo Sandbox" / "Try NoteFlow AI with preloaded sprint and reorg transcripts without connecting your real calendar."
  - *Trust Footer:* "Zero Training on Private Notes • Client-Side Encryption"
* **Primary CTA:** `[Continue with Google Workspace]` (44px height, `#4F46E5` background, white text, 12px radius).
* **Secondary CTA:** `[Continue with Work Email]` (44px height, `#FFFFFF` background, `#0F172A` text, 1px `#E2E8F0` border).
* **Loading State:** Instant render.
* **Error State:** Network disconnected banner at card top: *"You are offline. NoteFlow requires an active connection to sign in."*
* **Success State:** Transitions to Screen 2 or Screen 3.
* **Accessibility:**
  - `role="main"`, `aria-labelledby="welcome-heading"`.
  - Focus order: Google CTA $\rightarrow$ Work Email CTA $\rightarrow$ Demo Sandbox Card $\rightarrow$ Security links.
  - High-contrast Google button ($7.8:1$ ratio).
* **Responsive Behaviour:**
  - *Mobile (< 640px):* Card fills screen width (`p-5`, `rounded-2xl`, bottom pinned actions).
  - *Desktop (> 1024px):* Centered in viewport with subtle floating ambient shadow.

---

### Screen 2: Continue with Google (Account Selection / Workspace Gate)

```
┌──────────────────────────────────────────────────┐
│              Choose Workspace Account            │
│   Select your Google account to connect with     │
│   NoteFlow AI enterprise workspace.              │
│                                                  │
│  ┌────────────────────────────────────────────┐  │
│  │ (👤) sarah.chen@acme-corp.com              │  │
│  │     Acme Product Team  •  Verified         │  │
│  └────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────┐  │
│  │ (+) Use another Google account...          │  │
│  └────────────────────────────────────────────┘  │
│                                                  │
│  [← Back to Sign In]                             │
└──────────────────────────────────────────────────┘
```

* **Hierarchy:**
  1. Header: "Choose Workspace Account" (20px Inter Semibold).
  2. Discovered/saved Google Workspace account row.
  3. Add another account row.
  4. Back link.
* **Layout:** Account selector list with avatar chips, email identifiers, and verified enterprise badges.
* **Components:** `AccountRowItem`, `AvatarBadge`, `AddAccountRow`, `BackButton`.
* **Copy:**
  - *Title:* "Choose Workspace Account"
  - *Subtitle:* "Select your Google account to connect with NoteFlow AI."
  - *Badge:* "Verified Enterprise SSO"
* **Primary CTA:** Click on selected account row (initiates OAuth consent).
* **Secondary CTA:** `[← Back]` (Returns to Screen 1).
* **Loading State:** Pulsing shimmer on selected account avatar.
* **Error State:** Account domain mismatch alert: *"This account requires single sign-on approval from your Google Workspace administrator."*
* **Success State:** Launches Google Authentication flow (Screen 3).
* **Accessibility:**
  - `role="radiogroup"`, `aria-label="Google accounts"`.
  - Keyboard navigation: Up/Down arrow keys cycle between accounts; `Enter` selects.
* **Responsive Behaviour:** Full touch target padding ($48\text{px}\times 48\text{px}$ minimum on mobile).

---

### Screen 3: Google Authentication State (In-Flight Handshake)

```
┌──────────────────────────────────────────────────┐
│                                                  │
│                 [ ⏳ Spinner ]                   │
│                                                  │
│          Authenticating with Google...           │
│    Verifying your workspace identity and tokens  │
│                                                  │
│   ┌──────────────────────────────────────────┐   │
│   │ [■■■■■■■■■■■■□□□□□□□□□□] 60%            │   │
│   └──────────────────────────────────────────┘   │
│                                                  │
│       Securing cryptographic PKCE session...     │
│                                                  │
└──────────────────────────────────────────────────┘
```

* **Hierarchy:**
  1. Centered rotating indigo spinner.
  2. Status Title: "Authenticating with Google..." (18px Inter Medium).
  3. Sub-status: "Verifying your workspace identity and tokens".
  4. Indeterminate progress bar.
* **Layout:** Minimal, focused modal card with zero competing controls to reduce cognitive friction.
* **Components:** `LoadingSpinner`, `ProgressTrack`, `StatusSubtext`.
* **Copy:**
  - *Title:* "Authenticating with Google..."
  - *Subtitle:* "Verifying your workspace identity and exchanging security tokens."
* **Primary CTA:** None (automated transition).
* **Secondary CTA:** `[Cancel Authentication]` (Subtle muted button appearing after 4s timeout).
* **Loading State:** Continuous smooth 60fps radial spinner with 2px stroke width.
* **Error State:** Auto-transitions to Error Screen with code `OAUTH_HANDSHAKE_TIMEOUT` and 1-click retry.
* **Success State:** Displays checkmark transition $\rightarrow$ moves to Screen 4 in 250ms.
* **Accessibility:**
  - `aria-live="polite"`, `aria-busy="true"`.
  - Screen reader reads: *"Authenticating with Google Workspace. Please wait."*
* **Responsive Behaviour:** Centered vertically in viewport on all screen sizes.

---

### Screen 4: Calendar Connection Value Pitch

```
┌──────────────────────────────────────────────────┐
│ Step 1 of 2                      [Skip for now]  │
│                                                  │
│                 [ 📅 Cal Icon ]                  │
│             Connect Google Calendar              │
│   Automate meeting detection so NoteFlow AI can  │
│   cue recording before your calls start.         │
│                                                  │
│  ┌────────────────────────────────────────────┐  │
│  │ ✨ Smart Pre-Meeting Cues                  │  │
│  │    5-minute heads-up for scheduled meets.  │  │
│  │                                            │  │
│  │ ⚡ Instant Google Meet Link Matching       │  │
│  │    1-click ingress for meet.google.com     │  │
│  │                                            │  │
│  │ 🛡️ Strict Privacy Promise                  │  │
│  │    Zero email access, zero editing.        │  │
│  └────────────────────────────────────────────┘  │
│                                                  │
│  ┌────────────────────────────────────────────┐  │
│  │ [ Connect Google Calendar → ]              │  │
│  └────────────────────────────────────────────┘  │
│  [ I will paste transcripts manually ]           │
└──────────────────────────────────────────────────┘
```

* **Hierarchy:**
  1. Top progress counter: `Step 1 of 2` + `Skip for now` link.
  2. Large Calendar Icon with soft indigo background.
  3. Heading: "Connect Google Calendar" (22px Inter Semibold).
  4. Benefit summary list (3 value props with distinct icons).
  5. Primary CTA: Connect Google Calendar.
  6. Secondary Text Link: Manual mode fallback.
* **Layout:** Feature list presentation with elevated benefit cards (`bg-slate-50`, `border border-slate-100`, `rounded-2xl`).
* **Components:** `StepBadge`, `ValuePropList`, `PrimaryButton`, `TextLink`.
* **Copy:**
  - *Title:* "Connect Google Calendar"
  - *Subtitle:* "Automate meeting detection so NoteFlow AI can cue recording before your calls start."
  - *Benefits:*
    1. "Smart Pre-Meeting Cues: 5-minute alerts before scheduled syncs."
    2. "1-Click Meeting Ingress: Instant Google Meet and Zoom detection."
    3. "Strict Privacy Promise: Read-only calendar schedule. Zero email access."
  - *Primary CTA:* "Connect Google Calendar →"
  - *Secondary CTA:* "I will paste transcripts manually"
* **Primary CTA:** `[Connect Google Calendar →]` (Full-width `#4F46E5` button).
* **Secondary CTA:** `[Skip for now]` (Top right, text color `var(--text-muted)`).
* **Loading State:** None.
* **Error State:** N/A.
* **Success State:** Advances to Screen 5 on click.
* **Accessibility:**
  - Step counter announced to assistive tech: *"Step 1 of 2: Connect Google Calendar"*.
  - `tabindex` flows from Primary CTA $\rightarrow$ Secondary Action $\rightarrow$ Skip.
* **Responsive Behaviour:** Benefits stack vertically on mobile screens.

---

### Screen 5: Calendar Permission Explanation (Scope Transparency Modal)

```
┌──────────────────────────────────────────────────┐
│               Calendar Permissions               │
│   NoteFlow AI requests read-only calendar scope. │
│                                                  │
│  ┌────────────────────────────────────────────┐  │
│  │ ✅ What NoteFlow AI WILL see:              │  │
│  │    • Meeting titles (e.g. Sprint Planning) │  │
│  │    • Start and end times                   │  │
│  │    • Google Meet URLs                      │  │
│  ├────────────────────────────────────────────┤  │
│  │ ❌ What NoteFlow AI will NEVER see:        │  │
│  │    • Your private emails and messages      │  │
│  │    • Cannot create, edit or delete events  │  │
│  │    • Cannot invite or remove attendees     │  │
│  └────────────────────────────────────────────┘  │
│                                                  │
│  ┌────────────────────────────────────────────┐  │
│  │ [ Authorize Read-Only Access → ]           │  │
│  └────────────────────────────────────────────┘  │
│  [ Cancel ]                                      │
└──────────────────────────────────────────────────┘
```

* **Hierarchy:**
  1. Modal Title: "Calendar Permissions" (18px Inter Semibold).
  2. Two-tone permission comparison box (Green `WILL see` vs Red `NEVER see`).
  3. Scope confirmation button.
  4. Dismiss button.
* **Layout:** Focused dialog overlay (`max-w-lg`, `bg-white`, `border border-slate-200`, `shadow-2xl`).
* **Components:** `PermissionMatrixCard`, `ScopeCheckItem`, `PrimaryButton`, `SecondaryButton`.
* **Copy:**
  - *Title:* "Calendar Permissions & Data Guarantee"
  - *Allowed Header:* "What NoteFlow AI WILL see:"
  - *Allowed Items:* "Meeting titles, Scheduled times, Google Meet URLs"
  - *Forbidden Header:* "What NoteFlow AI will NEVER see:"
  - *Forbidden Items:* "Zero email reading, Zero event creation/editing, Zero attendee tampering"
  - *Primary CTA:* "Authorize Read-Only Access →"
  - *Secondary CTA:* "Cancel"
* **Primary CTA:** `[Authorize Read-Only Access →]`.
* **Secondary CTA:** `[Cancel]`.
* **Loading State:** Button shows inline spinner upon authorization click.
* **Error State:** N/A.
* **Success State:** Triggers Google OAuth scope consent and transitions to Screen 6.
* **Accessibility:**
  - `role="dialog"`, `aria-modal="true"`.
  - Focus trap active inside modal; `Escape` key invokes Cancel.
* **Responsive Behaviour:** Dialog adjusts to bottom sheet on mobile devices (`max-h-[90vh]`, `rounded-t-3xl`).

---

### Screen 6: Calendar Connecting State (Token Exchange & Initial Sync)

```
┌──────────────────────────────────────────────────┐
│                                                  │
│                 [ 🔄 Syncing ]                   │
│                                                  │
│           Connecting Google Calendar...          │
│    Exchanging secure OAuth credentials and       │
│    syncing your upcoming meeting schedule...     │
│                                                  │
│   ┌──────────────────────────────────────────┐   │
│   │ [✓] Identity verified                    │   │
│   │ [⟳] Vaulting encrypted refresh tokens... │   │
│   │ [ ] Fetching today's calendar delta...   │   │
│   └──────────────────────────────────────────┘   │
│                                                  │
└──────────────────────────────────────────────────┘
```

* **Hierarchy:**
  1. Animated calendar sync icon.
  2. Header: "Connecting Google Calendar..." (18px Inter Semibold).
  3. 3-step live checklist (Identity $\rightarrow$ Vault $\rightarrow$ Delta Sync).
* **Layout:** Centered feedback card with structured milestone progression.
* **Components:** `SyncingIcon`, `SteppedChecklist`, `MilestoneRow`.
* **Copy:**
  - *Milestone 1:* "Identity verified (sarah.chen@acme-corp.com)"
  - *Milestone 2:* "Vaulting encrypted credentials in AES-256 vault..."
  - *Milestone 3:* "Fetching today's meeting schedule..."
* **Primary CTA:** None (automatic progression).
* **Secondary CTA:** None.
* **Loading State:** Active milestone row pulses with gentle indigo highlight.
* **Error State:** If token exchange fails, transitions to Screen 8 in under 500ms.
* **Success State:** Checklist marks all 3 items green $\rightarrow$ transitions to Screen 7.
* **Accessibility:**
  - `aria-live="polite"`.
  - Milestones announce completion sequentially: *"Credentials vaulted. Fetching today's schedule."*
* **Responsive Behaviour:** Uniform across mobile and desktop.

---

### Screen 7: Calendar Connected State (Schedule Summary Confirmation)

```
┌──────────────────────────────────────────────────┐
│                 [ ✅ Success ]                   │
│             Google Calendar Connected            │
│                                                  │
│  ┌────────────────────────────────────────────┐  │
│  │ (📅) sarah.chen@acme-corp.com              │  │
│  │     3 meetings detected for today          │  │
│  ├────────────────────────────────────────────┤  │
│  │ Next: 10:00 AM • Sprint Planning & Q3...   │  │
│  │ Platform: Google Meet (qrp-zvmk-sxc)       │  │
│  └────────────────────────────────────────────┘  │
│                                                  │
│  ┌────────────────────────────────────────────┐  │
│  │ [ Continue to Detection Setup → ]          │  │
│  └────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────┘
```

* **Hierarchy:**
  1. Success Checkmark with subtle emerald glow.
  2. Title: "Google Calendar Connected" (22px Inter Semibold).
  3. Detected schedule preview card.
  4. Primary CTA: Continue to Detection Setup.
* **Layout:** Confirmation card with live data injection (shows account email, number of detected events today, and next upcoming call).
* **Components:** `SuccessBadge`, `AccountSummaryCard`, `MeetingSnippetRow`, `PrimaryButton`.
* **Copy:**
  - *Title:* "Google Calendar Connected"
  - *Account Line:* "sarah.chen@acme-corp.com • Verified"
  - *Snippet:* "Next: 10:00 AM • Sprint Planning & Q3 Roadmap (Google Meet)"
  - *Primary CTA:* "Continue to Detection Setup →"
* **Primary CTA:** `[Continue to Detection Setup →]`.
* **Secondary CTA:** None.
* **Loading State:** None.
* **Error State:** N/A.
* **Success State:** Advances to Screen 9 on click.
* **Accessibility:**
  - High-contrast emerald badge ($4.8:1$ on white surface).
  - Screen reader summary: *"Google Calendar connected. 3 meetings detected today. Next call at 10:00 AM."*
* **Responsive Behaviour:** Meeting title truncates cleanly with ellipsis on mobile.

---

### Screen 8: Permission Denied / OAuth Error State

```
┌──────────────────────────────────────────────────┐
│                 [ ⚠️ Warning ]                   │
│           Calendar Access Not Granted            │
│   Google Calendar was not connected because      │
│   the read-only permission was declined.         │
│                                                  │
│  ┌────────────────────────────────────────────┐  │
│  │ Why NoteFlow needs this:                   │  │
│  │ Without calendar access, NoteFlow cannot   │  │
│  │ notify you before upcoming meetings.       │  │
│  └────────────────────────────────────────────┘  │
│                                                  │
│  ┌────────────────────────────────────────────┐  │
│  │ [ Try Connecting Again ]                   │  │
│  └────────────────────────────────────────────┘  │
│  [ Continue without Calendar (Manual Notes) ]     │
└──────────────────────────────────────────────────┘
```

* **Hierarchy:**
  1. Amber warning indicator badge.
  2. Title: "Calendar Access Not Granted" (20px Inter Semibold).
  3. Clear rationale explaining why the failure occurred.
  4. Primary CTA: Try Connecting Again.
  5. Secondary CTA: Continue in manual mode.
* **Layout:** Recovery card with actionable remedies and zero dead-ends.
* **Components:** `WarningBadge`, `ExplanationCard`, `RetryButton`, `FallbackLink`.
* **Copy:**
  - *Title:* "Calendar Access Not Granted"
  - *Body:* "Google Calendar was not connected because the read-only permission was declined or the window was closed."
  - *Why Box:* "NoteFlow uses this scope only to detect start times and Google Meet links."
  - *Primary CTA:* "Try Connecting Again"
  - *Secondary CTA:* "Continue without Calendar (Manual Notes)"
* **Primary CTA:** `[Try Connecting Again]` (Re-opens Screen 5).
* **Secondary CTA:** `[Continue without Calendar]` (Routes directly to Screen 11/12 with `ONBOARDING_INCOMPLETE`).
* **Loading State:** Button shows spinner during reconnection attempt.
* **Error State:** N/A.
* **Success State:** Returns to Screen 6 upon successful re-authorization.
* **Accessibility:**
  - `role="alert"`.
  - Focus placed directly on Primary CTA on mount.
* **Responsive Behaviour:** Buttons maintain 44px touch height on touch devices.

---

### Screen 9: Meeting Detection & Notification Setup

```
┌──────────────────────────────────────────────────┐
│ Step 2 of 2                      [Skip for now]  │
│                                                  │
│                 [ 🔔 Bell Icon ]                 │
│             Smart Meeting Detection              │
│   Configure how NoteFlow alerts you and handles  │
│   recording ingress before calls.                │
│                                                  │
│  ┌────────────────────────────────────────────┐  │
│  │ [✓] Pre-Meeting Alerts                     │  │
│  │     Notify me 5 minutes before calls.      │  │
│  ├────────────────────────────────────────────┤  │
│  │ [✓] Explicit Opt-In Confirmation          │  │
│  │     Always ask before recording starts.    │  │
│  ├────────────────────────────────────────────┤  │
│  │ [✓] External Host Warning                  │  │
│  │     Flag meetings organized outside Acme.  │  │
│  └────────────────────────────────────────────┘  │
│                                                  │
│  ┌────────────────────────────────────────────┐  │
│  │ [ Enable Meeting Detection & Alerts → ]    │  │
│  └────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────┘
```

* **Hierarchy:**
  1. Top progress counter: `Step 2 of 2`.
  2. Notification Bell badge with soft amber halo.
  3. Title: "Smart Meeting Detection" (22px Inter Semibold).
  4. 3 configurable policy toggles with sensible enterprise defaults.
  5. Primary CTA: Enable Meeting Detection & Alerts.
* **Layout:** Preference card with interactive checkboxes/toggles.
* **Components:** `ToggleGroup`, `PolicyItem`, `PrimaryButton`, `SkipLink`.
* **Copy:**
  - *Title:* "Smart Meeting Detection & Alerts"
  - *Subtitle:* "Configure how NoteFlow alerts you and handles recording ingress before calls."
  - *Toggle 1:* "Pre-Meeting Alerts: Notify me 5 minutes before scheduled calls."
  - *Toggle 2:* "Explicit Opt-In: Always ask for 1-click approval before recording."
  - *Toggle 3:* "External Host Warning: Flag meetings organized outside your company."
  - *Primary CTA:* "Enable Meeting Detection & Alerts →"
* **Primary CTA:** `[Enable Meeting Detection & Alerts →]` (Triggers browser/OS notification permission).
* **Secondary CTA:** `[Skip for now]`.
* **Loading State:** OS native notification prompt triggers.
* **Error State:** If OS notifications are blocked, renders non-blocking guidance banner: *"Notifications are muted by system settings. You can still trigger recordings manually."*
* **Success State:** Advances to Screen 10.
* **Accessibility:**
  - All toggles use native `<input type="checkbox">` with accessible `aria-describedby` labels.
  - Keyboard: Space toggles checkbox states.
* **Responsive Behaviour:** Checkbox labels wrap cleanly on narrow screens ($< 380\text{px}$).

---

### Screen 10: Meeting Detection Enabled State

```
┌──────────────────────────────────────────────────┐
│                 [ 🎙️ Mic Icon ]                  │
│            Meeting Detection Active              │
│                                                  │
│  ┌────────────────────────────────────────────┐  │
│  │ ● Background Daemon: Polling Delta Sync    │  │
│  │ 🔔 Pre-Meeting Alerts: T-5 Minutes Active   │  │
│  │ 🔒 Explicit Opt-In: Enabled                │  │
│  └────────────────────────────────────────────┘  │
│                                                  │
│  ┌────────────────────────────────────────────┐  │
│  │ [ Finalize Setup & Launch Workspace → ]    │  │
│  └────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────┘
```

* **Hierarchy:**
  1. Active Microphone badge with animated pulse rings.
  2. Title: "Meeting Detection Active" (22px Inter Semibold).
  3. Configured daemon summary pill stack.
  4. Primary CTA: Finalize Setup & Launch Workspace.
* **Layout:** Status confirmation card with green status pills.
* **Components:** `PulseBadge`, `ConfiguredPolicySummary`, `PrimaryButton`.
* **Copy:**
  - *Title:* "Meeting Detection Active"
  - *Pill 1:* "● Background Ingress Daemon: Active"
  - *Pill 2:* "🔔 Pre-Meeting Cues: 5 minutes before calls"
  - *Pill 3:* "🔒 1-Click Explicit Approval: Enforced"
  - *Primary CTA:* "Finalize Setup & Launch Workspace →"
* **Primary CTA:** `[Finalize Setup & Launch Workspace →]`.
* **Secondary CTA:** None.
* **Loading State:** Instant render.
* **Error State:** N/A.
* **Success State:** Advances to Screen 11.
* **Accessibility:**
  - Screen reader announces: *"Meeting detection active. Background daemon running with 5-minute pre-meeting alerts."*
* **Responsive Behaviour:** Centered card with full mobile width adaptation.

---

### Screen 11: Setup Complete ("You're All Set" Celebration)

```
┌──────────────────────────────────────────────────┐
│                 [ ✨ All Set ]                   │
│              You're Ready to Flow!               │
│   NoteFlow AI is configured and ready to capture │
│   your meeting intelligence.                     │
│                                                  │
│  ┌────────────────────────────────────────────┐  │
│  │ ✨ What to expect next:                    │  │
│  │    1. Automatic alert 5m before your calls │  │
│  │    2. 1-click to record and diarize        │  │
│  │    3. Instant cited decisions in seconds   │  │
│  └────────────────────────────────────────────┘  │
│                                                  │
│  ┌────────────────────────────────────────────┐  │
│  │ [ Enter NoteFlow Dashboard → ]             │  │
│  └────────────────────────────────────────────┘  │
│  [ Try recording a quick test meeting ]          │
└──────────────────────────────────────────────────┘
```

* **Hierarchy:**
  1. Celebration Sparkle Icon with micro-confetti particle burst.
  2. Title: "You're Ready to Flow!" (24px Inter Bold).
  3. "What to expect" 3-step expectation primer.
  4. Primary CTA: Enter NoteFlow Dashboard.
  5. Secondary CTA: Quick test meeting sandbox.
* **Layout:** Hero celebration card (`p-8`, `bg-white`, `border border-slate-200`, `shadow-2xl`).
* **Components:** `CelebrationBadge`, `ExpectationList`, `PrimaryButton`, `TestMeetingLink`, `ConfettiTrigger`.
* **Copy:**
  - *Title:* "You're Ready to Flow!"
  - *Subtitle:* "NoteFlow AI is configured and ready to capture your meeting intelligence."
  - *Expectations:*
    1. "Automatic alert 5 minutes before your calls"
    2. "1-click approval to start recording and audio diarization"
    3. "Executive summaries and grounded citations ready in seconds"
  - *Primary CTA:* "Enter NoteFlow Dashboard →"
  - *Secondary CTA:* "Try recording a quick test meeting"
* **Primary CTA:** `[Enter NoteFlow Dashboard →]`.
* **Secondary CTA:** `[Try recording a quick test meeting]`.
* **Loading State:** Seamless entry to Dashboard (< 100ms).
* **Error State:** N/A.
* **Success State:** Transitions to Screen 12 (Empty Dashboard).
* **Accessibility:**
  - Confetti respects `prefers-reduced-motion: reduce` (suppresses particles).
  - Primary button automatically focused.
* **Responsive Behaviour:** Vertical spacing optimized for mobile viewports.

---

### Screen 12: Empty Dashboard for a User with No Meetings

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ [✨ NoteFlow AI]  [Feed | Summary]                (📅 sarah.chen)  [☀️] [SC (Sarah C)] │
├───────────────┬────────────────────────────────────────────────────────────────────────┤
│ NOTES (0)     │                                                                        │
│               │                         [ ✨ NoteFlow AI ]                             │
│ + New Note    │                    Your Meeting Intelligence Hub                       │
│               │    Capture live calls, paste raw transcripts, or join ad-hoc rooms.    │
│               │                                                                        │
│ No notes yet. │  ┌────────────────────────┬───────────────────┬─────────────────────┐  │
│ Real meetings │  │ 📅 Next Meeting        │ ✍️ Paste Notes    │ ⚡ Quick Join URL    │  │
│ will appear   │  │    10:00 AM • Sprint   │    Drop .vtt,     │    Paste Google     │  │
│ here after    │  │    Planning & Roadmap  │    .txt, or raw   │    Meet room code   │  │
│ recording.    │  │                        │    transcript     │    to start live    │  │
│               │  │ [ Pre-Approve (T-5m) ] │ [ Open Editor → ] │ [ Start Ingress → ] │  │
│               │  └────────────────────────┴───────────────────┴─────────────────────┘  │
│               │                                                                        │
│               │    ⌨️ Shortcuts: Cmd+N New Note  •  Cmd+K Toggle Feed  •  Cmd+Enter AI │
└───────────────┴────────────────────────────────────────────────────────────────────────┘
```

* **Hierarchy:**
  1. Top AppHeader: Brand mark, View switcher, Verified Calendar Pill (`sarah.chen`), Theme switcher, User Profile Avatar (`SC`).
  2. Left Sidebar: Clean `0 Notes` state with prominent `+ New Note` button and calm placeholder text.
  3. Central Empty State Canvas:
     - Hero illustration & title: "Your Meeting Intelligence Hub".
     - 3-Column Action Grid:
       - **Column A:** Next Upcoming Calendar Meeting Card (with 1-click Pre-Approve CTA).
       - **Column B:** Paste Transcript / Drop File Card (opens Editor).
       - **Column C:** Quick Join Google Meet URL Card (instant ingress).
     - Keyboard shortcut legend bar at bottom.
* **Layout:** Full desktop workspace layout ($260\text{px}$ sidebar + flex canvas).
* **Components:** `AppHeader`, `SidebarEmptyState`, `CanvasHero`, `ActionCardGrid`, `NextMeetingCard`, `DropzoneCard`, `QuickJoinCard`, `KeyboardLegend`.
* **Copy:**
  - *Sidebar:* "No notes yet. Real meetings will appear here after recording."
  - *Hero Title:* "Your Meeting Intelligence Hub"
  - *Hero Subtitle:* "Capture live calls, paste raw transcripts, or join ad-hoc rooms."
  - *Card A:* "Next Meeting: 10:00 AM • Sprint Planning & Roadmap" $\rightarrow$ `[ Pre-Approve (T-5m) ]`
  - *Card B:* "Paste Notes or Drop .vtt / .txt transcripts" $\rightarrow$ `[ Open Editor → ]`
  - *Card C:* "Quick Join Meet URL: Enter Google Meet code" $\rightarrow$ `[ Start Ingress → ]`
  - *Shortcuts:* "Cmd+N New Note • Cmd+K Toggle Feed • Cmd+Enter Generate Summary"
* **Primary CTA:** Click on any of the 3 action cards.
* **Secondary CTA:** `+ New Note` in sidebar.
* **Loading State:** Skeleton loaders for calendar event cards (< 200ms).
* **Error State:** Banner for sync errors with 1-click retry.
* **Success State:** Active production workspace.
* **Accessibility:**
  - Sidebar landmark: `<aside aria-label="Meeting notes history">`.
  - Main canvas: `<main aria-label="Meeting workspace">`.
  - Action cards have descriptive `aria-label` tags and focusable CTA buttons.
* **Responsive Behaviour:**
  - *Mobile (< 768px):* Sidebar collapses into slide-over drawer; 3-column action cards stack into a vertical carousel.
  - *Tablet (768–1024px):* Sidebar collapses to icon rail; action cards render as a $2\times 2$ grid.
  - *Desktop (> 1024px):* Full 3-column horizontal action grid with sticky header.

---

## 3. Interaction & Motion Design Principles

1. **Staggered Entry Transitions:** Elements within onboarding cards animate in using CSS spring transitions (`opacity: 0 -> 1`, `translateY: 8px -> 0px`, `duration: 200ms`, `stagger: 40ms`).
2. **Micro-Celebration:** Confetti bursts on Screen 11 trigger 35 lightweight canvas particles, capped at 1.2 seconds runtime, and strictly disabled when `prefers-reduced-motion` is active.
3. **Card State Shifts:** Transitions between screens cross-fade without layout shift by locking the card width to $480\text{px}$ across all 11 steps.

---

## 4. Comprehensive Accessibility & Assistive Tech Audit

| Screen | ARIA Landmark / Role | Primary Accessible Name | Focus Target on Mount | Keyboard Trapping |
| :--- | :--- | :--- | :--- | :---: |
| **1. Welcome** | `<main role="main">` | `"Welcome to NoteFlow AI"` | Primary Google CTA | No |
| **2. Continue with Google** | `<div role="radiogroup">` | `"Choose workspace account"` | First Account Row | No |
| **3. Authenticating** | `<div role="status" aria-live="polite">`| `"Authenticating with Google"` | Spinner container | No |
| **4. Calendar Pitch** | `<main role="main">` | `"Connect Google Calendar"` | Primary Connect CTA | No |
| **5. Permission Scope** | `<div role="dialog" aria-modal="true">`| `"Calendar Permissions"` | Authorize CTA | **Yes** |
| **6. Syncing State** | `<div role="status" aria-live="polite">`| `"Connecting Google Calendar"` | Sync status list | No |
| **7. Connected State** | `<main role="main">` | `"Google Calendar Connected"` | Continue CTA | No |
| **8. Permission Denied** | `<div role="alert">` | `"Calendar Access Not Granted"` | Try Again CTA | No |
| **9. Detection Setup** | `<main role="main">` | `"Smart Meeting Detection"` | Primary Enable CTA | No |
| **10. Detection Active** | `<main role="main">` | `"Meeting Detection Active"` | Finalize CTA | No |
| **11. Setup Complete** | `<main role="main">` | `"You're Ready to Flow"` | Dashboard CTA | No |
| **12. Empty Dashboard** | `<main role="main">` | `"Your Meeting Intelligence Hub"`| First Action Card | No |

---

## 5. Summary of Deliverables & Next Steps

This specification establishes the exact visual, structural, and interactive blueprint for NoteFlow AI's 12 onboarding states. It directly aligns with:
- The design tokens in [`docs/light-theme-design-system.md`](file:///Users/yogendrasinghdanu/Downloads/Senior%20Product%20Designer/Meet%20Record/docs/light-theme-design-system.md).
- The state transitions in [`docs/onboarding-product-flow.md`](file:///Users/yogendrasinghdanu/Downloads/Senior%20Product%20Designer/Meet%20Record/docs/onboarding-product-flow.md).
- The zero-fake-data production standard in [`docs/current-state-audit.md`](file:///Users/yogendrasinghdanu/Downloads/Senior%20Product%20Designer/Meet%20Record/docs/current-state-audit.md).

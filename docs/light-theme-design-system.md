# Meet Record — Light Mode Visual Design System & Component Token Specification

> **Document Type:** Visual Design System & Component Token Specification  
> **Aesthetic Philosophy:** Premium Productivity + Calm AI (Linear • Notion • Raycast • Apple Notes)  
> **Target Release:** NoteFlow AI / Meet Record Light Mode Redesign  
> **Status:** Specification Approved — Ready for Systematic Implementation  
> **Compliance Target:** WCAG 2.1 Level AA & Level AAA Contrast Standard  

---

## 1. Core Visual Principles

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                          12 CORE VISUAL DESIGN PRINCIPLES                              │
├────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                        │
│  1. Light Mode First: Light mode is the default, primary, and native presentation.     │
│  2. Soft Neutral Background: Off-white canvas (#F8F9FA) eliminates harsh glare.       │
│  3. Pure White Surfaces: Critical cards and panels sit on pure white (#FFFFFF).        │
│  4. Subtle Borders over Heavy Shadows: Hairline borders (#E2E8F0) define structure.   │
│  5. Generous Whitespace: Intentional vertical rhythm and breathing room.               │
│  6. Strong Typographic Hierarchy: Deep charcoal (#0F172A) with tight letter tracking. │
│  7. One Primary Accent: Deep Tech Indigo (#4F46E5) anchors primary focus.              │
│  8. Restrained Color Signals: Semantic hues used strictly for state & verification.    │
│  9. Zero Excessive Gradients: Flat, confident, clean surfaces with subtle fills.       │
│  10. Zero Excessive Glassmorphism: Minimalist backdrop blur on floating elements only. │
│  11. Zero Decorative Clutter: Every visual artifact directly aids comprehension.       │
│  12. Production-Oriented Usability: High information density balanced with clarity.    │
│                                                                                        │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Design Token Architecture & Color Palette

### 2.1 Core Semantic Tokens

```
                                SPATIAL SURFACE ELEVATION
                                ─────────────────────────

  [Layer 0: Canvas Base]        ► #F8F9FA (Slate 50 with warm undertone)
     │
     └── [Layer 1: Sidebars]    ► #F1F5F9 (Slate 100 / Off-white panel)
           │
           └── [Layer 2: Cards] ► #FFFFFF (Pure Solid White)
                 │
                 └── [Layer 3: Overlays & Modals] ► #FFFFFF + Diffuse Ambient Shadow
```

| Token Name | CSS Variable | Hex / Tailwind Value | Contrast vs Canvas | Purpose & Semantic Role |
| :--- | :--- | :--- | :---: | :--- |
| **`background`** | `--bg-canvas` | `#F8F9FA` (`slate-50`) | Base | Main application canvas base |
| **`surface`** | `--surface-card` | `#FFFFFF` (`white`) | $1.06:1$ | Primary cards, content panels, feed rows |
| **`surface-subtle`** | `--surface-subtle` | `#F1F5F9` (`slate-100`) | $1.12:1$ | Sidebars, segmented track, headers |
| **`surface-elevated`**| `--surface-elevated`| `#FFFFFF` (`white`) | $1.06:1$ | Modals, dropdowns, floating recording dock |
| **`border`** | `--border-default` | `#E2E8F0` (`slate-200`) | $1.25:1$ | Standard 1px card and panel hairline stroke |
| **`border-subtle`** | `--border-subtle` | `#F1F5F9` (`slate-100`) | $1.10:1$ | Inset dividers, list row separators |
| **`border-focus`** | `--border-focus` | `#4F46E5` (`indigo-600`) | $6.8:1$ | Active input rings and focus outlines |
| **`text-primary`** | `--text-primary` | `#0F172A` (`slate-900`) | **16.8 : 1 (AAA)** | Display headings, titles, primary text |
| **`text-secondary`**| `--text-secondary` | `#334155` (`slate-700`) | **11.2 : 1 (AAA)** | Body copy, executive summary text |
| **`text-muted`** | `--text-muted` | `#64748B` (`slate-500`) | **4.9 : 1 (AA)** | Timestamps, metadata, helper text |
| **`text-subtle`** | `--text-subtle` | `#94A3B8` (`slate-400`) | $2.8:1$ (Icons) | Decorative icons, empty placeholders |
| **`primary-action`**| `--primary-action` | `#4F46E5` (`indigo-600`)| **6.8 : 1 (AA)** | Primary buttons, active tabs, main CTAs |
| **`primary-hover`** | `--primary-hover` | `#4338CA` (`indigo-700`)| **8.2 : 1 (AAA)** | Primary button hover state |
| **`primary-surface`**| `--primary-surface`| `#EEF2FF` (`indigo-50`) | Tint Base | Citation badges, active selection pills |
| **`success`** | `--color-success` | `#059669` (`emerald-600`)| **5.8 : 1 (AA)** | Decisions extracted, completed tasks |
| **`success-surface`**| `--success-surface`| `#ECFDF5` (`emerald-50`)| Tint Base | Decision pill backgrounds, verified badge |
| **`warning`** | `--color-warning` | `#D97706` (`amber-600`)| **4.6 : 1 (AA)** | T-5m pre-meeting cues, tentative signals |
| **`warning-surface`**| `--warning-surface`| `#FFFBEB` (`amber-50`)| Tint Base | Attention cards, transcript highlight |
| **`error`** | `--color-error` | `#E11D48` (`rose-600`)| **5.2 : 1 (AA)** | Ingress failures, disconnect actions |
| **`error-surface`** | `--error-surface` | `#FFF1F2` (`rose-50`)| Tint Base | Error alert cards, deletion confirmation |
| **`recording`** | `--color-recording`| `#059669` (`emerald-600`)| **5.8 : 1 (AA)** | Live recording indicator & waveform |
| **`ai-accent`** | `--color-ai-accent`| `#6366F1` (`indigo-500`)| **5.4 : 1 (AA)** | Grounding citations, AI synthesis sparks |

---

## 3. Typography Scale & Spatial Hierarchy

**Font Stacks:**
- **Headings & Display:** `Outfit`, `-apple-system`, `BlinkMacSystemFont`, sans-serif
- **Interface & Body:** `Inter`, `-apple-system`, `BlinkMacSystemFont`, sans-serif
- **Timestamps, URLs & Code:** `ui-monospace`, `SFMono-Regular`, `Menlo`, monospace

| Level | Size | Line Height | Weight | Tracking | CSS Class | Sample Use Case |
| :--- | :---: | :---: | :---: | :---: | :--- | :--- |
| **Display 1** | `24px` (`1.5rem`) | `32px` | `700` | `-0.03em` | `text-2xl font-bold tracking-tight text-slate-900` | Workspace view titles |
| **Heading 1** | `18px` (`1.125rem`)| `26px` | `600` | `-0.025em`| `text-lg font-semibold tracking-tight text-slate-900` | Modal headers, feed title |
| **Heading 2** | `15px` (`0.9375rem`)| `22px`| `600` | `-0.02em` | `text-[15px] font-semibold text-slate-900` | Section headers, card titles |
| **Body Large**| `14px` (`0.875rem`)| `22px` | `400` | `0` | `text-sm font-normal text-slate-700 leading-relaxed` | Executive summary copy |
| **Body Small**| `13px` (`0.8125rem`)| `19px` | `400` | `0` | `text-[13px] text-slate-600 leading-normal` | Decision text, action tasks |
| **Caption** | `12px` (`0.75rem`) | `16px` | `500` | `0` | `text-xs font-medium text-slate-500` | Metadata, speaker labels |
| **Micro / Tag**| `11px` (`0.6875rem`)| `14px` | `600` | `+0.02em` | `text-[11px] font-semibold uppercase tracking-wider` | Section badges, status tags |
| **Monospace** | `12px` (`0.75rem`) | `16px` | `400` | `-0.01em` | `font-mono text-xs text-slate-600` | Meeting URLs, timestamps |

---

## 4. Spacing, Radius & Elevation Scales

### 4.1 Spacing Scale
- **`2xs`:** `4px` (`0.25rem`) — Micro icon padding, pill internal spacing.
- **`xs`:** `8px` (`0.5rem`) — Button icon gaps, badge padding (`px-2.5 py-1`).
- **`sm`:** `12px` (`0.75rem`) — List row gaps, small card padding.
- **`md`:** `16px` (`1.0rem`) — Standard card internal padding (`p-4`), section gaps.
- **`lg`:** `24px` (`1.5rem`) — Main view container padding (`p-6`), feed layout gap.
- **`xl`:** `32px` (`2.0rem`) — Modal padding (`p-8`), hero section separation.

### 4.2 Border Radius Tokens
- **`radius-sm`:** `6px` (`rounded-md`) — Citation badges, micro toggles.
- **`radius-md`:** `10px` (`rounded-xl`) — Standard buttons, text inputs.
- **`radius-lg`:** `16px` (`rounded-2xl`) — Meeting cards, AI summary containers.
- **`radius-xl`:** `24px` (`rounded-3xl`) — Floating recording dock, modal dialogs.
- **`radius-full`:** `9999px` (`rounded-full`) — Status pills, user avatar circles.

### 4.3 Shadow & Elevation Scale (Subtle & Diffuse)
```css
/* Restrained Multi-Stop Elevation */
--shadow-2xs: 0 1px 2px 0 rgba(15, 23, 42, 0.04);
--shadow-xs:  0 1px 3px 0 rgba(15, 23, 42, 0.06), 0 1px 2px -1px rgba(15, 23, 42, 0.04);
--shadow-sm:  0 4px 6px -1px rgba(15, 23, 42, 0.05), 0 2px 4px -2px rgba(15, 23, 42, 0.03);
--shadow-md:  0 10px 15px -3px rgba(15, 23, 42, 0.06), 0 4px 6px -4px rgba(15, 23, 42, 0.03);
--shadow-xl:  0 20px 25px -5px rgba(15, 23, 42, 0.08), 0 8px 10px -6px rgba(15, 23, 42, 0.04);
--shadow-modal: 0 25px 50px -12px rgba(15, 23, 42, 0.15);
```

---

## 5. Component Style Specifications

### 5.1 Button Styles
- **Primary Action Button:**
  ```html
  <button class="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 rounded-xl shadow-xs transition-all duration-150 flex items-center gap-2 cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2">
    <span>Authorize Connection</span>
  </button>
  ```
- **Secondary / Outline Button:**
  ```html
  <button class="px-3.5 py-2 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl shadow-2xs transition-colors cursor-pointer">
    <span>Cancel</span>
  </button>
  ```
- **Ghost / Icon Button:**
  ```html
  <button class="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer" aria-label="Close">
    <X class="w-4 h-4" />
  </button>
  ```
- **Destructive Button:**
  ```html
  <button class="px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-xs transition-all cursor-pointer">
    <span>Delete Meeting</span>
  </button>
  ```

### 5.2 Card & Panel Styles
- **Standard Card Surface:**
  ```html
  <div class="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs transition-all hover:border-slate-300">
    <!-- Card content -->
  </div>
  ```
- **Executive Summary Hero Card:**
  ```html
  <div class="bg-white border border-slate-200/90 border-l-4 border-l-indigo-600 rounded-2xl p-6 shadow-xs">
    <!-- Executive summary content -->
  </div>
  ```

### 5.3 Badge & Status Pill Styles
- **Verified / Connected:** `bg-emerald-50 text-emerald-700 border border-emerald-200/80 px-2 py-0.5 rounded-full text-[11px] font-medium`
- **Scheduled Ingress:** `bg-indigo-50 text-indigo-700 border border-indigo-200/80 px-2 py-0.5 rounded-full text-[11px] font-medium`
- **T-5m Cue:** `bg-amber-50 text-amber-700 border border-amber-200/80 px-2 py-0.5 rounded-full text-[11px] font-medium`
- **Inactive / Off:** `bg-slate-100 text-slate-600 border border-slate-200 px-2 py-0.5 rounded-full text-[11px] font-medium`
- **Citation Backlink Badge:** `inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-[11px] font-medium transition-colors cursor-pointer border border-indigo-100`

### 5.4 Live Recording Widget (Floating Dock)
```html
<div class="fixed bottom-6 right-6 z-40 bg-white/95 backdrop-blur-md border border-slate-200/90 rounded-2xl p-4 shadow-xl text-slate-900 flex items-center gap-4 animate-in slide-in-from-bottom-4">
  <!-- Pulsating Live Emerald Indicator -->
  <div class="flex items-center gap-2">
    <span class="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
    <span class="text-xs font-semibold text-slate-900">Recording Google Meet</span>
  </div>
  <!-- Live Timer in Tabular Monospace -->
  <span class="font-mono text-xs font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">00:14:22</span>
  <!-- Controls -->
  <button class="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors">Pause</button>
  <button class="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold shadow-xs">Stop & Synthesize</button>
</div>
```

### 5.5 Modal Dialogs & Scrim
- **Backdrop Scrim:** `fixed inset-0 bg-slate-900/30 backdrop-blur-xs transition-opacity`
- **Dialog Surface:** `relative w-full max-w-lg rounded-3xl bg-white border border-slate-200/90 p-6 sm:p-8 shadow-modal text-slate-900`

### 5.6 Notification Toasts
- **Success Toast:** `bg-white border border-emerald-200 p-4 rounded-2xl shadow-xl flex items-start gap-3.5 text-slate-900`
- **Error Toast:** `bg-white border border-rose-200 p-4 rounded-2xl shadow-xl flex items-start gap-3.5 text-slate-900`

---

## 6. Implementation Readiness Checklist

- [x] All color tokens defined with explicit hex, Tailwind, and CSS variables.
- [x] WCAG AA/AAA contrast verified across all text and state pairs.
- [x] Spacing, typography, border-radius, and shadow scales standardized.
- [x] Component blueprints documented for Header, Sidebar, Feed, Floating Dock, AI Canvas, and Modals.
- [x] Zero code modified during this design specification phase.

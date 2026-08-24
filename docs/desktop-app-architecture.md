# NoteFlow AI • Meet Record Desktop Companion Application Architecture

> **Document Type:** Desktop Systems Architecture, Security Specification & Product Design Document  
> **Target Platforms:** macOS (Apple Silicon + Intel, macOS 12.0+) & Windows (x64 / ARM64, Windows 10/11)  
> **Framework Decision:** Comprehensive Evaluation: **Tauri 2.0 vs Electron**  
> **Status:** Approved Architectural Specification  

---

## 1. Framework Evaluation: Tauri 2.0 vs. Electron

To determine the ideal foundation for the **NoteFlow Desktop Companion**, we evaluated **Tauri 2.0 (Rust backend + Webview2/WKWebView frontend)** against **Electron (Chromium + Node.js runtime)** across the core requirements of a lightweight, persistent background daemon with low memory footprint and strict audio/screen permissions.

| Architectural Dimension | Tauri 2.0 (Rust Core + OS Webview) | Electron (Chromium + Node.js Runtime) | Verdict & Rationale for NoteFlow |
| :--- | :--- | :--- | :--- |
| **Idle Memory Footprint** | **~25 MB – 45 MB** RAM | **~120 MB – 250 MB** RAM | **Tauri 2.0 Wins:** As a persistent background menu bar/system tray daemon, minimizing resource footprint is critical for battery life and user trust. |
| **Installer / Binary Size** | **~8 MB – 15 MB** installer | **~90 MB – 140 MB** installer | **Tauri 2.0 Wins:** 10x smaller download size accelerates enterprise deployment and user onboarding. |
| **Native System Audio & Ingress** | Native **Rust CoreAudio (macOS)** & **WASAPI (Windows)** integration via native C/Rust bindings | Requires node native addons (`node-gyp`) with V8 bridge overhead | **Tauri 2.0 Wins:** Direct OS audio capture pipeline without garbage collection pauses. |
| **Security & Attack Surface** | No bundled Node.js runtime; strict capability-based IPC security; Rust memory safety | Full Node.js runtime exposed unless context isolation and sandboxing are meticulously enforced | **Tauri 2.0 Wins:** Zero risk of Node.js remote code execution in webview context. |
| **System Tray & Floating UI** | First-class native system tray (`tauri::tray`) & multi-window support in Tauri 2.0 | Mature system tray & transparent frameless floating windows | **Tie:** Both support frameless floating pill widgets and tray menus. |
| **Auto-Update Reliability** | Built-in signed auto-updater with Ed25519 signature verification | `electron-updater` with Squirrel/Sparkle integrations | **Tie:** Both offer production-ready differential auto-updates. |
| **Web Codebase Reuse** | 100% reuse of existing React / Vite / Tailwind v4 components | 100% reuse of existing React / Vite / Tailwind v4 components | **Tie:** Same frontend code runs seamlessly in both. |

### 🏆 Architectural Decision: **Tauri 2.0** (with Rust Background Engine)
**Rationale:** Meet Record is designed as an always-on background companion. Users will keep it running 24/7 in their menu bar/system tray. Running a heavy Chromium+Node runtime (Electron) wastes 150MB+ RAM at idle. Tauri 2.0 delivers a **sub-35MB footprint**, instant startup (<200ms), native Rust CoreAudio/WASAPI audio pipeline hooks, and a significantly smaller attack surface.

---

## 2. Desktop System Architecture

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                macOS / Windows Desktop Host                            │
├────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                        │
│  ┌──────────────────────────────────────────────────────────────────────────────────┐  │
│  │                              Tauri 2.0 Rust Core Process                         │  │
│  │                                                                                  │  │
│  │  ┌──────────────────────┐  ┌───────────────────────┐  ┌───────────────────────┐  │  │
│  │  │  System Tray & Menu  │  │  Calendar Sync Engine │  │  Local Encrypted Vault │  │  │
│  │  │  - Menu Bar Icon     │  │  - Google Calendar    │  │  - macOS Keychain     │  │  │
│  │  │  - Dynamic Status    │  │  - Outlook / CalDAV   │  │  - Windows DPAPI       │  │  │
│  │  └──────────┬───────────┘  └───────────┬───────────┘  └───────────┬───────────┘  │  │
│  │             │                          │                          │              │  │
│  │  ┌──────────┴───────────┐  ┌───────────┴───────────┐  ┌───────────┴───────────┐  │  │
│  │  │ Native Audio / Media │  │  Pre-Meeting Daemon   │  │  Background Sync Hub  │  │  │
│  │  │ - ScreenCaptureKit   │  │  - T-5m Notification  │  │  - WebSocket Telemetry │  │  │
│  │  │ - Windows WASAPI     │  │  - T-60s Ingress Hook │  │  - Chunked STT Ingress │  │  │
│  │  └──────────┬───────────┘  └───────────┬───────────┘  └───────────┬───────────┘  │  │
│  └─────────────┼──────────────────────────┼──────────────────────────┼──────────────┘  │
│                │ IPC Commands & Events    │ IPC Events               │                 │
│  ┌─────────────┴──────────────────────────┴──────────────────────────┴──────────────┐  │
│  │                         Webview UI Layer (React + Vite)                          │  │
│  │                                                                                  │  │
│  │  ┌────────────────────────┐  ┌─────────────────────────┐  ┌───────────────────┐  │  │
│  │  │  Tray Mini-Dashboard   │  │ Floating Recording Pill │  │ Deep-Link Modal   │  │  │
│  │  │  (Upcoming Meets list) │  │ (Timer, VAD Equalizer)  │  │ (Opt-In Consent)  │  │  │
│  │  └────────────────────────┘  └─────────────────────────┘  └───────────────────┘  │  │
│  └──────────────────────────────────────────────────────────────────────────────────┘  │
│                                                                                        │
└─────────────────────────────────────────┬──────────────────────────────────────────────┘
                                          │ TLS 1.3 / WSS
                                          ▼
                      ┌────────────────────────────────────────┐
                      │    NoteFlow Cloud Backend (REST/WS)    │
                      │    - Auth & JWT Session Services       │
                      │    - Diarization & Whisper STT Engine  │
                      │    - AI Synthesis & Knowledge Graph    │
                      │    - Web Application (Full View)       │
                      └────────────────────────────────────────┘
```

---

## 3. Authentication & SSO Deep-Link Flow

The desktop application uses **OAuth 2.0 with PKCE (Proof Key for Code Exchange)** combined with a custom OS deep-link URL scheme (`noteflow://`).

```mermaid
sequenceDiagram
    autonumber
    participant U as User
    participant App as NoteFlow Desktop (Tauri)
    participant OS as System Browser (Chrome/Safari)
    participant Auth as NoteFlow Cloud Auth Server
    participant Vault as OS Secure Enclave / Keyring

    U->>App: Clicks "Sign In / Connect"
    App->>App: Generates PKCE code_verifier & code_challenge
    App->>OS: Launches Browser -> https://app.noteflow.ai/auth/desktop-login?code_challenge=...
    OS->>Auth: User Authenticates via Google Workspace SSO / Email
    Auth->>Auth: Validates credentials, creates Auth Code
    Auth->>OS: Redirects to custom protocol: noteflow://auth/callback?code=...
    OS->>App: OS delegates protocol to NoteFlow Desktop binary
    App->>Auth: POST /api/auth/token (code + code_verifier)
    Auth-->>App: Returns JWT Access Token + Refresh Token + User Profile
    App->>Vault: Stores Refresh Token in macOS Keychain / Windows Credential Vault
    App->>App: Emits 'auth-success' to Webview UI; Desktop sync active
```

---

## 4. Permission Model & OS Ingress Hooks

Desktop meeting detection and audio capture require explicit OS permission grants. The application uses a progressive disclosure permission model.

### Permission Matrix

| Capability | macOS Subsystem | Windows Subsystem | Prompt Timing | Fallback If Denied |
| :--- | :--- | :--- | :--- | :--- |
| **Microphone / Input** | `AVCaptureDevice` / `TCC.db` | Windows Media Capture API | Upon first audio recording start | Ingress via headless cloud bot only |
| **System Audio Capture** | `ScreenCaptureKit` / `CoreAudio` | Windows Audio Session API (`WASAPI` Loopback) | Upon local audio ingress toggle | Audio capture disabled; manual transcript upload fallback |
| **Calendar Sync** | Read-only Google/Outlook API (Cloud) or EventKit (macOS) | Outlook MAPI / Cloud REST API | During initial onboarding setup | Manual Meet URL entry in quick-bar |
| **OS Notifications** | `UNUserNotificationCenter` | Windows Notification Service (`ToastNotification`) | Onboarding (T-5m alerts) | In-app floating indicator only |
| **Launch at Startup** | `SMAppService` (macOS 13+) / Login Item | Windows Registry `Run` key or Startup folder | User settings toggle | Manual app launch required |

---

## 5. Background Daemon & Meeting Ingress Lifecycle

```
                           ┌──────────────────────────┐
                           │    Application Launch    │
                           │ (Menu Bar / System Tray) │
                           └─────────────┬────────────┘
                                         │
                                         ▼
                           ┌──────────────────────────┐
                           │  Calendar Polling Daemon │
                           │  (Every 5m or Webhook)   │
                           └─────────────┬────────────┘
                                         │
                         Is meeting starting in <= 5 mins?
                                         │
                         ┌───────────────┴───────────────┐
                         ▼ YES                           ▼ NO
            ┌──────────────────────────┐     ┌────────────────────────┐
            │   Trigger Native Toast   │     │ Sleep until next check │
            │  "Meeting starting soon" │     └────────────────────────┘
            └────────────┬─────────────┘
                         │
            Did user approve recording?
                         │
          ┌──────────────┴──────────────┐
          ▼ YES (1-Click Approve)       ▼ NO (Dismiss / Opt-Out)
┌──────────────────────────┐ ┌───────────────────────────────────────┐
│ Dispatch Ingress Worker  │ │ Ingress marked 'off' for this session │
│ (Cloud Bot or Local Mic) │ └───────────────────────────────────────┘
└─────────────┬────────────┘
              │
              ▼
┌───────────────────────────────────────┐
│       Live Recording Active           │
│ - Floating Mini-Dock visible          │
│ - Real-time Voice Activity Detection  │
│ - Local encrypted buffer streaming    │
└─────────────┬─────────────────────────┘
              │
              ▼
┌───────────────────────────────────────┐
│       Stop Recording Triggered        │
│ 1. Audio stream finalized             │
│ 2. Payload sent to NoteFlow Cloud     │
│ 3. Local RAM / temp buffers purged    │
│ 4. AI Synthesis pipeline initiated    │
│ 5. Notification: "Summary Ready"      │
│ 6. 1-Click opens Web Application      │
└───────────────────────────────────────┘
```

---

## 6. Update Strategy & Code Signing

### macOS Update & Code Signing Pipeline
1. **Code Signing:** Binary and all dylibs signed with **Apple Developer ID Application Certificate**.
2. **Notarization:** Automated submission to Apple Notary Service (`xcrun notarytool`) during GitHub Actions CI/CD; `spctl` gatekeeper validation enforced.
3. **Hardened Runtime:** Flags enabled: `com.apple.security.cs.allow-unsigned-executable-memory = false`, strict sandbox.
4. **Auto-Updater:** Built-in Tauri updater using **Ed25519 signature verification** over HTTPS with silent background download and restart prompt.

### Windows Update & Code Signing Pipeline
1. **Code Signing:** Signed with **EV (Extended Validation) Authenticode Certificate** to prevent Microsoft Defender SmartScreen warnings.
2. **Package Formats:**
   - **MSIX Package:** Microsoft Store & modern enterprise MDM distribution with declarative capabilities.
   - **NSIS / WiX Installer (.exe/.msi):** Lightweight standalone installer with per-user installation (zero admin rights required).
3. **Delta Updates:** Tauri differential binary patches minimize bandwidth consumption (<2MB per update).

---

## 7. Security Architecture & Threat Modeling

1. **Zero Secret Storage in Plaintext:**
   - macOS: Stored in **Apple Keychain Services** using `kSecClassGenericPassword` with ACL tied exclusively to the NoteFlow bundle identifier (`ai.noteflow.desktop`).
   - Windows: Stored in **Windows Credential Manager** encrypted via **DPAPI** (`CryptProtectData`).
2. **No Cleartext Audio Retention:**
   - Temporary audio chunks recorded locally are streamed in real-time over TLS 1.3 to the diarization engine.
   - Any local temp cache is stored in RAM or an encrypted ephemeral cache directory with automated wipe on process exit (`secure_delete`).
3. **IPC Command Whitelisting:**
   - Tauri 2.0 capabilities file explicitly restricts frontend invocations: only declared commands (`start_recording`, `stop_recording`, `sync_calendar`, `open_web_app`) are accessible.

---

## 8. Offline Behavior & Network Partition Handling

| Scenario | Desktop App Behavior | Recovery Flow |
| :--- | :--- | :--- |
| **No Internet at Startup** | App starts in cached offline mode; loads today's schedule from local encrypted SQLite cache. | Retries sync with exponential backoff; indicators show "Offline Mode". |
| **Connection Lost During Recording** | Audio ingress continues uninterrupted to encrypted local ring buffer on disk. | Once network is restored, stream resumes; backlogged audio chunks flush automatically. |
| **Cloud AI Synthesis Unavailable** | Recording successfully completes; status changes to `pending_synthesis`. | Backend processes queued meetings as soon as cloud worker nodes become available. |

---

## 9. Failure States & Graceful Degradation

```
┌──────────────────────────────────┬───────────────────────────────────────────────────────┐
│ Failure Scenario                 │ Desktop Graceful Degradation Handling                 │
├──────────────────────────────────┼───────────────────────────────────────────────────────┤
│ OAuth Token Revoked              │ Tray icon shows amber badge -> 1-click Reconnect popup│
│ Microphone / Audio Busy          │ Shows native warning with input device selector       │
│ Meeting Cancelled Last Minute    │ Background job automatically cancelled at T-60s       │
│ Host Rejects Bot Ingress         │ Session aborted, 0 partial audio retained, alert sent │
│ Disk Space Low (<500MB)          │ Ingress blocked with clear OS notification            │
└──────────────────────────────────┴───────────────────────────────────────────────────────┘
```

---

## 10. Clean Uninstall Behavior

A trustworthy desktop application must leave zero orphaned artifacts upon uninstallation:

- **macOS Cleanup:**
  - Preferences: `~/Library/Preferences/ai.noteflow.desktop.plist`
  - Application Support: `~/Library/Application Support/NoteFlow AI`
  - Caches & Logs: `~/Library/Caches/ai.noteflow.desktop` and `~/Library/Logs/NoteFlow AI`
  - Keychain Items: Keychain delete query executed during in-app sign-out / reset.
  - Login Items: `SMAppService.mainApp.unregister()` removes auto-start daemon cleanly.
- **Windows Cleanup:**
  - Uninstaller script deletes `%APPDATA%\NoteFlow AI` and `%LOCALAPPDATA%\NoteFlow AI`.
  - Windows Registry startup keys under `HKCU\Software\Microsoft\Windows\CurrentVersion\Run` purged.
  - Windows Credential Vault entries for NoteFlow deleted.

---

## 11. Architectural Deliverables Summary

1. **Framework:** **Tauri 2.0 (Rust Core + System Webview)** selected over Electron for its 10x smaller footprint, security sandbox, and native OS audio hooks.
2. **Companion Role:** Operates as a discreet menu bar/system tray assistant that alerts users at T-5m, requires 1-click explicit consent, streams audio securely, and hands off synthesized notes to the NoteFlow Web App.
3. **Platform Parity:** Full dual-platform support for macOS (ScreenCaptureKit, Keychain, Apple Silicon/Intel) and Windows (WASAPI, DPAPI, MSIX/NSIS).

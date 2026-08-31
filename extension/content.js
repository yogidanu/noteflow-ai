/**
 * NoteFlow AI — Google Meet In-Meeting Content Script
 * Two-Way Real-Time Bridge with NoteFlow AI Web Application
 */

(function () {
  let isMeetingActive = false;
  let isRecording = false;
  let isPaused = false;
  let durationSeconds = 0;
  let timerInterval = null;
  let widgetEl = null;

  const NOTEFLOW_WEB_URL = "https://noteflow-ai-cc3p.vercel.app";

  // Real-time bidirectional BroadcastChannel with NoteFlow Web App
  let bridgeChannel = null;
  try {
    if (typeof window !== "undefined" && "BroadcastChannel" in window) {
      bridgeChannel = new BroadcastChannel("noteflow_meeting_bridge");
      bridgeChannel.onmessage = (event) => {
        const data = event.data;
        if (!data || typeof data !== "object") return;

        if (data.type === "NOTEFLOW_STATE_UPDATE") {
          if (data.lifecycleState === "RECORDING") {
            isRecording = true;
            isPaused = false;
            if (typeof data.durationSeconds === "number") {
              durationSeconds = data.durationSeconds;
            }
            renderWidgetContent();
          } else if (data.lifecycleState === "PAUSED") {
            isRecording = true;
            isPaused = true;
            renderWidgetContent();
          } else if (data.lifecycleState === "IDLE" || data.lifecycleState === "COMPLETED") {
            isRecording = false;
            isPaused = false;
            renderWidgetContent();
          }
        }
      };
    }
  } catch (e) {
    console.warn("[NoteFlow Extension] BroadcastChannel init warning:", e);
  }

  function isMeetCallUrl() {
    return /^https?:\/\/meet\.google\.com\/[a-z]{3}-[a-z]{4}-[a-z]{3}/i.test(window.location.href);
  }

  function getMeetingCode() {
    const match = window.location.pathname.match(/\/([a-z]{3}-[a-z]{4}-[a-z]{3})/i);
    return match ? match[1] : "Meeting";
  }

  function formatTime(totalSec) {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  }

  function injectNoteflowWidget() {
    if (document.getElementById("noteflow-in-meet-widget")) return;

    widgetEl = document.createElement("div");
    widgetEl.id = "noteflow-in-meet-widget";

    renderWidgetContent();
    document.body.appendChild(widgetEl);
  }

  function renderWidgetContent() {
    if (!widgetEl) return;

    const meetCode = getMeetingCode();

    if (!isRecording) {
      widgetEl.innerHTML = `
        <div class="noteflow-glass-pill">
          <div class="noteflow-status-block">
            <div class="noteflow-pulse-dot"></div>
            <div class="noteflow-title-text">
              <span class="noteflow-title-main">Meeting detected</span>
              <span class="noteflow-title-sub">${meetCode} • Ready to record</span>
            </div>
          </div>
          <button id="noteflow-start-btn" class="noteflow-action-btn">
            <span>⚡ Start Notetaker</span>
          </button>
          <button id="noteflow-close-btn" class="noteflow-close-btn" title="Dismiss">
            ✕
          </button>
        </div>
      `;

      const startBtn = widgetEl.querySelector("#noteflow-start-btn");
      if (startBtn) {
        startBtn.addEventListener("click", handleStartNotetaker);
      }

      const closeBtn = widgetEl.querySelector("#noteflow-close-btn");
      if (closeBtn) {
        closeBtn.addEventListener("click", () => {
          widgetEl.style.display = "none";
        });
      }
    } else {
      widgetEl.innerHTML = `
        <div class="noteflow-glass-pill">
          <div class="noteflow-status-block">
            <div class="noteflow-pulse-dot ${isPaused ? "" : "recording"}"></div>
            <div class="noteflow-title-text">
              <span class="noteflow-title-main">${isPaused ? "Recording Paused" : "NoteFlow Recording"}</span>
              <span class="noteflow-title-sub">${meetCode}</span>
            </div>
          </div>
          <div class="noteflow-timer">${formatTime(durationSeconds)}</div>
          <button id="noteflow-stop-btn" class="noteflow-action-btn recording">
            <span>⏹ Stop & Synthesize</span>
          </button>
          <button id="noteflow-open-app" class="noteflow-close-btn" title="Open NoteFlow Workspace">
            ↗
          </button>
        </div>
      `;

      const stopBtn = widgetEl.querySelector("#noteflow-stop-btn");
      if (stopBtn) {
        stopBtn.addEventListener("click", handleStopNotetaker);
      }

      const openAppBtn = widgetEl.querySelector("#noteflow-open-app");
      if (openAppBtn) {
        openAppBtn.addEventListener("click", () => {
          window.open(NOTEFLOW_WEB_URL, "noteflow_workspace_tab");
        });
      }
    }
  }

  function handleStartNotetaker() {
    isRecording = true;
    isPaused = false;
    durationSeconds = 0;

    // 1. Start local duration ticker
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(() => {
      if (!isPaused) {
        durationSeconds += 1;
        const timerEl = widgetEl?.querySelector(".noteflow-timer");
        if (timerEl) {
          timerEl.textContent = formatTime(durationSeconds);
        }
      }
    }, 1000);

    renderWidgetContent();

    const currentUrl = window.location.href;
    const meetCode = getMeetingCode();

    // 2. Broadcast START_RECORDING to open NoteFlow tabs
    try {
      if (bridgeChannel) {
        bridgeChannel.postMessage({
          type: "START_RECORDING",
          url: currentUrl,
          meetingCode: meetCode,
          timestamp: Date.now(),
        });
      }
    } catch {
      // ignore
    }

    // 3. Signal Chrome background service worker
    try {
      chrome.runtime?.sendMessage({
        type: "NOTEFLOW_START_MEETING",
        meetingUrl: currentUrl,
        meetingCode: meetCode,
      });
    } catch {
      // ignore
    }

    // 4. Open NoteFlow AI tab in background with autostart directive
    window.open(
      `${NOTEFLOW_WEB_URL}?autostart=true&url=${encodeURIComponent(currentUrl)}`,
      "noteflow_workspace_tab"
    );
  }

  function handleStopNotetaker() {
    isRecording = false;
    isPaused = false;

    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }

    renderWidgetContent();

    // 1. Broadcast STOP_RECORDING to NoteFlow app
    try {
      if (bridgeChannel) {
        bridgeChannel.postMessage({
          type: "STOP_RECORDING",
          meetingCode: getMeetingCode(),
          timestamp: Date.now(),
        });
      }
    } catch {
      // ignore
    }

    // 2. Signal Chrome background service worker
    try {
      chrome.runtime?.sendMessage({
        type: "NOTEFLOW_STOP_MEETING",
        meetingCode: getMeetingCode(),
      });
    } catch {
      // ignore
    }

    // 3. Bring NoteFlow workspace tab into view to see synthesized notes
    window.open(NOTEFLOW_WEB_URL, "noteflow_workspace_tab");
  }

  // Check DOM periodically for active call elements (e.g. bottom toolbar buttons)
  function monitorMeetingCallState() {
    if (!isMeetCallUrl()) return;

    const callControls =
      document.querySelector('[data-call-ended="false"]') ||
      document.querySelector('button[aria-label*="Leave call"]') ||
      document.querySelector('button[aria-label*="leave call"]') ||
      document.querySelector('div[jscontroller][data-is-in-call="true"]') ||
      document.querySelector('div[role="region"][aria-label*="Call controls"]');

    if (callControls || document.querySelector('div[data-meeting-title]')) {
      if (!isMeetingActive) {
        isMeetingActive = true;
        setTimeout(injectNoteflowWidget, 1000);
      }
    }
  }

  if (isMeetCallUrl()) {
    setTimeout(injectNoteflowWidget, 1500);
    setInterval(monitorMeetingCallState, 2000);
  }
})();

/**
 * NoteFlow AI — Google Meet In-Meeting Content Script
 * Detects active Google Meet calls and renders the 1-click Notetaker overlay.
 */

(function () {
  let isMeetingActive = false;
  let isRecording = false;
  let durationSeconds = 0;
  let timerInterval = null;
  let widgetEl = null;

  const NOTEFLOW_WEB_URL = "https://noteflow-ai-cc3p.vercel.app";

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
              <span class="noteflow-title-sub">${meetCode} • Now</span>
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
            <div class="noteflow-pulse-dot recording"></div>
            <div class="noteflow-title-text">
              <span class="noteflow-title-main">NoteFlow Active</span>
              <span class="noteflow-title-sub">Recording audio</span>
            </div>
          </div>
          <div class="noteflow-timer">${formatTime(durationSeconds)}</div>
          <button id="noteflow-stop-btn" class="noteflow-action-btn recording">
            <span>⏹ Stop & Synthesize</span>
          </button>
          <button id="noteflow-open-app" class="noteflow-close-btn" title="Open NoteFlow">
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
          window.open(NOTEFLOW_WEB_URL, "_blank");
        });
      }
    }
  }

  function handleStartNotetaker() {
    isRecording = true;
    durationSeconds = 0;

    // Start timer
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(() => {
      durationSeconds += 1;
      const timerEl = widgetEl?.querySelector(".noteflow-timer");
      if (timerEl) {
        timerEl.textContent = formatTime(durationSeconds);
      }
    }, 1000);

    renderWidgetContent();

    // Signal background script or open NoteFlow Web app
    try {
      chrome.runtime?.sendMessage({
        type: "NOTEFLOW_START_MEETING",
        meetingUrl: window.location.href,
        meetingCode: getMeetingCode(),
      });
    } catch {
      // ignore
    }

    // Also open NoteFlow in background tab if desired
    window.open(`${NOTEFLOW_WEB_URL}?autostart=true&url=${encodeURIComponent(window.location.href)}`, "noteflow_tab");
  }

  function handleStopNotetaker() {
    isRecording = false;
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }

    renderWidgetContent();

    try {
      chrome.runtime?.sendMessage({
        type: "NOTEFLOW_STOP_MEETING",
        meetingCode: getMeetingCode(),
      });
    } catch {
      // ignore
    }

    // Bring NoteFlow tab into view
    window.open(NOTEFLOW_WEB_URL, "noteflow_tab");
  }

  // Check DOM periodically for active call elements (e.g. bottom toolbar buttons)
  function monitorMeetingCallState() {
    if (!isMeetCallUrl()) return;

    // Check if user is in an active call (toolbar present)
    const callControls = document.querySelector('[data-call-ended="false"]') ||
      document.querySelector('button[aria-label*="Leave call"]') ||
      document.querySelector('button[aria-label*="leave call"]') ||
      document.querySelector('div[jscontroller][data-is-in-call="true"]') ||
      document.querySelector('div[role="region"][aria-label*="Call controls"]');

    if (callControls || document.querySelector('div[data-meeting-title]')) {
      if (!isMeetingActive) {
        isMeetingActive = true;
        setTimeout(injectNoteflowWidget, 1500);
      }
    }
  }

  // Initial check and mutation observer
  if (isMeetCallUrl()) {
    setTimeout(injectNoteflowWidget, 2000);
    setInterval(monitorMeetingCallState, 2000);
  }
})();

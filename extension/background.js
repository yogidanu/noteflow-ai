/**
 * NoteFlow AI Extension Service Worker
 */

chrome.runtime.onInstalled.addListener(() => {
  console.log("[NoteFlow Extension] Installed successfully.");
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "NOTEFLOW_START_MEETING") {
    console.log("[NoteFlow Extension] Meeting started:", message.meetingCode);
    chrome.storage.local.set({
      activeMeeting: {
        meetingUrl: message.meetingUrl,
        meetingCode: message.meetingCode,
        startedAt: Date.now(),
      },
    });
    sendResponse({ success: true });
  } else if (message.type === "NOTEFLOW_STOP_MEETING") {
    console.log("[NoteFlow Extension] Meeting stopped:", message.meetingCode);
    chrome.storage.local.remove("activeMeeting");
    sendResponse({ success: true });
  }
  return true;
});

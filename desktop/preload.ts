/**
 * Desktop ContextBridge Preload Script
 * Strictly isolates Node.js runtime and exposes typed desktop APIs
 */

import { contextBridge, ipcRenderer } from "electron";
import { DesktopAPI, AutoUpdateStatus, AudioTelemetry } from "./types/desktop";

const desktopAPI: DesktopAPI = {
  loginWithPKCE: () => ipcRenderer.invoke("desktop:login-pkce"),
  getSession: () => ipcRenderer.invoke("desktop:get-session"),
  logout: () => ipcRenderer.invoke("desktop:logout"),

  syncCalendar: () => ipcRenderer.invoke("desktop:sync-calendar"),
  onUpcomingMeetingAlert: (callback) => {
    const handler = (_: any, meeting: any) => callback(meeting);
    ipcRenderer.on("desktop:meeting-alert", handler);
    return () => ipcRenderer.removeListener("desktop:meeting-alert", handler);
  },
  approveRecording: (meetingId: string) => ipcRenderer.invoke("desktop:approve-recording", meetingId),

  startRecording: (meetingId: string) => ipcRenderer.invoke("desktop:start-recording", meetingId),
  pauseRecording: (meetingId: string) => ipcRenderer.invoke("desktop:pause-recording", meetingId),
  resumeRecording: (meetingId: string) => ipcRenderer.invoke("desktop:resume-recording", meetingId),
  stopRecording: (meetingId: string) => ipcRenderer.invoke("desktop:stop-recording", meetingId),
  onAudioTelemetry: (callback) => {
    const handler = (_: any, telemetry: AudioTelemetry) => callback(telemetry);
    ipcRenderer.on("desktop:audio-telemetry", handler);
    return () => ipcRenderer.removeListener("desktop:audio-telemetry", handler);
  },

  openWebApp: (route?: string) => ipcRenderer.invoke("desktop:open-web-app", route),
  toggleFloatingWidget: (show: boolean) => ipcRenderer.invoke("desktop:toggle-floating", show),
  minimizeToTray: () => ipcRenderer.invoke("desktop:minimize-to-tray"),

  checkForUpdates: () => ipcRenderer.invoke("desktop:check-updates"),
  installUpdate: () => ipcRenderer.invoke("desktop:install-update"),
  onUpdateStatusChange: (callback) => {
    const handler = (_: any, status: AutoUpdateStatus) => callback(status);
    ipcRenderer.on("desktop:update-status", handler);
    return () => ipcRenderer.removeListener("desktop:update-status", handler);
  },

  getPlatformInfo: () => ipcRenderer.invoke("desktop:get-platform-info"),
};

contextBridge.exposeInMainWorld("noteFlowDesktop", desktopAPI);

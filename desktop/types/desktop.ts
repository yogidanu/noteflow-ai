/**
 * Desktop Application Typed IPC Interfaces & Data Contracts
 * NoteFlow AI • Meet Record Desktop Companion
 */

import { DetectedMeeting, MeetingNote, AIAnalysisResult, RefinementPromptType } from "../../src/types/meeting";

export interface DesktopAuthSession {
  userId: string;
  email: string;
  name: string;
  accessToken: string;
  expiresAt: number;
  scopes: string[];
}

export interface DesktopMeetingPayload {
  meetingId: string;
  title: string;
  platform: "google_meet" | "zoom" | "teams" | "unsupported";
  meetingUrl?: string;
  organizer: string;
  startTime: string;
  endTime: string;
  isRecordingApproved: boolean;
}

export interface AudioTelemetry {
  powerLevel: number;
  isMuted: boolean;
  secondsRecorded: number;
}

export interface AutoUpdateStatus {
  status: "idle" | "checking" | "available" | "not_available" | "downloading" | "downloaded" | "error";
  version?: string;
  releaseNotes?: string;
  progressPercent?: number;
  errorMessage?: string;
}

export interface CrashReportConfig {
  submitURL: string;
  uploadToServer: boolean;
  userEmail?: string;
  companyName: string;
  productName: string;
}

export interface DesktopAPI {
  // Authentication & Session
  loginWithPKCE: () => Promise<DesktopAuthSession>;
  getSession: () => Promise<DesktopAuthSession | null>;
  logout: () => Promise<void>;

  // Calendar & Meeting Detection
  syncCalendar: () => Promise<DetectedMeeting[]>;
  onUpcomingMeetingAlert: (callback: (meeting: DetectedMeeting) => void) => () => void;
  approveRecording: (meetingId: string) => Promise<boolean>;

  // Ingress & Audio Recording
  startRecording: (meetingId: string) => Promise<boolean>;
  pauseRecording: (meetingId: string) => Promise<boolean>;
  resumeRecording: (meetingId: string) => Promise<boolean>;
  stopRecording: (meetingId: string) => Promise<{ rawTranscript: string }>;
  onAudioTelemetry: (callback: (telemetry: AudioTelemetry) => void) => () => void;

  // Window & Web App Navigation
  openWebApp: (route?: string) => Promise<void>;
  toggleFloatingWidget: (show: boolean) => Promise<void>;
  minimizeToTray: () => Promise<void>;

  // Auto-Update
  checkForUpdates: () => Promise<AutoUpdateStatus>;
  installUpdate: () => Promise<void>;
  onUpdateStatusChange: (callback: (status: AutoUpdateStatus) => void) => () => void;

  // System Diagnostics & Platform Info
  getPlatformInfo: () => Promise<{
    platform: "darwin" | "win32";
    arch: string;
    version: string;
    isPackaged: boolean;
  }>;
}

declare global {
  interface Window {
    noteFlowDesktop?: DesktopAPI;
  }
}

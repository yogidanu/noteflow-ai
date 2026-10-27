export interface SourceCitation {
  id: string;
  speaker?: string;
  timestamp?: string; // e.g. "14:22" — only for time-anchored citations
  /**
   * Grounding anchor kind. "time": the source is audio/timed (recorder,
   * VTT, STT) and the citation is checked against its timestamp.
   * "line": the source is authored/pasted text with no time domain
   * (manual notes) and the citation is checked against its source line
   * (lineIndex + rawText) — it must never display a fabricated "00:00".
   */
  anchorKind?: "time" | "line";
  rawText: string;
  lineIndex?: number;
  isEdited?: boolean;
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

export interface DiscussionPoint {
  id: string;
  topic: string;
  summary: string;
  speakers?: string[];
  citation?: SourceCitation;
  isEdited?: boolean;
}

export interface AIAnalysisResult {
  executiveSummary: string;
  decisions: DecisionItem[];
  actionItems: ActionItem[];
  unresolvedQuestions: UnresolvedQuestion[];
  importantDiscussionPoints?: DiscussionPoint[];
  detectedSpeakers: string[];
  wordCount: number;
  estimatedMeetingDurationMinutes: number;
  modelConfidence: "high" | "moderate" | "low";
  appliedRefinement?: string;
  isPartialCapture?: boolean;
}

export type InputFormatType = "vtt" | "teams" | "meet" | "bullets" | "raw";

export type RecordingLifecycleState =
  | "IDLE"
  | "STARTING"
  | "RECORDING"
  | "PAUSED"
  | "STOPPING"
  | "PROCESSING"
  | "COMPLETED"
  | "ERROR";

export type RecordingStatusType =
  | "off"
  | "scheduled"
  | "waiting_room"
  | "recording"
  | "transcribing"
  | "completed"
  | "error";

export type MeetRecordErrorType =
  | "HOST_DENIED_ENTRY"
  | "WAITING_ROOM_TIMEOUT"
  | "OAUTH_EXPIRED"
  | "BOT_MUTED_SILENCE"
  | "UNSUPPORTED_PLATFORM"
  | "NETWORK_GLITCH";

export type MeetingPlatformType = "google_meet" | "zoom" | "teams" | "unsupported";

export type MeetingLifecycleStatus =
  | "SCHEDULED"
  | "STARTING"
  | "IN_PROGRESS"
  | "RECORDING"
  | "COMPLETED"
  | "CANCELLED";

export interface Attendee {
  name: string;
  email: string;
  avatar?: string;
  rsvp: "accepted" | "tentative" | "declined";
}

export interface MeetingOrganizer {
  name: string;
  email: string;
}

/**
 * Which source produced a recording's final transcript. Recorded so a
 * silent fallback to browser live captions (lower quality: no
 * punctuation, no diarization) is VISIBLE in the UI instead of quietly
 * degrading every summary — see MeetingHeaderBanner.
 *  - "session": backend recording-session transcript
 *  - "deepgram": Deepgram STT over the recorded audio
 *  - "webspeech": browser live captions (fallback only)
 *  - "fallback": no usable transcript could be produced
 */
export type TranscriptSourceType = "session" | "deepgram" | "webspeech" | "fallback";

export interface DetectedMeeting {
  id: string;
  calendarEventId: string;
  title: string;
  startTime: string; // Formatted HH:MM e.g. "10:00 AM"
  endTime: string;   // Formatted HH:MM e.g. "10:45 AM"
  startIso?: string; // ISO 8601 string
  endIso?: string;   // ISO 8601 string
  organizer?: MeetingOrganizer;
  organizerName: string;
  organizerEmail: string;
  isExternalHost: boolean;
  attendees: Attendee[];
  platform: MeetingPlatformType;
  meetingUrl: string;
  status?: MeetingLifecycleStatus;
  recordingStatus: RecordingStatusType;
  dedupHash: string;
  errorReason?: MeetRecordErrorType;
  sampleTranscriptPreset?: string;
  transcriptSource?: TranscriptSourceType;
  transcriptNote?: string;
}

export interface MeetingNote {
  id: string;
  userId?: string;
  title: string;
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
  rawInput: string;
  sanitizedInput: string;
  inputFormat: InputFormatType;
  isSample?: boolean;
  status: "draft" | "generating" | "completed" | "error";
  errorMessage?: string;
  analysis?: AIAnalysisResult;
  detectedMeetingId?: string;
  calendarEventId?: string;
  recordingSessionId?: string;
  platform?: MeetingPlatformType;
  meetingUrl?: string;
  durationSeconds?: number;
  transcriptSource?: TranscriptSourceType;
  /** Why a fallback source was used (e.g. the Deepgram failure reason). */
  transcriptNote?: string;
}

export type RefinementPromptType =
  | "standard"
  | "shorter"
  | "technical"
  | "action_focused"
  | "executive";

export type CalendarStatusType = "NOT_CONNECTED" | "CONNECTING" | "CONNECTED" | "REAUTH_REQUIRED" | "ERROR";

export interface CalendarConnectionState {
  isConnected: boolean;
  status: CalendarStatusType;
  accountEmail: string | null;
  lastSyncedAt: string | null;
  syncToken?: string;
  errorMessage?: string | null;
}

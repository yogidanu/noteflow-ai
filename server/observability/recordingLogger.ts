/**
 * NoteFlow AI • Meeting Pipeline Observability Engine (Phase 2.9)
 * 
 * Emits sanitized, structured JSON telemetry for every stage of the meeting pipeline.
 * 
 * Strict Data Minimization & Privacy Guarantees:
 * - Zero audio waveform/buffer bytes logged.
 * - Zero raw transcript dialogue or text logged.
 * - Zero OAuth tokens, refresh tokens, client secrets, or API keys logged.
 * - Every diagnostic event is traceable via: userId, meetingId, recordingSessionId, transcriptId.
 */

import { EventEmitter } from "node:events";

export type RecordingTelemetryEventType =
  | "MEETING_DETECTED"
  | "RECORDING_INITIALIZED"
  | "AUDIO_CAPTURE_ACTIVE"
  | "AUDIO_CHUNKS_RECEIVED"
  | "RECORDING_STOPPED"
  | "AUDIO_PERSISTED"
  | "TRANSCRIPTION_STARTED"
  | "TRANSCRIPTION_COMPLETED"
  | "TRANSCRIPTION_FAILED"
  | "AI_PROCESSING_STARTED"
  | "AI_PROCESSING_COMPLETED"
  | "MEETING_COMPLETED"
  // Legacy aliases
  | "RECORDING_STARTED"
  | "AUDIO_SAVED"
  | "SUMMARY_STARTED"
  | "SUMMARY_COMPLETED"
  | "SUMMARY_FAILED"
  | "SYNC_STARTED"
  | "SYNC_COMPLETED"
  | "SYNC_FAILED";

export type ObservabilityErrorCode =
  | "AUDIO_CAPTURE_FAILED"
  | "RECORDING_UPLOAD_FAILED"
  | "TRANSCRIPTION_AUTH_FAILED"
  | "TRANSCRIPTION_TIMEOUT"
  | "TRANSCRIPTION_INVALID_AUDIO"
  | "TRANSCRIPTION_EMPTY_RESULT"
  | "AI_PROCESSING_FAILED";

export interface BaseTelemetryEvent {
  event: RecordingTelemetryEventType;
  timestamp: string;
  userId: string;
  meetingId: string;
  recordingSessionId: string;
  recordingId?: string; // alias
  calendarEventId?: string;
  transcriptId?: string;
  summaryId?: string;
  errorCode?: ObservabilityErrorCode | string;
  errorMessage?: string;
  metadata?: Record<string, any>;
}

export interface MeetingDetectedEvent extends BaseTelemetryEvent {
  event: "MEETING_DETECTED";
  meetingUrl?: string;
  platform?: string;
  title?: string;
}

export interface RecordingInitializedEvent extends BaseTelemetryEvent {
  event: "RECORDING_INITIALIZED";
  meetingUrl?: string;
  dedupHash?: string;
}

export interface AudioCaptureActiveEvent extends BaseTelemetryEvent {
  event: "AUDIO_CAPTURE_ACTIVE" | "RECORDING_STARTED";
  sampleRate?: number;
  channelCount?: number;
}

export interface AudioChunksReceivedEvent extends BaseTelemetryEvent {
  event: "AUDIO_CHUNKS_RECEIVED";
  chunkIndex: number;
  chunkSizeBytes: number;
  totalBytesSoFar: number;
}

export interface RecordingStoppedEvent extends BaseTelemetryEvent {
  event: "RECORDING_STOPPED";
  durationSeconds: number;
  audioChunkCount: number;
  totalAudioBytes: number;
}

export interface AudioPersistedEvent extends BaseTelemetryEvent {
  event: "AUDIO_PERSISTED" | "AUDIO_SAVED";
  audioArtifactId: string;
  audioBytes: number;
  audioFormat: string;
  durationSeconds?: number;
}

export interface TranscriptionStartedEvent extends BaseTelemetryEvent {
  event: "TRANSCRIPTION_STARTED";
  provider: string;
  audioBytes: number;
  mimeType: string;
}

export interface TranscriptionCompletedEvent extends BaseTelemetryEvent {
  event: "TRANSCRIPTION_COMPLETED";
  provider: string;
  durationMs: number;
  segmentCount: number;
  wordCount: number;
  speakerCount: number;
}

export interface TranscriptionFailedEvent extends BaseTelemetryEvent {
  event: "TRANSCRIPTION_FAILED";
  provider: string;
  durationMs: number;
  errorCode: ObservabilityErrorCode | string;
  errorMessage: string;
}

export interface AIProcessingStartedEvent extends BaseTelemetryEvent {
  event: "AI_PROCESSING_STARTED" | "SUMMARY_STARTED";
  refinement: string;
  wordCount: number;
  segmentCount: number;
}

export interface AIProcessingCompletedEvent extends BaseTelemetryEvent {
  event: "AI_PROCESSING_COMPLETED" | "SUMMARY_COMPLETED";
  durationMs: number;
  decisionCount: number;
  actionItemCount: number;
  questionCount: number;
  modelConfidence: string;
}

export interface MeetingCompletedEvent extends BaseTelemetryEvent {
  event: "MEETING_COMPLETED" | "SYNC_COMPLETED";
  totalPipelineDurationMs: number;
  deliverablesCount: number;
}

export type TelemetryEvent =
  | MeetingDetectedEvent
  | RecordingInitializedEvent
  | AudioCaptureActiveEvent
  | AudioChunksReceivedEvent
  | RecordingStoppedEvent
  | AudioPersistedEvent
  | TranscriptionStartedEvent
  | TranscriptionCompletedEvent
  | TranscriptionFailedEvent
  | AIProcessingStartedEvent
  | AIProcessingCompletedEvent
  | MeetingCompletedEvent
  | any;

class RecordingTelemetryLogger extends EventEmitter {
  private recentEvents: TelemetryEvent[] = [];
  private readonly maxEventHistory = 200;

  /**
   * Sanitizes payload by stripping any accidental text, dialogue, tokens, secrets or audio buffers.
   */
  private sanitizePayload(data: Record<string, any>): Record<string, any> {
    const sensitiveExactKeys = [
      "text",
      "transcript",
      "rawvtt",
      "sanitizedtext",
      "audiobuffer",
      "audiobase64",
      "rawinput",
      "sanitizedinput",
      "executivesummary",
      "dialogue",
    ];
    const sensitiveSubstringKeys = ["token", "clientsecret", "apikey", "secret", "password", "bearer"];

    const clean: Record<string, any> = {};
    for (const [key, value] of Object.entries(data)) {
      const lowerKey = key.toLowerCase();
      if (sensitiveExactKeys.includes(lowerKey)) {
        continue;
      }
      if (sensitiveSubstringKeys.some((s) => lowerKey.includes(s))) {
        continue;
      }
      if (typeof value === "object" && value !== null && !Array.isArray(value)) {
        clean[key] = this.sanitizePayload(value);
      } else {
        clean[key] = value;
      }
    }
    return clean;
  }

  /**
   * Emits a production-safe structured telemetry log.
   */
  public log(event: TelemetryEvent): void {
    const sanitized = this.sanitizePayload(event) as TelemetryEvent;
    sanitized.timestamp = sanitized.timestamp || new Date().toISOString();
    sanitized.recordingSessionId = sanitized.recordingSessionId || sanitized.recordingId || `rec_${sanitized.meetingId}`;

    // Store in recent buffer
    this.recentEvents.push(sanitized);
    if (this.recentEvents.length > this.maxEventHistory) {
      this.recentEvents.shift();
    }

    // Output structured JSON log for CloudWatch / Render / Datadog
    const logLine = JSON.stringify({
      logType: "RECORDING_TELEMETRY",
      ...sanitized,
    });
    console.log(logLine);

    this.emit(event.event, sanitized);
    this.emit("*", sanitized);
  }

  /**
   * Returns recent events for testing or diagnostics.
   */
  public getRecentEvents(filterEvent?: RecordingTelemetryEventType): TelemetryEvent[] {
    if (filterEvent) {
      return this.recentEvents.filter((e) => e.event === filterEvent);
    }
    return [...this.recentEvents];
  }

  /**
   * Clears recent events history.
   */
  public clearHistory(): void {
    this.recentEvents = [];
  }
}

export const recordingLogger = new RecordingTelemetryLogger();

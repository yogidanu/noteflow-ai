/**
 * NoteFlow AI • Production-Safe Recording Observability Engine
 * 
 * Emits sanitized, structured JSON telemetry for all meeting recording lifecycle events.
 * 
 * Strict Data Minimization Policy:
 * - NO audio waveform/buffer bytes logged.
 * - NO raw transcript dialogue or text logged.
 * - NO OAuth tokens, refresh tokens, client secrets, or API keys logged.
 * - ONLY metadata, identifiers, counts, durations, and status codes logged.
 */

import { EventEmitter } from "node:events";

export type RecordingTelemetryEventType =
  | "RECORDING_STARTED"
  | "RECORDING_STOPPED"
  | "AUDIO_SAVED"
  | "TRANSCRIPTION_STARTED"
  | "TRANSCRIPTION_COMPLETED"
  | "TRANSCRIPTION_FAILED"
  | "SUMMARY_STARTED"
  | "SUMMARY_COMPLETED"
  | "SUMMARY_FAILED"
  | "SYNC_STARTED"
  | "SYNC_COMPLETED"
  | "SYNC_FAILED";

export interface BaseTelemetryEvent {
  event: RecordingTelemetryEventType;
  timestamp: string;
  userId: string;
  meetingId: string;
  recordingId: string;
  calendarEventId?: string;
  transcriptId?: string;
  summaryId?: string;
  metadata?: Record<string, any>;
}

export interface RecordingStartedEvent extends BaseTelemetryEvent {
  event: "RECORDING_STARTED";
  meetingUrl?: string;
  platform?: string;
}

export interface RecordingStoppedEvent extends BaseTelemetryEvent {
  event: "RECORDING_STOPPED";
  durationSeconds: number;
  audioChunkCount: number;
  totalAudioBytes: number;
}

export interface AudioSavedEvent extends BaseTelemetryEvent {
  event: "AUDIO_SAVED";
  audioArtifactId: string;
  audioArtifactPath?: string;
  audioBytes: number;
  audioFormat: string;
  durationSeconds?: number;
}

export interface TranscriptionStartedEvent extends BaseTelemetryEvent {
  event: "TRANSCRIPTION_STARTED";
  provider: "deepgram" | "local_speech" | "fixture";
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
  errorCode: string;
  errorMessage: string;
}

export interface SummaryStartedEvent extends BaseTelemetryEvent {
  event: "SUMMARY_STARTED";
  refinement: string;
  wordCount: number;
  segmentCount: number;
}

export interface SummaryCompletedEvent extends BaseTelemetryEvent {
  event: "SUMMARY_COMPLETED";
  durationMs: number;
  decisionCount: number;
  actionItemCount: number;
  questionCount: number;
  modelConfidence: string;
}

export interface SummaryFailedEvent extends BaseTelemetryEvent {
  event: "SUMMARY_FAILED";
  durationMs: number;
  errorCode: string;
  errorMessage: string;
}

export interface SyncStartedEvent extends BaseTelemetryEvent {
  event: "SYNC_STARTED";
  targetSystem: "database" | "workspace_canvas";
}

export interface SyncCompletedEvent extends BaseTelemetryEvent {
  event: "SYNC_COMPLETED";
  durationMs: number;
  syncedEntities: string[];
}

export interface SyncFailedEvent extends BaseTelemetryEvent {
  event: "SYNC_FAILED";
  durationMs: number;
  errorCode: string;
  errorMessage: string;
}

export type TelemetryEvent =
  | RecordingStartedEvent
  | RecordingStoppedEvent
  | AudioSavedEvent
  | TranscriptionStartedEvent
  | TranscriptionCompletedEvent
  | TranscriptionFailedEvent
  | SummaryStartedEvent
  | SummaryCompletedEvent
  | SummaryFailedEvent
  | SyncStartedEvent
  | SyncCompletedEvent
  | SyncFailedEvent;

class RecordingTelemetryLogger extends EventEmitter {
  private recentEvents: TelemetryEvent[] = [];
  private readonly maxEventHistory = 200;

  /**
   * Sanitizes payload by stripping any accidental text, dialogue, tokens, or audio buffers.
   */
  private sanitizePayload(data: Record<string, any>): Record<string, any> {
    const sensitiveExactKeys = ["text", "transcript", "rawvtt", "sanitizedtext", "audiobuffer", "audiobase64", "rawinput", "sanitizedinput", "executivesummary", "dialogue"];
    const sensitiveSubstringKeys = ["token", "clientsecret", "apikey", "secret", "password"];

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

    // Store in recent buffer
    this.recentEvents.push(sanitized);
    if (this.recentEvents.length > this.maxEventHistory) {
      this.recentEvents.shift();
    }

    // Output formatted structured JSON to stdout for CloudWatch / Render / Datadog
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

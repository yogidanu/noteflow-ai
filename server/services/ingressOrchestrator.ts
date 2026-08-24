import { EventEmitter } from "node:events";
import { sttService, SanitizedTranscriptPayload } from "./sttService.js";
import { summaryService, AIAnalysisResult } from "./summaryService.js";

export type IngressStatus =
  | "off"
  | "scheduled"
  | "waiting_room"
  | "recording"
  | "transcribing"
  | "completed"
  | "error";

export interface RecordingSession {
  meetingId: string;
  title: string;
  meetingUrl: string;
  dedupHash: string;
  userIds: Set<string>;
  status: IngressStatus;
  startedAt?: number;
  durationSeconds: number;
  isPaused: boolean;
  audioPowerLevel: number;
  errorReason?: string;
  transcript?: SanitizedTranscriptPayload;
  summary?: AIAnalysisResult;
}

class IngressOrchestrator extends EventEmitter {
  private activeSessions = new Map<string, RecordingSession>(); // Keyed by dedupHash
  private timerIntervals = new Map<string, NodeJS.Timeout>();

  /**
   * Schedules or registers an ingress dispatch job.
   */
  public scheduleRecording(params: {
    meetingId: string;
    title: string;
    meetingUrl: string;
    dedupHash: string;
    userId: string;
  }): RecordingSession {
    let session = this.activeSessions.get(params.dedupHash);

    if (!session) {
      session = {
        meetingId: params.meetingId,
        title: params.title,
        meetingUrl: params.meetingUrl,
        dedupHash: params.dedupHash,
        userIds: new Set([params.userId]),
        status: "scheduled",
        durationSeconds: 0,
        isPaused: false,
        audioPowerLevel: 0,
      };
      this.activeSessions.set(params.dedupHash, session);
    } else {
      // De-duplication: Add user to existing shared session
      session.userIds.add(params.userId);
    }

    this.emitEvent(session, "BOT_SCHEDULED");
    return session;
  }

  /**
   * Starts live recording session.
   */
  public startRecording(dedupHash: string): RecordingSession {
    let session = this.activeSessions.get(dedupHash);
    if (!session) {
      session = {
        meetingId: `meet-adhoc-${Date.now()}`,
        title: "Ad-hoc Meeting Session",
        meetingUrl: "https://meet.google.com/adhoc",
        dedupHash,
        userIds: new Set(["user-current"]),
        status: "recording",
        startedAt: Date.now(),
        durationSeconds: 0,
        isPaused: false,
        audioPowerLevel: 65,
      };
      this.activeSessions.set(dedupHash, session);
    } else {
      session.status = "recording";
      session.startedAt = Date.now();
      session.durationSeconds = 0;
      session.isPaused = false;
    }

    // Launch VAD & Duration Timer
    if (this.timerIntervals.has(dedupHash)) {
      clearInterval(this.timerIntervals.get(dedupHash)!);
    }

    const interval = setInterval(() => {
      if (session && session.status === "recording" && !session.isPaused) {
        session.durationSeconds += 1;
        session.audioPowerLevel = Math.floor(40 + Math.random() * 50);
        this.emit("vad_update", {
          meetingId: session.meetingId,
          durationSeconds: session.durationSeconds,
          audioPowerLevel: session.audioPowerLevel,
        });
      }
    }, 1000);

    this.timerIntervals.set(dedupHash, interval);
    this.emitEvent(session, "AUDIO_STREAM_STARTED");

    return session;
  }

  /**
   * Pauses or Resumes Recording Ingress.
   */
  public togglePause(dedupHash: string): RecordingSession | null {
    const session = this.activeSessions.get(dedupHash);
    if (!session) return null;

    session.isPaused = !session.isPaused;
    this.emitEvent(session, session.isPaused ? "RECORDING_PAUSED" : "RECORDING_RESUMED");
    return session;
  }

  /**
   * Stops recording, triggers transcription and AI summarization.
   */
  public async stopAndSynthesize(
    dedupHash: string
  ): Promise<{ session: RecordingSession; transcript: SanitizedTranscriptPayload; summary: AIAnalysisResult }> {
    const session = this.activeSessions.get(dedupHash);
    if (!session) {
      throw new Error("SESSION_NOT_FOUND");
    }

    if (this.timerIntervals.has(dedupHash)) {
      clearInterval(this.timerIntervals.get(dedupHash)!);
      this.timerIntervals.delete(dedupHash);
    }

    session.status = "transcribing";
    this.emitEvent(session, "TRANSCRIPTION_STARTED");

    // 1. Process STT
    const transcript = await sttService.processAudioStream({
      meetingId: session.meetingId,
      durationSeconds: session.durationSeconds,
    });

    // 2. Synthesize Grounded AI Summary
    const summary = summaryService.generateSummary(transcript, "standard");

    session.status = "completed";
    session.transcript = transcript;
    session.summary = summary;

    this.emitEvent(session, "SYNTHESIS_COMPLETED");

    return { session, transcript, summary };
  }

  /**
   * Retrieves active session by meetingId or dedupHash.
   */
  public getSession(idOrHash: string): RecordingSession | null {
    for (const session of this.activeSessions.values()) {
      if (session.meetingId === idOrHash || session.dedupHash === idOrHash) {
        return session;
      }
    }
    return null;
  }

  private emitEvent(session: RecordingSession, eventType: string): void {
    this.emit("ingress_event", {
      type: eventType,
      meetingId: session.meetingId,
      dedupHash: session.dedupHash,
      status: session.status,
      durationSeconds: session.durationSeconds,
      timestamp: new Date().toISOString(),
    });
  }
}

export const ingressOrchestrator = new IngressOrchestrator();

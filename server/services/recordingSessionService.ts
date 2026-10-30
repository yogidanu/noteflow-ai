import fs from "fs";
import path from "path";
import { EventEmitter } from "events";
import { computeMeetingHash } from "../security/crypto.js";
import { recordingLogger } from "../observability/recordingLogger.js";
import { debugLog } from "../security/debugLog.js";

export type RecordingLifecycleStatus =
  | "INITIALIZING"
  | "RECORDING"
  | "STOPPING"
  | "COMPLETED"
  | "FAILED";

export interface PersistentRecordingSession {
  recordingSessionId: string;
  meetingId: string;
  calendarEventId?: string;
  transcriptId?: string;
  summaryId?: string;
  userId: string;
  userIds: string[];
  meetingUrl?: string;
  title?: string;
  dedupHash: string;
  status: RecordingLifecycleStatus;
  startedAt?: number;
  stoppedAt?: number;
  durationSeconds: number;
  audioCaptureStartedAt?: number;
  audioCaptureStoppedAt?: number;
  audioChunkCount: number;
  audioBytes: number;
  audioArtifactId?: string;
  audioArtifactPath?: string;
  transcriptionStatus: "PENDING" | "IN_PROGRESS" | "COMPLETED" | "FAILED" | "SKIPPED";
  synchronizationStatus: "PENDING" | "SYNCHRONIZED" | "FAILED";
  errorCode?: string;
  errorMessage?: string;
  isPaused: boolean;
  audioPowerLevel: number;
  createdAt: number;
  updatedAt: number;
  transcript?: any;
  summary?: any;
}

class RecordingSessionService extends EventEmitter {
  private sessions = new Map<string, PersistentRecordingSession>();
  private persistenceFilePath: string | null = null;
  private artifactsDirectory: string | null = null;
  private durationTimers = new Map<string, NodeJS.Timeout>();

  constructor() {
    super();
    try {
      const dataDir = path.resolve(process.cwd(), ".data");
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }
      this.persistenceFilePath = path.join(dataDir, "recording_sessions.json");
      this.artifactsDirectory = path.join(dataDir, "audio_artifacts");
      if (!fs.existsSync(this.artifactsDirectory)) {
        fs.mkdirSync(this.artifactsDirectory, { recursive: true });
      }
      this.loadFromDisk();
    } catch {
      this.persistenceFilePath = null;
      this.artifactsDirectory = null;
    }
  }

  private loadFromDisk(): void {
    if (!this.persistenceFilePath || !fs.existsSync(this.persistenceFilePath)) return;
    try {
      const raw = fs.readFileSync(this.persistenceFilePath, "utf8");
      const records: PersistentRecordingSession[] = JSON.parse(raw);
      this.sessions.clear();
      records.forEach((s) => this.sessions.set(s.recordingSessionId, s));
    } catch (e) {
      console.warn("[RecordingSessionService] Could not load persisted recording sessions:", e);
    }
  }

  private persistToDisk(): void {
    if (!this.persistenceFilePath) return;
    try {
      const records = Array.from(this.sessions.values());
      fs.writeFileSync(this.persistenceFilePath, JSON.stringify(records, null, 2), "utf8");
    } catch (e) {
      console.warn("[RecordingSessionService] Could not persist sessions:", e);
    }
  }

  /**
   * Initializes a new recording session (INITIALIZING).
   */
  public createSession(params: {
    meetingId: string;
    userId: string;
    calendarEventId?: string;
    title?: string;
    meetingUrl?: string;
    dedupHash?: string;
  }): PersistentRecordingSession {
    const dedupHash = params.dedupHash || (params.meetingUrl ? computeMeetingHash(params.meetingUrl) : `hash_${Date.now()}`);

    // Check if an active session already exists for this dedupHash
    for (const existing of this.sessions.values()) {
      if (
        existing.dedupHash === dedupHash &&
        (existing.status === "INITIALIZING" || existing.status === "RECORDING")
      ) {
        if (!existing.userIds.includes(params.userId)) {
          existing.userIds.push(params.userId);
          existing.updatedAt = Date.now();
          this.persistToDisk();
        }
        return existing;
      }
    }

    const recordingSessionId = `rec_sess_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const audioArtifactId = `art_${recordingSessionId}`;
    const audioArtifactPath = this.artifactsDirectory
      ? path.join(this.artifactsDirectory, `${recordingSessionId}.webm`)
      : undefined;

    const calendarEventId = params.calendarEventId || (params.meetingId.startsWith("meet-event-") ? params.meetingId.replace("meet-event-", "") : params.meetingId);

    const now = Date.now();
    const session: PersistentRecordingSession = {
      recordingSessionId,
      meetingId: params.meetingId,
      calendarEventId,
      userId: params.userId,
      userIds: [params.userId],
      meetingUrl: params.meetingUrl,
      title: params.title || "Meeting Recording Session",
      dedupHash,
      status: "INITIALIZING",
      durationSeconds: 0,
      audioChunkCount: 0,
      audioBytes: 0,
      audioArtifactId,
      audioArtifactPath,
      transcriptionStatus: "PENDING",
      synchronizationStatus: "PENDING",
      isPaused: false,
      audioPowerLevel: 0,
      createdAt: now,
      updatedAt: now,
    };

    this.sessions.set(recordingSessionId, session);
    this.persistToDisk();

    debugLog("[RECORDING DEBUG] SESSION_CREATED", {
      recordingSessionId,
      meetingId: params.meetingId,
      status: "INITIALIZING",
      userId: params.userId,
      timestamp: new Date(now).toISOString(),
    });

    this.emitEvent(session, "SESSION_INITIALIZED");
    return session;
  }

  /**
   * Transitions session to RECORDING and begins live duration tracking.
   */
  public startRecording(sessionIdOrHash: string, userId?: string): PersistentRecordingSession {
    const session = this.resolveSession(sessionIdOrHash);
    if (!session) {
      throw new Error("RECORDING_SESSION_NOT_FOUND");
    }

    const now = Date.now();
    session.status = "RECORDING";
    session.startedAt = session.startedAt || now;
    session.audioCaptureStartedAt = session.audioCaptureStartedAt || now;
    session.isPaused = false;
    session.updatedAt = now;

    if (userId && !session.userIds.includes(userId)) {
      session.userIds.push(userId);
    }

    // Launch duration increment loop
    if (this.durationTimers.has(session.recordingSessionId)) {
      clearInterval(this.durationTimers.get(session.recordingSessionId)!);
    }

    const timer = setInterval(() => {
      if (session.status === "RECORDING" && !session.isPaused) {
        session.durationSeconds += 1;
        session.updatedAt = Date.now();
        this.emit("vad_update", {
          recordingSessionId: session.recordingSessionId,
          meetingId: session.meetingId,
          durationSeconds: session.durationSeconds,
          audioPowerLevel: session.audioPowerLevel,
          audioBytes: session.audioBytes,
          audioChunkCount: session.audioChunkCount,
        });
      }
    }, 1000);

    this.durationTimers.set(session.recordingSessionId, timer);
    this.persistToDisk();

    debugLog("[RECORDING DEBUG] RECORDING_STARTED", {
      recordingSessionId: session.recordingSessionId,
      status: "RECORDING",
      audioCaptureStartedAt: new Date(session.audioCaptureStartedAt).toISOString(),
      durationSeconds: session.durationSeconds,
    });

    recordingLogger.log({
      event: "RECORDING_STARTED",
      timestamp: new Date(now).toISOString(),
      userId: session.userId,
      meetingId: session.meetingId,
      recordingId: session.recordingSessionId,
      calendarEventId: session.calendarEventId,
      meetingUrl: session.meetingUrl,
    });

    this.emitEvent(session, "RECORDING_STARTED");
    return session;
  }

  /**
   * Appends an audio chunk payload to the persistent audio artifact and tracks telemetry.
   */
  public appendAudioChunk(
    sessionIdOrHash: string,
    chunkBuffer: Buffer,
    userId?: string
  ): { session: PersistentRecordingSession; chunkIndex: number; chunkBytes: number } {
    const session = this.resolveSession(sessionIdOrHash);
    if (!session) {
      throw new Error("RECORDING_SESSION_NOT_FOUND");
    }

    // Per-session byte ceiling: recordings are capped at 180 minutes
    // (config.recording.maxDurationMinutes); ~150 MB is generous headroom
    // for that at speech bitrates and stops unbounded disk growth from
    // chunk spam.
    const MAX_SESSION_AUDIO_BYTES = 150 * 1024 * 1024;
    if (session.audioBytes + chunkBuffer.length > MAX_SESSION_AUDIO_BYTES) {
      throw new Error("AUDIO_SESSION_LIMIT_EXCEEDED");
    }

    const chunkBytes = chunkBuffer.length;
    session.audioChunkCount += 1;
    session.audioBytes += chunkBytes;
    session.audioCaptureStoppedAt = Date.now();
    session.updatedAt = Date.now();

    // Persist audio binary chunk to disk
    if (session.audioArtifactPath) {
      try {
        fs.appendFileSync(session.audioArtifactPath, chunkBuffer);
      } catch (err) {
        console.warn("[RecordingSessionService] Could not append audio chunk to disk:", err);
      }
    }

    this.persistToDisk();

    debugLog("[RECORDING DEBUG] AUDIO_CHUNK_RECEIVED", {
      recordingSessionId: session.recordingSessionId,
      chunkIndex: session.audioChunkCount,
      chunkBytes,
      totalAudioBytes: session.audioBytes,
      durationSeconds: session.durationSeconds,
    });

    recordingLogger.log({
      event: "AUDIO_SAVED",
      timestamp: new Date().toISOString(),
      userId: session.userId,
      meetingId: session.meetingId,
      recordingId: session.recordingSessionId,
      calendarEventId: session.calendarEventId,
      audioArtifactId: session.audioArtifactId || `art_${session.recordingSessionId}`,
      audioArtifactPath: session.audioArtifactPath,
      audioBytes: session.audioBytes,
      audioFormat: "webm",
      durationSeconds: session.durationSeconds,
    });

    this.emit("audio_chunk", {
      recordingSessionId: session.recordingSessionId,
      meetingId: session.meetingId,
      chunkIndex: session.audioChunkCount,
      chunkBytes,
      totalBytes: session.audioBytes,
    });

    return { session, chunkIndex: session.audioChunkCount, chunkBytes };
  }

  /**
   * Pauses or resumes the live recording session.
   */
  public togglePause(sessionIdOrHash: string): PersistentRecordingSession {
    const session = this.resolveSession(sessionIdOrHash);
    if (!session) {
      throw new Error("RECORDING_SESSION_NOT_FOUND");
    }

    session.isPaused = !session.isPaused;
    session.updatedAt = Date.now();
    this.persistToDisk();

    debugLog("[RECORDING DEBUG] PAUSE_TOGGLED", {
      recordingSessionId: session.recordingSessionId,
      isPaused: session.isPaused,
    });

    this.emitEvent(session, session.isPaused ? "RECORDING_PAUSED" : "RECORDING_RESUMED");
    return session;
  }

  /**
   * Sets real-time audio power level (0 to 100).
   */
  public updateAudioPowerLevel(sessionIdOrHash: string, powerLevel: number): void {
    const session = this.resolveSession(sessionIdOrHash);
    if (!session) return;
    session.audioPowerLevel = Math.max(0, Math.min(100, Math.round(powerLevel)));
  }

  /**
   * Transitions session to STOPPING and clears duration timers.
   */
  public stopRecording(sessionIdOrHash: string, userId?: string): PersistentRecordingSession {
    const session = this.resolveSession(sessionIdOrHash);
    if (!session) {
      throw new Error("RECORDING_SESSION_NOT_FOUND");
    }

    if (this.durationTimers.has(session.recordingSessionId)) {
      clearInterval(this.durationTimers.get(session.recordingSessionId)!);
      this.durationTimers.delete(session.recordingSessionId);
    }

    const now = Date.now();
    session.status = "STOPPING";
    session.stoppedAt = now;
    session.audioCaptureStoppedAt = session.audioCaptureStoppedAt || now;
    session.transcriptionStatus = "IN_PROGRESS";
    session.updatedAt = now;
    this.persistToDisk();

    debugLog("[RECORDING DEBUG] RECORDING_STOPPED", {
      recordingSessionId: session.recordingSessionId,
      status: "STOPPING",
      durationSeconds: session.durationSeconds,
      totalAudioBytes: session.audioBytes,
      audioChunkCount: session.audioChunkCount,
    });

    recordingLogger.log({
      event: "RECORDING_STOPPED",
      timestamp: new Date(now).toISOString(),
      userId: session.userId,
      meetingId: session.meetingId,
      recordingId: session.recordingSessionId,
      calendarEventId: session.calendarEventId,
      durationSeconds: session.durationSeconds,
      audioChunkCount: session.audioChunkCount,
      totalAudioBytes: session.audioBytes,
    });

    this.emitEvent(session, "RECORDING_STOPPED");
    return session;
  }

  /**
   * Transitions session to COMPLETED after processing and synthesizes results.
   */
  public completeSession(
    sessionIdOrHash: string,
    payload?: { transcript?: any; summary?: any }
  ): PersistentRecordingSession {
    const session = this.resolveSession(sessionIdOrHash);
    if (!session) {
      throw new Error("RECORDING_SESSION_NOT_FOUND");
    }

    const transcriptId = `tr_${session.recordingSessionId}`;
    const summaryId = `sum_${session.recordingSessionId}`;
    session.transcriptId = transcriptId;
    session.summaryId = summaryId;

    recordingLogger.log({
      event: "SYNC_STARTED",
      timestamp: new Date().toISOString(),
      userId: session.userId,
      meetingId: session.meetingId,
      recordingId: session.recordingSessionId,
      calendarEventId: session.calendarEventId,
      transcriptId,
      summaryId,
      targetSystem: "database",
    });

    session.status = "COMPLETED";
    session.transcriptionStatus = "COMPLETED";
    session.synchronizationStatus = "SYNCHRONIZED";

    if (payload?.transcript) {
      session.transcript = {
        ...payload.transcript,
        transcriptId,
        recordingSessionId: session.recordingSessionId,
        meetingId: session.meetingId,
        calendarEventId: session.calendarEventId,
        userId: session.userId,
      };
    }
    if (payload?.summary) {
      session.summary = {
        ...payload.summary,
        summaryId,
        recordingSessionId: session.recordingSessionId,
        meetingId: session.meetingId,
        calendarEventId: session.calendarEventId,
        userId: session.userId,
      };
    }

    session.updatedAt = Date.now();
    this.persistToDisk();

    debugLog("[RECORDING DEBUG] SESSION_COMPLETED", {
      recordingSessionId: session.recordingSessionId,
      meetingId: session.meetingId,
      calendarEventId: session.calendarEventId,
      transcriptId,
      summaryId,
      userId: session.userId,
      status: "COMPLETED",
      transcriptionStatus: "COMPLETED",
      synchronizationStatus: "SYNCHRONIZED",
      audioArtifactId: session.audioArtifactId,
    });

    recordingLogger.log({
      event: "SYNC_COMPLETED",
      timestamp: new Date().toISOString(),
      userId: session.userId,
      meetingId: session.meetingId,
      recordingId: session.recordingSessionId,
      calendarEventId: session.calendarEventId,
      transcriptId,
      summaryId,
      durationMs: Date.now() - (session.stoppedAt || session.createdAt),
      syncedEntities: ["session", "transcript", "summary"],
    });

    this.emitEvent(session, "SESSION_COMPLETED");
    return session;
  }

  /**
   * Transitions session to FAILED with error telemetry.
   */
  public failSession(
    sessionIdOrHash: string,
    errorCode: string,
    errorMessage: string
  ): PersistentRecordingSession {
    const session = this.resolveSession(sessionIdOrHash);
    if (!session) {
      throw new Error("RECORDING_SESSION_NOT_FOUND");
    }

    if (this.durationTimers.has(session.recordingSessionId)) {
      clearInterval(this.durationTimers.get(session.recordingSessionId)!);
      this.durationTimers.delete(session.recordingSessionId);
    }

    session.status = "FAILED";
    session.errorCode = errorCode;
    session.errorMessage = errorMessage;
    session.transcriptionStatus = "FAILED";
    session.synchronizationStatus = "FAILED";
    session.updatedAt = Date.now();
    this.persistToDisk();

    debugLog("[RECORDING DEBUG] SESSION_FAILED", {
      recordingSessionId: session.recordingSessionId,
      status: "FAILED",
      errorCode,
      errorMessage,
    });

    recordingLogger.log({
      event: "SYNC_FAILED",
      timestamp: new Date().toISOString(),
      userId: session.userId,
      meetingId: session.meetingId,
      recordingId: session.recordingSessionId,
      calendarEventId: session.calendarEventId,
      durationMs: 0,
      errorCode,
      errorMessage,
    });

    this.emitEvent(session, "SESSION_FAILED");
    return session;
  }

  /**
   * Resolves a session by recordingSessionId, meetingId, or dedupHash.
   */
  public resolveSession(idOrHash: string): PersistentRecordingSession | null {
    if (this.sessions.has(idOrHash)) {
      return this.sessions.get(idOrHash)!;
    }

    for (const session of this.sessions.values()) {
      if (session.meetingId === idOrHash || session.dedupHash === idOrHash) {
        return session;
      }
    }
    return null;
  }

  /**
   * Lists all sessions filtered optionally by user ID.
   */
  public listSessions(userId?: string): PersistentRecordingSession[] {
    const all = Array.from(this.sessions.values());
    if (!userId) return all;
    return all.filter((s) => s.userIds.includes(userId));
  }

  private emitEvent(session: PersistentRecordingSession, eventType: string): void {
    this.emit("recording_lifecycle_event", {
      type: eventType,
      recordingSessionId: session.recordingSessionId,
      meetingId: session.meetingId,
      dedupHash: session.dedupHash,
      status: session.status,
      durationSeconds: session.durationSeconds,
      audioBytes: session.audioBytes,
      audioChunkCount: session.audioChunkCount,
      timestamp: new Date().toISOString(),
    });
  }
}

export const recordingSessionService = new RecordingSessionService();

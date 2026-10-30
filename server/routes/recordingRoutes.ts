import { Router, Request, Response } from "express";
import { ingressOrchestrator } from "../services/ingressOrchestrator.js";
import { recordingSessionService } from "../services/recordingSessionService.js";
import { sttService } from "../services/sttService.js";
import { computeMeetingHash } from "../security/crypto.js";
import { requireAuth } from "../middleware/authMiddleware.js";
import { recordingRateLimiter } from "../middleware/rateLimiter.js";
import fs from "fs";

export const recordingRouter = Router();

/**
 * POST /api/recording/session/init
 * Explicit lifecycle initiation (transitions to INITIALIZING).
 */
recordingRouter.post("/session/init", requireAuth, recordingRateLimiter, (req: Request, res: Response) => {
  const { meetingId, title, meetingUrl, dedupHash } = req.body;
  const userId = req.user?.userId || "user_default_workspace_id";

  if (!meetingId && !meetingUrl) {
    return res.status(400).json({ success: false, error: "MEETING_IDENTIFIER_REQUIRED" });
  }

  const session = recordingSessionService.createSession({
    meetingId: meetingId || `meet-${Date.now()}`,
    userId,
    title,
    meetingUrl,
    dedupHash,
  });

  res.json({
    success: true,
    message: "Recording session initialized",
    data: session,
  });
});

/**
 * POST /api/recording/schedule
 * Schedules assistant ingress for an upcoming meeting with user identity registration.
 */
recordingRouter.post("/schedule", requireAuth, recordingRateLimiter, (req: Request, res: Response) => {
  const { meetingId, title, meetingUrl } = req.body;
  const userId = req.user?.userId || "user_default_workspace_id";

  if (!meetingUrl) {
    return res.status(400).json({ success: false, error: "MEETING_URL_REQUIRED" });
  }

  const dedupHash = computeMeetingHash(meetingUrl);
  const session = recordingSessionService.createSession({
    meetingId: meetingId || `meet-${Date.now()}`,
    calendarEventId: (req.body?.calendarEventId as string) || (req.body?.id as string),
    title: title || "Scheduled Google Meet",
    meetingUrl,
    dedupHash,
    userId,
  });

  ingressOrchestrator.scheduleRecording({
    meetingId: session.meetingId,
    title: session.title || "Scheduled Google Meet",
    meetingUrl,
    dedupHash,
    userId,
  });

  res.json({
    success: true,
    message: "Assistant scheduled for recording",
    session: {
      recordingSessionId: session.recordingSessionId,
      meetingId: session.meetingId,
      calendarEventId: session.calendarEventId,
      status: session.status,
      dedupHash: session.dedupHash,
      title: session.title,
    },
  });
});

/**
 * POST /api/recording/start or POST /api/recording/session/:id/start
 * Transitions recording session to RECORDING.
 */
const handleStartRecording = (req: Request, res: Response) => {
  const targetId = req.params.id || req.body.recordingSessionId || req.body.dedupHash || (req.body.meetingUrl ? computeMeetingHash(req.body.meetingUrl) : undefined);
  const userId = req.user?.userId || "user_default_workspace_id";

  let session = targetId ? recordingSessionService.resolveSession(targetId) : null;
  if (!session) {
    session = recordingSessionService.createSession({
      meetingId: req.body.meetingId || `meet-${Date.now()}`,
      calendarEventId: req.body.calendarEventId,
      userId,
      title: req.body.title || "Live Meeting Session",
      meetingUrl: req.body.meetingUrl,
      dedupHash: targetId,
    });
  }

  const started = recordingSessionService.startRecording(session.recordingSessionId, userId);
  ingressOrchestrator.startRecording(started.dedupHash);

  res.json({
    success: true,
    message: "Live recording started",
    session: started,
    data: started,
  });
};

recordingRouter.post("/start", requireAuth, recordingRateLimiter, handleStartRecording);
recordingRouter.post("/session/:id/start", requireAuth, recordingRateLimiter, handleStartRecording);

/**
 * POST /api/recording/chunk or POST /api/recording/session/:id/chunk
 * Ingests live audio binary/base64 chunk and updates audio tracking telemetry.
 */
const handleAudioChunk = (req: Request, res: Response) => {
  const sessionId = req.params.id || req.body.recordingSessionId || req.body.dedupHash || req.query.sessionId as string;
  const userId = req.user?.userId || "user_default_workspace_id";

  if (!sessionId) {
    return res.status(400).json({ success: false, error: "SESSION_ID_REQUIRED" });
  }

  let chunkBuffer: Buffer | undefined;

  if (Buffer.isBuffer(req.body) && req.body.length > 0) {
    chunkBuffer = req.body;
  } else if (req.body?.audioBase64) {
    chunkBuffer = Buffer.from(req.body.audioBase64, "base64");
  }

  if (!chunkBuffer || chunkBuffer.length === 0) {
    return res.status(400).json({ success: false, error: "AUDIO_CHUNK_EMPTY" });
  }

  try {
    const result = recordingSessionService.appendAudioChunk(sessionId, chunkBuffer, userId);
    res.json({
      success: true,
      message: "Audio chunk ingested",
      data: {
        recordingSessionId: result.session.recordingSessionId,
        chunkIndex: result.chunkIndex,
        chunkBytes: result.chunkBytes,
        totalBytes: result.session.audioBytes,
        audioChunkCount: result.session.audioChunkCount,
        durationSeconds: result.session.durationSeconds,
      },
    });
  } catch (err: any) {
    res.status(404).json({ success: false, error: err.message || "SESSION_NOT_FOUND" });
  }
};

recordingRouter.post("/chunk", requireAuth, handleAudioChunk);
recordingRouter.post("/session/:id/chunk", requireAuth, handleAudioChunk);

/**
 * POST /api/recording/pause or POST /api/recording/session/:id/pause
 * Toggles pause/resume with IDOR tenant authorization verification.
 */
const handlePauseRecording = (req: Request, res: Response) => {
  const targetId = req.params.id || req.body.recordingSessionId || req.body.dedupHash;
  const userId = req.user?.userId || "user_default_workspace_id";

  if (!targetId) {
    return res.status(400).json({ success: false, error: "TARGET_ID_REQUIRED" });
  }

  const existingSession = recordingSessionService.resolveSession(targetId);
  if (!existingSession) {
    return res.status(404).json({ success: false, error: "SESSION_NOT_FOUND" });
  }

  // IDOR Guard: Verify calling user has access to this session
  if (!existingSession.userIds.includes(userId) && req.user?.role !== "admin") {
    return res.status(403).json({
      success: false,
      error: "FORBIDDEN_NOT_SESSION_PARTICIPANT",
      message: "You are not authorized to pause this recording session.",
    });
  }

  const session = recordingSessionService.togglePause(existingSession.recordingSessionId);
  ingressOrchestrator.togglePause(session.dedupHash);

  res.json({
    success: true,
    isPaused: session.isPaused,
    status: session.status,
    session,
  });
};

recordingRouter.post("/pause", requireAuth, handlePauseRecording);
recordingRouter.post("/session/:id/pause", requireAuth, handlePauseRecording);

/**
 * POST /api/recording/stop or POST /api/recording/session/:id/stop
 * Transitions session to STOPPING and triggers finalization and synthesis (COMPLETED).
 */
const handleStopRecording = async (req: Request, res: Response) => {
  const targetId = req.params.id || req.body.recordingSessionId || req.body.dedupHash;
  const userId = req.user?.userId || "user_default_workspace_id";

  if (!targetId) {
    return res.status(400).json({ success: false, error: "TARGET_ID_REQUIRED" });
  }

  const existingSession = recordingSessionService.resolveSession(targetId);
  if (!existingSession) {
    return res.status(404).json({ success: false, error: "SESSION_NOT_FOUND" });
  }

  // IDOR Guard: Verify calling user has access to this session
  if (!existingSession.userIds.includes(userId) && req.user?.role !== "admin") {
    return res.status(403).json({
      success: false,
      error: "FORBIDDEN_NOT_SESSION_PARTICIPANT",
      message: "You are not authorized to stop this recording session.",
    });
  }

  try {
    // 1. Mark STOPPING
    recordingSessionService.stopRecording(existingSession.recordingSessionId, userId);

    // 2. Synthesize transcript and summary
    const ingressResult = await ingressOrchestrator.stopAndSynthesize(existingSession.dedupHash);

    // 3. Mark COMPLETED
    const completedSession = recordingSessionService.completeSession(existingSession.recordingSessionId, {
      transcript: ingressResult.transcript,
      summary: ingressResult.summary,
    });

    res.json({
      success: true,
      message: "Recording completed and synthesized",
      data: {
        recordingSessionId: completedSession.recordingSessionId,
        meetingId: completedSession.meetingId,
        calendarEventId: completedSession.calendarEventId,
        transcriptId: completedSession.transcriptId,
        summaryId: completedSession.summaryId,
        userId: completedSession.userId,
        title: completedSession.title,
        status: completedSession.status,
        durationSeconds: completedSession.durationSeconds,
        audioBytes: completedSession.audioBytes,
        audioChunkCount: completedSession.audioChunkCount,
        audioArtifactId: completedSession.audioArtifactId,
        transcriptionStatus: completedSession.transcriptionStatus,
        synchronizationStatus: completedSession.synchronizationStatus,
        transcript: ingressResult.transcript,
        summary: ingressResult.summary,
      },
      session: completedSession,
    });
  } catch (error: any) {
    recordingSessionService.failSession(existingSession.recordingSessionId, "SYNTHESIS_FAILED", error.message);
    res.status(500).json({
      success: false,
      error: error.message || "STOP_RECORDING_FAILED",
    });
  }
};

recordingRouter.post("/stop", requireAuth, handleStopRecording);
recordingRouter.post("/session/:id/stop", requireAuth, handleStopRecording);

/**
 * POST /api/recording/transcribe
 * Accepts recorded audio buffer or base64 stream and returns diarized transcript payload.
 */
recordingRouter.post("/transcribe", requireAuth, async (req: Request, res: Response) => {
  try {
    const meetingId = (req.body?.meetingId as string) || (req.query?.meetingId as string) || `meet-${Date.now()}`;
    const durationSeconds = Number(req.body?.durationSeconds) || 60;
    let audioBuffer: Buffer | undefined;

    if (Buffer.isBuffer(req.body)) {
      audioBuffer = req.body;
    } else if (req.body?.audioBase64) {
      audioBuffer = Buffer.from(req.body.audioBase64, "base64");
    }

    let knownAttendees: Array<{ name: string; email: string }> | undefined;
    if (req.body?.knownAttendees) {
      try {
        knownAttendees = typeof req.body.knownAttendees === "string" ? JSON.parse(req.body.knownAttendees) : req.body.knownAttendees;
      } catch {
        // ignore parse error
      }
    }

    if (!audioBuffer || audioBuffer.length === 0) {
      return res.status(400).json({ success: false, error: "No audio was received by the server." });
    }

    const transcript = await sttService.processAudioStream({
      meetingId,
      durationSeconds,
      audioBuffer,
      mimeType: (req.body?.mimeType as string) || "audio/webm",
      knownAttendees,
      sampleTranscriptPreset: req.body?.sampleTranscriptPreset,
    });

    // A silent empty transcript used to masquerade as success and the
    // client quietly fell back to browser captions. Surface the reason.
    if (transcript.sttError) {
      return res.status(502).json({ success: false, error: transcript.sttError });
    }

    res.json({
      success: true,
      data: transcript,
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: err.message || "TRANSCRIPTION_FAILED",
    });
  }
});

/**
 * GET /api/recording/status/:id or GET /api/recording/session/:id
 * Retrieves full recording session metadata with tenant authorization validation.
 */
const handleGetSessionStatus = (req: Request, res: Response) => {
  const session = recordingSessionService.resolveSession(req.params.id) || ingressOrchestrator.getSession(req.params.id);
  const userId = req.user?.userId || "user_default_workspace_id";

  if (!session) {
    return res.status(404).json({ success: false, error: "SESSION_NOT_FOUND" });
  }

  const isUserAllowed =
    (Array.isArray((session as any).userIds) && (session as any).userIds.includes(userId)) ||
    ((session as any).userIds instanceof Set && (session as any).userIds.has(userId)) ||
    req.user?.role === "admin";

  if (!isUserAllowed) {
    return res.status(403).json({
      success: false,
      error: "FORBIDDEN_NOT_SESSION_PARTICIPANT",
    });
  }

  res.json({
    success: true,
    session,
    data: session,
  });
};

recordingRouter.get("/status/:id", requireAuth, handleGetSessionStatus);
recordingRouter.get("/session/:id", requireAuth, handleGetSessionStatus);

/**
 * GET /api/recording/session/:id/artifact
 * Returns audio artifact metadata for verifiable proof of recording.
 */
recordingRouter.get("/session/:id/artifact", requireAuth, (req: Request, res: Response) => {
  const session = recordingSessionService.resolveSession(req.params.id);
  if (!session || !session.audioArtifactPath) {
    return res.status(404).json({ success: false, error: "ARTIFACT_NOT_FOUND" });
  }

  const exists = fs.existsSync(session.audioArtifactPath);
  const sizeBytes = exists ? fs.statSync(session.audioArtifactPath).size : 0;

  res.json({
    success: true,
    data: {
      recordingSessionId: session.recordingSessionId,
      audioArtifactId: session.audioArtifactId,
      audioBytes: session.audioBytes,
      audioChunkCount: session.audioChunkCount,
      diskSizeBytes: sizeBytes,
      durationSeconds: session.durationSeconds,
      status: session.status,
    },
  });
});

/**
 * GET /api/recording/events
 * Server-Sent Events (SSE) stream partitioned by user subscription.
 */
recordingRouter.get("/events", requireAuth, (req: Request, res: Response) => {
  const currentUserId = req.user?.userId || "user_default_workspace_id";

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  // Send initial handshake
  res.write(`data: ${JSON.stringify({ type: "CONNECTED", userId: currentUserId, timestamp: new Date().toISOString() })}\n\n`);

  // Stream lifecycle events from recordingSessionService
  const onLifecycleEvent = (data: any) => {
    const session = recordingSessionService.resolveSession(data.recordingSessionId || data.dedupHash);
    if (!session || session.userIds.includes(currentUserId) || req.user?.role === "admin") {
      res.write(`data: ${JSON.stringify({ type: "LIFECYCLE_EVENT", ...data })}\n\n`);
    }
  };

  const onAudioChunk = (data: any) => {
    const session = recordingSessionService.resolveSession(data.recordingSessionId);
    if (!session || session.userIds.includes(currentUserId) || req.user?.role === "admin") {
      res.write(`data: ${JSON.stringify({ type: "AUDIO_CHUNK", ...data })}\n\n`);
    }
  };

  const onVadUpdate = (data: any) => {
    const session = recordingSessionService.resolveSession(data.recordingSessionId || data.meetingId);
    if (!session || (session && session.userIds.includes(currentUserId)) || req.user?.role === "admin") {
      res.write(`data: ${JSON.stringify({ type: "VAD_LEVEL", ...data })}\n\n`);
    }
  };

  recordingSessionService.on("recording_lifecycle_event", onLifecycleEvent);
  recordingSessionService.on("audio_chunk", onAudioChunk);
  recordingSessionService.on("vad_update", onVadUpdate);

  req.on("close", () => {
    recordingSessionService.off("recording_lifecycle_event", onLifecycleEvent);
    recordingSessionService.off("audio_chunk", onAudioChunk);
    recordingSessionService.off("vad_update", onVadUpdate);
  });
});

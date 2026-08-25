import { Router, Request, Response } from "express";
import { ingressOrchestrator } from "../services/ingressOrchestrator.js";
import { sttService } from "../services/sttService.js";
import { computeMeetingHash } from "../security/crypto.js";
import { requireAuth } from "../middleware/authMiddleware.js";
import { recordingRateLimiter } from "../middleware/rateLimiter.js";

export const recordingRouter = Router();

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
  const session = ingressOrchestrator.scheduleRecording({
    meetingId: meetingId || `meet-${Date.now()}`,
    title: title || "Scheduled Google Meet",
    meetingUrl,
    dedupHash,
    userId,
  });

  res.json({
    success: true,
    message: "Assistant scheduled for recording",
    session: {
      meetingId: session.meetingId,
      status: session.status,
      dedupHash: session.dedupHash,
      title: session.title,
    },
  });
});

/**
 * POST /api/recording/start
 * Starts live recording session immediately for the authenticated user.
 */
recordingRouter.post("/start", requireAuth, recordingRateLimiter, (req: Request, res: Response) => {
  const { meetingUrl, dedupHash } = req.body;
  const userId = req.user?.userId || "user_default_workspace_id";
  const hash = dedupHash || (meetingUrl ? computeMeetingHash(meetingUrl) : `hash_${Date.now()}`);

  const session = ingressOrchestrator.startRecording(hash);
  session.userIds.add(userId);

  res.json({
    success: true,
    message: "Live recording started",
    session: {
      meetingId: session.meetingId,
      status: session.status,
      dedupHash: session.dedupHash,
      durationSeconds: session.durationSeconds,
      audioPowerLevel: session.audioPowerLevel,
    },
  });
});

/**
 * POST /api/recording/pause
 * Toggles pause/resume with IDOR tenant authorization verification.
 */
recordingRouter.post("/pause", requireAuth, (req: Request, res: Response) => {
  const { dedupHash } = req.body;
  const userId = req.user?.userId || "user_default_workspace_id";

  if (!dedupHash) {
    return res.status(400).json({ success: false, error: "DEDUP_HASH_REQUIRED" });
  }

  const existingSession = ingressOrchestrator.getSession(dedupHash);
  if (!existingSession) {
    return res.status(404).json({ success: false, error: "SESSION_NOT_FOUND" });
  }

  // IDOR Guard: Verify calling user has access to this session
  if (!existingSession.userIds.has(userId) && req.user?.role !== "admin") {
    return res.status(403).json({
      success: false,
      error: "FORBIDDEN_NOT_SESSION_PARTICIPANT",
      message: "You are not authorized to pause this recording session.",
    });
  }

  const session = ingressOrchestrator.togglePause(dedupHash);

  res.json({
    success: true,
    isPaused: session!.isPaused,
    status: session!.status,
  });
});

/**
 * POST /api/recording/stop
 * Terminates recording with IDOR tenant authorization verification.
 */
recordingRouter.post("/stop", requireAuth, async (req: Request, res: Response) => {
  const { dedupHash } = req.body;
  const userId = req.user?.userId || "user_default_workspace_id";

  if (!dedupHash) {
    return res.status(400).json({ success: false, error: "DEDUP_HASH_REQUIRED" });
  }

  const existingSession = ingressOrchestrator.getSession(dedupHash);
  if (!existingSession) {
    return res.status(404).json({ success: false, error: "SESSION_NOT_FOUND" });
  }

  // IDOR Guard: Verify calling user has access to this session
  if (!existingSession.userIds.has(userId) && req.user?.role !== "admin") {
    return res.status(403).json({
      success: false,
      error: "FORBIDDEN_NOT_SESSION_PARTICIPANT",
      message: "You are not authorized to stop this recording session.",
    });
  }

  try {
    const result = await ingressOrchestrator.stopAndSynthesize(dedupHash);

    res.json({
      success: true,
      message: "Recording completed and synthesized",
      data: {
        meetingId: result.session.meetingId,
        title: result.session.title,
        status: result.session.status,
        transcript: result.transcript,
        summary: result.summary,
      },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || "STOP_RECORDING_FAILED",
    });
  }
});

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

    const transcript = await sttService.processAudioStream({
      meetingId,
      durationSeconds,
      audioBuffer,
      knownAttendees,
      sampleTranscriptPreset: req.body?.sampleTranscriptPreset,
    });

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
 * GET /api/recording/status/:id
 * Retrieves current status with tenant authorization validation.
 */
recordingRouter.get("/status/:id", requireAuth, (req: Request, res: Response) => {
  const session = ingressOrchestrator.getSession(req.params.id);
  const userId = req.user?.userId || "user_default_workspace_id";

  if (!session) {
    return res.status(404).json({ success: false, error: "SESSION_NOT_FOUND" });
  }

  // IDOR Guard: Check participant access
  if (!session.userIds.has(userId) && req.user?.role !== "admin") {
    return res.status(403).json({
      success: false,
      error: "FORBIDDEN_NOT_SESSION_PARTICIPANT",
    });
  }

  res.json({
    success: true,
    session: {
      meetingId: session.meetingId,
      status: session.status,
      durationSeconds: session.durationSeconds,
      isPaused: session.isPaused,
      audioPowerLevel: session.audioPowerLevel,
      dedupHash: session.dedupHash,
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

  // User-partitioned event filter: only push events for sessions this user participates in
  const onIngressEvent = (data: any) => {
    const session = ingressOrchestrator.getSession(data.dedupHash || data.meetingId);
    if (!session || session.userIds.has(currentUserId) || req.user?.role === "admin") {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    }
  };

  const onVadUpdate = (data: any) => {
    const session = ingressOrchestrator.getSession(data.meetingId);
    if (!session || session.userIds.has(currentUserId) || req.user?.role === "admin") {
      res.write(`data: ${JSON.stringify({ type: "VAD_LEVEL", ...data })}\n\n`);
    }
  };

  ingressOrchestrator.on("ingress_event", onIngressEvent);
  ingressOrchestrator.on("vad_update", onVadUpdate);

  req.on("close", () => {
    ingressOrchestrator.off("ingress_event", onIngressEvent);
    ingressOrchestrator.off("vad_update", onVadUpdate);
  });
});

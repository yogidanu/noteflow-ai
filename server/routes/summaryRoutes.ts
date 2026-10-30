import { Router, Request, Response } from "express";
import { summaryService } from "../services/summaryService.js";
import { sttService } from "../services/sttService.js";
import { requireAuth } from "../middleware/authMiddleware.js";
import { summaryRateLimiter } from "../middleware/rateLimiter.js";

export const summaryRouter = Router();

/**
 * POST /api/summary/generate
 * Synthesizes grounded AI summary with rate limiting and user session tracking.
 */
summaryRouter.post("/generate", requireAuth, summaryRateLimiter, async (req: Request, res: Response) => {
  try {
    const { transcript, rawInput, refinement = "standard" } = req.body;

    // Shape/size validation (previously any object was passed straight
    // into synthesis): strings are capped, objects must look like a
    // transcript payload, rawInput must be a string.
    const MAX_TRANSCRIPT_CHARS = 200_000;
    if (typeof transcript === "string" && transcript.length > MAX_TRANSCRIPT_CHARS) {
      return res.status(413).json({ success: false, error: "TRANSCRIPT_TOO_LARGE" });
    }
    if (rawInput !== undefined && typeof rawInput !== "string") {
      return res.status(400).json({ success: false, error: "RAW_INPUT_MUST_BE_STRING" });
    }
    if (typeof rawInput === "string" && rawInput.length > MAX_TRANSCRIPT_CHARS) {
      return res.status(413).json({ success: false, error: "TRANSCRIPT_TOO_LARGE" });
    }
    if (
      transcript !== undefined &&
      typeof transcript !== "string" &&
      (typeof transcript !== "object" ||
        transcript === null ||
        (typeof (transcript as any).sanitizedText !== "string" && !Array.isArray((transcript as any).segments)))
    ) {
      return res.status(400).json({ success: false, error: "TRANSCRIPT_PAYLOAD_INVALID" });
    }

    let transcriptPayload = transcript;
    if (typeof transcript === "string") {
      transcriptPayload = await sttService.processAudioStream({
        meetingId: `manual-${Date.now()}`,
        durationSeconds: 1800,
        sampleTranscriptPreset: transcript,
      });
    } else if (!transcriptPayload && rawInput) {
      transcriptPayload = await sttService.processAudioStream({
        meetingId: `manual-${Date.now()}`,
        durationSeconds: 1800,
        sampleTranscriptPreset: rawInput,
      });
    }

    if (!transcriptPayload) {
      return res.status(400).json({ success: false, error: "TRANSCRIPT_PAYLOAD_REQUIRED" });
    }

    const summary = summaryService.generateSummary(transcriptPayload, refinement);

    res.json({
      success: true,
      data: summary,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || "SUMMARY_GENERATION_FAILED",
    });
  }
});

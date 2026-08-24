import { AIAnalysisResult, RefinementPromptType } from "../types/meeting";
import { processMeetingWithAI } from "./aiEngine";
import confetti from "canvas-confetti";

export type BridgeProcessingStatus =
  | "idle"
  | "validating"
  | "sanitizing"
  | "summarizing"
  | "decisions"
  | "actions"
  | "questions"
  | "completed"
  | "error";

export type BridgeErrorCode =
  | "TRANSCRIPT_UNAVAILABLE"
  | "INCOMPLETE_TRANSCRIPT"
  | "AI_FAILURE"
  | "DUPLICATE_PROCESSING"
  | "PROCESSING_TIMEOUT";

export interface BridgeError {
  code: BridgeErrorCode;
  message: string;
  isRetryable: boolean;
  partialSanitizedText?: string;
}

export interface BridgeProcessingResult {
  title: string;
  sanitizedInput: string;
  analysis: AIAnalysisResult;
  isPartialCapture: boolean;
}

export interface BridgeProgressCallback {
  (status: BridgeProcessingStatus, progress: number, partialResult?: Partial<AIAnalysisResult>): void;
}

export interface ToastNotificationPayload {
  id: string;
  type: "success" | "error" | "warning";
  title: string;
  message: string;
  meetingId?: string;
  decisionCount?: number;
  actionCount?: number;
  timestamp: number;
}

class MeetSummaryBridge {
  // In-flight mutex lock to prevent duplicate processing for the same meetingId
  private inFlightLocks = new Set<string>();

  // Processing timeout threshold (30 seconds)
  private readonly TIMEOUT_MS = 30000;

  /**
   * 1. Validates the raw transcript structure and checks for minimal content.
   */
  public validateTranscript(rawTranscript: string): {
    isValid: boolean;
    wordCount: number;
    isPartialCapture: boolean;
    error?: BridgeError;
  } {
    if (!rawTranscript || typeof rawTranscript !== "string" || rawTranscript.trim().length === 0) {
      return {
        isValid: false,
        wordCount: 0,
        isPartialCapture: false,
        error: {
          code: "TRANSCRIPT_UNAVAILABLE",
          message: "No transcript audio stream was captured or audio buffer was empty.",
          isRetryable: true,
        },
      };
    }

    const words = rawTranscript.trim().split(/\s+/);
    const wordCount = words.length;

    // Minimum 8 words required for context extraction
    if (wordCount < 8) {
      return {
        isValid: false,
        wordCount,
        isPartialCapture: true,
        error: {
          code: "INCOMPLETE_TRANSCRIPT",
          message: `Transcript is too brief (${wordCount} words). A minimum of 8 words is required to analyze decisions and action items.`,
          isRetryable: true,
        },
      };
    }

    // Flag partial captures if less than 30 words but valid
    const isPartialCapture = wordCount < 30;

    return {
      isValid: true,
      wordCount,
      isPartialCapture,
    };
  }

  /**
   * 2. Orchestrates end-to-end transcript handoff to existing NoteFlow AI summary engine.
   */
  public async processTranscriptToSummary(params: {
    meetingId: string;
    meetingTitle: string;
    rawTranscript: string;
    refinement?: RefinementPromptType;
    onProgress?: BridgeProgressCallback;
  }): Promise<BridgeProcessingResult> {
    const { meetingId, meetingTitle, rawTranscript, refinement = "standard", onProgress } = params;

    // A. Check for Duplicate Processing Lock
    if (this.inFlightLocks.has(meetingId)) {
      throw {
        code: "DUPLICATE_PROCESSING",
        message: `Meeting ${meetingId} is already currently being synthesized.`,
        isRetryable: false,
      } as BridgeError;
    }

    // B. Validate Transcript
    onProgress?.("validating", 5);
    const validation = this.validateTranscript(rawTranscript);
    if (!validation.isValid && validation.error) {
      throw validation.error;
    }

    // Acquire lock
    this.inFlightLocks.add(meetingId);

    try {
      // C. Race against 30-Second Timeout
      const summaryPromise = processMeetingWithAI(
        rawTranscript,
        refinement,
        (stage, progress, partial) => {
          onProgress?.(stage as BridgeProcessingStatus, progress, partial);
        }
      );

      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject({
            code: "PROCESSING_TIMEOUT",
            message: "AI summary generation timed out after 30 seconds. Please retry.",
            isRetryable: true,
          } as BridgeError);
        }, this.TIMEOUT_MS);
      });

      const result = await Promise.race([summaryPromise, timeoutPromise]);

      onProgress?.("completed", 100);

      // Trigger Confetti Celebration
      try {
        confetti({
          particleCount: 40,
          spread: 70,
          origin: { y: 0.8 },
          colors: ["#6366f1", "#10b981", "#3b82f6", "#14b8a6"],
        });
      } catch {
        // test environment safe
      }

      // Trigger Browser Web Notification if permitted
      this.sendDesktopNotification(meetingTitle, result.analysis);

      return {
        title: meetingTitle.startsWith("Untitled Meeting") || meetingTitle.startsWith("Ad-hoc") ? result.title : meetingTitle,
        sanitizedInput: result.sanitizedInput,
        analysis: {
          ...result.analysis,
          isPartialCapture: validation.isPartialCapture,
        },
        isPartialCapture: validation.isPartialCapture,
      };
    } catch (err: any) {
      console.error("[MeetSummaryBridge Error]", err);
      if (err.code) {
        throw err as BridgeError;
      }
      throw {
        code: "AI_FAILURE",
        message: err?.message || "An unexpected error occurred during AI synthesis.",
        isRetryable: true,
      } as BridgeError;
    } finally {
      // Release lock
      this.inFlightLocks.delete(meetingId);
    }
  }

  /**
   * 3. Dispatches Web Notification API alert if enabled by user.
   */
  private sendDesktopNotification(title: string, analysis: AIAnalysisResult): void {
    if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
      try {
        new Notification("NoteFlow AI • Meeting Summary Ready", {
          body: `✨ ${title}: ${analysis.decisions.length} decisions & ${analysis.actionItems.length} action items synthesized.`,
          icon: "/favicon.ico",
        });
      } catch {
        // ignore in headless test
      }
    }
  }
}

export const meetSummaryBridge = new MeetSummaryBridge();

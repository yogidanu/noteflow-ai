import { AIAnalysisResult, RefinementPromptType } from "../types/meeting";
import { sanitizeTranscript, SanitizedResult } from "./transcriptSanitizer";
import { GenerativeSummarizer } from "./llmSummarizer";

export interface StreamProgressCallback {
  (stage: "sanitizing" | "summarizing" | "decisions" | "actions" | "questions" | "done", progress: number, partialResult?: Partial<AIAnalysisResult>): void;
}

export async function processMeetingWithAI(
  rawInput: string,
  refinement: RefinementPromptType = "standard",
  onProgress?: StreamProgressCallback
): Promise<{ title: string; analysis: AIAnalysisResult; sanitizedInput: string }> {
  // Pre-flight check
  if (!rawInput || rawInput.trim().split(/\s+/).length < 2) {
    throw new Error("Notes are too brief. Please provide audio or dialogue for NoteFlow AI to analyze.");
  }

  // Stage 1: Sanitize
  onProgress?.("sanitizing", 15);
  await delay(180);

  const sanitized = sanitizeTranscript(rawInput);
  const words = sanitized.cleanText.trim().split(/\s+/).filter(Boolean);
  const wordCount = words.length;

  // Extract smart meeting title
  const suggestedTitle = generateSmartTitle(sanitized.cleanText, sanitized);

  // Stage 2: Generative Intelligence Synthesis (Executive Summary)
  onProgress?.("summarizing", 45);
  await delay(220);

  // Full Generative Synthesis
  const generativeResult = GenerativeSummarizer.synthesize(sanitized, refinement);

  // Stage 3: Decisions & Citations
  onProgress?.("decisions", 70, { executiveSummary: generativeResult.executiveSummary });
  await delay(180);

  // Stage 4: Action Items & Deliverables
  onProgress?.("actions", 85, {
    executiveSummary: generativeResult.executiveSummary,
    decisions: generativeResult.decisions,
  });
  await delay(180);

  // Stage 5: Questions & Wrap up
  onProgress?.("questions", 95, {
    executiveSummary: generativeResult.executiveSummary,
    decisions: generativeResult.decisions,
    actionItems: generativeResult.actionItems,
  });
  await delay(150);

  onProgress?.("done", 100, generativeResult);

  return {
    title: suggestedTitle,
    analysis: generativeResult,
    sanitizedInput: sanitized.cleanText,
  };
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function generateSmartTitle(text: string, sanitized: SanitizedResult): string {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);

  // Check for explicit headers like "# Title" or "Meeting: Title"
  for (const line of lines.slice(0, 4)) {
    if (line.startsWith("#") || line.toLowerCase().startsWith("meeting:") || line.toLowerCase().startsWith("topic:")) {
      const cleanHeader = line.replace(/^[#:\s]+/, "").replace(/^(meeting|topic):\s*/i, "").trim();
      if (cleanHeader.length > 5 && cleanHeader.length < 80) {
        return cleanHeader;
      }
    }
  }

  // Theme-derived title: reuse the summarizer's line classification and
  // discussion-topic machinery. Context themes outrank decision themes;
  // otherwise the first thematic topic is used. This replaces a scan that
  // returned the first 16–59 character line, which promoted arbitrary
  // sentence fragments (e.g. "Before we build teamworkspace") to titles.
  const themeTitle = GenerativeSummarizer.deriveMeetingThemeTitle(sanitized);
  if (themeTitle) {
    return themeTitle;
  }

  // Speaker based title
  if (sanitized.speakers.length === 2) {
    return `1-on-1 Sync (${sanitized.speakers[0]} & ${sanitized.speakers[1]})`;
  }
  if (sanitized.speakers.length > 2) {
    return `Team Sync (${sanitized.speakers.slice(0, 2).join(", ")} +${sanitized.speakers.length - 2})`;
  }
  if (sanitized.speakers.length === 1 && sanitized.speakers[0] !== "You") {
    return `Meeting Note • ${sanitized.speakers[0]}`;
  }

  return `Meeting Session (${new Date().toLocaleDateString([], { month: "short", day: "numeric" })})`;
}

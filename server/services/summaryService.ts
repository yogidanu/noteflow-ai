import { SanitizedTranscriptPayload, DiarizedSegment } from "./sttService.js";
import { recordingLogger } from "../observability/recordingLogger.js";

export interface SourceCitation {
  id: string;
  speaker?: string;
  timestamp?: string;
  /**
   * Grounding anchor kind (mirrors src/types/meeting.ts). Every citation
   * produced here is "time": server summaries are built from STT segments,
   * an audio domain where a "00:00" segment timestamp is an STT fallback
   * placeholder — a FAILED time anchor that must stay ungrounded. It is
   * deliberately NOT reclassified as a line anchor: line anchoring is
   * reserved for authored text (client-side manual notes), whose source
   * format carries no time syntax at all.
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

export interface AIAnalysisResult {
  executiveSummary: string;
  decisions: DecisionItem[];
  actionItems: ActionItem[];
  unresolvedQuestions: UnresolvedQuestion[];
  detectedSpeakers: string[];
  wordCount: number;
  estimatedMeetingDurationMinutes: number;
  modelConfidence: "high" | "moderate" | "low";
  appliedRefinement?: string;
  isPartialCapture?: boolean;
}

/**
 * Commitment-based action detection (mirrors the client summarizer in
 * src/lib/llmSummarizer.ts): an action item requires a will/imperative
 * commitment, never a keyword substring — "check" inside "check-in" and
 * "share" inside "shared workspace" created phantom tasks with invented
 * due dates in the 2026-10-23 live run.
 */
function hasActionCommitment(text: string): boolean {
  const t = text.trim();
  if (/\b(i|we|you|he|she|they)\s+will\b/i.test(t)) return true;
  if (/\b(i'll|we'll|you'll|i\s+shall)\b/i.test(t)) return true;
  if (/^[A-Z][a-z]+(?:\s[A-Z][a-z]+)?\s+will\b/.test(t)) return true;
  if (/^(?:[A-Z][A-Za-z\s]{0,30},\s*)?(can you|could you|will you|please)\b/i.test(t)) return true;
  if (
    /^(please\s+)?(send|share|prepare|create|update|review|schedule|assign|fix|test|draft|write|set up|follow up|check)\b/i.test(t) &&
    !t.includes("?")
  ) {
    return true;
  }
  return false;
}

function classifySegment(text: string): "decision" | "question" | "rationale" | "context" | "other" {
  const lower = text.toLowerCase().trim();
  if (
    text.includes("?") ||
    /\b(open question|question we|leaving open|left open|parking lot)\b/.test(lower) ||
    /^(how|what|why|when|where|who|should|can we|could we)\b/.test(lower) ||
    /\bwhether\b/.test(lower)
  ) {
    return "question";
  }
  if (/^(the reason|reason:|because|since)\b/.test(lower) || /\breason is\b/.test(lower)) {
    return "rationale";
  }
  if (/^(this is a|this is the|welcome|today we|in this meeting|planning check[-\s]?in)\b/.test(lower)) {
    return "context";
  }
  return "other";
}

/** Grounding measured from citations, never asserted (mirrors client). */
function computeGroundingConfidence(
  cited: Array<{
    citation?: {
      timestamp?: string;
      anchorKind?: "time" | "line";
      lineIndex?: number;
      rawText?: string;
    };
  }>
): "high" | "moderate" | "low" {
  if (cited.length === 0) return "low";
  const grounded = cited.filter((c) => {
    const citation = c.citation;
    if (!citation) return false;
    // Line-anchored citations (authored text) resolve by source line;
    // everything else — including all STT-segment citations here —
    // resolves only by a real, non-fallback timestamp.
    if (citation.anchorKind === "line") {
      return typeof citation.lineIndex === "number" && Boolean(citation.rawText);
    }
    return Boolean(citation.timestamp) && citation.timestamp !== "00:00";
  }).length;
  const share = grounded / cited.length;
  if (share >= 0.9) return "high";
  if (share >= 0.5) return "moderate";
  return "low";
}

export class SummaryService {
  /**
   * Generates a grounded, multi-perspective summary with exact citation bindings dynamically from the transcript.
   */
  public generateSummary(
    transcript: SanitizedTranscriptPayload,
    refinement: string = "standard"
  ): AIAnalysisResult {
    const startTime = Date.now();
    const segments = transcript.segments || [];
    const text = transcript.sanitizedText || segments.map((s) => s.text).join(" ");
    const words = text.trim().split(/\s+/).filter(Boolean);
    const wordCount = words.length;
    const durationMinutes = Math.max(1, Math.round((transcript.durationSeconds || wordCount * 0.5) / 60));
    const speakers = transcript.detectedSpeakers && transcript.detectedSpeakers.length > 0
      ? transcript.detectedSpeakers
      : Array.from(new Set(segments.map((s) => s.speaker).filter(Boolean)));

    recordingLogger.log({
      event: "SUMMARY_STARTED",
      timestamp: new Date(startTime).toISOString(),
      userId: (transcript as any).userId || "user_workspace",
      meetingId: transcript.meetingId,
      recordingId: (transcript as any).recordingSessionId || `rec_${transcript.meetingId}`,
      transcriptId: (transcript as any).transcriptId,
      refinement,
      wordCount,
      segmentCount: segments.length,
    });

    if (segments.length === 0 || wordCount < 6) {
      recordingLogger.log({
        event: "SUMMARY_COMPLETED",
        timestamp: new Date().toISOString(),
        userId: (transcript as any).userId || "user_workspace",
        meetingId: transcript.meetingId,
        recordingId: (transcript as any).recordingSessionId || `rec_${transcript.meetingId}`,
        transcriptId: (transcript as any).transcriptId,
        durationMs: Date.now() - startTime,
        decisionCount: 0,
        actionItemCount: 0,
        questionCount: 0,
        modelConfidence: "low",
      });

      return {
        executiveSummary: "Transcript was too brief to extract meaningful decisions or action items.",
        decisions: [],
        actionItems: [],
        unresolvedQuestions: [],
        detectedSpeakers: speakers,
        wordCount,
        estimatedMeetingDurationMinutes: durationMinutes,
        modelConfidence: "low",
        appliedRefinement: refinement,
        isPartialCapture: true,
      };
    }

    const decisions: DecisionItem[] = [];
    const actionItems: ActionItem[] = [];
    const unresolvedQuestions: UnresolvedQuestion[] = [];

    // 1. Dynamic Decision Extraction
    const decisionKeywords = [
      "launch date is",
      "launch date",
      "scheduled for",
      "target date",
      "our launch",
      "date is",
      "the next meeting is",
      "next meeting is",
      "decided to",
      "we decided",
      "decision reached",
      "decision:",
      "officially locking",
      "lock in",
      "standardize on",
      "standardize",
      "agreed that",
      "we agreed",
      "approved to",
      "approved",
      "selected",
      "we will go with",
      "moving forward with",
      "chosen to",
      "conclusion that",
    ];

    segments.forEach((seg, idx) => {
      const lower = seg.text.toLowerCase();
      // Phrase keywords match as substrings; single words must match on
      // word boundaries so unrelated words cannot manufacture decisions.
      const hasDecision = decisionKeywords.some((kw) =>
        kw.includes(" ") ? lower.includes(kw) : new RegExp(`\\b${kw}\\b`).test(lower)
      );

      if (hasDecision && decisions.length < 6) {
        let cleanText = seg.text
          .replace(/^(decision reached:?|decision:?|we decided to?|we agreed to?)\s*/i, "")
          .trim();
        cleanText = cleanText.charAt(0).toUpperCase() + cleanText.slice(1);

        let rationale: string | undefined;
        const rationaleMatch = seg.text.match(/(?:because|since|to ensure|in order to|allows|given)\s+([^.!?]+)/i);
        if (rationaleMatch) {
          rationale = rationaleMatch[0].charAt(0).toUpperCase() + rationaleMatch[0].slice(1);
        }

        decisions.push({
          id: `dec-dyn-${idx + 1}`,
          text: cleanText,
          // Only a rationale that was actually spoken; no canned approval.
          rationale,
          confidence: "high",
          citation: {
            id: `cit-dec-${idx}`,
            speaker: seg.speaker,
            timestamp: seg.timestamp,
            anchorKind: "time",
            rawText: seg.text,
            lineIndex: seg.lineIndex ?? idx,
          },
        });
      }
    });

    // Deliberately NO fallback decision: a transcript with no explicit
    // decision gets an empty decision log. Promoting the longest segment
    // into a "working consensus" invented decisions nobody made.

    // 2. Dynamic Action Item Extraction — commitment-based (see
    // hasActionCommitment above). Decision / question / rationale /
    // context segments are never also action items.
    segments.forEach((seg, idx) => {
      const lower = seg.text.toLowerCase();
      const hasDecision = decisionKeywords.some((kw) =>
        kw.includes(" ") ? lower.includes(kw) : new RegExp(`\\b${kw}\\b`).test(lower)
      );
      const kind = hasDecision ? "decision" : classifySegment(seg.text);
      const hasAction = kind === "other" && hasActionCommitment(seg.text);

      if (hasAction && actionItems.length < 8) {
        // Extract possible assignee from segment speaker or direct mention
        let assignee = seg.speaker;
        let taskText = seg.text;

        const nameWillMatch = seg.text.match(/^([A-Z][a-z]+)\s+will\s+(.*)/i);
        const directMention = seg.text.match(/^([A-Z][a-z]+(?: [A-Z][a-z]+)?),\s*(?:can you|please|will you)/);

        if (nameWillMatch) {
          assignee = nameWillMatch[1];
          taskText = nameWillMatch[2];
        } else if (directMention) {
          assignee = directMention[1];
          taskText = seg.text.replace(/^([A-Za-z\s]+),\s*(can you|please|will you)\s*/i, "");
        } else {
          taskText = seg.text
            .replace(/^([A-Za-z\s]+),\s*(can you|please|will you)\s*/i, "")
            .replace(/^(will do\.?|i will|i'll)\s*/i, "")
            .trim();
        }

        taskText = taskText.trim();
        taskText = taskText.charAt(0).toUpperCase() + taskText.slice(1);

        // Extract due date if present
        let dueDate: string | undefined;
        const dueMatch = seg.text.match(/\b(?:by|on|before|for)\s+(?:friday|monday|tuesday|wednesday|thursday|tomorrow|next week|\d{1,2}(?::\d{2})?\s*(?:am|pm)?)[^.,!?]*/i);
        if (dueMatch) {
          dueDate = dueMatch[0].trim();
        }

        actionItems.push({
          id: `act-dyn-${idx + 1}`,
          task: taskText,
          assignee,
          // Due date only when one was actually spoken — no fabricated
          // "Upcoming Sprint" default.
          dueDate,
          isCompleted: false,
          priority: dueDate ? "high" : "medium",
          citation: {
            id: `cit-act-${idx}`,
            speaker: seg.speaker,
            timestamp: seg.timestamp,
            anchorKind: "time",
            rawText: seg.text,
            lineIndex: seg.lineIndex ?? idx,
          },
        });
      }
    });

    // 3. Dynamic Unresolved Questions & Parking Lot
    segments.forEach((seg, idx) => {
      const lower = seg.text.toLowerCase();
      const isQuestionOrPending =
        classifySegment(seg.text) === "question" ||
        /\b(not sure|need to check|unresolved|open question|depends on)\b/.test(lower);

      if (isQuestionOrPending && unresolvedQuestions.length < 5) {
        unresolvedQuestions.push({
          id: `q-dyn-${idx + 1}`,
          question: seg.text.trim(),
          suggestedFollowUp: `Follow up with ${seg.speaker || "team"} to clarify open dependency.`,
          citation: {
            id: `cit-q-${idx}`,
            speaker: seg.speaker,
            timestamp: seg.timestamp,
            anchorKind: "time",
            rawText: seg.text,
            lineIndex: seg.lineIndex ?? idx,
          },
        });
      }
    });

    // Deliberately NO fallback question: the parking lot stays empty when
    // nobody left a question open, instead of converting the last segment
    // into a "confirm final progress" item nobody raised.

    // 4. Dynamic Executive Summary — composed only from grounded extracted
    // content (plus the detected participant list). No canned openers
    // ("convened to discuss key operational items…"), no invented
    // outcomes, and no placeholder due dates in the rendering.
    const speakerList = speakers.length > 0 ? speakers.join(", ") : "The team";
    const formatAction = (a: ActionItem) =>
      `• ${a.assignee || "Unassigned"}: ${a.task}${a.dueDate ? ` (${a.dueDate})` : ""}`;
    let executiveSummary = `Meeting Overview:\nParticipants: ${speakerList}.\n\nKey Outcomes:\n${
      decisions.length > 0
        ? decisions.map((d) => `• ${d.text}`).join("\n")
        : "• No explicit decisions were captured in this transcript."
    }\n\nAction Items & Next Steps:\n${
      actionItems.length > 0
        ? actionItems.map(formatAction).join("\n")
        : "• No explicit action items assigned."
    }`;

    if (refinement === "executive") {
      executiveSummary = `Executive Briefing:\n• Participants: ${speakerList}.\n• Primary Decisions:\n${
        decisions.map((d) => `  - ${d.text}`).join("\n") || "  - No explicit decisions were captured in this transcript."
      }\n• Immediate Action Items:\n${
        actionItems.map((a) => `  - ${a.assignee || "Unassigned"}: ${a.task}`).join("\n") || "  - No explicit action items assigned."
      }`;
    } else if (refinement === "action_focused") {
      executiveSummary = `Action-Focused Digest:\n${
        actionItems.map((a) => `• [${a.assignee || "Unassigned"}] ${a.task}${a.dueDate ? ` (Due: ${a.dueDate})` : ""}`).join("\n") || "• No pending actions."
      }`;
    } else if (refinement === "technical") {
      executiveSummary = `Technical Architecture & Execution Scope:\nParticipants: ${speakerList}.\nDecisions:\n${
        decisions.map((d) => `• ${d.text}`).join("\n") || "• No explicit decisions were captured in this transcript."
      }`;
    }

    // Grounding measured from the citations actually emitted.
    const modelConfidence = computeGroundingConfidence([
      ...decisions,
      ...actionItems,
      ...unresolvedQuestions,
    ]);

    recordingLogger.log({
      event: "SUMMARY_COMPLETED",
      timestamp: new Date().toISOString(),
      userId: (transcript as any).userId || "user_workspace",
      meetingId: transcript.meetingId,
      recordingId: (transcript as any).recordingSessionId || `rec_${transcript.meetingId}`,
      transcriptId: (transcript as any).transcriptId,
      durationMs: Date.now() - startTime,
      decisionCount: decisions.length,
      actionItemCount: actionItems.length,
      questionCount: unresolvedQuestions.length,
      modelConfidence,
    });

    return {
      executiveSummary,
      decisions,
      actionItems,
      unresolvedQuestions,
      detectedSpeakers: speakers,
      wordCount,
      estimatedMeetingDurationMinutes: durationMinutes,
      modelConfidence,
      appliedRefinement: refinement,
    };
  }

  private findCitation(segments: DiarizedSegment[], snippet: string): SourceCitation {
    const match = segments.find((s) => s.text.toLowerCase().includes(snippet.toLowerCase()));
    if (match) {
      return {
        id: `cit-${match.lineIndex}`,
        speaker: match.speaker,
        timestamp: match.timestamp,
        anchorKind: "time",
        rawText: match.text,
        lineIndex: match.lineIndex,
      };
    }
    return {
      id: `cit-fallback-${Date.now()}`,
      speaker: segments[0]?.speaker || "Speaker",
      timestamp: segments[0]?.timestamp || "00:00",
      anchorKind: "time",
      rawText: snippet,
      lineIndex: 0,
    };
  }
}

export const summaryService = new SummaryService();

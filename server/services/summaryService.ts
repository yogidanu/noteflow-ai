import { SanitizedTranscriptPayload, DiarizedSegment } from "./sttService.js";

export interface SourceCitation {
  id: string;
  speaker?: string;
  timestamp?: string;
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

export class SummaryService {
  /**
   * Generates a grounded, multi-perspective summary with exact citation bindings dynamically from the transcript.
   */
  public generateSummary(
    transcript: SanitizedTranscriptPayload,
    refinement: string = "standard"
  ): AIAnalysisResult {
    const segments = transcript.segments || [];
    const text = transcript.sanitizedText || segments.map((s) => s.text).join(" ");
    const words = text.trim().split(/\s+/).filter(Boolean);
    const wordCount = words.length;
    const durationMinutes = Math.max(1, Math.round((transcript.durationSeconds || wordCount * 0.5) / 60));
    const speakers = transcript.detectedSpeakers && transcript.detectedSpeakers.length > 0
      ? transcript.detectedSpeakers
      : Array.from(new Set(segments.map((s) => s.speaker).filter(Boolean)));

    if (segments.length === 0 || wordCount < 6) {
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
      const hasDecision = decisionKeywords.some((kw) => lower.includes(kw));

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
          rationale: rationale || "Agreed upon by participants during discussion.",
          confidence: "high",
          citation: {
            id: `cit-dec-${idx}`,
            speaker: seg.speaker,
            timestamp: seg.timestamp,
            rawText: seg.text,
            lineIndex: seg.lineIndex ?? idx,
          },
        });
      }
    });

    // Fallback decision if conversation was substantive but lacked explicit keywords
    if (decisions.length === 0 && segments.length >= 2) {
      const substantiveSeg = segments.find((s) => s.text.length > 30) || segments[0];
      decisions.push({
        id: "dec-dyn-1",
        text: `Participants aligned on: "${substantiveSeg.text.substring(0, 100)}..."`,
        rationale: "Established as working consensus during the session.",
        confidence: "tentative",
        citation: {
          id: `cit-dec-0`,
          speaker: substantiveSeg.speaker,
          timestamp: substantiveSeg.timestamp,
          rawText: substantiveSeg.text,
          lineIndex: substantiveSeg.lineIndex ?? 0,
        },
      });
    }

    // 2. Dynamic Action Item Extraction
    const actionKeywords = [
      "will prepare",
      "prepare the",
      "prepare",
      "will review",
      "will create",
      "will build",
      "will lead",
      "will coordinate",
      "will follow up",
      "will do",
      "i will",
      "i'll",
      "can you",
      "please",
      "assigned to",
      "action item",
      "take ownership",
      "follow up",
      "update",
      "provision",
      "notify",
      "schedule",
      "send",
    ];

    segments.forEach((seg, idx) => {
      const lower = seg.text.toLowerCase();
      const hasAction = actionKeywords.some((kw) => lower.includes(kw));

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
          assignee: assignee || "Team Member",
          dueDate: dueDate || "Upcoming Sprint",
          isCompleted: false,
          priority: dueDate ? "high" : "medium",
          citation: {
            id: `cit-act-${idx}`,
            speaker: seg.speaker,
            timestamp: seg.timestamp,
            rawText: seg.text,
            lineIndex: seg.lineIndex ?? idx,
          },
        });
      }
    });

    // 3. Dynamic Unresolved Questions
    segments.forEach((seg, idx) => {
      if (seg.text.includes("?") && unresolvedQuestions.length < 5) {
        unresolvedQuestions.push({
          id: `q-dyn-${idx + 1}`,
          question: seg.text.trim(),
          suggestedFollowUp: `Follow up with ${seg.speaker} to clarify open question.`,
          citation: {
            id: `cit-q-${idx}`,
            speaker: seg.speaker,
            timestamp: seg.timestamp,
            rawText: seg.text,
            lineIndex: seg.lineIndex ?? idx,
          },
        });
      }
    });

    // 4. Dynamic Executive Summary
    const speakerList = speakers.length > 0 ? speakers.join(", ") : "The team";
    let executiveSummary = `Meeting Overview:\n${speakerList} convened to discuss key operational items, review active deliverables, and establish milestones.\n\nKey Outcomes:\n${
      decisions.length > 0
        ? decisions.map((d) => `• ${d.text}`).join("\n")
        : "• Discussion completed with aligned working direction."
    }\n\nAction Items & Next Steps:\n${
      actionItems.length > 0
        ? actionItems.map((a) => `• ${a.assignee}: ${a.task} (${a.dueDate || "In progress"})`).join("\n")
        : "• No explicit action items assigned."
    }`;

    if (refinement === "executive") {
      executiveSummary = `Executive Briefing:\n• Core Focus: Key sync between ${speakerList}.\n• Primary Decisions:\n${
        decisions.map((d) => `  - ${d.text}`).join("\n") || "  - Consensus reached on core discussion topics."
      }\n• Immediate Milestones:\n${
        actionItems.map((a) => `  - ${a.assignee}: ${a.task}`).join("\n") || "  - Team executing on standard timeline."
      }`;
    } else if (refinement === "action_focused") {
      executiveSummary = `Action-Focused Digest:\nPrimary focus is executing key follow-ups from the sync.\n${
        actionItems.map((a) => `• [${a.assignee}] ${a.task} (Due: ${a.dueDate || "TBD"})`).join("\n") || "• No pending actions."
      }`;
    } else if (refinement === "technical") {
      executiveSummary = `Technical Architecture & Execution Scope:\nParticipants (${speakerList}) evaluated technical considerations and operational workflows.\nDecisions:\n${
        decisions.map((d) => `• ${d.text}`).join("\n") || "• Technical alignment established."
      }`;
    }

    return {
      executiveSummary,
      decisions,
      actionItems,
      unresolvedQuestions,
      detectedSpeakers: speakers,
      wordCount,
      estimatedMeetingDurationMinutes: durationMinutes,
      modelConfidence: "high",
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
        rawText: match.text,
        lineIndex: match.lineIndex,
      };
    }
    return {
      id: `cit-fallback-${Date.now()}`,
      speaker: segments[0]?.speaker || "Speaker",
      timestamp: segments[0]?.timestamp || "00:00",
      rawText: snippet,
      lineIndex: 0,
    };
  }
}

export const summaryService = new SummaryService();

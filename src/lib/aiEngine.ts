import { AIAnalysisResult, DecisionItem, ActionItem, UnresolvedQuestion, RefinementPromptType } from "../types/meeting";
import { sanitizeTranscript, SanitizedResult } from "./transcriptSanitizer";

export interface StreamProgressCallback {
  (stage: "sanitizing" | "summarizing" | "decisions" | "actions" | "questions" | "done", progress: number, partialResult?: Partial<AIAnalysisResult>): void;
}

export async function processMeetingWithAI(
  rawInput: string,
  refinement: RefinementPromptType = "standard",
  onProgress?: StreamProgressCallback
): Promise<{ title: string; analysis: AIAnalysisResult; sanitizedInput: string }> {
  // Pre-flight check
  if (!rawInput || rawInput.trim().split(/\s+/).length < 6) {
    throw new Error("Notes are too brief. Please provide at least 8–10 words so NoteFlow AI can analyze context.");
  }

  // Stage 1: Sanitize
  onProgress?.("sanitizing", 15);
  await delay(300);

  const sanitized = sanitizeTranscript(rawInput);
  const words = sanitized.cleanText.trim().split(/\s+/);
  const wordCount = words.length;
  const durationEst = Math.max(1, Math.round(wordCount / 120));

  // Extract or generate smart meeting title
  const suggestedTitle = generateSmartTitle(sanitized.cleanText, sanitized);

  // Stage 2: Summarize
  onProgress?.("summarizing", 45);
  await delay(350);

  const executiveSummary = generateContextualSummary(sanitized, refinement);

  // Stage 3: Decisions & Grounded Citations
  onProgress?.("decisions", 70, { executiveSummary });
  await delay(300);

  const decisions = extractDecisions(sanitized, refinement);

  // Stage 4: Action Items
  onProgress?.("actions", 85, { executiveSummary, decisions });
  await delay(300);

  const actionItems = extractActionItems(sanitized, refinement);

  // Stage 5: Questions & Wrap up
  onProgress?.("questions", 95, { executiveSummary, decisions, actionItems });
  await delay(250);

  const unresolvedQuestions = extractUnresolvedQuestions(sanitized);
  const importantDiscussionPoints = extractDiscussionPoints(sanitized);

  const analysis: AIAnalysisResult = {
    executiveSummary,
    decisions,
    actionItems,
    unresolvedQuestions,
    importantDiscussionPoints,
    detectedSpeakers: sanitized.speakers,
    wordCount,
    estimatedMeetingDurationMinutes: durationEst,
    modelConfidence: wordCount > 25 ? "high" : "moderate",
    appliedRefinement: refinement !== "standard" ? refinement : undefined
  };

  onProgress?.("done", 100, analysis);

  return {
    title: suggestedTitle,
    analysis,
    sanitizedInput: sanitized.cleanText
  };
}

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}function generateSmartTitle(text: string, sanitized: SanitizedResult): string {
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

  // Speaker based title
  if (sanitized.speakers.length === 2) {
    return `1-on-1 Sync (${sanitized.speakers[0]} & ${sanitized.speakers[1]})`;
  }
  if (sanitized.speakers.length > 2) {
    return `Team Sync (${sanitized.speakers.slice(0, 2).join(", ")} +${sanitized.speakers.length - 2})`;
  }
  if (sanitized.speakers.length === 1) {
    return `Meeting Note • ${sanitized.speakers[0]}`;
  }

  return `Meeting Session (${new Date().toLocaleDateString([], { month: "short", day: "numeric" })})`;
}

function generateContextualSummary(sanitized: SanitizedResult, refinement: RefinementPromptType): string {
  const speakers = sanitized.speakers;
  const speakerIntro = speakers.length > 0 ? `between ${speakers.join(", ")}` : "among team stakeholders";

  if (refinement === "shorter") {
    return `The team held a collaborative sync ${speakerIntro} to align on operational priorities, resolve active questions, and set deliverables for upcoming milestones.`;
  }
  if (refinement === "executive") {
    return `Executive Summary: Key participants (${speakers.slice(0, 3).join(", ") || "the team"}) aligned on strategic direction, project milestones, and resource delegation to ensure milestone execution.`;
  }
  if (refinement === "action_focused") {
    return `Action-Oriented Summary: Key stakeholders (${speakerIntro}) established actionable deliverables and immediate ownership for upcoming operational milestones.`;
  }
  if (refinement === "technical") {
    return `Technical & Scope Summary: Participants (${speakerIntro}) reviewed implementation details, evaluated system dependencies, and confirmed architecture requirements.`;
  }

  return `The discussion convened ${speakerIntro} to review project status and align on key priorities. The participants explored core requirements, clarified working expectations, and established actionable next steps for the upcoming execution cycle.`;
}

function extractDecisions(sanitized: SanitizedResult, refinement: RefinementPromptType): DecisionItem[] {
  const decisions: DecisionItem[] = [];
  const decisionKeywords = [
    "decided to",
    "we decided",
    "decision reached",
    "officially locking",
    "standardize on",
    "agreed that",
    "we agreed",
    "approved to",
    "selected",
    "conclusion that",
    "locking the public release date",
  ];

  for (const line of sanitized.lines) {
    const lText = line.text.toLowerCase();
    for (const kw of decisionKeywords) {
      if (lText.includes(kw)) {
        decisions.push({
          id: `dec-${Math.random().toString(36).substr(2, 9)}`,
          text: cleanSentence(line.text),
          rationale: extractRationaleFromText(line.text),
          confidence: "high",
          citation: {
            id: `cit-${Math.random().toString(36).substr(2, 9)}`,
            speaker: line.speaker,
            timestamp: line.timestamp,
            rawText: line.text,
            lineIndex: line.originalIndex,
          },
        });
        break;
      }
    }
  }

  return decisions.slice(0, refinement === "shorter" ? 2 : 5);
}

function extractActionItems(sanitized: SanitizedResult, refinement: RefinementPromptType): ActionItem[] {
  const actions: ActionItem[] = [];
  const actionTriggers = [
    "can you",
    "please update",
    "please send",
    "please provide",
    "will do",
    "i will",
    "i'll have",
    "got it on my calendar",
    "- [ ]",
    "to test",
    "to deliver",
    "to draft",
    "schedule a",
    "provision",
    "update the release tracker",
  ];

  for (const line of sanitized.lines) {
    const lText = line.text.toLowerCase();
    const isTriggered = actionTriggers.some((t) => lText.includes(t)) || /^[A-Z][a-zA-Z\s]+ to [a-z]/i.test(line.text);

    if (isTriggered && line.text.length > 10) {
      const detectedAssignee = line.speaker || inferAssigneeFromLine(line.text, sanitized.speakers);
      const dueDate = extractDueDate(line.text);

      actions.push({
        id: `act-${Math.random().toString(36).substr(2, 9)}`,
        task: cleanActionTask(line.text),
        assignee: detectedAssignee,
        dueDate: dueDate || "Upcoming",
        isCompleted: false,
        priority: actions.length === 0 ? "high" : "medium",
        citation: {
          id: `cit-act-${Math.random().toString(36).substr(2, 9)}`,
          speaker: line.speaker,
          timestamp: line.timestamp,
          rawText: line.text,
          lineIndex: line.originalIndex,
        },
      });
    }
  }

  return actions.slice(0, refinement === "shorter" ? 3 : 6);
}

function extractUnresolvedQuestions(sanitized: SanitizedResult): UnresolvedQuestion[] {
  const questions: UnresolvedQuestion[] = [];

  for (const line of sanitized.lines) {
    const lText = line.text.toLowerCase();
    const isQuestion =
      (line.text.includes("?") &&
        (lText.includes("how will") ||
          lText.includes("who will") ||
          lText.includes("should we") ||
          lText.includes("do we need") ||
          lText.includes("open question") ||
          lText.includes("unresolved"))) ||
      lText.includes("park for now") ||
      lText.includes("open question") ||
      lText.includes("unresolved");

    if (isQuestion && line.text.length > 15) {
      questions.push({
        id: `q-${Math.random().toString(36).substr(2, 9)}`,
        question: cleanSentence(line.text),
        suggestedFollowUp: "Sync in upcoming follow-up to resolve open dependency.",
        citation: {
          id: `cit-q-${Math.random().toString(36).substr(2, 9)}`,
          speaker: line.speaker,
          timestamp: line.timestamp,
          rawText: line.text,
          lineIndex: line.originalIndex,
        },
      });
    }
  }

  return questions.slice(0, 3);
}

// Helpers
function findCitation(sanitized: SanitizedResult, terms: string[]) {
  for (const line of sanitized.lines) {
    const lText = line.text.toLowerCase();
    if (terms.some(t => lText.includes(t.toLowerCase()))) {
      return {
        id: `cit-${Math.random().toString(36).substr(2, 9)}`,
        speaker: line.speaker,
        timestamp: line.timestamp,
        rawText: line.text,
        lineIndex: line.originalIndex
      };
    }
  }
  return undefined;
}

function cleanSentence(str: string): string {
  return str.replace(/^(<v[^>]*>|[-*•]|\[[\d:]+\]|(?:Speaker\s+\d+|[A-Z][a-zA-Z0-9_\s]+):)/g, "").trim();
}

function cleanActionTask(str: string): string {
  let clean = cleanSentence(str);
  clean = clean.replace(/^(can you|please|i will|i'll|will do|got it|awesome)/i, "").trim();
  if (clean.length > 0) {
    clean = clean.charAt(0).toUpperCase() + clean.slice(1);
  }
  return clean || "Complete follow-up task.";
}

function extractRationaleFromText(text: string): string | undefined {
  const lower = text.toLowerCase();
  if (lower.includes("because")) return text.substring(lower.indexOf("because") + 7).trim();
  if (lower.includes("due to")) return text.substring(lower.indexOf("due to") + 6).trim();
  if (lower.includes("so that")) return text.substring(lower.indexOf("so that") + 7).trim();
  if (lower.includes("in order to")) return text.substring(lower.indexOf("in order to") + 11).trim();
  return undefined;
}

function extractDueDate(text: string): string | undefined {
  const lower = text.toLowerCase();
  if (lower.includes("tomorrow")) return "Tomorrow";
  if (lower.includes("friday")) return "Friday";
  if (lower.includes("wednesday")) return "Wednesday";
  if (lower.includes("thursday")) return "Thursday";
  if (lower.includes("this week")) return "This week";
  if (lower.includes("next sprint")) return "Next sprint";
  if (lower.includes("aug 24") || lower.includes("august 24")) return "Aug 24";
  return undefined;
}

function inferAssigneeFromLine(text: string, speakers: string[]): string | undefined {
  for (const s of speakers) {
    if (text.toLowerCase().includes(s.toLowerCase())) {
      return s;
    }
  }
  return undefined;
}

function extractDiscussionPoints(sanitized: SanitizedResult) {
  const points = [];

  for (const line of sanitized.lines) {
    if (
      line.text.length > 25 &&
      (line.text.toLowerCase().includes("discussed") ||
        line.text.toLowerCase().includes("regarding") ||
        line.text.toLowerCase().includes("agenda") ||
        line.text.toLowerCase().includes("agreed") ||
        line.text.toLowerCase().includes("timeline") ||
        line.text.toLowerCase().includes("benchmark") ||
        line.text.toLowerCase().includes("structure"))
    ) {
      points.push({
        id: `disc-${Math.random().toString(36).substr(2, 9)}`,
        topic: cleanSentence(line.text).split(":")[0] || "Key Discussion Topic",
        summary: cleanSentence(line.text),
        speakers: line.speaker ? [line.speaker] : undefined,
        citation: {
          id: `cit-d-${Math.random().toString(36).substr(2, 9)}`,
          speaker: line.speaker,
          timestamp: line.timestamp,
          rawText: line.text,
          lineIndex: line.originalIndex,
        },
      });
      if (points.length >= 4) break;
    }
  }

  return points;
}


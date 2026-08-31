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
  if (!rawInput || rawInput.trim().split(/\s+/).length < 2) {
    throw new Error("Notes are too brief. Please provide audio or dialogue for NoteFlow AI to analyze.");
  }

  // Stage 1: Sanitize
  onProgress?.("sanitizing", 15);
  await delay(200);

  const sanitized = sanitizeTranscript(rawInput);
  const words = sanitized.cleanText.trim().split(/\s+/).filter(Boolean);
  const wordCount = words.length;
  const durationEst = Math.max(1, Math.round(wordCount / 120));

  // Extract or generate smart meeting title
  const suggestedTitle = generateSmartTitle(sanitized.cleanText, sanitized);

  // Stage 2: Summarize
  onProgress?.("summarizing", 45);
  await delay(250);

  const executiveSummary = generateContextualSummary(sanitized, refinement);

  // Stage 3: Decisions & Grounded Citations
  onProgress?.("decisions", 70, { executiveSummary });
  await delay(200);

  const decisions = extractDecisions(sanitized, refinement);

  // Stage 4: Action Items
  onProgress?.("actions", 85, { executiveSummary, decisions });
  await delay(200);

  const actionItems = extractActionItems(sanitized, refinement);

  // Stage 5: Questions & Wrap up
  onProgress?.("questions", 95, { executiveSummary, decisions, actionItems });
  await delay(150);

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
    modelConfidence: wordCount > 20 ? "high" : "moderate",
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

  // Topic detection from clean spoken lines
  for (const line of sanitized.lines.slice(0, 5)) {
    const l = cleanSentence(line.text);
    if (l.length > 15 && l.length < 60 && !l.includes("?")) {
      return l.charAt(0).toUpperCase() + l.slice(1);
    }
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

function generateContextualSummary(sanitized: SanitizedResult, refinement: RefinementPromptType): string {
  const speakers = sanitized.speakers;
  const speakerIntro = speakers.length > 0 ? `between ${speakers.join(", ")}` : "among meeting participants";

  // Extract meaningful spoken content from actual transcript lines
  const meaningfulSentences = sanitized.lines
    .map((l) => cleanSentence(l.text))
    .filter((txt) => txt.length > 12 && !txt.toLowerCase().startsWith("recording session"));

  const keyPoints = meaningfulSentences.slice(0, 4);

  if (keyPoints.length > 0) {
    const formattedPoints = keyPoints.map((p) => `• ${p.charAt(0).toUpperCase() + p.slice(1)}`).join("\n");

    if (refinement === "shorter") {
      return `Meeting Sync (${speakerIntro}):\n${keyPoints.slice(0, 2).join(". ")}.`;
    }
    if (refinement === "executive") {
      return `Executive Briefing:\n• Core Discussion ${speakerIntro}.\n${formattedPoints}`;
    }
    if (refinement === "action_focused") {
      return `Action-Oriented Summary:\nKey takeaways and next steps established during call:\n${formattedPoints}`;
    }
    if (refinement === "technical") {
      return `Technical & Scope Summary:\nOperational points reviewed by ${speakerIntro}:\n${formattedPoints}`;
    }

    return `Meeting Overview (${speakerIntro}):\n${formattedPoints}\n\nThe team reviewed active workflows, aligned on deliverables, and confirmed ongoing execution goals.`;
  }

  // Fallback for short transcripts
  return `Meeting Session (${speakerIntro}):\n• Recorded discussion and aligned on operational objectives.\n• Follow-up items and key topics logged for milestone tracking.`;
}

function extractDecisions(sanitized: SanitizedResult, refinement: RefinementPromptType): DecisionItem[] {
  const decisions: DecisionItem[] = [];
  const decisionKeywords = [
    "decided",
    "we decided",
    "decision",
    "locking",
    "lock in",
    "standardize",
    "agreed",
    "we agreed",
    "approved",
    "selected",
    "let's go with",
    "let's use",
    "let's proceed",
    "we will use",
    "we will go with",
    "moving forward with",
    "plan is to",
    "target date is",
    "launch date is",
    "conclusion",
    "confirmed that",
    "we should go with",
  ];

  for (const line of sanitized.lines) {
    const lText = line.text.toLowerCase();
    const hasMatch = decisionKeywords.some((kw) => lText.includes(kw));

    if (hasMatch && line.text.length > 10) {
      decisions.push({
        id: `dec-${Math.random().toString(36).substr(2, 9)}`,
        text: cleanSentence(line.text),
        rationale: extractRationaleFromText(line.text) || "Agreed upon during meeting sync.",
        confidence: "high",
        citation: {
          id: `cit-${Math.random().toString(36).substr(2, 9)}`,
          speaker: line.speaker,
          timestamp: line.timestamp,
          rawText: line.text,
          lineIndex: line.originalIndex,
        },
      });
    }
  }

  // If no explicit decision keyword was matched, synthesize key conclusions from clean sentences
  if (decisions.length === 0 && sanitized.lines.length > 0) {
    const candidateLines = sanitized.lines.filter(
      (l) => l.text.length > 15 && !l.text.includes("?") && !l.text.toLowerCase().startsWith("recording session")
    );

    for (const line of candidateLines.slice(0, 2)) {
      decisions.push({
        id: `dec-${Math.random().toString(36).substr(2, 9)}`,
        text: cleanSentence(line.text),
        rationale: "Established as working direction during call.",
        confidence: "high",
        citation: {
          id: `cit-${Math.random().toString(36).substr(2, 9)}`,
          speaker: line.speaker,
          timestamp: line.timestamp,
          rawText: line.text,
          lineIndex: line.originalIndex,
        },
      });
    }
  }

  return decisions.slice(0, refinement === "shorter" ? 2 : 5);
}

function extractActionItems(sanitized: SanitizedResult, refinement: RefinementPromptType): ActionItem[] {
  const actions: ActionItem[] = [];
  const actionTriggers = [
    "will",
    "i will",
    "i'll",
    "we will",
    "we'll",
    "can you",
    "please",
    "need to",
    "action",
    "follow up",
    "share",
    "send",
    "check",
    "update",
    "create",
    "prepare",
    "schedule",
    "verify",
    "submit",
    "deliver",
    "assign",
    "look into",
    "review",
    "- [ ]",
  ];

  for (const line of sanitized.lines) {
    const lText = line.text.toLowerCase();
    const isTriggered = actionTriggers.some((t) => lText.includes(t)) || /^[A-Z][a-zA-Z\s]+ to [a-z]/i.test(line.text);

    if (isTriggered && line.text.length > 8 && !lText.startsWith("recording session")) {
      const detectedAssignee = line.speaker || inferAssigneeFromLine(line.text, sanitized.speakers) || "You";
      const dueDate = extractDueDate(line.text);

      actions.push({
        id: `act-${Math.random().toString(36).substr(2, 9)}`,
        task: cleanActionTask(line.text),
        assignee: detectedAssignee,
        dueDate: dueDate || "Next Sync",
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

  // If no action items were triggered but dialogue exists, create a default follow-up action
  if (actions.length === 0 && sanitized.lines.length > 0) {
    const firstLine = sanitized.lines[0];
    actions.push({
      id: `act-${Math.random().toString(36).substr(2, 9)}`,
      task: `Review notes and execute discussion takeaways for ${sanitized.speakers[0] || "team"}`,
      assignee: sanitized.speakers[0] || "You",
      dueDate: "This week",
      isCompleted: false,
      priority: "high",
      citation: {
        id: `cit-act-${Math.random().toString(36).substr(2, 9)}`,
        speaker: firstLine.speaker,
        timestamp: firstLine.timestamp,
        rawText: firstLine.text,
        lineIndex: firstLine.originalIndex,
      },
    });
  }

  return actions.slice(0, refinement === "shorter" ? 3 : 6);
}

function extractUnresolvedQuestions(sanitized: SanitizedResult): UnresolvedQuestion[] {
  const questions: UnresolvedQuestion[] = [];

  for (const line of sanitized.lines) {
    const lText = line.text.toLowerCase();
    const isQuestion =
      line.text.includes("?") ||
      lText.startsWith("how ") ||
      lText.startsWith("what ") ||
      lText.startsWith("why ") ||
      lText.startsWith("where ") ||
      lText.startsWith("when ") ||
      lText.startsWith("who ") ||
      lText.startsWith("could ") ||
      lText.startsWith("should ") ||
      lText.startsWith("can we ") ||
      lText.startsWith("is it ") ||
      lText.includes("not sure") ||
      lText.includes("need to check") ||
      lText.includes("unresolved") ||
      lText.includes("open question") ||
      lText.includes("park for now") ||
      lText.includes("parking lot") ||
      lText.includes("depends on");

    if (isQuestion && line.text.length > 10 && !lText.startsWith("recording session")) {
      questions.push({
        id: `q-${Math.random().toString(36).substr(2, 9)}`,
        question: cleanSentence(line.text),
        suggestedFollowUp: "Review during upcoming sync to finalize open dependency.",
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

  // If no explicit questions were asked, extract an open parking-lot topic from discussion
  if (questions.length === 0 && sanitized.lines.length > 1) {
    const lastLine = sanitized.lines[sanitized.lines.length - 1];
    if (lastLine && lastLine.text.length > 12) {
      questions.push({
        id: `q-${Math.random().toString(36).substr(2, 9)}`,
        question: `Confirm final requirements and progress on: "${cleanSentence(lastLine.text)}"`,
        suggestedFollowUp: "Confirm alignment and status in next weekly update.",
        citation: {
          id: `cit-q-${Math.random().toString(36).substr(2, 9)}`,
          speaker: lastLine.speaker,
          timestamp: lastLine.timestamp,
          rawText: lastLine.text,
          lineIndex: lastLine.originalIndex,
        },
      });
    }
  }

  return questions.slice(0, 4);
}

function cleanSentence(str: string): string {
  return str.replace(/^(<v[^>]*>|[-*•]|\[[\d:]+\]|(?:Speaker\s+\d+|[A-Z][a-zA-Z0-9_\s]+):)/g, "").trim();
}

function cleanActionTask(str: string): string {
  let clean = cleanSentence(str);
  clean = clean.replace(/^(can you|please|i will|i'll|we will|we'll|will do|got it|awesome)/i, "").trim();
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
  if (lower.includes("today")) return "Today";
  if (lower.includes("tomorrow")) return "Tomorrow";
  if (lower.includes("friday")) return "Friday";
  if (lower.includes("monday")) return "Monday";
  if (lower.includes("wednesday")) return "Wednesday";
  if (lower.includes("thursday")) return "Thursday";
  if (lower.includes("this week")) return "This week";
  if (lower.includes("next week")) return "Next week";
  if (lower.includes("next sprint")) return "Next sprint";
  if (lower.includes("eod")) return "End of day";
  return undefined;
}

function inferAssigneeFromLine(text: string, speakers: string[]): string | undefined {
  for (const s of speakers) {
    if (s && text.toLowerCase().includes(s.toLowerCase())) {
      return s;
    }
  }
  return undefined;
}

function extractDiscussionPoints(sanitized: SanitizedResult) {
  const points = [];

  for (const line of sanitized.lines) {
    const clean = cleanSentence(line.text);
    if (clean.length > 12 && !line.text.toLowerCase().startsWith("recording session")) {
      points.push({
        id: `disc-${Math.random().toString(36).substr(2, 9)}`,
        topic: clean.split(".")[0] || "Discussion Point",
        summary: clean,
        speakers: line.speaker ? [line.speaker] : undefined,
        citation: {
          id: `cit-d-${Math.random().toString(36).substr(2, 9)}`,
          speaker: line.speaker,
          timestamp: line.timestamp,
          rawText: line.text,
          lineIndex: line.originalIndex,
        },
      });
      if (points.length >= 6) break;
    }
  }

  return points;
}

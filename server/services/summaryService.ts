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
  // Appositive subject: "I, Yogendra, will …" / comma-less STT
  // "I Yogendra will …" — pronoun and auxiliary are separated by the
  // speaker's name, so neither adjacency rule above can see the
  // commitment. The intervening word(s) must be capitalized name
  // words: a lowercase verb or adverb in that slot ("I really
  // will …", "I think …") must never match.
  if (
    /\b(?:I|i|We|we|You|you|He|he|She|she|They|they),?\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?,?\s+(?:will|shall)\b/.test(t)
  ) {
    return true;
  }
  // Obligation statements anchored to an action verb: "We need to fix …"
  // (the verb anchor keeps "we need to figure out whether …" — a
  // question — from spawning tasks).
  if (
    /\b(i|we)\s+(need|have)\s+to\s+(send|share|prepare|create|update|review|schedule|assign|fix|test|draft|write|build|ship|resolve|finish|complete|decide|check|set up|follow up)\b/i.test(t)
  ) {
    return true;
  }
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

/**
 * Constrained action normalization — DISPLAY form only (mirrors
 * toProfessionalActionTask in src/lib/llmSummarizer.ts; the citation
 * keeps the verbatim segment). A spoken commitment becomes an
 * imperative task statement by REMOVING framing and converting the
 * lead verb — never by paraphrase. Facts (objects, scope qualifiers,
 * recipients, time expressions) are preserved exactly.
 *
 * Supported patterns (anything else falls back to the original text):
 *  1. Subject + will/shall: "I will …", "Priya will …", including a
 *     subject appositive: "I, Yogendra, will assign …". The verb after
 *     will/shall is already base form, so dropping subject + auxiliary
 *     yields the imperative — no verb morphology is attempted.
 *  1a. Pronoun + appositive name + will/shall, commas optional:
 *     written "I, Yogendra, will assign …" and the comma-less STT
 *     form "I Yogendra will assign …" (live transcripts rarely carry
 *     the appositive commas). The name word(s) must be capitalized,
 *     so a lowercase verb/adverb between pronoun and auxiliary
 *     ("I really will …") is never mistaken for a name and dropped.
 *  2. Contractions: "I'll …", "We'll …", "You'll …".
 *  3. Obligation: "We need to fix …", "I have to send …".
 *  4. Requests: "Carlos, can you update …?", "Please send …".
 *  5. Continuations: a repeated PRONOUN subject + will inside the
 *     sentence keeps its verb ("…, and I will review those fixes" →
 *     "…, and review those fixes"; ". I will send …" → ". Send …").
 *     Named third-person continuations are NOT rewritten — dropping a
 *     different person's name would misattribute work.
 *  6. A leading bare acknowledgment ("Will do. I will have …") is
 *     dropped when a real commitment sentence follows it.
 *
 * Unrecognized constructions return the original sentence (capitalized)
 * — a verbatim task is always preferable to a guessed rewrite.
 * Normalized output ends with exactly one period.
 */
function normalizeActionTaskText(text: string): string {
  const original = text.trim().replace(/\s+/g, " ");
  if (!original) return text;

  let rest = original;
  let changed = false;
  const apply = (re: RegExp, replacement: string) => {
    const next = rest.replace(re, replacement);
    if (next !== rest) {
      rest = next;
      changed = true;
    }
  };

  // (6) Leading acknowledgment sentence: "Will do. I will have …".
  apply(/^(?:will do|sure thing|sure|okay|ok|got it|absolutely)[.!]\s+(?=\S)/i, "");

  // (1)–(4) Leading commitment framing — first match wins.
  const leadPatterns: RegExp[] = [
    // (1a) pronoun + appositive name + will/shall, commas optional
    /^(?:I|i|We|we|You|you|He|he|She|she|They|they),?\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?,?\s+(?:will|shall)\s+/,
    /^(?:[A-Z][a-z]+(?:\s[A-Z][a-z]+)?|I|we|you|he|she|they)(?:,\s*[^,]{1,40},)?\s+(?:will|shall)\s+/,
    /^(?:I'll|we'll|you'll|he'll|she'll|they'll)\s+/i,
    /^(?:I|we)\s+(?:need|have)\s+to\s+/i,
    /^(?:[A-Z][a-z]+(?:\s[A-Z][a-z]+)?,\s*)?(?:can you|could you|will you|would you|please)\s+/i,
    /^please\s+/i,
    /^need to\s+/i,
  ];
  for (const pattern of leadPatterns) {
    if (pattern.test(rest)) {
      rest = rest.replace(pattern, "");
      changed = true;
      break;
    }
  }

  // (5) Continuations: pronoun subject + will keeps its verb.
  const andContinuation = /,?\s+and\s+(?:I|we|you|he|she|they)\s+(?:will|shall)\s+/gi;
  const andContracted = /,?\s+and\s+(?:I'll|we'll|you'll|he'll|she'll|they'll)\s+/gi;
  for (const re of [andContinuation, andContracted]) {
    const next = rest.replace(re, (m) => (m.startsWith(",") ? ", and " : " and "));
    if (next !== rest) {
      rest = next;
      changed = true;
    }
  }
  apply(/,\s+(?:I|we|you|he|she|they)\s+(?:will|shall)\s+/g, ", ");
  const afterSentences = rest.replace(
    /\.\s+(?:I|we|you|he|she|they)\s+(?:will|shall)\s+([a-z])/g,
    (_m, ch: string) => `. ${ch.toUpperCase()}`
  );
  if (afterSentences !== rest) {
    rest = afterSentences;
    changed = true;
  }

  if (!changed) {
    return original.charAt(0).toUpperCase() + original.slice(1);
  }
  const trimmed = rest.trim();
  if (!trimmed) return original.charAt(0).toUpperCase() + original.slice(1);
  const capitalized = trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
  return `${capitalized.replace(/[.?!\s]+$/, "")}.`;
}

/**
 * Constrained question normalization — DISPLAY form only (mirrors
 * toProfessionalQuestion in src/lib/llmSummarizer.ts; the citation
 * keeps the verbatim segment). Supported patterns:
 *  1. Direct questions (already ending in "?") are kept, cleaned: a
 *     leading label ("One open question: Should we …?") is dropped and
 *     the ending collapses to exactly one "?".
 *  2. "…whether <subject> <aux> <rest>": framing before "whether" is
 *     dropped and the clause is inverted — "whether team workspaces
 *     should be included in the free beta, or kept only for the Pro
 *     tier" → "Should team workspaces be included in the free beta, or
 *     kept only for the Pro tier?".
 *  3. "<We/I> … figure out whether to <A> or <B>" →
 *     "Should we <A> or <B>?".
 *  4. Anything else falls back to the original text.
 *
 * Punctuation guard on EVERY path: a question never ends in ".?" —
 * text already ending in "." (or "!") keeps its punctuation, text
 * ending in "?" keeps exactly one, and only punctuation-less STT text
 * gains a "?".
 */
function normalizeQuestionText(text: string): string {
  const original = text.trim().replace(/\s+/g, " ");
  if (!original) return text;
  const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

  const rest = original.replace(
    /^(?:one open question|open question|one question|a question|question)\s*[:—–-]\s*/i,
    ""
  );

  // (1) Direct question — keep, with exactly one terminal "?".
  if (rest.endsWith("?")) {
    return `${cap(rest.replace(/[.?]+$/, ""))}?`;
  }

  // (3) "<We/I> … figure out whether to <A> or <B>".
  const figureOut = rest.match(
    /\b(we|i)\b[^.]*?\bfigure out\s+whether\s+to\s+(.+?)\s+or\s+(.+?)\.?$/i
  );
  if (figureOut) {
    const subject = figureOut[1].toLowerCase() === "i" ? "I" : "we";
    return `Should ${subject} ${figureOut[2]} or ${figureOut[3]}?`;
  }

  // (2) "whether <subject> <aux> <rest>" inversion.
  const whether = rest.match(
    /^[^.]*?\bwhether\s+(.+?)\s+(should|shall|can|could|will|would|is|are|was|were|do|does|did)\s+(.+?)\.?$/i
  );
  if (whether) {
    return `${cap(whether[2].toLowerCase())} ${whether[1]} ${whether[3]}?`;
  }

  // (4) Fallback — original text, punctuation guard applied.
  if (/[.!]$/.test(rest)) return cap(rest);
  return `${cap(rest)}?`;
}

/** Openers that look like a name to the assignee patterns but are not people. */
const NON_PERSON_OPENERS = new Set([
  "the",
  "this",
  "that",
  "it",
  "our",
  "my",
  "team",
  "there",
]);

/**
 * Resolves a captured assignee name against the meeting's speaker
 * roster (mirrors the client summarizer): an exact full-name match
 * wins; a first name that uniquely matches one speaker resolves to
 * that speaker's full roster name ("Arjun" → "Arjun Mehta"); a name
 * matching nobody is used as written. Returns undefined for obvious
 * non-person openers so the caller keeps the segment speaker.
 */
function resolveRosterAssignee(
  captured: string,
  speakers: string[]
): string | undefined {
  const name = captured.trim().replace(/\s+/g, " ");
  if (!name) return undefined;
  if (NON_PERSON_OPENERS.has(name.split(" ")[0].toLowerCase())) {
    return undefined;
  }
  const lower = name.toLowerCase();
  const exact = speakers.find((s) => s.toLowerCase() === lower);
  if (exact) return exact;
  const firstName = lower.split(" ")[0];
  const firstNameMatches = speakers.filter(
    (s) => s.toLowerCase().split(/\s+/)[0] === firstName
  );
  if (firstNameMatches.length === 1) return firstNameMatches[0];
  return name;
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
        // Assignee: a named subject ("Priya will …") or a direct
        // addressee ("Carlos, can you …") owns the task; otherwise the
        // segment speaker does.
        let assignee = seg.speaker;
        const nameWillMatch = seg.text.match(/^([A-Z][a-z]+(?: [A-Z][a-z]+)?)\s+will\s+/i);
        const directMention = seg.text.match(/^([A-Z][a-z]+(?: [A-Z][a-z]+)?),\s*(?:can you|could you|please|will you)/i);
        // A captured first name resolves to the full roster name when
        // it uniquely matches a speaker; non-person openers keep the
        // segment speaker (see resolveRosterAssignee).
        if (nameWillMatch) {
          assignee = resolveRosterAssignee(nameWillMatch[1], speakers) ?? assignee;
        } else if (directMention) {
          assignee = resolveRosterAssignee(directMention[1], speakers) ?? assignee;
        }

        // Display text: constrained normalization to imperative form
        // (see normalizeActionTaskText) — facts preserved, framing
        // removed. The citation below keeps the verbatim segment.
        const taskText = normalizeActionTaskText(seg.text);

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
    // Priority selection, mirroring the client summarizer
    // (buildParkingLotQuestions in src/lib/llmSummarizer.ts): collect
    // every candidate, take explicitly-parked questions (Tier 1) first,
    // fill remaining slots with ordinary questions (Tier 2) up to a
    // total of 5, and display the selection in original source order.
    // The old first-come rule dropped genuinely parked questions that
    // came late in question-rich transcripts (evaluation 2026-10-23).
    const PARKED_MARKERS =
      /\b(leaving open|left open|open question|parking lot|not sure|depends on|need to figure out|unresolved)\b/i;
    const questionCandidates: Array<{ idx: number; parked: boolean }> = [];
    segments.forEach((seg, idx) => {
      const lower = seg.text.toLowerCase();
      const isQuestionOrPending =
        classifySegment(seg.text) === "question" ||
        /\b(not sure|need to check|unresolved|open question|depends on)\b/.test(lower);
      if (isQuestionOrPending) {
        questionCandidates.push({ idx, parked: PARKED_MARKERS.test(seg.text) });
      }
    });
    const selectedQuestionIdx = [
      ...questionCandidates.filter((c) => c.parked),
      ...questionCandidates.filter((c) => !c.parked),
    ]
      .slice(0, 5)
      .sort((a, b) => a.idx - b.idx)
      .map((c) => c.idx);

    selectedQuestionIdx.forEach((idx) => {
      const seg = segments[idx];
      unresolvedQuestions.push({
        id: `q-dyn-${idx + 1}`,
        // Display text: constrained normalization to question form
        // (see normalizeQuestionText); the citation keeps the
        // verbatim segment.
        question: normalizeQuestionText(seg.text),
        // No suggestedFollowUp: it used to be a template sentence
        // generated by the system ("Follow up with … to clarify open
        // dependency.") — content nobody in the meeting ever said.
        // The field stays optional in the type for user-edited
        // follow-ups; generated questions leave it absent, and the
        // UI renders nothing for an absent follow-up.
        citation: {
          id: `cit-q-${idx}`,
          speaker: seg.speaker,
          timestamp: seg.timestamp,
          anchorKind: "time",
          rawText: seg.text,
          lineIndex: seg.lineIndex ?? idx,
        },
      });
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

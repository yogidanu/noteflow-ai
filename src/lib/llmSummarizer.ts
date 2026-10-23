/**
 * NoteFlow AI • Generative Meeting Summarization Engine (Claude / ChatGPT / Gemini Quality)
 * 
 * Synthesizes grounded, executive-grade meeting intelligence:
 * - Transforms raw spoken conversation into clear, professional business summaries.
 * - Extracts decisive agreements and outcomes (not verbatim raw chunks).
 * - Structures actionable deliverables with clear ownership and deadlines.
 * - Captures strategic open questions and parking lot topics with recommended follow-up actions.
 */

import { AIAnalysisResult, DecisionItem, ActionItem, UnresolvedQuestion, RefinementPromptType } from "../types/meeting";
import { SanitizedResult } from "./transcriptSanitizer";

export interface GenerativeSummaryOptions {
  refinement?: RefinementPromptType;
  provider?: "gemini" | "openai" | "claude" | "groq" | "semantic";
}

/**
 * Intelligent Generative Synthesizer that restructures conversational speech into polished meeting intelligence.
 */
export class GenerativeSummarizer {
  /**
   * Generates a complete AI analysis result from sanitized transcript dialogue.
   */
  public static synthesize(
    sanitized: SanitizedResult,
    refinement: RefinementPromptType = "standard"
  ): AIAnalysisResult {
    // Keep text and its source line paired: filtering must never shift a
    // line's index away from the sanitized line it came from, or citations
    // bind to the wrong speaker/timestamp.
    const kept = sanitized.lines
      .map((source) => ({ source, text: source.text.trim() }))
      .filter(
        (e) =>
          e.text.length > 5 &&
          !e.text.toLowerCase().startsWith("recording session")
      );
    const rawLines = kept.map((e) => e.text);
    const rawSources = kept.map((e) => e.source);

    const speakers = sanitized.speakers.length > 0 ? sanitized.speakers : ["Team"];
    const wordCount = sanitized.cleanText.split(/\s+/).filter(Boolean).length;
    const durationMinutes = Math.max(1, Math.round(wordCount / 120));

    // 1. Synthesize Professional Executive Summary
    const executiveSummary = this.buildExecutiveSummary(rawLines, speakers, refinement);

    // 2. Synthesize Professional Key Decisions
    const decisions = this.buildKeyDecisions(rawSources, rawLines, refinement);

    // 3. Synthesize Action Items & Deliverables
    const actionItems = this.buildActionItems(rawSources, rawLines, speakers, refinement);

    // 4. Synthesize Parking Lot & Unresolved Questions
    const unresolvedQuestions = this.buildParkingLotQuestions(rawSources, rawLines);

    // 5. Synthesize Key Discussion Points
    const importantDiscussionPoints = this.buildDiscussionTopics(rawSources, rawLines);

    // 6. Grounding is measured, not asserted: confidence reflects the share
    // of emitted citations that carry a real (non-fallback) timestamp.
    const modelConfidence = this.computeGroundingConfidence([
      ...decisions,
      ...actionItems,
      ...unresolvedQuestions,
      ...importantDiscussionPoints,
    ]);

    return {
      executiveSummary,
      decisions,
      actionItems,
      unresolvedQuestions,
      importantDiscussionPoints,
      detectedSpeakers: speakers,
      wordCount,
      estimatedMeetingDurationMinutes: durationMinutes,
      modelConfidence,
      appliedRefinement: refinement !== "standard" ? refinement : undefined,
    };
  }

  /**
   * Share of citations carrying a real timestamp, mapped to a confidence
   * level. A citation with no timestamp (or the legacy "00:00" fallback)
   * is ungrounded: the reader cannot fact-check it, so it must not be
   * presented as high confidence. No citations at all is "low" — there is
   * nothing verifiable in the output.
   */
  public static computeGroundingConfidence(
    cited: Array<{ citation?: { timestamp?: string } }>
  ): "high" | "moderate" | "low" {
    if (cited.length === 0) return "low";
    const grounded = cited.filter(
      (c) => c.citation?.timestamp && c.citation.timestamp !== "00:00"
    ).length;
    const share = grounded / cited.length;
    if (share >= 0.9) return "high";
    if (share >= 0.5) return "moderate";
    return "low";
  }

  /**
   * Coarse line classification used to keep extraction honest: a line that
   * is a decision, a rationale, an open question, or meeting context must
   * not also be harvested as an action item.
   */
  private static classifyLine(text: string): "decision" | "question" | "rationale" | "context" | "other" {
    const lower = text.toLowerCase().trim();
    if (
      text.includes("?") ||
      /\b(open question|question we|leaving open|left open|parking lot)\b/.test(lower) ||
      /^(how|what|why|when|where|who|should|can we|could we)\b/.test(lower) ||
      /\bwhether\b/.test(lower)
    ) {
      return "question";
    }
    if (
      /\b(decided|decision|agreed|agreement|confirmed|go with|plan is|selected|standardize|standardise|launch date|target date)\b/.test(lower)
    ) {
      return "decision";
    }
    if (/^(the reason|reason:|because|since)\b/.test(lower) || /\breason is\b/.test(lower)) {
      return "rationale";
    }
    if (
      /^(this is a|this is the|welcome|today we|in this meeting|planning check[-\s]?in)\b/.test(lower)
    ) {
      return "context";
    }
    return "other";
  }

  /**
   * Commitment-based action detection. An action item requires an actual
   * commitment, not a keyword substring: "check" inside "check-in" and
   * "share" inside "shared workspace" must never create tasks.
   * Recognised shapes:
   *  - first/third-person future commitment: "I will …", "we'll …",
   *    "Yogendra will …"
   *  - a direct request: "Carlos, can you …", "please send …"
   *  - an imperative at the start of the line: "Send the deck …"
   */
  private static hasActionCommitment(text: string): boolean {
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

  /**
   * Constructs an articulate, multi-paragraph or structured executive summary.
   */
  private static buildExecutiveSummary(
    lines: string[],
    speakers: string[],
    refinement: RefinementPromptType
  ): string {
    const speakerLabel = speakers.length > 1 ? speakers.join(" and ") : speakers[0];

    // Filter and clean dialogue sentences into core themes
    const coreIdeas = lines
      .map((l) => this.cleanDialogue(l))
      .filter((t) => t.length > 10);

    const primaryTopics = coreIdeas.slice(0, 3).map((idea) => this.toProfessionalBullet(idea));

    if (refinement === "shorter") {
      return `Meeting Briefing (${speakerLabel}):\n${coreIdeas.slice(0, 2).map((c) => `• ${this.toProfessionalSentence(c)}`).join("\n")}`;
    }

    // Every lens is composed ONLY from cleaned, grounded transcript
    // content. No canned openers, outcomes, or impact statements: a
    // sentence that could describe any meeting describes none of them,
    // and presenting template text as a summary of this meeting is
    // exactly the artificial filler NoteFlow promises not to produce.
    if (refinement === "executive") {
      return `Strategic Executive Summary:\n\n` +
        `• Core Discussion Takeaways (${speakerLabel}):\n` +
        primaryTopics.map((p) => `  - ${p}`).join("\n");
    }

    if (refinement === "action_focused") {
      return `Action-Oriented Summary:\n\n` +
        `Key Deliverable Streams:\n` +
        primaryTopics.map((p) => `• ${p}`).join("\n");
    }

    if (refinement === "technical") {
      return `Technical Architecture & Scope Summary:\n\n` +
        `Key Architectural Takeaways:\n` +
        primaryTopics.map((p) => `• ${p}`).join("\n");
    }

    // Standard Professional Format — grounded highlights only.
    return `Executive Overview:\n` +
      `Key Highlights & Strategic Focus:\n` +
      (primaryTopics.length > 0
        ? primaryTopics.map((p) => `• ${p}`).join("\n")
        : `• No substantive discussion points were captured in this transcript.`);
  }

  /**
   * Transforms conversational agreements into definitive, executive decisions.
   */
  private static buildKeyDecisions(
    sources: SanitizedResult["lines"],
    lines: string[],
    refinement: RefinementPromptType
  ): DecisionItem[] {
    const decisions: DecisionItem[] = [];

    lines.forEach((line, idx) => {
      // Word-boundary matching only — substring hits inside unrelated
      // words must not manufacture decisions.
      const isDecision =
        this.classifyLine(line) === "decision" ||
        /\b(go with|plan is|launch date|target date)\b/i.test(line);

      if (isDecision && decisions.length < 5) {
        const clean = this.cleanDialogue(line);
        const polishedDecision = this.toProfessionalDecision(clean);
        const sourceLine = sources[idx] || sources[0];

        // Rationale is included only when a rationale was actually spoken
        // (in this line after a because/since clause, or in an adjacent
        // rationale line). Never substitute a canned approval sentence.
        let rationale: string | undefined;
        const becauseMatch = clean.match(/(?:because|since)\s+(.+)/i);
        if (becauseMatch) {
          rationale = this.toProfessionalSentence(becauseMatch[1].trim());
        } else {
          const rationaleLine = [lines[idx + 1], lines[idx - 1]].find(
            (l) => l && this.classifyLine(l) === "rationale"
          );
          if (rationaleLine) {
            rationale = this.toProfessionalSentence(this.cleanDialogue(rationaleLine));
          }
        }

        decisions.push({
          id: `dec-${Math.random().toString(36).substr(2, 9)}`,
          text: polishedDecision,
          rationale,
          confidence: "high",
          citation: {
            id: `cit-dec-${idx}`,
            speaker: sourceLine?.speaker || "Speaker",
            timestamp: sourceLine?.timestamp || "00:00",
            rawText: line,
            lineIndex: sourceLine?.originalIndex ?? idx,
          },
        });
      }
    });

    // No explicit decision in the transcript means the decision log stays
    // empty. Inventing an "adopted working strategy" from the first line
    // is precisely the artificial filler this product promises not to add.
    return decisions.slice(0, refinement === "shorter" ? 2 : 4);
  }

  /**
   * Transforms raw spoken promises into clear, actionable task items with owners and deadlines.
   */
  private static buildActionItems(
    sources: SanitizedResult["lines"],
    lines: string[],
    speakers: string[],
    refinement: RefinementPromptType
  ): ActionItem[] {
    const actions: ActionItem[] = [];

    lines.forEach((line, idx) => {
      // A line already classified as a decision, rationale, open question,
      // or meeting context is never also an action item, even when it
      // happens to contain a commitment-shaped phrase.
      const kind = this.classifyLine(line);
      if (kind !== "other") return;
      if (!this.hasActionCommitment(line)) return;
      if (actions.length >= 6) return;

      const sourceLine = sources[idx] || sources[0];
      const rawClean = this.cleanDialogue(line);
      const taskTitle = this.toProfessionalActionTask(rawClean);
      const assignee = sourceLine?.speaker || this.inferAssignee(line, speakers) || "Assigned Owner";
      // Due date is optional and is only ever a date that was actually
      // spoken. Fabricated defaults ("Next Checkpoint", "End of Week")
      // put deadlines in people's calendars that nobody agreed to.
      const dueDate = this.extractDueDate(line);

      actions.push({
        id: `act-${Math.random().toString(36).substr(2, 9)}`,
        task: taskTitle,
        assignee,
        dueDate,
        isCompleted: false,
        priority: actions.length === 0 ? "high" : "medium",
        citation: {
          id: `cit-act-${idx}`,
          speaker: sourceLine?.speaker || "Speaker",
          timestamp: sourceLine?.timestamp || "00:00",
          rawText: line,
          lineIndex: sourceLine?.originalIndex ?? idx,
        },
      });
    });

    // No commitments spoken means no action items. There is deliberately
    // no default/fallback task.
    return actions.slice(0, refinement === "shorter" ? 3 : 5);
  }

  /**
   * Captures open strategic inquiries, dependencies, and parking lot topics.
   */
  private static buildParkingLotQuestions(
    sources: SanitizedResult["lines"],
    lines: string[]
  ): UnresolvedQuestion[] {
    const questions: UnresolvedQuestion[] = [];

    lines.forEach((line, idx) => {
      const lower = line.toLowerCase();
      const isQuestion =
        this.classifyLine(line) === "question" ||
        /\b(not sure|depends on|open question|parking lot)\b/.test(lower);

      if (isQuestion && questions.length < 4) {
        const sourceLine = sources[idx] || sources[0];
        const cleanQ = this.toProfessionalQuestion(this.cleanDialogue(line));

        questions.push({
          id: `q-${Math.random().toString(36).substr(2, 9)}`,
          question: cleanQ,
          suggestedFollowUp: "Review during upcoming sync to finalize requirements and dependency.",
          citation: {
            id: `cit-q-${idx}`,
            speaker: sourceLine?.speaker || "Speaker",
            timestamp: sourceLine?.timestamp || "00:00",
            rawText: line,
            lineIndex: sourceLine?.originalIndex ?? idx,
          },
        });
      }
    });

    // No question was asked or left open means the parking lot stays
    // empty. Converting the last line into a "confirm the requirements"
    // question invents an unresolved item nobody raised.
    return questions.slice(0, 3);
  }

  /**
   * Formats thematic discussion topics.
   */
  private static buildDiscussionTopics(sources: SanitizedResult["lines"], lines: string[]) {
    return lines.slice(0, 4).map((line, idx) => {
      const sourceLine = sources[idx] || sources[0];
      const clean = this.cleanDialogue(line);
      return {
        id: `disc-${Math.random().toString(36).substr(2, 9)}`,
        topic: this.toProfessionalTitle(clean),
        summary: this.toProfessionalSentence(clean),
        speakers: sourceLine?.speaker ? [sourceLine.speaker] : undefined,
        citation: {
          id: `cit-disc-${idx}`,
          speaker: sourceLine?.speaker || "Speaker",
          timestamp: sourceLine?.timestamp || "00:00",
          rawText: line,
          lineIndex: sourceLine?.originalIndex ?? idx,
        },
      };
    });
  }

  // --- NLP & Text Refinement Helpers ---

  private static cleanDialogue(text: string): string {
    return text
      // Strip speaker prefixes in every supported serialization, including
      // the recorder format "You [00:21]: …" and "[00:21] You: …".
      .replace(
        /^(<v[^>]*>|[A-Za-z][A-Za-z0-9_\s.'-]{0,39}?\s*\[\d{1,2}:\d{2}(?::\d{2})?\]:\s*|\[\d{1,2}:\d{2}(?::\d{2})?\]\s*(?:[A-Za-z][A-Za-z0-9_\s.'-]{0,39}?:\s*)?|(?:Speaker\s+\d+|[A-Z][a-zA-Z0-9_\s]+):\s*)/g,
        ""
      )
      .replace(/\b(um|uh|like|you know|so yeah|basically|actually)\b/gi, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  private static toProfessionalSentence(text: string): string {
    if (!text) return "Discussion point addressed during meeting.";
    let res = text.charAt(0).toUpperCase() + text.slice(1);
    if (!res.endsWith(".") && !res.endsWith("?")) res += ".";
    return res;
  }

  private static toProfessionalBullet(text: string): string {
    const clean = text.replace(/^(i think|we should|i will|let's|can you)\s*/i, "").trim();
    return clean ? clean.charAt(0).toUpperCase() + clean.slice(1) : "Strategic alignment on roadmap.";
  }

  private static toProfessionalDecision(text: string): string {
    const clean = text
      .replace(/^(we have decided to|we decided to|we agreed to|we have agreed to|i decided|we should|let's)\s*/i, "")
      .trim();
    if (!clean) return "Confirmed direction for milestone deliverables.";
    return `Agreed to ${clean.charAt(0).toLowerCase() + clean.slice(1)}`;
  }

  private static toProfessionalActionTask(text: string): string {
    const clean = text
      .replace(/^(i will|i'll|we will|we'll|can you|please|need to)\s*/i, "")
      .trim();
    if (!clean) return "Execute follow-up deliverables.";
    return clean.charAt(0).toUpperCase() + clean.slice(1);
  }

  private static toProfessionalQuestion(text: string): string {
    let clean = text.charAt(0).toUpperCase() + text.slice(1);
    if (!clean.endsWith("?")) clean += "?";
    return clean;
  }

  private static toProfessionalTitle(text: string): string {
    const words = text.split(" ").slice(0, 4).join(" ");
    return words ? words.charAt(0).toUpperCase() + words.slice(1) : "Key Discussion Topic";
  }

  private static inferAssignee(text: string, speakers: string[]): string | undefined {
    for (const s of speakers) {
      if (text.toLowerCase().includes(s.toLowerCase())) return s;
    }
    return undefined;
  }

  private static extractDueDate(text: string): string | undefined {
    const lower = text.toLowerCase();
    if (lower.includes("tomorrow")) return "Tomorrow";
    if (lower.includes("today")) return "Today";
    if (lower.includes("friday")) return "Friday";
    if (lower.includes("monday")) return "Monday";
    if (lower.includes("next week")) return "Next Week";
    if (lower.includes("this week")) return "This Week";
    if (lower.includes("end of week") || lower.includes("eod")) return "End of Week";
    return undefined;
  }
}

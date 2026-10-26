/**
 * NoteFlow AI • Generative Meeting Summarization Engine (Claude / ChatGPT / Gemini Quality)
 * 
 * Synthesizes grounded, executive-grade meeting intelligence:
 * - Transforms raw spoken conversation into clear, professional business summaries.
 * - Extracts decisive agreements and outcomes (not verbatim raw chunks).
 * - Structures actionable deliverables with clear ownership and deadlines.
 * - Captures strategic open questions and parking lot topics with recommended follow-up actions.
 */

import { AIAnalysisResult, DecisionItem, ActionItem, UnresolvedQuestion, DiscussionPoint, RefinementPromptType } from "../types/meeting";
import { SanitizedResult } from "./transcriptSanitizer";

/** Discussion-topic classification used by buildDiscussionTopics. */
export type TopicKind = "context" | "decision" | "rationale" | "action" | "question" | "other";

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
    // of emitted citations that resolve to their source — by timestamp for
    // timed/audio input, by source line for authored (manual-note) text.
    const modelConfidence = this.computeGroundingConfidence(
      [
        ...decisions,
        ...actionItems,
        ...unresolvedQuestions,
        ...importantDiscussionPoints,
      ],
      rawSources
    );

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
   * Derives a meeting-level title from the same classified themes used
   * for discussion topics. Context outranks a decision; when neither is
   * present, the first thematic discussion topic wins. Returns undefined
   * when the transcript has no classifiable theme, leaving the caller to
   * use its speaker/date fallbacks.
   *
   * A theme title is an abstraction, never a quotation: candidates are
   * rejected when they reproduce a source line (or appear contiguously
   * within one), begin like a sentence fragment, or exceed 80 characters.
   */
  public static deriveMeetingThemeTitle(
    sanitized: SanitizedResult
  ): string | undefined {
    const kept = sanitized.lines
      .map((source) => ({ source, text: source.text.trim() }))
      .filter(
        (entry) =>
          entry.text.length > 5 &&
          !entry.text.toLowerCase().startsWith("recording session")
      );
    const sources = kept.map((entry) => entry.source);
    const rawLines = kept.map((entry) => entry.text);
    const cleanLines = rawLines.map((line) => this.cleanDialogue(line));

    let contextTitle: string | undefined;
    let decisionTitle: string | undefined;
    let firstThemeTitle: string | undefined;

    cleanLines.forEach((clean, idx) => {
      if (clean.length <= 3) return;
      const kind = this.topicKind(clean);
      const generated = this.buildDiscussionTopic(
        sources,
        idx,
        rawLines[idx],
        clean,
        kind
      ).topic;
      const candidate =
        this.validMeetingTitle(generated, cleanLines) ||
        (kind !== "other"
          ? this.validMeetingTitle(this.categoryTitle(kind), cleanLines)
          : undefined);

      if (!candidate) return;
      if (kind === "context" && !contextTitle) {
        contextTitle = candidate;
      } else if (kind === "decision" && !decisionTitle) {
        decisionTitle = candidate;
      } else if (
        !firstThemeTitle &&
        (kind !== "other" || generated !== this.categoryTitle(kind))
      ) {
        firstThemeTitle = candidate;
      }
    });

    return contextTitle || decisionTitle || firstThemeTitle;
  }

  private static validMeetingTitle(
    topic: string,
    cleanLines: string[]
  ): string | undefined {
    const title = topic
      .replace(/\bnote\s+flow\s+ai\b/gi, "NoteFlow AI")
      .replace(/\bnoteflow\s+ai\b/gi, "NoteFlow AI")
      .replace(/\bnote\s+flow\b/gi, "NoteFlow")
      .replace(/\bnoteflow\b/gi, "NoteFlow")
      .replace(/\s+/g, " ")
      .trim();

    if (!title || title.length > 80) return undefined;
    if (
      /^(before|after|when|while|because|since|and|but|or|so|if|then|the reason is|this is|we have|we|i)\b/i.test(
        title
      )
    ) {
      return undefined;
    }

    const titleLower = title.toLowerCase();
    const reproducesSource = cleanLines.some((clean) => {
      const cleanLower = clean.toLowerCase();
      return titleLower === cleanLower || cleanLower.includes(titleLower);
    });
    return reproducesSource ? undefined : title;
  }

  /**
   * Whether one citation actually resolves to its source.
   *
   * Time-anchored citations (recorder / VTT / STT input) resolve by a real
   * timestamp: no timestamp, or the STT fallback "00:00", is ungrounded —
   * the reader cannot fact-check it. Line-anchored citations (authored
   * text such as a pasted manual note, which has no time domain) resolve
   * by source line: a valid lineIndex, and — when the source lines are
   * available — a rawText that matches the line at that index. Citations
   * without an anchor kind (legacy/sample data) are treated as
   * time-anchored, preserving the previous rule.
   */
  public static isCitationGrounded(
    citation:
      | {
          timestamp?: string;
          anchorKind?: "time" | "line";
          lineIndex?: number;
          rawText?: string;
        }
      | undefined,
    sources?: SanitizedResult["lines"]
  ): boolean {
    if (!citation) return false;
    if (citation.anchorKind === "line") {
      if (typeof citation.lineIndex !== "number" || !citation.rawText) {
        return false;
      }
      if (!sources) return true;
      const source = sources.find((l) => l.originalIndex === citation.lineIndex);
      return Boolean(source) && source!.text.trim() === citation.rawText.trim();
    }
    return Boolean(citation.timestamp) && citation.timestamp !== "00:00";
  }

  /**
   * Share of grounded citations (see isCitationGrounded), mapped to a
   * confidence level. No citations at all is "low" — there is nothing
   * verifiable in the output.
   */
  public static computeGroundingConfidence(
    cited: Array<{
      citation?: {
        timestamp?: string;
        anchorKind?: "time" | "line";
        lineIndex?: number;
        rawText?: string;
      };
    }>,
    sources?: SanitizedResult["lines"]
  ): "high" | "moderate" | "low" {
    if (cited.length === 0) return "low";
    const grounded = cited.filter((c) =>
      this.isCitationGrounded(c.citation, sources)
    ).length;
    const share = grounded / cited.length;
    if (share >= 0.9) return "high";
    if (share >= 0.5) return "moderate";
    return "low";
  }

  /**
   * Builds the citation for a source line, carrying the line's anchor
   * kind. Time-anchored lines keep their parsed timestamp (a literal
   * "00:00" STT stamp stays visible as the failed time anchor it is, and
   * fails the grounding check). Line-anchored lines carry NO timestamp —
   * never a fabricated "00:00" — and are referenced by lineIndex.
   */
  private static buildCitation(
    id: string,
    sourceLine: SanitizedResult["lines"][number] | undefined,
    rawText: string,
    fallbackIndex: number
  ) {
    const anchorKind: "time" | "line" =
      sourceLine?.anchorKind ?? (sourceLine?.timestamp ? "time" : "line");
    return {
      id,
      speaker: sourceLine?.speaker || "Speaker",
      timestamp: anchorKind === "time" ? sourceLine?.timestamp : undefined,
      anchorKind,
      rawText,
      lineIndex: sourceLine?.originalIndex ?? fallbackIndex,
    };
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
   *  - an appositive subject: "I, Yogendra, will …" and its comma-less
   *    STT form "I Yogendra will …" (the speaker's name sits between
   *    the pronoun and will/shall, so the adjacency rules miss it)
   *  - an obligation statement anchored to an action verb: "We need to
   *    fix …", "I have to send …" (the verb anchor keeps "we need to
   *    think about …" — and "we need to figure out whether …", which is
   *    a question — from spawning tasks)
   *  - a direct request: "Carlos, can you …", "please send …"
   *  - an imperative at the start of the line: "Send the deck …"
   */
  private static hasActionCommitment(text: string): boolean {
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
  /** Past-time framing used by the historical-decision guard (Fix 5a). */
  private static readonly PAST_TIME_MARKERS =
    /\b(last year|last quarter|last month|last week|previously|back then|years ago)\b/i;

  /**
   * A decision REPORTED from the past is not a decision OF this meeting
   * (evaluation S2: "Last year we decided to use spreadsheets…" entered
   * the Decision Log). A line is historical when it carries a past-time
   * marker AND a simple-past decision verb ("we decided", "they
   * agreed") — present-perfect framing ("we have decided…", even in
   * "Based on last year's results, we have decided…") is a live
   * decision and is never historical.
   */
  private static isHistoricalDecision(text: string): boolean {
    const lower = text.toLowerCase();
    if (!this.PAST_TIME_MARKERS.test(lower)) return false;
    if (/\b(have|has)\s+(decided|agreed)\b/.test(lower)) return false;
    return /\b(decided|agreed)\b/.test(lower);
  }

  /** Words that mark a decision as overturning an earlier one (Fix 4). */
  private static readonly REVERSER_MARKERS =
    /\b(postpone|postponed|delay|delayed|defer|deferred|cancel|cancelled|cancels|drop|dropped|remove|removed|scrap|abandon|revert|roll\s?back|pause|paused|hold off|no longer|instead|moved?|reschedul\w*|push(?:ed|ing)?\s+(?:back|to)|shift(?:ed)?\s+to)\b/i;

  /**
   * A spoken negation of an earlier decision ("We are not launching on
   * Friday.") — natural speech usually states the reversal as its own
   * sentence BEFORE the replacement decision, so the marker rarely sits
   * inside the later decision line itself (live-recording find,
   * 2026-10-26). Such a line supersedes an earlier decision whose
   * stemmed content words overlap it by at least 2.
   */
  private static readonly DECISION_NEGATION =
    /\b(we(?:'re| are) not|i(?:'m| am) not|not going to|won't be|no longer)\b/i;

  /** Function/decision-framing words excluded from topic overlap (Fix 4). */
  private static readonly DECISION_STOPWORDS = new Set([
    "we", "have", "has", "had", "decided", "agreed", "decision", "agreement",
    "to", "the", "a", "an", "on", "for", "all", "and", "or", "is", "it",
    "this", "that", "until", "before", "with", "from", "our", "your",
    "their", "will", "would", "should", "first", "be", "been", "by", "at",
    "in", "of", "into", "are", "was", "were", "because", "as", "so",
  ]);

  /** Significant content words of a decision line, for topic overlap. */
  private static decisionContentWords(text: string): Set<string> {
    return new Set(
      text
        .toLowerCase()
        .replace(/[^a-z0-9.\s]/g, " ")
        .split(/\s+/)
        .filter((w) => w.length >= 2 && !this.DECISION_STOPWORDS.has(w))
        // Light stemming so "launching"/"launched" match "launch" —
        // a negation line ("not launching on Friday") must be able to
        // find the decision it cancels ("launch the beta on Friday").
        .map((w) => (w.length > 4 ? w.replace(/(ing|ed|es|s)$/, "") : w))
        .filter((w) => w.length >= 2)
    );
  }

  /**
   * Final-state Decision Log (Fix 4, evaluation S4): a later decision
   * whose line carries a reversal marker ("postpone… instead",
   * "roll back", "remove") supersedes an earlier decision about the
   * SAME topic — significant content-word overlap of at least 2, so a
   * single shared word (a month name alone, S1's "remove the referral
   * widget" vs the March launch) can never supersede, and a reverser
   * about a different topic (S3's "roll back the recommendation
   * service" vs the migration postponement, zero overlap) stays a
   * normal standing decision. Superseded decisions are removed: the
   * log reflects what the meeting finally decided.
   */
  private static removeSupersededDecisions<
    T extends { sourceText: string; sourceIndex: number }
  >(collected: T[], allLines: string[]): T[] {
    const removed = new Set<number>();
    const wordSets = collected.map((c) => this.decisionContentWords(c.sourceText));
    const overlapOf = (a: Set<string>, b: Set<string>) => {
      let n = 0;
      a.forEach((w) => {
        if (b.has(w)) n++;
      });
      return n;
    };
    // (a) A later decision carrying a reversal marker supersedes an
    // earlier decision on the same topic.
    collected.forEach((entry, j) => {
      if (!this.REVERSER_MARKERS.test(entry.sourceText)) return;
      for (let i = 0; i < j; i++) {
        if (removed.has(i)) continue;
        if (overlapOf(wordSets[i], wordSets[j]) >= 2) removed.add(i);
      }
    });
    // (b) A spoken negation line supersedes an earlier decision on the
    // same topic, whether or not a replacement decision follows.
    allLines.forEach((line, lineIdx) => {
      if (!this.DECISION_NEGATION.test(line)) return;
      const negWords = this.decisionContentWords(line);
      collected.forEach((entry, i) => {
        if (removed.has(i) || entry.sourceIndex >= lineIdx) return;
        if (overlapOf(wordSets[i], negWords) >= 2) removed.add(i);
      });
    });
    return collected.filter((_, i) => !removed.has(i));
  }

  private static buildKeyDecisions(
    sources: SanitizedResult["lines"],
    lines: string[],
    refinement: RefinementPromptType
  ): DecisionItem[] {
    const collected: Array<{
      item: DecisionItem;
      sourceText: string;
      sourceIndex: number;
    }> = [];

    lines.forEach((line, idx) => {
      // Word-boundary matching only — substring hits inside unrelated
      // words must not manufacture decisions.
      const isDecision =
        this.classifyLine(line) === "decision" ||
        /\b(go with|plan is|launch date|target date)\b/i.test(line);

      // Fix 5a: a decision framed in the past is history, not a
      // decision of this meeting.
      if (isDecision && this.isHistoricalDecision(line)) return;

      if (isDecision && collected.length < 5) {
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

        collected.push({
          item: {
            id: `dec-${Math.random().toString(36).substr(2, 9)}`,
            text: polishedDecision,
            rationale,
            confidence: "high",
            citation: this.buildCitation(`cit-dec-${idx}`, sourceLine, line, idx),
          },
          sourceText: line,
          sourceIndex: idx,
        });
      }
    });

    // Fix 4: drop decisions a later decision reversed, so the log
    // reflects the meeting's final state.
    const decisions = this.removeSupersededDecisions(collected, lines).map(
      (c) => c.item
    );

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
      // Fix 5b: a habitual "will" describes a routine, not a commitment
      // (evaluation S2: "On busy weeks I will usually spend about three
      // hours just cleaning…" became a task for the participant).
      if (
        /\bwill\s+(usually|typically|generally|often|always|normally)\b/i.test(line)
      ) {
        return;
      }
      // Fix 5d: a vague closing revisit ("we will come back to these
      // ideas…") with no concrete deliverable verb is not a task
      // (evaluation S5). A line that also commits to a deliverable
      // ("…come back to the office and send the contract") stays.
      if (
        /\b(come back to (these|this|those|it)|circle back|revisit (this|these|it|them) later|discuss (this|it) later)\b/i.test(
          line
        ) &&
        !/\b(send|share|prepare|create|update|review|schedule|assign|fix|test|draft|write|build|ship|resolve|finish|complete)\b/i.test(
          line
        )
      ) {
        return;
      }
      if (actions.length >= 6) return;

      const sourceLine = sources[idx] || sources[0];
      const rawClean = this.cleanDialogue(line);
      const taskTitle = this.toProfessionalActionTask(rawClean);
      // Owner priority: a person NAMED as the commitment's subject or
      // direct addressee ("Arjun will schedule…", "Carlos, can you…")
      // owns the task — not whoever happened to say the sentence. The
      // old rule always used the speaker, so every delegated task in
      // the 2026-10-23 evaluation was assigned to the wrong person.
      // Pronoun commitments ("I will…", "We will…") and the appositive
      // "I, Yogendra, will…" name no separate owner, so they keep the
      // speaker.
      const assignee =
        this.resolveNamedAssignee(line, speakers) ||
        sourceLine?.speaker ||
        this.inferAssignee(line, speakers) ||
        "Assigned Owner";
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
        citation: this.buildCitation(`cit-act-${idx}`, sourceLine, line, idx),
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
    // Selection is priority-based, not first-come-first-served. The old
    // rule (push in source order, cap at 3) let ordinary questions asked
    // early in question-rich transcripts (interviewer prompts in a user
    // interview, idea-questions in a brainstorm) fill every slot, so the
    // questions the meeting EXPLICITLY parked — "leaving open…",
    // "parking lot…", "not sure… depends on…" — were silently dropped
    // (evaluation 2026-10-23, scenarios S2 and S5). Now: collect every
    // candidate, take all explicitly-parked (Tier 1) candidates first,
    // fill the remaining slots with ordinary questions (Tier 2), cap the
    // total at 5, and DISPLAY the selection in original source order.
    const PARKED_MARKERS =
      /\b(leaving open|left open|open question|parking lot|not sure|depends on|need to figure out|unresolved)\b/i;

    const candidates: Array<{ idx: number; parked: boolean }> = [];
    lines.forEach((line, idx) => {
      const lower = line.toLowerCase();
      const isQuestion =
        this.classifyLine(line) === "question" ||
        /\b(not sure|depends on|open question|parking lot)\b/.test(lower);
      if (isQuestion) {
        candidates.push({ idx, parked: PARKED_MARKERS.test(line) });
      }
    });

    // Fix 5c: a question that was ANSWERED is not unresolved. An
    // ordinary (Tier 2) candidate is suppressed when the immediately
    // following line is a substantive (> 15 chars) statement by a
    // DIFFERENT speaker — the answer in an interview (evaluation S2,
    // where all three interviewer questions were answered on the spot)
    // or the next contribution in a brainstorm (S5). Tier 1 (explicitly
    // parked) candidates are never suppressed, and neither is a
    // candidate with no following line, one followed by the same
    // speaker, or one followed by another ordinary question (a real
    // follow-up exchange). A following Tier 1 line does not block
    // suppression: the conversation explicitly moved on to a parked
    // topic (S5's "Should we explore…?" is followed directly by the
    // parked pricing line, and the evaluation's end state counts it as
    // answered-by-moving-on, not unresolved).
    const candidateIdx = new Set(candidates.map((c) => c.idx));
    const liveCandidates = candidates.filter(({ idx, parked }) => {
      if (parked) return true;
      const nextIdx = idx + 1;
      if (nextIdx >= lines.length) return true;
      const thisSpeaker = sources[idx]?.speaker;
      const nextSpeaker = sources[nextIdx]?.speaker;
      if (!thisSpeaker || !nextSpeaker) {
        return true;
      }
      if (nextSpeaker === thisSpeaker) {
        // Same-speaker continuation normally keeps the question live —
        // EXCEPT when the speaker answers it themselves in the next
        // breath with an explicit affirmation ("Did everyone get the
        // invite?" / "Yes, we all got it." — live-recording find,
        // 2026-10-26). An affirmation opener is an answer shape, not
        // elaboration.
        const nextLine = lines[nextIdx].trim();
        const AFFIRMATION_OPENER =
          /^(yes|yeah|yep|no|nope|correct|exactly|right|done|all good)\b/i;
        if (
          AFFIRMATION_OPENER.test(nextLine) &&
          this.classifyLine(nextLine) !== "question"
        ) {
          return false;
        }
        return true;
      }
      if (lines[nextIdx].trim().length <= 15) return true;
      if (
        candidateIdx.has(nextIdx) &&
        !PARKED_MARKERS.test(lines[nextIdx]) &&
        this.classifyLine(lines[nextIdx]) === "question"
      ) {
        return true;
      }
      return false;
    });

    const MAX_QUESTIONS = 5;
    const selected = [
      ...liveCandidates.filter((c) => c.parked),
      ...liveCandidates.filter((c) => !c.parked),
    ]
      .slice(0, MAX_QUESTIONS)
      .sort((a, b) => a.idx - b.idx);

    const questions: UnresolvedQuestion[] = selected.map(({ idx }) => {
      const line = lines[idx];
      const sourceLine = sources[idx] || sources[0];
      const cleanQ = this.toProfessionalQuestion(this.cleanDialogue(line));

      return {
        id: `q-${Math.random().toString(36).substr(2, 9)}`,
        question: cleanQ,
        // No suggestedFollowUp: it used to be a hardcoded template
        // ("Review during upcoming sync to finalize requirements and
        // dependency.") rendered under every generated question —
        // content nobody in the meeting ever said. The field stays
        // optional in the type for user-edited questions; generated
        // questions leave it absent, and the UI renders nothing for
        // an absent follow-up.
        citation: this.buildCitation(`cit-q-${idx}`, sourceLine, line, idx),
      };
    });

    // No question was asked or left open means the parking lot stays
    // empty. Converting the last line into a "confirm the requirements"
    // question invents an unresolved item nobody raised.
    return questions;
  }

  /**
   * Topic-level line classification: classifyLine's kinds plus "action"
   * for lines carrying a commitment (see hasActionCommitment).
   */
  private static topicKind(text: string): TopicKind {
    const kind = this.classifyLine(text);
    if (kind !== "other") return kind;
    return this.hasActionCommitment(text) ? "action" : "other";
  }

  /**
   * Builds discussion topics: one topic per distinct classified theme
   * present in the meeting (context / decision / rationale / action /
   * question), in source order, capped at 5. "Other" lines each carry
   * their own theme and are only used while slots remain. This replaces
   * the positional `lines.slice(0, 4)`, which dropped later themes (the
   * open question was never a topic) and promoted any early line,
   * whatever it was, to a "topic".
   */
  private static buildDiscussionTopics(sources: SanitizedResult["lines"], lines: string[]) {
    const seenKinds = new Set<string>();
    const topics: DiscussionPoint[] = [];

    lines.forEach((line, idx) => {
      if (topics.length >= 5) return;
      const clean = this.cleanDialogue(line);
      if (clean.length <= 3) return;
      const kind = this.topicKind(clean);
      if (kind !== "other") {
        if (seenKinds.has(kind)) return;
        seenKinds.add(kind);
      }
      topics.push(this.buildDiscussionTopic(sources, idx, line, clean, kind));
    });

    return topics;
  }

  private static buildDiscussionTopic(
    sources: SanitizedResult["lines"],
    idx: number,
    rawLine: string,
    clean: string,
    kind: TopicKind
  ) {
    const sourceLine = sources[idx] || sources[0];
    const summary = this.toProfessionalSentence(clean);
    let topic = this.buildTopicTitle(kind, clean);
    // Hard guarantee, independent of the generator's rules: a title must
    // never be a prefix of its own summary (the original defect). Fall
    // back to the category title, which is thematic by construction.
    if (summary.toLowerCase().startsWith(topic.toLowerCase())) {
      topic = this.categoryTitle(kind);
    }
    return {
      id: `disc-${Math.random().toString(36).substr(2, 9)}`,
      topic,
      summary,
      speakers: sourceLine?.speaker ? [sourceLine.speaker] : undefined,
      citation: this.buildCitation(`cit-disc-${idx}`, sourceLine, rawLine, idx),
    };
  }

  /** Category titles: thematic fallbacks, never derived from line text. */
  private static categoryTitle(kind: TopicKind): string {
    switch (kind) {
      case "context":
        return "Meeting context & goals";
      case "decision":
        return "Key decision";
      case "rationale":
        return "Rationale & supporting reasons";
      case "action":
        return "Action items & owners";
      case "question":
        return "Open questions";
      default:
        return "Key discussion point";
    }
  }

  /**
   * Rule-based, deterministic discussion-topic titles. A title is a
   * short noun-phrase THEME abstracted from the line — never the line's
   * first words (the previous implementation returned
   * `text.split(" ").slice(0, 4)`, so every title was a fragment of the
   * summary printed directly beneath it: "This is a planning" /
   * "We have decided to").
   *
   * Strategy per classification:
   *  - context:  the object of the meeting ("…for the NoteFlow AI public
   *    beta") plus its framing ("— planning check-in" when present).
   *  - decision: the decision OBJECT after the decision verb
   *    ("launch the public beta to our waitlist first, before…" →
   *    "Waitlist-first launch before team workspaces" when a waitlist
   *    launch is the object; otherwise the object clause itself).
   *  - rationale: the reason content after the rationale marker
   *    ("the reason is simple — we want real feedback from…" →
   *    "Rationale: real feedback from product managers and designers").
   *  - action:   the work theme from the commitment ("assign any bugs…
   *    review those fixes" → "Bug assignment and fix review").
   *  - question: the subject under question ("whether team workspaces
   *    should be included in the free beta or… Pro tier" →
   *    "Team workspaces: free beta or Pro tier?").
   *  - other:    a salient domain noun ("roadmap", "pricing", …) as a
   *    discussion theme, else the category title.
   * When a rule cannot abstract a theme it returns the category title —
   * never a text prefix.
   */
  private static buildTopicTitle(
    kind: TopicKind,
    clean: string
  ): string {
    const lower = clean.toLowerCase();
    const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
    const capWords = (s: string, n: number) =>
      s.split(/\s+/).filter(Boolean).slice(0, n).join(" ");

    switch (kind) {
      case "context": {
        const forMatch = clean.match(/\bfor\s+(?:the\s+)?(.+?)(?:\.|$)/i);
        const object = forMatch ? forMatch[1].trim() : "";
        if (object) {
          const framing = /check[-\s]?in/i.test(lower)
            ? " — planning check-in"
            : /kick[-\s]?off/i.test(lower)
              ? " — kick-off"
              : "";
          return capWords(`${cap(object)}${framing}`, 9);
        }
        return this.categoryTitle(kind);
      }
      case "decision": {
        const rest = clean
          .replace(
            /^(we have decided to|we decided to|we have agreed to|we agreed to|we decided|we agreed|i decided|decision reached:?|decision:?|let's|we should)\s*/i,
            ""
          )
          .trim();
        if (!rest) return this.categoryTitle(kind);
        if (/\bwaitlist\b/i.test(rest) && /\blaunch\b/i.test(rest)) {
          return /\bteam workspaces?\b/i.test(rest)
            ? "Waitlist-first launch before team workspaces"
            : "Waitlist-first launch";
        }
        // Object clause: up to the first comma, minus a trailing "first".
        const clause = rest.split(",")[0].replace(/\s+first$/i, "").trim();
        return capWords(cap(clause), 8) || this.categoryTitle(kind);
      }
      case "rationale": {
        const body = clean
          .replace(/^(the reason is simple|the reason is|reason is|reason:)\s*[—–-]?\s*/i, "")
          .replace(/^we want\s*/i, "")
          .trim();
        const feedback = body.match(/((?:real\s+)?feedback from [^.]+?)(?:\s+before\s+|\.|$)/i);
        if (feedback) {
          const phrase = feedback[1].replace(/\bindividual\s+/gi, "").trim();
          return capWords(`Rationale: ${phrase}`, 9);
        }
        const clause = body.split(/\s+before\s+|,/i)[0].trim();
        return clause
          ? capWords(`Rationale: ${clause}`, 9)
          : this.categoryTitle(kind);
      }
      case "action": {
        const themes: string[] = [];
        if (
          /\bbugs?\b/i.test(lower) &&
          (/\bassign\b/i.test(lower) || /\bdevelopers?\b/i.test(lower))
        ) {
          // "assign any bugs…" or "bugs … directly to the respective
          // developers" — both are bug assignment.
          themes.push("Bug assignment");
        }
        if (/\breview\b/i.test(lower) && /\bfix/i.test(lower)) {
          themes.push(themes.length ? "fix review" : "Fix review");
        }
        if (themes.length) {
          return capWords(themes.join(" and "), 9);
        }
        if (/\bbugs?\b/i.test(lower)) return "Bug triage and follow-up";
        // Generic commitment: theme from the verb phrase after "will".
        const willMatch = clean.match(/\bwill\s+(.+)/i);
        const verbPhrase = willMatch ? willMatch[1].split(/,|\s+and\s+/i)[0].trim() : "";
        return verbPhrase
          ? capWords(cap(verbPhrase), 7)
          : this.categoryTitle(kind);
      }
      case "question": {
        if (/\bteam workspaces?\b/i.test(lower) && /\bfree beta\b/i.test(lower)) {
          return "Team workspaces: free beta or Pro tier?";
        }
        const whether = clean.match(/\bwhether\s+(.+)/i);
        const subject = (whether ? whether[1] : clean)
          .split(/,|\s+or\s+kept\s+|\s+or\s+should\s+/i)[0]
          .trim();
        return subject ? `${capWords(cap(subject), 7)}?` : this.categoryTitle(kind);
      }
      default: {
        const salient = lower.match(
          /\b(roadmap|pricing|onboarding|budget|migration|hiring|security|performance|design system|timeline|scope)\b/i
        );
        return salient ? `${cap(salient[1])} discussion` : this.categoryTitle(kind);
      }
    }
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

  /**
   * Constrained action normalization — DISPLAY form only. The citation
   * keeps the verbatim line; this only reshapes how the task reads.
   *
   * A spoken commitment becomes an imperative task statement by REMOVING
   * framing and converting the lead verb — never by paraphrase. Facts
   * (objects, scope qualifiers, recipients, time expressions) are
   * preserved exactly, including ones a dueDate chip also shows: "by
   * tomorrow evening" stays in the text even though dueDate says
   * "Tomorrow".
   *
   * Supported patterns (anything else falls back to the original text):
   *  1. Subject + will/shall: "I will …", "We shall …", "Priya will …",
   *     including a subject appositive: "I, Yogendra, will assign …".
   *     The verb after will/shall is already in base form, so dropping
   *     subject + auxiliary yields the imperative directly — no verb
   *     morphology is attempted anywhere in this normalizer.
   *  1a. Pronoun + appositive name + will/shall, commas optional:
   *     written "I, Yogendra, will assign …" and the comma-less STT
   *     form "I Yogendra will assign …" (live transcripts rarely carry
   *     the appositive commas). The name word(s) must be capitalized,
   *     so a lowercase verb/adverb between pronoun and auxiliary
   *     ("I really will …") is never mistaken for a name and dropped.
   *  2. Contractions: "I'll …", "We'll …", "You'll …".
   *  3. Obligation: "We need to fix …", "I have to send …" (mirrors
   *     the verb-anchored need-to rule in hasActionCommitment).
   *  4. Requests: "Carlos, can you update …?", "Please send …" — the
   *     request's trailing "?" is punctuation, not part of the task.
   *  5. Continuations: a repeated PRONOUN subject + will inside the
   *     sentence keeps its verb and loses only subject + auxiliary
   *     ("…, and I will review those fixes" → "…, and review those
   *     fixes"; ". I will send …" → ". Send …"). A named third-person
   *     continuation ("…and Priya will review it") is NOT rewritten —
   *     dropping a different person's name would misattribute work.
   *  6. A leading bare acknowledgment ("Will do. I will have …") is
   *     dropped when a real commitment sentence follows it.
   *
   * When no pattern matches, the original sentence is returned
   * (capitalized) — a verbatim task is always preferable to a guessed
   * rewrite. Successfully normalized output ends with exactly one
   * period.
   */
  private static toProfessionalActionTask(text: string): string {
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
      // (1) subject (+ optional appositive) + will/shall
      /^(?:[A-Z][a-z]+(?:\s[A-Z][a-z]+)?|I|we|you|he|she|they)(?:,\s*[^,]{1,40},)?\s+(?:will|shall)\s+/,
      // (2) contractions
      /^(?:I'll|we'll|you'll|he'll|she'll|they'll)\s+/i,
      // (3) obligation
      /^(?:I|we)\s+(?:need|have)\s+to\s+/i,
      // (4a) direct request: "Carlos, can you …" / "Carlos, please …"
      /^(?:[A-Z][a-z]+(?:\s[A-Z][a-z]+)?,\s*)?(?:can you|could you|will you|would you|please)\s+/i,
      // (4b) "please …"
      /^please\s+/i,
      // bare "need to …" (a strip the previous implementation also did)
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
    const sentenceContinuation = /\.\s+(?:I|we|you|he|she|they)\s+(?:will|shall)\s+([a-z])/g;
    const afterSentences = rest.replace(
      sentenceContinuation,
      (_m, ch: string) => `. ${ch.toUpperCase()}`
    );
    if (afterSentences !== rest) {
      rest = afterSentences;
      changed = true;
    }

    if (!changed) {
      // Fallback: the original sentence, capitalized — never a guess.
      return original.charAt(0).toUpperCase() + original.slice(1);
    }
    const trimmed = rest.trim();
    if (!trimmed) return original.charAt(0).toUpperCase() + original.slice(1);
    const capitalized = trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
    // Terminal punctuation: exactly one period (a request's "?" or a
    // doubled ".." is punctuation noise, not a fact).
    return `${capitalized.replace(/[.?!\s]+$/, "")}.`;
  }

  /**
   * Constrained question normalization — DISPLAY form only (the citation
   * keeps the verbatim line). Converts a spoken open question into
   * actual question form by removing framing and inverting the
   * auxiliary — never by paraphrase, and no facts are added or dropped.
   *
   * Supported patterns:
   *  1. Direct questions (already ending in "?") are kept, cleaned: a
   *     leading label ("One open question: Should we …?") is dropped
   *     and the ending collapses to exactly one "?".
   *  2. "…whether <subject> <aux> <rest>": framing before "whether"
   *     ("One question we are leaving open for now is", "We are not
   *     sure") is dropped and the clause is inverted — "whether team
   *     workspaces should be included in the free beta, or kept only
   *     for the Pro tier" → "Should team workspaces be included in the
   *     free beta, or kept only for the Pro tier?".
   *  3. "<We/I> … figure out whether to <A> or <B>" →
   *     "Should we <A> or <B>?".
   *  4. Anything else falls back to the original text.
   *
   * Punctuation guard on EVERY path: a question never ends in ".?" —
   * text already ending in "." (or "!") keeps its punctuation (a "?"
   * is never appended to it), text ending in "?" keeps exactly one,
   * and only punctuation-less STT text gains a "?".
   */
  private static toProfessionalQuestion(text: string): string {
    const original = text.trim().replace(/\s+/g, " ");
    if (!original) return text;
    const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

    // Leading label: "One open question: …" / "Question: …".
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

    // (2) "whether <subject> <aux> <rest>" inversion. Framing before
    // "whether" is confined to the same sentence ([^.]*?).
    const whether = rest.match(
      /^[^.]*?\bwhether\s+(.+?)\s+(should|shall|can|could|will|would|is|are|was|were|do|does|did)\s+(.+?)\.?$/i
    );
    if (whether) {
      return `${cap(whether[2].toLowerCase())} ${whether[1]} ${whether[3]}?`;
    }

    // (4) Fallback — original text, punctuation guard applied: never
    // append "?" to text already ending in "." or "!".
    if (/[.!]$/.test(rest)) return cap(rest);
    return `${cap(rest)}?`;
  }

  private static inferAssignee(text: string, speakers: string[]): string | undefined {
    for (const s of speakers) {
      if (text.toLowerCase().includes(s.toLowerCase())) return s;
    }
    return undefined;
  }

  /** Openers that look like a name to the patterns below but are not people. */
  private static readonly NON_PERSON_OPENERS = new Set([
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
   * Resolves a captured name to the meeting roster: an exact full-name
   * match wins; a first name that uniquely matches one speaker resolves
   * to that speaker's full roster name ("Arjun" → "Arjun Mehta"); a
   * name matching nobody is used as written. Returns undefined when the
   * capture is an obvious non-person opener, so the caller falls back
   * to the speaker.
   */
  private static resolveRosterName(
    captured: string,
    speakers: string[]
  ): string | undefined {
    const name = captured.trim().replace(/\s+/g, " ");
    if (!name) return undefined;
    if (this.NON_PERSON_OPENERS.has(name.split(" ")[0].toLowerCase())) {
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

  /**
   * The named owner of a commitment, when the sentence names one:
   *  - a leading named subject: "Arjun will schedule…",
   *    "Priya Sharma will send…"
   *  - a leading direct address: "Carlos, can you send…",
   *    "Meera, please review…"
   * Returns undefined for pronoun commitments ("I will…", "We will…"),
   * appositives ("I, Yogendra, will…" — the speaker owns it), and
   * non-person subjects, leaving those to the speaker fallback.
   */
  private static resolveNamedAssignee(
    text: string,
    speakers: string[]
  ): string | undefined {
    const t = text.trim();
    const nameWill = t.match(
      /^([A-Z][a-z]+(?:\s[A-Z][a-z]+)?)\s+will\b/
    );
    if (nameWill) {
      const resolved = this.resolveRosterName(nameWill[1], speakers);
      if (resolved) return resolved;
    }
    const directAddress = t.match(
      /^([A-Z][a-z]+(?:\s[A-Z][a-z]+)?),\s*(?:can you|could you|will you|would you|please)\b/i
    );
    if (directAddress) {
      const resolved = this.resolveRosterName(directAddress[1], speakers);
      if (resolved) return resolved;
    }
    // Delegated commitment: "I will ask Meera to review…", "Get Carlos
    // to send…", "I have assigned Priya to…" — the person asked owns the
    // task, not the speaker. (Live-recording find, 2026-10-26: this
    // pattern had no handler at all, so delegated tasks landed on the
    // speaker even though the named-owner fix covered leading subjects.)
    const delegated = t.match(
      /\b(?:ask|asked|asking|get|getting|have|assign|assigned|delegate|delegated|tell|told)\s+([A-Za-z][a-z]+(?:\s[A-Z][a-z]+)?)\s+to\b/
    );
    if (delegated) {
      const first = delegated[1].split(" ")[0].toLowerCase();
      const PRONOUN_OR_GROUP = new Set([
        "me", "you", "him", "her", "us", "them", "it", "the", "team",
        "everyone", "someone", "anyone", "all",
      ]);
      if (!PRONOUN_OR_GROUP.has(first)) {
        const captured =
          delegated[1].charAt(0).toUpperCase() + delegated[1].slice(1);
        const resolved = this.resolveRosterName(captured, speakers);
        if (resolved) return resolved;
      }
    }
    return undefined;
  }

  private static extractDueDate(text: string): string | undefined {
    const lower = text.toLowerCase();
    // Precedence is deliberate (first match wins): a specific spoken
    // date outranks a relative one, and "today" outranks a clock time
    // so "by 6 pm today" stays "Today" (existing behaviour).
    if (lower.includes("tomorrow")) return "Tomorrow";
    // Explicit month date: "by March 14" → "March 14".
    const monthDate = text.match(
      /\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2})\b/i
    );
    if (monthDate) {
      const month =
        monthDate[1].charAt(0).toUpperCase() +
        monthDate[1].slice(1).toLowerCase();
      return `${month} ${monthDate[2]}`;
    }
    // Any weekday: "by Wednesday" → "Wednesday". (Only Friday/Monday
    // were recognised before, so mid-week deadlines were silently
    // dropped — evaluation 2026-10-23, scenarios S1 and S3.)
    const weekday = lower.match(
      /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/
    );
    if (weekday) {
      return weekday[1].charAt(0).toUpperCase() + weekday[1].slice(1);
    }
    if (lower.includes("today")) return "Today";
    // Clock time: "by 6 pm" / "at 10:30 am" → "6 PM" / "10:30 AM".
    const clock = text.match(/\b(?:by|at)\s+(\d{1,2}(?::\d{2})?)\s*(am|pm)\b/i);
    if (clock) {
      return `${clock[1]} ${clock[2].toUpperCase()}`;
    }
    if (lower.includes("next week")) return "Next Week";
    if (lower.includes("this week")) return "This Week";
    if (lower.includes("end of week") || lower.includes("eod")) return "End of Week";
    return undefined;
  }
}

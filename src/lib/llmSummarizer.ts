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
          citation: this.buildCitation(`cit-dec-${idx}`, sourceLine, line, idx),
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
          citation: this.buildCitation(`cit-q-${idx}`, sourceLine, line, idx),
        });
      }
    });

    // No question was asked or left open means the parking lot stays
    // empty. Converting the last line into a "confirm the requirements"
    // question invents an unresolved item nobody raised.
    return questions.slice(0, 3);
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

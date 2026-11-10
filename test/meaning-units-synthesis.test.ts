/**
 * Regression suite: meaning-unit synthesis (2026-11-10).
 *
 * From the first fully-Deepgram live retest (green badge, accurate
 * words) whose summary was still wrong in six ways:
 *  1. The Decision Log held the ANNOUNCEMENT ("Agreed to the decision
 *     is this") instead of the decision it announced — recognizers end
 *     announcements with a full stop, the merge pass never joins across
 *     terminal punctuation, and the extractor harvested line-by-line.
 *  2. A vocative imperative task ("Deepak, book the usability lab…")
 *     matched no commitment pattern and silently vanished.
 *  3. The parking lot counted the question ANNOUNCEMENT ("There's one
 *     more open question.") as a question, and split one question into
 *     two cards via its confirmation check ("Is it confirmed?").
 *  4. Citation badges numbered lines by RAW input position
 *     (originalIndex) while the source drawer numbers SANITIZED lines —
 *     with multi-sentence recognizer utterances the badges drifted up
 *     to 3 lines behind the panel for the same sentence.
 *  5. The meeting was titled by a category label ("Key decision")
 *     because the title guard rejected any candidate whose words
 *     appeared inside a transcript line — which is where topic
 *     keywords live. Titles now come from the topic announcement's
 *     keywords ("Quick sync on the mobile app redesign." → "Mobile
 *     App Redesign").
 *  6. Executive summary + discussion topics echoed the first lines:
 *     the greeting was a "Key discussion point" and a "Key Highlight".
 *     The summary is now composed from the extracted items, and
 *     greetings/fragments are not topics.
 */
import { sanitizeTranscript } from "../src/lib/transcriptSanitizer";
import { GenerativeSummarizer } from "../src/lib/llmSummarizer";
import { processMeetingWithAI } from "../src/lib/aiEngine";
import { SummaryService } from "../server/services/summaryService";

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean, extra?: unknown) {
  if (cond) {
    passed++;
    console.log(`  PASS ${name}`);
  } else {
    failed++;
    console.log(`  FAIL ${name}`, extra !== undefined ? JSON.stringify(extra) : "");
  }
}

const LINES = [
  "Thanks, everyone.",
  "Quick sync on the mobile app redesign.",
  "First question, are we launching Android only or iOS two?",
  "Before that, last month, we skipped the referral program.",
  "Let's not revisit that today.",
  "The decision is this.",
  "We open the waitlist on the December 1.",
  "Ananya, please send the onboarding emails by Friday.",
  "Deepak, book the usability lab for November 14.",
  "I will ask Faran to build the new prototype.",
  "Get Lina to finish the payment screen by Thursday.",
  "There's one more open question.",
  "Which payment gateway handles refunds?",
  "And is the lab even available on fourteenth?",
  "Is it confirmed?",
  "Not yet.",
  "Right?",
  "Okay.",
  "Dark mode would be nice someday.",
  "Let's think about it later.",
  "Now what about the checkout screens?",
  "Are they done?",
  "Oh, those shipped last week.",
  "That's great.",
  "At some point, we should send the finding around.",
  "That's all for today.",
];

async function main() {
  console.log("== Client engine: the 2026-11-10 live transcript ==");
  const raw = LINES.map((t, i) => `You [00:${String(i * 4).padStart(2, "0")}]: ${t}`).join("\n");
  const { title, analysis } = await processMeetingWithAI(raw, "standard", () => {});

  check("title comes from the topic keywords", title === "Mobile App Redesign", title);

  check("exactly 1 decision", analysis.decisions.length === 1, analysis.decisions);
  check(
    "decision text is the announced content, not the announcement",
    /waitlist/i.test(analysis.decisions[0]?.text || "") &&
      !/decision is this/i.test(analysis.decisions[0]?.text || ""),
    analysis.decisions[0]?.text
  );

  check("exactly 4 tasks", analysis.actionItems.length === 4, analysis.actionItems.map((a) => a.task));
  const deepak = analysis.actionItems.find((a) => a.assignee === "Deepak");
  check("vocative imperative task exists for Deepak", Boolean(deepak), analysis.actionItems.map((a) => a.assignee));
  check("Deepak's due date is November 14", deepak?.dueDate === "November 14", deepak?.dueDate);

  check(
    "exactly 3 open questions",
    analysis.unresolvedQuestions.length === 3,
    analysis.unresolvedQuestions.map((q) => q.question)
  );
  check(
    "question announcement is not a question",
    !analysis.unresolvedQuestions.some((q) => /one more open question/i.test(q.question))
  );
  check(
    "confirmation check folded into its parent question",
    !analysis.unresolvedQuestions.some((q) => /^is it confirmed/i.test(q.question))
  );
  check(
    "answered checkout exchange is not unresolved",
    !analysis.unresolvedQuestions.some((q) => /checkout/i.test(q.question))
  );
  check(
    "tag check is not a question",
    !analysis.unresolvedQuestions.some((q) => /^right\??$/i.test(q.question.trim()))
  );

  check(
    "greeting is not a discussion topic",
    !analysis.importantDiscussionPoints.some((p) => /thanks, everyone/i.test(p.summary))
  );
  check(
    "summary leads with the decision, not the greeting",
    /waitlist/i.test(analysis.executiveSummary) &&
      !/thanks, everyone/i.test(analysis.executiveSummary),
    analysis.executiveSummary
  );

  console.log("== Citations: badge numbers match the displayed (sanitized) lines ==");
  // Multi-sentence raw lines: the recognizer blob case that made
  // originalIndex drift behind the sanitized numbering.
  const blob =
    "You [00:00]: The decision is this. We open the waitlist on the December 1. Ananya, please send the onboarding emails by Friday. Deepak, book the usability lab for November 14.";
  const san = sanitizeTranscript(blob);
  const sum = GenerativeSummarizer.synthesize(san, "standard");
  const allItems = [...sum.decisions, ...sum.actionItems];
  check("blob transcript still yields the decision + both tasks", allItems.length === 3, allItems);
  for (const item of allItems) {
    const cit = (item as any).citation;
    const displayed = san.lines[cit.lineIndex];
    check(
      `citation lineIndex resolves to its own rawText (${cit.rawText.slice(0, 30)}…)`,
      Boolean(displayed) && displayed.text === cit.rawText,
      { lineIndex: cit.lineIndex, displayed: displayed?.text, rawText: cit.rawText }
    );
  }

  console.log("== Server mirror (SummaryService) ==");
  const segments = LINES.map((text, i) => ({
    lineIndex: i,
    speaker: "You",
    timestamp: `00:${String(i * 4).padStart(2, "0")}`,
    text,
  }));
  const server = new SummaryService().generateSummary({
    meetingId: "meet-meaning-units-test",
    rawVtt: "",
    sanitizedText: LINES.join(" "),
    detectedSpeakers: ["You"],
    durationSeconds: 104,
    segments,
  } as any);
  check(
    "server: decision is the announced content",
    server.decisions.some((d) => /waitlist/i.test(d.text)) &&
      !server.decisions.some((d) => /decision is this/i.test(d.text)),
    server.decisions.map((d) => d.text)
  );
  check(
    "server: Deepak's vocative task exists",
    server.actionItems.some((a) => a.assignee === "Deepak"),
    server.actionItems.map((a) => a.assignee)
  );
  check(
    "server: question announcement + confirmation check excluded",
    !server.unresolvedQuestions.some((q) => /one more open question/i.test(q.question)) &&
      !server.unresolvedQuestions.some((q) => /^is it confirmed/i.test(q.question)),
    server.unresolvedQuestions.map((q) => q.question)
  );

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}

main();

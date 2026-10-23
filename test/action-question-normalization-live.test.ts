/**
 * Regression suite: Normalization on LIVE (STT) transcripts
 *
 * Sibling to action-question-normalization.test.ts (round 4), which
 * pins the punctuated / pasted-note forms. This suite pins the defect
 * from the user's 2026-10-23 14:06 IST live test — after all four fix
 * rounds were merged: he created a meeting, spoke the clean 5-line
 * script, and the Action Item came out VERBATIM again:
 *
 *   "I Yogendra will assign any bugs we find during end to and testing
 *    today directly to the respective developers and review those
 *    fixes by tomorrow evening."
 *
 * (Detection, assignee @You and Due: Tomorrow all worked in his run;
 * only the display-text normalization did not fire.)
 *
 * Live STT text differs from the pasted script in exactly the ways
 * that defeated round 4:
 *  - NO commas: the appositive is comma-less ("I Yogendra will …",
 *    not "I, Yogendra, will …") and the second clause drops its
 *    subject ("… and review those fixes …", not "… and I will
 *    review …" — the clause round-4 detection silently relied on).
 *  - STT word garble is preserved as content: "end-to-end" arrived as
 *    "end to and". Normalization must reshape framing ONLY — it must
 *    never rewrite content words.
 *
 * Root causes pinned here (both synthesizers shared the logic):
 *  1. Detection (hasActionCommitment): no rule matched a subject
 *     separated from will/shall by an appositive name — the pronoun
 *     rule needs pronoun+will adjacency, the name rule needs the name
 *     at line start with will immediately after. Even the COMMA form
 *     ("I, Yogendra, will assign …") was undetectable without a
 *     second "will" clause elsewhere in the line.
 *  2. Normalization (lead pattern 1): the appositive group required
 *     surrounding commas, so the comma-less lead never stripped; when
 *     detection fired via another clause, the task stayed verbatim.
 *
 * The fix adds a comma-optional appositive rule to detection and a
 * matching lead pattern (1a) to the normalizer, in BOTH
 * src/lib/llmSummarizer.ts (the path the app displays: useMeetRecord
 * → meetSummaryBridge → aiEngine → GenerativeSummarizer) and
 * server/services/summaryService.ts (server stop/summary endpoints).
 * The intervening name word(s) must be capitalized — a lowercase verb
 * or adverb in that slot is never treated as a name.
 */

import { sanitizeTranscript } from "../src/lib/transcriptSanitizer";
import { GenerativeSummarizer } from "../src/lib/llmSummarizer";
import { SummaryService } from "../server/services/summaryService.js";
import { sttService } from "../server/services/sttService.js";

function assert(condition: boolean, msg: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${msg}`);
  }
}

let passed = 0;
let total = 0;

function runTest(name: string, fn: () => void | Promise<void>) {
  total++;
  return Promise.resolve()
    .then(fn)
    .then(() => {
      passed++;
      console.log(`[PASS] ✅ ${name}`);
    })
    .catch((err: any) => {
      console.error(`[FAIL] ❌ ${name}:`, err.message);
    });
}

// The EXACT sentence from the user's 14:06 screenshot (comma-less,
// "end to and" is the STT rendering of "end-to-end" and is content).
const SCREENSHOT_ACTION =
  "I Yogendra will assign any bugs we find during end to and testing today directly to the respective developers and review those fixes by tomorrow evening";
const EXPECTED_LIVE_ACTION =
  "Assign any bugs we find during end to and testing today directly to the respective developers and review those fixes by tomorrow evening.";
// Same line with the round-4 continuation clause present.
const SCREENSHOT_ACTION_WITH_CONTINUATION =
  "I Yogendra will assign any bugs we find during end to and testing today directly to the respective developers and I will review those fixes by tomorrow evening";

// The full clean script as live STT actually delivers it: minimal
// punctuation, no commas anywhere.
const LIVE_LINES = [
  "This is a planning check in for the NoteFlow AI public beta",
  "We have decided to launch the public beta to our waitlist first before we build team workspaces",
  "The reason is simple we want real feedback from individual product managers and designers before we add shared workspaces for teams",
  SCREENSHOT_ACTION,
  "One question we are leaving open for now is whether team workspaces should be included in the free beta or kept only for the Pro tier",
];
const LIVE_TIMES = ["00:05", "00:16", "00:31", "01:02", "01:19"];
const EXPECTED_LIVE_DECISION =
  "Agreed to launch the public beta to our waitlist first before we build team workspaces";
const EXPECTED_QUESTION =
  "Should team workspaces be included in the free beta or kept only for the Pro tier?";

const LIVE_RECORDER = LIVE_LINES.map((l, i) => `You [${LIVE_TIMES[i]}]: ${l}`).join("\n");
const LIVE_PLAIN = LIVE_LINES.map((l) => `You: ${l}`).join("\n");

function synthesizeClient(raw: string) {
  return GenerativeSummarizer.synthesize(sanitizeTranscript(raw), "standard");
}

function serverSummaryFromSegments(texts: string[], speaker = "You") {
  const segments = texts.map((text, i) => ({
    lineIndex: i,
    speaker,
    timestamp: LIVE_TIMES[i] || "00:00",
    text,
  }));
  return new SummaryService().generateSummary({
    meetingId: "meet-normalization-live-test",
    rawVtt: "",
    sanitizedText: texts.join(" "),
    detectedSpeakers: [speaker],
    durationSeconds: 90,
    segments,
  } as any);
}

async function main() {
  console.log("=================================================");
  console.log("  REGRESSION: NORMALIZATION ON LIVE TRANSCRIPTS  ");
  console.log("=================================================");

  // --- Client path (what the app displays) ---

  await runTest("Client: exact screenshot sentence (recorder format) normalizes", () => {
    const result = synthesizeClient(`You [01:02]: ${SCREENSHOT_ACTION}`);
    assert(result.actionItems.length === 1, `Expected 1 action, got ${result.actionItems.length}`);
    assert(
      result.actionItems[0].task === EXPECTED_LIVE_ACTION,
      `Task must be exactly "${EXPECTED_LIVE_ACTION}", got "${result.actionItems[0].task}"`
    );
    assert(
      result.actionItems[0].assignee === "You",
      `Assignee must be the segment speaker "You", got "${result.actionItems[0].assignee}"`
    );
    assert(
      result.actionItems[0].dueDate === "Tomorrow",
      `Due date must be "Tomorrow", got "${result.actionItems[0].dueDate}"`
    );
    assert(
      result.actionItems[0].citation?.rawText.includes("I Yogendra will assign"),
      "Citation must keep the verbatim comma-less line"
    );
    assert(
      result.actionItems[0].task.includes("end to and"),
      'STT content words must be preserved as spoken ("end to and"), never silently corrected'
    );
  });

  await runTest("Client: screenshot sentence WITH 'and I will review' continuation also normalizes", () => {
    const result = synthesizeClient(`You [01:02]: ${SCREENSHOT_ACTION_WITH_CONTINUATION}`);
    assert(result.actionItems.length === 1, `Expected 1 action, got ${result.actionItems.length}`);
    assert(
      result.actionItems[0].task === EXPECTED_LIVE_ACTION,
      `Task must be exactly "${EXPECTED_LIVE_ACTION}", got "${result.actionItems[0].task}"`
    );
  });

  await runTest("Client: full 5-line comma-less transcript (recorder format) → 1 decision, 1 normalized action, 1 normalized question", () => {
    const result = synthesizeClient(LIVE_RECORDER);
    assert(result.decisions.length === 1, `Expected 1 decision, got ${result.decisions.length}`);
    assert(
      result.decisions[0].text === EXPECTED_LIVE_DECISION,
      `Decision must be "${EXPECTED_LIVE_DECISION}", got "${result.decisions[0].text}"`
    );
    assert(result.actionItems.length === 1, `Expected 1 action, got ${result.actionItems.length}`);
    assert(
      result.actionItems[0].task === EXPECTED_LIVE_ACTION,
      `Task must be exactly "${EXPECTED_LIVE_ACTION}", got "${result.actionItems[0].task}"`
    );
    assert(result.unresolvedQuestions.length === 1, `Expected 1 question, got ${result.unresolvedQuestions.length}`);
    assert(
      result.unresolvedQuestions[0].question === EXPECTED_QUESTION,
      `Question must be exactly "${EXPECTED_QUESTION}", got "${result.unresolvedQuestions[0].question}"`
    );
  });

  await runTest("Client: full 5-line comma-less transcript ('You:' format) → same extraction", () => {
    const result = synthesizeClient(LIVE_PLAIN);
    assert(result.decisions.length === 1, `Expected 1 decision, got ${result.decisions.length}`);
    assert(result.actionItems.length === 1, `Expected 1 action, got ${result.actionItems.length}`);
    assert(
      result.actionItems[0].task === EXPECTED_LIVE_ACTION,
      `Task must be exactly "${EXPECTED_LIVE_ACTION}", got "${result.actionItems[0].task}"`
    );
    assert(result.unresolvedQuestions.length === 1, `Expected 1 question, got ${result.unresolvedQuestions.length}`);
    assert(
      result.unresolvedQuestions[0].question === EXPECTED_QUESTION,
      `Question must be exactly "${EXPECTED_QUESTION}", got "${result.unresolvedQuestions[0].question}"`
    );
  });

  await runTest("Client: comma-less live question alone normalizes", () => {
    const result = synthesizeClient(`You [01:19]: ${LIVE_LINES[4]}`);
    assert(result.unresolvedQuestions.length === 1, `Expected 1 question, got ${result.unresolvedQuestions.length}`);
    assert(
      result.unresolvedQuestions[0].question === EXPECTED_QUESTION,
      `Question must be exactly "${EXPECTED_QUESTION}", got "${result.unresolvedQuestions[0].question}"`
    );
  });

  await runTest("Client: named subject without commas normalizes", () => {
    const result = synthesizeClient("You [00:10]: Yogendra will assign the onboarding bugs by Friday");
    assert(result.actionItems.length === 1, `Expected 1 action, got ${result.actionItems.length}`);
    assert(
      result.actionItems[0].task === "Assign the onboarding bugs by Friday.",
      `Task must be "Assign the onboarding bugs by Friday.", got "${result.actionItems[0].task}"`
    );
  });

  await runTest("Client: plain 'I will …' with no name still normalizes", () => {
    const result = synthesizeClient("You [00:10]: I will send the updated deck to the team by Monday");
    assert(result.actionItems.length === 1, `Expected 1 action, got ${result.actionItems.length}`);
    assert(
      result.actionItems[0].task === "Send the updated deck to the team by Monday.",
      `Task must be "Send the updated deck to the team by Monday.", got "${result.actionItems[0].task}"`
    );
  });

  await runTest("Client: comma appositive with NO continuation clause is now detected and normalized", () => {
    // Before this fix this shape produced ZERO action items: detection
    // only ever fired on the pasted fixture because of its separate
    // "and I will review" clause.
    const result = synthesizeClient(
      "Yogendra: I, Yogendra, will assign any bugs we find during end-to-end testing today directly to the respective developers"
    );
    assert(result.actionItems.length === 1, `Expected 1 action, got ${result.actionItems.length}`);
    assert(
      result.actionItems[0].task ===
        "Assign any bugs we find during end-to-end testing today directly to the respective developers.",
      `Task mismatch, got "${result.actionItems[0].task}"`
    );
  });

  await runTest("Client guardrail: a named third person mid-sentence is never stripped (no misattribution)", () => {
    const result = synthesizeClient(
      "You [00:10]: I will assign the bugs we find today, and Priya will review those fixes by tomorrow evening"
    );
    assert(result.actionItems.length === 1, `Expected 1 action, got ${result.actionItems.length}`);
    assert(
      result.actionItems[0].task ===
        "Assign the bugs we find today, and Priya will review those fixes by tomorrow evening.",
      `Task must keep Priya's clause intact, got "${result.actionItems[0].task}"`
    );
  });

  // --- Server path (SummaryService) ---

  await runTest("Server: segments from the full comma-less live transcript → 1 normalized action, 1 normalized question", () => {
    const analysis = serverSummaryFromSegments(LIVE_LINES);
    assert(analysis.decisions.length === 1, `Expected 1 decision, got ${analysis.decisions.length}`);
    assert(analysis.actionItems.length === 1, `Expected 1 action, got ${analysis.actionItems.length}: ${JSON.stringify(analysis.actionItems.map((a: any) => a.task))}`);
    assert(
      analysis.actionItems[0].task === EXPECTED_LIVE_ACTION,
      `Server task must be exactly "${EXPECTED_LIVE_ACTION}", got "${analysis.actionItems[0].task}"`
    );
    assert(
      analysis.actionItems[0].citation?.rawText === SCREENSHOT_ACTION,
      "Server citation must keep the verbatim comma-less segment"
    );
    assert(analysis.unresolvedQuestions.length === 1, `Expected 1 question, got ${analysis.unresolvedQuestions.length}`);
    assert(
      analysis.unresolvedQuestions[0].question === EXPECTED_QUESTION,
      `Server question must be exactly "${EXPECTED_QUESTION}", got "${analysis.unresolvedQuestions[0].question}"`
    );
  });

  await runTest("Server: Deepgram-style VTT via sttService.processAudioStream → normalized action and question", async () => {
    const vtt = LIVE_LINES.map((l) => `<v You>${l}</v>`).join("\n");
    const payload = await sttService.processAudioStream({
      meetingId: "meet-normalization-live-vtt",
      durationSeconds: 90,
      sampleTranscriptPreset: vtt,
    });
    const analysis = new SummaryService().generateSummary(payload as any);
    assert(analysis.actionItems.length === 1, `Expected 1 action, got ${analysis.actionItems.length}: ${JSON.stringify(analysis.actionItems.map((a: any) => a.task))}`);
    assert(
      analysis.actionItems[0].task === EXPECTED_LIVE_ACTION,
      `Task must be exactly "${EXPECTED_LIVE_ACTION}", got "${analysis.actionItems[0].task}"`
    );
    assert(analysis.unresolvedQuestions.length === 1, `Expected 1 question, got ${analysis.unresolvedQuestions.length}`);
    assert(
      analysis.unresolvedQuestions[0].question === EXPECTED_QUESTION,
      `Question must be exactly "${EXPECTED_QUESTION}", got "${analysis.unresolvedQuestions[0].question}"`
    );
  });

  await runTest("Server: comma-less named subject moves to assignee, task is imperative", () => {
    const analysis = serverSummaryFromSegments(["Yogendra will assign the onboarding bugs by Friday"], "You");
    assert(analysis.actionItems.length === 1, `Expected 1 action, got ${analysis.actionItems.length}`);
    assert(
      analysis.actionItems[0].assignee === "Yogendra",
      `Assignee must be "Yogendra", got "${analysis.actionItems[0].assignee}"`
    );
    assert(
      analysis.actionItems[0].task === "Assign the onboarding bugs by Friday.",
      `Task must be "Assign the onboarding bugs by Friday.", got "${analysis.actionItems[0].task}"`
    );
  });

  await runTest("Server: comma-less live question alone normalizes", () => {
    const analysis = serverSummaryFromSegments([LIVE_LINES[4]]);
    assert(analysis.unresolvedQuestions.length === 1, `Expected 1 question, got ${analysis.unresolvedQuestions.length}`);
    assert(
      analysis.unresolvedQuestions[0].question === EXPECTED_QUESTION,
      `Question must be exactly "${EXPECTED_QUESTION}", got "${analysis.unresolvedQuestions[0].question}"`
    );
  });

  console.log("-------------------------------------------------");
  console.log(`TOTAL: ${total} | PASSED: ${passed} | FAILED: ${total - passed}`);
  console.log(`PASS RATE: ${((passed / total) * 100).toFixed(1)}%`);
  console.log("-------------------------------------------------");

  if (passed !== total) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

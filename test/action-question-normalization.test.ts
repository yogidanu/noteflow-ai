/**
 * Regression suite: Constrained Action & Question Normalization
 *
 * Pins the defect from the 2026-10-23 live run after PR #2: Key
 * Decisions displayed normalized text ("Agreed to launch the public
 * beta to our waitlist first…") while Action Items and Unresolved
 * Questions displayed the raw transcript sentence verbatim — the
 * action was the full first-person line ("I, Yogendra, will assign
 * any bugs … and I will review those fixes by tomorrow evening"), and
 * the question was a statement about a question ending in the ".?"
 * artifact ("…or kept only for the Pro tier.?"). Every generated
 * question also carried a hardcoded templated follow-up line
 * ("Review during upcoming sync to finalize requirements and
 * dependency.") — content nobody in the meeting ever said.
 *
 * The fix is CONSTRAINED normalization (deterministic, rule-based, no
 * LLM): display form only — imperative for actions, question form for
 * questions — preserving every fact and adding nothing. The verbatim
 * line stays in each item's citation (rawText), unchanged.
 *
 * Fixtures run through sanitizeTranscript() +
 * GenerativeSummarizer.synthesize() (client) and SummaryService
 * (server), mirroring the production builders.
 */

import { sanitizeTranscript } from "../src/lib/transcriptSanitizer";
import { GenerativeSummarizer } from "../src/lib/llmSummarizer";
import { SummaryService } from "../server/services/summaryService.js";

function assert(condition: boolean, msg: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${msg}`);
  }
}

let passed = 0;
let total = 0;

function runTest(name: string, fn: () => void) {
  total++;
  try {
    fn();
    passed++;
    console.log(`[PASS] ✅ ${name}`);
  } catch (err: any) {
    console.error(`[FAIL] ❌ ${name}:`, err.message);
  }
}

// The known 5-line clean-test script (same fixture family as the
// discussion-titles suite), as a manual note.
const SCRIPT_LINES = [
  "this is a planning check-in for the NoteFlow AI public beta",
  "we have decided to launch the public beta to our waitlist first, before we build team workspaces",
  "the reason is simple — we want real feedback from individual product managers and designers before we add shared workspaces for teams",
  "I, Yogendra, will assign any bugs we find during end-to-end testing today directly to the respective developers, and I will review those fixes by tomorrow evening",
  "one question we are leaving open for now is whether team workspaces should be included in the free beta, or kept only for the Pro tier",
];
const MANUAL_FIXTURE = SCRIPT_LINES.map((l) => `Yogendra: ${l}`).join("\n");

const EXPECTED_ACTION =
  "Assign any bugs we find during end-to-end testing today directly to the respective developers, and review those fixes by tomorrow evening.";
const EXPECTED_QUESTION =
  "Should team workspaces be included in the free beta, or kept only for the Pro tier?";
const EXPECTED_DECISION =
  "Agreed to launch the public beta to our waitlist first, before we build team workspaces";

function synthesizeOne(line: string) {
  return GenerativeSummarizer.synthesize(sanitizeTranscript(`Sam: ${line}`), "standard");
}

function serverSummary(segmentTexts: Array<{ speaker: string; text: string }>) {
  const segments = segmentTexts.map((s, i) => ({
    lineIndex: i,
    speaker: s.speaker,
    timestamp: `00:${String(i * 10).padStart(2, "0")}`,
    text: s.text,
  }));
  return new SummaryService().generateSummary({
    meetingId: "meet-normalization-test",
    rawVtt: "",
    sanitizedText: segmentTexts.map((s) => s.text).join(" "),
    detectedSpeakers: Array.from(new Set(segmentTexts.map((s) => s.speaker))),
    durationSeconds: 60,
    segments,
  });
}

function main() {
  console.log("=================================================");
  console.log("  REGRESSION: ACTION & QUESTION NORMALIZATION    ");
  console.log("=================================================");

  const manualSanitized = sanitizeTranscript(MANUAL_FIXTURE);
  const manual = GenerativeSummarizer.synthesize(manualSanitized, "standard");

  runTest("Fixture: action item is normalized to imperative form (exact)", () => {
    assert(manual.actionItems.length === 1, `Expected 1 action, got ${manual.actionItems.length}`);
    assert(
      manual.actionItems[0].task === EXPECTED_ACTION,
      `Action task must be exactly "${EXPECTED_ACTION}", got "${manual.actionItems[0].task}"`
    );
  });

  runTest("Fixture: open question is normalized to question form (exact)", () => {
    assert(manual.unresolvedQuestions.length === 1, `Expected 1 question, got ${manual.unresolvedQuestions.length}`);
    assert(
      manual.unresolvedQuestions[0].question === EXPECTED_QUESTION,
      `Question must be exactly "${EXPECTED_QUESTION}", got "${manual.unresolvedQuestions[0].question}"`
    );
  });

  runTest("Fixture: decision output is unchanged by normalization", () => {
    assert(manual.decisions.length === 1, `Expected 1 decision, got ${manual.decisions.length}`);
    assert(
      manual.decisions[0].text === EXPECTED_DECISION,
      `Decision must stay "${EXPECTED_DECISION}", got "${manual.decisions[0].text}"`
    );
  });

  runTest("Fixture: citations keep the verbatim line (evidence layer untouched)", () => {
    const actionCitation = manual.actionItems[0].citation;
    assert(Boolean(actionCitation), "Action must carry a citation");
    assert(
      actionCitation!.rawText === manualSanitized.lines[3].text,
      `Action citation rawText must equal its source line, got "${actionCitation!.rawText}"`
    );
    assert(
      actionCitation!.rawText.includes("I, Yogendra, will assign"),
      "Action citation must keep the verbatim first-person framing"
    );
    const questionCitation = manual.unresolvedQuestions[0].citation;
    assert(Boolean(questionCitation), "Question must carry a citation");
    assert(
      questionCitation!.rawText === manualSanitized.lines[4].text,
      `Question citation rawText must equal its source line, got "${questionCitation!.rawText}"`
    );
    assert(
      questionCitation!.rawText.includes("leaving open for now is whether"),
      "Question citation must keep the verbatim framing"
    );
  });

  runTest("Fixture: no templated follow-up line is generated for questions", () => {
    assert(
      manual.unresolvedQuestions.every((q) => q.suggestedFollowUp === undefined),
      `Generated questions must not carry a suggestedFollowUp, got ${JSON.stringify(manual.unresolvedQuestions.map((q) => q.suggestedFollowUp))}`
    );
    assert(
      !JSON.stringify(manual).includes("upcoming sync"),
      'Output must not contain the templated "Review during upcoming sync…" line'
    );
  });

  runTest('Fixture: no ".?" artifact anywhere in the output', () => {
    assert(!JSON.stringify(manual).includes(".?"), 'Output must not contain the ".?" artifact');
  });

  runTest("Variant (a): named third-person commitment becomes imperative, name leaves the text", () => {
    const result = synthesizeOne("Priya will share the updated flows with the team by Friday");
    assert(result.actionItems.length === 1, `Expected 1 action, got ${result.actionItems.length}`);
    assert(
      result.actionItems[0].task === "Share the updated flows with the team by Friday.",
      `Task must be "Share the updated flows with the team by Friday.", got "${result.actionItems[0].task}"`
    );
  });

  runTest("Variant (b): 'We need to …' obligation becomes imperative", () => {
    const result = synthesizeOne("We need to fix the onboarding drop-off before launch");
    assert(result.actionItems.length === 1, `Expected 1 action, got ${result.actionItems.length}: ${JSON.stringify(result.actionItems.map((a) => a.task))}`);
    assert(
      result.actionItems[0].task === "Fix the onboarding drop-off before launch.",
      `Task must be "Fix the onboarding drop-off before launch.", got "${result.actionItems[0].task}"`
    );
  });

  runTest("Variant (c): 'figure out whether to A or B' becomes a Should-we question (and not an action)", () => {
    const result = synthesizeOne(
      "We still need to figure out whether to keep onboarding at five steps or cut it to three"
    );
    assert(result.unresolvedQuestions.length === 1, `Expected 1 question, got ${result.unresolvedQuestions.length}`);
    assert(
      result.unresolvedQuestions[0].question === "Should we keep onboarding at five steps or cut it to three?",
      `Question must be "Should we keep onboarding at five steps or cut it to three?", got "${result.unresolvedQuestions[0].question}"`
    );
    assert(result.actionItems.length === 0, `A question line must not also become an action, got ${result.actionItems.length}`);
  });

  runTest("Variant (d): a direct question stays intact", () => {
    const result = synthesizeOne("Should we ship the beta on Monday?");
    assert(result.unresolvedQuestions.length === 1, `Expected 1 question, got ${result.unresolvedQuestions.length}`);
    assert(
      result.unresolvedQuestions[0].question === "Should we ship the beta on Monday?",
      `Question must stay "Should we ship the beta on Monday?", got "${result.unresolvedQuestions[0].question}"`
    );
  });

  runTest("Variant (e): an unrecognized construction falls back to the original text", () => {
    // Imperative lines are detected as commitments but match no rewrite
    // pattern: the display text must be the original sentence, not a
    // guessed rewrite (and no terminal period is invented for it).
    const result = synthesizeOne("Send the updated invoice to finance");
    assert(result.actionItems.length === 1, `Expected 1 action, got ${result.actionItems.length}`);
    assert(
      result.actionItems[0].task === "Send the updated invoice to finance",
      `Task must fall back to the original text, got "${result.actionItems[0].task}"`
    );
  });

  runTest("Punctuation guard: a statement-form parked item ending in '.' gains no '?'", () => {
    const result = synthesizeOne("It depends on the vendor timeline.");
    assert(result.unresolvedQuestions.length === 1, `Expected 1 question, got ${result.unresolvedQuestions.length}`);
    assert(
      result.unresolvedQuestions[0].question === "It depends on the vendor timeline.",
      `Question must keep its period (never ".?"), got "${result.unresolvedQuestions[0].question}"`
    );
  });

  runTest("Punctuation guard: fixture question spoken with a trailing period still ends in one '?'", () => {
    const result = synthesizeOne(
      "One question we are leaving open for now is whether team workspaces should be included in the free beta, or kept only for the Pro tier."
    );
    assert(result.unresolvedQuestions.length === 1, `Expected 1 question, got ${result.unresolvedQuestions.length}`);
    assert(
      result.unresolvedQuestions[0].question === EXPECTED_QUESTION,
      `Question must be exactly "${EXPECTED_QUESTION}", got "${result.unresolvedQuestions[0].question}"`
    );
  });

  // --- Server (SummaryService) mirrors ---

  runTest("Server fixture: action normalized, citation verbatim", () => {
    const analysis = serverSummary([
      { speaker: "Yogendra", text: SCRIPT_LINES[3] },
      { speaker: "Yogendra", text: "One question we are leaving open for now is whether team workspaces should be included in the free beta, or kept only for the Pro tier." },
    ]);
    assert(analysis.actionItems.length === 1, `Expected 1 action, got ${analysis.actionItems.length}: ${JSON.stringify(analysis.actionItems.map((a) => a.task))}`);
    assert(
      analysis.actionItems[0].task === EXPECTED_ACTION,
      `Server task must be exactly "${EXPECTED_ACTION}", got "${analysis.actionItems[0].task}"`
    );
    assert(
      analysis.actionItems[0].citation?.rawText === SCRIPT_LINES[3],
      "Server action citation must keep the verbatim segment"
    );
  });

  runTest("Server fixture: question normalized, no templated follow-up", () => {
    const analysis = serverSummary([
      { speaker: "Yogendra", text: SCRIPT_LINES[3] },
      { speaker: "Yogendra", text: "One question we are leaving open for now is whether team workspaces should be included in the free beta, or kept only for the Pro tier." },
    ]);
    assert(analysis.unresolvedQuestions.length === 1, `Expected 1 question, got ${analysis.unresolvedQuestions.length}`);
    assert(
      analysis.unresolvedQuestions[0].question === EXPECTED_QUESTION,
      `Server question must be exactly "${EXPECTED_QUESTION}", got "${analysis.unresolvedQuestions[0].question}"`
    );
    assert(
      analysis.unresolvedQuestions[0].suggestedFollowUp === undefined,
      `Server must not generate a templated follow-up, got "${analysis.unresolvedQuestions[0].suggestedFollowUp}"`
    );
    assert(
      !JSON.stringify(analysis).includes("clarify open dependency"),
      'Output must not contain the templated "Follow up with … to clarify open dependency." line'
    );
    assert(!JSON.stringify(analysis).includes(".?"), 'Server output must not contain the ".?" artifact');
  });

  runTest("Server variant (a): named subject moves to assignee, task is imperative", () => {
    const analysis = serverSummary([
      { speaker: "Sam", text: "Priya will share the updated flows with the team by Friday" },
    ]);
    assert(analysis.actionItems.length === 1, `Expected 1 action, got ${analysis.actionItems.length}`);
    assert(
      analysis.actionItems[0].assignee === "Priya",
      `Assignee must be "Priya", got "${analysis.actionItems[0].assignee}"`
    );
    assert(
      analysis.actionItems[0].task === "Share the updated flows with the team by Friday.",
      `Task must be "Share the updated flows with the team by Friday.", got "${analysis.actionItems[0].task}"`
    );
  });

  runTest("Server variant (c): 'figure out whether to A or B' becomes a Should-we question", () => {
    const analysis = serverSummary([
      { speaker: "Sam", text: "We still need to figure out whether to keep onboarding at five steps or cut it to three" },
    ]);
    assert(analysis.unresolvedQuestions.length === 1, `Expected 1 question, got ${analysis.unresolvedQuestions.length}`);
    assert(
      analysis.unresolvedQuestions[0].question === "Should we keep onboarding at five steps or cut it to three?",
      `Question must be "Should we keep onboarding at five steps or cut it to three?", got "${analysis.unresolvedQuestions[0].question}"`
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

main();

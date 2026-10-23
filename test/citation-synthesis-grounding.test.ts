/**
 * Regression suite: Citation & Synthesis Grounding
 *
 * Pins the defect report from the 2026-10-23 live run of NoteFlow AI:
 *  - Citation badges all rendered 00:00 because the sanitizer could not parse
 *    the recorder format "Speaker [MM:SS]: text".
 *  - Action items were invented from context/rationale lines (substring
 *    keyword matching: "check" in "check-in", "share" in "shared workspace")
 *    and given fabricated due dates ("Next Checkpoint" / "End of Week").
 *  - The standard executive summary contained canned filler
 *    ("...review operational milestones...") unrelated to the transcript.
 *  - STT homophone errors for domain terms (waitlist, NoteFlow, Pro tier)
 *    passed through uncorrected.
 *  - Grounding / accuracy labels and modelConfidence were hardcoded "high".
 *
 * Fixture: the exact 5-line recorder-format transcript used to reproduce it,
 * run through sanitizeTranscript() + GenerativeSummarizer.synthesize().
 * Expected: 1 decision (00:21), 1 action item due "Tomorrow", 1 open
 * question (01:03).
 */

import { sanitizeTranscript } from "../src/lib/transcriptSanitizer";
import { GenerativeSummarizer } from "../src/lib/llmSummarizer";

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

const FIXTURE = [
  "You [00:12]: this is a planning check in for the NoteFlow public beta",
  "You [00:21]: we have decided to launch the public beta to a waitlist first before we build team workspace",
  "You [00:33]: the reason is simple we want real feedback from individual product managers and designers before we add shared workspace for teams",
  "You [00:48]: any bugs we find during end to end testing today directly to the respective developers and I will review those fixes by tomorrow evening",
  "You [01:03]: one question we are leaving open for now is whether team workspaces should be included in the free beta or kept only for the Pro tier",
].join("\n");

function main() {
  console.log("=================================================");
  console.log("  REGRESSION: CITATION & SYNTHESIS GROUNDING     ");
  console.log("=================================================");

  const sanitized = sanitizeTranscript(FIXTURE);
  const result = GenerativeSummarizer.synthesize(sanitized, "standard");
  const everything = JSON.stringify(result);

  runTest("Sanitizer parses recorder format 'Speaker [MM:SS]: text'", () => {
    assert(sanitized.lines.length === 5, `Expected 5 lines, got ${sanitized.lines.length}`);
    assert(sanitized.lines[0].speaker === "You", `Line 0 speaker must be "You", got ${sanitized.lines[0].speaker}`);
    assert(sanitized.lines[0].timestamp === "00:12", `Line 0 timestamp must be 00:12, got ${sanitized.lines[0].timestamp}`);
    assert(sanitized.lines[1].timestamp === "00:21", `Line 1 timestamp must be 00:21, got ${sanitized.lines[1].timestamp}`);
    assert(sanitized.lines[4].timestamp === "01:03", `Line 4 timestamp must be 01:03, got ${sanitized.lines[4].timestamp}`);
    assert(
      !sanitized.lines.some((l) => /\[?\d{2}:\d{2}\]?/.test(l.text) || l.text.startsWith("You")),
      "Parsed line text must not retain the 'You [MM:SS]:' prefix"
    );
  });

  runTest("Exactly 1 decision, citing the 00:21 source line", () => {
    assert(result.decisions.length === 1, `Expected 1 decision, got ${result.decisions.length}: ${JSON.stringify(result.decisions.map((d) => d.text))}`);
    assert(
      result.decisions[0].citation?.timestamp === "00:21",
      `Decision citation must be 00:21, got ${result.decisions[0].citation?.timestamp}`
    );
    assert(
      result.decisions[0].text.toLowerCase().includes("waitlist"),
      "Decision must mention the waitlist launch"
    );
  });

  runTest("Exactly 1 action item, due 'Tomorrow', citing 00:48", () => {
    assert(result.actionItems.length === 1, `Expected 1 action item, got ${result.actionItems.length}: ${JSON.stringify(result.actionItems.map((a) => a.task))}`);
    assert(
      result.actionItems[0].dueDate === "Tomorrow",
      `Action dueDate must be "Tomorrow" (from "tomorrow evening"), got ${result.actionItems[0].dueDate}`
    );
    assert(
      result.actionItems[0].citation?.timestamp === "00:48",
      `Action citation must be 00:48, got ${result.actionItems[0].citation?.timestamp}`
    );
  });

  runTest("Exactly 1 open question, citing the 01:03 source line", () => {
    assert(result.unresolvedQuestions.length === 1, `Expected 1 open question, got ${result.unresolvedQuestions.length}`);
    assert(
      result.unresolvedQuestions[0].citation?.timestamp === "01:03",
      `Question citation must be 01:03, got ${result.unresolvedQuestions[0].citation?.timestamp}`
    );
    assert(
      result.unresolvedQuestions[0].question.toLowerCase().includes("pro tier") ||
        result.unresolvedQuestions[0].question.toLowerCase().includes("team workspace"),
      "Question must be about team workspaces / Pro tier"
    );
  });

  runTest("No fabricated due dates anywhere in the output", () => {
    assert(!everything.includes("Next Checkpoint"), 'Output must not contain fabricated due date "Next Checkpoint"');
    // "End of Week" is only acceptable if the transcript literally said it; it did not.
    assert(!everything.includes("End of Week"), 'Output must not contain fabricated due date "End of Week"');
    assert(!everything.includes("Upcoming Sprint"), 'Output must not contain fabricated due date "Upcoming Sprint"');
  });

  runTest("Executive summary has no canned filler and is grounded", () => {
    assert(
      !result.executiveSummary.includes("operational milestones"),
      'Executive summary must not contain canned filler "operational milestones"'
    );
    assert(
      !result.executiveSummary.includes("established clear operational direction"),
      "Executive summary must not contain the canned Outcome paragraph"
    );
    assert(
      !result.executiveSummary.includes("planned subsequent checkpoint"),
      "Executive summary must not contain canned checkpoint filler"
    );
    const summaryLower = result.executiveSummary.toLowerCase();
    assert(
      summaryLower.includes("waitlist") || summaryLower.includes("public beta"),
      "Executive summary must be composed from the actual transcript content (waitlist / public beta)"
    );
  });

  runTest("No citation in the output carries the 00:00 fallback", () => {
    const citations = [
      ...result.decisions.map((d) => d.citation),
      ...result.actionItems.map((a) => a.citation),
      ...result.unresolvedQuestions.map((q) => q.citation),
      ...(result.importantDiscussionPoints || []).map((p) => p.citation),
    ].filter(Boolean);
    assert(citations.length > 0, "Expected at least one citation");
    assert(
      citations.every((c) => c!.timestamp && c!.timestamp !== "00:00"),
      `Every citation must carry its real timestamp, got: ${JSON.stringify(citations.map((c) => c!.timestamp))}`
    );
  });

  runTest("modelConfidence is computed from grounding, not hardcoded filler", () => {
    // All citations in this fixture resolve to real timestamps, so a high
    // rating is earned here — but a FAILED time anchor must degrade.
    assert(result.modelConfidence === "high", `Fully grounded fixture should earn "high", got ${result.modelConfidence}`);
    // Updated for the line-anchor fix (see discussion-titles-line-anchors
    // suite): plain pasted text ("Alex: …") is authored text whose lines
    // are line-anchored and CAN earn high via line resolution, so it is
    // no longer the degradation case. What must still degrade is a
    // recorder/STT line stamped with the literal "00:00" fallback — a
    // failed time anchor, not authored text.
    const zeroTimed = sanitizeTranscript(
      "Alex [00:00]: we decided to ship the beta on Friday\nAlex [00:00]: I will send the notes tomorrow"
    );
    const degraded = GenerativeSummarizer.synthesize(zeroTimed, "standard");
    assert(
      degraded.modelConfidence !== "high",
      `Citations stamped with the STT "00:00" fallback must not report "high" confidence, got ${degraded.modelConfidence}`
    );
  });

  runTest("Domain correction dictionary fixes known STT homophones (context-bound)", () => {
    const sttLike = sanitizeTranscript(
      [
        "You [00:05]: this is a planning check in for the nuclear public beta",
        "You [00:09]: we have decided to launch the public beta to a weightless first",
        "You [00:20]: kept only for the prodigal",
      ].join("\n")
    );
    const joined = sttLike.lines.map((l) => l.text).join(" ").toLowerCase();
    assert(joined.includes("noteflow public beta"), `"nuclear public beta" must be corrected to NoteFlow in beta context, got: ${joined}`);
    assert(joined.includes("waitlist"), `"weightless" must be corrected to "waitlist" in beta-launch context, got: ${joined}`);
    assert(!joined.includes("prodigal"), `"prodigal" (Pro tier) must be corrected in pricing context, got: ${joined}`);
  });

  runTest("Domain corrections do NOT fire outside their context", () => {
    const unrelated = sanitizeTranscript("Sam: I felt weightless during the flight and it was a prodigal weekend");
    const joined = unrelated.lines.map((l) => l.text).join(" ");
    assert(joined.includes("weightless"), "Unrelated 'weightless' must be left untouched");
    assert(joined.includes("prodigal"), "Unrelated 'prodigal' must be left untouched");
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

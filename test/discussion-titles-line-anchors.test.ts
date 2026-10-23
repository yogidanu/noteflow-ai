/**
 * Regression suite: Discussion-Point Titles & Line-Anchored Citations
 *
 * Pins two defects from the 2026-10-23 live runs of NoteFlow AI:
 *
 * FIX 1 — Discussion point titles were fragments of their own summary.
 * buildDiscussionTopics set topic = toProfessionalTitle(clean), which was
 * literally `text.split(" ").slice(0, 4)` — the first 4 words of the same
 * line used as the summary ("This is a planning" / "We have decided to").
 * Titles must be abstracted noun-phrase themes, never a prefix of the
 * summary, and topics must follow the classified themes present in the
 * meeting (context / decision / rationale / action / question), not just
 * the first 4 lines by position.
 *
 * FIX 2 — Manual-note (timestamp-less) citations showed fake 00:00 badges,
 * "0% Grounded in Transcript" and "Low Accuracy" even though every item
 * was traceable to an exact source line. Plain pasted text has no time
 * domain: its citations must be LINE-anchored (speaker + line number),
 * and grounding for line-anchored citations is computed from source-line
 * resolution (valid lineIndex + rawText match), not timestamps.
 *
 * The timestamped recorder fixture from citation-synthesis-grounding
 * must keep behaving exactly as before (time-anchored, real timestamps).
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

const SCRIPT_LINES = [
  "this is a planning check-in for the NoteFlow AI public beta",
  "we have decided to launch the public beta to our waitlist first, before we build team workspaces",
  "the reason is simple — we want real feedback from individual product managers and designers before we add shared workspaces for teams",
  "I, Yogendra, will assign any bugs we find during end-to-end testing today directly to the respective developers, and I will review those fixes by tomorrow evening",
  "one question we are leaving open for now is whether team workspaces should be included in the free beta, or kept only for the Pro tier",
];

const TIMED_FIXTURE = [
  "You [00:12]: this is a planning check in for the NoteFlow public beta",
  "You [00:21]: we have decided to launch the public beta to a waitlist first before we build team workspace",
  "You [00:33]: the reason is simple we want real feedback from individual product managers and designers before we add shared workspace for teams",
  "You [00:48]: any bugs we find during end to end testing today directly to the respective developers and I will review those fixes by tomorrow evening",
  "You [01:03]: one question we are leaving open for now is whether team workspaces should be included in the free beta or kept only for the Pro tier",
].join("\n");

const MANUAL_FIXTURE = SCRIPT_LINES.map((l) => `Yogendra: ${l}`).join("\n");

function firstWords(text: string, n: number): string {
  return text.split(/\s+/).slice(0, n).join(" ").toLowerCase();
}

function allCitations(result: ReturnType<typeof GenerativeSummarizer.synthesize>) {
  return [
    ...result.decisions.map((d) => d.citation),
    ...result.actionItems.map((a) => a.citation),
    ...result.unresolvedQuestions.map((q) => q.citation),
    ...(result.importantDiscussionPoints || []).map((p) => p.citation),
  ].filter(Boolean) as NonNullable<(typeof result.decisions)[number]["citation"]>[];
}

function main() {
  console.log("=================================================");
  console.log("  REGRESSION: TITLES & LINE-ANCHORED CITATIONS   ");
  console.log("=================================================");

  const timedSanitized = sanitizeTranscript(TIMED_FIXTURE);
  const timed = GenerativeSummarizer.synthesize(timedSanitized, "standard");
  const timedPoints = timed.importantDiscussionPoints || [];

  const manualSanitized = sanitizeTranscript(MANUAL_FIXTURE);
  const manual = GenerativeSummarizer.synthesize(manualSanitized, "standard");
  const manualPoints = manual.importantDiscussionPoints || [];

  // ---- FIX 1: discussion point titles --------------------------------

  runTest("Discussion topics cover the classified themes, not just the first 4 lines", () => {
    assert(
      timedPoints.length >= 5,
      `Expected topics for context+decision+rationale+action+question (5), got ${timedPoints.length}: ${JSON.stringify(timedPoints.map((p) => p.topic))}`
    );
    const lineIndexes = timedPoints.map((p) => p.citation?.lineIndex ?? -1);
    const sorted = [...lineIndexes].sort((a, b) => a - b);
    assert(
      JSON.stringify(lineIndexes) === JSON.stringify(sorted),
      `Topics must preserve source order, got lineIndexes ${JSON.stringify(lineIndexes)}`
    );
  });

  runTest("No discussion title is a prefix/fragment of its own summary", () => {
    for (const p of timedPoints) {
      const topic = p.topic.trim().toLowerCase();
      const summary = p.summary.trim().toLowerCase();
      assert(topic.length > 0, "Topic title must not be empty");
      assert(!summary.startsWith(topic), `Title must not be a prefix of its summary: "${p.topic}" vs "${p.summary}"`);
      assert(
        topic !== firstWords(p.summary, 4),
        `Title must not be the first 4 words of its line: "${p.topic}"`
      );
      assert(
        p.topic.split(/\s+/).length <= 9,
        `Title must be a short theme (<= 9 words), got "${p.topic}"`
      );
    }
    const joined = timedPoints.map((p) => p.topic).join(" | ");
    assert(!joined.includes("This is a planning"), 'Fragment title "This is a planning" must not appear');
    assert(!joined.includes("We have decided to"), 'Fragment title "We have decided to" must not appear');
  });

  runTest("Discussion titles are thematic (decision object, rationale, action themes)", () => {
    const joined = timedPoints.map((p) => p.topic.toLowerCase()).join(" | ");
    assert(joined.includes("waitlist"), `A title must name the decision theme (waitlist), got: ${joined}`);
    assert(
      joined.includes("public beta") || joined.includes("planning"),
      `A title must name the context theme (public beta / planning), got: ${joined}`
    );
    assert(joined.includes("bug"), `A title must name the action theme (bugs), got: ${joined}`);
    assert(joined.includes("feedback"), `A title must name the rationale theme (feedback), got: ${joined}`);
  });

  // ---- FIX 2: line-anchored citations for manual notes ---------------

  runTest("Sanitizer marks plain manual text lines as line-anchored with no fabricated timestamp", () => {
    assert(manualSanitized.lines.length === 5, `Expected 5 lines, got ${manualSanitized.lines.length}`);
    for (const l of manualSanitized.lines) {
      assert(
        (l as any).anchorKind === "line",
        `Manual line must be line-anchored, got anchorKind=${(l as any).anchorKind} for "${l.text}"`
      );
      assert(
        l.timestamp === undefined,
        `Manual line must not carry a fabricated timestamp, got ${l.timestamp}`
      );
    }
    for (const l of timedSanitized.lines) {
      assert(
        (l as any).anchorKind === "time",
        `Recorder line must be time-anchored, got anchorKind=${(l as any).anchorKind}`
      );
    }
  });

  runTest("Manual note extraction is still correct (1 decision, 1 action due Tomorrow, 1 question)", () => {
    assert(manual.decisions.length === 1, `Expected 1 decision, got ${manual.decisions.length}`);
    assert(manual.actionItems.length === 1, `Expected 1 action item, got ${manual.actionItems.length}: ${JSON.stringify(manual.actionItems.map((a) => a.task))}`);
    assert(
      manual.actionItems[0].dueDate === "Tomorrow",
      `Action dueDate must be "Tomorrow", got ${manual.actionItems[0].dueDate}`
    );
    assert(manual.unresolvedQuestions.length === 1, `Expected 1 open question, got ${manual.unresolvedQuestions.length}`);
  });

  runTest("Manual-note citations are line-anchored: no 00:00 presented as a time, and they resolve to their source line", () => {
    const citations = allCitations(manual);
    assert(citations.length > 0, "Expected citations in manual-note output");
    for (const c of citations) {
      assert(
        (c as any).anchorKind === "line",
        `Citation must be line-anchored, got anchorKind=${(c as any).anchorKind} (${c.id})`
      );
      assert(
        c.timestamp === undefined,
        `Line-anchored citation must not present a timestamp (certainly not 00:00), got ${c.timestamp} (${c.id})`
      );
      assert(
        typeof c.lineIndex === "number",
        `Line-anchored citation must carry a lineIndex, got ${c.lineIndex} (${c.id})`
      );
      const source = manualSanitized.lines.find((l) => l.originalIndex === c.lineIndex);
      assert(Boolean(source), `Citation lineIndex ${c.lineIndex} must resolve to a source line (${c.id})`);
      assert(
        source!.text === c.rawText,
        `Citation rawText must match its source line text (${c.id}): "${c.rawText}" vs "${source!.text}"`
      );
    }
  });

  runTest("Fully line-grounded manual note earns high confidence from line resolution", () => {
    assert(
      manual.modelConfidence === "high",
      `Manual note whose citations all resolve to source lines must earn "high", got ${manual.modelConfidence}`
    );
    assert(
      manualPoints.length > 0 && manualPoints.every((p) => (p.citation as any)?.anchorKind === "line"),
      "Manual discussion points must also be line-anchored"
    );
  });

  runTest("Timed fixture citations stay time-anchored with real timestamps", () => {
    const citations = allCitations(timed);
    assert(citations.length > 0, "Expected citations in timed output");
    for (const c of citations) {
      assert(
        (c as any).anchorKind === "time",
        `Timed citation must be time-anchored, got anchorKind=${(c as any).anchorKind} (${c.id})`
      );
      assert(
        Boolean(c.timestamp) && c.timestamp !== "00:00",
        `Timed citation must keep its real timestamp, got ${c.timestamp} (${c.id})`
      );
    }
    assert(timed.modelConfidence === "high", `Timed fixture must stay "high", got ${timed.modelConfidence}`);
  });

  runTest("Recorder lines stamped 00:00 by STT fallback stay ungrounded (not silently line-grounded)", () => {
    // A recorder-format line carrying a literal 00:00 is a FAILED time
    // anchor from the STT/recorder domain, not authored manual text:
    // it must not earn high confidence via line resolution.
    const zeroTimed = sanitizeTranscript(
      [
        "Alex [00:00]: we decided to ship the beta on Friday",
        "Alex [00:00]: I will send the notes tomorrow",
      ].join("\n")
    );
    const result = GenerativeSummarizer.synthesize(zeroTimed, "standard");
    assert(
      result.modelConfidence !== "high",
      `STT 00:00-stamped lines must not report "high" confidence, got ${result.modelConfidence}`
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

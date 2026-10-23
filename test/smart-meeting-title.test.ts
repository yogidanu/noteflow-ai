/**
 * Regression suite: Smart Meeting Titles
 *
 * Pins the defect from the 2026-10-23 live run: generateSmartTitle
 * returned the first sanitized line whose cleaned length was 16–59
 * characters. In the user's transcript, the context and decision lines
 * were too long, so the fragment "before we build teamworkspace" became
 * the meeting title. Titles for untitled transcripts must instead be
 * derived from classified meeting themes (context first, then decision,
 * then the first thematic discussion topic), with the pre-existing
 * speaker/date fallbacks only when no theme is present.
 */

import { processMeetingWithAI } from "../src/lib/aiEngine";
import { sanitizeTranscript } from "../src/lib/transcriptSanitizer";

function assert(condition: boolean, msg: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${msg}`);
  }
}

let passed = 0;
let total = 0;

async function runTest(name: string, fn: () => Promise<void>) {
  total++;
  try {
    await fn();
    passed++;
    console.log(`[PASS] ✅ ${name}`);
  } catch (err: any) {
    console.error(`[FAIL] ❌ ${name}:`, err.message);
  }
}

const EXPECTED_CONTEXT_TITLE = "NoteFlow AI public beta — planning check-in";

const STT_FIXTURE = [
  "[00:15] You: this is a planning check in for the note flow AI public beta",
  "[00:25] You: we have decided to launch the public Beta 2 hour wait list first",
  "[00:28] You: before we build teamworkspace",
  "[00:43] You: the reason is simple we want real feedback from individual product managers and designers before we add shared workspace 14",
  "[01:02] You: I Yogendra will assign any bugs we find during end to end testing today directly to the respective developers and I will review those fixes by tomorrow evening",
  "[01:19] You: one question we are living open for now is whether Team workspaces should be included in the free beta or kept only for the pro tear",
].join("\n");

const CLEAN_SCRIPT_LINES = [
  "this is a planning check-in for the NoteFlow AI public beta",
  "we have decided to launch the public beta to our waitlist first, before we build team workspaces",
  "the reason is simple — we want real feedback from individual product managers and designers before we add shared workspaces for teams",
  "I, Yogendra, will assign any bugs we find during end-to-end testing today directly to the respective developers, and I will review those fixes by tomorrow evening",
  "one question we are leaving open for now is whether team workspaces should be included in the free beta, or kept only for the Pro tier",
];
const CLEAN_FIXTURE = CLEAN_SCRIPT_LINES.map((line) => `Yogendra: ${line}`).join("\n");

function assertThemeGuardrails(title: string, rawFixture: string) {
  const sourceLines = sanitizeTranscript(rawFixture).lines.map((line) => line.text.trim().toLowerCase());
  const normalizedTitle = title.trim().toLowerCase();

  assert(title.length <= 80, `Theme title must be capped at 80 characters, got ${title.length}: "${title}"`);
  assert(
    !/^(before|after|when|while|because|since|and|but|or|so|if|then)\b/i.test(title),
    `Theme title must not start with a fragment word: "${title}"`
  );
  for (const line of sourceLines) {
    assert(normalizedTitle !== line, `Theme title must not be a verbatim transcript line: "${title}"`);
    assert(
      !line.includes(normalizedTitle),
      `Theme title must not be a contiguous fragment of a transcript line: "${title}" in "${line}"`
    );
  }
}

async function main() {
  console.log("=================================================");
  console.log("  REGRESSION: SMART MEETING TITLES               ");
  console.log("=================================================");

  await runTest("Lowercase STT transcript uses the context theme, not a short fragment", async () => {
    const { title } = await processMeetingWithAI(STT_FIXTURE);
    assert(
      title === EXPECTED_CONTEXT_TITLE,
      `Expected context theme "${EXPECTED_CONTEXT_TITLE}", got "${title}"`
    );
    assert(title !== "Before we build teamworkspace", "The old fragment title must not be produced");
    assertThemeGuardrails(title, STT_FIXTURE);
  });

  await runTest("Clean pasted script uses the same context-theme title", async () => {
    const { title } = await processMeetingWithAI(CLEAN_FIXTURE);
    assert(
      title === EXPECTED_CONTEXT_TITLE,
      `Expected context theme "${EXPECTED_CONTEXT_TITLE}", got "${title}"`
    );
    assertThemeGuardrails(title, CLEAN_FIXTURE);
  });

  await runTest("Explicit Topic header wins over classified themes", async () => {
    const fixture = ["Topic: Pricing review", ...CLEAN_SCRIPT_LINES.map((line) => `Yogendra: ${line}`)].join("\n");
    const { title } = await processMeetingWithAI(fixture);
    assert(title === "Pricing review", `Expected explicit header to win, got "${title}"`);
  });

  await runTest("Decision theme is used when no context line is present", async () => {
    const fixture = [
      "Alex: we have decided to launch the public beta to our waitlist first, before we build team workspaces",
      "Alex: I will send the launch notes tomorrow",
    ].join("\n");
    const { title } = await processMeetingWithAI(fixture);
    assert(
      title === "Waitlist-first launch before team workspaces",
      `Expected decision theme, got "${title}"`
    );
    assertThemeGuardrails(title, fixture);
  });

  await runTest("Two-speaker casual chat with no themes keeps the 1-on-1 fallback", async () => {
    const fixture = [
      "Alex: thanks for making time today",
      "Priya: no problem at all",
      "Alex: the weekend was quiet",
      "Priya: same here mostly errands",
    ].join("\n");
    const { title } = await processMeetingWithAI(fixture);
    assert(title === "1-on-1 Sync (Alex & Priya)", `Expected 1-on-1 fallback, got "${title}"`);
  });

  await runTest("Single named speaker with no themes keeps the meeting-note fallback", async () => {
    const fixture = [
      "Maya: thanks for making time today",
      "Maya: the weekend was quiet",
      "Maya: mostly errands and rest",
    ].join("\n");
    const { title } = await processMeetingWithAI(fixture);
    assert(title === "Meeting Note • Maya", `Expected meeting-note fallback, got "${title}"`);
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

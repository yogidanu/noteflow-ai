/**
 * Regression suite: transcript sentence merging.
 *
 * Bug (reported from a real recording, 2026-10-24): pause-split fragments
 * became separate transcript lines — "We need to work on the" / "production
 * of this application." — because recognizers cut at pauses, not sentences.
 *
 * Contract: consecutive fragments merge ONLY when same speaker + short gap
 * + previous fragment has no terminal punctuation. Speaker changes, real
 * sentence boundaries and long pauses are never merged.
 */
import { mergeTranscriptSegments } from "../src/lib/transcriptMerge";
import { mergeUtterances } from "../server/services/sttService";

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

const S = (speaker: string, timestamp: string, text: string, startSec?: number, endSec?: number) => ({
  speaker,
  timestamp,
  text,
  startSec,
  endSec,
});

console.log("== Client merge (Web Speech segments) ==");

// The exact fragments from the reported screenshot
const shot = [
  S("Speaker 1", "00:00", "Okay."),
  S("Speaker 1", "00:02", "Hello. Hello,. Hello. Hello. Hello. Testing. Testing. Testing. We need to work on this area."),
  S("Speaker 1", "00:09", "And"),
  S("Speaker 1", "00:10", "Still working."),
  S("Speaker 1", "00:12", "Mic may flickering with the"),
  S("Speaker 1", "00:14", "We need to work on the"),
  S("Speaker 1", "00:15", "production of this application."),
  S("Speaker 1", "00:17", "I am going to"),
  S("Speaker 1", "00:18", "allocate"),
];
const m = mergeTranscriptSegments(shot);
check("screenshot: 9 fragments become 5 lines", m.length === 5, m.map((x) => x.text));
check("screenshot: 'Okay.' stays its own line", m[0].text === "Okay.");
check(
  "screenshot: mid-sentence split glued",
  m.some((x) => x.text === "Mic may flickering with the We need to work on the production of this application."),
  m.map((x) => x.text),
);
check(
  "screenshot: dangling fragment glued",
  m.some((x) => x.text === "I am going to allocate"),
  m.map((x) => x.text),
);
check("screenshot: merged line keeps first timestamp", m[3].timestamp === "00:12" || m.some((x) => x.timestamp === "00:12"));

const two = mergeTranscriptSegments([
  S("Asha Rao", "00:00", "We need to fix the"),
  S("Ravi Kumar", "00:01", "payment retry first."),
]);
check("speaker change never merges", two.length === 2, two);

const boundary = mergeTranscriptSegments([
  S("Asha Rao", "00:00", "Let's ship it on Friday."),
  S("Asha Rao", "00:02", "Any objections?"),
]);
check("real sentence boundary never merges", boundary.length === 2, boundary);

const longGap = mergeTranscriptSegments(
  [S("Asha Rao", "00:00", "We need to fix the", 0, 1), S("Asha Rao", "00:20", "payment flow", 20, 21)],
);
check("long pause (>3s) never merges", longGap.length === 2, longGap);

const chain = mergeTranscriptSegments([
  S("Asha Rao", "00:00", "So the plan is"),
  S("Asha Rao", "00:01", "to move the launch"),
  S("Asha Rao", "00:02", "to next Monday."),
]);
check("three fragments chain-merge", chain.length === 1 && chain[0].text === "So the plan is to move the launch to next Monday.", chain);

console.log("== Server merge (Deepgram utterances) ==");
const dg = mergeUtterances([
  { speaker: 0, start: 0, end: 0.8, text: "We need to work on the" },
  { speaker: 0, start: 1.6, end: 3.2, text: "production of this application." },
  { speaker: 1, start: 3.4, end: 4.0, text: "Agreed." },
  { speaker: 0, start: 4.2, end: 5.0, text: "I am going to" },
  { speaker: 0, start: 5.4, end: 6.0, text: "allocate the budget today." },
]);
check("deepgram: 5 utterances become 3 lines", dg.length === 3, dg);
check("deepgram: merged text correct", dg[0].text === "We need to work on the production of this application.", dg[0]);
check("deepgram: merged end time extends", dg[0].end === 3.2, dg[0]);
check("deepgram: other speaker untouched", dg[1].speaker === 1 && dg[1].text === "Agreed.", dg[1]);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);

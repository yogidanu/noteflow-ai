/**
 * Transcript source visibility: resolveFinalTranscriptWithSource must
 * report WHICH source won the Deepgram-first precedence, so the UI can
 * badge it and a Web Speech fallback is never silent again.
 */
import {
  resolveFinalTranscript,
  resolveFinalTranscriptWithSource,
} from "../src/lib/resolveFinalTranscript";

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

const dg = "Speaker 1 [00:01]: Hello, this is the Deepgram transcript.";
const ws = "you [00:01]: hello this is the live captions";
const sess = "Speaker 1 [00:01]: Hello, from the backend session.";

let r = resolveFinalTranscriptWithSource({ sessionTranscript: sess, deepgramTranscript: dg, webSpeechTranscript: ws });
check("session wins + reported", r.source === "session" && r.transcript === sess, r);

r = resolveFinalTranscriptWithSource({ sessionTranscript: "", deepgramTranscript: dg, webSpeechTranscript: ws });
check("deepgram wins over webspeech + reported", r.source === "deepgram" && r.transcript === dg, r);

r = resolveFinalTranscriptWithSource({ sessionTranscript: null, deepgramTranscript: "  ", webSpeechTranscript: ws });
check("whitespace deepgram is unusable; webspeech reported", r.source === "webspeech" && r.transcript === ws, r);

r = resolveFinalTranscriptWithSource({ sessionTranscript: "", deepgramTranscript: "", webSpeechTranscript: "" });
check("nothing usable -> source none, empty transcript", r.source === "none" && r.transcript === "", r);

check(
  "legacy wrapper still returns just the transcript",
  resolveFinalTranscript({ deepgramTranscript: dg, webSpeechTranscript: ws }) === dg
);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);

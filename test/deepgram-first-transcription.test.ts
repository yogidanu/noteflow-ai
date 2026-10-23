/**
 * Regression suite: Deepgram-first transcription (2026-10-23)
 *
 * Pins the defect from the live runs: in useMeetRecord.stopRecording the
 * browser Web Speech transcript won by default — it seeded
 * resolvedTranscript, so the backend Deepgram STT call was gated behind
 * `!resolvedTranscript` and effectively never ran when Web Speech had
 * produced anything. Web Speech has no custom-vocabulary support, so
 * domain terms came back as homophones (waitlist → "weightlif" /
 * "weightless", NoteFlow → "note to a", Pro tier → garbled) and fed
 * synthesis.
 *
 * New contract:
 *  1. Final-transcript precedence is: backend session transcript >
 *     Deepgram (apiClient.transcribeAudio) > Web Speech (fallback only).
 *     The decision lives in the pure helper resolveFinalTranscript,
 *     which stopRecording uses.
 *  2. The server Deepgram request targets Nova-3 and uses `keyterm`
 *     prompting for the domain vocabulary. (The previous round pinned
 *     Nova-2 + `keywords` and deliberately withheld `keyterm` because
 *     it is a Nova-3 parameter; upgrading the model is what makes
 *     keyterm valid, so the request builder must send keyterm and
 *     must NOT send the Nova-2 `keywords` param.)
 */

import { buildDeepgramParams, DEEPGRAM_KEYTERMS } from "../server/services/sttService.js";
import { resolveFinalTranscript } from "../src/lib/resolveFinalTranscript";

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
    console.log(`  ✓ ${name}`);
  } catch (err: any) {
    console.error(`  ✗ ${name}\n      ${err.message}`);
  }
}

console.log("\n[deepgram-first-transcription] Deepgram request builder");

runTest("Deepgram request targets model nova-3 (not nova-2)", () => {
  const params = buildDeepgramParams();
  assert(params.get("model") === "nova-3", `expected model=nova-3, got ${params.get("model")}`);
});

runTest("Deepgram request sends keyterm prompting for every domain term", () => {
  const params = buildDeepgramParams();
  const keyterms = params.getAll("keyterm");
  for (const term of ["NoteFlow", "NoteFlow AI", "waitlist", "Pro tier", "end-to-end"]) {
    assert(keyterms.includes(term), `missing keyterm "${term}" (got: ${keyterms.join(", ")})`);
    assert((DEEPGRAM_KEYTERMS as readonly string[]).includes(term), `DEEPGRAM_KEYTERMS missing "${term}"`);
  }
});

runTest("Deepgram request does NOT send the Nova-2 keywords param", () => {
  const params = buildDeepgramParams();
  assert(params.getAll("keywords").length === 0, "keywords param must not be sent with Nova-3 keyterm prompting");
});

runTest("Deepgram request keeps diarization / formatting options", () => {
  const params = buildDeepgramParams();
  assert(params.get("diarize") === "true", "diarize=true expected");
  assert(params.get("utterances") === "true", "utterances=true expected");
  assert(params.get("smart_format") === "true", "smart_format=true expected");
  assert(params.get("punctuate") === "true", "punctuate=true expected");
});

console.log("\n[deepgram-first-transcription] Final transcript precedence");

const SESSION = "Yogendra [00:12]: session transcript";
const DEEPGRAM = "Yogendra [00:12]: deepgram transcript with waitlist spelled right";
const WEB_SPEECH = "Yogendra [00:12]: web speech transcript with weightlif";

runTest("Session transcript beats Deepgram and Web Speech", () => {
  const out = resolveFinalTranscript({
    sessionTranscript: SESSION,
    deepgramTranscript: DEEPGRAM,
    webSpeechTranscript: WEB_SPEECH,
  });
  assert(out === SESSION, `expected session transcript, got: ${out}`);
});

runTest("Deepgram result beats a non-empty Web Speech transcript", () => {
  const out = resolveFinalTranscript({
    sessionTranscript: "",
    deepgramTranscript: DEEPGRAM,
    webSpeechTranscript: WEB_SPEECH,
  });
  assert(out === DEEPGRAM, `expected Deepgram transcript to win over Web Speech, got: ${out}`);
});

runTest("Web Speech is used when Deepgram returns empty", () => {
  const out = resolveFinalTranscript({
    sessionTranscript: null,
    deepgramTranscript: "",
    webSpeechTranscript: WEB_SPEECH,
  });
  assert(out === WEB_SPEECH, `expected Web Speech fallback, got: ${out}`);
});

runTest("Web Speech is used when Deepgram is unavailable (undefined/null)", () => {
  const out = resolveFinalTranscript({
    deepgramTranscript: undefined,
    webSpeechTranscript: WEB_SPEECH,
  });
  assert(out === WEB_SPEECH, `expected Web Speech fallback, got: ${out}`);
});

runTest("Whitespace-only candidates are not usable; all-empty resolves to empty", () => {
  const out = resolveFinalTranscript({
    sessionTranscript: "   ",
    deepgramTranscript: "\n",
    webSpeechTranscript: "",
  });
  assert(out === "", `expected empty string, got: ${JSON.stringify(out)}`);
});

console.log(`\nTOTAL: ${total} | PASSED: ${passed} | FAILED: ${total - passed}`);
console.log(`PASS RATE: ${((passed / total) * 100).toFixed(1)}%`);
if (passed !== total) process.exit(1);

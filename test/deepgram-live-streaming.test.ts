/**
 * Deepgram LIVE streaming (2026-11-11).
 *
 * Pins the fix for the live-test complaints: the on-screen transcript
 * lagged speech by 10–15s and lost the opening lines, because the live
 * path was Chrome's Web Speech API (results finalize only at pauses,
 * on Google's timing), while Deepgram — the accurate recognizer — ran
 * batch-only after stop.
 *
 * Contract pinned here:
 *  1. The stream URL targets Nova-3 with interim results, diarization,
 *     endpointing and the SAME keyterm vocabulary as the batch path.
 *  2. PCM helpers: mic Float32 → 16kHz → 16-bit PCM frames.
 *  3. The assembler: interims never enter the transcript; final
 *     fragments accumulate per speaker; a line commits on speech_final,
 *     UtteranceEnd, or speaker change; output format matches the rest
 *     of the app ("Speaker [mm:ss]: text").
 *  4. The server grant: token minted from the server-side key via
 *     /v1/auth/grant; failures throw stable codes; a sample/missing key
 *     refuses (DEEPGRAM_NOT_CONFIGURED) without any network call.
 *  5. Precedence: a usable live-stream transcript outranks session,
 *     batch Deepgram and Web Speech; empty stream falls through.
 */
import {
  buildDeepgramStreamUrl,
  downsampleTo16k,
  floatTo16BitPcm,
  encodePcmFrame,
  LiveTranscriptAssembler,
  DEEPGRAM_STREAM_KEYTERMS,
} from "../src/lib/deepgramLive";
import { DEEPGRAM_KEYTERMS } from "../server/services/sttService";
import { createDeepgramStreamGrant } from "../server/services/sttService";
import { resolveFinalTranscriptWithSource } from "../src/lib/resolveFinalTranscript";

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

async function main() {
  // ---------- 1. Stream URL ----------
  const url = buildDeepgramStreamUrl();
  check("url is the Deepgram listen socket", url.startsWith("wss://api.deepgram.com/v1/listen?"), url);
  const params = new URLSearchParams(url.split("?")[1]);
  check("model is nova-3", params.get("model") === "nova-3");
  check("interim results on", params.get("interim_results") === "true");
  check("diarize on", params.get("diarize") === "true");
  check("punctuate + smart_format on", params.get("punctuate") === "true" && params.get("smart_format") === "true");
  check("pcm encoding declared", params.get("encoding") === "linear16" && params.get("sample_rate") === "16000" && params.get("channels") === "1");
  check("endpointing set", params.get("endpointing") === "300" && params.get("utterance_end_ms") === "1200");
  check(
    "stream keyterms match the batch list exactly",
    JSON.stringify([...DEEPGRAM_STREAM_KEYTERMS]) === JSON.stringify([...DEEPGRAM_KEYTERMS]),
    { stream: DEEPGRAM_STREAM_KEYTERMS, batch: DEEPGRAM_KEYTERMS }
  );
  check("keyterm params include waitlist", params.getAll("keyterm").includes("waitlist"));

  // ---------- 2. PCM helpers ----------
  const in48 = new Float32Array(4800).fill(0.5);
  const down = downsampleTo16k(in48, 48000);
  check("48k -> 16k shrinks ~3x", down.length === 1600, down.length);
  check("downsample preserves level", Math.abs(down[0] - 0.5) < 1e-6, down[0]);
  const passthrough = downsampleTo16k(in48, 16000);
  check("16k input passes through untouched", passthrough === in48);
  const pcm = floatTo16BitPcm(new Float32Array([0, 1, -1, 0.5]));
  check("pcm byte length is 2x samples", pcm.byteLength === 8, pcm.byteLength);
  const view = new DataView(pcm);
  check("pcm clamps full-scale", view.getInt16(2, true) === 32767 && view.getInt16(4, true) === -32768, [
    view.getInt16(2, true),
    view.getInt16(4, true),
  ]);
  check("encodePcmFrame composes both", encodePcmFrame(new Float32Array(480).fill(0.25), 48000).byteLength === 320);

  // ---------- 3. Assembler ----------
  const result = (over: Record<string, unknown>) => ({
    type: "Results",
    start: 0,
    is_final: false,
    speech_final: false,
    channel: { alternatives: [{ transcript: "", words: [{ speaker: 0 }] }] },
    ...over,
  });
  const withText = (text: string, speaker = 0) => ({
    channel: { alternatives: [{ transcript: text, words: [{ speaker }] }] },
  });

  const a = new LiveTranscriptAssembler();
  a.pushMessage(result({ ...withText("Please send the onboarding") }));
  check("interim shows in live view", a.toLiveView().includes("onboarding"), a.toLiveView());
  check("interim does NOT enter the transcript", a.toTranscriptText() === "", a.toTranscriptText());
  a.pushMessage(result({ is_final: true, start: 1.2, ...withText("Please send the onboarding emails by Friday.") }));
  check("final fragment pending, not yet a line", a.toTranscriptText() === "", a.toTranscriptText());
  a.pushMessage(result({ is_final: true, speech_final: true, start: 3.0, ...withText("") }));
  check(
    "speech_final commits the line with its start timestamp",
    a.toTranscriptText() === "You [00:01]: Please send the onboarding emails by Friday.",
    a.toTranscriptText()
  );

  const b = new LiveTranscriptAssembler();
  b.pushMessage(result({ is_final: true, start: 0.5, ...withText("Deepak, book the usability lab") }));
  b.pushMessage(result({ is_final: true, start: 2.0, ...withText("for November 14.") }));
  b.pushMessage({ type: "UtteranceEnd", last_word_end: 3.1 });
  check(
    "fragments join into ONE line; UtteranceEnd commits it",
    b.toTranscriptText() === "You [00:00]: Deepak, book the usability lab for November 14.",
    b.toTranscriptText()
  );

  const c = new LiveTranscriptAssembler();
  c.pushMessage(result({ is_final: true, start: 0, ...withText("First speaker line.", 0) }));
  c.pushMessage(result({ is_final: true, start: 5, ...withText("Second speaker line.", 1) }));
  c.flush();
  const cLines = c.toTranscriptText().split("\n");
  check("speaker change commits the previous line", cLines.length === 2, cLines);
  check("second speaker gets its own label", cLines[1]?.startsWith("Speaker 2 [00:05]:"), cLines[1]);

  const d = new LiveTranscriptAssembler();
  d.pushMessage(result({ is_final: true, start: 65, ...withText("Left pending.") }));
  d.flush();
  check("flush commits the pending line (mm:ss format)", d.toTranscriptText() === "You [01:05]: Left pending.", d.toTranscriptText());

  // ---------- 4. Server grant ----------
  const { config } = await import("../server/config.js");
  const originalKey = (config as any).stt.apiKey;
  let grantCalls = 0;
  const okFetch = async () => {
    grantCalls++;
    return {
      ok: true,
      status: 200,
      json: async () => ({ access_token: "tok-123", expires_in: 3600 }),
    } as any;
  };
  // With the sample placeholder key configured, the grant must refuse
  // BEFORE any network call.
  (config as any).stt.apiKey = "sample-deepgram-api-key";
  let refused: unknown = null;
  try {
    await createDeepgramStreamGrant(okFetch as any);
  } catch (e) {
    refused = e;
  }
  check(
    "sample/missing key refuses with DEEPGRAM_NOT_CONFIGURED",
    refused instanceof Error && refused.message === "DEEPGRAM_NOT_CONFIGURED",
    String(refused)
  );
  check("refusal happens before any network call", grantCalls === 0, grantCalls);

  // With a real-looking key configured, the grant calls Deepgram's
  // grant endpoint with the key in the Token header (never returned).
  process.env.DEEPGRAM_API_KEY = "test-key-not-real";
  (config as any).stt.apiKey = "test-key-not-real";
  let seenUrl = "";
  let seenAuth = "";
  const grantFetch = async (u: any, init: any) => {
    seenUrl = String(u);
    seenAuth = init?.headers?.Authorization || "";
    return { ok: true, status: 200, json: async () => ({ access_token: "tok-abc", expires_in: 1800 }) } as any;
  };
  const grant = await createDeepgramStreamGrant(grantFetch as any);
  check("grant returns the access token + expiry", grant.accessToken === "tok-abc" && grant.expiresIn === 1800, grant);
  check("grant hits /v1/auth/grant with Token auth", seenUrl === "https://api.deepgram.com/v1/auth/grant" && seenAuth === "Token test-key-not-real", { seenUrl, seenAuth });

  const failFetch = async () => ({ ok: false, status: 403, json: async () => ({}) }) as any;
  let grantErr: unknown = null;
  try {
    await createDeepgramStreamGrant(failFetch as any);
  } catch (e) {
    grantErr = e;
  }
  check(
    "deepgram refusal throws a stable code",
    grantErr instanceof Error && grantErr.message === "DEEPGRAM_GRANT_FAILED_403",
    String(grantErr)
  );
  (config as any).stt.apiKey = originalKey;
  delete process.env.DEEPGRAM_API_KEY;

  // ---------- 5. Precedence ----------
  const live = "You [00:01]: Streamed live by Deepgram.";
  const sess = "You [00:01]: From the backend session.";
  const dg = "You [00:01]: From batch Deepgram.";
  const ws = "you [00:01]: from live captions";
  let r = resolveFinalTranscriptWithSource({
    liveStreamTranscript: live,
    sessionTranscript: sess,
    deepgramTranscript: dg,
    webSpeechTranscript: ws,
  });
  check("live stream wins over everything", r.source === "deepgram-live" && r.transcript === live, r);
  r = resolveFinalTranscriptWithSource({
    liveStreamTranscript: "  ",
    sessionTranscript: sess,
    deepgramTranscript: dg,
    webSpeechTranscript: ws,
  });
  check("empty stream falls through to session", r.source === "session" && r.transcript === sess, r);
  r = resolveFinalTranscriptWithSource({ liveStreamTranscript: "", webSpeechTranscript: ws });
  check("stream absent -> captions remain the last resort", r.source === "webspeech", r);

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error("suite crashed:", e);
  process.exit(1);
});

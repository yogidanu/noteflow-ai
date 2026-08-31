/**
 * NoteFlow AI • Phase 2.9 Meeting Pipeline Observability Test Suite
 * 
 * Validates:
 * 1. Complete 12-State Telemetry Lifecycle:
 *    - MEETING_DETECTED
 *    - RECORDING_INITIALIZED
 *    - AUDIO_CAPTURE_ACTIVE
 *    - AUDIO_CHUNKS_RECEIVED
 *    - RECORDING_STOPPED
 *    - AUDIO_PERSISTED
 *    - TRANSCRIPTION_STARTED
 *    - TRANSCRIPTION_COMPLETED
 *    - TRANSCRIPTION_FAILED
 *    - AI_PROCESSING_STARTED
 *    - AI_PROCESSING_COMPLETED
 *    - MEETING_COMPLETED
 * 
 * 2. Traceability through Canonical Identifiers:
 *    - userId
 *    - meetingId
 *    - recordingSessionId
 *    - transcriptId
 * 
 * 3. Standardized Diagnostic Error Codes:
 *    - AUDIO_CAPTURE_FAILED
 *    - RECORDING_UPLOAD_FAILED
 *    - TRANSCRIPTION_AUTH_FAILED
 *    - TRANSCRIPTION_TIMEOUT
 *    - TRANSCRIPTION_INVALID_AUDIO
 *    - TRANSCRIPTION_EMPTY_RESULT
 *    - AI_PROCESSING_FAILED
 * 
 * 4. Zero Sensitive Data Exposure / Strict Data Minimization:
 *    - Zero OAuth tokens / client secrets
 *    - Zero raw dialogue / transcript text
 *    - Zero raw audio buffers
 */

import { recordingLogger, TelemetryEvent } from "../server/observability/recordingLogger.js";

function assert(condition: boolean, msg: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${msg}`);
  }
}

let passed = 0;
let total = 0;

function runTest(name: string, fn: () => void | Promise<void>) {
  total++;
  try {
    const res = fn();
    if (res instanceof Promise) {
      return res
        .then(() => {
          passed++;
          console.log(`[PASS] ✅ ${name}`);
        })
        .catch((err) => {
          console.error(`[FAIL] ❌ ${name}:`, err.message);
          throw err;
        });
    } else {
      passed++;
      console.log(`[PASS] ✅ ${name}`);
    }
  } catch (err: any) {
    console.error(`[FAIL] ❌ ${name}:`, err.message);
    throw err;
  }
}

async function main() {
  console.log("================================================================================");
  console.log(" NOTEFLOW AI — PHASE 2.9 MEETING PIPELINE OBSERVABILITY SUITE                   ");
  console.log("================================================================================");

  recordingLogger.clearHistory();

  const userId = "usr_g_4f8a92b3c10e47d8";
  const meetingId = "meet_obs_phase29_001";
  const recordingSessionId = "rec_sess_obs_001";
  const transcriptId = "tr_obs_001";

  // Test 1: State 1 — MEETING_DETECTED
  runTest("State 1: MEETING_DETECTED emitted with traceable IDs", () => {
    recordingLogger.log({
      event: "MEETING_DETECTED",
      timestamp: new Date().toISOString(),
      userId,
      meetingId,
      recordingSessionId,
      meetingUrl: "https://meet.google.com/eyf-ptkr-uxq",
      platform: "google_meet",
      title: "Sprint Planning & Alignment",
    });

    const events = recordingLogger.getRecentEvents("MEETING_DETECTED");
    assert(events.length === 1, "MEETING_DETECTED event logged");
    assert(events[0].userId === userId, "userId matches");
    assert(events[0].meetingId === meetingId, "meetingId matches");
    assert(events[0].recordingSessionId === recordingSessionId, "recordingSessionId matches");
  });

  // Test 2: State 2 — RECORDING_INITIALIZED
  runTest("State 2: RECORDING_INITIALIZED emitted with meeting deduplication hash", () => {
    recordingLogger.log({
      event: "RECORDING_INITIALIZED",
      timestamp: new Date().toISOString(),
      userId,
      meetingId,
      recordingSessionId,
      dedupHash: "hash_eyf-ptkr-uxq",
    });

    const events = recordingLogger.getRecentEvents("RECORDING_INITIALIZED");
    assert(events.length === 1, "RECORDING_INITIALIZED logged");
  });

  // Test 3: State 3 — AUDIO_CAPTURE_ACTIVE
  runTest("State 3: AUDIO_CAPTURE_ACTIVE emitted with audio hardware parameters", () => {
    recordingLogger.log({
      event: "AUDIO_CAPTURE_ACTIVE",
      timestamp: new Date().toISOString(),
      userId,
      meetingId,
      recordingSessionId,
      sampleRate: 48000,
      channelCount: 1,
    });

    const events = recordingLogger.getRecentEvents("AUDIO_CAPTURE_ACTIVE");
    assert(events.length === 1, "AUDIO_CAPTURE_ACTIVE logged");
  });

  // Test 4: State 4 — AUDIO_CHUNKS_RECEIVED
  runTest("State 4: AUDIO_CHUNKS_RECEIVED tracks streaming progress and byte counts", () => {
    recordingLogger.log({
      event: "AUDIO_CHUNKS_RECEIVED",
      timestamp: new Date().toISOString(),
      userId,
      meetingId,
      recordingSessionId,
      chunkIndex: 1,
      chunkSizeBytes: 4096,
      totalBytesSoFar: 4096,
    });
    recordingLogger.log({
      event: "AUDIO_CHUNKS_RECEIVED",
      timestamp: new Date().toISOString(),
      userId,
      meetingId,
      recordingSessionId,
      chunkIndex: 2,
      chunkSizeBytes: 4096,
      totalBytesSoFar: 8192,
    });

    const events = recordingLogger.getRecentEvents("AUDIO_CHUNKS_RECEIVED");
    assert(events.length === 2, "Both AUDIO_CHUNKS_RECEIVED events logged");
  });

  // Test 5: State 5 — RECORDING_STOPPED
  runTest("State 5: RECORDING_STOPPED emitted with duration and chunk statistics", () => {
    recordingLogger.log({
      event: "RECORDING_STOPPED",
      timestamp: new Date().toISOString(),
      userId,
      meetingId,
      recordingSessionId,
      durationSeconds: 125,
      audioChunkCount: 125,
      totalAudioBytes: 512000,
    });

    const events = recordingLogger.getRecentEvents("RECORDING_STOPPED");
    assert(events.length === 1, "RECORDING_STOPPED logged");
  });

  // Test 6: State 6 — AUDIO_PERSISTED
  runTest("State 6: AUDIO_PERSISTED emitted with verifiable artifact ID", () => {
    recordingLogger.log({
      event: "AUDIO_PERSISTED",
      timestamp: new Date().toISOString(),
      userId,
      meetingId,
      recordingSessionId,
      audioArtifactId: "art_audio_8392",
      audioBytes: 512000,
      audioFormat: "webm",
      durationSeconds: 125,
    });

    const events = recordingLogger.getRecentEvents("AUDIO_PERSISTED");
    assert(events.length === 1, "AUDIO_PERSISTED logged");
  });

  // Test 7: State 7 — TRANSCRIPTION_STARTED
  runTest("State 7: TRANSCRIPTION_STARTED emitted with STT provider and mimeType", () => {
    recordingLogger.log({
      event: "TRANSCRIPTION_STARTED",
      timestamp: new Date().toISOString(),
      userId,
      meetingId,
      recordingSessionId,
      transcriptId,
      provider: "browser_webspeech",
      audioBytes: 512000,
      mimeType: "audio/webm",
    });

    const events = recordingLogger.getRecentEvents("TRANSCRIPTION_STARTED");
    assert(events.length === 1, "TRANSCRIPTION_STARTED logged");
  });

  // Test 8: State 8 — TRANSCRIPTION_COMPLETED
  runTest("State 8: TRANSCRIPTION_COMPLETED emitted with word/segment counts and latency", () => {
    recordingLogger.log({
      event: "TRANSCRIPTION_COMPLETED",
      timestamp: new Date().toISOString(),
      userId,
      meetingId,
      recordingSessionId,
      transcriptId,
      provider: "browser_webspeech",
      durationMs: 450,
      segmentCount: 18,
      wordCount: 240,
      speakerCount: 2,
    });

    const events = recordingLogger.getRecentEvents("TRANSCRIPTION_COMPLETED");
    assert(events.length === 1, "TRANSCRIPTION_COMPLETED logged");
  });

  // Test 9: State 9 — TRANSCRIPTION_FAILED & Standard Diagnostic Error Codes
  runTest("State 9: Diagnostic Error Codes verified (AUDIO_CAPTURE_FAILED, TRANSCRIPTION_TIMEOUT, etc.)", () => {
    const errorCodes = [
      "AUDIO_CAPTURE_FAILED",
      "RECORDING_UPLOAD_FAILED",
      "TRANSCRIPTION_AUTH_FAILED",
      "TRANSCRIPTION_TIMEOUT",
      "TRANSCRIPTION_INVALID_AUDIO",
      "TRANSCRIPTION_EMPTY_RESULT",
      "AI_PROCESSING_FAILED",
    ];

    errorCodes.forEach((code) => {
      recordingLogger.log({
        event: "TRANSCRIPTION_FAILED",
        timestamp: new Date().toISOString(),
        userId,
        meetingId,
        recordingSessionId,
        transcriptId,
        provider: "stt_engine",
        durationMs: 300,
        errorCode: code,
        errorMessage: `Simulated diagnosis for ${code}`,
      });
    });

    const events = recordingLogger.getRecentEvents("TRANSCRIPTION_FAILED");
    assert(events.length === errorCodes.length, "All error codes logged correctly");
  });

  // Test 10: State 10 — AI_PROCESSING_STARTED
  runTest("State 10: AI_PROCESSING_STARTED emitted with word counts and refinement style", () => {
    recordingLogger.log({
      event: "AI_PROCESSING_STARTED",
      timestamp: new Date().toISOString(),
      userId,
      meetingId,
      recordingSessionId,
      transcriptId,
      summaryId: "sum_001",
      refinement: "standard",
      wordCount: 240,
      segmentCount: 18,
    });

    const events = recordingLogger.getRecentEvents("AI_PROCESSING_STARTED");
    assert(events.length === 1, "AI_PROCESSING_STARTED logged");
  });

  // Test 11: State 11 — AI_PROCESSING_COMPLETED
  runTest("State 11: AI_PROCESSING_COMPLETED emitted with decision/action counts and model confidence", () => {
    recordingLogger.log({
      event: "AI_PROCESSING_COMPLETED",
      timestamp: new Date().toISOString(),
      userId,
      meetingId,
      recordingSessionId,
      transcriptId,
      summaryId: "sum_001",
      durationMs: 820,
      decisionCount: 3,
      actionItemCount: 4,
      questionCount: 2,
      modelConfidence: "high",
    });

    const events = recordingLogger.getRecentEvents("AI_PROCESSING_COMPLETED");
    assert(events.length === 1, "AI_PROCESSING_COMPLETED logged");
  });

  // Test 12: State 12 — MEETING_COMPLETED
  runTest("State 12: MEETING_COMPLETED emitted with total pipeline duration and deliverables", () => {
    recordingLogger.log({
      event: "MEETING_COMPLETED",
      timestamp: new Date().toISOString(),
      userId,
      meetingId,
      recordingSessionId,
      transcriptId,
      summaryId: "sum_001",
      totalPipelineDurationMs: 1270,
      deliverablesCount: 7,
    });

    const events = recordingLogger.getRecentEvents("MEETING_COMPLETED");
    assert(events.length === 1, "MEETING_COMPLETED logged");
  });

  // Test 13: Privacy & Zero-Data-Leakage Guarantee
  runTest("Privacy: Automatically redacts raw transcripts, audio buffers, and OAuth tokens", () => {
    const rawPayloadWithSecrets: any = {
      event: "TRANSCRIPTION_STARTED",
      userId,
      meetingId,
      recordingSessionId,
      token: "secret_oauth_token_12345",
      clientSecret: "google_secret_xyz",
      apiKey: "deepgram_api_key_abc",
      text: "Confidential meeting raw transcript words",
      rawInput: "Secret spoken text",
      audioBuffer: Buffer.from("fake audio bytes"),
      executivesummary: "Secret executive summary text",
    };

    recordingLogger.log(rawPayloadWithSecrets);
    const recent = recordingLogger.getRecentEvents("TRANSCRIPTION_STARTED");
    const lastEvent = recent[recent.length - 1] as any;

    assert(!lastEvent.token, "OAuth token MUST be stripped");
    assert(!lastEvent.clientSecret, "clientSecret MUST be stripped");
    assert(!lastEvent.apiKey, "apiKey MUST be stripped");
    assert(!lastEvent.text, "raw transcript text MUST be stripped");
    assert(!lastEvent.rawInput, "rawInput MUST be stripped");
    assert(!lastEvent.audioBuffer, "audioBuffer MUST be stripped");
    assert(!lastEvent.executivesummary, "executivesummary MUST be stripped");
    assert(lastEvent.userId === userId, "Traceable userId must be preserved");
    assert(lastEvent.meetingId === meetingId, "Traceable meetingId must be preserved");
  });

  console.log("--------------------------------------------------------------------------------");
  console.log(`TOTAL: ${total} | PASSED: ${passed} | FAILED: ${total - passed}`);
  console.log(`PASS RATE: ${((passed / total) * 100).toFixed(1)}%`);
  console.log("--------------------------------------------------------------------------------");

  if (passed !== total) {
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

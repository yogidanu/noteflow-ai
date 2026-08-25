/**
 * NoteFlow AI • Production-Safe Recording Observability Test Suite
 * 
 * Verifies:
 * 1. RECORDING_STARTED
 * 2. AUDIO_SAVED
 * 3. RECORDING_STOPPED
 * 4. TRANSCRIPTION_STARTED
 * 5. TRANSCRIPTION_COMPLETED
 * 6. SUMMARY_STARTED
 * 7. SUMMARY_COMPLETED
 * 8. SYNC_STARTED & SYNC_COMPLETED
 * 9. Privacy & Sanitization: Zero audio buffers, raw text, or secrets logged.
 */

import { recordingLogger, TelemetryEvent } from "../server/observability/recordingLogger.js";
import { recordingSessionService } from "../server/services/recordingSessionService.js";
import { sttService } from "../server/services/sttService.js";
import { summaryService } from "../server/services/summaryService.js";
import fs from "fs";

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
  console.log("=================================================");
  console.log(" NOTEFLOW AI — OBSERVABILITY TELEMETRY SUITE     ");
  console.log("=================================================");

  recordingLogger.clearHistory();

  const userId = "user_obs_test_901";
  const meetingId = "meet_obs_test_901";
  const calendarEventId = "gcal_obs_evt_901";
  const dedupHash = `obs_hash_${Date.now()}`;

  // 1. Start Recording Session
  const session = recordingSessionService.createSession({
    meetingId,
    calendarEventId,
    userId,
    title: "Observability Telemetry Review",
    meetingUrl: "https://meet.google.com/qrp-zvmk-sxc",
    dedupHash,
  });

  recordingSessionService.startRecording(session.recordingSessionId, userId);

  // Test 1: RECORDING_STARTED
  runTest("Telemetry: RECORDING_STARTED emitted with safe identifiers", () => {
    const events = recordingLogger.getRecentEvents("RECORDING_STARTED");
    assert(events.length > 0, "RECORDING_STARTED event must be logged");
    const ev = events[events.length - 1] as any;
    assert(ev.userId === userId, "userId must match");
    assert(ev.meetingId === meetingId, "meetingId must match");
    assert(ev.recordingId === session.recordingSessionId, "recordingId must match");
    assert(Boolean(ev.timestamp), "timestamp must be present");
  });

  // 2. Append Audio Chunks
  const chunk1 = Buffer.alloc(1024, 0x1a);
  const chunk2 = Buffer.alloc(2048, 0x45);
  recordingSessionService.appendAudioChunk(session.recordingSessionId, chunk1);
  recordingSessionService.appendAudioChunk(session.recordingSessionId, chunk2);

  // Test 2: AUDIO_SAVED
  runTest("Telemetry: AUDIO_SAVED emitted with byte sizes and artifact IDs", () => {
    const events = recordingLogger.getRecentEvents("AUDIO_SAVED");
    assert(events.length >= 2, "AUDIO_SAVED events must be logged for each chunk");
    const ev = events[events.length - 1] as any;
    assert(ev.audioBytes === 3072, `Expected 3072 total audioBytes, got ${ev.audioBytes}`);
    assert(Boolean(ev.audioArtifactId), "audioArtifactId must be present");
    assert(ev.audioFormat === "webm", "audioFormat must be webm");
  });

  // 3. Stop Recording
  recordingSessionService.stopRecording(session.recordingSessionId, userId);

  // Test 3: RECORDING_STOPPED
  runTest("Telemetry: RECORDING_STOPPED emitted with duration and chunk count", () => {
    const events = recordingLogger.getRecentEvents("RECORDING_STOPPED");
    assert(events.length > 0, "RECORDING_STOPPED event must be logged");
    const ev = events[events.length - 1] as any;
    assert(ev.recordingId === session.recordingSessionId, "recordingId must match");
    assert(ev.audioChunkCount === 2, "audioChunkCount must be 2");
    assert(ev.totalAudioBytes === 3072, "totalAudioBytes must be 3072");
  });

  // 4. Transcription
  const spokenText = "<v Alex>Our launch date is September 15th.</v>\n<v Yogesh>I will prepare the design review.</v>";
  const transcriptPayload = await sttService.processAudioStream({
    meetingId,
    userId,
    recordingId: session.recordingSessionId,
    durationSeconds: 15,
    realTranscriptStream: spokenText,
  });

  // Test 4: TRANSCRIPTION_STARTED & TRANSCRIPTION_COMPLETED
  runTest("Telemetry: TRANSCRIPTION_STARTED & TRANSCRIPTION_COMPLETED emitted", () => {
    const startEvents = recordingLogger.getRecentEvents("TRANSCRIPTION_STARTED");
    const completeEvents = recordingLogger.getRecentEvents("TRANSCRIPTION_COMPLETED");
    assert(startEvents.length > 0, "TRANSCRIPTION_STARTED must be logged");
    assert(completeEvents.length > 0, "TRANSCRIPTION_COMPLETED must be logged");

    const comp = completeEvents[completeEvents.length - 1] as any;
    assert(comp.segmentCount === 2, `Expected 2 segments, got ${comp.segmentCount}`);
    assert(comp.wordCount > 0, "wordCount must be greater than 0");
    assert(typeof comp.durationMs === "number", "durationMs must be tracked");
  });

  // 5. Summary Generation
  (transcriptPayload as any).userId = userId;
  (transcriptPayload as any).recordingSessionId = session.recordingSessionId;
  (transcriptPayload as any).transcriptId = `tr_${session.recordingSessionId}`;
  const summaryResult = summaryService.generateSummary(transcriptPayload, "standard");

  // Test 5: SUMMARY_STARTED & SUMMARY_COMPLETED
  runTest("Telemetry: SUMMARY_STARTED & SUMMARY_COMPLETED emitted with decision counts", () => {
    const startEvents = recordingLogger.getRecentEvents("SUMMARY_STARTED");
    const completeEvents = recordingLogger.getRecentEvents("SUMMARY_COMPLETED");
    assert(startEvents.length > 0, "SUMMARY_STARTED must be logged");
    assert(completeEvents.length > 0, "SUMMARY_COMPLETED must be logged");

    const comp = completeEvents[completeEvents.length - 1] as any;
    assert(comp.decisionCount >= 1, "Must track decision count");
    assert(comp.actionItemCount >= 1, "Must track action item count");
    assert(comp.modelConfidence === "high", "modelConfidence must be high");
  });

  // 6. Complete Session & Sync
  recordingSessionService.completeSession(session.recordingSessionId, {
    transcript: transcriptPayload,
    summary: summaryResult,
  });

  // Test 6: SYNC_STARTED & SYNC_COMPLETED
  runTest("Telemetry: SYNC_STARTED & SYNC_COMPLETED emitted with parent IDs", () => {
    const startEvents = recordingLogger.getRecentEvents("SYNC_STARTED");
    const completeEvents = recordingLogger.getRecentEvents("SYNC_COMPLETED");
    assert(startEvents.length > 0, "SYNC_STARTED must be logged");
    assert(completeEvents.length > 0, "SYNC_COMPLETED must be logged");

    const comp = completeEvents[completeEvents.length - 1] as any;
    assert(comp.recordingId === session.recordingSessionId, "recordingId must match");
    assert(comp.transcriptId === `tr_${session.recordingSessionId}`, "transcriptId must match");
    assert(comp.summaryId === `sum_${session.recordingSessionId}`, "summaryId must match");
    assert(Array.isArray(comp.syncedEntities), "syncedEntities must be an array");
  });

  // Test 7: Privacy & Data Minimization Guard
  runTest("Privacy: All logged telemetry objects contain 0% raw speech, dialogue, or tokens", () => {
    const allEvents = recordingLogger.getRecentEvents();
    const serialized = JSON.stringify(allEvents);

    assert(!serialized.includes("Our launch date is September 15th."), "Log must NOT contain raw speech dialogue");
    assert(!serialized.includes("I will prepare the design review."), "Log must NOT contain raw dialogue text");
    assert(!serialized.includes("accessToken"), "Log must NOT contain accessToken key");
    assert(!serialized.includes("refreshToken"), "Log must NOT contain refreshToken key");
    assert(!serialized.includes("audioBuffer"), "Log must NOT contain audioBuffer");
  });

  console.log("-------------------------------------------------");
  console.log(`TOTAL: ${total} | PASSED: ${passed} | FAILED: ${total - passed}`);
  console.log(`PASS RATE: ${((passed / total) * 100).toFixed(1)}%`);
  console.log("-------------------------------------------------");

  if (session.audioArtifactPath && fs.existsSync(session.audioArtifactPath)) {
    try {
      fs.unlinkSync(session.audioArtifactPath);
    } catch {
      // ignore
    }
  }

  if (passed !== total) process.exit(1);
  process.exit(0);
}

main().catch((err) => {
  console.error("Test execution error:", err);
  process.exit(1);
});

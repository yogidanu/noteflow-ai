/**
 * NOTEFLOW AI — PHASE 2 REGRESSION SUITE
 * Complete Recording Session State Machine & Ingress Telemetry Test
 */

import { recordingSessionService } from "../server/services/recordingSessionService.js";
import fs from "fs";

console.log("=================================================");
console.log("  NOTEFLOW AI — RECORDING STATE MACHINE TEST     ");
console.log("=================================================");

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`[PASS] ✅ ${testName}`);
    if (detail) console.log(`       Detail: ${detail}`);
    passed++;
  } else {
    console.error(`[FAIL] ❌ ${testName}`);
    if (detail) console.error(`       Detail: ${detail}`);
    failed++;
  }
}

async function runRecordingStateMachineTests() {
  const meetingId = `meet_test_${Date.now()}`;
  const userId = `user_alice_${Date.now()}`;
  const meetingUrl = "https://meet.google.com/abc-defg-hij";

  // 1. Session Creation (INITIALIZING)
  const session = recordingSessionService.createSession({
    meetingId,
    userId,
    title: "Quarterly Design Review",
    meetingUrl,
  });

  assert(
    session !== null &&
      session.status === "INITIALIZING" &&
      session.audioChunkCount === 0 &&
      session.audioBytes === 0 &&
      Boolean(session.recordingSessionId) &&
      Boolean(session.audioArtifactId),
    "State: INITIALIZING — Recording session initialized with zero audio chunks",
    `Session ID: ${session.recordingSessionId}, Artifact: ${session.audioArtifactId}`
  );

  // 2. Start Recording (RECORDING)
  const startedSession = recordingSessionService.startRecording(session.recordingSessionId, userId);
  assert(
    startedSession.status === "RECORDING" &&
      typeof startedSession.startedAt === "number" &&
      typeof startedSession.audioCaptureStartedAt === "number",
    "State: RECORDING — Session transitions to RECORDING and timestamps capture start",
    `Started At: ${startedSession.startedAt}`
  );

  // 3. Audio Chunk Ingestion & Telemetry Tracking
  const chunk1 = Buffer.from("RIFF_SAMPLE_AUDIO_CHUNK_OPUS_PAYLOAD_01_BYTES");
  const chunk2 = Buffer.from("RIFF_SAMPLE_AUDIO_CHUNK_OPUS_PAYLOAD_02_BYTES_MORE");

  const appendRes1 = recordingSessionService.appendAudioChunk(session.recordingSessionId, chunk1, userId);
  assert(
    appendRes1.chunkIndex === 1 &&
      appendRes1.chunkBytes === chunk1.length &&
      appendRes1.session.audioBytes === chunk1.length &&
      appendRes1.session.audioChunkCount === 1,
    "Audio Ingress: Chunk 1 ingested and audio byte counter incremented",
    `Chunk 1: ${chunk1.length} bytes, Total: ${appendRes1.session.audioBytes} bytes`
  );

  const appendRes2 = recordingSessionService.appendAudioChunk(session.recordingSessionId, chunk2, userId);
  assert(
    appendRes2.chunkIndex === 2 &&
      appendRes2.session.audioChunkCount === 2 &&
      appendRes2.session.audioBytes === chunk1.length + chunk2.length,
    "Audio Ingress: Chunk 2 appended and cumulative byte stream verified",
    `Cumulative Audio: ${appendRes2.session.audioBytes} bytes across 2 chunks`
  );

  // 4. Verifiable Audio Artifact Storage on Disk
  if (startedSession.audioArtifactPath) {
    const fileExists = fs.existsSync(startedSession.audioArtifactPath);
    const diskBytes = fileExists ? fs.statSync(startedSession.audioArtifactPath).size : 0;
    assert(
      fileExists && diskBytes === chunk1.length + chunk2.length,
      "Audio Artifact Persistence: Audio artifact written to disk with exact byte match",
      `Disk path: ${startedSession.audioArtifactPath} (${diskBytes} bytes)`
    );
  }

  // 5. Pause and Resume Lifecycle
  const pausedSession = recordingSessionService.togglePause(session.recordingSessionId);
  assert(pausedSession.isPaused === true, "State: PAUSED — Audio recording paused successfully");

  const resumedSession = recordingSessionService.togglePause(session.recordingSessionId);
  assert(resumedSession.isPaused === false, "State: RESUMED — Audio recording resumed successfully");

  // 6. Stop Recording (STOPPING)
  const stoppedSession = recordingSessionService.stopRecording(session.recordingSessionId, userId);
  assert(
    stoppedSession.status === "STOPPING" &&
      typeof stoppedSession.stoppedAt === "number" &&
      stoppedSession.transcriptionStatus === "IN_PROGRESS",
    "State: STOPPING — Recording terminated and processing queued",
    `Stopped at: ${stoppedSession.stoppedAt}`
  );

  // 7. Complete Recording (COMPLETED)
  const completedSession = recordingSessionService.completeSession(session.recordingSessionId, {
    transcript: { text: "Sample transcript text" },
    summary: { title: "Executive Summary" },
  });

  assert(
    completedSession.status === "COMPLETED" &&
      completedSession.transcriptionStatus === "COMPLETED" &&
      completedSession.synchronizationStatus === "SYNCHRONIZED",
    "State: COMPLETED — Session finalized and synchronized with transcript and summary artifacts",
    `Status: ${completedSession.status}, Sync: ${completedSession.synchronizationStatus}`
  );

  // 8. Error & Failure Handling (FAILED)
  const errorSession = recordingSessionService.createSession({
    meetingId: `meet_err_${Date.now()}`,
    userId,
    title: "Fault Injected Meeting",
  });
  recordingSessionService.startRecording(errorSession.recordingSessionId, userId);
  const failedSession = recordingSessionService.failSession(
    errorSession.recordingSessionId,
    "MICROPHONE_DISCONNECTED",
    "User unplugged external USB audio interface."
  );

  assert(
    failedSession.status === "FAILED" &&
      failedSession.errorCode === "MICROPHONE_DISCONNECTED" &&
      failedSession.transcriptionStatus === "FAILED",
    "State: FAILED — Session failure with diagnostic error code and message",
    `Error Code: ${failedSession.errorCode}`
  );

  console.log("-------------------------------------------------");
  console.log(`TOTAL: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log(`PASS RATE: ${((passed / (passed + failed)) * 100).toFixed(1)}%`);
  console.log("-------------------------------------------------");

  if (failed > 0) {
    process.exit(1);
  }
}

runRecordingStateMachineTests().catch((err) => {
  console.error(err);
  process.exit(1);
});

/**
 * NoteFlow AI • Real Meeting Synchronization & Lineage Verification Suite
 * 
 * Acceptance Criteria:
 * 1. Spoken input:
 *    "Our launch date is September 15th.
 *     Yogesh will prepare the design review.
 *     The next meeting is on Friday."
 * 2. Transcript contains actual spoken statements.
 * 3. AI Summary derives:
 *    - Decision: Launch date is September 15th.
 *    - Action Item: Yogesh to prepare the design review.
 *    - Next meeting: Friday.
 * 4. Zero sample data (No Sarah Chen, Carlos Mendez, Q3 Roadmap, Google Search budget).
 * 5. Data Lineage: User -> Meeting -> Recording -> Transcript -> Summary correctly linked.
 */

import { sttService } from "../server/services/sttService.js";
import { summaryService } from "../server/services/summaryService.js";
import { recordingSessionService } from "../server/services/recordingSessionService.js";

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
  console.log(" NOTEFLOW AI — REAL MEETING SYNC & LINEAGE SUITE ");
  console.log("=================================================");

  const spokenDialogue = [
    "<v Yogesh>Our launch date is September 15th.</v>",
    "<v Yogesh>Yogesh will prepare the design review.</v>",
    "<v Yogesh>The next meeting is on Friday.</v>",
  ].join("\n");

  const userId = "user_yogesh_test_101";
  const meetingId = "meet_launch_sync_2026";
  const dedupHash = `hash_sync_${Date.now()}`;

  // 1. Initialize recording session
  const session = recordingSessionService.createSession({
    meetingId,
    userId,
    title: "Launch & Design Review Sync",
    dedupHash,
  });

  // 2. Process real speech through STT service
  const transcriptPayload = await sttService.processAudioStream({
    meetingId: session.meetingId,
    durationSeconds: 45,
    realTranscriptStream: spokenDialogue,
    knownAttendees: [{ name: "Yogesh", email: "yogesh@noteflow.ai" }],
  });

  // Test 1: Real Dialogue Ingress
  runTest("Real Dialogue Ingress: Transcribes spoken test statements", () => {
    assert(transcriptPayload.segments.length === 3, `Expected 3 segments, got ${transcriptPayload.segments.length}`);
    assert(transcriptPayload.sanitizedText.includes("Our launch date is September 15th."), "Missing launch date in transcript");
    assert(transcriptPayload.sanitizedText.includes("Yogesh will prepare the design review."), "Missing task in transcript");
    assert(transcriptPayload.sanitizedText.includes("The next meeting is on Friday."), "Missing next meeting in transcript");
  });

  // 3. Generate Grounded AI Summary directly from transcript
  const summary = summaryService.generateSummary(transcriptPayload, "standard");

  // Test 2: Dynamic Decision Extraction
  runTest("Dynamic Decision Extraction: Captures September 15th launch date", () => {
    const launchDecision = summary.decisions.find(
      (d) => d.text.toLowerCase().includes("september 15") || d.text.toLowerCase().includes("launch date")
    );
    assert(Boolean(launchDecision), "Expected decision for September 15th launch date");
    assert(launchDecision?.confidence === "high", "Decision confidence must be high");
  });

  // Test 3: Dynamic Action Item Extraction
  runTest("Dynamic Action Item Extraction: Assigns design review to Yogesh", () => {
    const reviewAction = summary.actionItems.find(
      (a) => a.task.toLowerCase().includes("prepare the design review") || a.task.toLowerCase().includes("design review")
    );
    assert(Boolean(reviewAction), "Expected action item for design review");
    assert(reviewAction?.assignee.toLowerCase().includes("yogesh"), `Assignee must be Yogesh, got: ${reviewAction?.assignee}`);
  });

  // Test 4: Next Meeting Alignment
  runTest("Next Meeting Alignment: Extracts Friday meeting consensus", () => {
    const nextMeetingItem =
      summary.decisions.find((d) => d.text.toLowerCase().includes("friday") || d.text.toLowerCase().includes("next meeting")) ||
      summary.actionItems.find((a) => a.dueDate?.toLowerCase().includes("friday") || a.task.toLowerCase().includes("friday"));
    assert(Boolean(nextMeetingItem), "Expected consensus on Friday next meeting");
  });

  // Test 5: Zero Sample Leakage
  runTest("Zero Sample Leakage: 0% synthetic sample content present", () => {
    const combinedSummaryText = `${summary.executiveSummary} ${JSON.stringify(summary.decisions)} ${JSON.stringify(summary.actionItems)}`;
    assert(!combinedSummaryText.includes("Sarah Chen"), "Must NOT contain Sarah Chen");
    assert(!combinedSummaryText.includes("Carlos Mendez"), "Must NOT contain Carlos Mendez");
    assert(!combinedSummaryText.includes("Google Ads"), "Must NOT contain Google Ads");
    assert(!combinedSummaryText.includes("TikTok"), "Must NOT contain TikTok");
    assert(!combinedSummaryText.includes("Q3 Roadmap"), "Must NOT contain Q3 Roadmap");
  });

  // Test 6: Parent-Child Data Lineage
  runTest("Parent-Child Data Lineage: User -> Meeting -> Recording -> Transcript -> Summary", () => {
    // Complete session with synchronized transcript and summary
    const completedSession = recordingSessionService.completeSession(session.recordingSessionId, {
      transcript: transcriptPayload,
      summary,
    });

    assert(completedSession.userIds.includes(userId), "Session must reference userId");
    assert(completedSession.meetingId === meetingId, "Session must reference meetingId");
    assert(completedSession.status === "COMPLETED", "Session status must be COMPLETED");
    assert(Boolean(completedSession.transcript), "Session must contain transcript");
    assert(Boolean(completedSession.summary), "Session must contain summary");
  });

  console.log("-------------------------------------------------");
  console.log(`TOTAL: ${total} | PASSED: ${passed} | FAILED: ${total - passed}`);
  console.log(`PASS RATE: ${((passed / total) * 100).toFixed(1)}%`);
  console.log("-------------------------------------------------");

  if (passed !== total) process.exit(1);
  process.exit(0);
}

main().catch((err) => {
  console.error("Test execution error:", err);
  process.exit(1);
});

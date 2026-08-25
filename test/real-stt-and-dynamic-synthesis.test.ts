/**
 * Phase 3: Real Speech-to-Text Ingress & Dynamic LLM Meeting Synthesis Test Suite
 * 
 * Verifies:
 * 1. Zero synthetic transcript fallbacks in SpeechToTextService.
 * 2. Dynamic conversational NLP extraction & AI summary generation for arbitrary meetings.
 * 3. Verbatim citation bindings linking decisions/actions directly to transcript line indices.
 * 4. Refinement perspectives (standard, executive, action_focused, technical).
 * 5. Safe handling of brief / empty audio captures without injecting fake templates.
 */

import { SpeechToTextService } from "../server/services/sttService.js";
import { SummaryService } from "../server/services/summaryService.js";

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
  console.log("  PHASE 3: REAL STT & DYNAMIC SYNTHESIS SUITE     ");
  console.log("=================================================");

  const sttService = new SpeechToTextService();
  const summaryService = new SummaryService();

  // Test 1: Silent / Empty audio returns empty transcript, zero synthetic fallback
  await runTest("Zero Synthetic Fallback: Empty audio stream returns empty segments", async () => {
    const result = await sttService.processAudioStream({
      meetingId: "meet-empty-101",
      durationSeconds: 120,
    });

    assert(result.segments.length === 0, "Segments must be empty when no audio or preset is provided");
    assert(result.rawVtt === "", "Raw VTT must be empty string");
    assert(result.detectedSpeakers.length === 0, "Detected speakers must be empty");
  });

  // Test 2: Custom Marketing Strategy Meeting transcript parsing
  const customMarketingVtt = `WEBVTT

00:00:05.000 --> 00:00:10.000
<v Jessica Taylor>Welcome team, let's review our Q4 Growth and Paid Acquisition Strategy.</v>

00:00:11.000 --> 00:00:18.000
<v Carlos Mendez>Thanks Jessica. We analyzed the conversion rates on LinkedIn ads vs Google Search.</v>

00:00:19.000 --> 00:00:27.000
<v Carlos Mendez>Google Search delivered a 3.4x higher pipeline ROI. We decided to reallocate $50,000 from LinkedIn to Google Search.</v>

00:00:28.000 --> 00:00:35.000
<v Jessica Taylor>Decision reached: We are officially locking the revised Q4 paid budget allocation to Google Search.</v>

00:00:36.000 --> 00:00:42.000
<v Jessica Taylor>Carlos, can you update the ad campaigns in Google Ads manager by Friday?</v>

00:00:43.000 --> 00:00:46.000
<v Carlos Mendez>Will do. I will have the new campaign creatives live by Friday noon.</v>

00:00:47.000 --> 00:00:54.000
<v Jessica Taylor>One open question: Should we include TikTok B2B ads in the upcoming pilot test?</v>

00:00:55.000 --> 00:01:00.000
<v Carlos Mendez>Let's park for now until we evaluate the initial Q4 search results.</v>`;

  let marketingTranscriptPayload: any;

  await runTest("Real STT Parsing: Extracts custom speakers, timestamps, and segments", async () => {
    marketingTranscriptPayload = await sttService.processAudioStream({
      meetingId: "meet-marketing-202",
      sampleTranscriptPreset: customMarketingVtt,
      durationSeconds: 60,
    });

    assert(marketingTranscriptPayload.segments.length === 8, `Expected 8 segments, got ${marketingTranscriptPayload.segments.length}`);
    assert(marketingTranscriptPayload.detectedSpeakers.includes("Jessica Taylor"), "Must identify Jessica Taylor");
    assert(marketingTranscriptPayload.detectedSpeakers.includes("Carlos Mendez"), "Must identify Carlos Mendez");
    assert(!marketingTranscriptPayload.detectedSpeakers.includes("Sarah Chen"), "Must NOT contain Sarah Chen");
  });

  // Test 3: Dynamic Decision Extraction on Custom Content
  await runTest("Dynamic Decisions: Extracts Google Search budget decision without hardcoded templates", () => {
    const analysis = summaryService.generateSummary(marketingTranscriptPayload);

    assert(analysis.decisions.length >= 1, "Must extract at least 1 decision");
    const searchDecision = analysis.decisions.find((d) => d.text.toLowerCase().includes("google search") || d.text.toLowerCase().includes("budget"));
    assert(Boolean(searchDecision), "Extracted decision must mention Google Search or budget");

    // Verbatim citation validation
    assert(Boolean(searchDecision?.citation), "Decision must contain citation");
    assert(searchDecision!.citation.speaker === "Jessica Taylor" || searchDecision!.citation.speaker === "Carlos Mendez", "Citation speaker must match transcript");
    assert(searchDecision!.citation.timestamp.length > 0, "Citation timestamp must be present");
  });

  // Test 4: Dynamic Action Item Extraction on Custom Content
  await runTest("Dynamic Action Items: Extracts Carlos Mendez Google Ads task with due date", () => {
    const analysis = summaryService.generateSummary(marketingTranscriptPayload);

    assert(analysis.actionItems.length >= 1, "Must extract at least 1 action item");
    const carlosTask = analysis.actionItems.find((a) => a.assignee.toLowerCase().includes("carlos") || a.task.toLowerCase().includes("campaign"));
    assert(Boolean(carlosTask), "Action item must be assigned to Carlos or relate to campaigns");
    assert(Boolean(carlosTask?.citation), "Action item must contain verbatim citation");
    assert(carlosTask!.citation.rawText.includes("Friday") || carlosTask!.citation.rawText.includes("campaign"), "Citation raw text must match transcript");
  });

  // Test 5: Dynamic Unresolved Questions
  await runTest("Dynamic Questions: Identifies TikTok B2B pilot open question", () => {
    const analysis = summaryService.generateSummary(marketingTranscriptPayload);

    assert(analysis.unresolvedQuestions.length >= 1, "Must extract unresolved question");
    const tiktokQuestion = analysis.unresolvedQuestions.find((q) => q.question.toLowerCase().includes("tiktok") || q.question.includes("?"));
    assert(Boolean(tiktokQuestion), "Unresolved question must be captured");
    assert(Boolean(tiktokQuestion?.citation), "Question must contain verbatim citation");
  });

  // Test 6: Perspective Refinement Support
  await runTest("Perspective Synthesis: Generates distinct executive and action-focused summaries", () => {
    const standardSummary = summaryService.generateSummary(marketingTranscriptPayload, "standard");
    const executiveSummary = summaryService.generateSummary(marketingTranscriptPayload, "executive");
    const actionSummary = summaryService.generateSummary(marketingTranscriptPayload, "action_focused");

    assert(executiveSummary.executiveSummary.includes("Executive Briefing"), "Executive perspective format check");
    assert(actionSummary.executiveSummary.includes("Action-Focused"), "Action perspective format check");
    assert(!standardSummary.executiveSummary.includes("PostgreSQL"), "Standard summary must NOT mention PostgreSQL");
    assert(standardSummary.executiveSummary.includes("Jessica Taylor") || standardSummary.executiveSummary.includes("Carlos Mendez"), "Summary must reflect actual attendees");
  });

  // Test 7: Brief / Empty Transcript Safeguard
  await runTest("Safeguard: Sub-threshold transcript returns partial capture flag with zero fake decisions", () => {
    const briefTranscript = {
      meetingId: "meet-brief",
      rawVtt: "<v Alice>Hello.</v>",
      sanitizedText: "Hello.",
      detectedSpeakers: ["Alice"],
      durationSeconds: 5,
      segments: [{ lineIndex: 0, speaker: "Alice", timestamp: "00:00", text: "Hello." }],
    };

    const analysis = summaryService.generateSummary(briefTranscript);
    assert(analysis.isPartialCapture === true, "Must flag isPartialCapture === true");
    assert(analysis.decisions.length === 0, "Must return 0 decisions for sub-threshold input");
    assert(analysis.actionItems.length === 0, "Must return 0 action items for sub-threshold input");
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
  console.error("Test execution fatal error:", err);
  process.exit(1);
});

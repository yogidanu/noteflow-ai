/**
 * Regression suite: Reversal & Context Guards (2026-10-23 accuracy
 * evaluation, round 2)
 *
 * Pins the four guards that target the 9 false positives left after
 * PR #6 (precision 74% at 100% recall — see
 * ~/workspace/noteflow-evaluation/):
 *  4. A decision a later decision REVERSED stayed in the log (S4: the
 *     June premium launch and its September postponement were both
 *     listed as standing). Superseded decisions are now removed —
 *     same topic only (≥ 2 significant content words of overlap), so
 *     different-topic reversers and single-shared-word cases stay.
 *  5a. A historical decision ("Last year we decided…", S2) is not a
 *     decision of this meeting. Present-perfect framing is never
 *     historical ("Based on last year's results, we have decided…"
 *     stays).
 *  5b. Habitual "will" ("I will usually spend…", S2) is not a
 *     commitment.
 *  5c. A question that was answered is not unresolved: ordinary
 *     (Tier 2) candidates followed by a substantive different-speaker
 *     statement are suppressed (S2 interviewer questions, S5
 *     idea-questions). Parked (Tier 1) questions are never suppressed.
 *  5d. A vague closing revisit with no deliverable verb ("we will
 *     come back to these ideas…", S5) is not an action item.
 *
 * Scenario fixtures are the evaluation scenarios verbatim, in the
 * recorder format "Name [MM:SS]: text".
 */

import { sanitizeTranscript } from "../src/lib/transcriptSanitizer";
import { GenerativeSummarizer } from "../src/lib/llmSummarizer";

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
    console.log(`[PASS] ✅ ${name}`);
  } catch (err: any) {
    console.error(`[FAIL] ❌ ${name}:`, err.message);
  }
}

function synthesize(raw: string) {
  return GenerativeSummarizer.synthesize(sanitizeTranscript(raw), "standard");
}

function counts(result: any) {
  return {
    d: result.decisions.length,
    a: result.actionItems.length,
    q: result.unresolvedQuestions.length,
  };
}

function assertCounts(result: any, d: number, a: number, q: number, label: string) {
  const c = counts(result);
  assert(
    c.d === d && c.a === a && c.q === q,
    `${label}: expected D${d} A${a} Q${q}, got D${c.d} A${c.a} Q${c.q} ` +
      `(decisions: ${JSON.stringify(result.decisions.map((x: any) => x.text))}; ` +
      `actions: ${JSON.stringify(result.actionItems.map((x: any) => x.task))}; ` +
      `questions: ${JSON.stringify(result.unresolvedQuestions.map((x: any) => x.question))})`
  );
}

const S1 = [
  "Priya Sharma [00:08]: This is a planning check-in for the onboarding revamp release for March.",
  "Arjun Mehta [00:24]: The payment retry flow is stable now and checkout completion is up by four percent this week.",
  "Priya Sharma [00:41]: We have decided to launch the onboarding revamp on March 14 and the plan is to go with that launch date for all regions.",
  "Meera Nair [01:02]: The reason is simple, our interview participants kept dropping off at the identity verification step.",
  "Priya Sharma [01:20]: We agreed to remove the referral widget from the March release because it is not ready for localisation.",
  "Priya Sharma [01:38]: We decided to standardize on the new design tokens for all new onboarding screens.",
  "Arjun Mehta [01:56]: I will fix the payment retry bug for saved cards and review the patch by Friday.",
  "Meera Nair [02:14]: I will prepare the updated onboarding mockups for the verification step by Wednesday.",
  "Priya Sharma [02:32]: I will send the release notes draft to the team by tomorrow.",
  "Yogendra Danu [02:50]: Arjun will schedule the staging environment review with the QA team by Monday.",
  "Meera Nair [03:08]: One question we are leaving open for now is whether the analytics dashboard should be part of this release or the next one.",
  "Priya Sharma [03:26]: We still need to figure out whether enterprise customers need a separate onboarding track, and that depends on the sales team feedback.",
  "Arjun Mehta [03:44]: The staging build is green and the release checklist is already shared with everyone on the team.",
].join("\n");

const S2 = [
  "Sara Khan [00:06]: Welcome Daniel, today we are exploring how operations teams handle weekly reporting.",
  "Daniel Ortiz [00:22]: I manage reporting for a team of twelve and every Monday starts with pulling numbers from three different tools.",
  "Sara Khan [00:40]: How do you currently build the weekly report for your leadership team?",
  "Daniel Ortiz [00:58]: I export the sales data to a spreadsheet, then I copy the delivery numbers manually because the two systems do not talk to each other.",
  "Daniel Ortiz [01:17]: On busy weeks I will usually spend about three hours just cleaning the spreadsheet before anyone can read it.",
  "Sara Khan [01:35]: What is the most frustrating part of that process for you?",
  "Daniel Ortiz [01:52]: The frustrating part is that the numbers change after I share the report, so the leadership team ends up discussing outdated figures.",
  "Daniel Ortiz [02:10]: Last year we decided to use spreadsheets for reporting because the company was too small for a dedicated tool.",
  "Sara Khan [02:28]: When that happens, how does your team usually resolve the confusion?",
  "Daniel Ortiz [02:45]: We jump on a call and compare screenshots, which works, but it wastes almost an hour every single time.",
  "Daniel Ortiz [03:03]: I am not sure whether our finance team would approve a new reporting tool, because that depends on next quarter's budget.",
  "Sara Khan [03:21]: That covers everything I wanted to ask, thank you for walking me through your process in so much detail.",
].join("\n");

const S3 = [
  "Kavita Rao [00:07]: This is the daily standup for the checkout platform team.",
  "Rohan Patel [00:20]: Yesterday I finished the login session refactor and it is already merged to the main branch.",
  "Imran Sheikh [00:36]: API latency on the checkout endpoint is down to 180 milliseconds after the cache change.",
  "Leena Thomas [00:52]: I am blocked on the staging database access and my testing depends on DevOps granting that access this week.",
  "Kavita Rao [01:10]: We agreed to postpone the database migration to the next sprint because the staging environment is not stable.",
  "Rohan Patel [01:28]: I will deploy the checkout hotfix to production by 6 pm today.",
  "Imran Sheikh [01:45]: I will write the incident postmortem for the checkout outage by Thursday.",
  "Leena Thomas [02:02]: I need to update the public status page with the migration delay notice today.",
  "Kavita Rao [02:20]: We have decided to roll back the recommendation service to version 2.4 until the memory leak is fixed.",
  "Rohan Patel [02:38]: Imran will monitor the rollback metrics overnight and share the report in the morning.",
  "Kavita Rao [02:56]: One question we are leaving open is whether the memory leak is coming from the new caching layer or the session handler.",
  "Imran Sheikh [03:14]: The new build is passing all 240 regression tests on the staging environment.",
].join("\n");

const S4 = [
  "Ananya Gupta [00:09]: This is the stakeholder review for the premium pricing proposal.",
  "Ananya Gupta [00:26]: We have decided to launch the premium pricing tier on June 1 for all customers.",
  "Vikram Malhotra [00:44]: Our enterprise customers told us last week that a sudden price change would push at least three of them to review competitors.",
  "Tom Becker [01:03]: The billing system also cannot handle annual and monthly plans together until the payment upgrade is complete.",
  "Vikram Malhotra [01:21]: We agreed to postpone the premium launch until September and run a small pilot first instead.",
  "Ananya Gupta [01:39]: We decided to offer the pilot to twenty existing enterprise customers at the current price.",
  "Tom Becker [01:57]: I will prepare the billing risk assessment for the pilot by Friday.",
  "Ananya Gupta [02:15]: I will share the pilot recruitment plan with sales by Monday.",
  "Vikram Malhotra [02:33]: One question we are leaving open is whether enterprise customers will accept annual only billing for the premium tier.",
  "Ananya Gupta [02:51]: The reason is simple, trust with our enterprise customers matters more than launching one quarter early.",
].join("\n");

const S5 = [
  "Nina Alvarez [00:07]: This is a brainstorming session for new engagement ideas for the community app.",
  "Carlos Mendes [00:24]: What if we added a community challenge feed where groups post weekly goals together?",
  "Fatima Noor [00:42]: We could try light gamification with streaks, maybe badges for members who help newcomers.",
  "Nina Alvarez [01:00]: Another idea is a local events map, although maintaining it could be expensive for a small team.",
  "Carlos Mendes [01:18]: I like the events idea, and I think creators would use it if it connected to their existing groups.",
  "Fatima Noor [01:36]: We are leaving open whether we should build mobile first or improve the web experience first.",
  "Nina Alvarez [01:54]: Should we explore a short video format, or would that distract from the discussion focus of the app?",
  "Carlos Mendes [02:12]: The pricing model is a parking lot topic for us, we are not sure whether creators should pay or whether it stays free.",
  "Fatima Noor [02:30]: If the challenge feed works, we could invite local communities to test it in a later phase.",
  "Nina Alvarez [02:48]: We have lots of directions here and no final direction yet, so we will come back to these ideas after the research readout.",
].join("\n");

function main() {
  console.log("=================================================");
  console.log("  REGRESSION: REVERSAL & CONTEXT GUARDS          ");
  console.log("=================================================");

  // --- Scenario end states -------------------------------------------

  runTest("S1 sprint planning: end state unchanged D3 A4 Q2", () => {
    assertCounts(synthesize(S1), 3, 4, 2, "S1");
  });

  runTest("S1: 'remove the referral widget' does NOT supersede the March launch (single shared word)", () => {
    const result = synthesize(S1);
    const raw = result.decisions.map((d: any) => d.citation?.rawText || "");
    assert(
      raw.some((t: string) => t.includes("launch the onboarding revamp")),
      `Launch decision must stay, got: ${JSON.stringify(raw)}`
    );
    assert(
      raw.some((t: string) => t.includes("remove the referral widget")),
      `Referral-widget removal must stay, got: ${JSON.stringify(raw)}`
    );
  });

  runTest("S2 user interview: end state D0 A0 Q1 — only the parked finance question", () => {
    const result = synthesize(S2);
    assertCounts(result, 0, 0, 1, "S2");
    assert(
      (result.unresolvedQuestions[0].citation?.rawText || "").includes("finance team"),
      `The surviving question must be the finance/budget one, got: ${JSON.stringify(result.unresolvedQuestions.map((q: any) => q.question))}`
    );
  });

  runTest("S3 standup: end state unchanged D2 A4 Q2", () => {
    assertCounts(synthesize(S3), 2, 4, 2, "S3");
  });

  runTest("S3: 'roll back the recommendation service' does NOT supersede the migration postponement (different topic)", () => {
    const result = synthesize(S3);
    const raw = result.decisions.map((d: any) => d.citation?.rawText || "");
    assert(
      raw.some((t: string) => t.includes("postpone the database migration")),
      `Migration postponement must stay, got: ${JSON.stringify(raw)}`
    );
    assert(
      raw.some((t: string) => t.includes("roll back the recommendation service")),
      `Rollback decision must stay, got: ${JSON.stringify(raw)}`
    );
  });

  runTest("S4 reversal: end state D2 A2 Q1 — only the final decisions stand", () => {
    const result = synthesize(S4);
    assertCounts(result, 2, 2, 1, "S4");
    const raw = result.decisions.map((d: any) => d.citation?.rawText || "");
    assert(
      !raw.some((t: string) => t.includes("launch the premium pricing tier on June 1")),
      `The reversed June launch must be gone, got: ${JSON.stringify(raw)}`
    );
    assert(
      raw.some((t: string) => t.includes("postpone the premium launch")),
      `The postponement must stand, got: ${JSON.stringify(raw)}`
    );
    assert(
      raw.some((t: string) => t.includes("offer the pilot")),
      `The pilot decision must stand, got: ${JSON.stringify(raw)}`
    );
  });

  runTest("S5 brainstorm: end state D0 A0 Q2 — only the two parked questions", () => {
    const result = synthesize(S5);
    assertCounts(result, 0, 0, 2, "S5");
    const raw = result.unresolvedQuestions.map((q: any) => q.citation?.rawText || "");
    assert(
      raw.some((t: string) => t.includes("mobile first")),
      `Parked mobile-first question must stay, got: ${JSON.stringify(raw)}`
    );
    assert(
      raw.some((t: string) => t.includes("pricing model")),
      `Parked pricing question must stay, got: ${JSON.stringify(raw)}`
    );
  });

  // --- Fix 4 units -----------------------------------------------------

  runTest("Reversal unit: later postponement of the SAME launch removes the earlier decision", () => {
    const raw = [
      "Ananya Gupta [00:05]: We have decided to launch the premium pricing tier on June 1 for all customers.",
      "Vikram Malhotra [00:20]: We agreed to postpone the premium launch until September and run a small pilot first instead.",
    ].join("\n");
    const result = synthesize(raw);
    assert(
      result.decisions.length === 1,
      `Expected only the reverser to remain, got ${result.decisions.length}: ${JSON.stringify(result.decisions.map((d: any) => d.text))}`
    );
    assert(
      (result.decisions[0].citation?.rawText || "").includes("postpone the premium launch"),
      "The surviving decision must be the postponement"
    );
  });

  runTest("Reversal unit: cancelling a DIFFERENT topic removes nothing", () => {
    const raw = [
      "Ananya Gupta [00:05]: We have decided to launch the mobile app beta on June 1 for all customers.",
      "Vikram Malhotra [00:20]: We agreed to cancel the office relocation plan and keep the current lease instead.",
    ].join("\n");
    const result = synthesize(raw);
    assert(
      result.decisions.length === 2,
      `Both decisions are about different topics and must stay, got ${result.decisions.length}: ${JSON.stringify(result.decisions.map((d: any) => d.text))}`
    );
  });

  // --- Fix 5a units ----------------------------------------------------

  runTest("Historical unit: 'Based on last year's results, we have decided…' is KEPT (present perfect)", () => {
    const result = synthesize(
      "Sara Khan [00:05]: Based on last year's results, we have decided to expand the pilot."
    );
    assert(
      result.decisions.length === 1,
      `Present-perfect decision mentioning the past must stay, got ${result.decisions.length}`
    );
  });

  // --- Fix 5b units ----------------------------------------------------

  runTest("Habitual unit: a normal 'I will send the summary tomorrow' is still an action", () => {
    const result = synthesize(
      "Priya Sharma [00:05]: I will send the summary tomorrow"
    );
    assert(
      result.actionItems.length === 1,
      `Expected 1 action item, got ${result.actionItems.length}`
    );
    assert(
      result.actionItems[0].dueDate === "Tomorrow",
      `dueDate must be "Tomorrow", got ${result.actionItems[0].dueDate}`
    );
  });

  // --- Fix 5c units ----------------------------------------------------

  runTest("Answered-question unit: a Tier-2 question as the LAST line is kept", () => {
    const raw = [
      "Sara Khan [00:05]: The vendor demo covered the reporting module in detail today",
      "Daniel Ortiz [00:20]: How do you export the monthly numbers from the tool?",
    ].join("\n");
    const result = synthesize(raw);
    assert(
      result.unresolvedQuestions.length === 1,
      `A question nobody answered yet (last line) must stay, got ${result.unresolvedQuestions.length}`
    );
  });

  runTest("Answered-question unit: a Tier-2 question followed by the SAME speaker is kept", () => {
    const raw = [
      "Sara Khan [00:05]: How do you currently build the weekly report for your leadership team?",
      "Sara Khan [00:25]: I ask because the process seems to differ across every team in the company",
    ].join("\n");
    const result = synthesize(raw);
    assert(
      result.unresolvedQuestions.length === 1,
      `Same-speaker follow-up is not an answer — question must stay, got ${result.unresolvedQuestions.length}`
    );
  });

  runTest("Answered-question unit: a Tier-2 question followed by another Tier-2 question is kept", () => {
    const raw = [
      "Sara Khan [00:05]: What is the current churn rate for enterprise accounts?",
      "Daniel Ortiz [00:20]: Why did the churn spike in the second quarter of the year?",
    ].join("\n");
    const result = synthesize(raw);
    assert(
      result.unresolvedQuestions.length === 2,
      `A question answered with another question is not resolved — both must stay, got ${result.unresolvedQuestions.length}: ${JSON.stringify(result.unresolvedQuestions.map((q: any) => q.question))}`
    );
  });

  // --- Fix 5d units ----------------------------------------------------

  runTest("Vague-closing unit: 'come back to the office and send…' (deliverable verb) is still an action", () => {
    const result = synthesize(
      "Priya Sharma [00:05]: I will come back to the office and send the signed contract by Friday"
    );
    assert(
      result.actionItems.length === 1,
      `Expected 1 action item, got ${result.actionItems.length}`
    );
    assert(
      result.actionItems[0].dueDate === "Friday",
      `dueDate must be "Friday", got ${result.actionItems[0].dueDate}`
    );
  });

  console.log("-------------------------------------------------");
  console.log(`TOTAL: ${total} | PASSED: ${passed} | FAILED: ${total - passed}`);
  console.log(`PASS RATE: ${((passed / total) * 100).toFixed(1)}%`);
  console.log("-------------------------------------------------");

  if (passed !== total) {
    process.exit(1);
  }
}

main();

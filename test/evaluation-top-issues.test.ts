/**
 * Regression suite: Evaluation Top Issues (2026-10-23 accuracy evaluation)
 *
 * Pins the three defects the 5-scenario evaluation found in the client
 * synthesis path (see ~/workspace/noteflow-evaluation/):
 *  1. Open questions were capped at the first 3 in source order, so in
 *     question-rich transcripts the questions the meeting EXPLICITLY
 *     parked were dropped (S2: the finance/budget question; S5: the
 *     parked pricing question). Selection is now priority-based
 *     (parked first, cap 5) with display in source order.
 *  2. Delegated commitments ("Arjun will schedule…", spoken by someone
 *     else) were assigned to the SPEAKER. The named subject / direct
 *     addressee now owns the task, resolved to the full roster name.
 *  3. extractDueDate only recognised tomorrow/today/Friday/Monday/
 *     next week/this week/end of week, so "by Wednesday" and
 *     "by Thursday" deadlines were silently dropped. Weekdays, explicit
 *     month dates and clock times are now recognised; nothing is ever
 *     invented.
 *
 * Fixtures S1/S2/S3/S5 are the evaluation scenarios verbatim, in the
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

function actionByRawText(result: any, needle: string) {
  return result.actionItems.find((a: any) =>
    (a.citation?.rawText || "").includes(needle)
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

/** The original 5-line fixture from citation-synthesis-grounding. */
const ORIGINAL_FIXTURE = [
  "You [00:12]: this is a planning check in for the NoteFlow public beta",
  "You [00:21]: we have decided to launch the public beta to a waitlist first before we build team workspace",
  "You [00:33]: the reason is simple we want real feedback from individual product managers and designers before we add shared workspace for teams",
  "You [00:48]: any bugs we find during end to end testing today directly to the respective developers and I will review those fixes by tomorrow evening",
  "You [01:03]: one question we are leaving open for now is whether team workspaces should be included in the free beta or kept only for the Pro tier",
].join("\n");

function main() {
  console.log("=================================================");
  console.log("  REGRESSION: EVALUATION TOP ISSUES              ");
  console.log("=================================================");

  // --- Fix 1: question priority -------------------------------------

  runTest("S2 interview: the parked finance/budget question survives the cap", () => {
    const result = synthesize(S2);
    const finance = result.unresolvedQuestions.find((q) =>
      (q.citation?.rawText || "").includes("finance team")
    );
    assert(
      !!finance,
      `Expected the finance/budget question in unresolvedQuestions, got: ${JSON.stringify(result.unresolvedQuestions.map((q) => q.question))}`
    );
    assert(
      result.unresolvedQuestions.length <= 5,
      `Expected at most 5 questions, got ${result.unresolvedQuestions.length}`
    );
  });

  runTest("S2 interview: selected questions are displayed in source order", () => {
    const result = synthesize(S2);
    const idxs = result.unresolvedQuestions.map(
      (q) => q.citation?.lineIndex ?? -1
    );
    const sorted = [...idxs].sort((a, b) => a - b);
    assert(
      JSON.stringify(idxs) === JSON.stringify(sorted),
      `Questions must be in source order (lineIndex ascending), got ${JSON.stringify(idxs)}`
    );
  });

  runTest("S5 brainstorm: BOTH explicitly parked questions are present", () => {
    const result = synthesize(S5);
    const raw = result.unresolvedQuestions.map((q) => q.citation?.rawText || "");
    assert(
      raw.some((t) => t.includes("mobile first")),
      `Expected the parked mobile-first question, got: ${JSON.stringify(raw)}`
    );
    assert(
      raw.some((t) => t.includes("pricing model")),
      `Expected the parked pricing question, got: ${JSON.stringify(raw)}`
    );
    assert(
      result.unresolvedQuestions.length <= 5,
      `Expected at most 5 questions, got ${result.unresolvedQuestions.length}`
    );
  });

  runTest("No questions in transcript still yields an empty parking lot", () => {
    const result = synthesize(
      "Priya Sharma [00:05]: We decided to standardize on the new design tokens for all new screens.\nArjun Mehta [00:20]: I will update the token library by Friday."
    );
    assert(
      result.unresolvedQuestions.length === 0,
      `Expected 0 questions, got ${result.unresolvedQuestions.length}`
    );
  });

  // --- Fix 2 + 3: S1 owners and due dates ---------------------------

  runTest("S1: delegated 'Arjun will schedule…' is owned by Arjun Mehta, due Monday", () => {
    const result = synthesize(S1);
    const action = actionByRawText(result, "schedule the staging environment review");
    assert(!!action, "Expected the staging-review action item to exist");
    assert(
      action.task.includes("Schedule the staging environment review"),
      `Task text unexpected: ${action.task}`
    );
    assert(
      action.assignee === "Arjun Mehta",
      `Delegated assignee must be the named owner "Arjun Mehta" (roster-resolved), got ${action.assignee}`
    );
    assert(
      action.dueDate === "Monday",
      `Delegated action dueDate must be "Monday", got ${action.dueDate}`
    );
  });

  runTest("S1: Meera's mockups are due Wednesday (weekday vocabulary)", () => {
    const result = synthesize(S1);
    const action = actionByRawText(result, "onboarding mockups");
    assert(!!action, "Expected the mockups action item to exist");
    assert(action.assignee === "Meera Nair", `Assignee must be Meera Nair, got ${action.assignee}`);
    assert(
      action.dueDate === "Wednesday",
      `dueDate must be "Wednesday", got ${action.dueDate}`
    );
  });

  runTest("S1: Priya's release notes stay due Tomorrow; Arjun's self-commitment stays his, due Friday", () => {
    const result = synthesize(S1);
    const priya = actionByRawText(result, "release notes draft");
    assert(!!priya, "Expected the release-notes action item to exist");
    assert(priya.assignee === "Priya Sharma", `Assignee must be Priya Sharma, got ${priya.assignee}`);
    assert(priya.dueDate === "Tomorrow", `dueDate must be "Tomorrow", got ${priya.dueDate}`);
    const arjun = actionByRawText(result, "payment retry bug");
    assert(!!arjun, "Expected the payment-retry action item to exist");
    assert(
      arjun.assignee === "Arjun Mehta",
      `Self-commitment assignee must be the speaker "Arjun Mehta", got ${arjun.assignee}`
    );
    assert(arjun.dueDate === "Friday", `dueDate must be "Friday", got ${arjun.dueDate}`);
  });

  // --- Fix 2 + 3: S3 owners and due dates ---------------------------

  runTest("S3: delegated 'Imran will monitor…' is owned by Imran Sheikh", () => {
    const result = synthesize(S3);
    const action = actionByRawText(result, "monitor the rollback metrics");
    assert(!!action, "Expected the rollback-monitoring action item to exist");
    assert(
      action.assignee === "Imran Sheikh",
      `Delegated assignee must be "Imran Sheikh" (spoken by Rohan Patel), got ${action.assignee}`
    );
  });

  runTest("S3: postmortem due Thursday; hotfix 'by 6 pm today' stays Today", () => {
    const result = synthesize(S3);
    const postmortem = actionByRawText(result, "incident postmortem");
    assert(!!postmortem, "Expected the postmortem action item to exist");
    assert(
      postmortem.dueDate === "Thursday",
      `dueDate must be "Thursday", got ${postmortem.dueDate}`
    );
    const hotfix = actionByRawText(result, "checkout hotfix");
    assert(!!hotfix, "Expected the hotfix action item to exist");
    assert(
      hotfix.dueDate === "Today",
      `"by 6 pm today" must stay "Today" (today outranks clock time), got ${hotfix.dueDate}`
    );
  });

  // --- Fix 2: direct request ----------------------------------------

  runTest("Direct request 'Carlos, can you…' is owned by Carlos Mendes, due Tuesday", () => {
    const raw = [
      "Nina Alvarez [00:05]: Carlos, can you send the rollout summary by Tuesday",
      "Carlos Mendes [00:20]: The rollout covers the new onboarding flow for the beta users in detail",
    ].join("\n");
    const result = synthesize(raw);
    const action = actionByRawText(result, "rollout summary");
    assert(!!action, `Expected the rollout-summary action item, got: ${JSON.stringify(result.actionItems.map((a) => a.task))}`);
    assert(
      action.assignee === "Carlos Mendes",
      `Direct-address assignee must resolve to roster name "Carlos Mendes", got ${action.assignee}`
    );
    assert(
      action.dueDate === "Tuesday",
      `dueDate must be "Tuesday", got ${action.dueDate}`
    );
  });

  // --- Fix 3: due-date units ----------------------------------------

  runTest("Due date: explicit month date 'by March 14' → 'March 14'", () => {
    const result = synthesize(
      "Priya Sharma [00:05]: I will share the launch checklist with the team by March 14"
    );
    assert(result.actionItems.length === 1, `Expected 1 action, got ${result.actionItems.length}`);
    assert(
      result.actionItems[0].dueDate === "March 14",
      `dueDate must be "March 14", got ${result.actionItems[0].dueDate}`
    );
  });

  runTest("Due date: clock time 'by 6 pm' (no today/tomorrow) → '6 PM'", () => {
    const result = synthesize(
      "Priya Sharma [00:05]: I will submit the compliance form by 6 pm"
    );
    assert(result.actionItems.length === 1, `Expected 1 action, got ${result.actionItems.length}`);
    assert(
      result.actionItems[0].dueDate === "6 PM",
      `dueDate must be "6 PM", got ${result.actionItems[0].dueDate}`
    );
  });

  runTest("Due date: 'by Saturday' → 'Saturday'", () => {
    const result = synthesize(
      "Priya Sharma [00:05]: I will review the hiring plan draft by Saturday"
    );
    assert(result.actionItems.length === 1, `Expected 1 action, got ${result.actionItems.length}`);
    assert(
      result.actionItems[0].dueDate === "Saturday",
      `dueDate must be "Saturday", got ${result.actionItems[0].dueDate}`
    );
  });

  runTest("Due date: no date spoken → dueDate stays undefined (never invented)", () => {
    const result = synthesize(
      "Priya Sharma [00:05]: I will review the hiring plan draft with the team"
    );
    assert(result.actionItems.length === 1, `Expected 1 action, got ${result.actionItems.length}`);
    assert(
      result.actionItems[0].dueDate === undefined,
      `dueDate must be undefined, got ${result.actionItems[0].dueDate}`
    );
  });

  // --- Fix 2: non-person guard ----------------------------------------

  runTest("Non-person guard: 'Team will review…' keeps the speaker as assignee", () => {
    const result = synthesize(
      "Arjun Mehta [00:05]: Team will review the rollout plan and share feedback with everyone"
    );
    assert(result.actionItems.length === 1, `Expected 1 action, got ${result.actionItems.length}`);
    assert(
      result.actionItems[0].assignee === "Arjun Mehta",
      `"Team" is not a person — assignee must stay the speaker "Arjun Mehta", got ${result.actionItems[0].assignee}`
    );
  });

  // --- No-regression spot check ---------------------------------------

  runTest("Original 5-line fixture still yields 1 decision / 1 action due Tomorrow / 1 question", () => {
    const result = synthesize(ORIGINAL_FIXTURE);
    assert(result.decisions.length === 1, `Expected 1 decision, got ${result.decisions.length}`);
    assert(result.actionItems.length === 1, `Expected 1 action, got ${result.actionItems.length}`);
    assert(
      result.actionItems[0].dueDate === "Tomorrow",
      `Action dueDate must be "Tomorrow", got ${result.actionItems[0].dueDate}`
    );
    assert(
      result.unresolvedQuestions.length === 1,
      `Expected 1 question, got ${result.unresolvedQuestions.length}`
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

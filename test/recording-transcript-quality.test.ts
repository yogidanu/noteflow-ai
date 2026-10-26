/**
 * Regression suite: recording transcript quality (2026-10-26).
 *
 * From a real test recording of a read-aloud scenario script:
 *  1. Pause-split fragments stayed fragmented — the merge pass measured
 *     gaps from the FIRST fragment's timestamp, and Web Speech chunk
 *     timestamps are finalize times (4–6s apart for ~2s pauses).
 *  2. Tasks/decisions/questions collapsed — recognizers return several
 *     sentences as one blob line, and the engine treats a line as one
 *     unit. The sanitizer now splits blob lines into sentence lines.
 *  3. A reversal spoken as its own sentence ("We are not launching on
 *     Friday.") never superseded the Friday decision.
 *  4. "I will ask Meera to…" assigned the task to the speaker.
 *  5. A self-answered check-in question ("…get the invite?" / "Yes…")
 *     leaked into the parking lot.
 */
import { sanitizeTranscript, splitSentences } from "../src/lib/transcriptSanitizer";
import { mergeTranscriptSegments } from "../src/lib/transcriptMerge";
import { processMeetingWithAI } from "../src/lib/aiEngine";

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

console.log("== Sentence splitting (sanitizer) ==");
const blob =
  "You [00:51]: I decided to launch the beta on Friday. Priya will prepare the release notes by Thursday. Arjun, please fix the payment on Wednesday. I will ask Meera to review the onboarding screen next week.";
const san = sanitizeTranscript(blob);
check("blob line splits into 4 sentence lines", san.lines.length === 4, san.lines.map((l) => l.text));
check("split lines keep speaker + timestamp", san.lines.every((l) => l.speaker === "You" && l.timestamp === "00:51"));
check(
  "abbreviations are not split",
  splitSentences("Dr. Rao confirmed the plan. We ship Monday.").length === 2,
  splitSentences("Dr. Rao confirmed the plan. We ship Monday.")
);
check(
  "unpunctuated text passes through unchanged",
  splitSentences("okay lets begin we need to work on the").length === 1
);

console.log("== Merge gap measured from LAST fragment ==");
const frag = (timestamp: string, text: string) => ({ speaker: "You", timestamp, text });
const chained = mergeTranscriptSegments([
  frag("00:10", "okay let's begin we need to work on the"),
  frag("00:14", "production release of this application I am going to"),
  frag("00:20", "allocate the budget today"),
  frag("00:25", "the main issue is that the payment flow"),
  frag("00:30", "breaks whenever the network drops for a few seconds"),
]);
check("5 fragments at 4–6s intervals merge into 1 line", chained.length === 1, chained);
const broken = mergeTranscriptSegments([
  frag("00:10", "we need to work on the"),
  frag("00:31", "production release today"),
]);
check("21s interval still breaks the line", broken.length === 2, broken);
const capped = mergeTranscriptSegments([
  frag("00:00", Array(60).fill("word").join(" ")),
  frag("00:05", "more words follow here"),
]);
check("55-word readability cap breaks the line", capped.length === 2, capped.map((c) => c.text.length));

async function main() {
  console.log("== Engine end-to-end on the scenario script (punctuated) ==");
  const transcript = [
    "You [00:10]: Okay, let's begin. We need to work on the production release of this application.",
    "You [00:20]: I am going to allocate the budget today. The main issue is that the payment flow breaks whenever the network drops for a few seconds.",
    "You [00:51]: I decided to launch the beta on Friday. Priya will prepare the release notes by Thursday. Arjun, please fix the payment on Wednesday. I will ask Meera to review the onboarding screen next week.",
    "You [01:03]: Actually, wait. We are not launching on Friday. We decided to move the launch to Monday because the payment fix needs more testing.",
    "You [01:18]: One open question: should we support offline mode in the first release? Let's park that for now. Another question: what is the rollback plan if the deploy fails?",
    "You [01:33]: Last year we decided to use a different vendor, but that is history. I will usually send the summary on the same day. Quick check, did everyone get the invite? Yes, we all got it.",
  ].join("\n");
  const { analysis } = await processMeetingWithAI(transcript, "standard", () => {});

  const decisions = analysis.decisions.map((d) => d.text);
  check("exactly 1 decision: the Monday launch", decisions.length === 1 && /monday/i.test(decisions[0]), decisions);

  const tasks = analysis.actionItems;
  check("exactly 3 tasks", tasks.length === 3, tasks.map((t) => t.task));
  const byOwner = Object.fromEntries(tasks.map((t) => [t.assignee, t]));
  check("Priya owns release notes, due Thursday", !!byOwner["Priya"] && byOwner["Priya"].dueDate === "Thursday", tasks);
  check("Arjun owns payment fix, due Wednesday", !!byOwner["Arjun"] && byOwner["Arjun"].dueDate === "Wednesday", tasks);
  check("Meera owns onboarding review (delegated), due Next Week", !!byOwner["Meera"] && byOwner["Meera"].dueDate === "Next Week", tasks);

  const questions = analysis.unresolvedQuestions.map((q) => q.question);
  check(
    "exactly 2 questions: offline mode + rollback plan",
    questions.length === 2 && questions.some((q) => /offline/i.test(q)) && questions.some((q) => /rollback/i.test(q)),
    questions
  );

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}

main();

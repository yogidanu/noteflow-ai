/**
 * Regression suite: gaps found by the wider generalization set
 * (~/workspace/noteflow-evaluation/wider, 2026-10-26). Each case is a
 * general rule, named for the scenario that exposed it:
 *  W2  "Last sprint we decided…" leaked into the Decision Log
 *  W8  "Not confirmed yet." became a decision + erased a real question
 *  W10 "Get Fatima to confirm…" produced no task
 *  W11 "We need to figure out why…" was never collected as a question
 */
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

async function main() {
  // W2 — historical "last sprint"
  {
    const { analysis } = await processMeetingWithAI(
      [
        "Nadia Khan [00:28]: Last sprint we decided to drop the carousel, so that is settled.",
        "Nadia Khan [00:41]: We decided to go with the left-aligned layout for the dashboard.",
      ].join("\n"),
      "standard",
      () => {}
    );
    check("W2: only the live decision is logged", analysis.decisions.length === 1 && /left-aligned/.test(analysis.decisions[0].text), analysis.decisions.map((d) => d.text));
  }

  // W8 — negated status is not a decision; non-answer keeps question open
  {
    const { analysis } = await processMeetingWithAI(
      [
        "Sana Iqbal [00:26]: We decided to renew the contract for one year.",
        "Ravi Kumar [00:50]: Do we know if the renewal includes the support tier?",
        "Sana Iqbal [00:56]: Not confirmed yet.",
      ].join("\n"),
      "standard",
      () => {}
    );
    check("W8: 'Not confirmed yet.' is not a decision", analysis.decisions.length === 1 && /renew the contract/.test(analysis.decisions[0].text), analysis.decisions.map((d) => d.text));
    check("W8: support-tier question stays open", analysis.unresolvedQuestions.some((q) => /support tier/.test(q.question)), analysis.unresolvedQuestions.map((q) => q.question));
  }

  // W10 — bare imperative delegation is a commitment
  {
    const { analysis } = await processMeetingWithAI(
      [
        "Chris Evans [00:40]: I will circulate the revised MSA by Wednesday.",
        "Chris Evans [00:52]: Get Fatima to confirm the payment terms by Monday.",
      ].join("\n"),
      "standard",
      () => {}
    );
    const fatima = analysis.actionItems.find((t) => /payment terms/.test(t.task));
    check("W10: imperative delegation creates a task", !!fatima, analysis.actionItems.map((t) => t.task));
    check("W10: task is owned by Fatima", fatima?.assignee?.startsWith("Fatima") ?? false, fatima);
  }

  // W11 — "need to figure out" creates (and parks) a question
  {
    const { analysis } = await processMeetingWithAI(
      [
        "Grace Liu [00:16]: The staging drift caused two failed test runs this sprint.",
        "Grace Liu [01:04]: We need to figure out why the staging environment keeps drifting.",
      ].join("\n"),
      "standard",
      () => {}
    );
    check("W11: figure-out question is collected", analysis.unresolvedQuestions.some((q) => /staging environment/.test(q.question)), analysis.unresolvedQuestions.map((q) => q.question));
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}

main();

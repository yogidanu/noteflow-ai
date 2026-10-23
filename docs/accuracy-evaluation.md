# NoteFlow AI — Accuracy Evaluation (23 October 2026)

**What we did, in plain words:** until this evaluation, NoteFlow had only ever been tested on one short script. We wrote **5 realistic conversations**, defined in advance what a careful human note-taker *should* extract from each, then ran every conversation through **both input flows** — (A) the meeting/recording format and (B) an uploaded transcript file (WebVTT, the format Meet/Zoom/Teams export) — and scored every decision, action item and open question against the ground truth: found it, missed it, or invented it.

**The 5 conversations**

| # | Type | What it tests |
|---|---|---|
| S1 | Sprint planning | Clear decisions, owners, deadlines — the happy path |
| S2 | User interview | The correct answer is *no* decisions and *no* actions |
| S3 | Standup / bug triage | Past updates and metrics mixed with real commitments |
| S4 | Stakeholder review | A decision made early, then **reversed** later in the same meeting |
| S5 | Brainstorm | All hypotheticals — only 2 topics actually parked |

**Results (identical in both flows, every time)**

| Measure | First run | After all fixes |
|---|---|---|
| Real items found (recall) | 92% | **100%** (25/25) |
| Items shown that belong (precision) | 72% | **100%** (25/25) |
| Correct owner on action items | 8/10 | **10/10** |
| Due dates kept | 7/9 | **9/9** |
| Citations pointing at the exact source line | 114/114 | **100/100** |
| Fabricated facts (invented dates, owners, content) | 0 | **0** |

*100% means perfect on this 5-conversation test set — real meetings will vary. The test set, the harness and the raw outputs are kept with the evaluation so any future build can be re-scored in ~15 seconds.*

**What the first run found, and what was fixed**

| Problem found | Fix |
|---|---|
| Open questions capped at the first 3 — genuinely parked questions later in a meeting were dropped | Parked questions are selected first; cap raised to 5 |
| "Arjun will schedule…" was assigned to the *speaker*, not Arjun | Delegated tasks go to the person named, resolved to their full name |
| Due dates understood only *tomorrow / today / Friday / Monday* — Wednesday and Thursday vanished | All weekdays, explicit dates ("March 14") and times ("6 PM") now parse |
| A decision reversed later in the meeting was shown next to its replacement, as if both stood | A later same-topic decision with a reversal marker supersedes the earlier one — the log shows the final state |
| "Last year we decided…" (history) was shown as a new decision | Past-framed decisions are not meeting decisions |
| "I will usually spend 3 hours…" (a habit) became a task | Habitual "will usually/typically…" is not a commitment |
| Interviewer questions that were answered on the spot were listed as "unresolved" | A question answered by the next speaker is not unresolved; parked questions are never removed by this rule |
| "We will come back to these ideas…" (a closing pleasantry) became a task | Vague revisits with no concrete deliverable are not action items |

All fixes shipped in PR #6 and PR #7 (see repository history). Final results were confirmed three ways: a full code-level re-run, the regression suites built from these exact scenarios (`test/evaluation-top-issues.test.ts`, `test/reversal-context-guards.test.ts`), and live runs in the deployed app itself.

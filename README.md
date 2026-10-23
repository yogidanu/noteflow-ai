# NoteFlow AI • Meeting Intelligence & Action Tracker

**Turn meetings into decisions, action items and open questions you can fact-check — in about a second, at zero AI cost per summary.**

🌐 Live (public beta, free): https://noteflow-ai-cc3p.vercel.app

---

## What is this application?

NoteFlow AI is a meeting intelligence app for product managers, product designers, engineering leads and founders. It captures a meeting **without joining it as a bot**, transcribes it, and produces a structured summary:

- **Executive summary** — grounded highlights from what was actually said
- **Key Decisions** — with the rationale, when one was spoken
- **Action Items & Deliverables** — task, owner and due date, only when someone actually committed
- **Unresolved Questions & Parking Lot** — the things the meeting deliberately left open
- **Discussion points** — the main themes, in order

Every single item carries a **citation**: the speaker, the timestamp, and the verbatim quote. Click it and you land on the exact line of the transcript. If the AI claims it, you can check it in one click.

You can use it three ways:

1. **Record a meeting** — NoteFlow detects Google Meet / Zoom / Teams calls from your Google Calendar (read-only), or via its Chrome extension, and records through a small floating HUD. No bot joins your call.
2. **Upload a transcript** — drop a `.vtt` file exported from Meet, Zoom or Teams.
3. **Paste notes** — raw meeting notes or shorthand work too.

New here? The live app has an **Explore Demo Sandbox** mode — a full workspace with sample meetings, no sign-in needed.

## Why did we build this?

Because most meeting tools optimise for sounding smart, and get the basics wrong:

- **Summaries you can't verify.** If an AI writes "the team agreed to launch in June" and nobody said that, the summary is worse than useless — it's a liability. NoteFlow's answer: *trust = fact-checkability*. Every claim is one click from its source quote.
- **Invented follow-ups.** Tools routinely manufacture due dates ("by end of week") and tasks nobody agreed to. NoteFlow would rather show an empty section than invent content — an empty Decision Log is a *feature*: it means no decision was made.
- **Bots in the room.** A recording bot changes how people talk. NoteFlow captures from your side, unobtrusively — no extra participant, no announcement.
- **Per-summary AI bills.** Sending every transcript to a large language model costs money on every meeting and takes seconds to tens of seconds. NoteFlow's synthesis engine runs **on your device**: free per summary, near-instant, and your transcript doesn't leave the machine for summarisation.

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React 19, TypeScript, Vite 8, Tailwind CSS v4, Framer Motion |
| Synthesis engine | NoteFlow's own deterministic engine (TypeScript, runs client-side) — extraction, grounding and confidence are computed from the transcript, no LLM API calls |
| Speech-to-text | Deepgram **Nova-3** with keyterm prompting for product vocabulary; browser Web Speech API for the live HUD and as fallback |
| Backend | Node.js, Express 5 — auth, Google Calendar, recording sessions, transcription proxy |
| Integrations | Google Calendar (read-only, incremental sync), Google OAuth 2.0 + PKCE, Chrome extension for live Meet detection |
| Desktop | Electron companion app (macOS / Windows) |
| Security | AES-256-GCM encrypted token vault, scoped calendar permissions (read-only) |
| Hosting | Vercel (frontend), Render (backend), Cloudflare edge |
| Testing | A custom `tsx` test-suite collection (37 suites), including regression suites generated from the accuracy evaluation below |

## Accuracy evaluation

We don't ask you to take "accurate" on faith. On 23 October 2026 we evaluated NoteFlow on **5 different conversation types** — sprint planning, a user interview, an engineering standup, a stakeholder review where a decision gets **reversed mid-meeting**, and a brainstorm with no closure — each run through **both** input flows (recording format and uploaded transcript), with every output scored against a ground truth written in advance.

| Measure | First run | After fixes |
|---|---|---|
| Real items found | 92% | **100%** (25/25) |
| Items shown that belong | 72% | **100%** (25/25) |
| Correct task owners | 8/10 | **10/10** |
| Due dates kept | 7/9 | **9/9** |
| Citations exact | 114/114 | **100/100** |
| Fabricated facts | 0 | **0** |

The first run found real problems — dropped questions, wrong owners on delegated tasks, missing weekday due dates, a reversed decision shown as current. All of them were fixed and re-tested (PR #6, PR #7). 100% means perfect *on this test set*; real meetings vary, and the evaluation is repeatable so future builds can prove they haven't regressed.

📄 Full evaluation, in plain language: [docs/accuracy-evaluation.md](docs/accuracy-evaluation.md)

## Challenges — and what they changed

Building this taught us more through its failures than its features. These are the five that mattered, each with the fix it forced. (The full, ungrouped problem→fix list lives in the [evaluation doc](docs/accuracy-evaluation.md) and in PRs #1–#7.)

**1. The AI sounded confident and was wrong.**
Early summaries invented due dates ("Next Checkpoint", "End of Week") that nobody agreed to, filled space with canned template sentences, and displayed a "High Accuracy" label that was simply hardcoded. *What changed:* every fabricated fallback was removed, accuracy is now computed from how many citations actually resolve to their source, and empty sections became a deliberate trust feature — the app shows "nothing found" rather than make something up.

**2. Every citation pointed to 00:00.**
The citation badges looked broken, but the badges were fine — the app couldn't parse its own recorder's transcript format, so every timestamp silently fell back to zero. Pasted notes had the mirror problem: fake 00:00 anchors for text that never had timestamps. *What changed:* the recorder format is parsed properly, and authored text now anchors citations to its exact source *line* instead of an invented time.

**3. Speech-to-text couldn't hear our own product.**
Browser speech recognition kept turning "waitlist" into "weightless" (and "weightlif"), "NoteFlow" into "nuclear", and "Pro tier" into "prodigal" — and each live run produced *new* variants, so fixing them one by one never ended. *What changed:* capture is now Deepgram-first with keyterm prompting for product vocabulary, backed by a small, context-bound correction dictionary. The lesson: fix recognition errors upstream; dictionaries are whack-a-mole.

**4. The summaries read like templates.**
Discussion titles were literally the first four words of the summary printed beneath them ("We have decided to…"). Action items and questions were raw spoken sentences, not tasks or questions. *What changed:* titles are now thematic, generated from the content; actions are rewritten into imperative task form and questions into question form — with the verbatim quote preserved in the citation, so the polish never replaces the evidence.

**5. One test script lied to us.**
For a long time, NoteFlow was only ever tested on a single five-line conversation — so entire classes of failure stayed invisible: questions silently dropped by a cap, delegated tasks assigned to the wrong person, weekday due dates vanishing, a reversed decision presented as current, interviews filling up with false "decisions". *What changed:* we built the five-conversation evaluation described above, with ground truth written in advance — and then fixed everything it exposed, re-measuring after each round. It's the reason this README can show its scores.

## Cost & latency *(current situation — public beta)*

NoteFlow is currently in public beta, hosted on free/starter tiers. These are the real numbers today:

**The summary itself**

| | |
|---|---|
| Cost per summary | **$0** — no LLM API is called; synthesis runs on your device |
| Compute time | **1–13 ms** for a typical meeting transcript |
| Time you experience | **~0.9 s** (most of it is the staged progress animation, by design) |
| Cost at scale | Still $0 per summary — only hosting is fixed |

**Transcription (only when you record — uploads and pasted notes are free)**

| | |
|---|---|
| Engine | Deepgram Nova-3, speaker diarisation included |
| Rate | $0.0043 per audio minute (≈ $0.26 per hour) |
| 30-minute meeting | ≈ **$0.13** |
| 60-minute meeting | ≈ **$0.26** |

**Honest beta caveats:** the backend's free tier sleeps when idle, so the first request after a quiet period can take **30–50 s** to wake up (summaries are unaffected — they don't wait for the backend). Moving to paid always-on hosting removes that wait; the per-summary economics above do not change.

## Fallback & empty-state behaviour

NoteFlow is designed to degrade honestly rather than fill gaps with invented content:

- **Transcript sources, in order:** the backend session transcript → Deepgram transcription of the recording → browser Web Speech transcript. The best available source wins; Web Speech also drives the live HUD while you record.
- **Mis-heard words:** a conservative, context-bound correction dictionary fixes known speech-to-text errors for product vocabulary (it only fires inside the right context, so ordinary sentences are never rewritten).
- **No decisions, no actions, or no open questions?** The summary shows exactly that:
  - *Action Items* → "No action items found in notes." (badge: 0 pending)
  - *Unresolved Questions* → "No unresolved questions flagged in this session."
  - *Key Decisions* → "No explicit decisions detected in this meeting notes."
  
  The sections stay visible with Add buttons so you can add an item manually — but the app will never fabricate one. In **exports**, empty sections are simply omitted.
- **No citations available** (e.g. a transcript with no extractable content): the header says so, instead of showing a grounding percentage it can't back up. Accuracy wording is always computed from the citations that actually resolved — never a static label.
- **Calendar unavailable?** Meetings can always be started manually, and transcripts or notes can be pasted at any time — no integration is a single point of failure.

## Getting started (development)

```bash
npm install
npm run dev        # frontend (Vite)
npm run server     # backend API (tsx server/index.ts)
npm run build      # type-check + production build
```

Tests are individual `tsx` suites under `test/` — for example:

```bash
npx tsx test/evaluation-top-issues.test.ts
npx tsx test/reversal-context-guards.test.ts
npx tsx test/citation-synthesis-grounding.test.ts
```

## Status

Public beta — free while in beta. Built by Yogendra Danu, Senior Product Designer, Bengaluru.

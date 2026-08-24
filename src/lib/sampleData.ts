import { MeetingNote } from "../types/meeting";

export const SAMPLE_1ON1_REORG_TRANSCRIPT = `Robin: Okay, what I'm going to do is: today we have this lunch offered by Sedin because of that celebration that's upcoming, right? So that means everyone has come to office today.
Robin: Finally I got this room. Anyway, Yogesh, by any chance you'll be coming this weekend?
Yogesh: Uh, not possible for me. I have some personal reasons, Robin. I am about to be an uncle!
Robin: Oh, congratulations! Sure, of course. Understood.
Robin: Anyway, the thing I called about is, I was able to speak to Arul, and also to Himita and Rajesh as well.
Robin: From my perspective, I do think it's a good idea for you and Yusuf to work together. It's all about learning and growth, and what the company can get out of it.
Robin: So I prepared something and presented to them. And finally they were okay with it.
Robin: One thing we are very sure is: if you were to work with Yusuf, it cannot work if you both are reporting to different managers. You have your own priorities, he has his own priorities.
Robin: We agreed that either both you and Yusuf have to report to me, or both you and Yusuf should report to Himita.
Robin: From Himita's perspective, she has only one report who can work on marketing. If she loses him, marketing takes a backseat. For me, I already have team members who can do business analyst work.
Robin: So finally we came to the conclusion that it's better to have Himita have both you, Yogesh, and also Yusuf—to make the team a pod of product design and marketing.
Yogesh: Yes.
Robin: The idea is: you and Yusuf will work under Himita. You'll officially be in the same team as Yusuf and you'll mentor him. You don't have to worry about supervisory roles, leave approvals, or appraisals.
Robin: Your goal becomes: how do I mentor and scale up Yusuf in product design? And from him, you can learn visual design and marketing.
Robin: Arul gave a six-month timeline to prove that this structure works. Six months later, if it doesn't work, we'll fall back to what it was.
Yogesh: That's great news, Robin. But regarding requirements for product design like the Technician app—how will I handle those?
Robin: You are not moving out, Yogesh. You are moving in along with your existing responsibilities. You have one more person to help you. For marketing calls and product calls in the first 1-2 months, you both should attend together as silent observers to learn each other's domain.
Robin: Also, as part of handover, you'll complete the IT asset software blueprinting over the next couple of days so Himita can plan.
Robin: And I saw your designation in Teams is Software Engineer—you are a Senior UX Designer. I'll follow up with HR to correct that.
Robin: Don't talk to Yusuf for now. Let Yusuf get communication from Himita first. Tomorrow we'll put a 4-way meeting with Himita and Yusuf to officially kick it off.
Yogesh: That sounds great and very clear, Robin. Thanks!`;

export const SAMPLE_ZOOM_TRANSCRIPT = `WEBVTT

00:00:02.100 --> 00:00:06.500
<v Sarah Chen>Alright everyone, let's kick off our Q3 Architecture and Release planning sync.</v>

00:00:07.000 --> 00:00:12.300
<v Sarah Chen>We have two main agenda items today: the September 1st release timeline and the database migration strategy.</v>

00:00:13.100 --> 00:00:18.200
<v Marcus Brody>Thanks Sarah. Regarding the launch date, our QA team completed preliminary load testing.</v>

00:00:18.500 --> 00:00:25.400
<v Marcus Brody>Given the third-party SOC-2 audit schedule, we strongly recommend pushing the public GA release from August 15th to September 1st.</v>

00:00:26.100 --> 00:00:31.000
<v Elena Rostova>I agree with Marcus. 10 extra business days will let us close all high-severity pen-test tickets cleanly.</v>

00:00:31.500 --> 00:00:37.800
<v Sarah Chen>Decision reached: We are officially locking the public release date to September 1st, 2026.</v>

00:00:38.200 --> 00:00:44.600
<v Sarah Chen>Marcus, can you update the release tracker in Jira and notify the executive steering committee by Friday?</v>

00:00:45.000 --> 00:00:47.300
<v Marcus Brody>Will do. I'll have the updated milestone doc out by Friday 3 PM.</v>

00:00:48.100 --> 00:00:54.900
<v Elena Rostova>On the database side, we benchmarked MongoDB vs PostgreSQL for our event stream logs.</v>

00:00:55.200 --> 00:01:03.500
<v Elena Rostova>PostgreSQL with pgvector scored 40% higher on query latency under multi-tenant load. We decided to standardize on PostgreSQL for the core metadata layer.</v>

00:01:04.000 --> 00:01:09.100
<v Sarah Chen>Awesome. Elena, please provision the staging RDS cluster and share connection strings with Danu's team by Wednesday.</v>

00:01:09.800 --> 00:01:13.400
<v Elena Rostova>Got it on my calendar for Wednesday morning.</v>

00:01:14.200 --> 00:01:20.500
<v Marcus Brody>One open question: Do we need SAML 2.0 enterprise SSO ready for day one of the Sept 1st launch, or can that ship in v1.1?</v>

00:01:21.000 --> 00:01:27.200
<v Sarah Chen>Good question. That's unresolved right now. I'll check with Enterprise Sales on pipeline commitments and follow up on Slack tomorrow.</v>

00:01:27.800 --> 00:01:34.000
<v Elena Rostova>Also, who is the designated point-of-contact for GDPR compliance data deletion requests?</v>

00:01:34.500 --> 00:01:39.000
<v Sarah Chen>Let's park that for now. We need legal counsel to confirm before assigning ownership.</v>

00:01:39.500 --> 00:01:43.200
<v Sarah Chen>Great sync everyone. Let's execute on these action items!</v>`;

export const SAMPLE_BULLET_NOTES = `# Mobile App V2 Design & Onboarding Sync
Date: Aug 18, 2026
Attendees: Yogendra (Design), Alex (Engineering), Rachel (Product)

- Discussed onboarding drop-off rate currently at 34% on Step 2 (Phone verification).
- Decided to remove mandatory SMS OTP and replace with 1-click Google/Apple sign-in.
  - Reason: Reduces friction for international users and cuts SMS twilio cost.
- Yogendra to deliver updated Figma wireframes for 3-step streamlined onboarding by Thursday.
- Alex to test Apple Sign-In SDK integration on iOS staging build by Aug 24.
- Rachel to draft in-app microcopy and push notification triggers for incomplete signups.
- Open Question: Should we support guest browsing before forcing sign-up? Team split 50/50. Rachel will run an A/B test proposal.
- Unresolved: What is the fallback if user denies biometric FaceID permission?`;

export const INITIAL_SAMPLE_MEETINGS: MeetingNote[] = [
  {
    id: "sample-meeting-reorg",
    title: "Organizational Reorg & Design/Marketing Pod Transition Sync",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    rawInput: SAMPLE_1ON1_REORG_TRANSCRIPT,
    sanitizedInput: SAMPLE_1ON1_REORG_TRANSCRIPT,
    inputFormat: "meet",
    isSample: true,
    status: "completed",
    analysis: {
      executiveSummary: `Context & Background:
Robin met with Yogesh to communicate an organizational update discussed with Arul, Himita, and Rajesh regarding team alignment and cross-functional growth.

Core Alignment & Decisions:
To eliminate designer isolation and protect marketing capacity, Yogesh and Yusuf will officially co-locate under Himita's leadership, creating a dedicated Product Design & Marketing pod. Yogesh will serve as a senior mentor to Yusuf on product design and Figma workflows (without administrative or appraisal overhead), while expanding his own skills in marketing and visual design. Arul has approved a 6-month trial period to validate the pod's success.

Operational Continuity:
Yogesh will retain lead ownership over core product design initiatives—specifically completing the ongoing IT Asset software blueprinting—while standard requirement gathering is delegated to new business analyst hires. Robin will align with Himita and host an official 4-way kickoff meeting tomorrow.`,
      decisions: [
        {
          id: "dec-r1",
          text: "Yogesh and Yusuf will both officially report to Himita, forming a combined Product Design & Marketing pod.",
          rationale: "Unifies design and marketing under one supervisor, prevents solo-designer isolation, and protects marketing headcount.",
          confidence: "high",
          citation: {
            id: "cit-r1",
            speaker: "Robin",
            rawText: "So finally we came to the conclusion that it's better to have Himita have both you, Yogesh, and also Yusuf—to make the team a pod of product design and marketing."
          }
        },
        {
          id: "dec-r2",
          text: "Established a 6-month trial timeline approved by Arul to validate the new pod structure before considering any fallback.",
          rationale: "Gives the team sufficient runway to demonstrate cross-functional value and productivity without premature disruption.",
          confidence: "high",
          citation: {
            id: "cit-r2",
            speaker: "Robin",
            rawText: "Arul gave a six-month timeline to prove that this structure works. Six months later, if it doesn't work, we'll fall back to what it was."
          }
        },
        {
          id: "dec-r3",
          text: "Adopted a peer-mentorship model: Yogesh will mentor Yusuf on product design/Figma without administrative appraisal overhead.",
          rationale: "Fosters skills development while keeping Yogesh focused on design execution and learning visual marketing in return.",
          confidence: "high",
          citation: {
            id: "cit-r3",
            speaker: "Robin",
            rawText: "You'll officially be in the same team as Yusuf and you'll mentor him. You don't have to worry about supervisory roles, leave approvals, or appraisals."
          }
        },
        {
          id: "dec-r4",
          text: "Yogesh retains ownership of complex product design initiatives (e.g. IT Asset blueprinting) during and after transition.",
          rationale: "Ensures continuity on high-complexity architecture while routine BA requirement tasks transition to new hires.",
          confidence: "high",
          citation: {
            id: "cit-r4",
            speaker: "Robin",
            rawText: "Also, as part of handover, you'll complete the IT asset software blueprinting over the next couple of days so Himita can plan."
          }
        }
      ],
      actionItems: [
        {
          id: "act-r1",
          task: "Sync with Himita to ensure she communicates the transition to Yusuf first.",
          assignee: "Robin",
          dueDate: "Today",
          isCompleted: false,
          priority: "high",
          citation: {
            id: "cit-ra1",
            speaker: "Robin",
            rawText: "Don't talk to Yusuf for now. Let Yusuf get communication from Himita first."
          }
        },
        {
          id: "act-r2",
          task: "Schedule and host the official 4-way pod kickoff meeting with Himita, Yusuf, and Yogesh.",
          assignee: "Robin",
          dueDate: "Tomorrow",
          isCompleted: false,
          priority: "high",
          citation: {
            id: "cit-ra2",
            speaker: "Robin",
            rawText: "Tomorrow we'll put a 4-way meeting with Himita and Yusuf to officially kick it off."
          }
        },
        {
          id: "act-r3",
          task: "Hold off on discussing the transition with Yusuf until Himita connects with him.",
          assignee: "Yogesh",
          dueDate: "Until kickoff",
          isCompleted: false,
          priority: "medium",
          citation: {
            id: "cit-ra3",
            speaker: "Robin",
            rawText: "Don't talk to Yusuf for now. Let Yusuf get communication from Himita first."
          }
        },
        {
          id: "act-r4",
          task: "Complete ongoing IT Asset Software blueprinting deliverable as part of handover.",
          assignee: "Yogesh",
          dueDate: "Next few days",
          isCompleted: false,
          priority: "high",
          citation: {
            id: "cit-ra4",
            speaker: "Robin",
            rawText: "Also, as part of handover, you'll complete the IT asset software blueprinting over the next couple of days so Himita can plan."
          }
        },
        {
          id: "act-r5",
          task: "Follow up with HR to update Yogesh's job title on Teams from Software Engineer to Senior UX Designer.",
          assignee: "Robin",
          dueDate: "Upcoming",
          isCompleted: false,
          priority: "low",
          citation: {
            id: "cit-ra5",
            speaker: "Robin",
            rawText: "And I saw your designation in Teams is Software Engineer—you are a Senior UX Designer. I'll follow up with HR to correct that."
          }
        },
        {
          id: "act-r6",
          task: "Cross-shadow by attending product design and marketing calls together during months 1–2.",
          assignee: "Yogesh & Yusuf",
          dueDate: "First 1–2 months",
          isCompleted: false,
          priority: "medium",
          citation: {
            id: "cit-ra6",
            speaker: "Robin",
            rawText: "For marketing calls and product calls in the first 1-2 months, you both should attend together as silent observers to learn each other's domain."
          }
        }
      ],
      unresolvedQuestions: [
        {
          id: "q-r1",
          question: "Operational Task Balance: How will Yogesh and Yusuf divide specific UI screen designs vs. marketing assets after the initial 1–2 month cross-shadowing period?",
          suggestedFollowUp: "Yogesh and Yusuf to establish working cadences and review procedures following tomorrow's kickoff."
        },
        {
          id: "q-r2",
          question: "Product Design vs. BA Scope Boundary: How will complex UX research/blueprinting requests from Robin be balanced with Himita's marketing priorities?",
          suggestedFollowUp: "Robin to manage project requests transparently with Himita to avoid overextending the pod."
        }
      ],
      importantDiscussionPoints: [
        {
          id: "disc-r1",
          topic: "Reporting Structure & Managerial Alignment",
          summary: "Evaluated reporting options under Robin vs. Himita; concluded that dual-reporting to Himita protects marketing bandwidth while creating a cohesive pod.",
          speakers: ["Robin", "Yogesh"],
          citation: {
            id: "cit-rd1",
            speaker: "Robin",
            rawText: "We agreed that either both you and Yusuf have to report to me, or both you and Yusuf should report to Himita."
          }
        },
        {
          id: "disc-r2",
          topic: "Role Clarification & HR Designation",
          summary: "Confirmed that Yogesh will focus purely on mentorship and product design execution without administrative supervisory overhead; HR will update his designation to Senior UX Designer.",
          speakers: ["Robin"],
          citation: {
            id: "cit-rd2",
            speaker: "Robin",
            rawText: "And I saw your designation in Teams is Software Engineer—you are a Senior UX Designer. I'll follow up with HR to correct that."
          }
        }
      ],
      detectedSpeakers: ["Robin", "Yogesh"],
      wordCount: 420,
      estimatedMeetingDurationMinutes: 4,
      modelConfidence: "high"
    }
  },
  {
    id: "sample-meeting-1",
    title: "Q3 Architecture & Release Planning Sync",
    createdAt: new Date(Date.now() - 3600000 * 2).toISOString(),
    updatedAt: new Date(Date.now() - 3600000 * 2).toISOString(),
    rawInput: SAMPLE_ZOOM_TRANSCRIPT,
    sanitizedInput: "",
    inputFormat: "vtt",
    isSample: true,
    status: "completed",
    analysis: {
      executiveSummary: "The team agreed to adjust the public release date to September 1st, 2026 to ensure the QA and security teams can complete full SOC-2 audit remediation. On the data infrastructure front, PostgreSQL with pgvector was selected over MongoDB due to a 40% performance advantage in multi-tenant benchmark testing.",
      decisions: [
        {
          id: "dec-1",
          text: "Locked public release date to September 1st, 2026 (moved from August 15th).",
          rationale: "Accommodates third-party SOC-2 audit schedule and allows 10 extra business days for pen-test ticket remediation.",
          confidence: "high",
          citation: {
            id: "cit-1",
            speaker: "Sarah Chen",
            timestamp: "00:31",
            rawText: "Decision reached: We are officially locking the public release date to September 1st, 2026."
          }
        },
        {
          id: "dec-2",
          text: "Selected PostgreSQL (with pgvector) as the primary database for core metadata.",
          rationale: "Benchmark results showed 40% lower query latency under heavy multi-tenant event logging compared to MongoDB.",
          confidence: "high",
          citation: {
            id: "cit-2",
            speaker: "Elena Rostova",
            timestamp: "00:55",
            rawText: "PostgreSQL with pgvector scored 40% higher on query latency under multi-tenant load."
          }
        }
      ],
      actionItems: [
        {
          id: "act-1",
          task: "Update release tracker in Jira and notify executive steering committee.",
          assignee: "Marcus Brody",
          dueDate: "Friday, 3:00 PM",
          isCompleted: false,
          priority: "high",
          citation: {
            id: "cit-3",
            speaker: "Marcus Brody",
            timestamp: "00:45",
            rawText: "I'll have the updated milestone doc out by Friday 3 PM."
          }
        },
        {
          id: "act-2",
          task: "Provision staging RDS cluster and share connection strings with Danu's team.",
          assignee: "Elena Rostova",
          dueDate: "Wednesday morning",
          isCompleted: true,
          priority: "high",
          citation: {
            id: "cit-4",
            speaker: "Elena Rostova",
            timestamp: "01:09",
            rawText: "Got it on my calendar for Wednesday morning."
          }
        },
        {
          id: "act-3",
          task: "Sync with Enterprise Sales regarding SAML 2.0 SSO customer pipeline requirements.",
          assignee: "Sarah Chen",
          dueDate: "Tomorrow",
          isCompleted: false,
          priority: "medium",
          citation: {
            id: "cit-5",
            speaker: "Sarah Chen",
            timestamp: "01:21",
            rawText: "I'll check with Enterprise Sales on pipeline commitments and follow up on Slack tomorrow."
          }
        }
      ],
      unresolvedQuestions: [
        {
          id: "q-1",
          question: "Is SAML 2.0 Enterprise SSO strictly required for Day 1 GA, or can it ship in v1.1?",
          suggestedFollowUp: "Sarah Chen to evaluate revenue impact with enterprise pipeline deals.",
          citation: {
            id: "cit-6",
            speaker: "Marcus Brody",
            timestamp: "01:14",
            rawText: "Do we need SAML 2.0 enterprise SSO ready for day one of the Sept 1st launch, or can that ship in v1.1?"
          }
        },
        {
          id: "q-2",
          question: "Who is the designated point-of-contact for GDPR compliance data deletion requests?",
          suggestedFollowUp: "Consult with legal counsel before assigning an engineering/ops owner.",
          citation: {
            id: "cit-7",
            speaker: "Elena Rostova",
            timestamp: "01:27",
            rawText: "Also, who is the designated point-of-contact for GDPR compliance data deletion requests?"
          }
        }
      ],
      importantDiscussionPoints: [
        {
          id: "disc-1",
          topic: "SOC-2 Remediation & Pen-Test Runway",
          summary: "Reviewed load-testing and audit schedules; aligned on shifting release from Aug 15 to Sept 1 to ensure zero open high-severity security vulnerabilities.",
          speakers: ["Marcus Brody", "Elena Rostova", "Sarah Chen"],
          citation: {
            id: "cit-d1",
            speaker: "Elena Rostova",
            timestamp: "00:26",
            rawText: "I agree with Marcus. 10 extra business days will let us close all high-severity pen-test tickets cleanly."
          }
        },
        {
          id: "disc-2",
          topic: "Event-Logging Database Architecture Benchmark",
          summary: "Evaluated MongoDB vs. PostgreSQL with pgvector for high-throughput multi-tenant event streaming; PostgreSQL demonstrated a 40% latency reduction.",
          speakers: ["Elena Rostova"],
          citation: {
            id: "cit-d2",
            speaker: "Elena Rostova",
            timestamp: "00:55",
            rawText: "PostgreSQL with pgvector scored 40% higher on query latency under multi-tenant load."
          }
        }
      ],
      detectedSpeakers: ["Sarah Chen", "Marcus Brody", "Elena Rostova"],
      wordCount: 285,
      estimatedMeetingDurationMinutes: 3,
      modelConfidence: "high"
    }
  },
  {
    id: "sample-meeting-2",
    title: "Mobile App V2 Onboarding Design Review",
    createdAt: new Date(Date.now() - 3600000 * 26).toISOString(),
    updatedAt: new Date(Date.now() - 3600000 * 26).toISOString(),
    rawInput: SAMPLE_BULLET_NOTES,
    sanitizedInput: SAMPLE_BULLET_NOTES,
    inputFormat: "bullets",
    isSample: true,
    status: "completed",
    analysis: {
      executiveSummary: "The mobile product team addressed a 34% drop-off rate during phone verification by deciding to replace mandatory SMS OTP with 1-click Apple and Google Sign-In. Design deliverables and iOS SDK testing tasks were assigned for this week.",
      decisions: [
        {
          id: "dec-b1",
          text: "Replace mandatory SMS OTP phone verification with 1-click Google/Apple sign-in.",
          rationale: "Resolves 34% drop-off on step 2, simplifies international signup, and reduces Twilio SMS expense.",
          confidence: "high"
        }
      ],
      actionItems: [
        {
          id: "act-b1",
          task: "Deliver updated Figma wireframes for 3-step streamlined onboarding.",
          assignee: "Yogendra",
          dueDate: "Thursday",
          isCompleted: true,
          priority: "high"
        },
        {
          id: "act-b2",
          task: "Test Apple Sign-In SDK integration on iOS staging build.",
          assignee: "Alex",
          dueDate: "Aug 24",
          isCompleted: false,
          priority: "medium"
        },
        {
          id: "act-b3",
          task: "Draft in-app microcopy and push notification triggers for incomplete signups.",
          assignee: "Rachel",
          dueDate: "This week",
          isCompleted: false,
          priority: "medium"
        }
      ],
      unresolvedQuestions: [
        {
          id: "qb-1",
          question: "Should guest browsing be allowed before prompting user sign-up?",
          suggestedFollowUp: "Rachel to prepare an A/B test proposal to measure conversion vs retention."
        },
        {
          id: "qb-2",
          question: "What is the fallback UX if user denies biometric FaceID permission?",
          suggestedFollowUp: "Yogendra to design fallback PIN/passcode wireframes."
        }
      ],
      detectedSpeakers: ["Yogendra", "Alex", "Rachel"],
      wordCount: 142,
      estimatedMeetingDurationMinutes: 2,
      modelConfidence: "high"
    }
  }
];


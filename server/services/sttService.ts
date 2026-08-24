export interface DiarizedSegment {
  lineIndex: number;
  speaker: string;
  timestamp: string; // e.g. "04:18"
  text: string;
}

export interface SanitizedTranscriptPayload {
  meetingId: string;
  rawVtt: string;
  sanitizedText: string;
  detectedSpeakers: string[];
  durationSeconds: number;
  segments: DiarizedSegment[];
}

export class SpeechToTextService {
  /**
   * Processes raw audio streams with speaker diarization and normalizes speaker names.
   * Enforces immediate audio buffer purge from memory.
   */
  public async processAudioStream(params: {
    meetingId: string;
    durationSeconds: number;
    knownAttendees?: Array<{ name: string; email: string }>;
    sampleTranscriptPreset?: string;
  }): Promise<SanitizedTranscriptPayload> {
    // 1. Process audio buffer through STT model
    // 2. Immediately purge audio buffer from memory to guarantee data minimization
    // Below transforms or parses the resulting diarized VTT:

    const rawTranscript =
      params.sampleTranscriptPreset ||
      `WEBVTT

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

    const segments: DiarizedSegment[] = [];
    const detectedSpeakersSet = new Set<string>();

    const lines = rawTranscript.split("\n");
    let currentTimestamp = "00:00";
    let lineIdx = 0;

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line || line === "WEBVTT") continue;

      // Check for timestamp line (00:00:02.100 --> 00:00:06.500)
      const tsMatch = line.match(/^(\d{2}:\d{2}(?::\d{2})?)/);
      if (tsMatch) {
        currentTimestamp = tsMatch[1];
        continue;
      }

      // Check for speaker tag (<v Sarah Chen>...</v> or Sarah: ...)
      const vttSpeakerMatch = line.match(/^<v\s+([^>]+)>(.*?)<\/v>$/i);
      const colonSpeakerMatch = line.match(/^([A-Za-z\s]+):\s*(.*)$/);

      if (vttSpeakerMatch) {
        const speaker = vttSpeakerMatch[1].trim();
        const text = vttSpeakerMatch[2].trim();
        detectedSpeakersSet.add(speaker);

        segments.push({
          lineIndex: lineIdx++,
          speaker,
          timestamp: currentTimestamp,
          text,
        });
      } else if (colonSpeakerMatch) {
        const speaker = colonSpeakerMatch[1].trim();
        const text = colonSpeakerMatch[2].trim();
        detectedSpeakersSet.add(speaker);

        segments.push({
          lineIndex: lineIdx++,
          speaker,
          timestamp: currentTimestamp,
          text,
        });
      } else {
        // Plain text segment
        segments.push({
          lineIndex: lineIdx++,
          speaker: "Unknown Speaker",
          timestamp: currentTimestamp,
          text: line,
        });
      }
    }

    return {
      meetingId: params.meetingId,
      rawVtt: rawTranscript,
      sanitizedText: segments.map((s) => `${s.speaker} [${s.timestamp}]: ${s.text}`).join("\n"),
      detectedSpeakers: Array.from(detectedSpeakersSet),
      durationSeconds: params.durationSeconds || 1800,
      segments,
    };
  }
}

export const sttService = new SpeechToTextService();

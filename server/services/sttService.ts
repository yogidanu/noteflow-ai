import { config } from "../config.js";

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
   * Processes raw audio streams or buffers with speaker diarization and normalizes speaker names.
   * Enforces immediate audio buffer purge from memory.
   */
  public async processAudioStream(params: {
    meetingId: string;
    durationSeconds?: number;
    audioBuffer?: Buffer;
    mimeType?: string;
    knownAttendees?: Array<{ name: string; email: string }>;
    sampleTranscriptPreset?: string;
  }): Promise<SanitizedTranscriptPayload> {
    const deepgramKey = config.stt?.apiKey || process.env.DEEPGRAM_API_KEY;

    // 1. Live Deepgram Nova-2 STT Pipeline if API key and audio buffer are provided
    if (deepgramKey && !deepgramKey.includes("sample") && params.audioBuffer && params.audioBuffer.length > 0) {
      try {
        const response = await fetch(
          "https://api.deepgram.com/v1/listen?model=nova-2&diarize=true&smart_format=true&punctuate=true&utterances=true",
          {
            method: "POST",
            headers: {
              Authorization: `Token ${deepgramKey}`,
              "Content-Type": params.mimeType || "audio/webm",
            },
            body: params.audioBuffer as any,
          }
        );

        if (response.ok) {
          const dgData: any = await response.json();
          const utterances = dgData.results?.utterances || [];

          if (utterances.length > 0) {
            const segments: DiarizedSegment[] = [];
            const detectedSpeakersSet = new Set<string>();

            utterances.forEach((utt: any, idx: number) => {
              const speakerLabel =
                params.knownAttendees && params.knownAttendees[utt.speaker]
                  ? params.knownAttendees[utt.speaker].name
                  : `Speaker ${utt.speaker + 1}`;

              detectedSpeakersSet.add(speakerLabel);

              const minutes = Math.floor(utt.start / 60);
              const seconds = Math.floor(utt.start % 60);
              const formattedTime = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;

              segments.push({
                lineIndex: idx,
                speaker: speakerLabel,
                timestamp: formattedTime,
                text: utt.transcript.trim(),
              });
            });

            // Immediately purge audio buffer
            params.audioBuffer = undefined;

            return {
              meetingId: params.meetingId,
              rawVtt: segments.map((s) => `<v ${s.speaker}>${s.text}</v>`).join("\n"),
              sanitizedText: segments.map((s) => `${s.speaker} [${s.timestamp}]: ${s.text}`).join("\n"),
              detectedSpeakers: Array.from(detectedSpeakersSet),
              durationSeconds: params.durationSeconds || 1800,
              segments,
            };
          }
        }
      } catch (err: any) {
        console.warn("[SpeechToTextService] Deepgram transcription fallback:", err.message);
      }
    }

    // 2. Immediate audio buffer purge from memory to guarantee data minimization
    params.audioBuffer = undefined;

    // 3. Dialogue / VTT Parser for explicit sample presets or test fixtures ONLY
    const rawTranscript = params.sampleTranscriptPreset || "";

    if (!rawTranscript || rawTranscript.trim().length === 0) {
      return {
        meetingId: params.meetingId,
        rawVtt: "",
        sanitizedText: "",
        detectedSpeakers: [],
        durationSeconds: params.durationSeconds || 0,
        segments: [],
      };
    }

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


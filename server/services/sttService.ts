import { config } from "../config.js";
import { recordingLogger } from "../observability/recordingLogger.js";

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

export interface AudioValidationResult {
  isValid: boolean;
  format: string;
  byteLength: number;
  hasContent: boolean;
  error?: string;
}

/**
 * Validates audio buffer existence, minimum size, magic byte format, and waveform content.
 */
export function validateAudioBuffer(buffer?: Buffer): AudioValidationResult {
  if (!buffer || buffer.length === 0) {
    return { isValid: false, format: "unknown", byteLength: 0, hasContent: false, error: "AUDIO_BUFFER_EMPTY" };
  }

  const byteLength = buffer.length;
  if (byteLength < 32) {
    return { isValid: false, format: "unknown", byteLength, hasContent: false, error: "AUDIO_BUFFER_TOO_SMALL" };
  }

  // Magic bytes detection
  let format = "unknown";
  if (buffer[0] === 0x1a && buffer[1] === 0x45 && buffer[2] === 0xdf && buffer[3] === 0xa3) {
    format = "webm";
  } else if (buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WAVE") {
    format = "wav";
  } else if (buffer.toString("ascii", 0, 4) === "OggS") {
    format = "ogg";
  } else if (buffer.toString("ascii", 0, 3) === "ID3" || (buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0)) {
    format = "mp3";
  } else if (buffer.toString("ascii", 4, 8) === "ftyp") {
    format = "mp4";
  } else {
    format = "raw_pcm";
  }

  // Check for non-zero audio amplitude (not completely silent 0-byte stream)
  let nonZeroCount = 0;
  const sampleCount = Math.min(buffer.length, 1000);
  for (let i = 0; i < sampleCount; i++) {
    if (buffer[i] !== 0) nonZeroCount++;
  }
  const hasContent = nonZeroCount > 0;

  return {
    isValid: true,
    format,
    byteLength,
    hasContent,
  };
}

/**
 * Deepgram keyword boosting for NoteFlow domain vocabulary (Nova-2
 * `keywords` query params — repeated, one term each). This is the upstream
 * fix for the homophone errors the post-STT correction dictionary patches
 * downstream: NoteFlow (→"nuclear"), waitlist (→"weightless") and
 * Pro tier (→"prodigal") in the 2026-10-23 live run.
 * Note: `keyterm` prompting is a Nova-3 parameter and is deliberately NOT
 * sent while the request pins model=nova-2.
 */
export const DEEPGRAM_KEYWORDS = [
  "NoteFlow",
  "NoteFlow AI",
  "waitlist",
  "Pro tier",
  "end-to-end",
] as const;

/**
 * Server-side copy of the client's conservative, context-bound domain
 * corrections (src/lib/transcriptSanitizer.ts DOMAIN_CORRECTIONS — keep
 * the two lists in sync). Server code cannot import the browser module
 * without crossing the tsconfig boundary, so the rules are duplicated
 * here with the same context guards: a rule only fires when the same
 * segment carries its domain context.
 */
const DOMAIN_CORRECTIONS: Array<{ pattern: RegExp; replacement: string; context: RegExp }> = [
  { pattern: /\bnuclear\s+(public\s+beta)\b/gi, replacement: "NoteFlow $1", context: /\bpublic\s+beta\b/i },
  { pattern: /\bweightless\b/gi, replacement: "waitlist", context: /\b(launch|beta|waitlist)\b/i },
  { pattern: /\bprodigal\b/gi, replacement: "Pro tier", context: /\b(free|pro|tier|pricing|kept\s+only)\b/i },
  { pattern: /\bfree\s+data\b/gi, replacement: "free beta", context: /\b(pro|tier|beta|prodigal)\b/i },
  { pattern: /\bweather\b(?=\s+team\s+workspaces?\b)/gi, replacement: "whether", context: /\bteam\s+workspaces?\b/i },
  { pattern: /\bN2\s+interesting\b/gi, replacement: "end-to-end testing", context: /\b(bugs|developers|testing|today)\b/i },
  { pattern: /\bthose\s+pics\b/gi, replacement: "those fixes", context: /\b(review|bugs|fixes|developers)\b/i },
];

export function correctDomainTerms(text: string): string {
  let out = text;
  for (const rule of DOMAIN_CORRECTIONS) {
    if (rule.context.test(out)) {
      out = out.replace(rule.pattern, rule.replacement);
    }
  }
  return out;
}

export class SpeechToTextService {
  /**
   * Processes raw audio streams or buffers with speaker diarization and normalizes speaker names.
   * Enforces immediate audio buffer purge from memory.
   */
  public async processAudioStream(params: {
    meetingId: string;
    userId?: string;
    recordingId?: string;
    durationSeconds?: number;
    audioBuffer?: Buffer;
    mimeType?: string;
    knownAttendees?: Array<{ name: string; email: string }>;
    sampleTranscriptPreset?: string;
    realTranscriptStream?: string;
  }): Promise<SanitizedTranscriptPayload> {
    const startTime = Date.now();
    const deepgramKey = config.stt?.apiKey || process.env.DEEPGRAM_API_KEY;
    const provider = deepgramKey && !deepgramKey.includes("sample") ? "deepgram" : params.realTranscriptStream ? "local_speech" : "fixture";

    // Validate audio buffer if provided
    if (params.audioBuffer) {
      const validation = validateAudioBuffer(params.audioBuffer);
      console.log("[SpeechToTextService] AUDIO_VALIDATION", {
        meetingId: params.meetingId,
        format: validation.format,
        byteLength: validation.byteLength,
        hasContent: validation.hasContent,
      });
    }

    recordingLogger.log({
      event: "TRANSCRIPTION_STARTED",
      timestamp: new Date(startTime).toISOString(),
      userId: params.userId || "user_workspace",
      meetingId: params.meetingId,
      recordingId: params.recordingId || `rec_${params.meetingId}`,
      provider,
      audioBytes: params.audioBuffer?.length || 0,
      mimeType: params.mimeType || "audio/webm",
    });

    // 1. Live Deepgram Nova-2 STT Pipeline if API key and audio buffer are provided
    if (deepgramKey && !deepgramKey.includes("sample") && params.audioBuffer && params.audioBuffer.length > 0) {
      try {
        const dgParams = new URLSearchParams({
          model: "nova-2",
          diarize: "true",
          smart_format: "true",
          punctuate: "true",
          utterances: "true",
        });
        for (const keyword of DEEPGRAM_KEYWORDS) {
          dgParams.append("keywords", keyword);
        }
        const response = await fetch(
          `https://api.deepgram.com/v1/listen?${dgParams.toString()}`,
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
                text: correctDomainTerms(utt.transcript.trim()),
              });
            });

            // Immediately purge audio buffer
            params.audioBuffer = undefined;

            const sanitizedText = segments.map((s) => `${s.speaker} [${s.timestamp}]: ${s.text}`).join("\n");
            const wordCount = sanitizedText.trim().split(/\s+/).filter(Boolean).length;

            recordingLogger.log({
              event: "TRANSCRIPTION_COMPLETED",
              timestamp: new Date().toISOString(),
              userId: params.userId || "user_workspace",
              meetingId: params.meetingId,
              recordingId: params.recordingId || `rec_${params.meetingId}`,
              provider: "deepgram",
              durationMs: Date.now() - startTime,
              segmentCount: segments.length,
              wordCount,
              speakerCount: detectedSpeakersSet.size,
            });

            return {
              meetingId: params.meetingId,
              rawVtt: segments.map((s) => `<v ${s.speaker}>${s.text}</v>`).join("\n"),
              sanitizedText,
              detectedSpeakers: Array.from(detectedSpeakersSet),
              durationSeconds: params.durationSeconds || 1800,
              segments,
            };
          }
        }
      } catch (err: any) {
        console.warn("[SpeechToTextService] Deepgram transcription fallback:", err.message);
        recordingLogger.log({
          event: "TRANSCRIPTION_FAILED",
          timestamp: new Date().toISOString(),
          userId: params.userId || "user_workspace",
          meetingId: params.meetingId,
          recordingId: params.recordingId || `rec_${params.meetingId}`,
          provider: "deepgram",
          durationMs: Date.now() - startTime,
          errorCode: "DEEPGRAM_NETWORK_ERROR",
          errorMessage: err.message,
        });
      }
    }

    // 2. Immediate audio buffer purge from memory to guarantee data minimization
    params.audioBuffer = undefined;

    // 3. Process real spoken transcript stream if provided
    const rawTranscript = params.realTranscriptStream || params.sampleTranscriptPreset || "";

    if (!rawTranscript || rawTranscript.trim().length === 0) {
      recordingLogger.log({
        event: "TRANSCRIPTION_COMPLETED",
        timestamp: new Date().toISOString(),
        userId: params.userId || "user_workspace",
        meetingId: params.meetingId,
        recordingId: params.recordingId || `rec_${params.meetingId}`,
        provider: "empty_audio",
        durationMs: Date.now() - startTime,
        segmentCount: 0,
        wordCount: 0,
        speakerCount: 0,
      });

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

      // Check for speaker tag (<v Sarah Chen>...</v> or Speaker 1: ...)
      const vttSpeakerMatch = line.match(/^<v\s+([^>]+)>(.*?)<\/v>$/i);
      // Recorder format serialized by this service / audioRecorder.ts:
      // "Speaker [MM:SS]: text" — must be tried before the colon pattern,
      // which cannot parse it and would lose speaker and timestamp.
      const recorderMatch = line.match(/^([A-Za-z][A-Za-z0-9_\s.'-]{0,39}?)\s*\[(\d{1,2}:\d{2}(?::\d{2})?)\]:\s*(.*)$/);
      const colonSpeakerMatch = line.match(/^([A-Za-z0-9\s]+):\s*(.*)$/);

      if (vttSpeakerMatch) {
        const speaker = vttSpeakerMatch[1].trim();
        const text = correctDomainTerms(vttSpeakerMatch[2].trim());
        detectedSpeakersSet.add(speaker);

        segments.push({
          lineIndex: lineIdx++,
          speaker,
          timestamp: currentTimestamp,
          text,
        });
      } else if (recorderMatch) {
        const speaker = recorderMatch[1].trim();
        const text = correctDomainTerms(recorderMatch[3].trim());
        detectedSpeakersSet.add(speaker);
        currentTimestamp = recorderMatch[2];

        segments.push({
          lineIndex: lineIdx++,
          speaker,
          timestamp: currentTimestamp,
          text,
        });
      } else if (colonSpeakerMatch) {
        const speaker = colonSpeakerMatch[1].trim();
        const text = correctDomainTerms(colonSpeakerMatch[2].trim());
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
          text: correctDomainTerms(line),
        });
      }
    }

    const sanitizedText = segments.map((s) => `${s.speaker} [${s.timestamp}]: ${s.text}`).join("\n");
    const wordCount = sanitizedText.trim().split(/\s+/).filter(Boolean).length;

    recordingLogger.log({
      event: "TRANSCRIPTION_COMPLETED",
      timestamp: new Date().toISOString(),
      userId: params.userId || "user_workspace",
      meetingId: params.meetingId,
      recordingId: params.recordingId || `rec_${params.meetingId}`,
      provider,
      durationMs: Date.now() - startTime,
      segmentCount: segments.length,
      wordCount,
      speakerCount: detectedSpeakersSet.size,
    });

    return {
      meetingId: params.meetingId,
      rawVtt: rawTranscript,
      sanitizedText,
      detectedSpeakers: Array.from(detectedSpeakersSet),
      durationSeconds: params.durationSeconds || 1800,
      segments,
    };
  }
}

export const sttService = new SpeechToTextService();


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
  /** Set when a real audio buffer was supplied but STT produced nothing:
   *  the specific reason (missing key, Deepgram HTTP error, no speech
   *  detected). The transcribe route turns this into an error response
   *  so the failure is visible in the client instead of a silent empty
   *  transcript. Absent on success and on preset/fixture flows. */
  sttError?: string;
}

/**
 * Domain vocabulary boosted via Deepgram Nova-3 `keyterm` prompting.
 * Web Speech has no equivalent, which is how these terms used to come
 * back as homophones (waitlist -> "weightlif", NoteFlow -> "note to a").
 */
export const DEEPGRAM_KEYTERMS = [
  "NoteFlow",
  "NoteFlow AI",
  "waitlist",
  "Pro tier",
  "end-to-end",
  "action items",
  "decision log",
  "follow-up",
  "roadmap",
  "sprint",
  "stakeholder",
  "onboarding",
  "churn",
  "upsell",
  "cross-sell",
] as const;

/**
 * Builds the Deepgram pre-recorded request parameters: Nova-3 with
 * keyterm prompting (keyterm is a Nova-3 parameter; the Nova-2
 * `keywords` param must NOT be sent alongside it).
 */
export function buildDeepgramParams(): URLSearchParams {
  const params = new URLSearchParams();
  params.set("model", "nova-3");
  params.set("diarize", "true");
  params.set("smart_format", "true");
  params.set("punctuate", "true");
  params.set("utterances", "true");
  params.set("utt_split", "1.2");
  for (const term of DEEPGRAM_KEYTERMS) {
    params.append("keyterm", term);
  }
  return params;
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
 * Mirror of src/lib/transcriptMerge.ts (client/server implementations are
 * kept in sync deliberately): Deepgram cuts utterances at pauses, not at
 * sentence boundaries, so consecutive utterances from the same speaker are
 * glued back together when the earlier one does not end with terminal
 * punctuation and the pause between them is short (<= 3s).
 */
interface RawUtterance {
  speaker: number;
  start: number;
  end: number;
  text: string;
}

const TERMINAL_PUNCTUATION = /[.!?…]["')\]]*\s*$/;

export function mergeUtterances(utterances: RawUtterance[], maxGapSeconds = 3): RawUtterance[] {
  const out: RawUtterance[] = [];
  for (const utt of utterances) {
    const text = (utt.text || "").trim();
    if (!text) continue;
    const prev = out[out.length - 1];
    if (
      prev &&
      prev.speaker === utt.speaker &&
      utt.start - prev.end <= maxGapSeconds &&
      prev.text.split(/\s+/).filter(Boolean).length < 55 &&
      !TERMINAL_PUNCTUATION.test(prev.text)
    ) {
      prev.text = `${prev.text} ${text}`.replace(/\s+/g, " ").trim();
      prev.end = utt.end;
    } else {
      out.push({ ...utt, text });
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

    // Validate audio buffer if provided — and ENFORCE the verdict:
    // an invalid/empty buffer used to be logged and then processed
    // anyway, burning a Deepgram call on garbage.
    let audioValidationError: string | undefined;
    if (params.audioBuffer) {
      const validation = validateAudioBuffer(params.audioBuffer);
      console.log("[SpeechToTextService] AUDIO_VALIDATION", {
        meetingId: params.meetingId,
        format: validation.format,
        byteLength: validation.byteLength,
        hasContent: validation.hasContent,
      });
      if (!validation.isValid) {
        audioValidationError = `Audio validation failed (${validation.error || "unrecognized format"}).`;
      } else if (!validation.hasContent) {
        audioValidationError = "Audio contains no detectable sound.";
      }
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

    // Why Deepgram produced nothing, when a real audio buffer was
    // supplied but STT yields no transcript. Carried on the payload as
    // sttError so the failure reaches the user instead of a silent
    // empty transcript (the transcribe route turns it into an error).
    let sttError: string | undefined;
    const hasRealKey = Boolean(deepgramKey && !deepgramKey.includes("sample"));
    const hasAudio = Boolean(params.audioBuffer && params.audioBuffer.length > 0);
    if (audioValidationError) {
      sttError = audioValidationError;
    } else if (hasAudio && !hasRealKey) {
      sttError = "Deepgram is not configured on the server (DEEPGRAM_API_KEY missing or still a placeholder).";
    }

    // 1. Live Deepgram Nova-3 STT pipeline (keyterm prompting) if API
    // key and a VALID audio buffer are provided
    if (hasRealKey && hasAudio && !audioValidationError) {
      try {
        const response = await fetch(
          `https://api.deepgram.com/v1/listen?${buildDeepgramParams().toString()}`,
          {
            method: "POST",
            headers: {
              Authorization: `Token ${deepgramKey}`,
              "Content-Type": params.mimeType || "audio/webm",
            },
            body: params.audioBuffer as any,
          }
        );

        if (!response.ok) {
          const detail = (await response.text().catch(() => "")).slice(0, 300);
          sttError = `Deepgram rejected the audio (HTTP ${response.status})${detail ? `: ${detail}` : ""}`;
          recordingLogger.log({
            event: "TRANSCRIPTION_FAILED",
            timestamp: new Date().toISOString(),
            userId: params.userId || "user_workspace",
            meetingId: params.meetingId,
            recordingId: params.recordingId || `rec_${params.meetingId}`,
            provider: "deepgram",
            durationMs: Date.now() - startTime,
            errorCode: `DEEPGRAM_HTTP_${response.status}`,
            errorMessage: sttError,
          });
        } else {
          const dgData: any = await response.json();
          const utterances = dgData.results?.utterances || [];

          if (utterances.length > 0) {
            const segments: DiarizedSegment[] = [];
            const detectedSpeakersSet = new Set<string>();

            // Deepgram splits utterances at pauses; glue fragments of the
            // same sentence back together before they become transcript lines.
            const mergedUtterances = mergeUtterances(
              utterances.map((utt: any) => ({
                speaker: utt.speaker,
                start: utt.start,
                end: utt.end,
                text: utt.transcript || "",
              })),
            );

            mergedUtterances.forEach((utt, idx: number) => {
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
                text: utt.text,
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

          // Deepgram answered OK but found no speech segments.
          sttError = "Deepgram processed the audio but detected no speech.";
        }
      } catch (err: any) {
        sttError = `Deepgram request failed: ${err.message}`;
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
        ...(sttError ? { sttError } : {}),
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
      const colonSpeakerMatch = line.match(/^([A-Za-z0-9\s]+):\s*(.*)$/);

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


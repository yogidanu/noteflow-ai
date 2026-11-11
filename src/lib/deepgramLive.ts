/**
 * Deepgram LIVE streaming transcription (added 2026-11-11).
 *
 * Why this exists: the previous live transcript came from Chrome's Web
 * Speech API, whose results only "finalize" when the speaker pauses —
 * in practice the on-screen text lagged speech by 10–15 seconds, the
 * opening seconds were often lost while the recognizer spun up, and the
 * live text frequently disagreed with the final transcript (which is
 * produced by Deepgram in batch AFTER the recording stops).
 *
 * This module streams mic PCM to Deepgram's streaming API (Nova-3,
 * same keyterm vocabulary as the batch path) over a WebSocket
 * authenticated with a short-lived grant token minted by our server
 * (POST /api/recording/stream-token — the real API key never reaches
 * the browser). Words arrive as interim results within a few hundred
 * milliseconds; finalized utterances become transcript lines. The live
 * transcript produced here IS a final-transcript candidate and outranks
 * every other source (see resolveFinalTranscript): one recognizer, one
 * transcript, no silent downgrade.
 *
 * Failure contract: any failure (no token, socket error, unexpected
 * close) is reported once via onError and the caller falls back to the
 * previous behaviour (Web Speech live captions + batch Deepgram). The
 * recording itself never depends on this module.
 */

// Kept in sync with server/services/sttService.ts DEEPGRAM_KEYTERMS
// (the client cannot import the server module; the batch list is the
// source of truth and the streaming suite pins that they match).
export const DEEPGRAM_STREAM_KEYTERMS = [
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

export function buildDeepgramStreamUrl(): string {
  const params = new URLSearchParams();
  params.set("model", "nova-3");
  params.set("language", "en");
  params.set("smart_format", "true");
  params.set("punctuate", "true");
  params.set("interim_results", "true");
  params.set("diarize", "true");
  // Endpointing + utterance end: Deepgram marks an utterance complete
  // after ~300ms of silence (endpointing) with a 1200ms hard fallback —
  // lines end at natural utterance boundaries, not at every micro-pause
  // the way Web Speech finals did.
  params.set("endpointing", "300");
  params.set("utterance_end_ms", "1200");
  params.set("vad_events", "true");
  // The recorder sends raw 16kHz mono PCM frames (see encodePcmFrame).
  params.set("encoding", "linear16");
  params.set("sample_rate", "16000");
  params.set("channels", "1");
  for (const term of DEEPGRAM_STREAM_KEYTERMS) {
    params.append("keyterm", term);
  }
  return `wss://api.deepgram.com/v1/listen?${params.toString()}`;
}

/** Downsamples Float32 mic samples to 16kHz (window-averaged). */
export function downsampleTo16k(input: Float32Array, inputSampleRate: number): Float32Array {
  if (inputSampleRate === 16000) return input;
  const ratio = inputSampleRate / 16000;
  const outLength = Math.floor(input.length / ratio);
  const out = new Float32Array(outLength);
  for (let i = 0; i < outLength; i++) {
    const start = Math.floor(i * ratio);
    const end = Math.min(input.length, Math.floor((i + 1) * ratio));
    let sum = 0;
    let count = 0;
    for (let j = start; j < end; j++) {
      sum += input[j];
      count++;
    }
    out[i] = count > 0 ? sum / count : input[start] || 0;
  }
  return out;
}

/** Converts Float32 samples (-1..1) to 16-bit little-endian PCM. */
export function floatTo16BitPcm(input: Float32Array): ArrayBuffer {
  const buffer = new ArrayBuffer(input.length * 2);
  const view = new DataView(buffer);
  for (let i = 0; i < input.length; i++) {
    const s = Math.max(-1, Math.min(1, input[i]));
    view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return buffer;
}

/** One-call helper used by the recorder: mic samples in, streamable PCM frame out. */
export function encodePcmFrame(input: Float32Array, inputSampleRate: number): ArrayBuffer {
  return floatTo16BitPcm(downsampleTo16k(input, inputSampleRate));
}

export interface LiveSegment {
  speaker: string;
  timestamp: string; // "mm:ss"
  text: string;
}

function formatTimestamp(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

/**
 * Turns Deepgram streaming messages into transcript lines.
 *
 * Line rule: final fragments from one speaker accumulate into a single
 * pending line; the line is committed when Deepgram signals the
 * utterance ended (speech_final / UtteranceEnd) or the speaker changes.
 * Interim results are display-only and never enter the transcript.
 * Pure and synchronous so the behaviour is unit-testable offline.
 */
export class LiveTranscriptAssembler {
  private segments: LiveSegment[] = [];
  private pendingText = "";
  private pendingSpeaker = 0;
  private pendingStart = 0;
  private interimText = "";
  private interimSpeaker = 0;

  constructor(
    private labelFor: (speakerIndex: number) => string = (i) =>
      i === 0 ? "You" : `Speaker ${i + 1}`
  ) {}

  pushMessage(msg: any): void {
    if (!msg || typeof msg !== "object") return;
    if (msg.type === "UtteranceEnd") {
      this.commitPending();
      return;
    }
    if (msg.type !== "Results") return;

    const alt = msg.channel?.alternatives?.[0];
    if (!alt) return;
    const text = (alt.transcript || "").trim();
    const speaker: number =
      typeof alt.words?.[0]?.speaker === "number" ? alt.words[0].speaker : this.pendingSpeaker;

    if (!msg.is_final) {
      this.interimText = text;
      this.interimSpeaker = speaker;
      return;
    }

    this.interimText = "";
    if (!text) {
      if (msg.speech_final) this.commitPending();
      return;
    }
    if (this.pendingText && speaker !== this.pendingSpeaker) {
      this.commitPending();
    }
    if (!this.pendingText) {
      this.pendingStart = typeof msg.start === "number" ? msg.start : 0;
      this.pendingSpeaker = speaker;
    }
    this.pendingText = this.pendingText ? `${this.pendingText} ${text}` : text;
    if (msg.speech_final) {
      this.commitPending();
    }
  }

  private commitPending(): void {
    if (!this.pendingText) return;
    this.segments.push({
      speaker: this.labelFor(this.pendingSpeaker),
      timestamp: formatTimestamp(this.pendingStart),
      text: this.pendingText,
    });
    this.pendingText = "";
  }

  /** Commits any pending line (call when the stream ends). */
  flush(): void {
    this.commitPending();
    this.interimText = "";
  }

  getSegments(): LiveSegment[] {
    return [...this.segments];
  }

  /** Final transcript text, same line format the rest of the app uses. */
  toTranscriptText(): string {
    return this.segments.map((s) => `${s.speaker} [${s.timestamp}]: ${s.text}`).join("\n");
  }

  /** Live view: committed lines plus the in-progress utterance, mirroring the recorder's format. */
  toLiveView(): string {
    const committed = this.toTranscriptText();
    if (!this.interimText) return committed;
    const label = this.labelFor(this.interimSpeaker);
    return committed
      ? `${committed}\n${label} (speaking...): ${this.interimText}`
      : `${label}: ${this.interimText}`;
  }
}

export interface DeepgramLiveCallbacks {
  onLiveText?: (text: string) => void;
  onError?: (reason: string) => void;
}

/**
 * One streaming session: connect with a grant token, feed PCM frames,
 * finish to collect the final transcript. Reports failure exactly once.
 */
export class DeepgramLiveSession {
  private ws: WebSocket | null = null;
  private assembler = new LiveTranscriptAssembler();
  private keepAliveTimer: ReturnType<typeof setInterval> | null = null;
  private failed = false;
  private finished = false;

  constructor(
    private token: string,
    private callbacks: DeepgramLiveCallbacks = {}
  ) {}

  connect(timeoutMs = 8000): Promise<boolean> {
    return new Promise((resolve) => {
      let settled = false;
      const settle = (ok: boolean) => {
        if (!settled) {
          settled = true;
          resolve(ok);
        }
      };
      try {
        // Grant tokens authenticate via the "bearer" subprotocol.
        this.ws = new WebSocket(buildDeepgramStreamUrl(), ["bearer", this.token]);
      } catch {
        this.fail("Live transcription could not start (socket blocked).");
        settle(false);
        return;
      }
      const timer = setTimeout(() => {
        if (!settled) {
          this.fail("Live transcription timed out while connecting.");
          settle(false);
        }
      }, timeoutMs);

      this.ws.onopen = () => {
        clearTimeout(timer);
        this.keepAliveTimer = setInterval(() => {
          if (this.ws?.readyState === WebSocket.OPEN) {
            try {
              this.ws.send(JSON.stringify({ type: "KeepAlive" }));
            } catch {
              // socket is closing; the close handler will report it
            }
          }
        }, 5000);
        settle(true);
      };
      this.ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(typeof event.data === "string" ? event.data : "");
          if (msg?.type === "Error") {
            this.fail("Live transcription reported an error.");
            return;
          }
          this.assembler.pushMessage(msg);
          this.callbacks.onLiveText?.(this.assembler.toLiveView());
        } catch {
          // Non-JSON frame: ignore.
        }
      };
      this.ws.onerror = () => {
        clearTimeout(timer);
        if (!this.finished) {
          this.fail("Live transcription connection error.");
        }
        settle(false);
      };
      this.ws.onclose = () => {
        clearTimeout(timer);
        if (!this.finished && !this.failed) {
          this.fail("Live transcription connection closed early.");
        }
        settle(false);
      };
    });
  }

  sendAudio(frame: ArrayBuffer): void {
    if (this.ws?.readyState === WebSocket.OPEN && !this.failed) {
      try {
        this.ws.send(frame);
      } catch {
        // Dropped frame: the stream continues; a hard failure surfaces via onclose.
      }
    }
  }

  /**
   * Ends the stream gracefully: asks Deepgram to flush its final
   * results, waits briefly for them, and returns the transcript.
   * Returns an empty transcript if the session had already failed.
   */
  async finish(waitMs = 1500): Promise<{ transcriptText: string; segments: LiveSegment[] }> {
    this.finished = true;
    if (this.keepAliveTimer) {
      clearInterval(this.keepAliveTimer);
      this.keepAliveTimer = null;
    }
    if (this.ws && this.ws.readyState === WebSocket.OPEN && !this.failed) {
      await new Promise<void>((resolve) => {
        const timer = setTimeout(resolve, waitMs);
        if (this.ws) {
          this.ws.onclose = () => {
            clearTimeout(timer);
            resolve();
          };
          try {
            this.ws.send(JSON.stringify({ type: "CloseStream" }));
          } catch {
            clearTimeout(timer);
            resolve();
          }
        } else {
          clearTimeout(timer);
          resolve();
        }
      });
    }
    try {
      this.ws?.close();
    } catch {
      // already closed
    }
    this.ws = null;
    this.assembler.flush();
    if (this.failed) {
      return { transcriptText: "", segments: [] };
    }
    return {
      transcriptText: this.assembler.toTranscriptText(),
      segments: this.assembler.getSegments(),
    };
  }

  /** Tears the session down without producing a transcript. */
  abort(): void {
    this.finished = true;
    if (this.keepAliveTimer) {
      clearInterval(this.keepAliveTimer);
      this.keepAliveTimer = null;
    }
    try {
      this.ws?.close();
    } catch {
      // already closed
    }
    this.ws = null;
  }

  private fail(reason: string): void {
    if (this.failed || this.finished) return;
    this.failed = true;
    this.callbacks.onError?.(reason);
  }
}

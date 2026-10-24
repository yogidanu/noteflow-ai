/**
 * Sentence-aware transcript segment merging.
 *
 * Speech recognizers (Chrome Web Speech, Deepgram utterances) cut speech at
 * PAUSES, not at sentence boundaries — a breath mid-sentence produces a new
 * segment. If those raw fragments are stored as transcript lines, the result
 * reads as broken half-sentences ("We need to work on the" / "production of
 * this application.").
 *
 * This pass glues fragments back together: consecutive segments merge when
 * they are from the SAME speaker, close together in time, and the earlier
 * fragment does not end with terminal punctuation (. ? ! …). Real sentence
 * boundaries and speaker changes are never merged.
 */

export interface MergeableSegment {
  speaker: string;
  timestamp: string; // "MM:SS"
  text: string;
  startSec?: number;
  endSec?: number;
}

const TERMINAL_PUNCTUATION = /[.!?…]["')\]]*\s*$/;

export function timestampToSeconds(ts: string): number | null {
  const m = /^(\d+):(\d{2})$/.exec((ts || "").trim());
  return m ? parseInt(m[1], 10) * 60 + parseInt(m[2], 10) : null;
}

export function mergeTranscriptSegments<T extends MergeableSegment>(
  segments: T[],
  maxGapSeconds = 3,
): T[] {
  const out: T[] = [];

  for (const seg of segments) {
    const text = (seg.text || "").trim();
    if (!text) continue;

    const prev = out[out.length - 1];
    if (!prev) {
      out.push({ ...seg, text });
      continue;
    }

    const sameSpeaker = prev.speaker === seg.speaker;

    const prevStart =
      prev.startSec ?? (prev.timestamp ? timestampToSeconds(prev.timestamp) : null);
    const prevEnd = prev.endSec ?? prevStart;
    const nextStart =
      seg.startSec ?? (seg.timestamp ? timestampToSeconds(seg.timestamp) : null);
    const gapKnown = prevEnd != null && nextStart != null;
    const gapOk = !gapKnown || nextStart - prevEnd <= maxGapSeconds;

    const prevEndsSentence = TERMINAL_PUNCTUATION.test(prev.text);

    if (sameSpeaker && gapOk && !prevEndsSentence) {
      prev.text = `${prev.text} ${text}`.replace(/\s+/g, " ").trim();
      if (seg.endSec != null) prev.endSec = seg.endSec;
    } else {
      out.push({ ...seg, text });
    }
  }

  return out;
}

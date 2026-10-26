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
  // Timestamp (seconds) of the most recent fragment folded into each
  // accumulated segment. The gap to the next fragment must be measured
  // from the LAST fragment, not the first — an accumulated segment keeps
  // its first fragment's display timestamp, which would otherwise make
  // every later interval look artificially long.
  const lastFragmentTs: Array<number | null> = [];

  for (const seg of segments) {
    const text = (seg.text || "").trim();
    if (!text) continue;
    const segTs = seg.timestamp ? timestampToSeconds(seg.timestamp) : null;

    const prev = out[out.length - 1];
    if (!prev) {
      out.push({ ...seg, text });
      lastFragmentTs.push(segTs);
      continue;
    }

    const sameSpeaker = prev.speaker === seg.speaker;

    // Gap semantics depend on what the timestamps MEAN:
    // - True start/end seconds (Deepgram): the gap is real silence — the
    //   strict limit applies.
    // - Recorder timestamps only (Web Speech): a segment's timestamp is when
    //   its chunk FINALIZED (≈ its end), so the interval to the next chunk
    //   includes that chunk's own speech. Real recordings showed 4–6s
    //   intervals for ~2s pauses, which the strict limit wrongly rejected —
    //   fragments stayed fragmented. Use a generous finalize allowance.
    // - No timing at all: no gap constraint.
    let gapOk = true;
    if (prev.endSec != null && seg.startSec != null) {
      gapOk = seg.startSec - prev.endSec <= maxGapSeconds;
    } else {
      const prevTs = lastFragmentTs[lastFragmentTs.length - 1];
      if (prevTs != null && segTs != null) {
        gapOk = segTs - prevTs <= 12;
      }
    }

    // Readability cap: even a continuous run-on becomes a new line once the
    // accumulated text is paragraph-sized, instead of one giant blob.
    if (prev.text.split(/\s+/).filter(Boolean).length >= 55) gapOk = false;

    const prevEndsSentence = TERMINAL_PUNCTUATION.test(prev.text);

    if (sameSpeaker && gapOk && !prevEndsSentence) {
      prev.text = `${prev.text} ${text}`.replace(/\s+/g, " ").trim();
      if (seg.endSec != null) prev.endSec = seg.endSec;
      lastFragmentTs[lastFragmentTs.length - 1] = segTs;
    } else {
      out.push({ ...seg, text });
      lastFragmentTs.push(segTs);
    }
  }

  return out;
}

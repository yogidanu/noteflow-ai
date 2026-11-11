/**
 * Decides which transcript source feeds AI synthesis when a recording
 * stops. Extracted from useMeetRecord.stopRecording as a pure helper so
 * the precedence is testable offline.
 *
 * Precedence (Deepgram-first, fixed 2026-10-23; streaming added
 * 2026-11-11):
 *   1. Deepgram LIVE stream transcript — the streaming session that ran
 *      during the recording (Nova-3 + keyterms, diarized, produced from
 *      the actual mic audio in real time). It is the transcript the
 *      speaker watched being written, so it wins when usable.
 *   2. Backend session transcript — returned by apiClient.stopRecording
 *      when the recording session produced one server-side.
 *   3. Deepgram batch transcript — apiClient.transcribeAudio over the
 *      recorded audio blob (server/services/sttService.ts, Nova-3 +
 *      keyterm prompting for domain vocabulary).
 *   4. Browser Web Speech transcript — fallback only. Web Speech has no
 *      custom-vocabulary support and produced endless homophones in live
 *      runs (waitlist → "weightlif"/"weightless", NoteFlow → "note to
 *      a"), so it must never win over a usable Deepgram result. It still
 *      drives the live HUD/interim display during recording; only the
 *      FINAL transcript used for synthesis follows this precedence.
 *
 * A candidate is usable only when it is a non-empty, non-whitespace
 * string. Returns "" when nothing is usable, so the caller can apply
 * its last-resort fallback.
 */
export interface FinalTranscriptCandidates {
  liveStreamTranscript?: string | null;
  sessionTranscript?: string | null;
  deepgramTranscript?: string | null;
  webSpeechTranscript?: string | null;
}

export type FinalTranscriptSource = "deepgram-live" | "session" | "deepgram" | "webspeech" | "none";

/**
 * Same precedence as resolveFinalTranscript, but also reports WHICH
 * source won — so the UI can show it (a silent fallback to Web Speech
 * captions quietly degraded summaries before this was surfaced).
 */
export function resolveFinalTranscriptWithSource(
  candidates: FinalTranscriptCandidates
): { transcript: string; source: FinalTranscriptSource } {
  const ordered: Array<{ value?: string | null; source: FinalTranscriptSource }> = [
    { value: candidates.liveStreamTranscript, source: "deepgram-live" },
    { value: candidates.sessionTranscript, source: "session" },
    { value: candidates.deepgramTranscript, source: "deepgram" },
    { value: candidates.webSpeechTranscript, source: "webspeech" },
  ];
  for (const { value, source } of ordered) {
    if (value && value.trim().length > 0) {
      return { transcript: value, source };
    }
  }
  return { transcript: "", source: "none" };
}

export function resolveFinalTranscript(candidates: FinalTranscriptCandidates): string {
  return resolveFinalTranscriptWithSource(candidates).transcript;
}

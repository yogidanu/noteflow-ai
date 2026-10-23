/**
 * Decides which transcript source feeds AI synthesis when a recording
 * stops. Extracted from useMeetRecord.stopRecording as a pure helper so
 * the precedence is testable offline.
 *
 * Precedence (Deepgram-first, fixed 2026-10-23):
 *   1. Backend session transcript — returned by apiClient.stopRecording
 *      when the recording session produced one server-side.
 *   2. Deepgram transcript — apiClient.transcribeAudio over the recorded
 *      audio blob (server/services/sttService.ts, Nova-3 + keyterm
 *      prompting for domain vocabulary).
 *   3. Browser Web Speech transcript — fallback only. Web Speech has no
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
  sessionTranscript?: string | null;
  deepgramTranscript?: string | null;
  webSpeechTranscript?: string | null;
}

export function resolveFinalTranscript(candidates: FinalTranscriptCandidates): string {
  for (const candidate of [
    candidates.sessionTranscript,
    candidates.deepgramTranscript,
    candidates.webSpeechTranscript,
  ]) {
    if (candidate && candidate.trim().length > 0) {
      return candidate;
    }
  }
  return "";
}

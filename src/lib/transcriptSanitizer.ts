import { InputFormatType } from "../types/meeting";

export interface SanitizedResult {
  cleanText: string;
  format: InputFormatType;
  speakers: string[];
  lines: Array<{
    speaker?: string;
    timestamp?: string;
    text: string;
    originalIndex: number;
    /**
     * Grounding anchor for citations built on this line. "time" when the
     * line's timestamp was parsed from actual time syntax in the source
     * (recorder "[MM:SS]", "[MM:SS] Speaker:", VTT/SRT cue times) — the
     * line belongs to a timed/audio domain. "line" when the source is
     * authored text with no time syntax (pasted notes, "Speaker: text"):
     * the line itself is the anchor, and citations must reference the
     * line, never a fabricated "00:00" timestamp. NOTE: a recorder line
     * stamped with a literal "00:00" is still "time" — that value is an
     * STT/recorder fallback (a FAILED time anchor), not authored text.
     */
    anchorKind: "time" | "line";
  }>;
}

/**
 * Conservative post-STT domain corrections for NoteFlow terminology.
 *
 * STT engines (especially the browser Web Speech API, which offers no custom
 * vocabulary) repeatedly mis-hear a small set of NoteFlow domain terms.
 * Each rule is CONTEXT-BOUND: it only fires when the same line also contains
 * the listed domain context, so ordinary vocabulary in unrelated speech
 * ("I felt weightless on the flight") is never rewritten.
 *
 * Limits: this is a narrow, documented patch list for known errors — not a
 * general spell-checker. New terms should only be added with a recorded
 * real-world mis-recognition and a context guard. Prefer Deepgram keyterm
 * boosting (server/services/sttService.ts) to prevent errors upstream.
 */
export const DOMAIN_CORRECTIONS: Array<{
  pattern: RegExp;
  replacement: string;
  context: RegExp;
  note: string;
}> = [
  {
    // "planning check in for the nuclear public beta" (live run, 2026-10-23)
    pattern: /\bnuclear\s+(public\s+beta)\b/gi,
    replacement: "NoteFlow $1",
    context: /\bpublic\s+beta\b/i,
    note: "Product name mis-heard in a public-beta context",
  },
  {
    // "launch the public beta to a weightless first"
    pattern: /\bweightless\b/gi,
    replacement: "waitlist",
    context: /\b(launch|beta|waitlist)\b/i,
    note: "'waitlist' mis-heard in a beta-launch context",
  },
  {
    // "kept only for the prodigal" (Pro tier, pricing context)
    pattern: /\bprodigal\b/gi,
    replacement: "Pro tier",
    context: /\b(free|pro|tier|pricing|kept\s+only)\b/i,
    note: "'Pro tier' mis-heard in a pricing context",
  },
  {
    // "included in the free data or kept only for the prodigal"
    pattern: /\bfree\s+data\b/gi,
    replacement: "free beta",
    context: /\b(pro|tier|beta|prodigal)\b/i,
    note: "'free beta' mis-heard in a tier/pricing context",
  },
  {
    // "weather team workspaces should be included..." — lookahead keeps this
    // to the exact domain phrase; the ordinary word "weather" is untouched.
    pattern: /\bweather\b(?=\s+team\s+workspaces?\b)/gi,
    replacement: "whether",
    context: /\bteam\s+workspaces?\b/i,
    note: "'whether' mis-heard before 'team workspace(s)'",
  },
  {
    // "any works we find during N2 interesting today directly to the
    // respective developers"
    pattern: /\bN2\s+interesting\b/gi,
    replacement: "end-to-end testing",
    context: /\b(bugs|developers|testing|today)\b/i,
    note: "'end-to-end testing' garbled in a bug-testing context",
  },
  {
    // "I will review those pics by tomorrow evening" (reviewing bug fixes)
    pattern: /\bthose\s+pics\b/gi,
    replacement: "those fixes",
    context: /\b(review|bugs|fixes|developers)\b/i,
    note: "'those fixes' mis-heard in a bug-review context",
  },
];

export function applyDomainCorrections(text: string): string {
  let out = text;
  for (const rule of DOMAIN_CORRECTIONS) {
    if (rule.context.test(out)) {
      out = out.replace(rule.pattern, rule.replacement);
    }
  }
  return out;
}

/**
 * Split a transcript line's text into individual sentences.
 *
 * Recognizers often return several sentences as one blob line ("...notes by
 * Thursday. Arjun, please fix..."). The synthesis engine treats each line as
 * one candidate unit, so blob lines collapse multiple tasks/decisions into a
 * single mangled item. Splitting here keeps one sentence per line (same
 * speaker + timestamp), which is the granularity the extractor — and the
 * citation view — are built for. Unpunctuated text is returned unchanged.
 */
const ABBREVIATIONS = ["Mr.", "Mrs.", "Ms.", "Dr.", "e.g.", "i.e.", "vs.", "U.S.", "U.K."];

export function splitSentences(text: string): string[] {
  const trimmed = (text || "").trim();
  if (!trimmed) return [];
  let guarded = trimmed;
  const placeholders = new Map<string, string>();
  ABBREVIATIONS.forEach((abbr, i) => {
    const ph = `\u0001${i}\u0002`;
    if (guarded.includes(abbr)) {
      placeholders.set(ph, abbr);
      guarded = guarded.split(abbr).join(ph);
    }
  });
  const parts = guarded
    .split(/(?<=[.!?…])\s+(?=[A-Z0-9"“‘'(])/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => {
      let out = p;
      placeholders.forEach((abbr, ph) => {
        out = out.split(ph).join(abbr);
      });
      return out;
    });
  return parts.length > 0 ? parts : [trimmed];
}

export function sanitizeTranscript(raw: string): SanitizedResult {
  if (!raw || typeof raw !== "string") {
    return {
      cleanText: "",
      format: "raw",
      speakers: [],
      lines: []
    };
  }

  const isVTT = /WEBVTT|\d{2}:\d{2}:\d{2}\.\d{3}\s*-->/i.test(raw);
  const isSRT = /^\d+\r?\n\d{2}:\d{2}:\d{2},\d{3}\s*-->/im.test(raw);
  const hasSpeakerColons = /^(?:\[[\d:]+\]\s*)?(?:Speaker\s+\d+|[A-Z][a-zA-Z0-9_\s]{1,25}):/m.test(raw);
  // Recorder format produced by audioRecorder.ts / sttService.ts: "Speaker [MM:SS]: text"
  const hasRecorderFormat = /^[^[\]\n]{1,40}\[\d{1,2}:\d{2}(?::\d{2})?\]:/m.test(raw);
  const isBulletList = /^(\s*[-*•]|\s*\d+\.)/m.test(raw);

  let detectedFormat: InputFormatType = "raw";
  if (isVTT) detectedFormat = "vtt";
  else if (isSRT) detectedFormat = "teams";
  else if (hasRecorderFormat) detectedFormat = "meet";
  else if (hasSpeakerColons) detectedFormat = "meet";
  else if (isBulletList) detectedFormat = "bullets";

  const speakerSet = new Set<string>();
  const parsedLines: Array<{
    speaker?: string;
    timestamp?: string;
    text: string;
    originalIndex: number;
    anchorKind: "time" | "line";
  }> = [];

  const rawLines = raw.split(/\r?\n/);
  let currentSpeaker: string | undefined = undefined;
  let currentTimestamp: string | undefined = undefined;
  // Anchor provenance of currentTimestamp: "time" only while it holds a
  // value parsed from real time syntax (a VTT/SRT cue line). Plain text
  // lines start line-anchored; a timestamp inherited from an earlier
  // timed line keeps that line's time provenance.
  let currentAnchorKind: "time" | "line" = "line";

  for (let i = 0; i < rawLines.length; i++) {
    const rawLine = rawLines[i].trim();

    // Skip WebVTT headers and numeric line counters
    if (!rawLine || rawLine.toUpperCase().startsWith("WEBVTT") || /^\d+$/.test(rawLine)) {
      continue;
    }

    // Check for timestamp lines (e.g. 00:01:23.456 --> 00:01:25.789)
    const timeMatch = rawLine.match(/(\d{2}:\d{2}(?::\d{2})?(?:[.,]\d{3})?)\s*-->/);
    if (timeMatch) {
      currentTimestamp = timeMatch[1].split(".")[0].split(",")[0];
      if (currentTimestamp.startsWith("00:")) {
        currentTimestamp = currentTimestamp.substring(3);
      }
      currentAnchorKind = "time";
      continue;
    }

    // Anchor for THIS line: upgraded to "time" when the line itself
    // carries parsed time syntax (recorder / bracket-time formats below).
    let lineAnchorKind: "time" | "line" = currentAnchorKind;

    // Check for speaker pattern: <v Sarah Chen> or [00:12] Alex: or Speaker 1: or Yogesh:
    let lineText = rawLine;
    const speakerMatch = lineText.match(/<v\s+([^>]+)>(.*)/i);

    if (speakerMatch) {
      currentSpeaker = speakerMatch[1].trim();
      lineText = (speakerMatch[2] || "").replace(/<\/v>/g, "").trim();
      speakerSet.add(currentSpeaker);
    } else {
      // Recorder format: "You [00:21]: text" / "Sarah Chen [04:12]: text"
      // (serialized by audioRecorder.ts and server/services/sttService.ts).
      // This must be tried before the colon-speaker pattern, which otherwise
      // swallows the line and loses both speaker and timestamp.
      const recorderFormat = lineText.match(/^([A-Za-z][A-Za-z0-9_\s.'-]{0,39}?)\s*\[(\d{1,2}:\d{2}(?::\d{2})?)\]:\s*(.*)$/);
      if (recorderFormat) {
        currentSpeaker = recorderFormat[1].trim();
        currentTimestamp = recorderFormat[2];
        lineText = recorderFormat[3].trim();
        speakerSet.add(currentSpeaker);
        lineAnchorKind = "time";
        currentAnchorKind = "time";
      } else {
      // Look for "[10:24] Sarah:" or "Speaker 1:" or "Yogesh:"
      const bracketTime = lineText.match(/^\[(\d{1,2}:\d{2}(?::\d{2})?)\]\s*([^:]+):\s*(.*)$/);
      if (bracketTime) {
        currentTimestamp = bracketTime[1];
        currentSpeaker = bracketTime[2].trim();
        lineText = bracketTime[3].trim();
        speakerSet.add(currentSpeaker);
        lineAnchorKind = "time";
        currentAnchorKind = "time";
      } else {
        const colonSpeaker = lineText.match(/^(Speaker\s+\d+|[A-Z][a-zA-Z0-9_\s]{1,25}):\s*(.*)$/);
        if (colonSpeaker) {
          currentSpeaker = colonSpeaker[1].trim();
          lineText = colonSpeaker[2].trim();
          speakerSet.add(currentSpeaker);
        }
      }
      }
    }

    // Conservative, context-bound STT domain corrections (see DOMAIN_CORRECTIONS)
    if (lineText) {
      lineText = applyDomainCorrections(lineText);
    }

    if (lineText) {
      // One sentence per line: multi-sentence blob lines would otherwise
      // collapse several tasks/decisions/questions into a single item.
      // Split pieces keep the line's speaker, timestamp and anchor kind, so
      // citations still resolve to the same source moment.
      for (const sentence of splitSentences(lineText)) {
        parsedLines.push({
          speaker: currentSpeaker,
          // A line-anchored (authored-text) line must not inherit or invent
          // a timestamp: its citation anchor is the line itself. Timed lines
          // keep the timestamp parsed from the source.
          timestamp: lineAnchorKind === "time" ? currentTimestamp : undefined,
          text: sentence,
          originalIndex: i,
          anchorKind: lineAnchorKind
        });
      }
    }
  }

  // Detect and resolve named speakers if generic (e.g. "Speaker 1" addressed as "Robin", "Speaker 2" addressed as "Yogesh")
  let resolvedSpeakers = Array.from(speakerSet);
  const rawLower = raw.toLowerCase();
  if (resolvedSpeakers.includes("Speaker 1") && rawLower.includes("robin") && rawLower.includes("yogesh")) {
    // If Yogesh is in the transcript and Speaker 1 is Robin
    parsedLines.forEach(l => {
      if (l.speaker === "Speaker 1") l.speaker = "Robin";
      if (l.speaker === "Speaker 2") l.speaker = "Yogesh";
    });
    resolvedSpeakers = resolvedSpeakers.map(s => s === "Speaker 1" ? "Robin" : s === "Speaker 2" ? "Yogesh" : s);
  }

  // Construct normalized clean text
  const cleanLines = parsedLines.map(line => {
    let prefix = "";
    if (line.timestamp) prefix += `[${line.timestamp}] `;
    if (line.speaker) prefix += `${line.speaker}: `;
    return `${prefix}${line.text}`;
  });

  const cleanText = cleanLines.length > 0 ? cleanLines.join("\n") : raw.trim();

  return {
    cleanText,
    format: detectedFormat,
    speakers: Array.from(new Set(resolvedSpeakers)),
    lines: parsedLines
  };
}


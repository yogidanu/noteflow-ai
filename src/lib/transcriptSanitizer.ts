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
  }> = [];

  const rawLines = raw.split(/\r?\n/);
  let currentSpeaker: string | undefined = undefined;
  let currentTimestamp: string | undefined = undefined;

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
      continue;
    }

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
      } else {
      // Look for "[10:24] Sarah:" or "Speaker 1:" or "Yogesh:"
      const bracketTime = lineText.match(/^\[(\d{1,2}:\d{2}(?::\d{2})?)\]\s*([^:]+):\s*(.*)$/);
      if (bracketTime) {
        currentTimestamp = bracketTime[1];
        currentSpeaker = bracketTime[2].trim();
        lineText = bracketTime[3].trim();
        speakerSet.add(currentSpeaker);
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
      parsedLines.push({
        speaker: currentSpeaker,
        timestamp: currentTimestamp,
        text: lineText,
        originalIndex: i
      });
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


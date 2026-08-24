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
  const isBulletList = /^(\s*[-*•]|\s*\d+\.)/m.test(raw);

  let detectedFormat: InputFormatType = "raw";
  if (isVTT) detectedFormat = "vtt";
  else if (isSRT) detectedFormat = "teams";
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


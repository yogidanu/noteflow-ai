import React from "react";
import { MeetingNote } from "../../../types/meeting";
import { safeMeetingUrl } from "../../../lib/meetingUrl";
import { Calendar, Users, ExternalLink, Clock, Layers } from "lucide-react";

interface MeetingHeaderBannerProps {
  meeting: MeetingNote;
  onToggleSourceDrawer: () => void;
  isSourceDrawerOpen: boolean;
}

export const MeetingHeaderBanner: React.FC<MeetingHeaderBannerProps> = ({
  meeting,
  onToggleSourceDrawer,
  isSourceDrawerOpen,
}) => {
  const speakers = meeting.analysis?.detectedSpeakers || [];
  const wordCount = meeting.analysis?.wordCount || (meeting.rawInput ? meeting.rawInput.trim().split(/\s+/).length : 0);
  const durationMin = meeting.analysis?.estimatedMeetingDurationMinutes || Math.max(1, Math.round(wordCount / 130));

  const formattedDate = new Date(meeting.createdAt).toLocaleDateString([], {
    weekday: "long",
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  const formattedTime = new Date(meeting.createdAt).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--surface-card)] p-6 space-y-4 shadow-xs transition-colors duration-150">
      {/* Top Tag & Platform */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-[var(--surface-subtle)] border border-[var(--border-default)] text-[var(--text-secondary)] font-mono">
            Human Meeting Context
          </span>
          {meeting.platform === "google_meet" && (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[var(--color-success)] bg-[var(--success-surface)] px-2.5 py-0.5 rounded-full border border-[var(--success-border)]">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-recording-pulse)]"></span>
              Google Meet
            </span>
          )}
          {/* Transcript provenance: which source produced the text this
              summary was built from. A Web Speech fallback is basic
              (no punctuation/diarization), so it is shown in warning
              colours with the reason — never silently. */}
          {meeting.transcriptSource === "deepgram" && (
            <span
              className="inline-flex items-center gap-1 text-[11px] font-medium text-[var(--color-success)] bg-[var(--success-surface)] px-2.5 py-0.5 rounded-full border border-[var(--success-border)]"
              title="Transcribed by Deepgram from the recorded audio"
            >
              Deepgram transcript
            </span>
          )}
          {meeting.transcriptSource === "session" && (
            <span
              className="inline-flex items-center gap-1 text-[11px] font-medium text-[var(--color-success)] bg-[var(--success-surface)] px-2.5 py-0.5 rounded-full border border-[var(--success-border)]"
              title="Transcript produced by the backend recording session"
            >
              Session transcript
            </span>
          )}
          {meeting.transcriptSource === "webspeech" && (
            <span
              className="inline-flex items-center gap-1 text-[11px] font-medium text-[var(--color-warning)] bg-[var(--warning-surface)] px-2.5 py-0.5 rounded-full border border-[var(--warning-border)]"
              title={meeting.transcriptNote || "Live browser captions were used for this summary"}
            >
              Live captions (basic)
            </span>
          )}
          {meeting.transcriptSource === "fallback" && (
            <span
              className="inline-flex items-center gap-1 text-[11px] font-medium text-[var(--color-warning)] bg-[var(--warning-surface)] px-2.5 py-0.5 rounded-full border border-[var(--warning-border)]"
              title={meeting.transcriptNote || "No usable transcript could be produced"}
            >
              No transcript captured
            </span>
          )}
        </div>

        {/* View Full Transcript Direct CTA */}
        <button
          onClick={onToggleSourceDrawer}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] outline-none ${
            isSourceDrawerOpen
              ? "bg-[var(--primary-surface)] border-[var(--primary-border)] text-[var(--primary-action)] font-semibold"
              : "bg-[var(--surface-card)] hover:bg-[var(--surface-subtle)] border-[var(--border-default)] text-[var(--text-secondary)] shadow-2xs"
          }`}
          title="Inspect raw transcript with grounded timestamps"
        >
          <Layers className="w-3.5 h-3.5 text-[var(--primary-action)]" />
          <span>{isSourceDrawerOpen ? "Hide Transcript Drawer" : "View Source Transcript"}</span>
          <span className="font-mono text-[10px] text-[var(--text-muted)] font-normal">({wordCount} words)</span>
        </button>
      </div>

      {/* Fallback reason, shown in plain sight (not buried in a tooltip)
          so a degraded transcript is impossible to miss. */}
      {(meeting.transcriptSource === "webspeech" || meeting.transcriptSource === "fallback") &&
        meeting.transcriptNote && (
          <p className="text-[11px] leading-relaxed text-[var(--color-warning)] bg-[var(--warning-surface)] border border-[var(--warning-border)] rounded-lg px-3 py-2">
            {meeting.transcriptNote}
          </p>
        )}

      {/* Main Title */}
      <div>
        <h1 className="text-xl font-bold text-[var(--text-primary)] tracking-tight">
          {meeting.title || "Untitled Meeting"}
        </h1>
      </div>

      {/* Metadata Strip: Date, Duration, Speakers */}
      <div className="flex flex-wrap items-center gap-y-2 gap-x-4 text-xs text-[var(--text-muted)] pt-1 border-t border-[var(--border-subtle)]">
        <div className="flex items-center gap-1.5">
          <Calendar className="w-3.5 h-3.5 text-[var(--text-subtle)]" />
          <span className="font-medium text-[var(--text-secondary)]">{formattedDate}</span>
          <span className="text-[var(--text-muted)]">at {formattedTime}</span>
        </div>

        <span className="text-[var(--text-subtle)] hidden sm:inline">•</span>

        <div className="flex items-center gap-1.5 font-mono text-[11px] text-[var(--text-muted)]">
          <Clock className="w-3.5 h-3.5 text-[var(--text-subtle)]" />
          <span>~{durationMin} min duration</span>
        </div>

        {safeMeetingUrl(meeting.meetingUrl) && (
          <>
            <span className="text-[var(--text-subtle)] hidden sm:inline">•</span>
            <a
              href={safeMeetingUrl(meeting.meetingUrl) ?? undefined}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-[var(--primary-action)] hover:underline font-medium transition-colors focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] outline-none rounded"
            >
              <span>Meet Link</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </>
        )}
      </div>

      {/* Participants & Detected Speakers Pills */}
      {speakers.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <span className="text-[11px] font-semibold text-[var(--text-muted)] flex items-center gap-1">
            <Users className="w-3.5 h-3.5 text-[var(--text-subtle)]" />
            <span>Participants ({speakers.length}):</span>
          </span>

          <div className="flex flex-wrap items-center gap-1.5">
            {speakers.map((speaker, idx) => {
              const initials = speaker
                .split(" ")
                .map((n) => n[0])
                .join("")
                .substring(0, 2)
                .toUpperCase();

              return (
                <span
                  key={idx}
                  className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[var(--surface-subtle)] border border-[var(--border-default)] text-[var(--text-primary)] text-xs font-medium"
                >
                  <span className="w-4 h-4 rounded-full bg-[var(--primary-surface)] text-[var(--primary-action)] font-bold text-[9px] flex items-center justify-center">
                    {initials}
                  </span>
                  <span>{speaker}</span>
                </span>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

import React from "react";
import {
  Square,
  Pause,
  Play,
  Volume2,
  ExternalLink,
  Mic,
  Radio,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Clock,
  Users,
} from "lucide-react";
import {
  DetectedMeeting,
  RecordingLifecycleState,
} from "../../../types/meeting";

interface ActiveRecordingBannerProps {
  meeting: DetectedMeeting;
  recordingState: RecordingLifecycleState;
  seconds: number;
  isPaused: boolean;
  audioPowerLevel: number;
  onTogglePause: () => void;
  onStopAndSynthesize: () => void;
}

export const ActiveRecordingBanner: React.FC<ActiveRecordingBannerProps> = ({
  meeting,
  recordingState,
  seconds,
  isPaused,
  audioPowerLevel,
  onTogglePause,
  onStopAndSynthesize,
}) => {
  const formatTime = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const getPlatformLabel = () => {
    if (meeting.platform === "google_meet") return "Google Meet";
    if (meeting.platform === "zoom") return "Zoom";
    if (meeting.platform === "teams") return "Microsoft Teams";
    return "Web Audio Ingress";
  };

  // 1. PROCESSING STATE
  if (recordingState === "PROCESSING" || recordingState === "STOPPING") {
    return (
      <div className="p-6 sm:p-8 rounded-3xl bg-[var(--surface-card)] border-2 border-indigo-500/30 shadow-xl space-y-6 text-center animate-in fade-in duration-200">
        <div className="relative w-16 h-16 mx-auto flex items-center justify-center">
          <div className="absolute inset-0 rounded-2xl bg-indigo-500/20 animate-ping opacity-60" />
          <div className="relative w-14 h-14 rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-600 flex items-center justify-center text-white shadow-lg">
            <Sparkles className="w-7 h-7 animate-pulse" />
          </div>
        </div>

        <div className="space-y-2 max-w-md mx-auto">
          <h3 className="text-xl font-bold text-[var(--text-primary)] tracking-tight">
            Synthesizing Meeting Intelligence...
          </h3>
          <p className="text-xs sm:text-sm text-[var(--text-secondary)]">
            Transcribing audio stream for <span className="font-semibold text-[var(--text-primary)]">"{meeting.title}"</span> and generating grounded decisions & action items.
          </p>
        </div>

        {/* 3-Step Verification Pipeline */}
        <div className="max-w-md mx-auto text-left grid grid-cols-1 gap-2.5 p-4 rounded-2xl bg-[var(--surface-subtle)] border border-[var(--border-default)]">
          <div className="flex items-center gap-3 text-xs">
            <div className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-3.5 h-3.5" />
            </div>
            <div className="flex-1 min-w-0">
              <span className="font-medium text-[var(--text-primary)]">Audio Capture Persisted</span>
              <span className="text-[11px] text-[var(--text-muted)] block">Captured {seconds > 0 ? `${seconds}s of audio` : "live speech buffer"}</span>
            </div>
            <span className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 font-semibold uppercase">Done</span>
          </div>

          <div className="flex items-center gap-3 text-xs">
            <div className="w-5 h-5 rounded-full bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 animate-pulse">
              <Sparkles className="w-3.5 h-3.5" />
            </div>
            <div className="flex-1 min-w-0">
              <span className="font-medium text-[var(--text-primary)]">Speech Diarization & STT</span>
              <span className="text-[11px] text-[var(--text-muted)] block">Transcribing speaker turns</span>
            </div>
            <span className="text-[10px] font-mono text-indigo-600 dark:text-indigo-400 font-semibold uppercase animate-pulse">Active</span>
          </div>

          <div className="flex items-center gap-3 text-xs">
            <div className="w-5 h-5 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-400 flex items-center justify-center shrink-0">
              <Clock className="w-3.5 h-3.5" />
            </div>
            <div className="flex-1 min-w-0">
              <span className="font-medium text-[var(--text-secondary)]">Decision & Task Synthesis</span>
              <span className="text-[11px] text-[var(--text-muted)] block">Multi-perspective grounded summary</span>
            </div>
            <span className="text-[10px] font-mono text-[var(--text-muted)] uppercase">Queued</span>
          </div>
        </div>

        <div className="max-w-xs mx-auto space-y-2">
          <div className="h-1.5 w-full bg-[var(--surface-subtle)] rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-indigo-500 to-teal-400 rounded-full animate-pulse w-3/4 transition-all duration-300" />
          </div>
          <span className="text-[11px] font-mono text-[var(--text-muted)]">Zero-Mock Real Audio Pipeline Active</span>
        </div>
      </div>
    );
  }

  // 2. COMPLETED STATE
  if (recordingState === "COMPLETED") {
    return (
      <div className="p-6 rounded-3xl bg-emerald-500/10 border border-emerald-500/30 text-center space-y-3 animate-in fade-in duration-150">
        <div className="w-12 h-12 rounded-2xl bg-emerald-500 text-white mx-auto flex items-center justify-center shadow-md">
          <CheckCircle2 className="w-6 h-6" />
        </div>
        <h3 className="text-lg font-bold text-emerald-600 dark:text-emerald-400">Meeting recorded</h3>
        <p className="text-xs text-[var(--text-secondary)]">Opening structured meeting notes...</p>
      </div>
    );
  }

  // 3. ERROR STATE
  if (recordingState === "ERROR") {
    return (
      <div className="p-6 rounded-3xl bg-[var(--error-surface)] border border-[var(--error-border)] space-y-3">
        <div className="flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-[var(--color-error)] shrink-0" />
          <div>
            <h4 className="text-sm font-bold text-[var(--color-error)]">Audio Recording Error</h4>
            <p className="text-xs text-[var(--text-secondary)]">
              Unable to capture microphone audio. Check browser permissions and try again.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // 4. ACTIVE RECORDING / PAUSED STATE
  return (
    <div
      className={`p-5 sm:p-7 rounded-3xl bg-[var(--surface-card)] border-2 transition-all duration-200 shadow-xl space-y-5 ${
        isPaused
          ? "border-amber-500/40 ring-2 ring-amber-500/10"
          : "border-[var(--color-recording-pulse)] ring-2 ring-[var(--color-recording-pulse)]/15"
      }`}
    >
      {/* Header Info */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1.5 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            {/* Pulsing Recording State Indicator */}
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold tracking-wider uppercase font-mono ${
                isPaused
                  ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                  : "bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20"
              }`}
            >
              <span className="relative flex h-2 w-2">
                <span
                  className={`animate-ping absolute inline-flex h-full w-full rounded-full ${
                    isPaused ? "bg-amber-400" : "bg-red-400"
                  } opacity-75`}
                />
                <span
                  className={`relative inline-flex rounded-full h-2 w-2 ${
                    isPaused ? "bg-amber-500" : "bg-red-500"
                  }`}
                />
              </span>
              <span>{isPaused ? "RECORDING PAUSED" : "RECORDING LIVE"}</span>
            </span>

            {/* Platform Badge */}
            <span className="text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-[var(--surface-subtle)] text-[var(--text-secondary)] border border-[var(--border-default)]">
              {getPlatformLabel()}
            </span>

            {/* Microphone Status */}
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
              <Mic className="w-3 h-3" />
              <span>Microphone Active</span>
            </span>
          </div>

          <h2 className="text-lg sm:text-2xl font-bold text-[var(--text-primary)] tracking-tight truncate">
            {meeting.title || "Live Meeting"}
          </h2>

          <div className="flex flex-wrap items-center gap-3 text-xs text-[var(--text-secondary)]">
            <span className="flex items-center gap-1">
              <Users className="w-3.5 h-3.5 text-[var(--text-subtle)]" />
              <span>{meeting.organizerName || "You"}</span>
            </span>
            <span>•</span>
            <span>{meeting.attendees?.length || 1} participant{meeting.attendees?.length === 1 ? "" : "s"}</span>
          </div>
        </div>

        {/* Large Monospace Elapsed Timer */}
        <div className="flex items-center sm:flex-col sm:items-end justify-between gap-1 shrink-0">
          <div className="text-3xl sm:text-4xl font-mono font-extrabold text-[var(--text-primary)] tracking-tight">
            {formatTime(seconds)}
          </div>
          <span className="text-[11px] text-[var(--text-muted)] font-mono uppercase tracking-wider">
            Elapsed Time
          </span>
        </div>
      </div>

      {/* Audio Waveform Equalizer */}
      <div className="p-3.5 rounded-2xl bg-[var(--surface-subtle)] border border-[var(--border-default)] space-y-2">
        <div className="flex items-center justify-between text-xs text-[var(--text-secondary)] font-mono">
          <span className="flex items-center gap-1.5">
            <Radio className={`w-3.5 h-3.5 ${isPaused ? "text-slate-400" : "text-emerald-500 animate-pulse"}`} />
            <span className="font-semibold text-[var(--text-primary)]">Audio Telemetry</span>
          </span>
          <span className={isPaused ? "text-amber-500 font-medium" : "text-emerald-500 font-semibold"}>
            {isPaused ? "VAD Paused" : `${audioPowerLevel}% Speech Power`}
          </span>
        </div>

        {/* Equalizer Bars */}
        <div className="h-6 rounded-xl bg-[var(--surface-card)] border border-[var(--border-default)] px-3 flex items-center justify-between gap-1 overflow-hidden">
          {Array.from({ length: 32 }).map((_, idx) => {
            const height = isPaused
              ? 15
              : Math.min(
                  100,
                  Math.max(20, Math.floor(Math.sin((idx + seconds * 3) * 0.7) * 45 + audioPowerLevel * 0.7))
                );
            return (
              <div
                key={idx}
                className={`w-1.5 rounded-full transition-all duration-150 ${
                  isPaused
                    ? "bg-slate-300 dark:bg-slate-700"
                    : idx % 4 === 0
                    ? "bg-[var(--color-recording-pulse)]"
                    : idx % 2 === 0
                    ? "bg-indigo-500"
                    : "bg-teal-400"
                }`}
                style={{ height: `${height}%` }}
              />
            );
          })}
        </div>
      </div>

      {/* Action Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
        <div className="flex items-center gap-2">
          {meeting.meetingUrl && (
            <a
              href={meeting.meetingUrl}
              target="_blank"
              rel="noreferrer"
              className="h-10 px-4 rounded-xl bg-[var(--surface-subtle)] hover:bg-[var(--surface-card)] border border-[var(--border-default)] text-xs font-semibold text-[var(--text-primary)] flex items-center gap-2 transition-all cursor-pointer"
            >
              <ExternalLink className="w-3.5 h-3.5 text-[var(--primary-action)]" />
              <span>Open {getPlatformLabel()} Call</span>
            </a>
          )}
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          {/* Pause / Resume Button */}
          <button
            onClick={onTogglePause}
            className="flex-1 sm:flex-initial h-10 px-4 rounded-xl bg-[var(--surface-card)] hover:bg-[var(--surface-subtle)] border border-[var(--border-default)] text-xs font-semibold text-[var(--text-primary)] flex items-center justify-center gap-2 transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] outline-none"
          >
            {isPaused ? <Play className="w-4 h-4 text-emerald-500 fill-current" /> : <Pause className="w-4 h-4 text-amber-500" />}
            <span>{isPaused ? "Resume Recording" : "Pause Recording"}</span>
          </button>

          {/* Stop Recording Button */}
          <button
            onClick={onStopAndSynthesize}
            className="flex-1 sm:flex-initial h-10 px-5 rounded-xl bg-[var(--color-error)] hover:opacity-90 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] outline-none"
          >
            <Square className="w-3.5 h-3.5 fill-current" />
            <span>Stop Recording</span>
          </button>
        </div>
      </div>
    </div>
  );
};

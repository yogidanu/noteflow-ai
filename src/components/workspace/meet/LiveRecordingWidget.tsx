import React, { useState } from "react";
import { Square, Pause, Play, Volume2, Maximize2, Minimize2, ExternalLink } from "lucide-react";
import { DetectedMeeting } from "../../../types/meeting";
import { safeMeetingUrl } from "../../../lib/meetingUrl";

interface LiveRecordingWidgetProps {
  meeting: DetectedMeeting;
  seconds: number;
  isPaused: boolean;
  audioPowerLevel: number;
  onTogglePause: () => void;
  onStopAndSynthesize: () => void;
}

export const LiveRecordingWidget: React.FC<LiveRecordingWidgetProps> = ({
  meeting,
  seconds,
  isPaused,
  audioPowerLevel,
  onTogglePause,
  onStopAndSynthesize,
}) => {
  const [isCompact, setIsCompact] = useState(false);

  const formatTime = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  // Compact Mini-Pill Indicator View
  if (isCompact) {
    return (
      <div className="fixed bottom-6 right-6 z-40 animate-in fade-in zoom-in-95 duration-150">
        <div className="px-3.5 py-2 rounded-full bg-[var(--surface-elevated)] backdrop-blur-md border border-[var(--border-default)] shadow-xl text-[var(--text-primary)] flex items-center gap-3">
          <span className="relative flex h-2.5 w-2.5">
            <span
              className={`animate-ping absolute inline-flex h-full w-full rounded-full ${
                isPaused ? "bg-amber-400" : "bg-emerald-400"
              } opacity-75`}
            />
            <span
              className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
                isPaused ? "bg-amber-500" : "bg-[var(--color-recording-pulse)]"
              }`}
            />
          </span>

          <span className="text-xs font-mono font-bold text-[var(--text-primary)] tracking-wider">
            {formatTime(seconds)}
          </span>

          <span className="text-[11px] font-medium text-[var(--text-muted)] truncate max-w-[120px]">
            {meeting.title}
          </span>

          <div className="flex items-center gap-1 pl-1 border-l border-[var(--border-default)]">
            <button
              onClick={onTogglePause}
              aria-label={isPaused ? "Resume Recording" : "Pause Recording"}
              className="p-1 rounded-full hover:bg-[var(--surface-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] outline-none transition-colors cursor-pointer"
              title={isPaused ? "Resume Recording" : "Pause Recording"}
            >
              {isPaused ? <Play className="w-3 h-3 text-[var(--color-success)]" /> : <Pause className="w-3 h-3 text-amber-500" />}
            </button>

            <button
              onClick={onStopAndSynthesize}
              aria-label="Stop Recording"
              className="p-1 rounded-full hover:bg-[var(--error-surface)] text-[var(--color-error)] focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] outline-none transition-colors cursor-pointer"
              title="Stop Recording & Synthesize"
            >
              <Square className="w-3 h-3 fill-current" />
            </button>

            <button
              onClick={() => setIsCompact(false)}
              aria-label="Expand Widget"
              className="p-1 rounded-full hover:bg-[var(--surface-subtle)] text-[var(--text-muted)] hover:text-[var(--text-primary)] focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] outline-none transition-colors cursor-pointer"
              title="Expand recording panel"
            >
              <Maximize2 className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Expanded Desktop Recording Panel
  return (
    <div className="fixed bottom-6 right-6 z-40 max-w-md w-[calc(100vw-3rem)] sm:w-[380px] animate-in slide-in-from-bottom-5 duration-150">
      <div className="p-4 rounded-2xl bg-[var(--surface-elevated)] backdrop-blur-md border border-[var(--border-default)] shadow-xl text-[var(--text-primary)] space-y-3">
        {/* Top Status, Title & Minimize Toggle */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="relative flex h-2.5 w-2.5 shrink-0 mt-0.5">
              <span
                className={`animate-ping absolute inline-flex h-full w-full rounded-full ${
                  isPaused ? "bg-amber-400" : "bg-emerald-400"
                } opacity-75`}
              />
              <span
                className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
                  isPaused ? "bg-amber-500" : "bg-[var(--color-recording-pulse)]"
                }`}
              />
            </span>

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span
                  className={`text-[10px] font-mono font-bold tracking-wider uppercase ${
                    isPaused ? "text-amber-600 dark:text-amber-400" : "text-[var(--color-success)]"
                  }`}
                >
                  {isPaused ? "Ingress Paused" : "Active Ingress"}
                </span>
                <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded-md bg-[var(--surface-subtle)] text-[var(--text-primary)] border border-[var(--border-default)]">
                  {formatTime(seconds)}
                </span>
              </div>
              <h4 className="text-xs font-semibold text-[var(--text-primary)] truncate max-w-[200px] mt-0.5" title={meeting.title}>
                {meeting.title}
              </h4>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {safeMeetingUrl(meeting.meetingUrl) && (
              <a
                href={safeMeetingUrl(meeting.meetingUrl) ?? undefined}
                target="_blank"
                rel="noreferrer"
                aria-label="Open Google Meet link"
                className="p-1 rounded-lg text-[var(--text-muted)] hover:text-[var(--primary-action)] hover:bg-[var(--surface-subtle)] focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] outline-none transition-colors"
                title="Open Google Meet"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
            <button
              onClick={() => setIsCompact(true)}
              aria-label="Minimize to compact pill"
              className="p-1 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-subtle)] focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] outline-none transition-colors cursor-pointer"
              title="Minimize to compact pill"
            >
              <Minimize2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Live Audio VAD Visualizer Bar */}
        <div className="space-y-1 bg-[var(--surface-subtle)] border border-[var(--border-default)] rounded-xl p-2.5">
          <div className="flex items-center justify-between text-[10px] text-[var(--text-muted)] font-mono">
            <span className="flex items-center gap-1 font-medium">
              <Volume2 className={`w-3 h-3 ${isPaused ? "text-[var(--text-muted)]" : "text-[var(--color-success)]"}`} />
              <span>Voice Activity (VAD)</span>
            </span>
            <span className={isPaused ? "text-amber-600 dark:text-amber-400 font-medium" : audioPowerLevel > 40 ? "text-[var(--color-success)] font-semibold" : "text-[var(--text-subtle)]"}>
              {isPaused ? "MUTED" : `${audioPowerLevel}% Level`}
            </span>
          </div>

          {/* Equalizer Bars Simulation */}
          <div className="h-4 rounded-lg bg-[var(--surface-card)] border border-[var(--border-default)] px-2 flex items-center justify-between gap-1 overflow-hidden">
            {Array.from({ length: 24 }).map((_, idx) => {
              const barHeight = isPaused
                ? 15
                : Math.min(
                    100,
                    Math.max(20, Math.floor(Math.sin((idx + seconds * 2) * 0.8) * 40 + audioPowerLevel * 0.7))
                  );
              return (
                <div
                  key={idx}
                  className={`w-1 rounded-full transition-all duration-150 ${
                    isPaused
                      ? "bg-slate-300 dark:bg-slate-700"
                      : idx % 3 === 0
                      ? "bg-[var(--color-success)]"
                      : idx % 2 === 0
                      ? "bg-[var(--primary-action)]"
                      : "bg-teal-500"
                  }`}
                  style={{ height: `${barHeight}%` }}
                />
              );
            })}
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center justify-between gap-2 pt-0.5">
          <button
            onClick={onTogglePause}
            className="flex-1 h-8 rounded-xl bg-[var(--surface-card)] hover:bg-[var(--surface-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-xs font-medium flex items-center justify-center gap-1.5 transition-colors border border-[var(--border-default)] cursor-pointer focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] outline-none"
            title={isPaused ? "Resume Audio Ingress" : "Pause Audio Ingress"}
          >
            {isPaused ? <Play className="w-3.5 h-3.5 text-[var(--color-success)]" /> : <Pause className="w-3.5 h-3.5 text-amber-500" />}
            <span>{isPaused ? "Resume" : "Pause"}</span>
          </button>

          <button
            onClick={onStopAndSynthesize}
            className="flex-1 h-8 rounded-xl bg-[var(--color-error)] hover:opacity-90 text-white text-xs font-semibold flex items-center justify-center gap-1.5 shadow-xs transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] outline-none"
          >
            <Square className="w-3 h-3 fill-current" />
            <span>Stop & Synthesize</span>
          </button>
        </div>
      </div>
    </div>
  );
};

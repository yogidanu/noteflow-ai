import React, { useState } from "react";
import {
  Calendar,
  Radio,
  ExternalLink,
  Users,
  Clock,
  Sparkles,
  RefreshCw,
  Link2,
  AlertTriangle,
  Play,
  CheckCircle2,
  Video,
  ArrowRight,
  ShieldCheck,
  Bell,
  BellOff,
  Sliders,
} from "lucide-react";
import {
  DetectedMeeting,
  CalendarConnectionState,
  RecordingStatusType,
} from "../../../types/meeting";
import { MeetErrorCard } from "./MeetErrorCard";
import { EmptyFeedState } from "./EmptyFeedState";

interface MeetRecordFeedProps {
  calendarState: CalendarConnectionState;
  detectedMeetings: DetectedMeeting[];
  isSyncing: boolean;
  isDetectionEnabled?: boolean;
  onOpenDetectionModal?: () => void;
  onSyncCalendar: () => void;
  onOpenOAuthModal: () => void;
  onToggleRecording: (id: string, enabled: boolean) => void;
  onStartLiveRecording: (id: string) => void;
  onQuickJoinUrl: (url: string) => void;
  onSelectCompletedMeeting?: (id: string) => void;
  onRetryMeeting: (id: string) => void;
  onOpenConfirmModal: (meeting: DetectedMeeting) => void;
}

export const MeetRecordFeed: React.FC<MeetRecordFeedProps> = ({
  calendarState,
  detectedMeetings,
  isSyncing,
  isDetectionEnabled = false,
  onOpenDetectionModal,
  onSyncCalendar,
  onOpenOAuthModal,
  onToggleRecording,
  onStartLiveRecording,
  onQuickJoinUrl,
  onSelectCompletedMeeting,
  onRetryMeeting,
  onOpenConfirmModal,
}) => {
  const [quickUrlInput, setQuickUrlInput] = useState("");
  const [urlError, setUrlError] = useState<string | null>(null);

  const handleQuickSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickUrlInput.trim()) return;

    if (!quickUrlInput.includes("meet.google.com/")) {
      setUrlError("Please enter a valid Google Meet URL (e.g. meet.google.com/abc-defg-hij)");
      return;
    }

    setUrlError(null);
    onQuickJoinUrl(quickUrlInput);
    setQuickUrlInput("");
  };

  const getStatusBadge = (status: RecordingStatusType) => {
    switch (status) {
      case "recording":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[var(--success-surface)] border border-[var(--success-border)] text-[var(--color-success)] text-[11px] font-medium">
            <Radio className="w-3 h-3 text-[var(--color-success)] animate-pulse" />
            <span>Recording Active</span>
          </span>
        );
      case "scheduled":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[var(--primary-surface)] border border-[var(--primary-border)] text-[var(--primary-action)] text-[11px] font-medium">
            <Clock className="w-3 h-3 text-[var(--primary-action)]" />
            <span>Scheduled T-60s</span>
          </span>
        );
      case "transcribing":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[var(--warning-surface)] border border-[var(--warning-border)] text-[var(--color-warning)] text-[11px] font-medium">
            <RefreshCw className="w-3 h-3 animate-spin text-[var(--color-warning)]" />
            <span>Processing Summary...</span>
          </span>
        );
      case "completed":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[var(--success-surface)] border border-[var(--success-border)] text-[var(--color-success)] text-[11px] font-medium">
            <CheckCircle2 className="w-3 h-3 text-[var(--color-success)]" />
            <span>Synthesized & Ready</span>
          </span>
        );
      case "error":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[var(--error-surface)] border border-[var(--error-border)] text-[var(--color-error)] text-[11px] font-medium">
            <AlertTriangle className="w-3 h-3 text-[var(--color-error)]" />
            <span>Recording Failed</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-[var(--surface-subtle)] border border-[var(--border-default)] text-[var(--text-muted)] text-[11px]">
            Off
          </span>
        );
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-6 max-w-5xl mx-auto w-full font-sans animate-fadeIn">
      {/* Feed Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-3xl bg-[var(--surface-card)] border border-[var(--border-default)] shadow-xs transition-colors duration-150">
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-[var(--primary-surface)] border border-[var(--primary-border)] flex items-center justify-center text-[var(--primary-action)] shrink-0">
            <Calendar className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold text-[var(--text-primary)] tracking-tight">
                Meet Record Detection
              </h2>
              {calendarState.isConnected && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[var(--success-surface)] border border-[var(--success-border)] text-[var(--color-success)] text-[10px] font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-success)]"></span>
                  Google Workspace
                </span>
              )}
            </div>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">
              {calendarState.isConnected
                ? `Connected as ${calendarState.accountEmail} • Last synced ${calendarState.lastSyncedAt || "just now"}`
                : "Connect your calendar to automatically detect upcoming Google Meet calls."}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {calendarState.isConnected ? (
            <button
              onClick={onSyncCalendar}
              disabled={isSyncing}
              className="h-8 px-3.5 rounded-xl bg-[var(--surface-card)] hover:bg-[var(--surface-subtle)] text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] flex items-center gap-2 transition-colors border border-[var(--border-default)] shadow-2xs cursor-pointer disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] outline-none"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? "animate-spin text-[var(--primary-action)]" : "text-[var(--text-muted)]"}`} />
              <span>{isSyncing ? "Syncing..." : "Sync Calendar"}</span>
            </button>
          ) : (
            <button
              onClick={onOpenOAuthModal}
              className="h-8 px-4 rounded-xl bg-[var(--primary-action)] hover:bg-[var(--primary-hover)] text-xs font-semibold text-white flex items-center gap-2 shadow-xs transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] outline-none"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>Connect Google Calendar</span>
            </button>
          )}
        </div>
      </div>

      {/* Meeting Detection Setting Banner (When Calendar Connected) */}
      {calendarState.isConnected && onOpenDetectionModal && (
        <div className="p-4 rounded-2xl bg-[var(--surface-subtle)] border border-[var(--border-default)] flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs animate-fadeIn">
          <div className="flex items-start gap-3">
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
              isDetectionEnabled
                ? "bg-[var(--success-surface)] text-[var(--color-success)] border border-[var(--success-border)]"
                : "bg-indigo-50 dark:bg-indigo-950/40 text-[var(--primary-action)] border border-indigo-100 dark:border-indigo-900/60"
            }`}>
              {isDetectionEnabled ? (
                <Bell className="w-4 h-4" />
              ) : (
                <BellOff className="w-4 h-4" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-[var(--text-primary)]">
                  {isDetectionEnabled ? "Meeting Detection Active" : "Meeting Detection Setup"}
                </span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded font-mono font-semibold ${
                  isDetectionEnabled
                    ? "bg-[var(--success-surface)] text-[var(--color-success)] border border-[var(--success-border)]"
                    : "bg-slate-200 dark:bg-slate-800 text-[var(--text-muted)]"
                }`}>
                  {isDetectionEnabled ? "ON" : "OFF"}
                </span>
              </div>
              <p className="text-xs text-[var(--text-secondary)] mt-0.5 leading-relaxed max-w-xl">
                {isDetectionEnabled
                  ? "NoteFlow AI is checking your schedule for upcoming calls. You receive a 1-click recording cue before each call."
                  : "NoteFlow AI checks your connected calendar for upcoming meetings so you can decide which meetings to record."}
              </p>
            </div>
          </div>

          <button
            onClick={onOpenDetectionModal}
            className={`h-8 px-3.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 shrink-0 transition-all cursor-pointer shadow-xs focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] outline-none ${
              isDetectionEnabled
                ? "bg-[var(--surface-card)] hover:bg-[var(--surface-subtle)] border border-[var(--border-default)] text-[var(--text-primary)]"
                : "bg-[var(--primary-action)] hover:bg-[var(--primary-hover)] text-white"
            }`}
          >
            {isDetectionEnabled ? (
              <>
                <Sliders className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                <span>Configure Settings</span>
              </>
            ) : (
              <>
                <span>Enable Meeting Detection</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </>
            )}
          </button>
        </div>
      )}

      {/* Quick Record Direct URL Dropzone Bar */}
      <form
        onSubmit={handleQuickSubmit}
        className="p-3 rounded-2xl bg-[var(--surface-card)] border border-[var(--border-default)] shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 transition-colors duration-150"
      >
        <div className="flex items-center gap-2 flex-1 px-3 py-1.5 rounded-xl bg-[var(--surface-subtle)] border border-[var(--border-default)] focus-within:border-[var(--border-focus)] focus-within:bg-[var(--surface-card)] focus-within:ring-2 focus-within:ring-[var(--border-focus)] transition-all">
          <Link2 className="w-4 h-4 text-[var(--text-subtle)] shrink-0" />
          <input
            type="text"
            value={quickUrlInput}
            onChange={(e) => {
              setQuickUrlInput(e.target.value);
              if (urlError) setUrlError(null);
            }}
            placeholder="Paste any ad-hoc Google Meet link (e.g. meet.google.com/qrp-zvmk-sxc)..."
            className="w-full bg-transparent border-none text-xs text-[var(--text-primary)] placeholder:text-[var(--text-subtle)] focus:outline-none"
          />
        </div>

        <button
          type="submit"
          className="h-8 px-3.5 rounded-xl bg-[var(--primary-surface)] hover:opacity-90 text-[var(--primary-action)] border border-[var(--primary-border)] text-xs font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] outline-none"
        >
          <Play className="w-3 h-3 fill-current text-[var(--primary-action)]" />
          <span>Quick Record URL</span>
        </button>
      </form>

      {urlError && (
        <div className="px-3 py-2 rounded-xl bg-[var(--error-surface)] border border-[var(--error-border)] text-[var(--color-error)] text-xs flex items-center gap-2">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-[var(--color-error)]" />
          <span>{urlError}</span>
        </div>
      )}

      {/* Today's Detected Meetings Section */}
      <div className="space-y-3.5">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            <Video className="w-4 h-4 text-[var(--primary-action)]" />
            <span>Today's Detected Upcoming Meetings ({detectedMeetings.length})</span>
          </div>
          <span className="text-[11px] text-[var(--text-subtle)] font-medium">Per-Meeting Opt-In Required</span>
        </div>

        {detectedMeetings.length === 0 ? (
          <EmptyFeedState
            calendarState={calendarState}
            isDetectionEnabled={isDetectionEnabled}
            isSyncing={isSyncing}
            onOpenOAuthModal={onOpenOAuthModal}
            onOpenDetectionModal={onOpenDetectionModal || (() => {})}
            onSyncCalendar={onSyncCalendar}
          />
        ) : (
          <div className="space-y-3">
            {detectedMeetings.map((meeting) => {
              const isScheduled = meeting.recordingStatus === "scheduled";
              const isRecording = meeting.recordingStatus === "recording";
              const isCompleted = meeting.recordingStatus === "completed";
              const isError = meeting.recordingStatus === "error";

              return (
                <div
                  key={meeting.id}
                  className={`p-4 sm:p-5 rounded-2xl bg-[var(--surface-card)] border transition-all duration-150 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                    isRecording
                      ? "border-[var(--color-recording-pulse)] ring-1 ring-[var(--color-recording-pulse)]/20"
                      : isScheduled
                      ? "border-[var(--border-focus)] bg-indigo-50/20 dark:bg-indigo-950/20"
                      : "border-[var(--border-default)] hover:border-[var(--border-focus)]"
                  }`}
                >
                  <div className="space-y-2 flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      {getStatusBadge(meeting.recordingStatus)}

                      {/* Platform Badge */}
                      {meeting.platform === "google_meet" && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-medium">
                          Google Meet
                        </span>
                      )}
                      {meeting.platform === "zoom" && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 font-medium">
                          Zoom
                        </span>
                      )}
                      {meeting.platform === "teams" && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 font-medium">
                          Microsoft Teams
                        </span>
                      )}

                      {/* Meeting Timing Status */}
                      {meeting.status === "STARTING" && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 font-medium animate-pulse">
                          Starting Soon
                        </span>
                      )}
                      {meeting.status === "IN_PROGRESS" && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-medium">
                          Happening Now
                        </span>
                      )}

                      <span className="text-xs text-[var(--text-muted)] flex items-center gap-1 font-mono">
                        <Clock className="w-3 h-3" />
                        <span>
                          {meeting.startIso
                            ? new Date(meeting.startIso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit", hour12: true })
                            : meeting.startTime}
                          {" - "}
                          {meeting.endIso
                            ? new Date(meeting.endIso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit", hour12: true })
                            : meeting.endTime}
                        </span>
                      </span>
                      {meeting.isExternalHost && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--warning-surface)] text-[var(--color-warning)] border border-[var(--warning-border)] font-medium">
                          External Host
                        </span>
                      )}
                    </div>

                    <div>
                      <h3 className="text-sm sm:text-base font-semibold text-[var(--text-primary)] truncate">
                        {meeting.title}
                      </h3>
                      <div className="flex flex-wrap items-center gap-3 text-xs text-[var(--text-secondary)] mt-1">
                        <span className="flex items-center gap-1">
                          <Users className="w-3.5 h-3.5 text-[var(--text-subtle)]" />
                          <span>{meeting.organizerName}</span>
                        </span>
                        <span>•</span>
                        <span>{meeting.attendees?.length || 1} attendees</span>
                      </div>
                    </div>
                  </div>

                  {/* Meeting Actions */}
                  <div className="flex items-center gap-2 shrink-0">
                    {meeting.meetingUrl && (
                      <a
                        href={meeting.meetingUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="h-8 px-3 rounded-xl bg-[var(--surface-subtle)] hover:bg-[var(--surface-card)] border border-[var(--border-default)] text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] flex items-center gap-1.5 transition-colors cursor-pointer"
                        title="Open in Google Meet"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Join</span>
                      </a>
                    )}

                    {isCompleted ? (
                      <button
                        onClick={() => onSelectCompletedMeeting?.(meeting.id)}
                        className="h-8 px-3.5 rounded-xl bg-[var(--success-surface)] text-[var(--color-success)] border border-[var(--success-border)] text-xs font-semibold flex items-center gap-1.5 hover:opacity-90 transition-all cursor-pointer"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>View Summary</span>
                      </button>
                    ) : isError ? (
                      <button
                        onClick={() => onRetryMeeting(meeting.id)}
                        className="h-8 px-3.5 rounded-xl bg-[var(--error-surface)] text-[var(--color-error)] border border-[var(--error-border)] text-xs font-semibold flex items-center gap-1.5 hover:opacity-90 transition-all cursor-pointer"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>Retry</span>
                      </button>
                    ) : isRecording ? (
                      <button
                        disabled
                        className="h-8 px-3.5 rounded-xl bg-[var(--success-surface)] text-[var(--color-success)] border border-[var(--success-border)] text-xs font-semibold flex items-center gap-1.5 opacity-90 cursor-not-allowed"
                      >
                        <Radio className="w-3.5 h-3.5 animate-pulse" />
                        <span>Recording Active</span>
                      </button>
                    ) : meeting.status === "IN_PROGRESS" || meeting.status === "STARTING" ? (
                      <button
                        onClick={() => onStartLiveRecording(meeting.id)}
                        className="h-8 px-3.5 rounded-xl bg-[var(--color-success)] text-white text-xs font-semibold flex items-center gap-1.5 hover:opacity-90 transition-all shadow-xs cursor-pointer animate-pulse"
                      >
                        <Radio className="w-3.5 h-3.5" />
                        <span>Record Now</span>
                      </button>
                    ) : isScheduled ? (
                      <button
                        onClick={() => onToggleRecording(meeting.id, false)}
                        className="h-8 px-3.5 rounded-xl bg-[var(--primary-action)] text-white text-xs font-semibold flex items-center gap-1.5 hover:opacity-90 transition-all shadow-xs cursor-pointer"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Opted In</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => onOpenConfirmModal(meeting)}
                        className="h-8 px-3.5 rounded-xl bg-[var(--surface-card)] hover:bg-[var(--primary-action)] text-[var(--text-secondary)] hover:text-white border border-[var(--border-default)] hover:border-[var(--primary-action)] text-xs font-semibold flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer"
                      >
                        <span>Opt-In Recording</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

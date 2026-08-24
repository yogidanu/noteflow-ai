import React, { useState } from "react";
import { Sparkles, Calendar, Bell, ShieldCheck, ArrowRight, Video, RefreshCw, CheckCircle2, Settings, ExternalLink } from "lucide-react";
import { CalendarConnectionState } from "../../../types/meeting";

interface EmptyFeedStateProps {
  calendarState: CalendarConnectionState;
  isDetectionEnabled: boolean;
  onOpenOAuthModal?: () => void;
  onOpenCalendarModal?: () => void;
  onOpenDetectionModal: () => void;
  onSyncCalendar?: () => void;
  onQuickRecordUrl?: (url: string) => void;
  isSyncing?: boolean;
}

export const EmptyFeedState: React.FC<EmptyFeedStateProps> = ({
  calendarState,
  isDetectionEnabled,
  onOpenOAuthModal,
  onOpenCalendarModal,
  onOpenDetectionModal,
  onSyncCalendar,
  onQuickRecordUrl,
  isSyncing = false,
}) => {
  const [quickUrl, setQuickUrl] = useState("");

  const handleOpenCalendar = () => {
    if (onOpenOAuthModal) onOpenOAuthModal();
    else if (onOpenCalendarModal) onOpenCalendarModal();
  };

  const handleQuickSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickUrl.trim()) return;
    if (onQuickRecordUrl) {
      onQuickRecordUrl(quickUrl.trim());
      setQuickUrl("");
    }
  };

  return (
    <div
      role="region"
      aria-label="Meeting Feed Status and Quick Actions"
      className="max-w-2xl mx-auto py-8 px-4 space-y-8 animate-fadeIn text-center select-none"
    >
      {/* Intentional Empty State Hero */}
      <div className="space-y-3">
        <div className="w-14 h-14 rounded-2xl bg-[var(--surface-card)] border border-[var(--border-default)] flex items-center justify-center text-[var(--text-muted)] shadow-xs mx-auto">
          <Calendar className="w-7 h-7 text-[var(--primary-action)]" aria-hidden="true" />
        </div>

        <div className="space-y-1">
          <h3 className="text-xl sm:text-2xl font-bold text-[var(--text-primary)] tracking-tight">
            No meetings yet
          </h3>
          <p className="text-xs sm:text-sm text-[var(--text-secondary)] max-w-md mx-auto leading-relaxed">
            Your upcoming meetings will appear here once they're detected from your connected calendar.
          </p>
        </div>
      </div>

      {/* 3 Interactive Status & Setup Tiles */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 text-left" role="list">
        {/* Tile 1: Calendar Status */}
        <div
          role="listitem"
          className="p-4 rounded-2xl bg-[var(--surface-card)] border border-[var(--border-default)] shadow-xs flex flex-col justify-between space-y-3 transition-colors"
        >
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono uppercase tracking-wider text-[var(--text-muted)]">Calendar</span>
              {calendarState.isConnected ? (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--success-surface)] text-[var(--color-success)] border border-[var(--success-border)] font-medium flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" aria-hidden="true" />
                  <span>Connected</span>
                </span>
              ) : (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--surface-subtle)] text-[var(--text-muted)] border border-[var(--border-subtle)] font-medium">
                  Not Linked
                </span>
              )}
            </div>
            <div className="text-xs font-semibold text-[var(--text-primary)] truncate">
              {calendarState.accountEmail || "Google Calendar"}
            </div>
            <p className="text-[11px] text-[var(--text-muted)] leading-snug">
              {calendarState.isConnected
                ? "Delta sync active for read-only events"
                : "Connect to automatically ingest Google Meet calls"}
            </p>
          </div>

          <div className="pt-2 border-t border-[var(--border-subtle)] flex items-center gap-2">
            <button
              onClick={handleOpenCalendar}
              className="text-[11px] font-semibold text-[var(--primary-action)] hover:text-[var(--primary-hover)] transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] outline-none rounded"
            >
              {calendarState.isConnected ? "Manage access" : "Connect Calendar"}
            </button>
            {calendarState.isConnected && onSyncCalendar && (
              <button
                onClick={onSyncCalendar}
                disabled={isSyncing}
                aria-label="Sync calendar delta now"
                className="text-[11px] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors cursor-pointer flex items-center gap-1 focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] outline-none rounded p-0.5"
                title="Sync Now"
              >
                <RefreshCw className={`w-3 h-3 ${isSyncing ? "animate-spin" : ""}`} aria-hidden="true" />
                <span aria-live="polite">{isSyncing ? "Syncing..." : "Sync now"}</span>
              </button>
            )}
          </div>
        </div>

        {/* Tile 2: Meeting Detection Preferences */}
        <div
          role="listitem"
          className="p-4 rounded-2xl bg-[var(--surface-card)] border border-[var(--border-default)] shadow-xs flex flex-col justify-between space-y-3 transition-colors"
        >
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono uppercase tracking-wider text-[var(--text-muted)]">Detection</span>
              {isDetectionEnabled ? (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--success-surface)] text-[var(--color-success)] border border-[var(--success-border)] font-medium flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" aria-hidden="true" />
                  <span>Enabled</span>
                </span>
              ) : (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 font-medium">
                  Paused
                </span>
              )}
            </div>
            <div className="text-xs font-semibold text-[var(--text-primary)]">
              5-Minute Pre-Meeting Cues
            </div>
            <p className="text-[11px] text-[var(--text-muted)] leading-snug">
              Prompts you before meetings start to approve recording.
            </p>
          </div>

          <div className="pt-2 border-t border-[var(--border-subtle)]">
            <button
              onClick={onOpenDetectionModal}
              className="text-[11px] font-semibold text-[var(--primary-action)] hover:text-[var(--primary-hover)] transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] outline-none rounded"
            >
              Configure preferences
            </button>
          </div>
        </div>

        {/* Tile 3: Recording Sovereignty */}
        <div
          role="listitem"
          className="p-4 rounded-2xl bg-[var(--surface-card)] border border-[var(--border-default)] shadow-xs flex flex-col justify-between space-y-3 transition-colors"
        >
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono uppercase tracking-wider text-[var(--text-muted)]">Privacy</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--primary-surface)] text-[var(--primary-action)] border border-[var(--primary-border)] font-medium">
                Sovereign
              </span>
            </div>
            <div className="text-xs font-semibold text-[var(--text-primary)]">
              Zero Automatic Recording
            </div>
            <p className="text-[11px] text-[var(--text-muted)] leading-snug">
              Every recording requires your explicit 1-click consent.
            </p>
          </div>

          <div className="pt-2 border-t border-[var(--border-subtle)] flex items-center gap-1 text-[11px] text-[var(--text-muted)]">
            <ShieldCheck className="w-3.5 h-3.5 text-[var(--color-success)]" aria-hidden="true" />
            <span>AES-256 Vaulted</span>
          </div>
        </div>
      </div>

      {/* Instant Ad-Hoc Record Bar */}
      <div className="p-5 rounded-3xl bg-[var(--surface-card)] border border-[var(--border-default)] shadow-md space-y-3 text-left">
        <div className="flex items-center justify-between">
          <div className="text-xs font-semibold text-[var(--text-primary)] flex items-center gap-2">
            <Video className="w-4 h-4 text-[var(--primary-action)]" aria-hidden="true" />
            <span>Have a meeting URL right now?</span>
          </div>
          <span className="text-[10px] font-mono text-[var(--text-muted)]">Instant Ad-Hoc Capture</span>
        </div>

        <form onSubmit={handleQuickSubmit} className="flex items-center gap-2">
          <label htmlFor="quick-record-url-input" className="sr-only">
            Google Meet URL
          </label>
          <input
            id="quick-record-url-input"
            type="url"
            value={quickUrl}
            onChange={(e) => setQuickUrl(e.target.value)}
            placeholder="Paste Google Meet link (e.g. meet.google.com/abc-defg-hij)..."
            className="flex-1 px-3.5 py-2.5 rounded-xl bg-[var(--surface-subtle)] border border-[var(--border-default)] text-xs text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)] focus:ring-2 focus:ring-[var(--border-focus)] transition-all font-mono"
          />
          <button
            type="submit"
            disabled={!quickUrl.trim()}
            className="h-10 px-4 rounded-xl bg-[var(--primary-action)] hover:bg-[var(--primary-hover)] active:scale-[0.985] text-white text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] outline-none"
          >
            <span>Record Call</span>
            <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
        </form>
      </div>
    </div>
  );
};

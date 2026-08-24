import React from "react";
import { Bell, BellOff, ArrowRight, ShieldCheck, CheckCircle2, AlertTriangle, RefreshCw, LogOut, Lock, Check } from "lucide-react";
import { UserProfile } from "../../hooks/useAuth";
import { MeetingDetectionStateType } from "../modals/MeetingDetectionSetupModal";

interface MeetingDetectionSetupScreenProps {
  user: UserProfile;
  currentState: MeetingDetectionStateType;
  onEnable: () => Promise<boolean | void> | void;
  onSkip: () => void;
  onRetry: () => Promise<boolean | void> | void;
  onLogout: () => void;
}

export const MeetingDetectionSetupScreen: React.FC<MeetingDetectionSetupScreenProps> = ({
  user,
  currentState,
  onEnable,
  onSkip,
  onRetry,
  onLogout,
}) => {
  const isEnabling = currentState === "enabling";

  return (
    <main
      role="main"
      aria-label="Meeting Detection Setup"
      className="min-h-screen w-screen flex flex-col items-center justify-center p-4 sm:p-6 bg-[var(--bg-canvas)] text-[var(--text-primary)] select-none font-sans transition-colors duration-150"
    >
      <div className="w-full max-w-[500px] mx-auto space-y-6 animate-fadeIn">
        {/* Step Indicator & User Pill */}
        <div className="flex items-center justify-between px-1 text-xs text-[var(--text-muted)]">
          <span className="font-mono font-medium">Step 3 of 3 • Meeting Detection</span>
          <div className="flex items-center gap-2">
            <span className="truncate max-w-[160px] font-medium text-[var(--text-secondary)]">{user.email}</span>
            <button
              onClick={onLogout}
              aria-label="Sign out of account"
              className="text-[var(--text-muted)] hover:text-[var(--color-error)] transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] outline-none rounded p-0.5"
              title="Sign Out"
            >
              <LogOut className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Main Card */}
        <div className="p-6 sm:p-8 rounded-3xl bg-[var(--surface-card)] border border-[var(--border-default)] shadow-xl space-y-6">
          <div className="text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-100 dark:border-indigo-900/60 flex items-center justify-center text-[var(--primary-action)] shadow-2xs mx-auto">
              <Bell className="w-6 h-6" aria-hidden="true" />
            </div>

            <div className="space-y-1">
              <h1 className="text-xl sm:text-2xl font-bold text-[var(--text-primary)] tracking-tight">
                Meeting Detection Setup
              </h1>
              <p className="text-xs sm:text-sm text-[var(--text-secondary)] leading-relaxed max-w-sm mx-auto">
                NoteFlow AI checks your connected calendar for upcoming meetings so you can decide which meetings to record.
              </p>
            </div>
          </div>

          {/* Privacy & Safeguard Highlights */}
          <div className="space-y-2.5">
            <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] font-mono">
              Detection Guarantees
            </div>

            <div className="p-3.5 rounded-2xl bg-[var(--surface-subtle)] border border-[var(--border-subtle)] space-y-2.5 text-xs">
              <div className="flex items-start gap-2 text-[var(--text-primary)]">
                <Check className="w-4 h-4 text-[var(--color-success)] shrink-0 mt-0.5" aria-hidden="true" />
                <div>
                  <span className="font-semibold">5-Minute Pre-Meeting Cue</span>
                  <p className="text-[11px] text-[var(--text-muted)]">Subtle prompt before upcoming Google Meet calls</p>
                </div>
              </div>

              <div className="flex items-start gap-2 text-[var(--text-primary)]">
                <Check className="w-4 h-4 text-[var(--color-success)] shrink-0 mt-0.5" aria-hidden="true" />
                <div>
                  <span className="font-semibold">Zero Automatic Recording</span>
                  <p className="text-[11px] text-[var(--text-muted)]">No audio is ever captured without your 1-click approval</p>
                </div>
              </div>

              <div className="flex items-start gap-2 text-[var(--text-primary)]">
                <Check className="w-4 h-4 text-[var(--color-success)] shrink-0 mt-0.5" aria-hidden="true" />
                <div>
                  <span className="font-semibold">Configurable Anytime</span>
                  <p className="text-[11px] text-[var(--text-muted)]">Toggle detection or change preferences in Settings</p>
                </div>
              </div>
            </div>
          </div>

          {/* Permission Denied Warning */}
          {currentState === "permission_denied" && (
            <div
              role="alert"
              aria-live="polite"
              className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-800 dark:text-amber-300 space-y-1"
            >
              <div className="flex items-center gap-1.5 font-semibold">
                <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" aria-hidden="true" />
                <span>Desktop Notifications Muted</span>
              </div>
              <p className="text-[11px] opacity-90">
                System notifications were declined. NoteFlow AI will still detect meetings in the feed, but visual desktop alerts will be muted.
              </p>
            </div>
          )}

          {/* Connection Error */}
          {currentState === "connection_failure" && (
            <div
              role="alert"
              aria-live="assertive"
              className="p-3.5 rounded-2xl bg-[var(--error-surface)] border border-[var(--error-border)] text-xs text-[var(--color-error)] space-y-1"
            >
              <div className="flex items-center gap-1.5 font-semibold">
                <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>Connection Handshake Failed</span>
              </div>
              <p className="text-[11px]">
                Could not connect to the local detection daemon. Click retry to reconnect.
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="space-y-3 pt-1">
            {currentState === "connection_failure" ? (
              <button
                onClick={onRetry}
                aria-label="Retry connection to local detection daemon"
                className="w-full h-12 px-4 rounded-xl bg-[var(--primary-action)] hover:bg-[var(--primary-hover)] text-white text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] outline-none"
              >
                <RefreshCw className="w-4 h-4" aria-hidden="true" />
                <span>Retry Connection</span>
              </button>
            ) : (
              <button
                onClick={onEnable}
                disabled={isEnabling}
                aria-busy={isEnabling}
                aria-label={isEnabling ? "Enabling meeting detection..." : "Enable meeting detection"}
                className="w-full h-12 px-4 rounded-xl bg-[var(--primary-action)] hover:bg-[var(--primary-hover)] active:scale-[0.985] text-white text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] outline-none"
              >
                {isEnabling ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" aria-hidden="true" />
                    <span aria-live="polite">Enabling meeting detection...</span>
                  </>
                ) : (
                  <>
                    <span>Enable meeting detection</span>
                    <ArrowRight className="w-4 h-4" aria-hidden="true" />
                  </>
                )}
              </button>
            )}

            <button
              onClick={onSkip}
              disabled={isEnabling}
              className="w-full py-2 text-center text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors cursor-pointer disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] outline-none rounded"
            >
              Not now
            </button>
          </div>
        </div>
      </div>
    </main>
  );
};

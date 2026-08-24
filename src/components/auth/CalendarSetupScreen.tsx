import React, { useState } from "react";
import { Calendar, Shield, CheckCircle2, Lock, ArrowRight, AlertTriangle, RefreshCw, LogOut, Check, Info } from "lucide-react";
import { UserProfile } from "../../hooks/useAuth";

interface CalendarSetupScreenProps {
  user: UserProfile;
  isConnecting: boolean;
  error?: string | null;
  onConnectCalendar: (email?: string) => Promise<void> | void;
  onSkip?: () => void;
  onLogout: () => void;
}

export const CalendarSetupScreen: React.FC<CalendarSetupScreenProps> = ({
  user,
  isConnecting,
  error,
  onConnectCalendar,
  onSkip,
  onLogout,
}) => {
  const [useManualEmail, setUseManualEmail] = useState(false);
  const [emailInput, setEmailInput] = useState(user.email || "");

  const handleConnect = () => {
    onConnectCalendar(emailInput);
  };

  return (
    <main
      role="main"
      aria-label="Google Calendar Connection Setup"
      className="min-h-screen w-screen flex flex-col items-center justify-center p-4 sm:p-6 bg-[var(--bg-canvas)] text-[var(--text-primary)] select-none font-sans transition-colors duration-150"
    >
      <div className="w-full max-w-[500px] mx-auto space-y-6 animate-fadeIn">
        {/* Step Indicator & User Pill */}
        <div className="flex items-center justify-between px-1 text-xs text-[var(--text-muted)]">
          <span className="font-mono font-medium">Step 2 of 3 • Calendar Setup</span>
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

        {/* Hero Card */}
        <div className="p-6 sm:p-8 rounded-3xl bg-[var(--surface-card)] border border-[var(--border-default)] shadow-xl space-y-6">
          <div className="text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-[var(--primary-surface)] border border-[var(--primary-border)] flex items-center justify-center text-[var(--primary-action)] shadow-2xs mx-auto">
              <Calendar className="w-6 h-6" aria-hidden="true" />
            </div>

            <div className="space-y-1">
              <h1 className="text-xl sm:text-2xl font-bold text-[var(--text-primary)] tracking-tight">
                Connect Google Calendar
              </h1>
              <p className="text-xs sm:text-sm text-[var(--text-secondary)] leading-relaxed max-w-sm mx-auto">
                NoteFlow AI needs read-only access to your calendar to detect upcoming Google Meet calls.
              </p>
            </div>
          </div>

          {/* Explicit Architectural Notice */}
          <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-800 dark:text-amber-300 flex items-start gap-2.5">
            <Info className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" aria-hidden="true" />
            <div>
              <span className="font-semibold">Google Sign-in ≠ Google Calendar Access:</span>
              <p className="text-[11px] mt-0.5 opacity-90">
                Your sign-in identity did not grant calendar access. We request explicit authorization with minimal read-only permissions.
              </p>
            </div>
          </div>

          {/* Minimal Scope & Permissions Matrix */}
          <div className="space-y-2.5">
            <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] font-mono">
              Permissions & Boundaries
            </div>

            <div className="p-3.5 rounded-2xl bg-[var(--surface-subtle)] border border-[var(--border-subtle)] space-y-2.5 text-xs">
              <div className="flex items-start gap-2 text-[var(--text-primary)]">
                <Check className="w-4 h-4 text-[var(--color-success)] shrink-0 mt-0.5" aria-hidden="true" />
                <div>
                  <span className="font-medium">Read upcoming meeting schedules</span>
                  <p className="text-[11px] text-[var(--text-muted)]">Event title, start/end time, and Google Meet URL</p>
                </div>
              </div>

              <div className="flex items-start gap-2 text-[var(--text-primary)]">
                <Check className="w-4 h-4 text-[var(--color-success)] shrink-0 mt-0.5" aria-hidden="true" />
                <div>
                  <span className="font-medium">Minimal read-only scope</span>
                  <p className="text-[11px] text-[var(--text-muted)] font-mono text-[10px]">https://www.googleapis.com/auth/calendar.events.readonly</p>
                </div>
              </div>

              <div className="flex items-start gap-2 text-[var(--text-muted)] pt-1 border-t border-[var(--border-subtle)]">
                <Lock className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" aria-hidden="true" />
                <span className="text-[11px]">Cannot edit, delete, or create calendar events</span>
              </div>
            </div>
          </div>

          {/* Error Banner */}
          {error && (
            <div
              role="alert"
              aria-live="assertive"
              className="p-3 rounded-2xl bg-[var(--error-surface)] border border-[var(--error-border)] text-[var(--color-error)] text-xs flex items-center gap-2"
            >
              <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>{error}</span>
            </div>
          )}

          {/* Actions */}
          <div className="space-y-3 pt-1">
            <button
              onClick={handleConnect}
              disabled={isConnecting}
              aria-busy={isConnecting}
              aria-label={isConnecting ? "Authorizing with Google Calendar..." : "Connect Google Calendar"}
              className="w-full h-12 px-4 rounded-xl bg-[var(--primary-action)] hover:bg-[var(--primary-hover)] active:scale-[0.985] text-white text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] outline-none"
            >
              {isConnecting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" aria-hidden="true" />
                  <span aria-live="polite">Authorizing with Google...</span>
                </>
              ) : (
                <>
                  <Calendar className="w-4 h-4" aria-hidden="true" />
                  <span>Connect Google Calendar</span>
                  <ArrowRight className="w-4 h-4" aria-hidden="true" />
                </>
              )}
            </button>

            {onSkip && (
              <button
                onClick={onSkip}
                disabled={isConnecting}
                className="w-full py-2 text-center text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors cursor-pointer disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] outline-none rounded"
              >
                Skip for now (I'll connect later in Settings)
              </button>
            )}
          </div>
        </div>
      </div>
    </main>
  );
};

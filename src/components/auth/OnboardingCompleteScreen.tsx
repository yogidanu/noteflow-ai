import React from "react";
import { CheckCircle2, ArrowRight, Calendar, ShieldCheck, Bell, Sparkles, Lock } from "lucide-react";
import { UserProfile } from "../../hooks/useAuth";

interface OnboardingCompleteScreenProps {
  user: UserProfile | null;
  accountEmail?: string | null;
  onGoToDashboard: () => void;
}

export const OnboardingCompleteScreen: React.FC<OnboardingCompleteScreenProps> = ({
  user,
  accountEmail,
  onGoToDashboard,
}) => {
  const displayEmail = accountEmail || user?.email || "user@workspace.design";

  return (
    <main
      role="main"
      aria-label="Setup Complete"
      className="min-h-screen w-screen flex flex-col items-center justify-center p-4 sm:p-6 bg-[var(--bg-canvas)] text-[var(--text-primary)] select-none font-sans transition-colors duration-150"
    >
      <div className="w-full max-w-[480px] mx-auto space-y-6 animate-fadeIn text-center">
        {/* Celebration Brand Header */}
        <div className="space-y-3">
          <div className="relative w-14 h-14 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200/60 dark:border-emerald-800/60 flex items-center justify-center text-[var(--color-success)] shadow-xs mx-auto animate-bounce-subtle">
            <CheckCircle2 className="w-7 h-7 text-[var(--color-success)]" aria-hidden="true" />
            <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-[var(--primary-action)] text-white flex items-center justify-center shadow-xs">
              <Sparkles className="w-3 h-3" aria-hidden="true" />
            </span>
          </div>

          <div className="space-y-1">
            <div className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider font-mono">
              Setup Complete
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-[var(--text-primary)] tracking-tight">
              You're all set.
            </h1>
          </div>

          <p className="text-xs sm:text-sm text-[var(--text-secondary)] max-w-sm mx-auto leading-relaxed">
            NoteFlow AI will now look for upcoming meetings in your connected calendar.
          </p>
        </div>

        {/* Verification Summary Checklist Card */}
        <div className="p-6 sm:p-7 rounded-3xl bg-[var(--surface-card)] border border-[var(--border-default)] shadow-xl space-y-4 text-left">
          <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] font-mono">
            Active Integrations & Preferences
          </div>

          <div className="space-y-3" role="list">
            {/* Checklist Item 1: Google Account */}
            <div
              role="listitem"
              className="p-3.5 rounded-2xl bg-[var(--surface-subtle)] border border-[var(--border-subtle)] flex items-center justify-between transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-emerald-100 dark:bg-emerald-900/40 text-[var(--color-success)] flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
                </div>
                <div>
                  <div className="text-xs font-semibold text-[var(--text-primary)] flex items-center gap-1.5">
                    <span>Google account connected</span>
                  </div>
                  <div className="text-[11px] text-[var(--text-muted)] truncate max-w-[240px]">
                    {displayEmail}
                  </div>
                </div>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--success-surface)] text-[var(--color-success)] border border-[var(--success-border)] font-medium shrink-0">
                Verified
              </span>
            </div>

            {/* Checklist Item 2: Google Calendar */}
            <div
              role="listitem"
              className="p-3.5 rounded-2xl bg-[var(--surface-subtle)] border border-[var(--border-subtle)] flex items-center justify-between transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-emerald-100 dark:bg-emerald-900/40 text-[var(--color-success)] flex items-center justify-center shrink-0">
                  <Calendar className="w-4 h-4" aria-hidden="true" />
                </div>
                <div>
                  <div className="text-xs font-semibold text-[var(--text-primary)]">
                    Google Calendar connected
                  </div>
                  <div className="text-[11px] text-[var(--text-muted)]">
                    Read-only Google Meet schedule sync
                  </div>
                </div>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--success-surface)] text-[var(--color-success)] border border-[var(--success-border)] font-medium shrink-0">
                Synced
              </span>
            </div>

            {/* Checklist Item 3: Meeting Detection */}
            <div
              role="listitem"
              className="p-3.5 rounded-2xl bg-[var(--surface-subtle)] border border-[var(--border-subtle)] flex items-center justify-between transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-emerald-100 dark:bg-emerald-900/40 text-[var(--color-success)] flex items-center justify-center shrink-0">
                  <Bell className="w-4 h-4" aria-hidden="true" />
                </div>
                <div>
                  <div className="text-xs font-semibold text-[var(--text-primary)]">
                    Meeting detection enabled
                  </div>
                  <div className="text-[11px] text-[var(--text-muted)]">
                    Pre-meeting cues & 1-click opt-in
                  </div>
                </div>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--success-surface)] text-[var(--color-success)] border border-[var(--success-border)] font-medium shrink-0">
                Active
              </span>
            </div>
          </div>

          {/* Privacy & Reassurance Guarantees */}
          <div className="pt-3 border-t border-[var(--border-subtle)] flex items-center justify-between text-[11px] text-[var(--text-muted)]">
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-[var(--color-success)]" aria-hidden="true" />
              <span>Zero Model Training</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
              <span>AES-256 Vaulted</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-[var(--primary-action)]" aria-hidden="true" />
              <span>Grounded Citations</span>
            </div>
          </div>

          {/* Primary Action Button */}
          <div className="pt-2">
            <button
              onClick={onGoToDashboard}
              autoFocus
              aria-label="Go to NoteFlow AI Dashboard"
              className="w-full h-12 px-4 rounded-xl bg-[var(--primary-action)] hover:bg-[var(--primary-hover)] active:scale-[0.985] text-white text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] outline-none"
            >
              <span>Go to dashboard</span>
              <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>
    </main>
  );
};

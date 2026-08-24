import React, { useState } from "react";
import { Sparkles, Shield, ArrowRight, Mail, Compass, Lock, Calendar, AlertCircle, Loader2 } from "lucide-react";

interface AuthWelcomeScreenProps {
  onSignInWithGoogle: (email?: string, name?: string) => Promise<any>;
  onSignInWithEmail: (email: string, name?: string) => any;
  onEnterDemoMode: () => void;
  isAuthenticating?: boolean;
  authError?: string | null;
  onClearError?: () => void;
}

export const AuthWelcomeScreen: React.FC<AuthWelcomeScreenProps> = ({
  onSignInWithGoogle,
  onSignInWithEmail,
  onEnterDemoMode,
  isAuthenticating = false,
  authError,
  onClearError,
}) => {
  const [emailInput, setEmailInput] = useState("");
  const [nameInput, setNameInput] = useState("");
  const [showEmailForm, setShowEmailForm] = useState(false);

  const handleEmailSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailInput.trim() || !emailInput.includes("@")) return;
    onSignInWithEmail(emailInput.trim(), nameInput.trim() || undefined);
  };

  const handleGoogleClick = async () => {
    if (isAuthenticating) return;
    await onSignInWithGoogle();
  };

  return (
    <main
      role="main"
      className="min-h-screen w-screen flex flex-col items-center justify-center p-4 sm:p-6 bg-[var(--bg-canvas)] text-[var(--text-primary)] select-none font-sans transition-colors"
    >
      <div className="w-full max-w-[460px] mx-auto space-y-6 animate-fadeIn">
        {/* Brand Header */}
        <div className="text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-[var(--primary-surface)] border border-[var(--primary-border)] flex items-center justify-center text-[var(--primary-action)] shadow-xs mx-auto">
            <Sparkles className="w-6 h-6" aria-hidden="true" />
          </div>

          <div className="space-y-1">
            <div className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider font-mono">
              NoteFlow AI
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-[var(--text-primary)] tracking-tight">
              Your meetings, remembered.
            </h1>
          </div>

          <p className="text-xs sm:text-sm text-[var(--text-secondary)] max-w-sm mx-auto leading-relaxed">
            Turn conversations into clear summaries, decisions and action items.
          </p>
        </div>

        {/* Auth Error Banner */}
        {authError && (
          <div
            role="alert"
            aria-live="assertive"
            className="p-3.5 rounded-2xl bg-[var(--error-surface)] border border-[var(--error-border)] text-[var(--color-error)] text-xs flex items-start gap-2.5 animate-fadeIn"
          >
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
            <div className="flex-1 text-left leading-snug">
              <span>{authError}</span>
            </div>
            {onClearError && (
              <button
                onClick={onClearError}
                aria-label="Dismiss error notification"
                className="text-[11px] font-semibold hover:underline cursor-pointer focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] outline-none rounded"
              >
                Dismiss
              </button>
            )}
          </div>
        )}

        {/* Main Sign-In Monolith Card */}
        <div className="p-6 sm:p-7 rounded-3xl bg-[var(--surface-card)] border border-[var(--border-default)] shadow-xl space-y-5">
          {!showEmailForm ? (
            <div className="space-y-3">
              {/* Primary: Continue with Google */}
              <button
                onClick={handleGoogleClick}
                disabled={isAuthenticating}
                aria-busy={isAuthenticating}
                aria-label={isAuthenticating ? "Connecting with Google Workspace" : "Continue with Google"}
                className="w-full h-12 px-4 rounded-xl bg-[var(--primary-action)] hover:bg-[var(--primary-hover)] active:scale-[0.985] text-white text-xs sm:text-sm font-semibold flex items-center justify-center gap-2.5 shadow-xs transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] outline-none"
              >
                {isAuthenticating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                    <span aria-live="polite">Connecting with Google Workspace...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" viewBox="0 0 24 24" aria-hidden="true">
                      <path
                        fill="currentColor"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="currentColor"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="currentColor"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                      />
                      <path
                        fill="currentColor"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                      />
                    </svg>
                    <span>Continue with Google</span>
                  </>
                )}
              </button>

              {/* Secondary: Continue with Work Email */}
              <button
                onClick={() => setShowEmailForm(true)}
                disabled={isAuthenticating}
                className="w-full h-11 px-4 rounded-xl bg-[var(--surface-card)] hover:bg-[var(--surface-subtle)] border border-[var(--border-default)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-xs font-medium flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-2xs disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] outline-none"
              >
                <Mail className="w-4 h-4 text-[var(--text-muted)]" aria-hidden="true" />
                <span>Continue with Work Email</span>
              </button>
            </div>
          ) : (
            <form onSubmit={handleEmailSubmit} className="space-y-3.5">
              <div className="space-y-1">
                <label
                  htmlFor="auth-fullname"
                  className="block text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider"
                >
                  Full Name
                </label>
                <input
                  id="auth-fullname"
                  type="text"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  placeholder="e.g. Sarah Chen"
                  className="w-full px-3.5 py-2 rounded-xl bg-[var(--surface-subtle)] border border-[var(--border-default)] text-xs text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)] focus:ring-2 focus:ring-[var(--border-focus)] transition-all"
                />
              </div>

              <div className="space-y-1">
                <label
                  htmlFor="auth-workemail"
                  className="block text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider"
                >
                  Work Email Address
                </label>
                <input
                  id="auth-workemail"
                  type="email"
                  required
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  placeholder="name@company.com"
                  className="w-full px-3.5 py-2 rounded-xl bg-[var(--surface-subtle)] border border-[var(--border-default)] text-xs text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)] focus:ring-2 focus:ring-[var(--border-focus)] transition-all"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowEmailForm(false)}
                  className="px-3.5 py-2 text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] outline-none rounded"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={isAuthenticating}
                  className="flex-1 h-10 px-4 rounded-xl bg-[var(--primary-action)] hover:bg-[var(--primary-hover)] text-white text-xs font-semibold flex items-center justify-center gap-1.5 shadow-xs transition-all cursor-pointer disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] outline-none"
                >
                  <span>Sign In</span>
                  <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
              </div>
            </form>
          )}

          {/* Timeline Primer: What Happens Next */}
          <div className="pt-4 border-t border-[var(--border-subtle)] space-y-2.5">
            <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] font-mono text-left">
              What happens next
            </div>
            <div className="grid grid-cols-3 gap-2 text-left text-[11px]">
              <div className="p-2 rounded-xl bg-[var(--surface-subtle)] space-y-1">
                <span className="font-bold text-[var(--primary-action)]">1</span>
                <div className="font-semibold text-[var(--text-primary)] leading-tight">Sign In</div>
                <div className="text-[10px] text-[var(--text-muted)]">Secure workspace access</div>
              </div>
              <div className="p-2 rounded-xl bg-[var(--surface-subtle)] space-y-1">
                <span className="font-bold text-[var(--primary-action)]">2</span>
                <div className="font-semibold text-[var(--text-primary)] leading-tight">Connect Calendar</div>
                <div className="text-[10px] text-[var(--text-muted)]">Read-only event sync</div>
              </div>
              <div className="p-2 rounded-xl bg-[var(--surface-subtle)] space-y-1">
                <span className="font-bold text-[var(--primary-action)]">3</span>
                <div className="font-semibold text-[var(--text-primary)] leading-tight">Detect & Record</div>
                <div className="text-[10px] text-[var(--text-muted)]">1-click per meeting</div>
              </div>
            </div>
          </div>

          {/* Privacy & Trust Reassurance */}
          <div className="pt-2 flex items-center justify-between text-[11px] text-[var(--text-muted)]">
            <div className="flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-[var(--color-success)]" aria-hidden="true" />
              <span>Zero Model Training</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
              <span>AES-256 Encrypted</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-[var(--primary-action)]" aria-hidden="true" />
              <span>Read-Only Scope</span>
            </div>
          </div>
        </div>

        {/* Sandbox Exploratory Mode (Isolate Test Fixtures) */}
        <div className="pt-2 text-center">
          <button
            onClick={onEnterDemoMode}
            className="text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] inline-flex items-center gap-1.5 font-medium transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] outline-none rounded-lg px-2 py-1"
          >
            <Compass className="w-3.5 h-3.5 text-amber-500" aria-hidden="true" />
            <span>Explore Demo Sandbox with sample meetings</span>
          </button>
        </div>
      </div>
    </main>
  );
};

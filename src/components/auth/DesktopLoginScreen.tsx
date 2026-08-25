import React, { useState, useEffect, useRef } from "react";
import { Sparkles, Shield, ArrowRight, Lock, Calendar, AlertCircle, Loader2, CheckCircle2, ExternalLink, Laptop } from "lucide-react";
import { apiClient } from "../../lib/apiClient";

interface DesktopLoginScreenProps {
  onSuccess?: (authCode: string, redirectUri: string) => void;
}

export const DesktopLoginScreen: React.FC<DesktopLoginScreenProps> = ({ onSuccess }) => {
  const [status, setStatus] = useState<"idle" | "authenticating" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [deepLinkUrl, setDeepLinkUrl] = useState<string | null>(null);
  const [authenticatedUserEmail, setAuthenticatedUserEmail] = useState<string | null>(null);

  // Parse PKCE & OAuth parameters from URL search params
  const params = new URLSearchParams(window.location.search);
  const codeChallenge = params.get("code_challenge") || "";
  const codeChallengeMethod = params.get("code_challenge_method") || "S256";
  const stateNonce = params.get("state") || `state_${Date.now()}`;
  const redirectUri = params.get("redirect_uri") || "noteflow://auth/callback";

  // Auto-trigger deep link redirect upon success
  useEffect(() => {
    if (status === "success" && deepLinkUrl) {
      // Trigger protocol handler
      const timer = setTimeout(() => {
        window.location.href = deepLinkUrl;
      }, 400);

      return () => clearTimeout(timer);
    }
  }, [status, deepLinkUrl]);

  const handleSignInWithGoogle = async () => {
    if (status === "authenticating") return;

    setStatus("authenticating");
    setErrorMessage(null);

    try {
      // 1. Request official Google OAuth authorization URL with PKCE & CSRF state
      const authData = await apiClient.getGoogleAuthUrl(redirectUri, "auth", codeChallenge, codeChallengeMethod);

      if (authData && authData.authUrl) {
        // Direct browser navigation to Google OAuth endpoint (Google will redirect to backend callback and deep link)
        window.location.href = authData.authUrl;
      } else {
        throw new Error("Unable to obtain Google sign-in URL from server.");
      }
    } catch (err: any) {
      console.error("[DesktopLogin] Auth error:", err);
      const isCancelled = err?.message?.toLowerCase().includes("cancel") || err?.message?.toLowerCase().includes("closed");
      setErrorMessage(isCancelled ? "Google sign-in was cancelled." : err?.message || "Authentication failed. Please try again.");
      setStatus("error");
    }
  };

  return (
    <main
      role="main"
      aria-label="NoteFlow AI Desktop Authentication"
      className="min-h-screen w-screen flex flex-col items-center justify-center p-4 sm:p-6 bg-[var(--bg-canvas)] text-[var(--text-primary)] select-none font-sans transition-colors"
    >
      <div className="w-full max-w-[480px] mx-auto space-y-6 animate-fadeIn">
        {/* Brand Header */}
        <div className="text-center space-y-3">
          <div className="relative w-14 h-14 rounded-2xl bg-[var(--primary-surface)] border border-[var(--primary-border)] flex items-center justify-center text-[var(--primary-action)] shadow-xs mx-auto">
            <Sparkles className="w-7 h-7" aria-hidden="true" />
            <span className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-[var(--surface-card)] border border-[var(--border-default)] flex items-center justify-center text-[var(--text-muted)] shadow-xs">
              <Laptop className="w-3 h-3 text-[var(--primary-action)]" aria-hidden="true" />
            </span>
          </div>

          <div className="space-y-1.5">
            <div className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider font-mono">
              NoteFlow AI • Desktop Ingress
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-[var(--text-primary)] tracking-tight">
              Sign in to NoteFlow AI to connect your meetings and calendar.
            </h1>
          </div>

          <p className="text-xs sm:text-sm text-[var(--text-secondary)] max-w-sm mx-auto leading-relaxed">
            Authorize NoteFlow AI on this device to detect scheduled Google Meet calls and capture clear summaries.
          </p>
        </div>

        {/* Error Alert Banner */}
        {status === "error" && errorMessage && (
          <div
            role="alert"
            aria-live="assertive"
            className="p-3.5 rounded-2xl bg-[var(--error-surface)] border border-[var(--error-border)] text-[var(--color-error)] text-xs flex items-start gap-2.5 animate-fadeIn"
          >
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
            <div className="flex-1 text-left leading-snug">
              <span>{errorMessage}</span>
            </div>
            <button
              onClick={() => {
                setStatus("idle");
                setErrorMessage(null);
              }}
              aria-label="Dismiss error"
              className="text-[11px] font-semibold hover:underline cursor-pointer focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] outline-none rounded"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Main Focused Auth Card */}
        <div className="p-6 sm:p-8 rounded-3xl bg-[var(--surface-card)] border border-[var(--border-default)] shadow-xl space-y-6">
          {status === "success" ? (
            /* Success State: Deep-Link Launcher */
            <div className="space-y-5 text-center animate-fadeIn">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200/60 dark:border-emerald-800/60 flex items-center justify-center text-[var(--color-success)] shadow-xs mx-auto">
                <CheckCircle2 className="w-6 h-6" aria-hidden="true" />
              </div>

              <div className="space-y-1">
                <h2 className="text-lg font-bold text-[var(--text-primary)]">
                  Authentication Successful
                </h2>
                <p className="text-xs text-[var(--text-secondary)]">
                  Signed in as <span className="font-medium text-[var(--text-primary)]">{authenticatedUserEmail}</span>
                </p>
              </div>

              <div className="p-3.5 rounded-2xl bg-[var(--surface-subtle)] border border-[var(--border-subtle)] text-xs text-[var(--text-muted)] flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-[var(--primary-action)]" aria-hidden="true" />
                <span aria-live="polite">Returning to NoteFlow AI Desktop...</span>
              </div>

              {deepLinkUrl && (
                <div className="pt-2">
                  <a
                    href={deepLinkUrl}
                    className="w-full h-11 px-4 rounded-xl bg-[var(--primary-action)] hover:bg-[var(--primary-hover)] active:scale-[0.985] text-white text-xs font-semibold flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] outline-none inline-flex"
                  >
                    <span>Open NoteFlow AI Desktop</span>
                    <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                  </a>
                  <p className="text-[11px] text-[var(--text-muted)] mt-2">
                    If NoteFlow AI doesn't open automatically, click the button above.
                  </p>
                </div>
              )}
            </div>
          ) : (
            /* Idle & Authenticating State */
            <div className="space-y-5">
              {/* Primary Action Button: Continue with Google */}
              <button
                onClick={handleSignInWithGoogle}
                disabled={status === "authenticating"}
                aria-busy={status === "authenticating"}
                aria-label={status === "authenticating" ? "Connecting with Google Workspace" : "Continue with Google"}
                className="w-full h-12 px-4 rounded-xl bg-[var(--primary-action)] hover:bg-[var(--primary-hover)] active:scale-[0.985] text-white text-xs sm:text-sm font-semibold flex items-center justify-center gap-2.5 shadow-xs transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] outline-none"
              >
                {status === "authenticating" ? (
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

              {/* PKCE & Protocol Indicator */}
              <div className="p-3.5 rounded-2xl bg-[var(--surface-subtle)] border border-[var(--border-subtle)] space-y-2 text-xs text-left">
                <div className="flex items-center justify-between text-[10px] font-mono text-[var(--text-muted)] uppercase tracking-wider">
                  <span>Security & Ingress Protocol</span>
                  <span className="text-[var(--color-success)] font-bold">PKCE S256</span>
                </div>
                <div className="flex items-start gap-2 text-[var(--text-secondary)]">
                  <Shield className="w-3.5 h-3.5 text-[var(--color-success)] shrink-0 mt-0.5" aria-hidden="true" />
                  <span className="text-[11px] leading-snug">
                    Secures desktop handshake with proof key exchange and AES-256 encrypted credential vaulting.
                  </span>
                </div>
              </div>

              {/* Privacy Reassurances */}
              <div className="pt-2 border-t border-[var(--border-subtle)] flex items-center justify-between text-[11px] text-[var(--text-muted)]">
                <div className="flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
                  <span>Encrypted Vault</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-[var(--primary-action)]" aria-hidden="true" />
                  <span>Read-Only Scope</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5 text-[var(--color-success)]" aria-hidden="true" />
                  <span>Zero Training</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Browser Security Notice */}
        <p className="text-[11px] text-[var(--text-muted)] text-center max-w-xs mx-auto leading-relaxed">
          You are authorizing the NoteFlow AI desktop companion. You can revoke access at any time from your Google Account settings.
        </p>
      </div>
    </main>
  );
};

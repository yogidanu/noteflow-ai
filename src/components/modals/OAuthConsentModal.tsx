import React, { useState, useEffect, useRef } from "react";
import { ShieldCheck, Calendar, Lock, CheckCircle2, X, ArrowRight, Unlink, AlertTriangle } from "lucide-react";
import { CalendarConnectionState } from "../../types/meeting";

interface OAuthConsentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (email: string) => void;
  onDisconnect?: () => void;
  calendarState?: CalendarConnectionState;
  defaultEmail?: string | null;
}

export const OAuthConsentModal: React.FC<OAuthConsentModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  onDisconnect,
  calendarState,
  defaultEmail,
}) => {
  const [selectedAccount, setSelectedAccount] = useState(defaultEmail || "user@company.design");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);

  const isAlreadyConnected = calendarState?.isConnected;

  useEffect(() => {
    if (calendarState?.accountEmail) {
      setSelectedAccount(calendarState.accountEmail);
    } else if (defaultEmail) {
      setSelectedAccount(defaultEmail);
    }
  }, [calendarState?.accountEmail, defaultEmail]);

  // Escape key & focus trapping
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }

      if (e.key === "Tab" && modalRef.current) {
        const focusableElements = modalRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusableElements.length === 0) return;

        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (e.shiftKey && document.activeElement === firstElement) {
          e.preventDefault();
          lastElement.focus();
        } else if (!e.shiftKey && document.activeElement === lastElement) {
          e.preventDefault();
          firstElement.focus();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleAuthorize = () => {
    setIsSubmitting(true);
    setTimeout(() => {
      onConfirm(selectedAccount);
      setIsSubmitting(false);
      onClose();
    }, 500);
  };

  const handleDisconnect = () => {
    if (onDisconnect) {
      onDisconnect();
    }
    onClose();
  };

  const initials = selectedAccount
    .split("@")[0]
    .substring(0, 2)
    .toUpperCase();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Scrim Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal Container */}
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="oauth-modal-title"
        className="relative w-full max-w-lg rounded-3xl bg-[var(--surface-elevated)] border border-[var(--border-default)] p-6 sm:p-8 shadow-2xl text-[var(--text-primary)] z-10 animate-in fade-in zoom-in-95 duration-150 font-sans"
      >
        {/* Header with Close */}
        <div className="flex items-start justify-between pb-4 border-b border-[var(--border-subtle)]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[var(--primary-surface)] border border-[var(--primary-border)] flex items-center justify-center text-[var(--primary-action)]">
              <Calendar className="w-5 h-5" aria-hidden="true" />
            </div>
            <div>
              <h3 id="oauth-modal-title" className="text-base font-semibold text-[var(--text-primary)] tracking-tight">
                {isAlreadyConnected ? "Google Calendar Integration" : "Connect Google Calendar"}
              </h3>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">
                {isAlreadyConnected ? "Manage your linked calendar permissions" : "Automated Google Meet detection for NoteFlow AI"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close Google Calendar connection dialog"
            className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-subtle)] rounded-lg transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] outline-none"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        {/* Explicit Google Sign-In ≠ Calendar Access Callout */}
        <div className="my-5 space-y-4">
          <div className="p-3.5 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/60 text-xs space-y-1.5">
            <div className="flex items-center gap-2 font-semibold text-[var(--primary-action)]">
              <ShieldCheck className="w-4 h-4 text-[var(--color-success)]" />
              <span>Separate Permission Notice</span>
            </div>
            <p className="text-[var(--text-secondary)] leading-relaxed">
              Signing into NoteFlow does <strong>not</strong> grant access to your calendar. Calendar synchronization is an optional, read-only permission requested separately below.
            </p>
          </div>

          {/* Scope Explainer / Connected Status */}
          {isAlreadyConnected ? (
            <div className="space-y-3">
              <div className="p-4 rounded-2xl bg-[var(--surface-subtle)] border border-[var(--border-default)] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)] font-mono">
                    Connected Account
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--success-surface)] text-[var(--color-success)] border border-[var(--success-border)] font-medium">
                    Active & Synced
                  </span>
                </div>
                <div className="text-sm font-semibold text-[var(--text-primary)]">{selectedAccount}</div>
                {calendarState?.lastSyncedAt && (
                  <div className="text-[11px] text-[var(--text-muted)]">
                    Last delta sync: {calendarState.lastSyncedAt}
                  </div>
                )}
              </div>

              <div className="text-xs text-[var(--text-secondary)] space-y-1.5">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[var(--color-success)]" />
                  <span>Scope: <code className="font-mono text-[11px] bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded">calendar.events.readonly</code></span>
                </div>
                <div className="flex items-center gap-2">
                  <Lock className="w-4 h-4 text-[var(--primary-action)]" />
                  <span>Tokens encrypted with AES-256-GCM in isolated vault.</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-3 text-xs">
              <div className="space-y-2 text-[var(--text-secondary)]">
                <div className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-[var(--color-success)] shrink-0 mt-0.5" />
                  <span>
                    <strong className="text-[var(--text-primary)]">What NoteFlow WILL see:</strong> Meeting titles, scheduled times, and <code className="px-1 py-0.5 rounded bg-[var(--surface-subtle)] text-[var(--text-primary)] font-mono text-[11px]">meet.google.com</code> URLs to cue recording.
                  </span>
                </div>

                <div className="flex items-start gap-2.5">
                  <Lock className="w-4 h-4 text-[var(--primary-action)] shrink-0 mt-0.5" />
                  <span>
                    <strong className="text-[var(--text-primary)]">What NoteFlow will NEVER see:</strong> Zero email reading, zero calendar modifying, zero event creation or deletion.
                  </span>
                </div>
              </div>

              {/* Account Selector */}
              <div className="pt-2">
                <label className="block text-[11px] font-semibold text-[var(--text-muted)] mb-1.5 uppercase tracking-wider">
                  Target Google Workspace Account
                </label>
                <div className="p-3 rounded-xl bg-[var(--surface-subtle)] border border-[var(--border-default)] flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-full bg-[var(--primary-action)] flex items-center justify-center text-white text-xs font-bold">
                      {initials}
                    </div>
                    <div>
                      <div className="text-xs font-medium text-[var(--text-primary)]">{selectedAccount}</div>
                      <div className="text-[10px] text-[var(--text-muted)]">Google Workspace SSO</div>
                    </div>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--success-surface)] text-[var(--color-success)] border border-[var(--success-border)] font-medium">
                    Ready
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between gap-2.5 pt-4 border-t border-[var(--border-subtle)]">
          {isAlreadyConnected ? (
            <>
              <button
                onClick={handleDisconnect}
                className="px-3.5 py-2 text-xs font-medium text-[var(--color-error)] hover:bg-[var(--error-surface)] rounded-xl transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <Unlink className="w-3.5 h-3.5" />
                <span>Disconnect Calendar</span>
              </button>

              <button
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-[var(--text-primary)] bg-[var(--surface-subtle)] hover:bg-[var(--surface-card)] border border-[var(--border-default)] rounded-xl transition-colors cursor-pointer"
              >
                Done
              </button>
            </>
          ) : (
            <>
              <button
                onClick={onClose}
                disabled={isSubmitting}
                className="px-4 py-2 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-subtle)] rounded-xl transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] outline-none"
              >
                Cancel
              </button>

              <button
                onClick={handleAuthorize}
                disabled={isSubmitting}
                className="px-5 py-2.5 text-xs font-semibold text-white bg-[var(--primary-action)] hover:bg-[var(--primary-hover)] rounded-xl shadow-xs flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] outline-none"
              >
                {isSubmitting ? (
                  <span>Authorizing Calendar...</span>
                ) : (
                  <>
                    <span>Authorize Google Calendar</span>
                    <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                  </>
                )}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

import React, { useState, useEffect, useRef } from "react";
import {
  Bell,
  CheckCircle2,
  ShieldCheck,
  Radio,
  AlertTriangle,
  RefreshCw,
  X,
  ArrowRight,
  Sliders,
  Sparkles,
  Lock,
} from "lucide-react";

export type MeetingDetectionStateType =
  | "not_enabled"
  | "enabling"
  | "enabled"
  | "permission_denied"
  | "connection_failure"
  | "disabled";

interface MeetingDetectionSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentState: MeetingDetectionStateType;
  onEnable: () => Promise<boolean>;
  onDisable: () => void;
  onRetry: () => Promise<boolean>;
}

export const MeetingDetectionSetupModal: React.FC<MeetingDetectionSetupModalProps> = ({
  isOpen,
  onClose,
  currentState = "not_enabled",
  onEnable,
  onDisable,
  onRetry,
}) => {
  const [internalState, setInternalState] = useState<MeetingDetectionStateType>(currentState);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setInternalState(currentState);
  }, [currentState]);

  // Escape key & focus trapping for accessibility
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

  const handleEnableClick = async () => {
    setInternalState("enabling");
    setErrorMessage(null);
    try {
      const success = await onEnable();
      if (success) {
        setInternalState("enabled");
      } else {
        setInternalState("permission_denied");
      }
    } catch (err: any) {
      setInternalState("connection_failure");
      setErrorMessage(err?.message || "Failed to verify background detection daemon.");
    }
  };

  const handleRetryClick = async () => {
    setInternalState("enabling");
    setErrorMessage(null);
    try {
      const success = await onRetry();
      if (success) {
        setInternalState("enabled");
      } else {
        setInternalState("connection_failure");
      }
    } catch (err: any) {
      setInternalState("connection_failure");
      setErrorMessage(err?.message || "Failed to verify background detection daemon.");
    }
  };

  const handleDisableClick = () => {
    onDisable();
    setInternalState("disabled");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Accessible Scrim Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal Dialog Container */}
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="detection-modal-title"
        aria-describedby="detection-modal-desc"
        className="relative w-full max-w-lg rounded-3xl bg-[var(--surface-elevated)] border border-[var(--border-default)] p-6 sm:p-8 shadow-2xl text-[var(--text-primary)] z-10 animate-in fade-in zoom-in-95 duration-150 font-sans"
      >
        {/* Modal Header with Close */}
        <div className="flex items-start justify-between pb-4 border-b border-[var(--border-subtle)]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[var(--primary-surface)] border border-[var(--primary-border)] flex items-center justify-center text-[var(--primary-action)] shrink-0">
              <Bell className="w-5 h-5" aria-hidden="true" />
            </div>
            <div>
              <h3 id="detection-modal-title" className="text-base font-semibold text-[var(--text-primary)] tracking-tight">
                Meeting Detection Setup
              </h3>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">
                Automated Google Meet alerts & 1-click recording cues
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close meeting detection dialog"
            className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-subtle)] rounded-lg transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] outline-none"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        {/* ------------------------------------------------------------- */}
        {/* STATE 1: NOT ENABLED (Default Setup Pitch)                    */}
        {/* ------------------------------------------------------------- */}
        {internalState === "not_enabled" && (
          <div className="my-5 space-y-4 text-left">
            <div className="p-4 rounded-2xl bg-[var(--surface-subtle)] border border-[var(--border-default)] space-y-2">
              <p id="detection-modal-desc" className="text-xs text-[var(--text-secondary)] leading-relaxed">
                NoteFlow AI checks your connected calendar for upcoming meetings so you can decide which meetings to record.
              </p>
            </div>

            {/* Privacy & Safeguard Callouts */}
            <div className="space-y-2.5 text-xs">
              <div className="flex items-start gap-2.5 text-[var(--text-secondary)]">
                <CheckCircle2 className="w-4 h-4 text-[var(--color-success)] shrink-0 mt-0.5" aria-hidden="true" />
                <span>
                  <strong className="text-[var(--text-primary)]">Pre-Meeting Notification:</strong> Receive a quiet 5-minute cue before scheduled Google Meet calls start.
                </span>
              </div>

              <div className="flex items-start gap-2.5 text-[var(--text-secondary)]">
                <ShieldCheck className="w-4 h-4 text-[var(--primary-action)] shrink-0 mt-0.5" aria-hidden="true" />
                <span>
                  <strong className="text-[var(--text-primary)]">Zero Automatic Recording:</strong> NoteFlow never records automatically. You maintain explicit 1-click opt-in control for every call.
                </span>
              </div>

              <div className="flex items-start gap-2.5 text-[var(--text-secondary)]">
                <Sliders className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" aria-hidden="true" />
                <span>
                  <strong className="text-[var(--text-primary)]">Customizable Anytime:</strong> You can pause or adjust this setting later from your workspace Settings.
                </span>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-[var(--border-subtle)]">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-subtle)] rounded-xl transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] outline-none"
              >
                Not now
              </button>

              <button
                type="button"
                onClick={handleEnableClick}
                className="px-5 py-2.5 text-xs font-semibold text-white bg-[var(--primary-action)] hover:bg-[var(--primary-hover)] active:scale-[0.98] rounded-xl shadow-xs flex items-center gap-2 transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] outline-none"
              >
                <span>Enable meeting detection</span>
                <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* STATE 2: ENABLING (In-Flight Loading State)                    */}
        {/* ------------------------------------------------------------- */}
        {internalState === "enabling" && (
          <div className="my-8 text-center space-y-4" aria-live="polite" aria-busy="true">
            <div className="w-12 h-12 rounded-2xl bg-[var(--primary-surface)] border border-[var(--primary-border)] flex items-center justify-center text-[var(--primary-action)] mx-auto">
              <RefreshCw className="w-6 h-6 animate-spin text-[var(--primary-action)]" aria-hidden="true" />
            </div>
            <div className="space-y-1">
              <h4 className="text-sm font-semibold text-[var(--text-primary)]">
                Enabling meeting detection...
              </h4>
              <p className="text-xs text-[var(--text-muted)] max-w-xs mx-auto">
                Verifying calendar sync daemon and setting up pre-call notification cues.
              </p>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* STATE 3: ENABLED (Success Active State)                       */}
        {/* ------------------------------------------------------------- */}
        {internalState === "enabled" && (
          <div className="my-5 space-y-4 text-left" aria-live="polite">
            <div className="p-4 rounded-2xl bg-[var(--success-surface)] border border-[var(--success-border)] flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-emerald-500 text-white flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
              </div>
              <div>
                <h4 className="text-xs font-semibold text-[var(--color-success)]">
                  Meeting Detection Active
                </h4>
                <p className="text-[11px] text-[var(--text-secondary)] mt-0.5">
                  NoteFlow AI is monitoring your calendar and will cue 1-click recording 5 minutes before scheduled calls.
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-[var(--surface-subtle)] border border-[var(--border-default)] space-y-2 text-xs text-[var(--text-secondary)]">
              <div className="flex items-center justify-between font-mono text-[11px]">
                <span className="text-[var(--text-muted)] uppercase">Status</span>
                <span className="text-[var(--color-success)] font-semibold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-success)]"></span>
                  Active & Polling
                </span>
              </div>
              <div className="flex items-center justify-between font-mono text-[11px]">
                <span className="text-[var(--text-muted)] uppercase">Policy</span>
                <span className="text-[var(--text-primary)]">Per-Meeting Opt-In</span>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-between gap-2.5 pt-4 border-t border-[var(--border-subtle)]">
              <button
                type="button"
                onClick={handleDisableClick}
                className="px-3.5 py-2 text-xs font-medium text-[var(--color-error)] hover:bg-[var(--error-surface)] rounded-xl transition-colors cursor-pointer"
              >
                Disable Detection
              </button>

              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2 text-xs font-semibold text-white bg-[var(--primary-action)] hover:bg-[var(--primary-hover)] rounded-xl shadow-xs transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] outline-none"
              >
                Done
              </button>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* STATE 4: PERMISSION DENIED (OS/Browser Blocked)               */}
        {/* ------------------------------------------------------------- */}
        {internalState === "permission_denied" && (
          <div className="my-5 space-y-4 text-left" role="alert">
            <div className="p-4 rounded-2xl bg-[var(--warning-surface)] border border-[var(--warning-border)] space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-[var(--color-warning)]">
                <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>Notification Permission Denied</span>
              </div>
              <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                Browser or system notifications were not allowed. NoteFlow AI can still detect upcoming Google Meet calls in the feed, but pre-meeting desktop alerts will be muted.
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-[var(--surface-subtle)] border border-[var(--border-default)] text-xs text-[var(--text-secondary)] space-y-1.5">
              <div className="font-semibold text-[var(--text-primary)]">How to enable desktop alerts:</div>
              <p className="text-[11px] text-[var(--text-muted)]">
                Click the lock icon in your browser's address bar or macOS System Settings → Notifications → NoteFlow AI, then allow notifications.
              </p>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-between gap-2.5 pt-4 border-t border-[var(--border-subtle)]">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-subtle)] rounded-xl transition-colors cursor-pointer"
              >
                Continue Muted
              </button>

              <button
                type="button"
                onClick={handleRetryClick}
                className="px-5 py-2.5 text-xs font-semibold text-white bg-[var(--primary-action)] hover:bg-[var(--primary-hover)] rounded-xl shadow-xs flex items-center gap-2 transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] outline-none"
              >
                <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Retry Permission</span>
              </button>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* STATE 5: CONNECTION FAILURE (Daemon / Backend Error)          */}
        {/* ------------------------------------------------------------- */}
        {internalState === "connection_failure" && (
          <div className="my-5 space-y-4 text-left" role="alert">
            <div className="p-4 rounded-2xl bg-[var(--error-surface)] border border-[var(--error-border)] space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-[var(--color-error)]">
                <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>Meeting Detection Connection Failed</span>
              </div>
              <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                {errorMessage || "Unable to establish communication with the meeting detection daemon. Please verify your connection."}
              </p>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-between gap-2.5 pt-4 border-t border-[var(--border-subtle)]">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-subtle)] rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleRetryClick}
                className="px-5 py-2.5 text-xs font-semibold text-white bg-[var(--primary-action)] hover:bg-[var(--primary-hover)] rounded-xl shadow-xs flex items-center gap-2 transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] outline-none"
              >
                <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Retry Connection</span>
              </button>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* STATE 6: DISABLED (Manually Turned Off in Settings)           */}
        {/* ------------------------------------------------------------- */}
        {internalState === "disabled" && (
          <div className="my-5 space-y-4 text-left">
            <div className="p-4 rounded-2xl bg-[var(--surface-subtle)] border border-[var(--border-default)] space-y-1.5">
              <h4 className="text-xs font-semibold text-[var(--text-primary)]">
                Meeting Detection is Disabled
              </h4>
              <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                NoteFlow AI is not monitoring your calendar. Scheduled Google Meet calls will not receive automated recording cues.
              </p>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-between gap-2.5 pt-4 border-t border-[var(--border-subtle)]">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-subtle)] rounded-xl transition-colors cursor-pointer"
              >
                Close
              </button>

              <button
                type="button"
                onClick={handleEnableClick}
                className="px-5 py-2.5 text-xs font-semibold text-white bg-[var(--primary-action)] hover:bg-[var(--primary-hover)] rounded-xl shadow-xs flex items-center gap-2 transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] outline-none"
              >
                <span>Enable meeting detection</span>
                <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

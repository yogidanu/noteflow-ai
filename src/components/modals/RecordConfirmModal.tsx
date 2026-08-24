import React, { useEffect, useRef } from "react";
import { Radio, Users, MessageSquare, Check, X, Clock } from "lucide-react";
import { DetectedMeeting } from "../../types/meeting";

interface RecordConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  meeting: DetectedMeeting | null;
}

export const RecordConfirmModal: React.FC<RecordConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  meeting,
}) => {
  const modalRef = useRef<HTMLDivElement>(null);

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

  if (!isOpen || !meeting) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Scrim */}
      <div
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal Card */}
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="record-confirm-title"
        className="relative w-full max-w-lg rounded-3xl bg-[var(--surface-elevated)] border border-[var(--border-default)] p-6 sm:p-8 shadow-2xl text-[var(--text-primary)] z-10 animate-in fade-in zoom-in-95 duration-150"
      >
        {/* Header */}
        <div className="flex items-start justify-between pb-4 border-b border-[var(--border-subtle)]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[var(--success-surface)] border border-[var(--success-border)] flex items-center justify-center text-[var(--color-success)]">
              <Radio className="w-5 h-5 animate-pulse" aria-hidden="true" />
            </div>
            <div>
              <h3 id="record-confirm-title" className="text-base font-semibold text-[var(--text-primary)] tracking-tight">
                Enable Recording for this Meeting
              </h3>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">
                Explicit opt-in required for automated meeting ingress
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close recording confirmation dialog"
            className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-subtle)] rounded-lg transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] outline-none"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        {/* Meeting Details Summary */}
        <div className="my-5 p-4 rounded-2xl bg-[var(--surface-subtle)] border border-[var(--border-default)] space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-[var(--text-primary)] truncate max-w-[280px]">
              {meeting.title}
            </span>
            <span className="px-2 py-0.5 rounded-full bg-[var(--primary-surface)] text-[var(--primary-action)] font-mono text-[11px] font-medium border border-[var(--primary-border)]">
              {meeting.startTime} – {meeting.endTime}
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
            <span>Organizer: <strong className="font-medium text-[var(--text-primary)]">{meeting.organizerName}</strong></span>
            <span>•</span>
            <span>{meeting.attendees.length} Attendees</span>
          </div>
        </div>

        {/* Consent & Presence Guarantees */}
        <div className="space-y-3 mb-6 text-xs">
          <div className="p-3 rounded-xl bg-[var(--primary-surface)] border border-[var(--primary-border)] flex items-start gap-3 text-[var(--text-secondary)]">
            <Clock className="w-4 h-4 text-[var(--primary-action)] shrink-0 mt-0.5" aria-hidden="true" />
            <div>
              <strong className="text-[var(--text-primary)] block mb-0.5">Automated Dispatch Timing</strong>
              NoteFlow Assistant will knock on Google Meet 60 seconds before start time and wait for host admission.
            </div>
          </div>

          <div className="p-3 rounded-xl bg-[var(--success-surface)] border border-[var(--success-border)] flex items-start gap-3 text-[var(--text-secondary)]">
            <Users className="w-4 h-4 text-[var(--color-success)] shrink-0 mt-0.5" aria-hidden="true" />
            <div>
              <strong className="text-[var(--text-primary)] block mb-0.5">Visible Bot Identity (Zero Covert Ingress)</strong>
              The assistant joins with display name: <code className="px-1.5 py-0.5 rounded bg-[var(--surface-card)] text-[var(--color-success)] border border-[var(--success-border)] font-mono text-[11px]">NoteFlow Assistant (Recording)</code>.
            </div>
          </div>

          <div className="p-3 rounded-xl bg-[var(--warning-surface)] border border-[var(--warning-border)] flex items-start gap-3 text-[var(--text-secondary)]">
            <MessageSquare className="w-4 h-4 text-[var(--color-warning)] shrink-0 mt-0.5" aria-hidden="true" />
            <div>
              <strong className="text-[var(--text-primary)] block mb-0.5">In-Meeting Chat Notice</strong>
              Upon admission, the bot posts an automatic disclaimer in chat with a link to data and opt-out policies.
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-[var(--border-subtle)]">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-subtle)] rounded-xl transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] outline-none"
          >
            Cancel
          </button>

          <button
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className="px-5 py-2.5 text-xs font-semibold text-white bg-[var(--color-success)] hover:opacity-90 rounded-xl shadow-xs flex items-center gap-2 transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] outline-none"
          >
            <Check className="w-4 h-4" aria-hidden="true" />
            <span>Confirm & Schedule Recording</span>
          </button>
        </div>
      </div>
    </div>
  );
};

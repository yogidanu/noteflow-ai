import React, { useEffect, useRef } from "react";
import { Square, Sparkles, X, Clock, Users, ArrowRight } from "lucide-react";
import { DetectedMeeting } from "../../types/meeting";

interface StopConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  meeting: DetectedMeeting | null;
  durationSeconds: number;
}

export const StopConfirmModal: React.FC<StopConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  meeting,
  durationSeconds,
}) => {
  const modalRef = useRef<HTMLDivElement>(null);

  const formatTime = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

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
        aria-labelledby="stop-confirm-title"
        className="relative w-full max-w-lg rounded-3xl bg-[var(--surface-elevated)] border border-[var(--border-default)] p-6 sm:p-8 shadow-2xl text-[var(--text-primary)] z-10 animate-in fade-in zoom-in-95 duration-150"
      >
        {/* Header */}
        <div className="flex items-start justify-between pb-4 border-b border-[var(--border-subtle)]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[var(--error-surface)] border border-[var(--error-border)] flex items-center justify-center text-[var(--color-error)]">
              <Square className="w-4 h-4 fill-current" aria-hidden="true" />
            </div>
            <div>
              <h3 id="stop-confirm-title" className="text-base font-semibold text-[var(--text-primary)] tracking-tight">
                Stop Recording & Synthesize?
              </h3>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">
                NoteFlow Assistant will leave the meeting and generate structured notes
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close dialog and keep recording"
            className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-subtle)] rounded-lg transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] outline-none"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        {/* Meeting Session Summary */}
        <div className="my-5 p-4 rounded-2xl bg-[var(--surface-subtle)] border border-[var(--border-default)] space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-[var(--text-primary)] truncate max-w-[280px]">
              {meeting.title}
            </span>
            <span className="px-2.5 py-0.5 rounded-full bg-[var(--success-surface)] text-[var(--color-success)] border border-[var(--success-border)] font-mono text-[11px] font-semibold flex items-center gap-1.5">
              <Clock className="w-3 h-3" />
              <span>{formatTime(durationSeconds)} Recorded</span>
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
            <span>Organizer: <strong className="font-medium text-[var(--text-primary)]">{meeting.organizerName}</strong></span>
            <span>•</span>
            <span className="flex items-center gap-1">
              <Users className="w-3.5 h-3.5 text-[var(--text-subtle)]" />
              <span>{meeting.attendees.length} Attendees</span>
            </span>
          </div>
        </div>

        {/* What Happens Next Explainer */}
        <div className="space-y-2.5 mb-6 text-xs text-[var(--text-secondary)]">
          <div className="p-3.5 rounded-xl bg-[var(--primary-surface)] border border-[var(--primary-border)] flex items-start gap-3">
            <Sparkles className="w-4 h-4 text-[var(--primary-action)] shrink-0 mt-0.5" aria-hidden="true" />
            <div>
              <strong className="text-[var(--text-primary)] block mb-0.5">Automated AI Synthesis Pipeline</strong>
              The audio stream will be diarized by speaker and processed into an Executive Summary, Key Decisions, Action Items, and Open Questions.
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-[var(--border-subtle)]">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-subtle)] rounded-xl transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] outline-none"
          >
            Keep Recording
          </button>

          <button
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className="px-5 py-2.5 text-xs font-semibold text-white bg-[var(--color-error)] hover:opacity-90 rounded-xl shadow-xs flex items-center gap-2 transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] outline-none"
          >
            <Square className="w-3 h-3 fill-current" />
            <span>Stop & Generate Summary</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};

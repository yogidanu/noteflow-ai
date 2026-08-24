import React from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface ErrorCardProps {
  errorMessage: string;
  onRetry: () => void;
}

export const ErrorCard: React.FC<ErrorCardProps> = ({
  errorMessage,
  onRetry,
}) => {
  return (
    <div className="rounded-2xl border border-[var(--error-border)] bg-[var(--error-surface)] p-5 shadow-xs space-y-3.5 transition-colors duration-150">
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-xl bg-[var(--error-surface)] text-[var(--color-error)] shrink-0 border border-[var(--error-border)]">
          <AlertTriangle className="w-5 h-5" />
        </div>
        <div className="space-y-0.5">
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">Synthesis Interrupted</h3>
          <p className="text-xs text-[var(--color-error)] leading-relaxed">{errorMessage}</p>
        </div>
      </div>

      <div className="p-3 bg-[var(--surface-card)] rounded-xl text-xs text-[var(--text-secondary)] border border-[var(--border-default)] shadow-2xs">
        <p className="font-medium text-[var(--text-primary)]">Your notes are safely preserved.</p>
        <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
          You can edit your notes above or try running the AI synthesis again.
        </p>
      </div>

      <div className="flex items-center gap-2 pt-1">
        <button
          onClick={onRetry}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--color-error)] hover:opacity-90 text-white text-xs font-semibold transition-all shadow-xs cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Retry Generation</span>
        </button>
      </div>
    </div>
  );
};

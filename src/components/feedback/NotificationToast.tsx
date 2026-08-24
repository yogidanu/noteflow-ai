import React, { useEffect } from "react";
import { Sparkles, AlertTriangle, X, ArrowRight, RefreshCw } from "lucide-react";
import { ToastNotificationPayload } from "../../lib/meetSummaryBridge";

interface NotificationToastProps {
  toast: ToastNotificationPayload | null;
  onDismiss: () => void;
  onActionClick?: (meetingId?: string) => void;
  onRetry?: (meetingId?: string) => void;
}

export const NotificationToast: React.FC<NotificationToastProps> = ({
  toast,
  onDismiss,
  onActionClick,
  onRetry,
}) => {
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => {
        onDismiss();
      }, 7000);
      return () => clearTimeout(timer);
    }
  }, [toast, onDismiss]);

  if (!toast) return null;

  const isSuccess = toast.type === "success";

  return (
    <div
      role={isSuccess ? "status" : "alert"}
      aria-live={isSuccess ? "polite" : "assertive"}
      className="fixed top-18 right-6 z-50 max-w-md w-[calc(100vw-3rem)] sm:w-auto animate-in slide-in-from-top-4 fade-in duration-150"
    >
      <div
        className={`p-4 rounded-2xl backdrop-blur-md border shadow-xl text-[var(--text-primary)] flex items-start gap-3.5 ${
          isSuccess
            ? "bg-[var(--surface-elevated)] border-[var(--border-default)]"
            : "bg-[var(--surface-elevated)] border-[var(--error-border)]"
        }`}
      >
        {/* Icon */}
        <div
          className={`p-2 rounded-xl shrink-0 ${
            isSuccess
              ? "bg-[var(--primary-surface)] text-[var(--primary-action)] border border-[var(--primary-border)]"
              : "bg-[var(--error-surface)] text-[var(--color-error)] border border-[var(--error-border)]"
          }`}
        >
          {isSuccess ? <Sparkles className="w-4 h-4" aria-hidden="true" /> : <AlertTriangle className="w-4 h-4" aria-hidden="true" />}
        </div>

        {/* Content */}
        <div className="flex-1 space-y-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <h4 className="text-xs font-semibold text-[var(--text-primary)] truncate">{toast.title}</h4>
            <span className="text-[10px] text-[var(--text-subtle)] font-mono">Just now</span>
          </div>

          <p className="text-xs text-[var(--text-secondary)] leading-relaxed">{toast.message}</p>

          {/* Badges for Decisions & Actions on Success */}
          {isSuccess && (toast.decisionCount !== undefined || toast.actionCount !== undefined) && (
            <div className="flex items-center gap-1.5 pt-1">
              {toast.decisionCount !== undefined && (
                <span className="px-2 py-0.5 rounded-md bg-[var(--primary-surface)] text-[var(--primary-action)] border border-[var(--primary-border)] text-[10px] font-medium">
                  {toast.decisionCount} Decisions
                </span>
              )}
              {toast.actionCount !== undefined && (
                <span className="px-2 py-0.5 rounded-md bg-[var(--success-surface)] text-[var(--color-success)] border border-[var(--success-border)] text-[10px] font-medium">
                  {toast.actionCount} Actions
                </span>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="pt-2 flex items-center gap-2">
            {isSuccess && onActionClick && (
              <button
                onClick={() => {
                  onActionClick(toast.meetingId);
                  onDismiss();
                }}
                className="px-3 py-1.5 rounded-lg bg-[var(--primary-action)] hover:bg-[var(--primary-hover)] text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
              >
                <span>Review Summary</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            )}

            {!isSuccess && onRetry && (
              <button
                onClick={() => {
                  onRetry(toast.meetingId);
                  onDismiss();
                }}
                className="px-3 py-1.5 rounded-lg bg-[var(--color-error)] hover:opacity-90 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Retry Processing</span>
              </button>
            )}
          </div>
        </div>

        {/* Close Button */}
        <button
          onClick={onDismiss}
          aria-label="Dismiss notification"
          className="p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-subtle)] rounded-lg transition-colors shrink-0 cursor-pointer"
        >
          <X className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
};

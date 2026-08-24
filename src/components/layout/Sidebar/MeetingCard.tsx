import React from "react";
import { MeetingNote } from "../../../types/meeting";
import { formatDate, cn } from "../../../lib/utils";
import { 
  FileText, 
  Sparkles, 
  Trash2, 
  Clock 
} from "lucide-react";

interface MeetingCardProps {
  meeting: MeetingNote;
  isActive: boolean;
  onSelect: () => void;
  onDelete: (e: React.MouseEvent) => void;
}

export const MeetingCard: React.FC<MeetingCardProps> = ({
  meeting,
  isActive,
  onSelect,
  onDelete,
}) => {
  const hasAnalysis = meeting.status === "completed" && !!meeting.analysis;
  const decisionsCount = meeting.analysis?.decisions.length || 0;
  const actionsCount = meeting.analysis?.actionItems.length || 0;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
      className={cn(
        "group relative flex flex-col p-3 rounded-xl cursor-pointer transition-all duration-150 border text-left focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] outline-none",
        isActive
          ? "bg-[var(--surface-card)] border-[var(--border-default)] border-l-[3px] border-l-[var(--primary-action)] text-[var(--text-primary)] shadow-xs"
          : "bg-[var(--surface-card)] hover:bg-[var(--surface-subtle)] border-[var(--border-default)] text-[var(--text-secondary)] shadow-2xs"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {hasAnalysis ? (
            <div className="w-5 h-5 rounded-md flex items-center justify-center bg-[var(--primary-surface)] text-[var(--primary-action)] shrink-0">
              <Sparkles className="w-3 h-3" />
            </div>
          ) : (
            <div className="w-5 h-5 rounded-md flex items-center justify-center bg-[var(--surface-subtle)] text-[var(--text-muted)] shrink-0">
              <FileText className="w-3 h-3" />
            </div>
          )}
          <h4 className={cn(
            "text-xs truncate",
            isActive ? "font-semibold text-[var(--text-primary)]" : "font-medium text-[var(--text-secondary)] group-hover:text-[var(--text-primary)]"
          )}>
            {meeting.title || "Untitled Meeting"}
          </h4>
        </div>

        <button
          onClick={onDelete}
          className="opacity-0 group-hover:opacity-100 p-1 text-[var(--text-muted)] hover:text-[var(--color-error)] hover:bg-[var(--error-surface)] rounded transition-all shrink-0 cursor-pointer focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] outline-none"
          title="Delete meeting"
          aria-label={`Delete meeting: ${meeting.title || "Untitled Meeting"}`}
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="flex items-center justify-between mt-2 pt-2 border-t border-[var(--border-subtle)] text-[11px] text-[var(--text-muted)]">
        <span className="flex items-center gap-1 font-normal">
          <Clock className="w-3 h-3 text-[var(--text-subtle)]" />
          {formatDate(meeting.createdAt)}
        </span>

        {hasAnalysis ? (
          <div className="flex items-center gap-1 font-mono text-[10px]">
            {decisionsCount > 0 && (
              <span className="px-1.5 py-0.5 rounded bg-[var(--success-surface)] text-[var(--color-success)] border border-[var(--success-border)] font-medium">
                🎯 {decisionsCount}
              </span>
            )}
            {actionsCount > 0 && (
              <span className="px-1.5 py-0.5 rounded bg-[var(--primary-surface)] text-[var(--primary-action)] border border-[var(--primary-border)] font-medium">
                ✅ {actionsCount}
              </span>
            )}
          </div>
        ) : (
          <span className="px-1.5 py-0.5 rounded bg-[var(--surface-subtle)] text-[var(--text-muted)] text-[10px] font-medium border border-[var(--border-subtle)]">
            Draft
          </span>
        )}
      </div>
    </div>
  );
};

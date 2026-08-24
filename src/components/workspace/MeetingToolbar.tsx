import React, { useState, useEffect } from "react";
import { MeetingNote } from "../../types/meeting";
import { 
  Calendar, 
  Share2, 
  Copy, 
  Check, 
  Clock, 
  Layers,
  Edit2
} from "lucide-react";
import { formatForSlack, copyToClipboard } from "../../lib/exportFormatters";

interface MeetingToolbarProps {
  meeting: MeetingNote;
  onUpdateTitle: (newTitle: string) => void;
  onOpenExport: () => void;
  onToggleSourceDrawer: () => void;
  isSourceDrawerOpen: boolean;
  hasOutput: boolean;
}

export const MeetingToolbar: React.FC<MeetingToolbarProps> = ({
  meeting,
  onUpdateTitle,
  onOpenExport,
  onToggleSourceDrawer,
  isSourceDrawerOpen,
  hasOutput,
}) => {
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState(meeting.title);
  const [copiedSlack, setCopiedSlack] = useState(false);

  useEffect(() => {
    setTitleValue(meeting.title);
  }, [meeting.title]);

  const handleTitleSubmit = () => {
    setIsEditingTitle(false);
    if (titleValue.trim()) {
      onUpdateTitle(titleValue.trim());
    } else {
      setTitleValue(meeting.title);
    }
  };

  const handleQuickCopySlack = async () => {
    if (!meeting.analysis) return;
    const slackText = formatForSlack(meeting);
    const success = await copyToClipboard(slackText);
    if (success) {
      setCopiedSlack(true);
      setTimeout(() => setCopiedSlack(false), 2000);
    }
  };

  return (
    <div className="border-b border-[var(--border-default)] bg-[var(--surface-card)] px-6 py-3.5 flex flex-wrap items-center justify-between gap-4 shrink-0 select-none transition-colors duration-150">
      {/* Title & Date Metadata */}
      <div className="flex flex-col gap-0.5 min-w-0 max-w-xl">
        <div className="flex items-center gap-2">
          {isEditingTitle ? (
            <input
              type="text"
              value={titleValue}
              onChange={(e) => setTitleValue(e.target.value)}
              onBlur={handleTitleSubmit}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleTitleSubmit();
                if (e.key === "Escape") {
                  setTitleValue(meeting.title);
                  setIsEditingTitle(false);
                }
              }}
              autoFocus
              className="bg-[var(--surface-card)] border border-[var(--border-focus)] focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] rounded-lg px-2 py-0.5 text-base font-semibold text-[var(--text-primary)] outline-none w-full shadow-xs"
            />
          ) : (
            <div 
              onClick={() => setIsEditingTitle(true)}
              className="group flex items-center gap-2 cursor-pointer hover:bg-[var(--surface-subtle)] px-1.5 py-0.5 -ml-1.5 rounded-lg transition-colors"
            >
              <h1 className="text-base font-semibold text-[var(--text-primary)] tracking-tight truncate">
                {meeting.title || "Untitled Meeting"}
              </h1>
              <Edit2 className="w-3.5 h-3.5 text-[var(--text-muted)] opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          )}
        </div>

        <div className="flex items-center gap-3 text-xs text-[var(--text-muted)]">
          <span className="flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-[var(--text-subtle)]" />
            {new Date(meeting.createdAt).toLocaleDateString([], {
              weekday: "short",
              month: "short",
              day: "numeric",
              year: "numeric"
            })}
          </span>

          {meeting.analysis && (
            <>
              <span>•</span>
              <span className="flex items-center gap-1 font-mono text-[11px] text-[var(--text-muted)]">
                <Clock className="w-3 h-3 text-[var(--text-subtle)]" />
                ~{meeting.analysis.estimatedMeetingDurationMinutes} min read ({meeting.analysis.wordCount} words)
              </span>
            </>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-2">
        {/* Toggle Raw Source Drawer */}
        {hasOutput && (
          <button
            onClick={onToggleSourceDrawer}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] outline-none ${
              isSourceDrawerOpen
                ? "bg-[var(--primary-surface)] border-[var(--primary-border)] text-[var(--primary-action)] font-semibold"
                : "bg-[var(--surface-card)] hover:bg-[var(--surface-subtle)] border-[var(--border-default)] text-[var(--text-secondary)] shadow-2xs"
            }`}
            title="Inspect source transcript and grounded quotes"
          >
            <Layers className="w-3.5 h-3.5 text-[var(--primary-action)]" />
            <span>{isSourceDrawerOpen ? "Hide Source" : "View Source"}</span>
          </button>
        )}

        {/* 1-Click Slack Copy */}
        {hasOutput && (
          <button
            onClick={handleQuickCopySlack}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] outline-none ${
              copiedSlack
                ? "bg-[var(--success-surface)] border-[var(--success-border)] text-[var(--color-success)] font-semibold"
                : "bg-[var(--surface-card)] hover:bg-[var(--surface-subtle)] border-[var(--border-default)] text-[var(--text-secondary)] shadow-2xs"
            }`}
            title="Copy structured summary directly formatted for Slack"
          >
            {copiedSlack ? <Check className="w-3.5 h-3.5 text-[var(--color-success)]" /> : <Copy className="w-3.5 h-3.5 text-[var(--text-muted)]" />}
            <span>{copiedSlack ? "Copied Slack Format!" : "Copy for Slack"}</span>
          </button>
        )}

        {/* Export / Share Modal Trigger */}
        {hasOutput && (
          <button
            onClick={onOpenExport}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[var(--primary-action)] hover:bg-[var(--primary-hover)] text-white text-xs font-semibold shadow-xs transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] outline-none"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>Export & Share</span>
          </button>
        )}
      </div>
    </div>
  );
};

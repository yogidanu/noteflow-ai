import React, { useState } from "react";
import { FileText, Edit2, Check, Copy } from "lucide-react";
import { copyToClipboard } from "../../../lib/exportFormatters";

interface ExecutiveSummaryProps {
  summary: string;
  onUpdate: (newSummary: string) => void;
}

export const ExecutiveSummary: React.FC<ExecutiveSummaryProps> = ({
  summary,
  onUpdate,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [textValue, setTextValue] = useState(summary);
  const [copied, setCopied] = useState(false);

  React.useEffect(() => {
    setTextValue(summary);
  }, [summary]);

  const handleSave = () => {
    setIsEditing(false);
    onUpdate(textValue);
  };

  const handleCopy = async () => {
    const success = await copyToClipboard(summary);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="rounded-2xl border border-[var(--border-default)] border-l-[3px] border-l-[var(--primary-action)] bg-[var(--surface-card)] p-6 space-y-3.5 shadow-xs transition-all hover:border-[var(--border-focus)]">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-6 h-6 rounded-lg bg-[var(--primary-surface)] text-[var(--primary-action)] flex items-center justify-center">
            <FileText className="w-3.5 h-3.5" />
          </div>
          <h3 className="text-sm font-semibold text-[var(--text-primary)] tracking-tight">Executive Summary</h3>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={handleCopy}
            className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-subtle)] rounded-lg transition-colors text-xs flex items-center gap-1 cursor-pointer focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] outline-none"
            title="Copy summary"
            aria-label="Copy executive summary"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-[var(--color-success)]" /> : <Copy className="w-3.5 h-3.5" />}
          </button>

          {isEditing ? (
            <button
              onClick={handleSave}
              className="px-3 py-1 rounded-lg bg-[var(--primary-action)] hover:bg-[var(--primary-hover)] text-white text-xs font-semibold transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] outline-none"
            >
              Done
            </button>
          ) : (
            <button
              onClick={() => setIsEditing(true)}
              className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-subtle)] rounded-lg transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] outline-none"
              title="Edit summary"
              aria-label="Edit executive summary"
            >
              <Edit2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {isEditing ? (
        <textarea
          value={textValue}
          onChange={(e) => setTextValue(e.target.value)}
          rows={6}
          className="w-full bg-[var(--surface-subtle)] border border-[var(--border-focus)] rounded-xl p-3.5 text-sm text-[var(--text-primary)] outline-none leading-[1.7] font-sans shadow-2xs focus-visible:ring-2 focus-visible:ring-[var(--border-focus)]"
        />
      ) : (
        <div className="text-[13.5px] text-[var(--text-secondary)] leading-[1.7] font-normal whitespace-pre-line space-y-2">
          {summary}
        </div>
      )}
    </div>
  );
};

import React from "react";
import { X, Layers, Copy, Check } from "lucide-react";
import { copyToClipboard } from "../../../lib/exportFormatters";

interface SourceDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  rawInput: string;
  sanitizedInput?: string;
  activeCitationLine?: string | null;
}

export const SourceDrawer: React.FC<SourceDrawerProps> = ({
  isOpen,
  onClose,
  rawInput,
  sanitizedInput,
  activeCitationLine,
}) => {
  const [copied, setCopied] = React.useState(false);
  const [viewMode, setViewMode] = React.useState<"clean" | "raw">("clean");

  if (!isOpen) return null;

  const displayText = viewMode === "clean" && sanitizedInput ? sanitizedInput : rawInput;
  const lines = displayText.split("\n");

  const handleCopy = async () => {
    const success = await copyToClipboard(displayText);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div
      role="region"
      aria-label="Source transcript viewer"
      className="border border-[var(--border-default)] rounded-2xl bg-[var(--surface-card)] overflow-hidden flex flex-col mb-6 shadow-md transition-all duration-150"
    >
      <div className="px-4 py-2.5 bg-[var(--surface-subtle)] border-b border-[var(--border-subtle)] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-[var(--primary-action)]" aria-hidden="true" />
          <span className="text-xs font-semibold text-[var(--text-primary)]">Source Transcript & Grounding</span>
          
          <div className="flex bg-[var(--surface-card)] p-0.5 rounded-lg ml-3 text-[10px] border border-[var(--border-default)]" role="tablist" aria-label="Transcript view mode">
            <button
              role="tab"
              aria-selected={viewMode === "clean"}
              onClick={() => setViewMode("clean")}
              className={`px-2 py-0.5 rounded font-medium cursor-pointer transition-colors ${
                viewMode === "clean" ? "bg-[var(--primary-surface)] text-[var(--primary-action)] shadow-2xs font-semibold" : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              }`}
            >
              Sanitized
            </button>
            <button
              role="tab"
              aria-selected={viewMode === "raw"}
              onClick={() => setViewMode("raw")}
              className={`px-2 py-0.5 rounded font-medium cursor-pointer transition-colors ${
                viewMode === "raw" ? "bg-[var(--primary-surface)] text-[var(--primary-action)] shadow-2xs font-semibold" : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              }`}
            >
              Raw Input
            </button>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={handleCopy}
            aria-label="Copy transcript text to clipboard"
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[var(--surface-card)] hover:bg-[var(--surface-subtle)] text-[var(--text-secondary)] text-[11px] font-medium border border-[var(--border-default)] transition-colors cursor-pointer shadow-2xs"
          >
            {copied ? <Check className="w-3 h-3 text-[var(--color-success)]" aria-hidden="true" /> : <Copy className="w-3 h-3 text-[var(--text-muted)]" aria-hidden="true" />}
            <span>{copied ? "Copied" : "Copy Source"}</span>
          </button>
          <button
            onClick={onClose}
            aria-label="Close source transcript drawer"
            className="p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] rounded-lg hover:bg-[var(--surface-subtle)] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="p-4 max-h-72 overflow-y-auto font-mono text-xs text-[var(--text-primary)] space-y-1 leading-relaxed bg-[var(--surface-card)]">
        {lines.map((line, idx) => {
          const isHighlighted = activeCitationLine && line.toLowerCase().includes(activeCitationLine.toLowerCase());
          return (
            <div
              key={idx}
              className={`px-2 py-1 rounded-lg transition-colors ${
                isHighlighted
                  ? "bg-amber-100 dark:bg-amber-950/60 text-amber-950 dark:text-amber-200 border border-amber-300 dark:border-amber-700 font-medium"
                  : "hover:bg-[var(--surface-subtle)]"
              }`}
            >
              <span className="text-[var(--text-subtle)] select-none mr-3 inline-block w-6 text-right font-mono text-[11px]">
                {idx + 1}
              </span>
              {line}
            </div>
          );
        })}
      </div>
    </div>
  );
};

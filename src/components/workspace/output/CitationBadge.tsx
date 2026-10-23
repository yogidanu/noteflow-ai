import React, { useState } from "react";
import { SourceCitation } from "../../../types/meeting";
import { Quote } from "lucide-react";

interface CitationBadgeProps {
  citation?: SourceCitation;
  onClickQuote?: (citation: SourceCitation) => void;
}

export const CitationBadge: React.FC<CitationBadgeProps> = ({
  citation,
  onClickQuote,
}) => {
  const [showTooltip, setShowTooltip] = useState(false);

  if (!citation) return null;

  // Anchor rendering: time-anchored citations show their real timestamp.
  // Line-anchored citations (authored text / manual notes, which have no
  // time domain) show the speaker and source line instead — never a
  // fabricated "00:00". Click-to-source is unaffected: inspection is
  // driven by rawText/lineIndex, which line-anchored citations carry.
  const isLineAnchored =
    citation.anchorKind === "line" ||
    (!citation.timestamp && typeof citation.lineIndex === "number");
  const lineLabel =
    typeof citation.lineIndex === "number" ? `Line ${citation.lineIndex + 1}` : "Source line";
  const anchorLabel = isLineAnchored
    ? citation.speaker
      ? `${citation.speaker} · ${lineLabel}`
      : lineLabel
    : citation.timestamp || (citation.speaker ? `@${citation.speaker}` : "Source");

  return (
    <div className="relative inline-block ml-1.5 align-middle">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onClickQuote?.(citation);
        }}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        onFocus={() => setShowTooltip(true)}
        onBlur={() => setShowTooltip(false)}
        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-[var(--primary-surface)] hover:opacity-80 text-[var(--primary-action)] border border-[var(--primary-border)] text-[10px] font-mono font-medium transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] outline-none"
        title="Click to view source quote in transcript"
        aria-label={`Source citation: ${citation.rawText}`}
      >
        <Quote className="w-2.5 h-2.5 text-[var(--primary-action)]" />
        <span>{anchorLabel}</span>
      </button>

      {/* Floating Grounding Context Tooltip */}
      {showTooltip && (
        <div className="absolute left-0 bottom-full mb-2 w-64 p-3 rounded-xl bg-[var(--surface-elevated)] border border-[var(--border-default)] text-[11px] text-[var(--text-primary)] shadow-xl z-50 pointer-events-none animate-fadeIn">
          <div className="flex items-center justify-between text-[var(--primary-action)] font-semibold mb-1 font-mono text-[10px]">
            <span>{citation.speaker ? `${citation.speaker}` : "Verified Grounding"}</span>
            {isLineAnchored ? (
              <span className="text-[var(--text-muted)] font-normal">{lineLabel}</span>
            ) : (
              citation.timestamp && <span className="text-[var(--text-muted)] font-normal">⏱️ {citation.timestamp}</span>
            )}
          </div>
          <p className="text-[var(--text-secondary)] italic">"{citation.rawText}"</p>
          <div className="mt-1.5 pt-1 border-t border-[var(--border-subtle)] text-[9px] text-[var(--text-subtle)]">
            Click badge to inspect in Source view
          </div>
        </div>
      )}
    </div>
  );
};

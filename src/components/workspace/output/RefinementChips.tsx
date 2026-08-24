import React from "react";
import { RefinementPromptType } from "../../../types/meeting";
import { Sparkles, Scissors, Cpu, Briefcase, RefreshCw } from "lucide-react";

interface RefinementChipsProps {
  currentRefinement?: string;
  onSelectRefinement: (type: RefinementPromptType) => void;
  isGenerating: boolean;
}

export const RefinementChips: React.FC<RefinementChipsProps> = ({
  currentRefinement,
  onSelectRefinement,
  isGenerating,
}) => {
  const chips: Array<{ type: RefinementPromptType; label: string; icon: any }> = [
    { type: "standard", label: "Standard Synthesis", icon: RefreshCw },
    { type: "shorter", label: "Make Shorter", icon: Scissors },
    { type: "technical", label: "Technical Focus", icon: Cpu },
    { type: "executive", label: "Executive Brief", icon: Briefcase },
  ];

  return (
    <div className="flex flex-wrap items-center gap-2 p-3 bg-[var(--surface-card)] border border-[var(--border-default)] rounded-2xl text-xs shadow-2xs transition-colors duration-150">
      <span className="flex items-center gap-1.5 text-[var(--text-muted)] font-medium mr-1 text-[11px]">
        <Sparkles className="w-3.5 h-3.5 text-[var(--primary-action)]" />
        <span>Refine Output:</span>
      </span>

      <div className="flex flex-wrap gap-1.5">
        {chips.map(({ type, label, icon: Icon }) => {
          const isActive = currentRefinement === type || (!currentRefinement && type === "standard");
          return (
            <button
              key={type}
              onClick={() => onSelectRefinement(type)}
              disabled={isGenerating}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition-all focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] outline-none ${
                isActive
                  ? "bg-[var(--primary-surface)] text-[var(--primary-action)] border-[var(--primary-border)] shadow-2xs font-semibold"
                  : "bg-[var(--surface-card)] hover:bg-[var(--surface-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border-[var(--border-default)]"
              } ${isGenerating ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
            >
              <Icon className="w-3 h-3 text-[var(--primary-action)]" />
              <span>{label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

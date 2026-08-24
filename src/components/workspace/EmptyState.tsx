import React from "react";
import { Sparkles, FileText, CheckCircle2, HelpCircle, Zap, Shield, Users, Plus } from "lucide-react";
import { SAMPLE_1ON1_REORG_TRANSCRIPT, SAMPLE_ZOOM_TRANSCRIPT } from "../../lib/sampleData";

interface EmptyStateProps {
  onLoadSample: (sampleText: string, title: string) => void;
  onStartBlank: () => void;
  isDemoMode?: boolean;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  onLoadSample,
  onStartBlank,
  isDemoMode = false,
}) => {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 max-w-3xl mx-auto text-center select-none animate-fadeIn">
      <div className="w-12 h-12 rounded-2xl bg-[var(--primary-surface)] border border-[var(--primary-border)] flex items-center justify-center text-[var(--primary-action)] shadow-xs mb-5">
        <Sparkles className="w-6 h-6" />
      </div>

      <h2 className="text-2xl sm:text-3xl font-bold text-[var(--text-primary)] tracking-tight">
        Synthesize Meetings with Context & Precision
      </h2>
      <p className="text-[var(--text-secondary)] text-sm mt-2 max-w-lg leading-relaxed">
        Turn complex transcripts into grounded summaries, decisions, action items, and open questions without hallucinations or artificial filler.
      </p>

      {/* Feature Pills */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 my-8 w-full max-w-xl text-left">
        <div className="p-4 rounded-2xl bg-[var(--surface-card)] border border-[var(--border-default)] shadow-2xs flex items-start gap-3 transition-all hover:border-[var(--border-focus)]">
          <div className="p-1.5 rounded-xl bg-[var(--success-surface)] text-[var(--color-success)] mt-0.5">
            <CheckCircle2 className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-semibold text-[var(--text-primary)]">Key Decisions</h4>
            <p className="text-[11px] text-[var(--text-muted)] mt-0.5 leading-snug">Extracted with rationale & citations</p>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-[var(--surface-card)] border border-[var(--border-default)] shadow-2xs flex items-start gap-3 transition-all hover:border-[var(--border-focus)]">
          <div className="p-1.5 rounded-xl bg-[var(--primary-surface)] text-[var(--primary-action)] mt-0.5">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-semibold text-[var(--text-primary)]">Action Items</h4>
            <p className="text-[11px] text-[var(--text-muted)] mt-0.5 leading-snug">Real assignees & realistic timelines</p>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-[var(--surface-card)] border border-[var(--border-default)] shadow-2xs flex items-start gap-3 transition-all hover:border-[var(--border-focus)]">
          <div className="p-1.5 rounded-xl bg-[var(--warning-surface)] text-[var(--color-warning)] mt-0.5">
            <HelpCircle className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-semibold text-[var(--text-primary)]">Open Questions</h4>
            <p className="text-[11px] text-[var(--text-muted)] mt-0.5 leading-snug">Unresolved tensions & next steps</p>
          </div>
        </div>
      </div>

      {/* Primary Action Buttons */}
      <div className="flex flex-wrap items-center justify-center gap-2.5">
        <button
          onClick={onStartBlank}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--primary-action)] hover:bg-[var(--primary-hover)] text-white font-semibold text-xs shadow-xs transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] outline-none"
        >
          <Plus className="w-4 h-4" />
          <span>New Meeting Canvas</span>
        </button>

        {isDemoMode && (
          <>
            <button
              onClick={() => onLoadSample(SAMPLE_1ON1_REORG_TRANSCRIPT, "Organizational Reorg & Design/Marketing Pod Transition Sync")}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--surface-card)] hover:bg-[var(--surface-subtle)] text-[var(--text-secondary)] font-medium text-xs border border-[var(--border-default)] shadow-2xs transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] outline-none"
            >
              <Users className="w-4 h-4 text-[var(--primary-action)]" />
              <span>Sandbox: 1-on-1 Reorg</span>
            </button>

            <button
              onClick={() => onLoadSample(SAMPLE_ZOOM_TRANSCRIPT, "Q3 Architecture & Release Planning Sync")}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--surface-card)] hover:bg-[var(--surface-subtle)] text-[var(--text-secondary)] font-medium text-xs border border-[var(--border-default)] shadow-2xs transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] outline-none"
            >
              <Zap className="w-4 h-4 text-amber-500" />
              <span>Sandbox: Architecture RFC</span>
            </button>
          </>
        )}
      </div>

      <div className="mt-8 flex items-center gap-2 text-[11px] text-[var(--text-subtle)] font-mono">
        <Shield className="w-3.5 h-3.5 text-[var(--text-subtle)]" />
        <span>100% Client-Side Processing • No Artificial Filler When Sections Are Empty</span>
      </div>
    </div>
  );
};

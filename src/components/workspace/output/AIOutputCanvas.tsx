import React from "react";
import { MeetingNote, AIAnalysisResult, RefinementPromptType, SourceCitation } from "../../../types/meeting";
import { MeetingHeaderBanner } from "./MeetingHeaderBanner";
import { ExecutiveSummary } from "./ExecutiveSummary";
import { DiscussionPoints } from "./DiscussionPoints";
import { DecisionsLog } from "./DecisionsLog";
import { ActionItemsMatrix } from "./ActionItemsMatrix";
import { QuestionsParkingLot } from "./QuestionsParkingLot";
import { RefinementChips } from "./RefinementChips";
import { ShieldCheck, Sparkles, Layers } from "lucide-react";

interface AIOutputCanvasProps {
  meeting: MeetingNote;
  analysis: AIAnalysisResult;
  onUpdateAnalysis: (updated: Partial<AIAnalysisResult>) => void;
  onRefinePrompt: (type: RefinementPromptType) => void;
  isGenerating: boolean;
  onInspectCitation?: (citation: SourceCitation) => void;
  onToggleSourceDrawer?: () => void;
  isSourceDrawerOpen?: boolean;
}

export const AIOutputCanvas: React.FC<AIOutputCanvasProps> = ({
  meeting,
  analysis,
  onUpdateAnalysis,
  onRefinePrompt,
  isGenerating,
  onInspectCitation,
  onToggleSourceDrawer,
  isSourceDrawerOpen = false,
}) => {
  return (
    <div className="space-y-6 animate-fadeIn">
      {/* ───────────────────────────────────────────────────────────── */}
      {/* LEVEL 1: HUMAN MEETING CONTEXT & METADATA                      */}
      {/* ───────────────────────────────────────────────────────────── */}
      <MeetingHeaderBanner
        meeting={meeting}
        onToggleSourceDrawer={onToggleSourceDrawer || (() => {})}
        isSourceDrawerOpen={isSourceDrawerOpen}
      />

      {/* ───────────────────────────────────────────────────────────── */}
      {/* LEVEL 2: AI-GENERATED INSIGHTS & SYNTHESIS CANVAS              */}
      {/* ───────────────────────────────────────────────────────────── */}
      <div className="space-y-4 pt-2">
        {/* Section Header with Refinement Controls */}
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-md bg-[var(--primary-surface)] border border-[var(--primary-border)] flex items-center justify-center text-[var(--primary-action)]">
              <Sparkles className="w-3 h-3" />
            </div>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              AI-Generated Insights & Synthesis
            </h2>
          </div>
          <span className="text-[11px] text-[var(--text-subtle)] font-mono">100% Grounded in Transcript</span>
        </div>

        {/* Refinement Persona Selector Chips */}
        <RefinementChips
          currentRefinement={analysis.appliedRefinement}
          onSelectRefinement={onRefinePrompt}
          isGenerating={isGenerating}
        />

        {/* 1. Executive Summary */}
        <ExecutiveSummary
          summary={analysis.executiveSummary}
          onUpdate={(newSummary) => onUpdateAnalysis({ executiveSummary: newSummary })}
        />

        {/* 2. Important Discussion Points & Agenda Topics */}
        <DiscussionPoints
          points={analysis.importantDiscussionPoints}
          onUpdatePoints={(updated) => onUpdateAnalysis({ importantDiscussionPoints: updated })}
          onInspectCitation={onInspectCitation}
        />

        {/* 3. Key Decisions */}
        <DecisionsLog
          decisions={analysis.decisions}
          onUpdateDecisions={(updated) => onUpdateAnalysis({ decisions: updated })}
          onInspectCitation={onInspectCitation}
        />

        {/* 4. Action Items Matrix */}
        <ActionItemsMatrix
          actionItems={analysis.actionItems}
          onUpdateActions={(updated) => onUpdateAnalysis({ actionItems: updated })}
          onInspectCitation={onInspectCitation}
        />

        {/* 5. Unresolved Questions & Parking Lot */}
        <QuestionsParkingLot
          questions={analysis.unresolvedQuestions}
          onUpdateQuestions={(updated) => onUpdateAnalysis({ unresolvedQuestions: updated })}
          onInspectCitation={onInspectCitation}
        />

        {/* 6. Transcript Access & Grounding Guarantee Strip */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-2xl bg-[var(--surface-card)] border border-[var(--border-default)] text-xs shadow-2xs transition-colors duration-150">
          <div className="flex items-center gap-2 text-[var(--color-success)] font-medium font-mono text-[11px]">
            <ShieldCheck className="w-4 h-4 text-[var(--color-success)] shrink-0" />
            <span>Extracted with Source Grounding • High Accuracy</span>
          </div>

          <button
            onClick={onToggleSourceDrawer}
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-[var(--surface-subtle)] hover:opacity-90 border border-[var(--border-default)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-xs font-medium transition-colors cursor-pointer"
          >
            <Layers className="w-3.5 h-3.5 text-[var(--primary-action)]" />
            <span>Open Verbatim Transcript Drawer</span>
          </button>
        </div>
      </div>
    </div>
  );
};

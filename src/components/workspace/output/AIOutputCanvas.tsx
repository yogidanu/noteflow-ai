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
import { GenerativeSummarizer } from "../../../lib/llmSummarizer";

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
  // Grounding labels are derived from the actual analysis, never static:
  // the share of emitted citations that resolve to their source decides
  // what the header may claim, and the summarizer's computed
  // modelConfidence decides the accuracy wording in the footer.
  // Resolution is anchor-aware (GenerativeSummarizer.isCitationGrounded):
  // time-anchored citations resolve by real timestamp, line-anchored
  // citations (manual notes — no time domain) resolve by source line, so
  // a fully line-grounded manual note reads "100% Grounded in Source
  // Lines", not "0% Grounded" merely for lacking timestamps.
  const allCitations = [
    ...analysis.decisions.map((d) => d.citation),
    ...analysis.actionItems.map((a) => a.citation),
    ...analysis.unresolvedQuestions.map((q) => q.citation),
    ...(analysis.importantDiscussionPoints || []).map((p) => p.citation),
  ].filter(Boolean) as SourceCitation[];
  const groundedCount = allCitations.filter((c) =>
    GenerativeSummarizer.isCitationGrounded(c)
  ).length;
  const groundedShare =
    allCitations.length > 0 ? groundedCount / allCitations.length : 0;
  const allLineAnchored =
    allCitations.length > 0 &&
    allCitations.every(
      (c) => c.anchorKind === "line" || (!c.timestamp && typeof c.lineIndex === "number")
    );
  const groundingNoun = allLineAnchored ? "Source Lines" : "Transcript";
  const groundingLabel =
    allCitations.length === 0
      ? "No citations available"
      : groundedShare >= 1
        ? `100% Grounded in ${groundingNoun}`
        : `${Math.round(groundedShare * 100)}% Grounded in ${groundingNoun}`;
  const accuracyLabel =
    analysis.modelConfidence === "high"
      ? "Extracted with Source Grounding • High Accuracy"
      : analysis.modelConfidence === "moderate"
        ? "Extracted with Source Grounding • Moderate Accuracy — Check Citations"
        : "Extracted with Source Grounding • Low Accuracy — Verify Against Transcript";

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
          <span className="text-[11px] text-[var(--text-subtle)] font-mono">{groundingLabel}</span>
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
            <span>{accuracyLabel}</span>
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

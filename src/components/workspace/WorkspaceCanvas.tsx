import React, { useState } from "react";
import {
  MeetingNote,
  RefinementPromptType,
  CalendarConnectionState,
  DetectedMeeting,
  AIAnalysisResult,
  SourceCitation,
} from "../../types/meeting";
import { MeetingToolbar } from "./MeetingToolbar";
import { SourceDrawer } from "./input/SourceDrawer";
import { UnifiedDropzone } from "./input/UnifiedDropzone";
import { ProgressiveLoader } from "./feedback/ProgressiveLoader";
import { ErrorCard } from "./feedback/ErrorCard";
import { AIOutputCanvas } from "./output/AIOutputCanvas";
import { EmptyState } from "./EmptyState";
import { ExportModal } from "../modals/ExportModal";
import { GenerationStage } from "../../hooks/useAISummarizer";
import { MeetRecordFeed } from "./meet/MeetRecordFeed";
import { FileEdit, Sparkles } from "lucide-react";

interface WorkspaceCanvasProps {
  activeMeeting: MeetingNote | null;
  onUpdateMeeting: (id: string, updates: Partial<MeetingNote>) => void;
  onGenerateSummary: (meeting: MeetingNote, refinement?: RefinementPromptType) => void;
  isGenerating: boolean;
  generationStage: GenerationStage;
  generationProgress: number;
  errorMessage: string | null;
  onLoadSample: (sampleText: string, title: string) => void;
  onStartBlank: () => void;
  isDemoMode?: boolean;
  // Meet Record Extensions
  viewMode: "feed" | "workspace";
  calendarState: CalendarConnectionState;
  detectedMeetings: DetectedMeeting[];
  isSyncingCalendar: boolean;
  isDetectionEnabled?: boolean;
  onOpenDetectionModal?: () => void;
  onSyncCalendar: () => void;
  onOpenOAuthModal: () => void;
  onToggleMeetingRecording: (id: string, enabled: boolean) => void;
  onStartLiveRecording: (id: string) => void;
  onQuickJoinUrl: (url: string) => void;
  onRetryMeeting: (id: string) => void;
  onOpenConfirmModal: (meeting: DetectedMeeting) => void;
  onSwitchToWorkspace: () => void;
}

export const WorkspaceCanvas: React.FC<WorkspaceCanvasProps> = ({
  activeMeeting,
  onUpdateMeeting,
  onGenerateSummary,
  isGenerating,
  generationStage,
  generationProgress,
  errorMessage,
  onLoadSample,
  onStartBlank,
  isDemoMode = false,
  viewMode,
  calendarState,
  detectedMeetings,
  isSyncingCalendar,
  isDetectionEnabled = false,
  onOpenDetectionModal,
  onSyncCalendar,
  onOpenOAuthModal,
  onToggleMeetingRecording,
  onStartLiveRecording,
  onQuickJoinUrl,
  onRetryMeeting,
  onOpenConfirmModal,
  onSwitchToWorkspace,
}) => {
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isSourceDrawerOpen, setIsSourceDrawerOpen] = useState(false);
  const [activeCitationLine, setActiveCitationLine] = useState<string | null>(null);
  const [showRawEditor, setShowRawEditor] = useState(false);

  const hasOutput = !!(
    activeMeeting?.analysis?.executiveSummary ||
    (activeMeeting?.analysis?.decisions && activeMeeting.analysis.decisions.length > 0)
  );

  const handleInspectCitation = (citation: SourceCitation) => {
    setActiveCitationLine(citation?.rawText || null);
    setIsSourceDrawerOpen(true);
  };

  const handleRefine = (type: RefinementPromptType) => {
    if (activeMeeting) {
      onGenerateSummary(activeMeeting, type);
    }
  };

  return (
    <main className="flex-1 flex flex-col bg-[var(--bg-canvas)] overflow-hidden relative transition-colors duration-150">
      {/* 1. If in Meet Record Feed View */}
      {viewMode === "feed" ? (
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <div className="max-w-4xl mx-auto">
            <MeetRecordFeed
              calendarState={calendarState}
              detectedMeetings={detectedMeetings}
              isSyncing={isSyncingCalendar}
              isDetectionEnabled={isDetectionEnabled}
              onOpenDetectionModal={onOpenDetectionModal}
              onSyncCalendar={onSyncCalendar}
              onOpenOAuthModal={onOpenOAuthModal}
              onToggleRecording={onToggleMeetingRecording}
              onStartLiveRecording={onStartLiveRecording}
              onQuickJoinUrl={onQuickJoinUrl}
              onRetryMeeting={onRetryMeeting}
              onOpenConfirmModal={onOpenConfirmModal}
              onSelectCompletedMeeting={() => {
                onSwitchToWorkspace();
              }}
            />
          </div>
        </div>
      ) : !activeMeeting ? (
        /* 2. Blank / Zero Meeting Empty State */
        <div className="flex-1 flex flex-col bg-[var(--bg-canvas)] overflow-y-auto">
          <EmptyState onLoadSample={onLoadSample} onStartBlank={onStartBlank} isDemoMode={isDemoMode} />
        </div>
      ) : (
        /* 3. Active Meeting Workspace Canvas (Loading, Summary, Error, Draft) */
        <>
          <MeetingToolbar
            meeting={activeMeeting}
            onUpdateTitle={(title: string) => onUpdateMeeting(activeMeeting.id, { title })}
            onOpenExport={() => setIsExportModalOpen(true)}
            onToggleSourceDrawer={() => setIsSourceDrawerOpen(!isSourceDrawerOpen)}
            isSourceDrawerOpen={isSourceDrawerOpen}
            hasOutput={hasOutput}
          />

          <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
            <div className="max-w-4xl mx-auto space-y-6">
              {/* Grounded Source Drawer */}
              <SourceDrawer
                isOpen={isSourceDrawerOpen}
                onClose={() => setIsSourceDrawerOpen(false)}
                rawInput={activeMeeting.rawInput}
                sanitizedInput={activeMeeting.sanitizedInput}
                activeCitationLine={activeCitationLine}
              />

              {/* A. Progressive AI Synthesis Loader */}
              {isGenerating && (
                <ProgressiveLoader
                  stage={generationStage}
                  progress={generationProgress}
                />
              )}

              {/* B. Inline Error Card */}
              {activeMeeting.status === "error" && (
                <ErrorCard
                  errorMessage={errorMessage || activeMeeting.errorMessage || "An unexpected error occurred during synthesis."}
                  onRetry={() => onGenerateSummary(activeMeeting)}
                />
              )}

              {/* C. Completed Structured Output Canvas */}
              {hasOutput && !isGenerating && (
                <div className="space-y-6">
                  {/* Collapsed Raw Notes editor toggle */}
                  <div className="flex items-center justify-between px-1">
                    <button
                      onClick={() => setShowRawEditor(!showRawEditor)}
                      className="text-xs text-slate-500 hover:text-slate-900 flex items-center gap-1.5 transition-colors cursor-pointer font-medium"
                    >
                      <FileEdit className="w-3.5 h-3.5 text-slate-400" />
                      <span>{showRawEditor ? "Hide Raw Notes Editor" : "Edit Original Notes / Re-run AI"}</span>
                    </button>
                  </div>

                  {showRawEditor && (
                    <UnifiedDropzone
                      rawInput={activeMeeting.rawInput}
                      onInputChange={(val: string) => onUpdateMeeting(activeMeeting.id, { rawInput: val })}
                      onGenerate={() => onGenerateSummary(activeMeeting)}
                      isGenerating={isGenerating}
                      onLoadSample={onLoadSample}
                    />
                  )}

                  <AIOutputCanvas
                    meeting={activeMeeting}
                    analysis={activeMeeting.analysis!}
                    onUpdateAnalysis={(updated: Partial<AIAnalysisResult>) => {
                      if (activeMeeting.analysis) {
                        onUpdateMeeting(activeMeeting.id, {
                          analysis: { ...activeMeeting.analysis, ...updated },
                        });
                      }
                    }}
                    onRefinePrompt={handleRefine}
                    isGenerating={isGenerating}
                    onInspectCitation={handleInspectCitation}
                  />
                </div>
              )}

              {/* D. Fresh Draft State (Prompt for initial notes) */}
              {!hasOutput && !isGenerating && activeMeeting.status !== "error" && (
                <div className="space-y-4">
                  <div className="p-4 rounded-2xl bg-indigo-50/60 border border-indigo-100 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-xl bg-indigo-100 text-indigo-600">
                        <Sparkles className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-xs font-semibold text-slate-900">Ready to Synthesize Notes</h4>
                        <p className="text-[11px] text-slate-500">Paste notes below, drop a transcript file, or record directly via Google Meet.</p>
                      </div>
                    </div>
                  </div>

                  <UnifiedDropzone
                    rawInput={activeMeeting.rawInput}
                    onInputChange={(val: string) => onUpdateMeeting(activeMeeting.id, { rawInput: val })}
                    onGenerate={() => onGenerateSummary(activeMeeting)}
                    isGenerating={isGenerating}
                    onLoadSample={onLoadSample}
                  />
                </div>
              )}
            </div>
          </div>

          <ExportModal
            isOpen={isExportModalOpen}
            onClose={() => setIsExportModalOpen(false)}
            meeting={activeMeeting}
          />
        </>
      )}
    </main>
  );
};

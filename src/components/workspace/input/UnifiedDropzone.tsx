import React, { useState, useRef, useCallback } from "react";
import { 
  UploadCloud, 
  Sparkles, 
  Trash2, 
  FileCheck2, 
  AlertCircle
} from "lucide-react";
import { SAMPLE_1ON1_REORG_TRANSCRIPT, SAMPLE_ZOOM_TRANSCRIPT, SAMPLE_BULLET_NOTES } from "../../../lib/sampleData";
import { sanitizeTranscript } from "../../../lib/transcriptSanitizer";

interface UnifiedDropzoneProps {
  rawInput: string;
  onInputChange: (val: string) => void;
  onGenerate: () => void;
  isGenerating: boolean;
  onLoadSample: (sampleText: string, title: string) => void;
}

export const UnifiedDropzone: React.FC<UnifiedDropzoneProps> = ({
  rawInput,
  onInputChange,
  onGenerate,
  isGenerating,
  onLoadSample,
}) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const wordCount = rawInput.trim() ? rawInput.trim().split(/\s+/).length : 0;
  const isInputValid = wordCount >= 6;

  // Real-time format analysis
  const formatInfo = React.useMemo(() => {
    if (!rawInput.trim()) return null;
    return sanitizeTranscript(rawInput);
  }, [rawInput]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);

      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        const file = e.dataTransfer.files[0];
        const reader = new FileReader();
        reader.onload = (event) => {
          const content = event.target?.result as string;
          if (content) {
            onInputChange(content);
          }
        };
        reader.readAsText(file);
      }
    },
    [onInputChange]
  );

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target?.result as string;
        if (content) {
          onInputChange(content);
        }
      };
      reader.readAsText(file);
    }
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`relative flex flex-col rounded-2xl border transition-all duration-150 bg-[var(--surface-card)] overflow-hidden shadow-xs ${
        isDragOver
          ? "border-[var(--primary-action)] ring-4 ring-indigo-500/10 bg-[var(--primary-surface)]"
          : "border-[var(--border-default)] hover:border-[var(--border-focus)]"
      }`}
    >
      {/* Top Header & Metadata Badges */}
      <div className="px-5 py-2.5 border-b border-[var(--border-subtle)] bg-[var(--surface-subtle)] flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-[var(--text-primary)]">Raw Notes or Transcript</span>
          
          {formatInfo && formatInfo.format !== "raw" && (
            <span className="px-2 py-0.5 rounded-full bg-[var(--primary-surface)] text-[var(--primary-action)] border border-[var(--primary-border)] font-mono text-[11px] flex items-center gap-1 font-medium">
              <FileCheck2 className="w-3 h-3 text-[var(--primary-action)]" />
              {formatInfo.format === "vtt" && `Zoom VTT (${formatInfo.speakers.length} speakers)`}
              {formatInfo.format === "teams" && "Teams Transcript"}
              {formatInfo.format === "meet" && `Meet Notes (${formatInfo.speakers.length} speakers)`}
              {formatInfo.format === "bullets" && "Bullet Points"}
            </span>
          )}
        </div>

        {/* Sample Loaders */}
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] text-[var(--text-muted)] mr-1 hidden sm:inline">Try Sample:</span>
          <button
            type="button"
            onClick={() => onLoadSample(SAMPLE_1ON1_REORG_TRANSCRIPT, "Organizational Reorg & Design/Marketing Pod Transition Sync")}
            className="px-2 py-1 text-[11px] rounded-lg bg-[var(--primary-surface)] hover:opacity-90 text-[var(--primary-action)] border border-[var(--primary-border)] transition-colors font-medium cursor-pointer shadow-2xs focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] outline-none"
          >
            🎯 1-on-1 Reorg Pod Sync
          </button>
          <button
            type="button"
            onClick={() => onLoadSample(SAMPLE_ZOOM_TRANSCRIPT, "Q3 Architecture & Release Planning Sync")}
            className="px-2 py-1 text-[11px] rounded-lg bg-[var(--surface-card)] hover:bg-[var(--surface-subtle)] text-[var(--text-secondary)] border border-[var(--border-default)] transition-colors cursor-pointer shadow-2xs focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] outline-none"
          >
            ⚡ Zoom VTT
          </button>
          <button
            type="button"
            onClick={() => onLoadSample(SAMPLE_BULLET_NOTES, "Mobile App V2 Onboarding Review")}
            className="px-2 py-1 text-[11px] rounded-lg bg-[var(--surface-card)] hover:bg-[var(--surface-subtle)] text-[var(--text-secondary)] border border-[var(--border-default)] transition-colors cursor-pointer shadow-2xs focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] outline-none"
          >
            📝 Rough Bullets
          </button>

          {rawInput && (
            <button
              onClick={() => onInputChange("")}
              className="p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-subtle)] rounded transition-colors ml-1 cursor-pointer focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] outline-none"
              title="Clear text"
              aria-label="Clear notes text"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Main Textarea / Ingestion Canvas */}
      <div className="relative flex-1 min-h-[300px] p-5 bg-[var(--surface-card)]">
        <textarea
          ref={textareaRef}
          value={rawInput}
          onChange={(e) => onInputChange(e.target.value)}
          placeholder={`Paste raw meeting notes, shorthand bullet points, or drag-and-drop a transcript file (.vtt, .txt, .md, .docx)...

Example:
- Sarah: Decided to move launch to Sept 1st for SOC-2 audit.
- Marcus: I will update Jira ticket by Friday.
- Elena: Who is responsible for GDPR compliance?`}
          disabled={isGenerating}
          className="w-full h-full min-h-[260px] bg-transparent resize-y text-[var(--text-primary)] placeholder-[var(--text-subtle)] text-xs leading-relaxed outline-none font-mono focus-visible:ring-1 focus-visible:ring-[var(--border-focus)] rounded-lg p-1"
        />

        {/* Drag Overlay Hint */}
        {isDragOver && (
          <div className="absolute inset-0 bg-[var(--primary-surface)] backdrop-blur-xs border-2 border-dashed border-[var(--primary-action)] flex flex-col items-center justify-center text-center p-6 pointer-events-none">
            <UploadCloud className="w-12 h-12 text-[var(--primary-action)] animate-bounce mb-3" />
            <p className="text-base font-semibold text-[var(--text-primary)]">Drop your transcript file here</p>
            <p className="text-xs text-[var(--primary-action)] mt-1">Supports .vtt, .txt, .md, .srt</p>
          </div>
        )}
      </div>

      {/* Footer Controls & Generate Trigger */}
      <div className="px-5 py-3 bg-[var(--surface-subtle)] border-t border-[var(--border-subtle)] flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 text-xs text-[var(--text-muted)]">
          <label className="flex items-center gap-1.5 cursor-pointer text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors focus-within:ring-2 focus-within:ring-[var(--border-focus)] rounded-md px-1">
            <UploadCloud className="w-4 h-4 text-[var(--text-subtle)]" />
            <span className="font-medium">Upload File</span>
            <input
              type="file"
              accept=".vtt,.txt,.docx,.md,.srt"
              onChange={handleFileInputChange}
              className="hidden"
            />
          </label>
          <span>•</span>
          <span className="font-mono text-[11px] text-[var(--text-muted)]">
            {wordCount} {wordCount === 1 ? "word" : "words"}
          </span>
          {!isInputValid && rawInput.trim().length > 0 && (
            <span className="text-amber-600 dark:text-amber-400 font-medium text-[11px] flex items-center gap-1">
              <AlertCircle className="w-3 h-3 text-amber-500" /> Minimum 8–10 words
            </span>
          )}
        </div>

        <button
          onClick={onGenerate}
          disabled={!isInputValid || isGenerating}
          className={`flex items-center gap-2 px-5 py-2 rounded-xl font-semibold text-xs transition-all focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] outline-none ${
            isInputValid && !isGenerating
              ? "bg-[var(--primary-action)] hover:bg-[var(--primary-hover)] text-white shadow-xs cursor-pointer"
              : "bg-[var(--surface-subtle)] text-[var(--text-subtle)] cursor-not-allowed border border-[var(--border-default)]"
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>{isGenerating ? "Synthesizing Notes..." : "Generate AI Summary"}</span>
          <kbd className="hidden sm:inline-block ml-1 px-1.5 py-0.5 text-[9px] bg-white/20 rounded font-mono text-white">
            ⌘↵
          </kbd>
        </button>
      </div>
    </div>
  );
};

import React from "react";
import { Loader2, CheckCircle2 } from "lucide-react";
import { GenerationStage } from "../../../hooks/useAISummarizer";

interface ProgressiveLoaderProps {
  stage: GenerationStage;
  progress: number;
}

export const ProgressiveLoader: React.FC<ProgressiveLoaderProps> = ({
  stage,
  progress,
}) => {
  const steps = [
    { key: "sanitizing", label: "Sanitizing transcript & identifying speakers" },
    { key: "summarizing", label: "Synthesizing executive summary" },
    { key: "decisions", label: "Extracting key decisions & grounding quotes" },
    { key: "actions", label: "Assigning action items & due dates" },
    { key: "questions", label: "Cataloging unresolved questions" },
  ];

  const getStepStatus = (stepKey: string) => {
    const stageOrder = ["sanitizing", "summarizing", "decisions", "actions", "questions", "done"];
    const currentIndex = stageOrder.indexOf(stage);
    const stepIndex = stageOrder.indexOf(stepKey);

    if (currentIndex > stepIndex || stage === "done") return "completed";
    if (currentIndex === stepIndex) return "active";
    return "pending";
  };

  return (
    <div
      role="status"
      aria-busy="true"
      aria-live="polite"
      className="rounded-2xl border border-[var(--border-default)] bg-[var(--surface-card)] p-6 shadow-xs space-y-5 animate-fadeIn transition-colors duration-150"
    >
      {/* Top Banner & Progress Bar */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-[var(--primary-surface)] text-[var(--primary-action)] flex items-center justify-center animate-spin">
              <Loader2 className="w-4 h-4" aria-hidden="true" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-[var(--text-primary)]">AI Synthesis in Progress</h3>
              <p className="text-xs text-[var(--text-muted)]">Extracting structured signals from meeting text</p>
            </div>
          </div>

          <span className="font-mono text-xs font-semibold text-[var(--primary-action)]">
            {progress}%
          </span>
        </div>

        {/* Accessible Progress Bar */}
        <div
          role="progressbar"
          aria-valuenow={progress}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="AI summary synthesis progress"
          className="h-1.5 w-full bg-[var(--surface-subtle)] rounded-full overflow-hidden"
        >
          <div
            className="h-full bg-gradient-to-r from-indigo-500 via-indigo-600 to-emerald-500 transition-all duration-300 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Step Checklist */}
      <div className="space-y-2 pt-2 border-t border-[var(--border-subtle)]">
        {steps.map((step) => {
          const status = getStepStatus(step.key);
          return (
            <div
              key={step.key}
              className={`flex items-center gap-3 text-xs py-1 transition-all ${
                status === "completed"
                  ? "text-[var(--text-secondary)] font-normal"
                  : status === "active"
                  ? "text-[var(--primary-action)] font-semibold"
                  : "text-[var(--text-subtle)]"
              }`}
            >
              {status === "completed" ? (
                <CheckCircle2 className="w-4 h-4 text-[var(--color-success)] shrink-0" aria-hidden="true" />
              ) : status === "active" ? (
                <div className="w-4 h-4 rounded-full border-2 border-[var(--primary-action)] border-t-transparent animate-spin shrink-0" aria-hidden="true" />
              ) : (
                <div className="w-4 h-4 rounded-full border border-[var(--border-default)] shrink-0" aria-hidden="true" />
              )}
              <span>{step.label}</span>
            </div>
          );
        })}
      </div>

      {/* Skeleton Shimmer Preview */}
      <div className="space-y-2.5 pt-3 border-t border-[var(--border-subtle)]" aria-hidden="true">
        <div className="h-3.5 bg-[var(--surface-subtle)] rounded-md w-3/4 animate-pulse" />
        <div className="h-3.5 bg-[var(--surface-subtle)]/70 rounded-md w-full animate-pulse" />
        <div className="h-3.5 bg-[var(--surface-subtle)]/50 rounded-md w-5/6 animate-pulse" />
      </div>
    </div>
  );
};

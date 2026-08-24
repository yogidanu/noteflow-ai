import { useState, useCallback } from "react";
import { MeetingNote, RefinementPromptType } from "../types/meeting";
import { processMeetingWithAI } from "../lib/aiEngine";
import confetti from "canvas-confetti";

export type GenerationStage = "idle" | "sanitizing" | "summarizing" | "decisions" | "actions" | "questions" | "done" | "error";

export function useAISummarizer() {
  const [stage, setStage] = useState<GenerationStage>("idle");
  const [progress, setProgress] = useState<number>(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const generateSummary = useCallback(
    async (
      meeting: MeetingNote,
      refinement: RefinementPromptType = "standard",
      onSuccess?: (updated: Partial<MeetingNote>) => void
    ) => {
      if (!meeting.rawInput || meeting.rawInput.trim().length === 0) {
        setErrorMessage("Please enter or paste meeting notes before generating a summary.");
        setStage("error");
        return;
      }

      setErrorMessage(null);
      setStage("sanitizing");
      setProgress(10);

      try {
        const { title, analysis, sanitizedInput } = await processMeetingWithAI(
          meeting.rawInput,
          refinement,
          (stg, prg) => {
            setStage(stg as GenerationStage);
            setProgress(prg);
          }
        );

        setStage("done");
        setProgress(100);

        // Optional subtle confetti on success
        try {
          confetti({
            particleCount: 35,
            spread: 60,
            origin: { y: 0.8 },
            colors: ['#6366f1', '#10b981', '#3b82f6']
          });
        } catch {
          // ignore in testing environments
        }

        onSuccess?.({
          title: meeting.title.startsWith("Untitled Meeting") ? title : meeting.title,
          sanitizedInput,
          analysis,
          status: "completed",
          errorMessage: undefined,
        });
      } catch (err: any) {
        console.error("AI Generation Error", err);
        setStage("error");
        setErrorMessage(err?.message || "Failed to analyze notes. Please check connection and try again.");
        onSuccess?.({
          status: "error",
          errorMessage: err?.message || "Generation error"
        });
      }
    },
    []
  );

  const resetState = useCallback(() => {
    setStage("idle");
    setProgress(0);
    setErrorMessage(null);
  }, []);

  return {
    stage,
    progress,
    errorMessage,
    isGenerating: stage !== "idle" && stage !== "done" && stage !== "error",
    generateSummary,
    resetState,
  };
}

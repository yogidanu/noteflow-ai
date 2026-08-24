import React, { useState } from "react";
import { UnresolvedQuestion, SourceCitation } from "../../../types/meeting";
import { HelpCircle, Plus, Trash2, Edit2, ArrowRight } from "lucide-react";
import { CitationBadge } from "./CitationBadge";

interface QuestionsParkingLotProps {
  questions: UnresolvedQuestion[];
  onUpdateQuestions: (updated: UnresolvedQuestion[]) => void;
  onInspectCitation?: (citation: SourceCitation) => void;
}

export const QuestionsParkingLot: React.FC<QuestionsParkingLotProps> = ({
  questions,
  onUpdateQuestions,
  onInspectCitation,
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editQ, setEditQ] = useState("");
  const [editFollowUp, setEditFollowUp] = useState("");

  const handleStartEdit = (q: UnresolvedQuestion) => {
    setEditingId(q.id);
    setEditQ(q.question);
    setEditFollowUp(q.suggestedFollowUp || "");
  };

  const handleSaveEdit = (id: string) => {
    onUpdateQuestions(
      questions.map((q) =>
        q.id === id
          ? {
              ...q,
              question: editQ,
              suggestedFollowUp: editFollowUp || undefined,
              isEdited: true,
            }
          : q
      )
    );
    setEditingId(null);
  };

  const handleDelete = (id: string) => {
    onUpdateQuestions(questions.filter((q) => q.id !== id));
  };

  const handleAddQuestion = () => {
    const newQ: UnresolvedQuestion = {
      id: `q-${Date.now()}`,
      question: "New open question requiring clarification",
      suggestedFollowUp: "Tag team in async channel to resolve.",
      isEdited: true,
    };
    onUpdateQuestions([...questions, newQ]);
    handleStartEdit(newQ);
  };

  return (
    <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--surface-card)] p-5 space-y-4 shadow-xs transition-all hover:border-[var(--border-focus)]">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-[var(--warning-surface)] text-[var(--color-warning)] flex items-center justify-center">
            <HelpCircle className="w-3.5 h-3.5" />
          </div>
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">Unresolved Questions & Parking Lot</h3>
          <span className="px-2 py-0.5 rounded-full bg-[var(--warning-surface)] text-[var(--color-warning)] text-[11px] font-semibold border border-[var(--warning-border)] font-mono">
            {questions.length}
          </span>
        </div>

        <button
          onClick={handleAddQuestion}
          className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[var(--surface-subtle)] hover:opacity-90 text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-xs font-medium border border-[var(--border-default)] transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] outline-none"
        >
          <Plus className="w-3.5 h-3.5 text-[var(--text-muted)]" />
          <span>Add Question</span>
        </button>
      </div>

      {questions.length === 0 ? (
        <div className="p-4 rounded-xl bg-[var(--surface-subtle)] border border-dashed border-[var(--border-default)] text-center text-xs text-[var(--text-muted)]">
          No unresolved questions flagged in this session.
        </div>
      ) : (
        <div className="space-y-2">
          {questions.map((q) => {
            const isEditing = editingId === q.id;

            return (
              <div
                key={q.id}
                className="group relative p-3.5 rounded-xl bg-[var(--surface-subtle)] border border-[var(--border-subtle)] transition-all"
              >
                {isEditing ? (
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={editQ}
                      onChange={(e) => setEditQ(e.target.value)}
                      placeholder="Question..."
                      className="w-full bg-[var(--surface-card)] border border-[var(--border-focus)] focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] rounded-lg px-2.5 py-1 text-xs text-[var(--text-primary)] outline-none shadow-2xs"
                    />
                    <input
                      type="text"
                      value={editFollowUp}
                      onChange={(e) => setEditFollowUp(e.target.value)}
                      placeholder="Suggested next step..."
                      className="w-full bg-[var(--surface-card)] border border-[var(--border-default)] focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] rounded-lg px-2.5 py-1 text-xs text-[var(--text-secondary)] outline-none shadow-2xs"
                    />
                    <div className="flex justify-end gap-1.5 pt-1">
                      <button
                        onClick={() => setEditingId(null)}
                        className="px-2 py-1 text-[11px] text-[var(--text-muted)] hover:text-[var(--text-primary)] focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] outline-none rounded cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => handleSaveEdit(q.id)}
                        className="px-2.5 py-1 rounded-lg bg-[var(--primary-action)] hover:bg-[var(--primary-hover)] text-white text-[11px] font-semibold transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] outline-none"
                      >
                        Save
                      </button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-baseline flex-wrap gap-1">
                          <span className="text-xs font-semibold text-[var(--text-primary)]">
                            • {q.question}
                          </span>
                          <CitationBadge
                            citation={q.citation}
                            onClickQuote={onInspectCitation}
                          />
                        </div>

                        {q.suggestedFollowUp && (
                          <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-amber-700 dark:text-amber-400 font-medium">
                            <ArrowRight className="w-3 h-3 text-amber-500 shrink-0" />
                            <span>{q.suggestedFollowUp}</span>
                          </div>
                        )}
                      </div>

                      <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-opacity shrink-0">
                        <button
                          onClick={() => handleStartEdit(q)}
                          className="p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-card)] rounded transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] outline-none"
                          title="Edit question"
                          aria-label={`Edit question: ${q.question}`}
                        >
                          <Edit2 className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => handleDelete(q.id)}
                          className="p-1 text-[var(--text-muted)] hover:text-[var(--color-error)] hover:bg-[var(--error-surface)] rounded transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] outline-none"
                          title="Delete question"
                          aria-label={`Delete question: ${q.question}`}
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

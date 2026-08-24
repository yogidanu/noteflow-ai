import React, { useState } from "react";
import { DecisionItem, SourceCitation } from "../../../types/meeting";
import { CheckCircle2, Plus, Trash2, Edit2 } from "lucide-react";
import { CitationBadge } from "./CitationBadge";

interface DecisionsLogProps {
  decisions: DecisionItem[];
  onUpdateDecisions: (updated: DecisionItem[]) => void;
  onInspectCitation?: (citation: SourceCitation) => void;
}

export const DecisionsLog: React.FC<DecisionsLogProps> = ({
  decisions,
  onUpdateDecisions,
  onInspectCitation,
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [editRationale, setEditRationale] = useState("");

  const handleStartEdit = (d: DecisionItem) => {
    setEditingId(d.id);
    setEditText(d.text);
    setEditRationale(d.rationale || "");
  };

  const handleSaveEdit = (id: string) => {
    const updated = decisions.map((d) =>
      d.id === id
        ? { ...d, text: editText, rationale: editRationale || undefined, isEdited: true }
        : d
    );
    onUpdateDecisions(updated);
    setEditingId(null);
  };

  const handleDelete = (id: string) => {
    onUpdateDecisions(decisions.filter((d) => d.id !== id));
  };

  const handleAddDecision = () => {
    const newDec: DecisionItem = {
      id: `dec-${Date.now()}`,
      text: "New agreed team decision",
      rationale: "Rationale discussed in meeting",
      confidence: "high",
      isEdited: true,
    };
    onUpdateDecisions([...decisions, newDec]);
    handleStartEdit(newDec);
  };

  return (
    <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--surface-card)] p-5 space-y-4 shadow-xs transition-all hover:border-[var(--border-focus)]">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-[var(--success-surface)] text-[var(--color-success)] flex items-center justify-center">
            <CheckCircle2 className="w-3.5 h-3.5" />
          </div>
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">Key Decisions</h3>
          <span className="px-2 py-0.5 rounded-full bg-[var(--success-surface)] text-[var(--color-success)] text-[11px] font-semibold border border-[var(--success-border)] font-mono">
            {decisions.length}
          </span>
        </div>

        <button
          onClick={handleAddDecision}
          className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[var(--surface-subtle)] hover:opacity-90 text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-xs font-medium border border-[var(--border-default)] transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] outline-none"
        >
          <Plus className="w-3.5 h-3.5 text-[var(--text-muted)]" />
          <span>Add Decision</span>
        </button>
      </div>

      {decisions.length === 0 ? (
        <div className="p-4 rounded-xl bg-[var(--surface-subtle)] border border-dashed border-[var(--border-default)] text-center text-xs text-[var(--text-muted)]">
          No explicit decisions detected in this meeting notes.
        </div>
      ) : (
        <div className="space-y-2.5">
          {decisions.map((decision) => {
            const isEditing = editingId === decision.id;

            return (
              <div
                key={decision.id}
                className="group relative p-3.5 rounded-xl bg-[var(--surface-subtle)] border border-[var(--border-subtle)] transition-all"
              >
                {isEditing ? (
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      placeholder="Decision statement..."
                      className="w-full bg-[var(--surface-card)] border border-[var(--border-focus)] focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] rounded-lg px-2.5 py-1 text-xs text-[var(--text-primary)] outline-none shadow-2xs"
                    />
                    <input
                      type="text"
                      value={editRationale}
                      onChange={(e) => setEditRationale(e.target.value)}
                      placeholder="Rationale / Reason..."
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
                        onClick={() => handleSaveEdit(decision.id)}
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
                            • {decision.text}
                          </span>
                          <CitationBadge
                            citation={decision.citation}
                            onClickQuote={onInspectCitation}
                          />
                          {decision.isEdited && (
                            <span className="text-[10px] text-[var(--text-subtle)] font-mono italic">
                              (edited)
                            </span>
                          )}
                        </div>

                        {decision.rationale && (
                          <div className="mt-1.5 pl-3 border-l-2 border-[var(--color-success)] text-[11px] text-[var(--text-secondary)]">
                            <span className="text-[var(--color-success)] font-medium">Rationale:</span>{" "}
                            {decision.rationale}
                          </div>
                        )}
                      </div>

                      <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-opacity shrink-0">
                        <button
                          onClick={() => handleStartEdit(decision)}
                          className="p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-card)] rounded transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] outline-none"
                          title="Edit decision"
                          aria-label={`Edit decision: ${decision.text}`}
                        >
                          <Edit2 className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => handleDelete(decision.id)}
                          className="p-1 text-[var(--text-muted)] hover:text-[var(--color-error)] hover:bg-[var(--error-surface)] rounded transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] outline-none"
                          title="Delete decision"
                          aria-label={`Delete decision: ${decision.text}`}
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

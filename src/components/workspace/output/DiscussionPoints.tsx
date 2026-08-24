import React, { useState } from "react";
import { DiscussionPoint, SourceCitation } from "../../../types/meeting";
import { MessageSquareText, Plus, Trash2, Edit2, User } from "lucide-react";
import { CitationBadge } from "./CitationBadge";

interface DiscussionPointsProps {
  points?: DiscussionPoint[];
  onUpdatePoints: (updated: DiscussionPoint[]) => void;
  onInspectCitation?: (citation: SourceCitation) => void;
}

export const DiscussionPoints: React.FC<DiscussionPointsProps> = ({
  points = [],
  onUpdatePoints,
  onInspectCitation,
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTopic, setEditTopic] = useState("");
  const [editSummary, setEditSummary] = useState("");

  const handleStartEdit = (point: DiscussionPoint) => {
    setEditingId(point.id);
    setEditTopic(point.topic);
    setEditSummary(point.summary);
  };

  const handleSaveEdit = (id: string) => {
    const updated = points.map((p) =>
      p.id === id
        ? {
            ...p,
            topic: editTopic,
            summary: editSummary,
            isEdited: true,
          }
        : p
    );
    onUpdatePoints(updated);
    setEditingId(null);
  };

  const handleDelete = (id: string) => {
    onUpdatePoints(points.filter((p) => p.id !== id));
  };

  const handleAddPoint = () => {
    const newPoint: DiscussionPoint = {
      id: `disc-${Date.now()}`,
      topic: "New Discussion Topic",
      summary: "Summary of dialogue and perspectives exchanged during meeting.",
      isEdited: true,
    };
    onUpdatePoints([...points, newPoint]);
    handleStartEdit(newPoint);
  };

  if (!points || points.length === 0) {
    return null;
  }

  return (
    <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--surface-card)] p-5 space-y-4 shadow-xs transition-all hover:border-[var(--border-focus)]">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-[var(--primary-surface)] text-[var(--primary-action)] flex items-center justify-center">
            <MessageSquareText className="w-3.5 h-3.5" />
          </div>
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">Important Discussion Points</h3>
          <span className="px-2 py-0.5 rounded-full bg-[var(--primary-surface)] text-[var(--primary-action)] text-[11px] font-semibold border border-[var(--primary-border)] font-mono">
            {points.length} topics
          </span>
        </div>

        <button
          onClick={handleAddPoint}
          className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[var(--surface-subtle)] hover:opacity-90 text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-xs font-medium border border-[var(--border-default)] transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] outline-none"
        >
          <Plus className="w-3.5 h-3.5 text-[var(--text-muted)]" />
          <span>Add Topic</span>
        </button>
      </div>

      <div className="space-y-3">
        {points.map((point) => {
          const isEditing = editingId === point.id;

          return (
            <div
              key={point.id}
              className="group relative p-3.5 rounded-xl bg-[var(--surface-subtle)] border border-[var(--border-subtle)] transition-all"
            >
              {isEditing ? (
                <div className="space-y-2">
                  <input
                    type="text"
                    value={editTopic}
                    onChange={(e) => setEditTopic(e.target.value)}
                    placeholder="Topic title..."
                    className="w-full bg-[var(--surface-card)] border border-[var(--border-focus)] focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] rounded-lg px-2.5 py-1 text-xs text-[var(--text-primary)] outline-none shadow-2xs font-semibold"
                  />
                  <textarea
                    value={editSummary}
                    onChange={(e) => setEditSummary(e.target.value)}
                    rows={3}
                    placeholder="Summary of discussion..."
                    className="w-full bg-[var(--surface-card)] border border-[var(--border-default)] focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] rounded-lg p-2.5 text-xs text-[var(--text-secondary)] outline-none shadow-2xs leading-relaxed"
                  />
                  <div className="flex justify-end gap-1.5 pt-1">
                    <button
                      onClick={() => setEditingId(null)}
                      className="px-2 py-1 text-[11px] text-[var(--text-muted)] hover:text-[var(--text-primary)] focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] outline-none rounded cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => handleSaveEdit(point.id)}
                      className="px-2.5 py-1 rounded-lg bg-[var(--primary-action)] hover:bg-[var(--primary-hover)] text-white text-[11px] font-semibold transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] outline-none"
                    >
                      Save
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 space-y-1">
                      <div className="flex items-baseline flex-wrap gap-1.5">
                        <span className="text-xs font-semibold text-[var(--text-primary)]">
                          {point.topic}
                        </span>
                        <CitationBadge
                          citation={point.citation}
                          onClickQuote={onInspectCitation}
                        />
                        {point.isEdited && (
                          <span className="text-[10px] text-[var(--text-subtle)] font-mono italic">
                            (edited)
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-[var(--text-secondary)] leading-relaxed font-normal">
                        {point.summary}
                      </p>

                      {point.speakers && point.speakers.length > 0 && (
                        <div className="flex items-center gap-1.5 pt-1">
                          <span className="text-[10px] font-medium text-[var(--text-muted)]">Contributors:</span>
                          {point.speakers.map((spk, idx) => (
                            <span
                              key={idx}
                              className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded bg-[var(--surface-card)] text-[var(--text-secondary)] text-[10px] font-medium border border-[var(--border-subtle)]"
                            >
                              <User className="w-2.5 h-2.5 text-[var(--text-subtle)]" />
                              <span>{spk}</span>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-opacity shrink-0">
                      <button
                        onClick={() => handleStartEdit(point)}
                        className="p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-card)] rounded transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] outline-none"
                        title="Edit discussion topic"
                        aria-label={`Edit topic: ${point.topic}`}
                      >
                        <Edit2 className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => handleDelete(point.id)}
                        className="p-1 text-[var(--text-muted)] hover:text-[var(--color-error)] hover:bg-[var(--error-surface)] rounded transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] outline-none"
                        title="Delete topic"
                        aria-label={`Delete topic: ${point.topic}`}
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
    </div>
  );
};

import React, { useState } from "react";
import { ActionItem, SourceCitation } from "../../../types/meeting";
import { CheckSquare, Plus, Trash2, Edit2, User, Calendar, Check } from "lucide-react";
import { CitationBadge } from "./CitationBadge";

interface ActionItemsMatrixProps {
  actionItems: ActionItem[];
  onUpdateActions: (updated: ActionItem[]) => void;
  onInspectCitation?: (citation: SourceCitation) => void;
}

export const ActionItemsMatrix: React.FC<ActionItemsMatrixProps> = ({
  actionItems,
  onUpdateActions,
  onInspectCitation,
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTask, setEditTask] = useState("");
  const [editAssignee, setEditAssignee] = useState("");
  const [editDue, setEditDue] = useState("");

  const handleToggleCheck = (id: string) => {
    onUpdateActions(
      actionItems.map((a) =>
        a.id === id ? { ...a, isCompleted: !a.isCompleted } : a
      )
    );
  };

  const handleStartEdit = (a: ActionItem) => {
    setEditingId(a.id);
    setEditTask(a.task);
    setEditAssignee(a.assignee || "");
    setEditDue(a.dueDate || "");
  };

  const handleSaveEdit = (id: string) => {
    onUpdateActions(
      actionItems.map((a) =>
        a.id === id
          ? {
              ...a,
              task: editTask,
              assignee: editAssignee || undefined,
              dueDate: editDue || undefined,
              isEdited: true,
            }
          : a
      )
    );
    setEditingId(null);
  };

  const handleDelete = (id: string) => {
    onUpdateActions(actionItems.filter((a) => a.id !== id));
  };

  const handleAddTask = () => {
    const newTask: ActionItem = {
      id: `act-${Date.now()}`,
      task: "New follow-up action item",
      assignee: "Unassigned",
      dueDate: "This week",
      isCompleted: false,
      isEdited: true,
    };
    onUpdateActions([...actionItems, newTask]);
    handleStartEdit(newTask);
  };

  return (
    <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--surface-card)] p-5 space-y-4 shadow-xs transition-all hover:border-[var(--border-focus)]">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-[var(--primary-surface)] text-[var(--primary-action)] flex items-center justify-center">
            <CheckSquare className="w-3.5 h-3.5" />
          </div>
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">Action Items & Deliverables</h3>
          <span className="px-2 py-0.5 rounded-full bg-[var(--primary-surface)] text-[var(--primary-action)] text-[11px] font-semibold border border-[var(--primary-border)] font-mono">
            {actionItems.filter((a) => !a.isCompleted).length} pending
          </span>
        </div>

        <button
          onClick={handleAddTask}
          className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[var(--surface-subtle)] hover:opacity-90 text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-xs font-medium border border-[var(--border-default)] transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] outline-none"
        >
          <Plus className="w-3.5 h-3.5 text-[var(--text-muted)]" />
          <span>Add Task</span>
        </button>
      </div>

      {actionItems.length === 0 ? (
        <div className="p-4 rounded-xl bg-[var(--surface-subtle)] border border-dashed border-[var(--border-default)] text-center text-xs text-[var(--text-muted)]">
          No action items found in notes.
        </div>
      ) : (
        <div className="space-y-2">
          {actionItems.map((action) => {
            const isEditing = editingId === action.id;

            return (
              <div
                key={action.id}
                className={`group relative p-3 rounded-xl border transition-all ${
                  action.isCompleted
                    ? "bg-[var(--surface-subtle)] border-[var(--border-subtle)] opacity-60"
                    : "bg-[var(--surface-subtle)] border-[var(--border-subtle)]"
                }`}
              >
                {isEditing ? (
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={editTask}
                      onChange={(e) => setEditTask(e.target.value)}
                      placeholder="Task description..."
                      className="w-full bg-[var(--surface-card)] border border-[var(--border-focus)] focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] rounded-lg px-2.5 py-1 text-xs text-[var(--text-primary)] outline-none shadow-2xs"
                    />
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={editAssignee}
                        onChange={(e) => setEditAssignee(e.target.value)}
                        placeholder="Assignee (e.g. Sarah)"
                        className="flex-1 bg-[var(--surface-card)] border border-[var(--border-default)] focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] rounded-lg px-2 py-1 text-xs text-[var(--text-secondary)] outline-none shadow-2xs"
                      />
                      <input
                        type="text"
                        value={editDue}
                        onChange={(e) => setEditDue(e.target.value)}
                        placeholder="Due Date (e.g. Friday)"
                        className="flex-1 bg-[var(--surface-card)] border border-[var(--border-default)] focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] rounded-lg px-2 py-1 text-xs text-[var(--text-secondary)] outline-none shadow-2xs"
                      />
                    </div>
                    <div className="flex justify-end gap-1.5 pt-1">
                      <button
                        onClick={() => setEditingId(null)}
                        className="px-2 py-1 text-[11px] text-[var(--text-muted)] hover:text-[var(--text-primary)] focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] outline-none rounded cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => handleSaveEdit(action.id)}
                        className="px-2.5 py-1 rounded-lg bg-[var(--primary-action)] hover:bg-[var(--primary-hover)] text-white text-[11px] font-semibold transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] outline-none"
                      >
                        Save
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2.5 min-w-0 flex-1">
                      {/* Interactive Custom Checkbox */}
                      <button
                        onClick={() => handleToggleCheck(action.id)}
                        aria-label={action.isCompleted ? `Mark ${action.task} as incomplete` : `Mark ${action.task} as complete`}
                        className={`w-4 h-4 rounded mt-0.5 flex items-center justify-center border transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] outline-none ${
                          action.isCompleted
                            ? "bg-[var(--primary-action)] border-[var(--primary-action)] text-white"
                            : "border-[var(--border-default)] hover:border-[var(--border-focus)] bg-[var(--surface-card)]"
                        }`}
                        title={action.isCompleted ? "Mark incomplete" : "Mark completed"}
                      >
                        {action.isCompleted && <Check className="w-3 h-3 stroke-[2.5]" />}
                      </button>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline flex-wrap gap-1">
                          <span
                            className={`text-xs ${
                              action.isCompleted
                                ? "line-through text-[var(--text-muted)] font-normal"
                                : "text-[var(--text-primary)] font-medium"
                            }`}
                          >
                            {action.task}
                          </span>
                          <CitationBadge
                            citation={action.citation}
                            onClickQuote={onInspectCitation}
                          />
                        </div>

                        {/* Metadata Tags: Assignee & Due Date */}
                        <div className="flex flex-wrap items-center gap-2 mt-1.5 text-[11px]">
                          {action.assignee ? (
                            <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-[var(--primary-surface)] text-[var(--primary-action)] font-medium border border-[var(--primary-border)]">
                              <User className="w-3 h-3" />
                              <span>@{action.assignee}</span>
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-[var(--surface-subtle)] text-[var(--text-muted)] text-[10px] border border-[var(--border-subtle)]">
                              <User className="w-3 h-3" />
                              <span>Unassigned</span>
                            </span>
                          )}

                          {action.dueDate && (
                            <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-[var(--surface-card)] text-[var(--text-secondary)] border border-[var(--border-default)] font-mono text-[10px]">
                              <Calendar className="w-3 h-3 text-[var(--text-subtle)]" />
                              <span>Due: {action.dueDate}</span>
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-opacity shrink-0">
                      <button
                        onClick={() => handleStartEdit(action)}
                        className="p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-card)] rounded transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] outline-none"
                        title="Edit task"
                        aria-label={`Edit task: ${action.task}`}
                      >
                        <Edit2 className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => handleDelete(action.id)}
                        className="p-1 text-[var(--text-muted)] hover:text-[var(--color-error)] hover:bg-[var(--error-surface)] rounded transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] outline-none"
                        title="Delete task"
                        aria-label={`Delete task: ${action.task}`}
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
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

import React, { useState, useMemo } from "react";
import { MeetingNote } from "../../../types/meeting";
import { SearchFilter } from "./SearchFilter";
import { MeetingCard } from "./MeetingCard";
import { Plus, FolderX, Calendar } from "lucide-react";

interface SidebarProps {
  meetings: MeetingNote[];
  activeMeetingId: string | null;
  onSelectMeeting: (id: string) => void;
  onNewMeeting: () => void;
  onDeleteMeeting: (id: string) => void;
  isOpen: boolean;
  onCloseMobile: () => void;
  onOpenFeedView?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  meetings,
  activeMeetingId,
  onSelectMeeting,
  onNewMeeting,
  onDeleteMeeting,
  isOpen,
  onCloseMobile,
  onOpenFeedView,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<"all" | "completed" | "drafts">("all");

  const filteredMeetings = useMemo(() => {
    return meetings.filter((m) => {
      // Search filter
      const matchesSearch =
        searchQuery.trim() === "" ||
        m.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.rawInput.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.analysis?.decisions.some((d) => d.text.toLowerCase().includes(searchQuery.toLowerCase()));

      // Status filter
      const matchesStatus =
        activeFilter === "all" ||
        (activeFilter === "completed" && m.status === "completed") ||
        (activeFilter === "drafts" && m.status !== "completed");

      return matchesSearch && matchesStatus;
    });
  }, [meetings, searchQuery, activeFilter]);

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-slate-900/30 backdrop-blur-xs z-30 md:hidden"
          onClick={onCloseMobile}
        />
      )}

      <aside
        className={`fixed md:static inset-y-0 left-0 w-72 bg-[var(--surface-subtle)] border-r border-[var(--border-default)] flex flex-col z-40 transition-transform duration-200 ease-in-out select-none ${
          isOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        }`}
      >
        {/* Top Quick Actions */}
        <div className="p-3 border-b border-[var(--border-default)] space-y-2">
          {onOpenFeedView && (
            <button
              onClick={() => {
                onOpenFeedView();
                onCloseMobile();
              }}
              className="w-full h-9 flex items-center justify-center gap-2 rounded-xl bg-[var(--surface-card)] hover:bg-[var(--surface-subtle)] text-[var(--text-secondary)] font-medium text-xs border border-[var(--border-default)] shadow-2xs transition-all cursor-pointer"
            >
              <Calendar className="w-4 h-4 text-[var(--primary-action)]" />
              <span>Meet Record Feed</span>
            </button>
          )}

          <button
            onClick={() => {
              onNewMeeting();
              onCloseMobile();
            }}
            className="w-full h-9 flex items-center justify-center gap-2 rounded-xl bg-[var(--primary-action)] hover:bg-[var(--primary-hover)] text-white font-medium text-xs shadow-xs transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>New Manual Note</span>
            <kbd className="hidden sm:inline-block ml-1 px-1.5 py-0.5 text-[9px] bg-white/20 rounded font-mono text-white">
              ⌘N
            </kbd>
          </button>
        </div>

        {/* Search & Status Filters */}
        <SearchFilter
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          activeFilter={activeFilter}
          setActiveFilter={setActiveFilter}
        />

        {/* Meeting List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          <div className="flex items-center justify-between px-1 text-[11px] font-semibold text-[var(--text-muted)] tracking-wider uppercase">
            <span>Past Summaries</span>
            <span className="font-mono text-[var(--text-subtle)]">{filteredMeetings.length}</span>
          </div>

          {filteredMeetings.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
              <FolderX className="w-8 h-8 text-[var(--text-subtle)] mb-2 stroke-[1.5]" />
              <p className="text-xs text-[var(--text-secondary)] font-medium">No meetings found</p>
              <p className="text-[11px] text-[var(--text-muted)] mt-1">
                {searchQuery ? "Try a different search query" : "Click '+ New Manual Note' or use Meet Record"}
              </p>
            </div>
          ) : (
            filteredMeetings.map((meeting) => (
              <MeetingCard
                key={meeting.id}
                meeting={meeting}
                isActive={activeMeetingId === meeting.id}
                onSelect={() => {
                  onSelectMeeting(meeting.id);
                  onCloseMobile();
                }}
                onDelete={(e) => {
                  e.stopPropagation();
                  onDeleteMeeting(meeting.id);
                }}
              />
            ))
          )}
        </div>

        {/* Sidebar Footer info */}
        <div className="p-3 border-t border-[var(--border-default)] bg-[var(--surface-card)] text-[11px] text-[var(--text-muted)] flex items-center justify-between">
          <span className="flex items-center gap-1.5 font-medium">
            <span className="w-2 h-2 rounded-full bg-[var(--color-success)]"></span>
            Ready to Synthesize
          </span>
          <span className="font-mono text-[var(--text-subtle)]">IndexedDB active</span>
        </div>
      </aside>
    </>
  );
};

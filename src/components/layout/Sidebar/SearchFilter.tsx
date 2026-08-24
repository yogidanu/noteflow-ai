import React from "react";
import { Search, X } from "lucide-react";

interface SearchFilterProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  activeFilter: "all" | "completed" | "drafts";
  setActiveFilter: (filter: "all" | "completed" | "drafts") => void;
}

export const SearchFilter: React.FC<SearchFilterProps> = ({
  searchQuery,
  setSearchQuery,
  activeFilter,
  setActiveFilter,
}) => {
  return (
    <div className="space-y-2 px-3 pt-3">
      <div className="relative">
        <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-subtle)]" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search meetings, decisions..."
          className="w-full h-8 pl-8 pr-7 bg-[var(--surface-card)] border border-[var(--border-default)] focus:border-[var(--border-focus)] focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] rounded-lg text-xs text-[var(--text-primary)] placeholder-[var(--text-subtle)] outline-none transition-all shadow-2xs"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery("")}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-subtle)] hover:text-[var(--text-primary)] focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] outline-none rounded cursor-pointer"
            aria-label="Clear search input"
          >
            <X className="w-3 h-3" />
          </button>
        )}
      </div>

      <div className="flex gap-0.5 p-0.5 bg-[var(--surface-subtle)] border border-[var(--border-default)] rounded-lg text-[11px]">
        {(["all", "completed", "drafts"] as const).map((filter) => (
          <button
            key={filter}
            onClick={() => setActiveFilter(filter)}
            className={`flex-1 py-1 rounded capitalize font-medium transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] outline-none ${
              activeFilter === filter
                ? "bg-[var(--surface-card)] text-[var(--text-primary)] shadow-2xs font-semibold"
                : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            }`}
          >
            {filter === "all" ? "All" : filter === "completed" ? "Synthesized" : "Drafts"}
          </button>
        ))}
      </div>
    </div>
  );
};

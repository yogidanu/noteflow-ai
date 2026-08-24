import React, { useState } from "react";
import { MeetingNote } from "../../types/meeting";
import { X, Copy, Check, Download, Share2, Code, MessageSquare, FileText } from "lucide-react";
import { formatForSlack, formatForMarkdown, copyToClipboard } from "../../lib/exportFormatters";

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  meeting: MeetingNote;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  meeting,
}) => {
  const [activeTab, setActiveTab] = useState<"slack" | "markdown" | "json">("slack");
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const slackText = formatForSlack(meeting);
  const markdownText = formatForMarkdown(meeting);
  const jsonText = JSON.stringify(meeting, null, 2);

  const currentContent =
    activeTab === "slack"
      ? slackText
      : activeTab === "markdown"
      ? markdownText
      : jsonText;

  const handleCopy = async () => {
    const success = await copyToClipboard(currentContent);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDownloadMarkdown = () => {
    const blob = new Blob([markdownText], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${meeting.title.replace(/[^a-z0-9]/gi, "_").toLowerCase()}_notes.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-fadeIn">
      <div className="w-full max-w-2xl bg-[var(--surface-elevated)] border border-[var(--border-default)] rounded-2xl shadow-2xl overflow-hidden flex flex-col text-[var(--text-primary)]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[var(--border-subtle)] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-[var(--primary-surface)] text-[var(--primary-action)]">
              <Share2 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-[var(--text-primary)]">Export & Share Notes</h3>
              <p className="text-xs text-[var(--text-muted)]">Ready to distribute across team workflows</p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close export dialog"
            className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] rounded-lg hover:bg-[var(--surface-subtle)] transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] outline-none"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Selection */}
        <div className="px-6 pt-3 pb-2 flex gap-1.5 border-b border-[var(--border-subtle)] bg-[var(--surface-subtle)]">
          <button
            onClick={() => setActiveTab("slack")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] outline-none ${
              activeTab === "slack"
                ? "bg-[var(--surface-card)] text-[var(--text-primary)] shadow-2xs font-semibold"
                : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5 text-[var(--primary-action)]" />
            <span>Slack / Teams Format</span>
          </button>

          <button
            onClick={() => setActiveTab("markdown")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] outline-none ${
              activeTab === "markdown"
                ? "bg-[var(--surface-card)] text-[var(--text-primary)] shadow-2xs font-semibold"
                : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            }`}
          >
            <FileText className="w-3.5 h-3.5 text-[var(--primary-action)]" />
            <span>Markdown (.md)</span>
          </button>

          <button
            onClick={() => setActiveTab("json")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] outline-none ${
              activeTab === "json"
                ? "bg-[var(--surface-card)] text-[var(--text-primary)] shadow-2xs font-semibold"
                : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            }`}
          >
            <Code className="w-3.5 h-3.5 text-[var(--primary-action)]" />
            <span>Raw JSON</span>
          </button>
        </div>

        {/* Preview Container */}
        <div className="p-6 bg-[var(--surface-card)]">
          <pre className="w-full h-72 bg-[var(--surface-subtle)] border border-[var(--border-default)] rounded-xl p-4 overflow-y-auto font-mono text-xs text-[var(--text-primary)] whitespace-pre-wrap leading-relaxed">
            {currentContent}
          </pre>
        </div>

        {/* Footer Buttons */}
        <div className="px-6 py-3.5 bg-[var(--surface-subtle)] border-t border-[var(--border-subtle)] flex items-center justify-between">
          {activeTab === "markdown" ? (
            <button
              onClick={handleDownloadMarkdown}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[var(--surface-card)] hover:bg-[var(--surface-subtle)] text-[var(--text-secondary)] text-xs font-medium border border-[var(--border-default)] transition-colors cursor-pointer shadow-2xs focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] outline-none"
            >
              <Download className="w-3.5 h-3.5 text-[var(--text-muted)]" />
              <span>Download .md</span>
            </button>
          ) : (
            <span className="text-[11px] text-[var(--text-subtle)]">Formatted for 1-click paste</span>
          )}

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3.5 py-1.5 text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] outline-none rounded"
            >
              Close
            </button>
            <button
              onClick={handleCopy}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--primary-action)] hover:bg-[var(--primary-hover)] text-white text-xs font-semibold shadow-xs transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] outline-none"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-[var(--color-success)]" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? "Copied to Clipboard!" : "Copy to Clipboard"}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

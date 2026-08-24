import { MeetingNote } from "../types/meeting";

export function formatForSlack(note: MeetingNote): string {
  if (!note.analysis) return "";
  const { executiveSummary, decisions, actionItems, unresolvedQuestions } = note.analysis;

  const lines: string[] = [];

  lines.push(`*📌 ${note.title}*`);
  lines.push(`_Generated via NoteFlow AI • ${new Date(note.createdAt).toLocaleDateString()}_\n`);

  lines.push(`*📋 Executive Summary:*`);
  lines.push(`>${executiveSummary.replace(/\n/g, "\n>")}\n`);

  if (decisions.length > 0) {
    lines.push(`*🎯 Key Decisions:*`);
    decisions.forEach((d) => {
      lines.push(`• *${d.text}*`);
      if (d.rationale) {
        lines.push(`  _↳ Rationale: ${d.rationale}_`);
      }
    });
    lines.push("");
  }

  if (actionItems.length > 0) {
    lines.push(`*✅ Action Items:*`);
    actionItems.forEach((a) => {
      const check = a.isCompleted ? "[x]" : "[ ]";
      const assignee = a.assignee ? ` (*@${a.assignee}*)` : "";
      const due = a.dueDate ? ` — _Due: ${a.dueDate}_` : "";
      lines.push(`• \`${check}\` ${a.task}${assignee}${due}`);
    });
    lines.push("");
  }

  if (unresolvedQuestions.length > 0) {
    lines.push(`*❓ Open Questions & Follow-ups:*`);
    unresolvedQuestions.forEach((q) => {
      lines.push(`• ${q.question}`);
      if (q.suggestedFollowUp) {
        lines.push(`  _↳ Next step: ${q.suggestedFollowUp}_`);
      }
    });
  }

  return lines.join("\n");
}

export function formatForMarkdown(note: MeetingNote): string {
  if (!note.analysis) return `# ${note.title}\n\n${note.rawInput}`;
  const { executiveSummary, decisions, actionItems, unresolvedQuestions, wordCount, estimatedMeetingDurationMinutes } = note.analysis;

  const lines: string[] = [];

  lines.push(`# ${note.title}`);
  lines.push(`*Date: ${new Date(note.createdAt).toLocaleString()} | Duration: ~${estimatedMeetingDurationMinutes} mins (${wordCount} words)*\n`);

  lines.push(`## 📌 Executive Summary`);
  lines.push(`${executiveSummary}\n`);

  if (decisions.length > 0) {
    lines.push(`## 🎯 Key Decisions`);
    decisions.forEach((d) => {
      lines.push(`- **${d.text}**`);
      if (d.rationale) {
        lines.push(`  > *Rationale:* ${d.rationale}`);
      }
      if (d.citation) {
        lines.push(`  > *Source:* [${d.citation.timestamp || "Transcript"} ${d.citation.speaker ? `@${d.citation.speaker}` : ""}] "${d.citation.rawText}"`);
      }
    });
    lines.push("");
  }

  if (actionItems.length > 0) {
    lines.push(`## ✅ Action Items`);
    actionItems.forEach((a) => {
      const check = a.isCompleted ? "x" : " ";
      const assignee = a.assignee ? ` **@${a.assignee}**` : "*(Unassigned)*";
      const due = a.dueDate ? ` | Due: \`${a.dueDate}\`` : "";
      lines.push(`- [${check}] ${a.task} — ${assignee}${due}`);
    });
    lines.push("");
  }

  if (unresolvedQuestions.length > 0) {
    lines.push(`## ❓ Open Questions & Parking Lot`);
    unresolvedQuestions.forEach((q) => {
      lines.push(`- **${q.question}**`);
      if (q.suggestedFollowUp) {
        lines.push(`  - *Action suggested:* ${q.suggestedFollowUp}`);
      }
    });
  }

  return lines.join("\n");
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    } else {
      const textArea = document.createElement("textarea");
      textArea.value = text;
      textArea.style.position = "fixed";
      textArea.style.left = "-999999px";
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      const successful = document.execCommand("copy");
      textArea.remove();
      return successful;
    }
  } catch (err) {
    console.error("Clipboard copy failed", err);
    return false;
  }
}

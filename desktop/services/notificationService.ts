/**
 * Native System Notification Service
 * Delivers macOS and Windows toast alerts for upcoming meetings and synthesis handoffs
 */

import { Notification, shell } from "electron";
import { DetectedMeeting } from "../../src/types/meeting";

export class NotificationService {
  /**
   * Triggers a native T-5m pre-meeting alert with explicit action buttons
   */
  public static showUpcomingMeetingAlert(
    meeting: DetectedMeeting,
    onApproveRecording: () => void,
    onOpenMeetingUrl: () => void
  ): void {
    if (!Notification.isSupported()) return;

    const notification = new Notification({
      title: "NoteFlow AI • Upcoming Meeting",
      subtitle: `${meeting.startTime} – ${meeting.title}`,
      body: `Starting in 5 minutes with ${meeting.organizerName}. Enable automated recording & AI synthesis?`,
      silent: false,
      actions: [
        { type: "button", text: "Record Meeting" },
        { type: "button", text: "Join Google Meet" },
      ],
    });

    notification.on("action", (_, index) => {
      if (index === 0) {
        onApproveRecording();
      } else if (index === 1) {
        onOpenMeetingUrl();
      }
    });

    notification.on("click", () => {
      onApproveRecording();
    });

    notification.show();
  }

  /**
   * Triggers a summary-ready notification with 1-click web app handoff
   */
  public static showSummaryReadyAlert(meetingTitle: string, decisionsCount: number, actionsCount: number, onOpenSummary: () => void): void {
    if (!Notification.isSupported()) return;

    const notification = new Notification({
      title: "✨ Meeting Notes Synthesized",
      subtitle: meetingTitle,
      body: `${decisionsCount} decisions and ${actionsCount} action items extracted with grounded quotes.`,
      silent: false,
    });

    notification.on("click", () => {
      onOpenSummary();
    });

    notification.show();
  }
}

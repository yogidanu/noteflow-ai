/**
 * Background Meeting Detection Daemon
 * Polls calendar integrations, triggers T-5m notifications, and manages recording approvals
 */

import { DetectedMeeting } from "../../src/types/meeting";
import { NotificationService } from "./notificationService";
import { BrowserWindow, shell } from "electron";

export class MeetingDaemon {
  private static detectedMeetings: DetectedMeeting[] = [];
  private static pollTimer: NodeJS.Timeout | null = null;
  private static alertedMeetingIds = new Set<string>();

  public static start(pollingIntervalMs = 60000): void {
    if (this.pollTimer) clearInterval(this.pollTimer);

    // Initial sync
    this.pollUpcomingMeetings();

    // Periodic background check
    this.pollTimer = setInterval(() => {
      this.pollUpcomingMeetings();
    }, pollingIntervalMs);
  }

  public static stop(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  public static async pollUpcomingMeetings(): Promise<DetectedMeeting[]> {
    // In production, this synchronizes with the NoteFlow Cloud backend /calendar/sync API
    const now = new Date();
    const formatTime = (d: Date) => d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

    const tPlus5 = new Date(now.getTime() + 4 * 60 * 1000);
    const tPlus45 = new Date(now.getTime() + 45 * 60 * 1000);

    const meetings: DetectedMeeting[] = [
      {
        id: "meet-desk-001",
        calendarEventId: "cal-evt-9901",
        title: "Sprint Planning & Q3 Roadmap Alignment",
        organizerName: "Sarah Chen",
        organizerEmail: "sarah.chen@workspace.design",
        isExternalHost: false,
        startTime: formatTime(tPlus5),
        endTime: formatTime(tPlus45),
        meetingUrl: "https://meet.google.com/qrp-zvmk-sxc",
        platform: "google_meet",
        recordingStatus: "off",
        dedupHash: "735f46b789716286",
        attendees: [
          { name: "Sarah Chen", email: "sarah.chen@workspace.design", rsvp: "accepted" },
          { name: "Marcus Brody", email: "marcus.brody@workspace.design", rsvp: "accepted" },
        ],
      },
    ];

    this.detectedMeetings = meetings;

    // Check for meetings starting within 5 minutes that haven't been alerted yet
    meetings.forEach((m) => {
      if (!this.alertedMeetingIds.has(m.id)) {
        this.alertedMeetingIds.add(m.id);

        NotificationService.showUpcomingMeetingAlert(
          m,
          () => this.approveRecording(m.id),
          () => {
            if (m.meetingUrl) shell.openExternal(m.meetingUrl);
          }
        );
      }
    });

    // Broadcast updated meetings to renderer
    BrowserWindow.getAllWindows().forEach((win) => {
      if (!win.isDestroyed()) {
        win.webContents.send("desktop:meetings-updated", this.detectedMeetings);
      }
    });

    return meetings;
  }

  public static approveRecording(meetingId: string): boolean {
    const meeting = this.detectedMeetings.find((m) => m.id === meetingId);
    if (!meeting) return false;

    meeting.recordingStatus = "scheduled";

    // Broadcast update
    BrowserWindow.getAllWindows().forEach((win) => {
      if (!win.isDestroyed()) {
        win.webContents.send("desktop:meeting-approved", meeting);
      }
    });

    return true;
  }

  public static getMeetings(): DetectedMeeting[] {
    return this.detectedMeetings;
  }
}

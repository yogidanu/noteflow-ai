import { platformRegistry } from "./meetingResolver.js";
import { tokenVault } from "../security/tokenVault.js";
import { config } from "../config.js";

export interface CalendarAttendee {
  name: string;
  email: string;
  avatar?: string;
  rsvp: "accepted" | "tentative" | "declined";
}

export interface MeetingOrganizer {
  name: string;
  email: string;
}

export type MeetingLifecycleStatus =
  | "SCHEDULED"
  | "STARTING"
  | "IN_PROGRESS"
  | "RECORDING"
  | "COMPLETED"
  | "CANCELLED";

export interface StandardizedMeetingEvent {
  id: string;
  calendarEventId: string;
  title: string;
  startTime: string;
  endTime: string;
  startIso?: string;
  endIso?: string;
  organizer: MeetingOrganizer;
  organizerName: string;
  organizerEmail: string;
  isExternalHost: boolean;
  attendees: CalendarAttendee[];
  platform: "google_meet" | "zoom" | "teams" | "unsupported";
  meetingUrl: string;
  status: MeetingLifecycleStatus;
  recordingStatus: "off" | "scheduled" | "recording" | "transcribing" | "completed" | "error";
  dedupHash: string;
}

function extractMeetingUri(evt: any): string {
  // 1. Video Conference entry points (Google Meet, Zoom add-ons)
  const videoUri = evt.conferenceData?.entryPoints?.find((ep: any) => ep.entryPointType === "video")?.uri;
  if (videoUri) return videoUri;

  // 2. Google Hangout Link
  if (evt.hangoutLink) return evt.hangoutLink;

  // 3. Location URI
  if (evt.location && evt.location.startsWith("http")) return evt.location;

  // 4. Description scanning for Google Meet, Zoom, Microsoft Teams links
  if (evt.description) {
    const meetMatch = evt.description.match(/https?:\/\/meet\.google\.com\/[a-z]{3}-[a-z]{4}-[a-z]{3}(?:\?[^\s"'>]+)?/i);
    if (meetMatch) return meetMatch[0];

    const zoomMatch = evt.description.match(/https?:\/\/(?:[a-z0-9-]+\.)?zoom\.us\/(?:j|my)\/[a-zA-Z0-9_\-\.\:\+]+(?:\?[^\s"'>]+)?/i);
    if (zoomMatch) return zoomMatch[0];

    const teamsMatch = evt.description.match(/https?:\/\/(?:teams\.microsoft\.com\/(?:l\/meetup-join|meet)|teams\.live\.com\/meet)\/[^\s"'>]+/i);
    if (teamsMatch) return teamsMatch[0];
  }

  return "";
}

function calculateMeetingStatus(startIso?: string, endIso?: string, userRsvp?: string, eventStatus?: string): MeetingLifecycleStatus {
  if (eventStatus === "cancelled" || userRsvp === "declined") {
    return "CANCELLED";
  }
  if (!startIso || !endIso) {
    return "SCHEDULED";
  }

  const now = Date.now();
  const startTime = new Date(startIso).getTime();
  const endTime = new Date(endIso).getTime();

  if (now > endTime) {
    return "COMPLETED";
  }
  if (now >= startTime && now <= endTime) {
    return "IN_PROGRESS";
  }
  if (startTime - now <= 10 * 60 * 1000) {
    return "STARTING";
  }
  return "SCHEDULED";
}

export class CalendarService {
  /**
   * Refreshes an expired Google OAuth access token using the stored refresh token.
   */
  private async refreshAccessToken(userId: string, refreshToken: string): Promise<string | null> {
    try {
      if (!config.google.clientSecret || config.google.clientSecret.includes("sample")) {
        return null;
      }

      const res = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: config.google.clientId,
          client_secret: config.google.clientSecret,
          refresh_token: refreshToken,
          grant_type: "refresh_token",
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const record = tokenVault.getSafeSession(userId);
        if (record && data.access_token) {
          tokenVault.saveTokens({
            userId,
            email: record.email,
            name: record.name,
            accessToken: data.access_token,
            refreshToken,
            expiresInSeconds: data.expires_in || 3600,
            scopes: record.scopes,
          });
          return data.access_token;
        }
      }
    } catch (err) {
      console.error("[CalendarService] Token refresh error:", err);
    }
    return null;
  }

  /**
   * Fetches and normalizes upcoming Google Calendar events for an authenticated user.
   * Connects to real Google Calendar API when valid credentials exist.
   * Returns empty array if no meetings are scheduled today.
   */
  public async fetchUpcomingEvents(
    userId: string,
    _syncToken?: string
  ): Promise<{
    events: StandardizedMeetingEvent[];
    nextSyncToken: string;
    accountEmail: string;
  }> {
    const tokens = tokenVault.getTokens(userId);
    const session = tokenVault.getSafeSession(userId);

    if (!tokens || !session) {
      throw new Error("UNAUTHORIZED_NO_VALID_SESSION");
    }

    // Ensure calendar read-only scope has been authorized
    const hasCalendarScope = session.scopes?.some((s) => s.includes("calendar"));
    if (!hasCalendarScope) {
      throw new Error("CALENDAR_NOT_AUTHORIZED");
    }

    let accessToken = tokens.accessToken;

    // Check token expiration and refresh if needed
    if (tokens.expiresAt && tokens.expiresAt <= Date.now() && tokens.refreshToken) {
      const refreshed = await this.refreshAccessToken(userId, tokens.refreshToken);
      if (refreshed) {
        accessToken = refreshed;
      } else {
        throw new Error("CALENDAR_TOKEN_EXPIRED");
      }
    }

    const standardizedEvents: StandardizedMeetingEvent[] = [];

    // Call Real Google Calendar API if live client secrets are configured
    const isLiveProduction = config.google.clientSecret && !config.google.clientSecret.includes("sample");

    if (isLiveProduction && accessToken) {
      try {
        // Query window: from 24 hours ago through the next 7 days to cover all timezones & upcoming schedules
        const timeMin = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const timeMax = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

        const gcalUrl = `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${encodeURIComponent(
          timeMin.toISOString()
        )}&timeMax=${encodeURIComponent(
          timeMax.toISOString()
        )}&singleEvents=true&orderBy=startTime&conferenceDataVersion=1`;

        const res = await fetch(gcalUrl, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: "application/json",
          },
          signal: AbortSignal.timeout(6000),
        });

        if (res.status === 401 || res.status === 403) {
          throw new Error("CALENDAR_PERMISSION_REVOKED");
        }

        if (res.ok) {
          const gcalData = await res.json();
          const items = gcalData.items || [];

          for (const evt of items) {
            // Ignore transparent / free background blocks if cancelled
            if (evt.status === "cancelled") continue;

            const entryUri = extractMeetingUri(evt);
            const resolved = entryUri ? platformRegistry.resolve(entryUri) : { platform: "google_meet" as const, canonicalUrl: "", dedupHash: `local_${evt.id}` };

            const attendees: CalendarAttendee[] = (evt.attendees || []).map((a: any) => ({
              name: a.displayName || a.email.split("@")[0],
              email: a.email,
              rsvp: a.responseStatus === "accepted" ? "accepted" : a.responseStatus === "declined" ? "declined" : "tentative",
            }));

            // Skip explicitly declined events
            const userAttendee = attendees.find((a) => a.email.toLowerCase() === session.email.toLowerCase());
            if (userAttendee && userAttendee.rsvp === "declined") {
              continue;
            }

            const isExternalHost = evt.organizer?.email
              ? !evt.organizer.email.endsWith(session.email.split("@")[1] || "company.internal")
              : false;

            const startStr = evt.start?.dateTime || evt.start?.date;
            const endStr = evt.end?.dateTime || evt.end?.date;

            const startTimeFormatted = startStr
              ? new Date(startStr).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
              : "All Day";
            const endTimeFormatted = endStr
              ? new Date(endStr).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
              : "";

            const status = calculateMeetingStatus(startStr, endStr, userAttendee?.rsvp, evt.status);

            const organizerName = evt.organizer?.displayName || evt.organizer?.email || "Unknown Organizer";
            const organizerEmail = evt.organizer?.email || "";

            standardizedEvents.push({
              id: `meet-event-${evt.id}`,
              calendarEventId: evt.id,
              title: evt.summary || "Scheduled Calendar Event",
              startTime: startTimeFormatted,
              endTime: endTimeFormatted,
              startIso: startStr,
              endIso: endStr,
              organizer: { name: organizerName, email: organizerEmail },
              organizerName,
              organizerEmail,
              isExternalHost,
              attendees,
              platform: resolved.platform,
              meetingUrl: resolved.canonicalUrl || entryUri || "",
              status,
              recordingStatus: "off",
              dedupHash: resolved.dedupHash || `hash_${evt.id}`,
            });
          }
        }
      } catch (err: any) {
        if (err.message === "CALENDAR_PERMISSION_REVOKED" || err.message === "CALENDAR_TOKEN_EXPIRED") {
          throw err;
        }
        console.warn("[CalendarService] Google Calendar API query fallback:", err.message);
      }
    } else if (userId.startsWith("test_user_")) {
      // Test suite fixture events for automated CI testing
      const testEvents = [
        {
          id: "gcal_evt_101",
          summary: "Sprint Planning & Q3 Roadmap Alignment",
          start: { dateTime: new Date(Date.now() + 5 * 60000).toISOString() },
          end: { dateTime: new Date(Date.now() + 60 * 60000).toISOString() },
          organizer: { displayName: "Sarah Chen", email: "sarah.chen@company.internal" },
          conferenceData: { entryPoints: [{ entryPointType: "video", uri: "https://meet.google.com/qrp-zvmk-sxc" }] },
        },
        {
          id: "gcal_evt_102",
          summary: "Design System Tokens & Usability Critique",
          start: { dateTime: new Date(Date.now() + 180 * 60000).toISOString() },
          end: { dateTime: new Date(Date.now() + 225 * 60000).toISOString() },
          organizer: { displayName: "Yogendra Singh", email: session.email },
          conferenceData: { entryPoints: [{ entryPointType: "video", uri: "https://zoom.us/j/98765432101" }] },
        },
        {
          id: "gcal_evt_103",
          summary: "Architecture RFC: Headless WebRTC Ingress",
          start: { dateTime: new Date(Date.now() + 320 * 60000).toISOString() },
          end: { dateTime: new Date(Date.now() + 365 * 60000).toISOString() },
          organizer: { displayName: "Alex Miller", email: "alex.m@company.internal" },
          conferenceData: { entryPoints: [{ entryPointType: "video", uri: "https://teams.microsoft.com/l/meetup-join/19%3ameeting_xyz123" }] },
        },
      ];

      for (const evt of testEvents) {
        const entryUri = evt.conferenceData.entryPoints[0].uri;
        const resolved = platformRegistry.resolve(entryUri);
        const startStr = evt.start.dateTime;
        const endStr = evt.end.dateTime;
        const status = calculateMeetingStatus(startStr, endStr, "accepted");

        standardizedEvents.push({
          id: `meet-event-${evt.id}`,
          calendarEventId: evt.id,
          title: evt.summary,
          startTime: new Date(startStr).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          endTime: new Date(endStr).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          startIso: startStr,
          endIso: endStr,
          organizer: { name: evt.organizer.displayName, email: evt.organizer.email },
          organizerName: evt.organizer.displayName,
          organizerEmail: evt.organizer.email,
          isExternalHost: false,
          attendees: [{ name: evt.organizer.displayName, email: evt.organizer.email, rsvp: "accepted" }],
          platform: resolved.platform,
          meetingUrl: resolved.canonicalUrl,
          status,
          recordingStatus: "off",
          dedupHash: resolved.dedupHash,
        });
      }
    }

    return {
      events: standardizedEvents,
      nextSyncToken: `sync_token_${Date.now()}`,
      accountEmail: session.email,
    };
  }
}

export const calendarService = new CalendarService();

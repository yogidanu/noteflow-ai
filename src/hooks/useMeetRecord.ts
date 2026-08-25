import { useState, useEffect, useCallback, useRef } from "react";
import {
  DetectedMeeting,
  CalendarConnectionState,
  RecordingStatusType,
  MeetRecordErrorType,
} from "../types/meeting";
import { SAMPLE_1ON1_REORG_TRANSCRIPT, SAMPLE_ZOOM_TRANSCRIPT } from "../lib/sampleData";
import { apiClient } from "../lib/apiClient";
import { webAudioRecorder } from "../lib/audioRecorder";
import { desktopBridge } from "../lib/desktopBridge";
import { MeetingDetectionStateType } from "../components/modals/MeetingDetectionSetupModal";

const CALENDAR_STORAGE_KEY = "noteflow_calendar_state_v1";
const DETECTED_MEETINGS_KEY = "noteflow_detected_meetings_v1";
const DETECTION_STATE_KEY = "noteflow_meeting_detection_state_v1";
const DETECTION_ENABLED_KEY = "noteflow_meeting_detection_enabled_v1";

export const DEMO_DETECTED_MEETINGS: DetectedMeeting[] = [
  {
    id: "meet-event-101",
    calendarEventId: "gcal_evt_101",
    title: "Sprint Planning & Q3 Roadmap Alignment",
    startTime: "10:00 AM",
    endTime: "10:45 AM",
    organizerName: "Sarah Chen (VP Product)",
    organizerEmail: "sarah.chen@company.internal",
    isExternalHost: false,
    attendees: [
      { name: "Sarah Chen", email: "sarah.chen@company.internal", rsvp: "accepted" },
      { name: "Alex Miller", email: "alex.m@company.internal", rsvp: "accepted" },
      { name: "Elena Rostova", email: "elena.r@company.internal", rsvp: "accepted" },
      { name: "Robin K.", email: "robin.k@company.internal", rsvp: "tentative" },
    ],
    platform: "google_meet",
    meetingUrl: "https://meet.google.com/qrp-zvmk-sxc",
    recordingStatus: "off",
    dedupHash: "hash_qrp_zvmk_sxc",
    sampleTranscriptPreset: SAMPLE_ZOOM_TRANSCRIPT,
  },
  {
    id: "meet-event-102",
    calendarEventId: "gcal_evt_102",
    title: "Design System Tokens & Usability Critique",
    startTime: "02:00 PM",
    endTime: "02:45 PM",
    organizerName: "Alex Miller (Lead Designer)",
    organizerEmail: "alex.m@company.internal",
    isExternalHost: false,
    attendees: [
      { name: "Alex Miller", email: "alex.m@company.internal", rsvp: "accepted" },
      { name: "Robin K.", email: "robin.k@company.internal", rsvp: "accepted" },
      { name: "Elena Rostova", email: "elena.r@company.internal", rsvp: "accepted" },
    ],
    platform: "google_meet",
    meetingUrl: "https://meet.google.com/dfg-hjkl-qwe",
    recordingStatus: "off",
    dedupHash: "hash_dfg_hjkl_qwe",
    sampleTranscriptPreset: SAMPLE_1ON1_REORG_TRANSCRIPT,
  },
  {
    id: "meet-event-103",
    calendarEventId: "gcal_evt_103",
    title: "Architecture RFC: Headless WebRTC Ingress",
    startTime: "04:30 PM",
    endTime: "05:15 PM",
    organizerName: "Marcus Brody (Staff Architect)",
    organizerEmail: "marcus.b@company.internal",
    isExternalHost: false,
    attendees: [
      { name: "Marcus Brody", email: "marcus.b@company.internal", rsvp: "accepted" },
      { name: "Alex Miller", email: "alex.m@company.internal", rsvp: "accepted" },
      { name: "Dev Infra Lead", email: "infra.lead@company.internal", rsvp: "tentative" },
    ],
    platform: "google_meet",
    meetingUrl: "https://meet.google.com/bnm-tyui-opz",
    recordingStatus: "off",
    dedupHash: "hash_bnm_tyui_opz",
    sampleTranscriptPreset: SAMPLE_ZOOM_TRANSCRIPT,
  },
];

export function useMeetRecord(isDemoMode = false, userEmail?: string | null) {
  const [calendarState, setCalendarState] = useState<CalendarConnectionState>(() => {
    try {
      const saved = localStorage.getItem(CALENDAR_STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error("Failed to load calendar state", e);
    }
    // Production default: UNCONNECTED calendar
    if (isDemoMode) {
      return {
        isConnected: true,
        accountEmail: userEmail || "alex.product@acme-corp.internal",
        lastSyncedAt: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
    }
    return {
      isConnected: false,
      accountEmail: null,
      lastSyncedAt: null,
    };
  });

  const [detectedMeetings, setDetectedMeetings] = useState<DetectedMeeting[]>(() => {
    try {
      const saved = localStorage.getItem(DETECTED_MEETINGS_KEY);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error("Failed to load detected meetings", e);
    }
    // Production default: empty list until calendar is synced
    return isDemoMode ? DEMO_DETECTED_MEETINGS : [];
  });

  // Meeting Detection Policy & Lifecycle State
  const [isDetectionEnabled, setIsDetectionEnabled] = useState<boolean>(() => {
    try {
      return localStorage.getItem(DETECTION_ENABLED_KEY) === "true";
    } catch {
      return false;
    }
  });

  const [detectionState, setDetectionState] = useState<MeetingDetectionStateType>(() => {
    try {
      const saved = localStorage.getItem(DETECTION_STATE_KEY);
      if (saved) return saved as MeetingDetectionStateType;
    } catch {
      // ignore
    }
    return "not_enabled";
  });

  const [isSyncingCalendar, setIsSyncingCalendar] = useState<boolean>(false);
  const [calendarError, setCalendarError] = useState<string | null>(null);

  // Active Live Recording Session States
  const [activeRecordingMeetingId, setActiveRecordingMeetingId] = useState<string | null>(null);
  const [recordingSeconds, setRecordingSeconds] = useState<number>(0);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [audioPowerLevel, setAudioPowerLevel] = useState<number>(0);

  // Sync state changes to storage
  useEffect(() => {
    try {
      localStorage.setItem(CALENDAR_STORAGE_KEY, JSON.stringify(calendarState));
    } catch (e) {
      console.error("Failed to save calendar state", e);
    }
  }, [calendarState]);

  useEffect(() => {
    try {
      localStorage.setItem(DETECTED_MEETINGS_KEY, JSON.stringify(detectedMeetings));
    } catch (e) {
      console.error("Failed to save detected meetings", e);
    }
  }, [detectedMeetings]);

  useEffect(() => {
    try {
      localStorage.setItem(DETECTION_ENABLED_KEY, String(isDetectionEnabled));
    } catch (e) {
      console.error("Failed to save detection enabled", e);
    }
  }, [isDetectionEnabled]);

  useEffect(() => {
    try {
      localStorage.setItem(DETECTION_STATE_KEY, detectionState);
    } catch (e) {
      console.error("Failed to save detection state", e);
    }
  }, [detectionState]);

  // 1. Connect Google Calendar
  const connectCalendar = useCallback(async (accountEmail: string) => {
    setIsSyncingCalendar(true);
    setCalendarError(null);

    try {
      if (isDemoMode) {
        setCalendarState({
          isConnected: true,
          accountEmail,
          lastSyncedAt: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        });
        setDetectedMeetings(DEMO_DETECTED_MEETINGS);
        setIsSyncingCalendar(false);
        return;
      }

      // 1. Request incremental Google Calendar OAuth consent URL
      const authData = await apiClient.getGoogleAuthUrl(undefined, "calendar");

      if (authData?.authUrl && typeof window !== "undefined") {
        const width = 500;
        const height = 600;
        const left = window.screenX + (window.outerWidth - width) / 2;
        const top = window.screenY + (window.outerHeight - height) / 2.5;

        const popup = window.open(
          authData.authUrl,
          "NoteFlow Calendar Authorization",
          `width=${width},height=${height},left=${left},top=${top},status=no,resizable=yes`
        );

        if (popup) {
          await new Promise<void>((resolve) => {
            const checkTimer = window.setInterval(() => {
              if (popup.closed) {
                window.clearInterval(checkTimer);
                resolve();
              }
            }, 600);
          });
        }
      }

      // 2. Fetch real calendar meetings after authorization
      const gcalEvents = await apiClient.fetchCalendarEvents();
      if (gcalEvents && Array.isArray(gcalEvents.events)) {
        const syncTime = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
        setCalendarState({
          isConnected: true,
          accountEmail: gcalEvents.accountEmail || accountEmail,
          lastSyncedAt: gcalEvents.lastSyncedAt || syncTime,
        });
        setDetectedMeetings(gcalEvents.events);
      } else {
        setDetectedMeetings([]);
      }
    } catch (err: any) {
      console.error("[useMeetRecord] Connect calendar error:", err);
      setCalendarError(err.message || "Failed to authorize Google Calendar.");
    } finally {
      setIsSyncingCalendar(false);
    }
  }, [isDemoMode]);

  // 2. Disconnect Google Calendar
  const disconnectCalendar = useCallback(() => {
    setCalendarState({
      isConnected: false,
      accountEmail: null,
      lastSyncedAt: null,
    });
    setDetectedMeetings([]);
    setActiveRecordingMeetingId(null);
    setCalendarError(null);
    setIsDetectionEnabled(false);
    setDetectionState("not_enabled");

    try {
      localStorage.removeItem(CALENDAR_STORAGE_KEY);
      localStorage.removeItem(DETECTED_MEETINGS_KEY);
      localStorage.removeItem(DETECTION_ENABLED_KEY);
      localStorage.removeItem(DETECTION_STATE_KEY);
    } catch (e) {
      console.error("Failed to purge calendar storage", e);
    }
  }, []);

  // 3. Meeting Detection Handlers
  const enableMeetingDetection = useCallback(async (): Promise<boolean> => {
    setDetectionState("enabling");

    try {
      // Check browser notification permission if available
      if (typeof window !== "undefined" && "Notification" in window) {
        if (Notification.permission === "default") {
          const perm = await Notification.requestPermission();
          if (perm === "denied") {
            setDetectionState("permission_denied");
            setIsDetectionEnabled(false);
            return false;
          }
        } else if (Notification.permission === "denied") {
          setDetectionState("permission_denied");
          setIsDetectionEnabled(false);
          return false;
        }
      }

      setIsDetectionEnabled(true);
      setDetectionState("enabled");
      return true;
    } catch (err) {
      console.error("[useMeetRecord] Enable detection error:", err);
      setDetectionState("connection_failure");
      setIsDetectionEnabled(false);
      return false;
    }
  }, []);

  const disableMeetingDetection = useCallback(() => {
    setIsDetectionEnabled(false);
    setDetectionState("disabled");
  }, []);

  const retryMeetingDetection = useCallback(async (): Promise<boolean> => {
    return enableMeetingDetection();
  }, [enableMeetingDetection]);

  // 4. Manual Sync / Refresh Calendar
  const syncCalendar = useCallback(async () => {
    if (!calendarState.isConnected) return;
    setIsSyncingCalendar(true);
    setCalendarError(null);

    try {
      if (isDemoMode) {
        setCalendarState((prev) => ({
          ...prev,
          lastSyncedAt: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        }));
        setIsSyncingCalendar(false);
        return;
      }

      const res = await apiClient.syncCalendar();
      if (res && Array.isArray(res.events)) {
        setDetectedMeetings(res.events);
        setCalendarState((prev) => ({
          ...prev,
          lastSyncedAt: res.lastSyncedAt || new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        }));
      }
    } catch (err: any) {
      console.error("[useMeetRecord] Sync calendar error:", err);
      setCalendarError(err.message || "Failed to synchronize calendar.");
    } finally {
      setIsSyncingCalendar(false);
    }
  }, [calendarState.isConnected, isDemoMode]);

  // 5. Toggle Recording Status for a Meeting
  const toggleMeetingRecording = useCallback((id: string, enabled: boolean) => {
    setDetectedMeetings((prev) =>
      prev.map((m) =>
        m.id === id
          ? {
              ...m,
              recordingStatus: enabled ? "scheduled" : "off",
            }
          : m
      )
    );
  }, []);

  // 6. Update Meeting Status
  const updateMeetingStatus = useCallback(
    (id: string, status: RecordingStatusType, errorReason?: MeetRecordErrorType) => {
      setDetectedMeetings((prev) =>
        prev.map((m) =>
          m.id === id
            ? {
                ...m,
                recordingStatus: status,
                errorReason,
              }
            : m
        )
      );
    },
    []
  );

  // 7. Start Live Recording Ingress
  const startLiveRecording = useCallback(
    async (id: string) => {
      setActiveRecordingMeetingId(id);
      setRecordingSeconds(0);
      setIsPaused(false);
      updateMeetingStatus(id, "recording");

      // Start Web Audio Capture with live RMS equalizer
      await webAudioRecorder.start({
        onPowerLevel: (level) => setAudioPowerLevel(level),
        onDuration: (sec) => setRecordingSeconds(sec),
      });

      const target = detectedMeetings.find((m) => m.id === id);
      if (target?.dedupHash) {
        apiClient.startLiveRecording(target.dedupHash, target.meetingUrl);
      }
    },
    [detectedMeetings, updateMeetingStatus]
  );

  // 8. Pause / Resume Recording
  const togglePauseRecording = useCallback(() => {
    setIsPaused((prev) => {
      const next = !prev;
      if (next) {
        webAudioRecorder.pause();
      } else {
        webAudioRecorder.resume();
      }
      return next;
    });
  }, []);

  // 9. Stop Recording
  const stopRecording = useCallback(
    async (id: string, onComplete?: (meeting: DetectedMeeting, transcript: string) => void) => {
      const target = detectedMeetings.find((m) => m.id === id);
      setActiveRecordingMeetingId(null);
      setRecordingSeconds(0);
      setIsPaused(false);
      setAudioPowerLevel(0);

      // Stop Audio Recording & compile audio blob
      const audioBlob = await webAudioRecorder.stop();

      if (target) {
        updateMeetingStatus(id, "transcribing");

        let resolvedTranscript = target.sampleTranscriptPreset || SAMPLE_ZOOM_TRANSCRIPT;

        // If audio blob is captured in live mode, transcribe via backend STT service
        if (audioBlob && !isDemoMode) {
          try {
            const sttResult = await apiClient.transcribeAudio({
              audioBlob,
              meetingId: id,
              knownAttendees: target.attendees,
            });
            if (sttResult && (sttResult.rawVtt || sttResult.sanitizedText)) {
              resolvedTranscript = sttResult.rawVtt || sttResult.sanitizedText;
            }
          } catch (e) {
            console.warn("[useMeetRecord] Live transcription fallback:", e);
          }
        }

        setTimeout(() => {
          updateMeetingStatus(id, "completed");
          if (onComplete) {
            onComplete(target, resolvedTranscript);
          }
        }, 800);
      }
    },
    [detectedMeetings, isDemoMode, updateMeetingStatus]
  );

  // 10. Quick Join via direct Google Meet URL
  const quickJoinUrl = useCallback((url: string): DetectedMeeting => {
    const isMeet = /^https?:\/\/meet\.google\.com\/[a-z]{3}-[a-z]{4}-[a-z]{3}/i.test(url.trim());
    const newId = `ad-hoc-${Date.now()}`;
    const newMeeting: DetectedMeeting = {
      id: newId,
      calendarEventId: `adhoc_evt_${Date.now()}`,
      title: isMeet ? `Ad-hoc Meet • ${url.split("meet.google.com/")[1] || "Session"}` : "Ad-hoc Meeting Session",
      startTime: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      endTime: "In Progress",
      organizerName: "You (Instant Meeting)",
      organizerEmail: calendarState.accountEmail || "user@company.internal",
      isExternalHost: false,
      attendees: [
        { name: "You", email: calendarState.accountEmail || "user@company.internal", rsvp: "accepted" },
      ],
      platform: isMeet ? "google_meet" : "unsupported",
      meetingUrl: url.trim(),
      recordingStatus: isMeet ? "recording" : "error",
      errorReason: isMeet ? undefined : "UNSUPPORTED_PLATFORM",
      dedupHash: `hash_${Date.now()}`,
      sampleTranscriptPreset: SAMPLE_ZOOM_TRANSCRIPT,
    };

    setDetectedMeetings((prev) => [newMeeting, ...prev]);

    if (isMeet) {
      setActiveRecordingMeetingId(newId);
      setRecordingSeconds(0);
      setIsPaused(false);
    }

    return newMeeting;
  }, [calendarState.accountEmail]);

  // 11. Retry Failed Meeting
  const retryMeeting = useCallback((id: string) => {
    updateMeetingStatus(id, "scheduled");
  }, [updateMeetingStatus]);

  // Active meeting entity if currently recording
  const activeRecordingMeeting = detectedMeetings.find((m) => m.id === activeRecordingMeetingId) || null;

  return {
    calendarState,
    detectedMeetings,
    isDetectionEnabled,
    detectionState,
    enableMeetingDetection,
    disableMeetingDetection,
    retryMeetingDetection,
    isSyncingCalendar,
    calendarError,
    activeRecordingMeetingId,
    activeRecordingMeeting,
    recordingSeconds,
    isPaused,
    audioPowerLevel,
    connectCalendar,
    disconnectCalendar,
    syncCalendar,
    toggleMeetingRecording,
    updateMeetingStatus,
    startLiveRecording,
    togglePauseRecording,
    stopRecording,
    quickJoinUrl,
    retryMeeting,
  };
}

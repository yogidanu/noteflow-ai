import { useState, useEffect, useCallback } from "react";
import { MeetingNote } from "../types/meeting";
import { INITIAL_SAMPLE_MEETINGS } from "../lib/sampleData";

function getNotesStorageKey(userId?: string | null): string {
  return userId ? `noteflow:notes:${userId}` : "noteflow_demo_meetings";
}

function getActiveIdStorageKey(userId?: string | null): string {
  return userId ? `noteflow:active_meeting:${userId}` : "noteflow_active_meeting_id";
}

export function useMeetings(isDemoMode = false, userId?: string | null) {
  const notesKey = getNotesStorageKey(userId);
  const activeIdKey = getActiveIdStorageKey(userId);

  const [meetings, setMeetings] = useState<MeetingNote[]>(() => {
    try {
      const saved = localStorage.getItem(notesKey);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.error("Failed to load meetings from storage", e);
    }
    // Production default: completely clean workspace with zero pre-seeded notes
    return isDemoMode ? INITIAL_SAMPLE_MEETINGS : [];
  });

  const [activeMeetingId, setActiveMeetingId] = useState<string | null>(() => {
    try {
      const savedId = localStorage.getItem(activeIdKey);
      if (savedId) return savedId;
    } catch (e) {
      console.error("Failed to read active meeting id", e);
    }
    return isDemoMode ? INITIAL_SAMPLE_MEETINGS[0]?.id || null : null;
  });

  // Switch notes state when userId changes
  useEffect(() => {
    try {
      const currentKey = getNotesStorageKey(userId);
      const saved = localStorage.getItem(currentKey);
      if (saved) {
        setMeetings(JSON.parse(saved));
      } else {
        setMeetings(isDemoMode ? INITIAL_SAMPLE_MEETINGS : []);
      }

      const curActiveKey = getActiveIdStorageKey(userId);
      const savedId = localStorage.getItem(curActiveKey);
      setActiveMeetingId(savedId || (isDemoMode ? INITIAL_SAMPLE_MEETINGS[0]?.id || null : null));
    } catch (e) {
      console.error("Failed to reload user notes", e);
    }
  }, [userId, isDemoMode]);

  // Sync to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(notesKey, JSON.stringify(meetings));
    } catch (e) {
      console.error("Failed to save meetings to storage", e);
    }
  }, [meetings, notesKey]);

  useEffect(() => {
    if (activeMeetingId) {
      try {
        localStorage.setItem(activeIdKey, activeMeetingId);
      } catch (e) {
        console.error("Failed to save active id", e);
      }
    } else {
      localStorage.removeItem(activeIdKey);
    }
  }, [activeMeetingId, activeIdKey]);

  const activeMeeting = meetings.find((m) => m.id === activeMeetingId) || null;

  const createNewMeeting = useCallback((initialInput = "", isSample = false, title = "") => {
    const newId = `meeting-${Date.now()}`;
    const newMeeting: MeetingNote = {
      id: newId,
      title: title || `Untitled Meeting • ${new Date().toLocaleDateString([], { month: "short", day: "numeric" })}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      rawInput: initialInput,
      sanitizedInput: "",
      inputFormat: "raw",
      isSample,
      status: "draft",
    };

    setMeetings((prev) => [newMeeting, ...prev]);
    setActiveMeetingId(newId);
    return newMeeting;
  }, []);

  const updateMeeting = useCallback((id: string, updates: Partial<MeetingNote>) => {
    setMeetings((prev) =>
      prev.map((m) =>
        m.id === id
          ? {
              ...m,
              ...updates,
              updatedAt: new Date().toISOString(),
            }
          : m
      )
    );
  }, []);

  const deleteMeeting = useCallback(
    (id: string) => {
      setMeetings((prev) => {
        const nextList = prev.filter((m) => m.id !== id);
        if (activeMeetingId === id) {
          setActiveMeetingId(nextList[0]?.id || null);
        }
        return nextList;
      });
    },
    [activeMeetingId]
  );

  const resetToSamples = useCallback(() => {
    setMeetings(INITIAL_SAMPLE_MEETINGS);
    setActiveMeetingId(INITIAL_SAMPLE_MEETINGS[0].id);
  }, []);

  const clearAllMeetings = useCallback(() => {
    setMeetings([]);
    setActiveMeetingId(null);
    try {
      localStorage.removeItem(notesKey);
      localStorage.removeItem(activeIdKey);
      localStorage.removeItem("noteflow_meetings_v1");
      localStorage.removeItem("noteflow_active_meeting_id");
    } catch (e) {
      console.error("Failed to clear meetings storage", e);
    }
  }, [notesKey, activeIdKey]);

  return {
    meetings,
    activeMeeting,
    activeMeetingId,
    setActiveMeetingId,
    createNewMeeting,
    updateMeeting,
    deleteMeeting,
    resetToSamples,
    clearAllMeetings,
  };
}

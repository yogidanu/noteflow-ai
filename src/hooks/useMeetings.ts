import { useState, useEffect, useCallback } from "react";
import { MeetingNote } from "../types/meeting";
import { INITIAL_SAMPLE_MEETINGS } from "../lib/sampleData";

const STORAGE_KEY = "noteflow_meetings_v1";
const ACTIVE_ID_KEY = "noteflow_active_meeting_id";

export function useMeetings(isDemoMode = false) {
  const [meetings, setMeetings] = useState<MeetingNote[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
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
      const savedId = localStorage.getItem(ACTIVE_ID_KEY);
      if (savedId) return savedId;
    } catch (e) {
      console.error("Failed to read active meeting id", e);
    }
    return isDemoMode ? INITIAL_SAMPLE_MEETINGS[0]?.id || null : null;
  });

  // Sync to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(meetings));
    } catch (e) {
      console.error("Failed to save meetings to storage", e);
    }
  }, [meetings]);

  useEffect(() => {
    if (activeMeetingId) {
      try {
        localStorage.setItem(ACTIVE_ID_KEY, activeMeetingId);
      } catch (e) {
        console.error("Failed to save active id", e);
      }
    } else {
      localStorage.removeItem(ACTIVE_ID_KEY);
    }
  }, [activeMeetingId]);

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
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(ACTIVE_ID_KEY);
    } catch (e) {
      console.error("Failed to clear meetings storage", e);
    }
  }, []);

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

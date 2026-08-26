import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "./hooks/useAuth";
import { useMeetings } from "./hooks/useMeetings";
import { useAISummarizer, GenerationStage } from "./hooks/useAISummarizer";
import { useMeetRecord } from "./hooks/useMeetRecord";
import { useTheme } from "./hooks/useTheme";
import { AuthWelcomeScreen } from "./components/auth/AuthWelcomeScreen";
import { DesktopLoginScreen } from "./components/auth/DesktopLoginScreen";
import { ProfileSetupScreen } from "./components/auth/ProfileSetupScreen";
import { CalendarSetupScreen } from "./components/auth/CalendarSetupScreen";
import { MeetingDetectionSetupScreen } from "./components/auth/MeetingDetectionSetupScreen";
import { OnboardingCompleteScreen } from "./components/auth/OnboardingCompleteScreen";
import { AppHeader } from "./components/layout/AppHeader";
import { Sidebar } from "./components/layout/Sidebar/Sidebar";
import { WorkspaceCanvas } from "./components/workspace/WorkspaceCanvas";
import { ConfirmDeleteModal } from "./components/modals/ConfirmDeleteModal";
import { OAuthConsentModal } from "./components/modals/OAuthConsentModal";
import { MeetingDetectionSetupModal } from "./components/modals/MeetingDetectionSetupModal";
import { UserProfileModal } from "./components/modals/UserProfileModal";
import { RecordConfirmModal } from "./components/modals/RecordConfirmModal";
import { StopConfirmModal } from "./components/modals/StopConfirmModal";
import { LiveRecordingWidget } from "./components/workspace/meet/LiveRecordingWidget";
import { NotificationToast } from "./components/feedback/NotificationToast";
import { meetSummaryBridge, ToastNotificationPayload } from "./lib/meetSummaryBridge";
import { MeetingNote, RefinementPromptType, DetectedMeeting } from "./types/meeting";

export function App() {
  const { themeMode, setThemeMode } = useTheme();

  // Authentication & FTUX State
  const {
    user,
    isAuthenticated,
    isDemoMode,
    isOnboardingComplete,
    completeOnboarding,
    isAuthenticating,
    authError,
    setAuthError,
    updateProfile,
    loginWithGoogle,
    loginWithEmail,
    logout,
    enterDemoMode,
    exitDemoMode,
  } = useAuth();

  // Meeting Notes State
  const {
    meetings,
    activeMeeting,
    activeMeetingId,
    setActiveMeetingId,
    createNewMeeting,
    updateMeeting,
    deleteMeeting,
    resetToSamples,
    clearAllMeetings,
  } = useMeetings(isDemoMode);

  // AI Summarizer State
  const {
    stage,
    progress,
    errorMessage,
    isGenerating,
    generateSummary,
  } = useAISummarizer();

  // Calendar & Meet Ingress State
  const {
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
    recordingLifecycleState,
    recordingSeconds,
    isPaused,
    audioPowerLevel,
    connectCalendar,
    disconnectCalendar,
    syncCalendar,
    toggleMeetingRecording,
    startLiveRecording,
    togglePauseRecording,
    stopRecording,
    quickJoinUrl,
    retryMeeting,
  } = useMeetRecord(isDemoMode, user?.email, user?.id);

  // Onboarding Step Flow Progression (Transient skips for optional steps)
  const [skippedCalendar, setSkippedCalendar] = useState(false);
  const [skippedDetection, setSkippedDetection] = useState(false);

  // Navigation, Modal, and Toast States
  const [viewMode, setViewMode] = useState<"feed" | "workspace">("feed");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [meetingToDelete, setMeetingToDelete] = useState<MeetingNote | null>(null);
  const [isOAuthModalOpen, setIsOAuthModalOpen] = useState(false);
  const [isDetectionModalOpen, setIsDetectionModalOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [confirmRecordMeeting, setConfirmRecordMeeting] = useState<DetectedMeeting | null>(null);
  const [isStopConfirmOpen, setIsStopConfirmOpen] = useState(false);
  const [activeToast, setActiveToast] = useState<ToastNotificationPayload | null>(null);

  // Dynamic Generation Stage for Integration Bridge
  const [bridgeStage, setBridgeStage] = useState<GenerationStage>(stage);
  const [bridgeProgress, setBridgeProgress] = useState<number>(progress);

  // Sync internal summarizer stage with bridge stage
  useEffect(() => {
    setBridgeStage(stage);
    setBridgeProgress(progress);
  }, [stage, progress]);

  // Reset onboarding step skips when user logs out
  useEffect(() => {
    if (!isAuthenticated) {
      setSkippedCalendar(false);
      setSkippedDetection(false);
    }
  }, [isAuthenticated]);

  // Handle AI generation trigger via Integration Bridge
  const handleGenerateSummary = useCallback(
    async (meeting: MeetingNote, refinement: RefinementPromptType = "standard") => {
      updateMeeting(meeting.id, { status: "generating" });
      setBridgeStage("sanitizing");
      setBridgeProgress(10);

      try {
        const result = await meetSummaryBridge.processTranscriptToSummary({
          meetingId: meeting.id,
          meetingTitle: meeting.title,
          rawTranscript: meeting.rawInput,
          refinement,
          onProgress: (stg, prg) => {
            setBridgeStage(stg as GenerationStage);
            setBridgeProgress(prg);
          },
        });

        setBridgeStage("done");
        setBridgeProgress(100);

        updateMeeting(meeting.id, {
          title: meeting.title.startsWith("Untitled Meeting") || meeting.title.startsWith("Ad-hoc") ? result.title : meeting.title,
          sanitizedInput: result.sanitizedInput,
          analysis: result.analysis,
          status: "completed",
          errorMessage: undefined,
        });

        // Trigger Notification Toast
        setActiveToast({
          id: `toast-${Date.now()}`,
          type: "success",
          title: "Meeting Summary Ready",
          message: `✨ ${result.title}: ${result.analysis.decisions.length} decisions & ${result.analysis.actionItems.length} actions synthesized.`,
          meetingId: meeting.id,
          decisionCount: result.analysis.decisions.length,
          actionCount: result.analysis.actionItems.length,
          timestamp: Date.now(),
        });
      } catch (err: any) {
        console.error("[App Bridge Error]", err);
        setBridgeStage("error");
        updateMeeting(meeting.id, {
          status: "error",
          errorMessage: err?.message || "Synthesis failed",
        });

        setActiveToast({
          id: `toast-err-${Date.now()}`,
          type: "error",
          title: "Summary Generation Error",
          message: err?.message || "Failed to analyze transcript. Please retry.",
          meetingId: meeting.id,
          timestamp: Date.now(),
        });
      }
    },
    [updateMeeting]
  );

  // Sample quick loader
  const handleLoadSample = useCallback(
    (sampleText: string, title: string) => {
      const newM = createNewMeeting(sampleText, true, title);
      setViewMode("workspace");
      setTimeout(() => {
        handleGenerateSummary(newM);
      }, 100);
    },
    [createNewMeeting, handleGenerateSummary]
  );

  // Handle Live Recording Stop & Synthesis Handoff via Bridge
  const handleStopAndSynthesize = useCallback(() => {
    if (!activeRecordingMeetingId) return;

    stopRecording(activeRecordingMeetingId, (completedMeeting, rawTranscript) => {
      // 1. Create a new MeetingNote in NoteFlow
      const newMeeting = createNewMeeting(
        rawTranscript,
        false,
        completedMeeting.title
      );
      newMeeting.userId = user?.id;
      newMeeting.platform = completedMeeting.platform;
      newMeeting.meetingUrl = completedMeeting.meetingUrl;
      newMeeting.detectedMeetingId = completedMeeting.id;
      newMeeting.calendarEventId = completedMeeting.calendarEventId;
      newMeeting.recordingSessionId = completedMeeting.id;

      // 2. Switch view to Workspace Canvas & trigger AI synthesis through bridge
      setViewMode("workspace");
      setTimeout(() => {
        handleGenerateSummary(newMeeting);
      }, 150);
    });
  }, [activeRecordingMeetingId, stopRecording, createNewMeeting, handleGenerateSummary]);

  // Keyboard Shortcuts (Cmd+N, Cmd+Enter, Cmd+K, Cmd+Shift+R)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl + N: New Meeting
      if ((e.metaKey || e.ctrlKey) && e.key === "n" && !e.shiftKey) {
        e.preventDefault();
        createNewMeeting();
        setViewMode("workspace");
      }

      // Cmd/Ctrl + K: Toggle Meet Record Feed
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setViewMode((prev) => (prev === "feed" ? "workspace" : "feed"));
      }

      // Cmd/Ctrl + Enter: Generate Summary when active meeting has text
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        if (activeMeeting && activeMeeting.rawInput.trim() && !isGenerating && (bridgeStage === "idle" || bridgeStage === "done" || bridgeStage === "error")) {
          e.preventDefault();
          handleGenerateSummary(activeMeeting);
        }
      }

      // Cmd/Ctrl + Shift + R: Emergency Stop Active Recording
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === "r") {
        if (activeRecordingMeetingId) {
          e.preventDefault();
          handleStopAndSynthesize();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    createNewMeeting,
    activeMeeting,
    isGenerating,
    bridgeStage,
    handleGenerateSummary,
    activeRecordingMeetingId,
    handleStopAndSynthesize,
  ]);

  // -------------------------------------------------------------
  // APPLICATION ROUTING STATE MACHINE
  // -------------------------------------------------------------

  // SPECIAL ROUTE: Desktop Application PKCE Authentication Bridge
  const isDesktopLoginRoute =
    typeof window !== "undefined" &&
    (window.location.pathname.startsWith("/auth/desktop-login") ||
      (window.location.search.includes("code_challenge=") && !(window as any).noteFlowDesktop));

  if (isDesktopLoginRoute) {
    return <DesktopLoginScreen />;
  }

  // ROUTE 1: IF unauthenticated (and not exploring demo sandbox) → Welcome/Login Screen
  if (!isAuthenticated && !isDemoMode) {
    return (
      <AuthWelcomeScreen
        onSignInWithGoogle={async (email, name) => {
          const res = await loginWithGoogle(email, name);
          if (res) clearAllMeetings();
          return res;
        }}
        onSignInWithEmail={(email, name) => {
          const res = loginWithEmail(email, name);
          if (res) clearAllMeetings();
          return res;
        }}
        onEnterDemoMode={() => {
          enterDemoMode();
          resetToSamples();
        }}
        isAuthenticating={isAuthenticating}
        authError={authError}
        onClearError={() => setAuthError(null)}
      />
    );
  }

  // ROUTE 2: IF authenticated AND NoteFlow profile not completed → Profile Setup Screen
  if (user && !isDemoMode && user.profileCompleted === false) {
    return (
      <ProfileSetupScreen
        user={user}
        onSaveProfile={async (data) => {
          await updateProfile(data);
          setActiveToast({
            id: `toast-${Date.now()}`,
            type: "success",
            title: "Profile Configured",
            message: `✨ Welcome, ${data.fullName}! Your NoteFlow workspace is personalized.`,
            timestamp: Date.now(),
          });
        }}
        onLogout={logout}
      />
    );
  }

  // ROUTE 3: IF authenticated AND calendar not connected (onboarding incomplete) → Calendar Setup Step
  if (user && !isDemoMode && !isOnboardingComplete && !calendarState.isConnected && !skippedCalendar) {
    return (
      <CalendarSetupScreen
        user={user}
        isConnecting={isSyncingCalendar}
        status={calendarState.status}
        error={calendarError}
        onConnectCalendar={async (email) => {
          await connectCalendar(email || user.email);
        }}
        onSkip={() => setSkippedCalendar(true)}
        onLogout={logout}
      />
    );
  }

  // ROUTE 4: IF calendar connected AND meeting detection disabled (onboarding incomplete) → Meeting Detection Setup Step
  if (user && !isDemoMode && !isOnboardingComplete && !isDetectionEnabled && !skippedDetection) {
    return (
      <MeetingDetectionSetupScreen
        user={user}
        currentState={detectionState}
        onEnable={async () => {
          await enableMeetingDetection();
        }}
        onSkip={() => setSkippedDetection(true)}
        onRetry={async () => {
          await retryMeetingDetection();
        }}
        onLogout={logout}
      />
    );
  }

  // ROUTE 5: IF onboarding incomplete (all prerequisites completed or acknowledged) → Onboarding Completion Screen
  if (user && !isDemoMode && !isOnboardingComplete) {
    return (
      <OnboardingCompleteScreen
        user={user}
        accountEmail={calendarState.accountEmail || user.email}
        onGoToDashboard={() => {
          completeOnboarding();
          setViewMode("feed");
        }}
      />
    );
  }

  // ROUTE 6: IF onboarding complete OR returning authenticated user OR demo mode → Full Dashboard Shell
  return (
    <div className="flex flex-col h-screen w-screen bg-[var(--bg-canvas)] text-[var(--text-primary)] overflow-hidden select-none font-sans transition-colors duration-150">
      {/* Top Application Header */}
      <AppHeader
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        calendarState={calendarState}
        isRecordingActive={!!activeRecordingMeetingId}
        onOpenOAuthModal={() => setIsOAuthModalOpen(true)}
        onOpenDetectionModal={() => setIsDetectionModalOpen(true)}
        onOpenProfileModal={() => setIsProfileModalOpen(true)}
        isDetectionEnabled={isDetectionEnabled}
        onResetSamples={resetToSamples}
        currentView={viewMode}
        onSwitchView={setViewMode}
        themeMode={themeMode}
        onThemeChange={setThemeMode}
        user={user}
        isDemoMode={isDemoMode}
        onLogout={logout}
        onExitDemoMode={exitDemoMode}
      />

      {/* Main App Workspace Shell */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Navigation Sidebar */}
        <Sidebar
          meetings={meetings}
          activeMeetingId={activeMeetingId}
          onSelectMeeting={(id) => {
            setActiveMeetingId(id);
            setViewMode("workspace");
          }}
          onNewMeeting={() => {
            createNewMeeting();
            setViewMode("workspace");
          }}
          onDeleteMeeting={(id) => {
            const target = meetings.find((m) => m.id === id);
            if (target) setMeetingToDelete(target);
          }}
          isOpen={sidebarOpen}
          onCloseMobile={() => setSidebarOpen(false)}
          onOpenFeedView={() => setViewMode("feed")}
        />

        {/* Central Dynamic Workspace Canvas */}
        <WorkspaceCanvas
          activeMeeting={activeMeeting}
          onUpdateMeeting={updateMeeting}
          onGenerateSummary={handleGenerateSummary}
          isGenerating={bridgeStage !== "idle" && bridgeStage !== "done" && bridgeStage !== "error"}
          generationStage={bridgeStage}
          generationProgress={bridgeProgress}
          errorMessage={errorMessage}
          onLoadSample={handleLoadSample}
          onStartBlank={() => {
            createNewMeeting();
            setViewMode("workspace");
          }}
          isDemoMode={isDemoMode}
          viewMode={viewMode}
          calendarState={calendarState}
          detectedMeetings={detectedMeetings}
          isSyncingCalendar={isSyncingCalendar}
          isDetectionEnabled={isDetectionEnabled}
          onOpenDetectionModal={() => setIsDetectionModalOpen(true)}
          onSyncCalendar={syncCalendar}
          onOpenOAuthModal={() => setIsOAuthModalOpen(true)}
          onToggleMeetingRecording={toggleMeetingRecording}
          onStartLiveRecording={(id) => {
            startLiveRecording(id);
          }}
          onQuickJoinUrl={(url) => {
            quickJoinUrl(url);
          }}
          onRetryMeeting={retryMeeting}
          onOpenConfirmModal={(m) => setConfirmRecordMeeting(m)}
          onSwitchToWorkspace={() => setViewMode("workspace")}
          activeRecordingMeeting={activeRecordingMeeting}
          recordingLifecycleState={recordingLifecycleState}
          recordingSeconds={recordingSeconds}
          isRecordingPaused={isPaused}
          audioPowerLevel={audioPowerLevel}
          onTogglePauseRecording={togglePauseRecording}
          onStopRecording={() => setIsStopConfirmOpen(true)}
        />
      </div>

      {/* Floating In-Call Live Recording Widget */}
      {activeRecordingMeeting && (
        <LiveRecordingWidget
          meeting={activeRecordingMeeting}
          seconds={recordingSeconds}
          isPaused={isPaused}
          audioPowerLevel={audioPowerLevel}
          onTogglePause={togglePauseRecording}
          onStopAndSynthesize={() => setIsStopConfirmOpen(true)}
        />
      )}

      {/* Confirmation Modal before Stopping Active Ingress */}
      <StopConfirmModal
        isOpen={isStopConfirmOpen}
        onClose={() => setIsStopConfirmOpen(false)}
        onConfirm={handleStopAndSynthesize}
        meeting={activeRecordingMeeting}
        durationSeconds={recordingSeconds}
      />

      {/* Real-time Notification Toast for Summary Ready & Error Recovery */}
      <NotificationToast
        toast={activeToast}
        onDismiss={() => setActiveToast(null)}
        onActionClick={(meetingId) => {
          if (meetingId) {
            setActiveMeetingId(meetingId);
            setViewMode("workspace");
          }
        }}
        onRetry={(meetingId) => {
          if (meetingId) {
            const target = meetings.find((m) => m.id === meetingId);
            if (target) {
              handleGenerateSummary(target);
            }
          }
        }}
      />

      {/* NoteFlow User Profile & Connected Services Modal */}
      <UserProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        user={user}
        calendarState={calendarState}
        onUpdateProfile={async (data) => {
          await updateProfile(data);
          setActiveToast({
            id: `toast-${Date.now()}`,
            type: "success",
            title: "Profile Saved",
            message: "Your profile changes were saved successfully.",
            timestamp: Date.now(),
          });
        }}
        onOpenCalendarModal={() => setIsOAuthModalOpen(true)}
        onDisconnectCalendar={disconnectCalendar}
        onLogout={logout}
      />

      {/* Google Calendar OAuth Consent & Management Modal */}
      <OAuthConsentModal
        isOpen={isOAuthModalOpen}
        onClose={() => setIsOAuthModalOpen(false)}
        calendarState={calendarState}
        defaultEmail={user?.email}
        onConfirm={(email) => {
          connectCalendar(email);
        }}
        onDisconnect={disconnectCalendar}
      />

      {/* Meeting Detection Setup & Settings Modal */}
      <MeetingDetectionSetupModal
        isOpen={isDetectionModalOpen}
        onClose={() => setIsDetectionModalOpen(false)}
        currentState={detectionState}
        onEnable={enableMeetingDetection}
        onDisable={disableMeetingDetection}
        onRetry={retryMeetingDetection}
      />

      {/* Explicit Recording Opt-In Confirmation Modal */}
      <RecordConfirmModal
        isOpen={!!confirmRecordMeeting}
        onClose={() => setConfirmRecordMeeting(null)}
        meeting={confirmRecordMeeting}
        onConfirm={() => {
          if (confirmRecordMeeting) {
            toggleMeetingRecording(confirmRecordMeeting.id, true);
            setConfirmRecordMeeting(null);
          }
        }}
      />

      {/* Confirmation Modal for safe deletion */}
      <ConfirmDeleteModal
        isOpen={!!meetingToDelete}
        onClose={() => setMeetingToDelete(null)}
        onConfirm={() => {
          if (meetingToDelete) {
            deleteMeeting(meetingToDelete.id);
            setMeetingToDelete(null);
          }
        }}
        meetingTitle={meetingToDelete?.title || "Meeting"}
      />
    </div>
  );
}

export default App;

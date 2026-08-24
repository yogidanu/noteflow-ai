import React, { useState, useRef, useEffect } from "react";
import { Sparkles, Calendar, Menu, RefreshCw, Sun, Moon, Monitor, Check, User, LogOut, Compass, Bell, BellOff, Sliders } from "lucide-react";
import { CalendarConnectionState } from "../../types/meeting";
import { ThemeMode } from "../../hooks/useTheme";
import { UserProfile } from "../../hooks/useAuth";

interface AppHeaderProps {
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  calendarState: CalendarConnectionState;
  isRecordingActive: boolean;
  onOpenOAuthModal: () => void;
  onOpenDetectionModal?: () => void;
  isDetectionEnabled?: boolean;
  onResetSamples: () => void;
  currentView: "feed" | "workspace";
  onSwitchView: (view: "feed" | "workspace") => void;
  themeMode?: ThemeMode;
  onThemeChange?: (theme: ThemeMode) => void;
  user?: UserProfile | null;
  isDemoMode?: boolean;
  onLogout?: () => void;
  onExitDemoMode?: () => void;
}

export const AppHeader: React.FC<AppHeaderProps> = ({
  sidebarOpen,
  setSidebarOpen,
  calendarState,
  isRecordingActive,
  onOpenOAuthModal,
  onOpenDetectionModal,
  isDetectionEnabled = false,
  onResetSamples,
  currentView,
  onSwitchView,
  themeMode = "light",
  onThemeChange,
  user,
  isDemoMode = false,
  onLogout,
  onExitDemoMode,
}) => {
  const [isThemeMenuOpen, setIsThemeMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const themeMenuRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (themeMenuRef.current && !themeMenuRef.current.contains(e.target as Node)) {
        setIsThemeMenuOpen(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const getThemeIcon = () => {
    switch (themeMode) {
      case "dark":
        return <Moon className="w-3.5 h-3.5 text-indigo-500" />;
      case "system":
        return <Monitor className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />;
      default:
        return <Sun className="w-3.5 h-3.5 text-amber-500" />;
    }
  };

  const userInitials = user?.name
    ? user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .substring(0, 2)
        .toUpperCase()
    : "U";

  return (
    <header className="h-14 border-b border-[var(--border-default)] bg-[var(--surface-card)] px-4 flex items-center justify-between z-30 shrink-0 select-none transition-colors duration-150">
      {/* Left: Brand & Mobile Menu */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-subtle)] focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] outline-none rounded-lg transition-colors md:hidden cursor-pointer"
          title="Toggle Sidebar"
          aria-label="Toggle Sidebar"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-[var(--primary-action)] flex items-center justify-center text-white font-bold shadow-xs">
            <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm tracking-tight text-[var(--text-primary)]">
                NoteFlow <span className="text-[var(--primary-action)] font-normal">AI</span>
              </span>
              <span className="text-[10px] font-semibold tracking-wider uppercase px-1.5 py-0.5 rounded-md bg-[var(--surface-subtle)] text-[var(--text-muted)] border border-[var(--border-subtle)]">
                Meet Record
              </span>
            </div>
          </div>
        </div>

        {/* Demo Mode Badge */}
        {isDemoMode && (
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 text-[11px] font-medium font-mono">
            <Compass className="w-3 h-3" />
            <span>Sandbox Mode</span>
          </div>
        )}

        {/* Linear-style Segmented View Mode Switcher */}
        <div className="hidden lg:flex items-center gap-0.5 ml-4 p-0.5 rounded-xl bg-[var(--surface-subtle)] border border-[var(--border-default)]" role="tablist" aria-label="Workspace views">
          <button
            role="tab"
            aria-selected={currentView === "feed"}
            onClick={() => onSwitchView("feed")}
            className={`px-3 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] outline-none ${
              currentView === "feed"
                ? "bg-[var(--surface-card)] text-[var(--text-primary)] shadow-xs font-semibold"
                : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            }`}
          >
            Meet Record Feed
          </button>
          <button
            role="tab"
            aria-selected={currentView === "workspace"}
            onClick={() => onSwitchView("workspace")}
            className={`px-3 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] outline-none ${
              currentView === "workspace"
                ? "bg-[var(--surface-card)] text-[var(--text-primary)] shadow-xs font-semibold"
                : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            }`}
          >
            Summary Canvas
          </button>
        </div>
      </div>

      {/* Right: Live Status & Actions */}
      <div className="flex items-center gap-2.5">
        {/* Live Recording Active Pill */}
        {isRecordingActive && (
          <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--success-surface)] border border-[var(--success-border)] text-[var(--color-success)] text-xs font-semibold">
            <span className="w-2 h-2 rounded-full bg-[var(--color-recording-pulse)] animate-pulse"></span>
            <span>Live Recording</span>
          </div>
        )}

        {/* Google Calendar Status Pill */}
        {calendarState.isConnected ? (
          <button
            type="button"
            onClick={onOpenOAuthModal}
            aria-label={`Google Calendar connected as ${calendarState.accountEmail || "workspace user"}. Click to view permissions.`}
            className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[var(--surface-card)] border border-[var(--border-default)] text-[var(--text-secondary)] text-xs font-medium cursor-pointer hover:bg-[var(--surface-subtle)] focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] outline-none transition-all shadow-2xs"
            title="Google Calendar connected. Click to view permissions."
          >
            <Calendar className="w-3.5 h-3.5 text-[var(--primary-action)]" aria-hidden="true" />
            <span className="max-w-[140px] truncate">{calendarState.accountEmail?.split("@")[0]}</span>
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-success)]" aria-hidden="true"></span>
          </button>
        ) : (
          <button
            onClick={onOpenOAuthModal}
            className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full bg-[var(--primary-surface)] hover:opacity-90 border border-[var(--primary-border)] text-[var(--primary-action)] text-xs font-medium transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] outline-none"
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>Connect Calendar</span>
          </button>
        )}

        {/* Meeting Detection Settings Button */}
        {calendarState.isConnected && onOpenDetectionModal && (
          <button
            onClick={onOpenDetectionModal}
            aria-label={`Meeting detection: ${isDetectionEnabled ? "Active" : "Paused"}. Click to configure.`}
            className={`hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] outline-none shadow-2xs ${
              isDetectionEnabled
                ? "bg-[var(--success-surface)] border-[var(--success-border)] text-[var(--color-success)]"
                : "bg-[var(--surface-card)] border-[var(--border-default)] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            }`}
            title="Configure Meeting Detection"
          >
            {isDetectionEnabled ? (
              <>
                <Bell className="w-3.5 h-3.5 text-[var(--color-success)]" />
                <span>Detection On</span>
              </>
            ) : (
              <>
                <BellOff className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                <span>Detection Paused</span>
              </>
            )}
          </button>
        )}

        {/* Theme Selector Dropdown */}
        <div className="relative" ref={themeMenuRef}>
          <button
            onClick={() => setIsThemeMenuOpen(!isThemeMenuOpen)}
            aria-label={`Current theme: ${themeMode}. Click to toggle theme.`}
            className="p-2 rounded-xl text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-subtle)] border border-[var(--border-default)] transition-colors cursor-pointer flex items-center gap-1 focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] outline-none"
            title={`Theme: ${themeMode} (Click to switch)`}
          >
            {getThemeIcon()}
          </button>

          {isThemeMenuOpen && (
            <div className="absolute right-0 mt-2 w-36 rounded-2xl bg-[var(--surface-elevated)] border border-[var(--border-default)] shadow-xl p-1 z-50 animate-fadeIn text-xs">
              <button
                onClick={() => {
                  onThemeChange?.("light");
                  setIsThemeMenuOpen(false);
                }}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] outline-none ${
                  themeMode === "light"
                    ? "bg-[var(--primary-surface)] text-[var(--primary-action)] font-semibold"
                    : "text-[var(--text-secondary)] hover:bg-[var(--surface-subtle)]"
                }`}
              >
                <span className="flex items-center gap-2">
                  <Sun className="w-3.5 h-3.5 text-amber-500" />
                  <span>Light</span>
                </span>
                {themeMode === "light" && <Check className="w-3 h-3" />}
              </button>

              <button
                onClick={() => {
                  onThemeChange?.("dark");
                  setIsThemeMenuOpen(false);
                }}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] outline-none ${
                  themeMode === "dark"
                    ? "bg-[var(--primary-surface)] text-[var(--primary-action)] font-semibold"
                    : "text-[var(--text-secondary)] hover:bg-[var(--surface-subtle)]"
                }`}
              >
                <span className="flex items-center gap-2">
                  <Moon className="w-3.5 h-3.5 text-indigo-500" />
                  <span>Dark</span>
                </span>
                {themeMode === "dark" && <Check className="w-3 h-3" />}
              </button>

              <button
                onClick={() => {
                  onThemeChange?.("system");
                  setIsThemeMenuOpen(false);
                }}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] outline-none ${
                  themeMode === "system"
                    ? "bg-[var(--primary-surface)] text-[var(--primary-action)] font-semibold"
                    : "text-[var(--text-secondary)] hover:bg-[var(--surface-subtle)]"
                }`}
              >
                <span className="flex items-center gap-2">
                  <Monitor className="w-3.5 h-3.5 text-slate-500" />
                  <span>System</span>
                </span>
                {themeMode === "system" && <Check className="w-3 h-3" />}
              </button>
            </div>
          )}
        </div>

        {/* User Profile & Sign Out Menu */}
        {user ? (
          <div className="relative" ref={userMenuRef}>
            <button
              onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
              className="flex items-center gap-2 p-1 pl-2 rounded-xl hover:bg-[var(--surface-subtle)] border border-[var(--border-default)] transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] outline-none"
              title={user.email}
            >
              <div className="w-6 h-6 rounded-full bg-[var(--primary-action)] text-white text-[10px] font-bold flex items-center justify-center">
                {userInitials}
              </div>
              <span className="text-xs font-medium text-[var(--text-primary)] max-w-[100px] truncate hidden md:inline">
                {user.name.split(" ")[0]}
              </span>
            </button>

            {isUserMenuOpen && (
              <div className="absolute right-0 mt-2 w-56 rounded-2xl bg-[var(--surface-elevated)] border border-[var(--border-default)] shadow-xl p-2 z-50 animate-fadeIn text-xs space-y-1">
                <div className="px-2.5 py-1.5 border-b border-[var(--border-subtle)]">
                  <div className="font-semibold text-[var(--text-primary)] truncate">{user.name}</div>
                  <div className="text-[10px] text-[var(--text-muted)] truncate">{user.email}</div>
                  {isDemoMode && (
                    <span className="inline-block mt-1 px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[9px] font-mono">
                      Sandbox Account
                    </span>
                  )}
                </div>

                {onOpenDetectionModal && (
                  <button
                    onClick={() => {
                      setIsUserMenuOpen(false);
                      onOpenDetectionModal();
                    }}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-subtle)] transition-colors cursor-pointer"
                  >
                    <Sliders className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                    <span>Meeting Detection Settings</span>
                  </button>
                )}

                {isDemoMode ? (
                  <button
                    onClick={() => {
                      setIsUserMenuOpen(false);
                      onExitDemoMode?.();
                    }}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/30 transition-colors cursor-pointer"
                  >
                    <Compass className="w-3.5 h-3.5" />
                    <span>Exit Demo Sandbox</span>
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      setIsUserMenuOpen(false);
                      onLogout?.();
                    }}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[var(--color-error)] hover:bg-[var(--error-surface)] transition-colors cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Sign Out</span>
                  </button>
                )}
              </div>
            )}
          </div>
        ) : null}

        {isDemoMode && (
          <button
            onClick={onResetSamples}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-subtle)] rounded-lg transition-colors border border-[var(--border-default)] cursor-pointer focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] outline-none"
            title="Restore standard sample meetings"
          >
            <RefreshCw className="w-3.5 h-3.5 text-[var(--text-subtle)]" />
            <span className="hidden md:inline">Reset Sandbox</span>
          </button>
        )}
      </div>
    </header>
  );
};

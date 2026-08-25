import React, { useState, useEffect } from "react";
import { X, User, MapPin, Calendar, CheckCircle2, AlertCircle, Loader2, LogOut, Sparkles, Shield, ExternalLink } from "lucide-react";
import { UserProfile } from "../../hooks/useAuth";
import { CalendarConnectionState } from "../../types/meeting";

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserProfile | null;
  calendarState: CalendarConnectionState;
  onUpdateProfile: (data: { fullName: string; city?: string; country?: string; avatarUrl?: string }) => Promise<any>;
  onOpenCalendarModal?: () => void;
  onDisconnectCalendar?: () => void;
  onLogout?: () => void;
}

export const UserProfileModal: React.FC<UserProfileModalProps> = ({
  isOpen,
  onClose,
  user,
  calendarState,
  onUpdateProfile,
  onOpenCalendarModal,
  onDisconnectCalendar,
  onLogout,
}) => {
  const [fullName, setFullName] = useState<string>("");
  const [city, setCity] = useState<string>("");
  const [country, setCountry] = useState<string>("");
  const [avatarUrl, setAvatarUrl] = useState<string>("");
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      setFullName(user.displayName || user.name || "");
      setCity(user.city || "");
      setCountry(user.country || "");
      setAvatarUrl(user.avatarUrl || "");
      setSaveSuccess(false);
      setErrorMessage(null);
    }
  }, [user, isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !user) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || fullName.trim().length < 2) {
      setErrorMessage("Full name must be at least 2 characters.");
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);
    setSaveSuccess(false);

    try {
      await onUpdateProfile({
        fullName: fullName.trim(),
        city: city.trim() || undefined,
        country: country.trim() || undefined,
        avatarUrl: avatarUrl.trim() || undefined,
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      setErrorMessage(err?.message || "Failed to update profile.");
    } finally {
      setIsSaving(false);
    }
  };

  const userInitials = fullName
    ? fullName
        .split(" ")
        .map((n) => n[0])
        .join("")
        .substring(0, 2)
        .toUpperCase()
    : "U";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="profile-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150"
    >
      <div className="relative w-full max-w-lg bg-[var(--surface-card)] rounded-2xl border border-[var(--border-default)] shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-subtle)] bg-[var(--surface-subtle)]">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-[var(--primary-action)]/10 text-[var(--primary-action)] flex items-center justify-center">
              <User className="w-4 h-4" />
            </div>
            <div>
              <h2 id="profile-modal-title" className="text-sm font-semibold text-[var(--text-primary)]">
                NoteFlow Profile & Services
              </h2>
              <p className="text-[11px] text-[var(--text-muted)]">
                Personal details and connected workspace integrations
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-card)] rounded-lg transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
          {/* Section 1: Personal Information */}
          <form onSubmit={handleSave} className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                Personal Information
              </h3>
              {saveSuccess && (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400 animate-in fade-in">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Saved
                </span>
              )}
            </div>

            {/* Profile Avatar & Header */}
            <div className="flex items-center gap-4 p-3 rounded-xl bg-[var(--surface-subtle)] border border-[var(--border-subtle)]">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={fullName}
                  className="w-12 h-12 rounded-full object-cover ring-2 ring-[var(--primary-action)]/20"
                />
              ) : (
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-semibold text-base ring-2 ring-[var(--primary-action)]/20">
                  {userInitials}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-[var(--text-primary)] truncate">
                  {fullName || "User Profile"}
                </div>
                <div className="text-xs text-[var(--text-muted)] font-mono truncate">
                  {user.email}
                </div>
              </div>
            </div>

            {/* Full Name */}
            <div>
              <label htmlFor="modal-fullname" className="block text-xs font-medium text-[var(--text-primary)] mb-1">
                Full Name
              </label>
              <input
                id="modal-fullname"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Full Name"
                className="w-full px-3 py-2 bg-[var(--bg-canvas)] border border-[var(--border-default)] rounded-xl text-xs text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary-action)] transition-colors"
              />
            </div>

            {/* Email (Readonly Google ID) */}
            <div>
              <label className="block text-xs font-medium text-[var(--text-primary)] mb-1">
                Google Workspace Email
              </label>
              <div className="flex items-center justify-between px-3 py-2 bg-[var(--surface-subtle)] border border-[var(--border-subtle)] rounded-xl text-xs text-[var(--text-muted)]">
                <span className="font-mono">{user.email}</span>
                <span className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  Signed in with Google
                </span>
              </div>
            </div>

            {/* Location (City & Country) */}
            <div>
              <label className="block text-xs font-medium text-[var(--text-primary)] mb-1">
                Location
              </label>
              <div className="grid grid-cols-2 gap-2.5">
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-[var(--text-muted)]">
                    <MapPin className="w-3.5 h-3.5" />
                  </div>
                  <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="City (e.g. Bengaluru)"
                    className="w-full pl-7 pr-2.5 py-2 bg-[var(--bg-canvas)] border border-[var(--border-default)] rounded-xl text-xs text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary-action)] transition-colors"
                  />
                </div>
                <div>
                  <input
                    type="text"
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    placeholder="Country (e.g. India)"
                    className="w-full px-2.5 py-2 bg-[var(--bg-canvas)] border border-[var(--border-default)] rounded-xl text-xs text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary-action)] transition-colors"
                  />
                </div>
              </div>
            </div>

            {errorMessage && (
              <div className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-600 dark:text-red-400">
                {errorMessage}
              </div>
            )}

            <div className="flex justify-end pt-1">
              <button
                type="submit"
                disabled={isSaving}
                className="px-4 py-2 rounded-xl bg-[var(--primary-action)] hover:bg-[var(--primary-action-hover)] text-white text-xs font-semibold shadow-xs flex items-center gap-1.5 cursor-pointer transition-all disabled:opacity-50"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <span>Save Changes</span>
                )}
              </button>
            </div>
          </form>

          {/* Section 2: Connected Services */}
          <div className="space-y-3 pt-4 border-t border-[var(--border-subtle)]">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              Connected Services
            </h3>

            {/* Google Authentication */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-[var(--surface-subtle)] border border-[var(--border-subtle)]">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-xs font-bold text-slate-700 dark:text-slate-200">
                  G
                </div>
                <div>
                  <div className="text-xs font-semibold text-[var(--text-primary)]">Google Identity</div>
                  <div className="text-[11px] text-[var(--text-muted)] font-mono">{user.email}</div>
                </div>
              </div>
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md">
                <CheckCircle2 className="w-3 h-3" />
                Connected
              </span>
            </div>

            {/* Google Calendar */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-[var(--surface-subtle)] border border-[var(--border-subtle)]">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                  <Calendar className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-semibold text-[var(--text-primary)]">Google Calendar v3</div>
                  <div className="text-[11px] text-[var(--text-muted)]">
                    {calendarState.isConnected ? "Upcoming meeting auto-detection active" : "Not connected"}
                  </div>
                </div>
              </div>

              {calendarState.isConnected ? (
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md">
                    <CheckCircle2 className="w-3 h-3" />
                    Active
                  </span>
                  {onDisconnectCalendar && (
                    <button
                      type="button"
                      onClick={onDisconnectCalendar}
                      className="text-[11px] text-red-600 hover:text-red-700 dark:text-red-400 hover:underline cursor-pointer"
                    >
                      Disconnect
                    </button>
                  )}
                </div>
              ) : (
                onOpenCalendarModal && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenCalendarModal();
                    }}
                    className="px-2.5 py-1 rounded-lg bg-[var(--primary-action)] text-white text-xs font-medium cursor-pointer hover:bg-[var(--primary-action-hover)] transition-colors"
                  >
                    Connect
                  </button>
                )
              )}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        {onLogout && (
          <div className="flex items-center justify-between px-6 py-3 border-t border-[var(--border-subtle)] bg-[var(--surface-subtle)]">
            <span className="text-[11px] text-[var(--text-muted)]">
              NoteFlow AI • Verified Workspace User
            </span>
            <button
              type="button"
              onClick={() => {
                onClose();
                onLogout();
              }}
              className="text-xs text-red-600 dark:text-red-400 hover:text-red-700 flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Log out</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

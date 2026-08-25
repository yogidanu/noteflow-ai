import React, { useState } from "react";
import { Sparkles, User, MapPin, ArrowRight, Loader2, CheckCircle2, Shield, LogOut } from "lucide-react";
import { UserProfile } from "../../hooks/useAuth";

interface ProfileSetupScreenProps {
  user: UserProfile;
  onSaveProfile: (data: { fullName: string; city?: string; country?: string; avatarUrl?: string }) => Promise<void>;
  onLogout?: () => void;
}

export const ProfileSetupScreen: React.FC<ProfileSetupScreenProps> = ({
  user,
  onSaveProfile,
  onLogout,
}) => {
  const [fullName, setFullName] = useState<string>(user.displayName || user.name || "");
  const [city, setCity] = useState<string>(user.city || "");
  const [country, setCountry] = useState<string>(user.country || "");
  const [avatarUrl, setAvatarUrl] = useState<string>(user.avatarUrl || "");
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || fullName.trim().length < 2) {
      setErrorMessage("Please enter your full name (at least 2 characters).");
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);

    try {
      await onSaveProfile({
        fullName: fullName.trim(),
        city: city.trim() || undefined,
        country: country.trim() || undefined,
        avatarUrl: avatarUrl.trim() || undefined,
      });
    } catch (err: any) {
      setErrorMessage(err?.message || "Failed to save profile. Please try again.");
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
    <main
      role="main"
      aria-label="NoteFlow AI Profile Setup"
      className="min-h-screen w-screen flex flex-col items-center justify-center p-4 sm:p-6 bg-[var(--bg-canvas)] text-[var(--text-primary)] select-none font-sans transition-colors"
    >
      <div className="w-full max-w-lg">
        {/* Brand Header */}
        <div className="flex flex-col items-center text-center mb-8">
          <div className="w-12 h-12 rounded-2xl bg-[var(--primary-action)] flex items-center justify-center text-white font-bold shadow-lg shadow-[var(--primary-action)]/20 mb-4 ring-8 ring-[var(--primary-action)]/10">
            <Sparkles className="w-6 h-6" aria-hidden="true" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[var(--text-primary)]">
            Welcome to NoteFlow AI
          </h1>
          <p className="text-sm text-[var(--text-muted)] mt-2 max-w-sm">
            Let's personalize your workspace profile so NoteFlow accurately represents you in meeting transcripts and action items.
          </p>
        </div>

        {/* Profile Card */}
        <div className="bg-[var(--surface-card)] rounded-2xl border border-[var(--border-default)] shadow-xl p-6 sm:p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Avatar Section */}
            <div className="flex items-center gap-4 p-3.5 rounded-xl bg-[var(--surface-subtle)] border border-[var(--border-subtle)]">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={fullName}
                  className="w-14 h-14 rounded-full object-cover ring-2 ring-[var(--primary-action)]/20"
                />
              ) : (
                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-semibold text-lg ring-2 ring-[var(--primary-action)]/20">
                  {userInitials}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-[var(--text-primary)]">Profile Photo</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--surface-card)] text-[var(--text-muted)] border border-[var(--border-subtle)]">
                    Google Synced
                  </span>
                </div>
                <p className="text-xs text-[var(--text-muted)] truncate mt-0.5">
                  Used in shared notes & speaker attribution.
                </p>
              </div>
            </div>

            {/* Full Name */}
            <div>
              <label htmlFor="fullName" className="block text-xs font-semibold text-[var(--text-primary)] mb-1.5">
                Full Name <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[var(--text-muted)]">
                  <User className="w-4 h-4" />
                </div>
                <input
                  id="fullName"
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Yogesh Danu"
                  className="w-full pl-9 pr-3.5 py-2.5 bg-[var(--bg-canvas)] border border-[var(--border-default)] rounded-xl text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--primary-action)] transition-colors"
                />
              </div>
            </div>

            {/* Email (Readonly Google Identity) */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-[var(--text-primary)]">
                  Google Workspace Account
                </label>
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="w-3 h-3" />
                  Verified
                </span>
              </div>
              <div className="flex items-center justify-between px-3.5 py-2.5 bg-[var(--surface-subtle)] border border-[var(--border-subtle)] rounded-xl text-sm text-[var(--text-muted)] select-text">
                <span className="font-mono text-xs truncate">{user.email}</span>
                <span className="text-[11px] font-medium text-[var(--text-muted)] shrink-0 ml-2">Signed in with Google</span>
              </div>
            </div>

            {/* Location (City & Country) */}
            <div>
              <label className="block text-xs font-semibold text-[var(--text-primary)] mb-1.5">
                Location <span className="text-[var(--text-muted)] font-normal">(Optional)</span>
              </label>
              <div className="grid grid-cols-2 gap-3">
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[var(--text-muted)]">
                    <MapPin className="w-3.5 h-3.5" />
                  </div>
                  <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="City (e.g. Bengaluru)"
                    className="w-full pl-8 pr-3 py-2 bg-[var(--bg-canvas)] border border-[var(--border-default)] rounded-xl text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--primary-action)] transition-colors"
                  />
                </div>
                <div>
                  <input
                    type="text"
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    placeholder="Country (e.g. India)"
                    className="w-full px-3 py-2 bg-[var(--bg-canvas)] border border-[var(--border-default)] rounded-xl text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--primary-action)] transition-colors"
                  />
                </div>
              </div>
            </div>

            {/* Error Message */}
            {errorMessage && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-600 dark:text-red-400">
                {errorMessage}
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSaving}
              className="w-full mt-2 py-3 px-4 rounded-xl bg-[var(--primary-action)] hover:bg-[var(--primary-action-hover)] text-white text-sm font-semibold shadow-md flex items-center justify-center gap-2 cursor-pointer transition-all disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Saving Profile...</span>
                </>
              ) : (
                <>
                  <span>Continue to Workspace</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Footer Navigation */}
          {onLogout && (
            <div className="mt-6 pt-4 border-t border-[var(--border-subtle)] flex items-center justify-center">
              <button
                type="button"
                onClick={onLogout}
                className="text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign in with a different account</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </main>
  );
};

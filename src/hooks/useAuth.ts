import { useState, useEffect, useCallback, useRef } from "react";
import { apiClient } from "../lib/apiClient";
import { desktopBridge } from "../lib/desktopBridge";

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string;
  organization?: string;
  provider: "google" | "email" | "demo";
}

const AUTH_STORAGE_KEY = "noteflow_auth_session_v1";
const DEMO_MODE_KEY = "noteflow_demo_mode_active";
const ONBOARDING_COMPLETE_KEY = "noteflow_onboarding_completed_v1";

export function useAuth() {
  const [user, setUser] = useState<UserProfile | null>(() => {
    try {
      const saved = localStorage.getItem(AUTH_STORAGE_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.error("[useAuth] Failed to load user session", e);
    }
    // Fresh install has NO logged-in user by default
    return null;
  });

  const [isDemoMode, setIsDemoMode] = useState<boolean>(() => {
    try {
      return localStorage.getItem(DEMO_MODE_KEY) === "true";
    } catch {
      return false;
    }
  });

  const [isOnboardingComplete, setIsOnboardingComplete] = useState<boolean>(() => {
    try {
      return localStorage.getItem(ONBOARDING_COMPLETE_KEY) === "true";
    } catch {
      return false;
    }
  });

  const [isAuthenticating, setIsAuthenticating] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Concurrency guard to prevent duplicate concurrent OAuth attempts
  const authLockRef = useRef<boolean>(false);

  // Sync session to localStorage & apiClient session context
  useEffect(() => {
    try {
      if (user) {
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
        apiClient.setSessionContext(user.id, user.email, user.name);
      } else {
        localStorage.removeItem(AUTH_STORAGE_KEY);
        apiClient.setSessionContext(null, null, null);
      }
    } catch (e) {
      console.error("[useAuth] Failed to persist auth session", e);
    }
  }, [user]);

  // Sync demo mode to localStorage
  useEffect(() => {
    try {
      if (isDemoMode) {
        localStorage.setItem(DEMO_MODE_KEY, "true");
      } else {
        localStorage.removeItem(DEMO_MODE_KEY);
      }
    } catch (e) {
      console.error("[useAuth] Failed to persist demo mode state", e);
    }
  }, [isDemoMode]);

  // Sync onboarding completion to localStorage
  useEffect(() => {
    try {
      if (isOnboardingComplete) {
        localStorage.setItem(ONBOARDING_COMPLETE_KEY, "true");
      } else {
        localStorage.removeItem(ONBOARDING_COMPLETE_KEY);
      }
    } catch (e) {
      console.error("[useAuth] Failed to persist onboarding state", e);
    }
  }, [isOnboardingComplete]);

  // Process OAuth Callback parameters and messages from popup or redirect
  useEffect(() => {
    if (typeof window === "undefined") return;

    // Check URL parameters on redirect return
    const params = new URLSearchParams(window.location.search);
    const cbUserId = params.get("userId");
    const cbEmail = params.get("email");
    const cbName = params.get("name");
    const cbError = params.get("error");
    const cbAvatar = params.get("avatarUrl");

    if (cbError) {
      setAuthError(cbError === "access_denied" ? "Google sign-in was cancelled." : `Authentication error: ${cbError}`);
      window.history.replaceState({}, document.title, window.location.pathname);
      return;
    }

    if (cbEmail) {
      const newUser: UserProfile = {
        id: cbUserId || `usr_${Date.now()}`,
        email: cbEmail,
        name: cbName || cbEmail.split("@")[0],
        avatarUrl: cbAvatar || undefined,
        organization: cbEmail.split("@")[1] || "Workspace",
        provider: "google",
      };

      // If opened inside popup window, broadcast to parent window and close
      if (window.opener && window.opener !== window) {
        try {
          window.opener.postMessage({ type: "NOTEFLOW_AUTH_SUCCESS", user: newUser }, window.location.origin);
          window.close();
          return;
        } catch {
          // Continue standard state update if postMessage fails
        }
      }

      setUser(newUser);
      setIsDemoMode(false);
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    // Listen for popup auth messages
    const handleAuthMessage = (event: MessageEvent) => {
      if (event.data?.type === "NOTEFLOW_AUTH_SUCCESS" && event.data?.user) {
        setUser(event.data.user);
        setIsAuthenticating(false);
        authLockRef.current = false;
      }
    };

    window.addEventListener("message", handleAuthMessage);
    return () => window.removeEventListener("message", handleAuthMessage);
  }, []);

  // Validate active session on startup / restoration
  useEffect(() => {
    async function validateSessionOnMount() {
      if (!user || isDemoMode) return;

      try {
        if (desktopBridge.isDesktop()) {
          const desktopSession = await desktopBridge.getSession();
          if (!desktopSession || (desktopSession.expiresAt && desktopSession.expiresAt < Date.now())) {
            console.warn("[useAuth] Desktop session expired or revoked on startup");
            logout();
          }
        } else {
          const backendSession = await apiClient.getSession(user.id);
          if (backendSession && !backendSession.isConnected) {
            // Backend session inactive or revoked
            console.warn("[useAuth] Remote session was revoked or expired");
          }
        }
      } catch (err) {
        console.warn("[useAuth] Session check fallback:", err);
      }
    }

    validateSessionOnMount();
  }, [user?.id, isDemoMode]);

  /**
   * Initiates real Google OAuth 2.0 flow
   */
  const loginWithGoogle = useCallback(async (fallbackEmail?: string, fallbackName?: string) => {
    // Prevent duplicate attempts
    if (authLockRef.current || isAuthenticating) {
      console.warn("[useAuth] Authentication already in progress");
      return;
    }

    authLockRef.current = true;
    setIsAuthenticating(true);
    setAuthError(null);

    try {
      // 1. Desktop Companion Path (PKCE + Deep Linking)
      if (desktopBridge.isDesktop()) {
        const session = await desktopBridge.loginWithPKCE();
        if (session && session.email) {
          const newUser: UserProfile = {
            id: session.userId || `usr_${Date.now()}`,
            email: session.email,
            name: session.name || session.email.split("@")[0],
            organization: session.email.split("@")[1] || "Workspace",
            provider: "google",
          };
          setUser(newUser);
          setIsDemoMode(false);
          setIsOnboardingComplete(false);
          authLockRef.current = false;
          setIsAuthenticating(false);
          return newUser;
        } else {
          throw new Error("Desktop login was cancelled or returned no session.");
        }
      }

      // 2. Web Application Path: Request OAuth Authorization URL
      const authData = await apiClient.getGoogleAuthUrl();

      if (authData && authData.authUrl && window && window.open) {
        // Open Google OAuth popup window
        const width = 500;
        const height = 600;
        const left = window.screenX + (window.outerWidth - width) / 2;
        const top = window.screenY + (window.outerHeight - height) / 2.5;

        const popup = window.open(
          authData.authUrl,
          "NoteFlow Google Auth",
          `width=${width},height=${height},left=${left},top=${top},status=no,resizable=yes`
        );

        if (popup) {
          // Poll for popup closure
          const pollTimer = window.setInterval(() => {
            if (popup.closed) {
              window.clearInterval(pollTimer);
              authLockRef.current = false;
              setIsAuthenticating(false);
            }
          }, 600);

          return null;
        }
      }

      // 3. Fallback / Direct Exchange handler (when popup blocked or in mock/offline mode)
      const targetEmail = fallbackEmail || "user@workspace.internal";
      const targetName = fallbackName || (targetEmail.includes("@") ? targetEmail.split("@")[0].replace(/[._]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) : "Workspace Member");

      const exchangeResult = await apiClient.exchangeGoogleAuth({
        email: targetEmail,
        name: targetName,
      });

      if (exchangeResult && exchangeResult.user) {
        setUser(exchangeResult.user);
        setIsDemoMode(false);
        setIsOnboardingComplete(false);
        setAuthError(null);
        authLockRef.current = false;
        setIsAuthenticating(false);
        return exchangeResult.user;
      } else {
        throw new Error("Failed to verify Google Workspace session.");
      }
    } catch (err: any) {
      console.error("[useAuth] Google authentication error:", err);
      const isCancelled = err?.message?.toLowerCase().includes("cancel") || err?.message?.toLowerCase().includes("closed");
      setAuthError(isCancelled ? "Google sign-in was cancelled." : err?.message || "Authentication failed. Please try again.");
      authLockRef.current = false;
      setIsAuthenticating(false);
      return null;
    }
  }, [isAuthenticating, user]);

  /**
   * Email Sign-In
   */
  const loginWithEmail = useCallback((email: string, name?: string) => {
    if (!email || !email.includes("@")) {
      setAuthError("Please enter a valid work email address.");
      return null;
    }

    const newUser: UserProfile = {
      id: `usr_${Date.now()}`,
      email,
      name: name || email.split("@")[0].replace(/[._]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
      organization: email.split("@")[1] || "My Workspace",
      provider: "email",
    };
    setUser(newUser);
    setIsDemoMode(false);
    setIsOnboardingComplete(false);
    setAuthError(null);
    return newUser;
  }, []);

  /**
   * Complete Onboarding
   */
  const completeOnboarding = useCallback(() => {
    setIsOnboardingComplete(true);
  }, []);

  /**
   * Log out active session
   */
  const logout = useCallback(async () => {
    const currentUserId = user?.id;
    setUser(null);
    setIsDemoMode(false);
    setIsOnboardingComplete(false);
    setAuthError(null);

    try {
      localStorage.removeItem(AUTH_STORAGE_KEY);
      localStorage.removeItem(DEMO_MODE_KEY);
      localStorage.removeItem(ONBOARDING_COMPLETE_KEY);

      if (desktopBridge.isDesktop()) {
        await desktopBridge.logout();
      } else if (currentUserId) {
        await apiClient.logout(currentUserId);
      }
    } catch (e) {
      console.error("[useAuth] Failed to clear session", e);
    }
  }, [user?.id]);

  /**
   * Explore Demo Sandbox
   */
  const enterDemoMode = useCallback(() => {
    const demoUser: UserProfile = {
      id: "usr_demo_sandbox",
      email: "alex.product@acme-corp.internal",
      name: "Alex Miller (Demo)",
      organization: "Acme Product Pod",
      provider: "demo",
    };
    setUser(demoUser);
    setIsDemoMode(true);
    setIsOnboardingComplete(true);
    setAuthError(null);
    return demoUser;
  }, []);

  const exitDemoMode = useCallback(() => {
    logout();
  }, [logout]);

  return {
    user,
    isAuthenticated: !!user,
    isDemoMode,
    isOnboardingComplete,
    completeOnboarding,
    isAuthenticating,
    authError,
    setAuthError,
    loginWithGoogle,
    loginWithEmail,
    logout,
    enterDemoMode,
    exitDemoMode,
  };
}

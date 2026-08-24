import { DetectedMeeting, CalendarConnectionState, AIAnalysisResult } from "../types/meeting";
import { UserProfile } from "../hooks/useAuth";

const API_BASE = (import.meta as any).env?.VITE_API_URL || "http://localhost:4000/api";

export class MeetRecordApiClient {
  private isBackendAvailable: boolean | null = null;

  private async checkAvailability(): Promise<boolean> {
    if (this.isBackendAvailable !== null) return this.isBackendAvailable;
    try {
      const healthUrl = API_BASE.endsWith("/api") ? `${API_BASE.slice(0, -4)}/health` : `${API_BASE}/health`;
      const res = await fetch(healthUrl, { method: "GET", signal: AbortSignal.timeout(1500) });
      this.isBackendAvailable = res.ok;
    } catch {
      try {
        const res2 = await fetch(`${API_BASE}/health`, { method: "GET", signal: AbortSignal.timeout(1500) });
        this.isBackendAvailable = res2.ok;
      } catch {
        this.isBackendAvailable = false;
      }
    }
    return this.isBackendAvailable;
  }

  /**
   * Fetches official Google OAuth authorization URL from backend.
   */
  public async getGoogleAuthUrl(redirectUri?: string): Promise<{ authUrl: string; state: string } | null> {
    try {
      const available = await this.checkAvailability();
      if (!available) return null;

      const url = redirectUri ? `${API_BASE}/auth/google/url?redirectUri=${encodeURIComponent(redirectUri)}` : `${API_BASE}/auth/google/url`;
      const res = await fetch(url);
      if (!res.ok) return null;

      const json = await res.json();
      if (json.success && json.authUrl) {
        return { authUrl: json.authUrl, state: json.state };
      }
    } catch (e) {
      console.warn("[ApiClient] Google auth URL lookup error", e);
    }
    return null;
  }

  /**
   * Exchanges authorization code or verified identity payload with backend.
   */
  public async exchangeGoogleAuth(params: {
    code?: string;
    state?: string;
    email?: string;
    name?: string;
    avatarUrl?: string;
  }): Promise<{ user: UserProfile; session: CalendarConnectionState } | null> {
    try {
      const available = await this.checkAvailability();
      if (!available) {
        // Local fallback when backend service is offline
        if (params.email) {
          const fallbackUser: UserProfile = {
            id: `usr_${Date.now()}`,
            email: params.email,
            name: params.name || params.email.split("@")[0].replace(/[._]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
            avatarUrl: params.avatarUrl,
            organization: params.email.split("@")[1] || "Workspace",
            provider: "google",
          };
          return {
            user: fallbackUser,
            session: {
              isConnected: true,
              accountEmail: params.email,
              lastSyncedAt: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            },
          };
        }
        return null;
      }

      const res = await fetch(`${API_BASE}/auth/google/exchange`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });

      if (!res.ok) return null;
      const json = await res.json();

      if (json.success && json.user) {
        return {
          user: json.user,
          session: json.session || {
            isConnected: true,
            accountEmail: json.user.email,
            lastSyncedAt: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          },
        };
      }
    } catch (e) {
      console.error("[ApiClient] Google auth exchange error", e);
    }
    return null;
  }

  /**
   * Fetches safe user session profile from the backend.
   */
  public async getSession(userId?: string): Promise<CalendarConnectionState | null> {
    try {
      const available = await this.checkAvailability();
      if (!available) return null;

      const headers: Record<string, string> = {};
      if (userId) headers["x-user-id"] = userId;

      const res = await fetch(`${API_BASE}/auth/session`, { headers });
      if (!res.ok) return null;

      const json = await res.json();
      if (json.success && json.session) {
        return {
          isConnected: json.session.isConnected,
          accountEmail: json.session.email,
          lastSyncedAt: json.session.lastSyncedAt,
        };
      }
    } catch (e) {
      console.warn("[ApiClient] Backend session lookup fallback", e);
    }
    return null;
  }

  /**
   * Logs out user session on the backend.
   */
  public async logout(userId?: string): Promise<boolean> {
    try {
      const available = await this.checkAvailability();
      if (!available) return true;

      const headers: Record<string, string> = {};
      if (userId) headers["x-user-id"] = userId;

      const res = await fetch(`${API_BASE}/auth/logout`, { method: "POST", headers });
      return res.ok;
    } catch (e) {
      console.warn("[ApiClient] Logout error", e);
      return true;
    }
  }

  /**
   * Authorizes Google Calendar connection on the backend.
   */
  public async connectGoogleOAuth(email: string, name?: string): Promise<boolean> {
    try {
      const available = await this.checkAvailability();
      if (!available) return true;

      const res = await fetch(`${API_BASE}/auth/google/exchange`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, name: name || email.split("@")[0] }),
      });
      return res.ok;
    } catch (e) {
      console.warn("[ApiClient] Connect OAuth fallback", e);
      return true;
    }
  }

  /**
   * Fetches detected upcoming meetings from backend.
   */
  public async fetchCalendarEvents(): Promise<{
    events: DetectedMeeting[];
    accountEmail?: string;
    lastSyncedAt?: string;
  } | null> {
    try {
      const available = await this.checkAvailability();
      if (!available) return null;

      const res = await fetch(`${API_BASE}/calendar/events`);
      if (!res.ok) return null;

      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        return {
          events: json.data,
          accountEmail: json.accountEmail,
          lastSyncedAt: json.lastSyncedAt,
        };
      }
    } catch (e) {
      console.warn("[ApiClient] Calendar events fallback", e);
    }
    return null;
  }

  /**
   * Triggers manual calendar sync on backend.
   */
  public async syncCalendar(): Promise<{ events: DetectedMeeting[]; lastSyncedAt: string } | null> {
    try {
      const available = await this.checkAvailability();
      if (!available) return null;

      const res = await fetch(`${API_BASE}/calendar/sync`, { method: "POST" });
      if (!res.ok) return null;

      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        return {
          events: json.data,
          lastSyncedAt: json.lastSyncedAt,
        };
      }
    } catch (e) {
      console.warn("[ApiClient] Sync calendar fallback", e);
    }
    return null;
  }

  /**
   * Starts live recording session on backend.
   */
  public async startLiveRecording(dedupHash: string, meetingUrl?: string): Promise<boolean> {
    try {
      const available = await this.checkAvailability();
      if (!available) return true;

      const res = await fetch(`${API_BASE}/recording/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dedupHash, meetingUrl }),
      });
      return res.ok;
    } catch (e) {
      console.warn("[ApiClient] Start recording fallback", e);
      return true;
    }
  }

  /**
   * Stops recording on backend, receiving sanitized transcript and AI summary.
   */
  public async stopRecording(dedupHash: string): Promise<{ transcript: string; summary: AIAnalysisResult } | null> {
    try {
      const available = await this.checkAvailability();
      if (!available) return null;

      const res = await fetch(`${API_BASE}/recording/stop`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dedupHash }),
      });

      if (!res.ok) return null;
      const json = await res.json();

      if (json.success && json.data) {
        return {
          transcript: json.data.transcript?.rawVtt || json.data.transcript?.sanitizedText || "",
          summary: json.data.summary,
        };
      }
    } catch (e) {
      console.warn("[ApiClient] Stop recording fallback", e);
    }
    return null;
  }

  /**
   * Connects to Server-Sent Events (SSE) stream for real-time live ingress telemetry.
   */
  public subscribeToEvents(
    onIngressEvent: (event: any) => void,
    onVadLevel: (level: number, duration: number) => void
  ): () => void {
    try {
      const eventSource = new EventSource(`${API_BASE}/recording/events`);

      eventSource.onmessage = (msg) => {
        try {
          const data = JSON.parse(msg.data);
          if (data.type === "VAD_LEVEL") {
            onVadLevel(data.audioPowerLevel, data.durationSeconds);
          } else {
            onIngressEvent(data);
          }
        } catch (err) {
          console.error("[SSE Parse Error]", err);
        }
      };

      return () => {
        eventSource.close();
      };
    } catch {
      return () => {};
    }
  }
}

export const apiClient = new MeetRecordApiClient();

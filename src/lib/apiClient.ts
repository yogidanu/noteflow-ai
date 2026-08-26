import { DetectedMeeting, CalendarConnectionState, AIAnalysisResult } from "../types/meeting";
import { UserProfile } from "../hooks/useAuth";
import { API_BASE_URL, getApiEndpoint } from "../config/appConfig";

export class MeetRecordApiClient {
  private isBackendAvailable: boolean | null = null;
  private currentUserId: string | null = null;
  private currentUserEmail: string | null = null;
  private currentUserName: string | null = null;

  public setSessionContext(userId?: string | null, email?: string | null, name?: string | null): void {
    this.currentUserId = userId || null;
    this.currentUserEmail = email || null;
    this.currentUserName = name || null;
  }

  private getAuthHeaders(customHeaders: Record<string, string> = {}): Record<string, string> {
    const headers: Record<string, string> = { ...customHeaders };
    if (this.currentUserId) headers["x-user-id"] = this.currentUserId;
    if (this.currentUserEmail) headers["x-user-email"] = this.currentUserEmail;
    if (this.currentUserName) headers["x-user-name"] = this.currentUserName;
    return headers;
  }

  private async checkAvailability(): Promise<boolean> {
    if (this.isBackendAvailable !== null) return this.isBackendAvailable;
    try {
      const healthUrl = API_BASE_URL.endsWith("/api") ? `${API_BASE_URL.slice(0, -4)}/health` : `${API_BASE_URL}/health`;
      const res = await fetch(healthUrl, { method: "GET", signal: AbortSignal.timeout(1500) });
      this.isBackendAvailable = res.ok;
    } catch {
      try {
        const res2 = await fetch(`${API_BASE_URL}/health`, { method: "GET", signal: AbortSignal.timeout(1500) });
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
  public async getGoogleAuthUrl(
    redirectUri?: string,
    scope?: "auth" | "calendar" | "all",
    codeChallenge?: string,
    codeChallengeMethod?: string
  ): Promise<{ authUrl: string; state: string } | null> {
    try {
      const available = await this.checkAvailability();
      if (!available) return null;

      const endpoint = getApiEndpoint("/auth/google/url");
      const queryParams = new URLSearchParams();
      if (redirectUri) queryParams.set("redirectUri", redirectUri);
      if (scope) queryParams.set("scope", scope);
      if (codeChallenge) queryParams.set("code_challenge", codeChallenge);
      if (codeChallengeMethod) queryParams.set("code_challenge_method", codeChallengeMethod);

      const url = queryParams.toString() ? `${endpoint}?${queryParams.toString()}` : endpoint;
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
          this.setSessionContext(fallbackUser.id, fallbackUser.email, fallbackUser.name);
          return {
            user: fallbackUser,
            session: {
              isConnected: true,
              status: "CONNECTED",
              accountEmail: params.email,
              lastSyncedAt: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            },
          };
        }
        return null;
      }

      const res = await fetch(getApiEndpoint("/auth/google/exchange"), {
        method: "POST",
        headers: this.getAuthHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify(params),
      });

      if (!res.ok) return null;
      const json = await res.json();

      if (json.success && json.user) {
        this.setSessionContext(json.user.id, json.user.email, json.user.name);
        return {
          user: json.user,
          session: json.session
            ? {
                ...json.session,
                status: json.session.isConnected ? "CONNECTED" : "NOT_CONNECTED",
              }
            : {
                isConnected: true,
                status: "CONNECTED",
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

      const headers = this.getAuthHeaders(userId ? { "x-user-id": userId } : {});
      const res = await fetch(getApiEndpoint("/auth/session"), { headers });
      if (!res.ok) return null;

      const json = await res.json();
      if (json.success && json.session) {
        return {
          isConnected: json.session.isConnected,
          status: json.session.isConnected ? "CONNECTED" : "NOT_CONNECTED",
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
   * Fetches NoteFlow user profile from the backend.
   */
  public async getUserProfile(userId?: string): Promise<{
    fullName: string;
    email: string;
    avatarUrl?: string;
    city?: string;
    country?: string;
    organization?: string;
    profileCompleted: boolean;
    createdAt?: string;
    updatedAt?: string;
  } | null> {
    try {
      const available = await this.checkAvailability();
      if (!available) return null;

      const headers = this.getAuthHeaders(userId ? { "x-user-id": userId } : {});
      const res = await fetch(getApiEndpoint("/auth/profile"), { headers });
      if (!res.ok) return null;

      const json = await res.json();
      if (json.success && json.profile) {
        return json.profile;
      }
    } catch (e) {
      console.warn("[ApiClient] Profile lookup error", e);
    }
    return null;
  }

  /**
   * Updates NoteFlow user profile on the backend and sets profileCompleted = true.
   */
  public async updateUserProfile(
    updates: {
      fullName?: string;
      city?: string;
      country?: string;
      avatarUrl?: string;
      organization?: string;
    },
    userId?: string
  ): Promise<{
    fullName: string;
    email: string;
    avatarUrl?: string;
    city?: string;
    country?: string;
    organization?: string;
    profileCompleted: boolean;
    createdAt?: string;
    updatedAt?: string;
  } | null> {
    try {
      const available = await this.checkAvailability();
      if (!available) return null;

      const headers = this.getAuthHeaders(
        userId ? { "x-user-id": userId, "Content-Type": "application/json" } : { "Content-Type": "application/json" }
      );
      const res = await fetch(getApiEndpoint("/auth/profile"), {
        method: "PUT",
        headers,
        body: JSON.stringify(updates),
      });
      if (!res.ok) return null;

      const json = await res.json();
      if (json.success && json.profile) {
        if (json.profile.fullName) {
          this.currentUserName = json.profile.fullName;
        }
        return json.profile;
      }
    } catch (e) {
      console.error("[ApiClient] Update profile error", e);
    }
    return null;
  }

  /**
   * Logs out user session on the backend.
   */
  public async logout(userId?: string): Promise<boolean> {
    try {
      const available = await this.checkAvailability();
      this.setSessionContext(null, null, null);
      if (!available) return true;

      const headers = this.getAuthHeaders(userId ? { "x-user-id": userId } : {});
      const res = await fetch(getApiEndpoint("/auth/logout"), { method: "POST", headers });
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

      const res = await fetch(getApiEndpoint("/auth/google/exchange"), {
        method: "POST",
        headers: this.getAuthHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ email, name: name || email.split("@")[0] }),
      });
      return res.ok;
    } catch (e) {
      console.warn("[ApiClient] Connect OAuth fallback", e);
      return true;
    }
  }

  /**
   * Queries authoritative backend calendar connection state.
   */
  public async getCalendarStatus(): Promise<{
    connected: boolean;
    accountEmail?: string | null;
    scopes?: string[];
  }> {
    try {
      const available = await this.checkAvailability();
      if (!available) return { connected: false };

      const res = await fetch(getApiEndpoint("/calendar/status"), {
        headers: this.getAuthHeaders(),
      });
      if (!res.ok) return { connected: false };

      const json = await res.json();
      return {
        connected: Boolean(json.connected),
        accountEmail: json.accountEmail,
        scopes: json.scopes,
      };
    } catch {
      return { connected: false };
    }
  }

  /**
   * Fetches detected upcoming meetings from backend.
   */
  public async fetchCalendarEvents(): Promise<{
    success: boolean;
    events: DetectedMeeting[];
    accountEmail?: string;
    lastSyncedAt?: string;
    error?: string;
    requiresReconnect?: boolean;
  }> {
    try {
      const available = await this.checkAvailability();
      if (!available) return { success: false, events: [], error: "BACKEND_UNAVAILABLE" };

      const res = await fetch(getApiEndpoint("/calendar/events"), {
        headers: this.getAuthHeaders(),
      });
      const json = await res.json().catch(() => null);

      if (!res.ok) {
        const errorKey = json?.error || `HTTP_${res.status}`;
        const isReconnectNeeded =
          json?.requiresReconnect === true ||
          errorKey === "CALENDAR_TOKEN_EXPIRED" ||
          errorKey === "CALENDAR_PERMISSION_REVOKED";

        return {
          success: false,
          events: [],
          error: errorKey,
          requiresReconnect: isReconnectNeeded,
        };
      }

      if (json && json.success && Array.isArray(json.data)) {
        return {
          success: true,
          events: json.data,
          accountEmail: json.accountEmail,
          lastSyncedAt: json.lastSyncedAt,
        };
      }
    } catch (e: any) {
      console.warn("[ApiClient] Calendar events error", e);
      return { success: false, events: [], error: e?.message || "NETWORK_ERROR", requiresReconnect: false };
    }
    return { success: false, events: [], error: "UNKNOWN_ERROR", requiresReconnect: false };
  }

  /**
   * Triggers manual calendar sync on backend.
   */
  public async syncCalendar(): Promise<{
    success: boolean;
    events: DetectedMeeting[];
    lastSyncedAt?: string;
    error?: string;
    requiresReconnect?: boolean;
  }> {
    try {
      const available = await this.checkAvailability();
      if (!available) return { success: false, events: [], error: "BACKEND_UNAVAILABLE" };

      const res = await fetch(getApiEndpoint("/calendar/sync"), {
        method: "POST",
        headers: this.getAuthHeaders(),
      });
      const json = await res.json().catch(() => null);

      if (!res.ok) {
        const errorKey = json?.error || `HTTP_${res.status}`;
        const isReconnectNeeded =
          json?.requiresReconnect === true ||
          errorKey === "CALENDAR_TOKEN_EXPIRED" ||
          errorKey === "CALENDAR_PERMISSION_REVOKED";

        return {
          success: false,
          events: [],
          error: errorKey,
          requiresReconnect: isReconnectNeeded,
        };
      }

      if (json && json.success && Array.isArray(json.data)) {
        return {
          success: true,
          events: json.data,
          lastSyncedAt: json.lastSyncedAt,
        };
      }
    } catch (e: any) {
      console.warn("[ApiClient] Sync calendar error", e);
      return { success: false, events: [], error: e?.message || "NETWORK_ERROR", requiresReconnect: false };
    }
    return { success: false, events: [], error: "UNKNOWN_ERROR", requiresReconnect: false };
  }

  /**
   * Initializes a persistent recording session on the backend.
   */
  public async initRecordingSession(params: {
    meetingId: string;
    title?: string;
    meetingUrl?: string;
    dedupHash?: string;
  }): Promise<{ recordingSessionId: string; status: string } | null> {
    try {
      const available = await this.checkAvailability();
      if (!available) return null;

      const res = await fetch(getApiEndpoint("/recording/session/init"), {
        method: "POST",
        headers: this.getAuthHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify(params),
      });

      if (!res.ok) return null;
      const json = await res.json();
      if (json.success && json.data) {
        return {
          recordingSessionId: json.data.recordingSessionId,
          status: json.data.status,
        };
      }
    } catch (e) {
      console.warn("[ApiClient] Init recording session fallback", e);
    }
    return null;
  }

  /**
   * Streams an audio binary chunk to the backend recording session.
   */
  public async sendAudioChunk(
    sessionIdOrHash: string,
    chunkBlob: Blob
  ): Promise<{ chunkIndex: number; totalBytes: number } | null> {
    try {
      const available = await this.checkAvailability();
      if (!available) return null;

      const buffer = await chunkBlob.arrayBuffer();

      const res = await fetch(`${getApiEndpoint("/recording/chunk")}?sessionId=${encodeURIComponent(sessionIdOrHash)}`, {
        method: "POST",
        headers: this.getAuthHeaders({ "Content-Type": "application/octet-stream" }),
        body: buffer,
      });

      if (!res.ok) return null;
      const json = await res.json();
      if (json.success && json.data) {
        return {
          chunkIndex: json.data.chunkIndex,
          totalBytes: json.data.totalBytes,
        };
      }
    } catch (e) {
      console.warn("[ApiClient] Send audio chunk error:", e);
    }
    return null;
  }

  /**
   * Retrieves full recording session metadata.
   */
  public async getRecordingSession(sessionIdOrHash: string): Promise<any | null> {
    try {
      const available = await this.checkAvailability();
      if (!available) return null;

      const res = await fetch(`${getApiEndpoint("/recording/session")}/${encodeURIComponent(sessionIdOrHash)}`, {
        headers: this.getAuthHeaders(),
      });

      if (!res.ok) return null;
      const json = await res.json();
      return json.data || json.session || null;
    } catch (e) {
      console.warn("[ApiClient] Get session error:", e);
    }
    return null;
  }

  /**
   * Retrieves audio artifact metadata for verifiable proof of recording.
   */
  public async getAudioArtifactInfo(sessionId: string): Promise<any | null> {
    try {
      const available = await this.checkAvailability();
      if (!available) return null;

      const res = await fetch(`${getApiEndpoint("/recording/session")}/${encodeURIComponent(sessionId)}/artifact`, {
        headers: this.getAuthHeaders(),
      });

      if (!res.ok) return null;
      const json = await res.json();
      return json.data || null;
    } catch (e) {
      console.warn("[ApiClient] Get audio artifact error:", e);
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

      const res = await fetch(getApiEndpoint("/recording/start"), {
        method: "POST",
        headers: this.getAuthHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ dedupHash, meetingUrl }),
      });
      return res.ok;
    } catch (e) {
      console.warn("[ApiClient] Start recording fallback", e);
      return true;
    }
  }

  /**
   * Sends audio blob to backend Speech-to-Text service for live transcription.
   */
  public async transcribeAudio(params: {
    audioBlob: Blob;
    meetingId?: string;
    knownAttendees?: Array<{ name: string; email: string }>;
  }): Promise<{ rawVtt: string; sanitizedText: string; segments: any[] } | null> {
    try {
      const available = await this.checkAvailability();
      if (!available) return null;

      const buffer = await params.audioBlob.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      let binary = "";
      for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const audioBase64 = btoa(binary);

      const res = await fetch(getApiEndpoint("/recording/transcribe"), {
        method: "POST",
        headers: this.getAuthHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          audioBase64,
          mimeType: params.audioBlob.type || "audio/webm",
          meetingId: params.meetingId,
          knownAttendees: params.knownAttendees,
        }),
      });

      if (!res.ok) return null;
      const json = await res.json();
      if (json.success && json.data) {
        return json.data;
      }
    } catch (e) {
      console.warn("[ApiClient] Live audio transcription error:", e);
    }
    return null;
  }

  /**
   * Stops recording on backend, receiving sanitized transcript and AI summary.
   */
  public async stopRecording(dedupHash: string): Promise<{ transcript: string; summary: AIAnalysisResult } | null> {
    try {
      const available = await this.checkAvailability();
      if (!available) return null;

      const res = await fetch(getApiEndpoint("/recording/stop"), {
        method: "POST",
        headers: this.getAuthHeaders({ "Content-Type": "application/json" }),
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
      const eventSource = new EventSource(getApiEndpoint("/recording/events"));

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

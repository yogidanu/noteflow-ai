import fs from "fs";
import path from "path";
import { encryptToken, decryptToken } from "./crypto.js";

export interface NoteFlowUserProfile {
  fullName: string;
  email: string;
  avatarUrl?: string;
  city?: string;
  country?: string;
  organization?: string;
  profileCompleted: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface StoredOAuthRecord {
  userId: string;
  googleSubjectId?: string;
  email: string;
  name: string;
  displayName?: string;
  firstName?: string;
  lastName?: string;
  avatarUrl?: string;
  profile: NoteFlowUserProfile;
  encryptedAccessToken: string;
  encryptedRefreshToken?: string;
  expiresAt: number; // Unix timestamp in ms
  scopes: string[];
  createdAt: number;
  lastUsedAt: number;
}

export interface SafeUserSession {
  userId: string;
  googleSubjectId?: string;
  email: string;
  name: string;
  displayName: string;
  firstName?: string;
  lastName?: string;
  avatarUrl?: string;
  profile: NoteFlowUserProfile;
  isConnected: boolean;
  expiresAt: number;
  scopes: string[];
  lastSyncedAt: string;
}

class TokenVault {
  private vault = new Map<string, StoredOAuthRecord>();
  private persistenceFilePath: string | null = null;

  constructor() {
    // Enable persistent file-backed storage if data directory is accessible
    try {
      const dataDir = path.resolve(process.cwd(), ".data");
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }
      this.persistenceFilePath = path.join(dataDir, "token_vault.enc.json");
      this.loadFromDisk();
    } catch {
      // In constrained environments, fallback to secure memory
      this.persistenceFilePath = null;
    }
  }

  private loadFromDisk(): void {
    if (!this.persistenceFilePath || !fs.existsSync(this.persistenceFilePath)) return;
    try {
      const raw = fs.readFileSync(this.persistenceFilePath, "utf8");
      const records: StoredOAuthRecord[] = JSON.parse(raw);
      this.vault.clear();
      records.forEach((r) => {
        // Invalidate legacy dummy/fallback sessions
        if (r.userId === "usr_7fa1f18622b7487c" || r.email === "user@workspace.design") {
          return;
        }
        // Ensure backward compatibility if profile field is missing
        if (!r.profile) {
          r.profile = {
            fullName: r.displayName || r.name,
            email: r.email,
            avatarUrl: r.avatarUrl,
            city: "",
            country: "",
            organization: r.email.includes("@") ? r.email.split("@")[1] : "Workspace",
            profileCompleted: false,
            createdAt: new Date(r.createdAt || Date.now()).toISOString(),
            updatedAt: new Date(r.lastUsedAt || Date.now()).toISOString(),
          };
        }
        this.vault.set(r.userId, r);
      });
    } catch (e) {
      console.warn("[TokenVault] Could not load persisted vault from disk:", e);
    }
  }

  private persistToDisk(): void {
    if (!this.persistenceFilePath) return;
    try {
      const records = Array.from(this.vault.values());
      fs.writeFileSync(this.persistenceFilePath, JSON.stringify(records, null, 2), "utf8");
    } catch (e) {
      console.warn("[TokenVault] Could not persist vault to disk:", e);
    }
  }

  /**
   * Securely saves OAuth tokens and canonical identity in the vault using AES-256-GCM encryption.
   */
  public saveTokens(params: {
    userId: string;
    googleSubjectId?: string;
    email: string;
    name: string;
    displayName?: string;
    firstName?: string;
    lastName?: string;
    avatarUrl?: string;
    accessToken: string;
    refreshToken?: string;
    expiresInSeconds: number;
    scopes: string[];
  }): void {
    const expiresAt = Date.now() + params.expiresInSeconds * 1000;
    const existing = this.vault.get(params.userId);

    // If profile already exists and was completed, preserve the custom user profile
    const profile: NoteFlowUserProfile = existing?.profile
      ? {
          ...existing.profile,
          email: params.email,
          avatarUrl: existing.profile.avatarUrl || params.avatarUrl,
          updatedAt: new Date().toISOString(),
        }
      : {
          fullName: params.displayName || params.name,
          email: params.email,
          avatarUrl: params.avatarUrl,
          city: "",
          country: "",
          organization: params.email.includes("@") ? params.email.split("@")[1] : "Workspace",
          profileCompleted: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

    const record: StoredOAuthRecord = {
      userId: params.userId,
      googleSubjectId: params.googleSubjectId || existing?.googleSubjectId,
      email: params.email,
      name: profile.fullName || params.name,
      displayName: profile.fullName || params.displayName || params.name,
      firstName: params.firstName,
      lastName: params.lastName,
      avatarUrl: profile.avatarUrl || params.avatarUrl,
      profile,
      encryptedAccessToken: encryptToken(params.accessToken),
      encryptedRefreshToken: params.refreshToken ? encryptToken(params.refreshToken) : existing?.encryptedRefreshToken,
      expiresAt,
      scopes: params.scopes,
      createdAt: existing?.createdAt || Date.now(),
      lastUsedAt: Date.now(),
    };

    this.vault.set(params.userId, record);
    this.persistToDisk();
  }

  /**
   * Looks up a user record by Google subject ID or email.
   */
  public findByGoogleSubjectOrEmail(identifier: string): StoredOAuthRecord | null {
    for (const record of this.vault.values()) {
      if (record.googleSubjectId === identifier || record.email.toLowerCase() === identifier.toLowerCase()) {
        return record;
      }
    }
    return null;
  }

  /**
   * Retrieves decrypted OAuth tokens for internal backend service use.
   * NEVER pass this result to client responses.
   */
  public getTokens(userId: string): { accessToken: string; refreshToken?: string; expiresAt: number } | null {
    const record = this.vault.get(userId);
    if (!record) return null;

    record.lastUsedAt = Date.now();
    this.persistToDisk();

    return {
      accessToken: decryptToken(record.encryptedAccessToken),
      refreshToken: record.encryptedRefreshToken ? decryptToken(record.encryptedRefreshToken) : undefined,
      expiresAt: record.expiresAt,
    };
  }

  /**
   * Checks if user has an active OAuth session.
   */
  public hasValidSession(userId: string): boolean {
    const record = this.vault.get(userId);
    if (!record) return false;
    return record.expiresAt > Date.now();
  }

  /**
   * Returns a sanitized, safe user session object safe for client responses.
   * Completely omits access/refresh tokens.
   */
  public getSafeSession(userId: string): SafeUserSession | null {
    const record = this.vault.get(userId);
    if (!record) return null;

    return {
      userId: record.userId,
      googleSubjectId: record.googleSubjectId,
      email: record.email,
      name: record.profile?.fullName || record.name,
      displayName: record.profile?.fullName || record.displayName || record.name,
      firstName: record.firstName,
      lastName: record.lastName,
      avatarUrl: record.profile?.avatarUrl || record.avatarUrl,
      profile: record.profile,
      isConnected: true,
      expiresAt: record.expiresAt,
      scopes: record.scopes,
      lastSyncedAt: new Date(record.lastUsedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };
  }

  /**
   * Retrieves NoteFlow user profile.
   */
  public getProfile(userId: string): NoteFlowUserProfile | null {
    const record = this.vault.get(userId);
    if (!record) return null;
    return record.profile;
  }

  /**
   * Updates NoteFlow user profile and marks profileCompleted = true.
   */
  public updateProfile(
    userId: string,
    updates: Partial<{ fullName: string; city: string; country: string; avatarUrl: string; organization: string }>
  ): NoteFlowUserProfile | null {
    const record = this.vault.get(userId);
    if (!record) return null;

    const current = record.profile;
    const updatedProfile: NoteFlowUserProfile = {
      ...current,
      fullName: updates.fullName !== undefined ? updates.fullName.trim() : current.fullName,
      city: updates.city !== undefined ? updates.city.trim() : current.city,
      country: updates.country !== undefined ? updates.country.trim() : current.country,
      avatarUrl: updates.avatarUrl !== undefined ? updates.avatarUrl.trim() : current.avatarUrl,
      organization: updates.organization !== undefined ? updates.organization.trim() : current.organization,
      profileCompleted: true,
      updatedAt: new Date().toISOString(),
    };

    record.profile = updatedProfile;
    record.displayName = updatedProfile.fullName;
    record.name = updatedProfile.fullName;
    if (updatedProfile.avatarUrl) {
      record.avatarUrl = updatedProfile.avatarUrl;
    }
    record.lastUsedAt = Date.now();

    this.vault.set(userId, record);
    this.persistToDisk();

    return updatedProfile;
  }

  /**
   * Revokes and purges user tokens from the vault.
   */
  public revoke(userId: string): void {
    this.vault.delete(userId);
    this.persistToDisk();
  }
}

export const tokenVault = new TokenVault();

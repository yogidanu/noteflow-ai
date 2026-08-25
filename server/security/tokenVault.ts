import fs from "fs";
import path from "path";
import { encryptToken, decryptToken } from "./crypto.js";

export interface StoredOAuthRecord {
  userId: string;
  googleSubjectId?: string;
  email: string;
  name: string;
  displayName?: string;
  firstName?: string;
  lastName?: string;
  avatarUrl?: string;
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
      records.forEach((r) => this.vault.set(r.userId, r));
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

    const record: StoredOAuthRecord = {
      userId: params.userId,
      googleSubjectId: params.googleSubjectId,
      email: params.email,
      name: params.name,
      displayName: params.displayName || params.name,
      firstName: params.firstName,
      lastName: params.lastName,
      avatarUrl: params.avatarUrl,
      encryptedAccessToken: encryptToken(params.accessToken),
      encryptedRefreshToken: params.refreshToken ? encryptToken(params.refreshToken) : undefined,
      expiresAt,
      scopes: params.scopes,
      createdAt: Date.now(),
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
      name: record.name,
      displayName: record.displayName || record.name,
      firstName: record.firstName,
      lastName: record.lastName,
      avatarUrl: record.avatarUrl,
      isConnected: true,
      expiresAt: record.expiresAt,
      scopes: record.scopes,
      lastSyncedAt: new Date(record.lastUsedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };
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

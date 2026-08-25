import fs from "fs";
import path from "path";
import crypto from "crypto";
import { config } from "../config.js";

export interface OAuthStateRecord {
  createdAt: number;
  redirectUri: string;
  codeChallenge?: string;
  codeChallengeMethod?: string;
  flowType?: "web" | "desktop";
}

/**
 * Persistent & In-Memory OAuth State Store
 * Guarantees state survival across Render worker recycles and cold starts.
 */
class OAuthStateStore {
  private cache = new Map<string, OAuthStateRecord>();
  private persistenceFilePath: string | null = null;
  private readonly TTL_MS = 10 * 60 * 1000; // 10 minutes

  constructor() {
    try {
      const dataDir = path.resolve(process.cwd(), ".data");
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }
      this.persistenceFilePath = path.join(dataDir, "oauth_state_vault.json");
      this.loadFromDisk();
    } catch {
      this.persistenceFilePath = null;
    }

    // Cleanup expired states every 60s
    setInterval(() => this.cleanup(), 60 * 1000).unref();
  }

  private loadFromDisk(): void {
    if (!this.persistenceFilePath || !fs.existsSync(this.persistenceFilePath)) return;
    try {
      const raw = fs.readFileSync(this.persistenceFilePath, "utf8");
      const records: Record<string, OAuthStateRecord> = JSON.parse(raw);
      const now = Date.now();
      for (const [state, record] of Object.entries(records)) {
        if (now - record.createdAt < this.TTL_MS) {
          this.cache.set(state, record);
        }
      }
    } catch (e) {
      console.warn("[OAuthStateStore] Could not load persisted states from disk:", e);
    }
  }

  private persistToDisk(): void {
    if (!this.persistenceFilePath) return;
    try {
      const obj: Record<string, OAuthStateRecord> = {};
      for (const [state, record] of this.cache.entries()) {
        obj[state] = record;
      }
      fs.writeFileSync(this.persistenceFilePath, JSON.stringify(obj, null, 2), "utf8");
    } catch (e) {
      console.warn("[OAuthStateStore] Could not persist states to disk:", e);
    }
  }

  private cleanup(): void {
    const now = Date.now();
    let modified = false;
    for (const [state, data] of this.cache.entries()) {
      if (now - data.createdAt > this.TTL_MS) {
        this.cache.delete(state);
        modified = true;
      }
    }
    if (modified) {
      this.persistToDisk();
    }
  }

  /**
   * Generates a secure, signed state nonce.
   */
  public generateState(record: Omit<OAuthStateRecord, "createdAt">): string {
    const randomNonce = crypto.randomBytes(24).toString("hex");
    const hmac = crypto
      .createHmac("sha256", config.sessionSecret)
      .update(randomNonce)
      .digest("hex")
      .substring(0, 16);

    const state = `${randomNonce}.${hmac}`;

    this.cache.set(state, {
      ...record,
      createdAt: Date.now(),
    });

    this.persistToDisk();
    return state;
  }

  /**
   * Validates and retrieves state record without consuming.
   */
  public getState(state: string): OAuthStateRecord | null {
    if (!state) return null;
    const record = this.cache.get(state);
    if (!record) return null;
    if (Date.now() - record.createdAt > this.TTL_MS) {
      this.cache.delete(state);
      this.persistToDisk();
      return null;
    }
    return record;
  }

  /**
   * Atomically validates, retrieves, and consumes (deletes) the state nonce exactly once.
   */
  public consumeState(state: string): OAuthStateRecord | null {
    if (!state) return null;
    const record = this.cache.get(state);
    if (!record) return null;

    if (Date.now() - record.createdAt > this.TTL_MS) {
      this.cache.delete(state);
      this.persistToDisk();
      return null;
    }

    // Delete immediately to prevent replay attacks
    this.cache.delete(state);
    this.persistToDisk();
    return record;
  }

  /**
   * Manual deletion.
   */
  public deleteState(state: string): void {
    if (this.cache.delete(state)) {
      this.persistToDisk();
    }
  }
}

export const oauthStateStore = new OAuthStateStore();

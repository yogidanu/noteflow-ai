import crypto from "node:crypto";
import { config } from "../config.js";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // 96-bit IV recommended for GCM
const AUTH_TAG_LENGTH = 16; // 128-bit authentication tag

// Derive 32-byte key from master secret using SHA-256
function getKey(): Buffer {
  return crypto.createHash("sha256").update(config.tokenEncryptionKey).digest();
}

/**
 * Encrypts sensitive string payload (e.g. OAuth tokens) with AES-256-GCM.
 * Output format: `iv:authTag:ciphertext` in hex.
 */
export function encryptToken(plaintext: string): string {
  const key = getKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });

  let encrypted = cipher.update(plaintext, "utf8", "hex");
  encrypted += cipher.final("hex");

  const authTag = cipher.getAuthTag().toString("hex");
  return `${iv.toString("hex")}:${authTag}:${encrypted}`;
}

/**
 * Decrypts AES-256-GCM encrypted ciphertext.
 * Throws an error if tampering or invalid key is detected.
 */
export function decryptToken(encryptedPayload: string): string {
  const parts = encryptedPayload.split(":");
  if (parts.length !== 3) {
    throw new Error("Invalid encrypted token format");
  }

  const [ivHex, authTagHex, ciphertextHex] = parts;
  const key = getKey();
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(ciphertextHex, "hex", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}

/**
 * Computes deterministic SHA-256 hash for deduplicating meeting URLs.
 */
export function computeMeetingHash(normalizedUrl: string): string {
  return crypto.createHash("sha256").update(normalizedUrl.trim().toLowerCase()).digest("hex");
}

/**
 * NoteFlow AI • Application Configuration Module
 * Central single source of truth for Frontend Web and API base URLs.
 * 
 * Supports seamless environment switching:
 * 1. Local Development (http://localhost:5173 & http://localhost:4000/api)
 * 2. Current Cloud Testing (https://noteflow-ai-cc3p.vercel.app & https://noteflow-ai-3nal.onrender.com/api)
 * 3. Future Custom Domain Production (https://app.noteflow.ai & https://api.noteflow.ai/api)
 */

// Retrieve environment variables safely across browser, Vite, and Node contexts
const getEnv = (key: string): string | undefined => {
  try {
    if (typeof import.meta !== "undefined" && (import.meta as any).env) {
      return (import.meta as any).env[key];
    }
  } catch {
    // Fallback if import.meta is unavailable
  }
  const globalProc = (globalThis as any)?.process;
  if (globalProc && globalProc.env) {
    return globalProc.env[key];
  }
  return undefined;
};

const isProd = typeof import.meta !== "undefined" && (import.meta as any).env?.PROD;

/**
 * Public Web Application URL (Frontend root for navigation, deep links, and desktop OAuth redirect)
 */
export const APP_URL: string =
  getEnv("VITE_APP_URL") ||
  (typeof window !== "undefined" && window.location?.origin && !window.location.origin.includes("localhost")
    ? window.location.origin
    : isProd
    ? "https://noteflow-ai-cc3p.vercel.app"
    : "http://localhost:5173");

/**
 * Public Backend API Base URL (Must end with /api)
 */
const rawApiUrl =
  getEnv("VITE_API_URL") ||
  (isProd
    ? "https://noteflow-ai-3nal.onrender.com/api"
    : "http://localhost:4000/api");

// In production builds, never speak to the API over plaintext HTTP
// (a misconfigured VITE_API_URL used to be honored silently). Localhost
// stays exempt for local development against a prod bundle.
const enforcedApiUrl =
  isProd && rawApiUrl.startsWith("http://") && !/^http:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(rawApiUrl)
    ? rawApiUrl.replace(/^http:\/\//, "https://")
    : rawApiUrl;

// Normalize to ensure consistent trailing /api without double slashes
export const API_BASE_URL: string = enforcedApiUrl.replace(/\/+$/, "");

/**
 * Constructs a fully qualified API endpoint URL without duplicate /api prefixes
 */
export function getApiEndpoint(path: string): string {
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  // Prevent accidental /api/api double nesting
  if (cleanPath.startsWith("/api/")) {
    return `${API_BASE_URL}${cleanPath.substring(4)}`;
  }
  return `${API_BASE_URL}${cleanPath}`;
}

export const appConfig = {
  appUrl: APP_URL,
  apiBaseUrl: API_BASE_URL,
  getApiEndpoint,
  isProduction: Boolean(isProd),
};

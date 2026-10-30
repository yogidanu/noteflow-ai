import dotenv from "dotenv";
dotenv.config();

const isProduction = process.env.NODE_ENV === "production";

// Frontend Web Application Base URL
const frontendUrl =
  process.env.FRONTEND_URL ||
  process.env.VITE_APP_URL ||
  (isProduction ? "https://noteflow-ai-cc3p.vercel.app" : "http://localhost:5173");

// Parse and validate CORS origins
const rawCorsOrigin =
  process.env.CORS_ORIGIN ||
  "http://localhost:5173,http://localhost:5174,http://localhost:3000,https://noteflow-ai-cc3p.vercel.app,https://app.noteflow.ai";

const parsedCorsOrigins = rawCorsOrigin
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

// Always ensure the configured frontend URL and standard production domains are allowed
[frontendUrl, "https://noteflow-ai-cc3p.vercel.app", "https://app.noteflow.ai"].forEach((origin) => {
  if (origin && !parsedCorsOrigins.includes(origin)) {
    parsedCorsOrigins.push(origin);
  }
});

// Strict check: Never allow wildcard in production
if (isProduction && parsedCorsOrigins.includes("*")) {
  throw new Error("[Security Error] Wildcard CORS (*) is strictly prohibited in production mode.");
}

// Google OAuth 2.0 Callback / Redirect URI
const googleRedirectUri =
  process.env.GOOGLE_CALLBACK_URL ||
  process.env.GOOGLE_REDIRECT_URI ||
  (isProduction
    ? "https://noteflow-ai-3nal.onrender.com/api/auth/google/callback"
    : "http://localhost:4000/api/auth/google/callback");

// Build allowed redirect URIs dynamically
const allowedRedirectUris = [
  "noteflow://auth/callback",
  frontendUrl,
  `${frontendUrl}/auth/callback`,
  `${frontendUrl}/auth/desktop-login`,
  "https://noteflow-ai-cc3p.vercel.app",
  "https://noteflow-ai-cc3p.vercel.app/auth/callback",
  "https://noteflow-ai-cc3p.vercel.app/auth/desktop-login",
  "https://app.noteflow.ai",
  "https://app.noteflow.ai/auth/callback",
  "https://app.noteflow.ai/auth/desktop-login",
  "http://localhost:5173",
  "http://localhost:5173/auth/desktop-login",
  "http://localhost:5173/auth/callback",
  "http://localhost:3000",
  "http://localhost:4000/api/auth/google/callback",
  "http://localhost:3001/api/auth/google/callback",
  "https://noteflow-ai-3nal.onrender.com/api/auth/google/callback",
  "https://api.noteflow.ai/api/auth/google/callback",
];

// --- Secret resolution -------------------------------------------------------
// Dev-only fallback secrets. They exist so local development boots with zero
// setup; they are public (printed here) and must NEVER protect real data.
const DEV_TOKEN_ENCRYPTION_KEY =
  "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
const DEV_SESSION_SECRET = "noteflow-meet-record-session-secret-key-2026";

function resolveSecret(
  name: "TOKEN_ENCRYPTION_KEY" | "SESSION_SECRET",
  envValue: string | undefined,
  devFallback: string,
): string {
  if (!isProduction) {
    return envValue || devFallback;
  }
  // Production fails closed: refuse to boot without a real secret, and refuse
  // the published dev fallbacks even if someone sets them explicitly.
  if (!envValue) {
    throw new Error(
      `[Security Error] ${name} is not set. Production refuses to boot with the built-in dev fallback secret.`,
    );
  }
  if (envValue === devFallback) {
    throw new Error(
      `[Security Error] ${name} is set to the built-in dev fallback value, which is public. Set a real secret.`,
    );
  }
  if (name === "TOKEN_ENCRYPTION_KEY" && !/^[0-9a-fA-F]{64}$/.test(envValue)) {
    throw new Error(
      "[Security Error] TOKEN_ENCRYPTION_KEY must be 64 hex characters (32 bytes) in production.",
    );
  }
  if (name === "SESSION_SECRET" && envValue.length < 32) {
    throw new Error(
      "[Security Error] SESSION_SECRET must be at least 32 characters in production.",
    );
  }
  return envValue;
}

const tokenEncryptionKey = resolveSecret(
  "TOKEN_ENCRYPTION_KEY",
  process.env.TOKEN_ENCRYPTION_KEY,
  DEV_TOKEN_ENCRYPTION_KEY,
);
const sessionSecret = resolveSecret(
  "SESSION_SECRET",
  process.env.SESSION_SECRET,
  DEV_SESSION_SECRET,
);

// Third-party secrets fail closed in production too: booting with the
// built-in "sample" placeholders silently breaks OAuth and speech-to-
// text (and once masked a missing Deepgram key for days). Refuse.
if (isProduction) {
  const requiredRealSecrets: Array<["GOOGLE_CLIENT_ID" | "GOOGLE_CLIENT_SECRET" | "DEEPGRAM_API_KEY", string | undefined]> = [
    ["GOOGLE_CLIENT_ID", process.env.GOOGLE_CLIENT_ID],
    ["GOOGLE_CLIENT_SECRET", process.env.GOOGLE_CLIENT_SECRET],
    ["DEEPGRAM_API_KEY", process.env.DEEPGRAM_API_KEY],
  ];
  for (const [name, value] of requiredRealSecrets) {
    if (!value || value.includes("sample")) {
      throw new Error(
        `[Security Error] ${name} is not set to a real value. Production refuses to boot with the built-in sample placeholder.`,
      );
    }
  }
}

export const config = {
  port: parseInt(process.env.PORT || "4000", 10),
  nodeEnv: process.env.NODE_ENV || "development",
  isProduction,
  frontendUrl,
  corsOrigins: parsedCorsOrigins,
  corsOrigin: rawCorsOrigin,

  // Master Secret Key for AES-256-GCM Token Encryption (32 bytes hex)
  // Resolved by resolveSecret above: production refuses missing/dev values.
  tokenEncryptionKey,

  // Session Secret for HMAC signing
  sessionSecret,

  // Google OAuth 2.0 Credentials
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID || "noteflow-google-client-id-sample.apps.googleusercontent.com",
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || "GOCSPX-sample-client-secret-key",
    redirectUri: googleRedirectUri,
    // OpenID Connect Authentication Scopes (Basic Non-Sensitive Identity)
    authScopes: [
      "openid",
      "https://www.googleapis.com/auth/userinfo.email",
      "https://www.googleapis.com/auth/userinfo.profile",
    ],
    // Incremental Google Calendar Scope (Sensitive Permission)
    calendarScopes: [
      "https://www.googleapis.com/auth/calendar.events.readonly",
    ],
    // Default initial sign-in scopes (Basic Identity via OpenID Connect)
    scopes: [
      "openid",
      "https://www.googleapis.com/auth/userinfo.email",
      "https://www.googleapis.com/auth/userinfo.profile",
    ],
    // Full combined scopes for calendar authorization
    allScopes: [
      "openid",
      "https://www.googleapis.com/auth/userinfo.email",
      "https://www.googleapis.com/auth/userinfo.profile",
      "https://www.googleapis.com/auth/calendar.events.readonly",
    ],
  },

  // Allowed OAuth Callback Redirect URIs
  allowedRedirectUris: Array.from(new Set(allowedRedirectUris)),

  // STT Ingress Provider (Deepgram / Whisper)
  stt: {
    apiKey: process.env.DEEPGRAM_API_KEY || "sample-deepgram-api-key",
    model: "nova-3",
    diarizationEnabled: true,
  },

  // Max Recording Boundaries
  recording: {
    maxDurationMinutes: 180,
    waitingRoomTimeoutMinutes: 10,
    idleDepartureTimeoutSeconds: 60,
  },
};

/**
 * Startup Validation for Environment Configurations
 */
export function validateEnvironment(): { valid: boolean; warnings: string[] } {
  const warnings: string[] = [];

  if (isProduction) {
    if (!process.env.TOKEN_ENCRYPTION_KEY || process.env.TOKEN_ENCRYPTION_KEY.startsWith("0123456789")) {
      warnings.push("CRITICAL: TOKEN_ENCRYPTION_KEY is using a default or sample key in production!");
    }
    if (!process.env.GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID.includes("sample")) {
      warnings.push("WARNING: GOOGLE_CLIENT_ID is not configured for live Google OAuth.");
    }
    if (!process.env.GOOGLE_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET.includes("sample")) {
      warnings.push("WARNING: GOOGLE_CLIENT_SECRET is not configured for live Google OAuth.");
    }
  }

  if (warnings.length > 0) {
    console.warn("\n================ ENVIRONMENT WARNINGS ================");
    warnings.forEach((w) => console.warn(`⚠️  ${w}`));
    console.warn("======================================================\n");
  }

  return { valid: warnings.length === 0, warnings };
}

validateEnvironment();

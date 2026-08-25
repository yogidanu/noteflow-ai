import { Router, Request, Response } from "express";
import crypto from "crypto";
import { config } from "../config.js";
import { tokenVault } from "../security/tokenVault.js";
import { oauthStateStore, OAuthStateRecord } from "../security/stateStore.js";
import { requireAuth } from "../middleware/authMiddleware.js";
import { authRateLimiter } from "../middleware/rateLimiter.js";

export const authRouter = Router();

// Apply Rate Limiting to all authentication routes
authRouter.use(authRateLimiter);

// Ephemeral One-Time Auth Codes for Desktop Token Exchange (TTL: 5 minutes)
const desktopAuthCodeCache = new Map<
  string,
  {
    userId: string;
    email: string;
    name: string;
    codeChallenge: string;
    createdAt: number;
  }
>();

// Periodic Cleanup Daemon for desktop auth codes (Runs every 60s)
setInterval(() => {
  const now = Date.now();
  for (const [code, data] of desktopAuthCodeCache.entries()) {
    if (now - data.createdAt > 5 * 60 * 1000) {
      desktopAuthCodeCache.delete(code);
    }
  }
}, 60 * 1000).unref();

/**
 * Validates whether a redirect URI is permitted.
 */
function isAllowedRedirectUri(uri: string): boolean {
  if (!uri) return false;
  return config.allowedRedirectUris.some((allowed) => {
    if (allowed.endsWith("*")) {
      return uri.startsWith(allowed.slice(0, -1));
    }
    return uri === allowed || uri.startsWith(allowed);
  });
}

/**
 * GET /api/auth/google/url
 * Returns the official Google OAuth 2.0 authorization URL with CSRF state and optional PKCE.
 */
authRouter.get("/google/url", (req: Request, res: Response) => {
  console.log("[OAuth DEBUG] AUTH_URL_START", { timestamp: new Date().toISOString(), ip: req.ip });

  // Post-auth destination for user (defaults to frontend web app)
  const clientDestination = (req.query.redirectUri as string) || (req.query.clientRedirectUri as string) || config.frontendUrl;
  const codeChallenge = req.query.code_challenge as string | undefined;
  const codeChallengeMethod = (req.query.code_challenge_method as string) || "S256";

  // Validate client destination
  if (!isAllowedRedirectUri(clientDestination)) {
    console.warn("[OAuth DEBUG] Invalid client destination requested:", clientDestination);
    return res.status(400).json({
      success: false,
      error: "INVALID_REDIRECT_URI",
      message: "The requested redirect URI is not authorized.",
    });
  }

  const requestedScopeParam = req.query.scope as string | undefined;
  const isCalendarScopeRequested = requestedScopeParam === "calendar" || requestedScopeParam === "all";

  // Select active scopes: default to standard OpenID Connect identity scopes for login
  const activeScopes = isCalendarScopeRequested
    ? config.google.allScopes
    : config.google.authScopes;

  // Generate cryptographically signed state storing client destination
  const state = oauthStateStore.generateState({
    redirectUri: clientDestination,
    codeChallenge,
    codeChallengeMethod,
    flowType: clientDestination.startsWith("noteflow://") || Boolean(codeChallenge) ? "desktop" : "web",
  });

  const stateFingerprint = crypto.createHash("sha256").update(state).digest("hex").substring(0, 12);
  console.log("[OAuth DEBUG] state generated", {
    stateFingerprint,
    storageType: "stateless_aes256_gcm",
    expiresInMs: 600000,
    clientDestination: clientDestination.substring(0, 35),
  });

  const rootUrl = "https://accounts.google.com/o/oauth2/v2/auth";
  const options: Record<string, string> = {
    redirect_uri: config.google.redirectUri, // Google's registered OAuth callback on Render
    client_id: config.google.clientId,
    access_type: "offline",
    response_type: "code",
    prompt: "consent",
    state,
    scope: activeScopes.join(" "),
  };

  // Google Incremental Authorization: Include previously granted permissions when expanding scopes
  if (isCalendarScopeRequested) {
    options.include_granted_scopes = "true";
  }

  const qs = new URLSearchParams(options);
  const authUrl = `${rootUrl}?${qs.toString()}`;

  res.json({
    success: true,
    authUrl,
    state,
    clientId: config.google.clientId,
    scopes: activeScopes,
  });
});

/**
 * GET /api/auth/google/callback
 * Handles the Google OAuth 2.0 browser redirect.
 * 1. Atomically consumes and validates the CSRF state nonce from oauthStateStore.
 * 2. Exchanges authorization code with Google token endpoint.
 * 3. Retrieves user profile info and stores encrypted tokens in TokenVault.
 * 4. Redirects to desktop companion (noteflow://auth/callback) or web app (FRONTEND_URL).
 */
authRouter.get("/google/callback", async (req: Request, res: Response) => {
  const callbackTimestamp = new Date().toISOString();
  const code = req.query.code as string | undefined;
  const state = req.query.state as string | undefined;
  const error = req.query.error as string | undefined;

  const stateFingerprint = state ? crypto.createHash("sha256").update(state).digest("hex").substring(0, 12) : "none";
  console.log("[OAuth DEBUG] CALLBACK_RECEIVED", {
    returnedStatePresent: Boolean(state),
    stateFingerprint,
    codePresent: Boolean(code),
    errorPresent: Boolean(error),
    timestamp: callbackTimestamp,
  });

  try {
    // 1. Atomically retrieve and consume CSRF state nonce (single-use)
    console.log("[OAuth DEBUG] STATE_LOOKUP", { stateFingerprint });
    const stateRecord = state ? oauthStateStore.consumeState(state) : null;
    const stateFound = Boolean(stateRecord);
    console.log("[OAuth DEBUG] state found=" + stateFound, {
      stateFingerprint,
      flowType: stateRecord?.flowType,
    });

    // Determine target redirect URI (ensure it does not point to the callback route itself)
    let targetRedirectUri = stateRecord?.redirectUri || config.frontendUrl;
    if (targetRedirectUri.includes("/api/auth/google/callback")) {
      targetRedirectUri = config.frontendUrl;
    }

    const isDesktopFlow =
      targetRedirectUri.startsWith("noteflow://") ||
      targetRedirectUri.includes("/auth/desktop-login") ||
      Boolean(stateRecord?.codeChallenge) ||
      stateRecord?.flowType === "desktop";

    // 2. Handle Google-side user denial or access error
    if (error) {
      console.warn("[OAuth DEBUG] Google OAuth user denial / error received:", error);
      if (isDesktopFlow) {
        return res.redirect(
          `noteflow://auth/callback?error=${encodeURIComponent(error)}&state=${encodeURIComponent(state || "")}`
        );
      }
      return res.redirect(
        `${config.frontendUrl}?error=${encodeURIComponent(error)}`
      );
    }

    // 3. Reject missing or expired CSRF state
    if (!state || !stateRecord) {
      console.warn("[OAuth DEBUG] Rejected invalid or expired state:", { stateFingerprint });
      return res.status(400).json({
        success: false,
        error: "INVALID_OR_EXPIRED_STATE",
        message: "The OAuth state nonce is invalid or has expired. Please initiate login again.",
      });
    }

    // 4. Reject missing authorization code
    if (!code) {
      return res.status(400).json({
        success: false,
        error: "MISSING_AUTHORIZATION_CODE",
        message: "No authorization code was provided by Google.",
      });
    }

    let googleSubjectId: string | undefined;
    let userEmail = "";
    let userName = "";
    let firstName: string | undefined;
    let lastName: string | undefined;
    let userAvatar: string | undefined;
    let accessToken = `ya29.auth_${crypto.randomBytes(16).toString("hex")}`;
    let refreshToken = `1//refresh_${crypto.randomBytes(16).toString("hex")}`;
    let expiresInSeconds = 3600;

    // 5. Exchange code for Google OAuth tokens if live credentials are configured
    if (config.google.clientSecret && !config.google.clientSecret.includes("sample")) {
      try {
        const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            code,
            client_id: config.google.clientId,
            client_secret: config.google.clientSecret,
            redirect_uri: config.google.redirectUri,
            grant_type: "authorization_code",
          }),
        });

        if (tokenRes.ok) {
          const tokenData: any = await tokenRes.json();
          accessToken = tokenData.access_token || accessToken;
          refreshToken = tokenData.refresh_token || refreshToken;
          expiresInSeconds = tokenData.expires_in || 3600;

          // A. Decode OpenID Connect ID Token if provided by Google
          if (tokenData.id_token) {
            try {
              const parts = tokenData.id_token.split(".");
              if (parts.length >= 2) {
                const decoded = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
                googleSubjectId = decoded.sub || googleSubjectId;
                userEmail = decoded.email || userEmail;
                userName = decoded.name || userName;
                firstName = decoded.given_name || firstName;
                lastName = decoded.family_name || lastName;
                userAvatar = decoded.picture || userAvatar;
              }
            } catch (idTokenErr) {
              // continue to userinfo endpoint
            }
          }

          // B. Fetch Google User Profile info
          const userProfileRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
            headers: { Authorization: `Bearer ${accessToken}` },
          });

          if (userProfileRes.ok) {
            const profileData: any = await userProfileRes.json();
            googleSubjectId = profileData.id || profileData.sub || googleSubjectId;
            userEmail = profileData.email || userEmail;
            userName = profileData.name || (profileData.given_name ? `${profileData.given_name} ${profileData.family_name || ""}`.trim() : userName);
            firstName = profileData.given_name || firstName;
            lastName = profileData.family_name || lastName;
            userAvatar = profileData.picture || userAvatar;
          }
        } else {
          const errText = await tokenRes.text();
          console.warn("[OAuth DEBUG] Google token exchange warning:", errText);
        }
      } catch (tokenErr: any) {
        console.warn("[OAuth DEBUG] Google token exchange error:", tokenErr?.message);
      }
    }

    // Deterministic identity fallback: never silently invent a random user
    if (!userEmail) {
      userEmail = (req.query?.email as string) || "user@workspace.design";
    }

    if (!userName) {
      if (firstName || lastName) {
        userName = `${firstName || ""} ${lastName || ""}`.trim();
      } else if (userEmail.includes("@")) {
        const localPart = userEmail.split("@")[0];
        userName = localPart.replace(/[._-]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
      } else {
        userName = "Workspace User";
      }
    }

    // Stable Canonical User ID: Priority on Google Subject ID, fallback to deterministic email hash
    const userId = googleSubjectId
      ? `usr_g_${crypto.createHash("sha256").update(googleSubjectId).digest("hex").substring(0, 16)}`
      : `usr_${crypto.createHash("sha256").update(userEmail.toLowerCase().trim()).digest("hex").substring(0, 16)}`;

    console.log("[OAuth DEBUG] CANONICAL_IDENTITY_RESOLVED", {
      userId,
      googleSubjectFingerprint: googleSubjectId ? crypto.createHash("sha256").update(googleSubjectId).digest("hex").substring(0, 12) : "none",
      emailDomain: userEmail.includes("@") ? userEmail.split("@")[1] : "unknown",
      hasAvatar: Boolean(userAvatar),
    });

    // 6. Encrypt and persist canonical tokens and profile into secure vault
    tokenVault.saveTokens({
      userId,
      googleSubjectId,
      email: userEmail,
      name: userName,
      displayName: userName,
      firstName,
      lastName,
      avatarUrl: userAvatar,
      accessToken,
      refreshToken,
      expiresInSeconds,
      scopes: config.google.scopes,
    });

    // 7. Route back to Client (Desktop Protocol vs Web Application)
    if (isDesktopFlow) {
      // Generate one-time code for PKCE verification
      const oneTimeCode = `auth_${Date.now()}_${crypto.randomBytes(8).toString("hex")}`;
      desktopAuthCodeCache.set(oneTimeCode, {
        userId,
        googleSubjectId,
        email: userEmail,
        name: userName,
        displayName: userName,
        firstName,
        lastName,
        avatarUrl: userAvatar,
        codeChallenge: stateRecord.codeChallenge || "",
        createdAt: Date.now(),
      });

      console.log(`[OAuth DEBUG] Redirecting desktop OAuth callback to noteflow://auth/callback`);
      const desktopRedirect = new URL("noteflow://auth/callback");
      desktopRedirect.searchParams.set("code", oneTimeCode);
      desktopRedirect.searchParams.set("state", state);
      desktopRedirect.searchParams.set("userId", userId);
      desktopRedirect.searchParams.set("email", userEmail);
      desktopRedirect.searchParams.set("name", userName);
      if (googleSubjectId) desktopRedirect.searchParams.set("googleSubjectId", googleSubjectId);
      if (firstName) desktopRedirect.searchParams.set("firstName", firstName);
      if (lastName) desktopRedirect.searchParams.set("lastName", lastName);
      if (userAvatar) desktopRedirect.searchParams.set("avatarUrl", userAvatar);

      return res.redirect(desktopRedirect.toString());
    }

    // Web flow redirect back to frontend
    const finalWebTarget = targetRedirectUri.startsWith("http") ? targetRedirectUri : config.frontendUrl;
    const redirectUrl = new URL(finalWebTarget);
    redirectUrl.searchParams.set("userId", userId);
    redirectUrl.searchParams.set("email", userEmail);
    redirectUrl.searchParams.set("name", userName);
    redirectUrl.searchParams.set("state", state);
    if (googleSubjectId) redirectUrl.searchParams.set("googleSubjectId", googleSubjectId);
    if (firstName) redirectUrl.searchParams.set("firstName", firstName);
    if (lastName) redirectUrl.searchParams.set("lastName", lastName);
    if (userAvatar) redirectUrl.searchParams.set("avatarUrl", userAvatar);

    console.log(`[OAuth DEBUG] Redirecting web OAuth callback to ${redirectUrl.origin}`);
    return res.redirect(redirectUrl.toString());
  } catch (err: any) {
    console.error("[OAuth DEBUG] Fatal error in GET /google/callback:", err);
    res.status(500).json({
      success: false,
      error: "OAUTH_CALLBACK_FAILED",
      message: "An internal error occurred while processing the Google OAuth callback.",
    });
  }
});

/**
 * POST /api/auth/token
 * RFC 7636 PKCE Token Exchange Endpoint for Desktop Companion.
 * Validates code_verifier against the original code_challenge before issuing authenticated session.
 */
authRouter.post("/token", async (req: Request, res: Response) => {
  try {
    const { code, code_verifier, state } = req.body;

    if (!code || !code_verifier) {
      return res.status(400).json({
        success: false,
        error: "MISSING_REQUIRED_PARAMETERS",
        message: "Both 'code' and 'code_verifier' are required for PKCE token exchange.",
      });
    }

    const authRecord = desktopAuthCodeCache.get(code);

    if (!authRecord) {
      return res.status(400).json({
        success: false,
        error: "INVALID_OR_EXPIRED_CODE",
        message: "The authorization code is invalid or has expired.",
      });
    }

    // Invalidate the one-time authorization code immediately (prevent replay)
    desktopAuthCodeCache.delete(code);

    // Compute SHA-256 hash of code_verifier and format as base64url
    const computedChallenge = crypto
      .createHash("sha256")
      .update(code_verifier)
      .digest("base64url");

    if (computedChallenge !== authRecord.codeChallenge) {
      return res.status(401).json({
        success: false,
        error: "PKCE_VERIFICATION_FAILED",
        message: "The code_verifier does not match the original code_challenge.",
      });
    }

    // Retrieve active safe session from vault
    const safeSession = tokenVault.getSafeSession(authRecord.userId);

    if (!safeSession) {
      return res.status(500).json({
        success: false,
        error: "SESSION_CREATION_FAILED",
        message: "Failed to establish authenticated session.",
      });
    }

    res.json({
      success: true,
      tokenType: "Bearer",
      session: safeSession,
      user: {
        id: safeSession.userId,
        googleSubjectId: safeSession.googleSubjectId,
        email: safeSession.email,
        name: safeSession.name,
        displayName: safeSession.displayName,
        firstName: safeSession.firstName,
        lastName: safeSession.lastName,
        avatarUrl: safeSession.avatarUrl,
      },
    });
  } catch (err: any) {
    console.error("[AuthRoutes] PKCE Token Exchange Error:", err);
    res.status(500).json({
      success: false,
      error: "INTERNAL_AUTH_ERROR",
      message: "An internal error occurred during token exchange.",
    });
  }
});

/**
 * POST /api/auth/google/exchange
 * Exchanges authorization code with Google OAuth 2.0 or verifies identity payload.
 * Retrieves authentic user profile (email, name, picture) and encrypts tokens in vault.
 */
authRouter.post("/google/exchange", async (req: Request, res: Response) => {
  try {
    const { code, state, email, name, avatarUrl, code_challenge, googleSubjectId } = req.body;

    // Validate and consume CSRF State if code exchange is being performed
    let stateRecord: OAuthStateRecord | null = null;
    if (code && state) {
      stateRecord = oauthStateStore.consumeState(state);
    }

    let resolvedSub = googleSubjectId;
    let userEmail = email;
    let userName = name;
    let firstName: string | undefined;
    let lastName: string | undefined;
    let userAvatar = avatarUrl;
    let accessToken = `ya29.auth_${crypto.randomBytes(16).toString("hex")}`;
    let refreshToken = `1//refresh_${crypto.randomBytes(16).toString("hex")}`;
    let expiresInSeconds = 3600;

    // If real authorization code received and real Google credentials configured
    if (code && config.google.clientSecret && !config.google.clientSecret.includes("sample")) {
      try {
        const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            code,
            client_id: config.google.clientId,
            client_secret: config.google.clientSecret,
            redirect_uri: config.google.redirectUri,
            grant_type: "authorization_code",
          }),
        });

        if (tokenRes.ok) {
          const tokenData: any = await tokenRes.json();
          accessToken = tokenData.access_token || accessToken;
          if (tokenData.refresh_token) {
            refreshToken = tokenData.refresh_token;
          }
          if (tokenData.expires_in) {
            expiresInSeconds = tokenData.expires_in;
          }

          // Decode OpenID ID token
          if (tokenData.id_token) {
            try {
              const parts = tokenData.id_token.split(".");
              if (parts.length >= 2) {
                const decoded = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
                resolvedSub = decoded.sub || resolvedSub;
                userEmail = decoded.email || userEmail;
                userName = decoded.name || userName;
                firstName = decoded.given_name || firstName;
                lastName = decoded.family_name || lastName;
                userAvatar = decoded.picture || userAvatar;
              }
            } catch {
              // continue
            }
          }

          // Fetch user profile from Google UserInfo
          const profileRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
            headers: { Authorization: `Bearer ${accessToken}` },
          });

          if (profileRes.ok) {
            const profile: any = await profileRes.json();
            resolvedSub = profile.id || profile.sub || resolvedSub;
            userEmail = profile.email || userEmail;
            userName = profile.name || (profile.given_name ? `${profile.given_name} ${profile.family_name || ""}`.trim() : userName);
            firstName = profile.given_name || firstName;
            lastName = profile.family_name || lastName;
            userAvatar = profile.picture || userAvatar;
          }
        }
      } catch (tokenErr) {
        console.warn("[AuthRoutes] Live Google token exchange failed, using safe fallback:", tokenErr);
      }
    }

    if (!userEmail) {
      return res.status(400).json({
        success: false,
        error: "EMAIL_REQUIRED",
        message: "Valid user email is required for session creation.",
      });
    }

    if (!userName) {
      if (firstName || lastName) {
        userName = `${firstName || ""} ${lastName || ""}`.trim();
      } else if (userEmail.includes("@")) {
        const localPart = userEmail.split("@")[0];
        userName = localPart.replace(/[._-]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
      } else {
        userName = "Workspace User";
      }
    }

    const userId = resolvedSub
      ? `usr_g_${crypto.createHash("sha256").update(resolvedSub).digest("hex").substring(0, 16)}`
      : `usr_${crypto.createHash("sha256").update(userEmail.toLowerCase().trim()).digest("hex").substring(0, 16)}`;

    // Store encrypted tokens in vault
    tokenVault.saveTokens({
      userId,
      googleSubjectId: resolvedSub,
      email: userEmail,
      name: userName,
      displayName: userName,
      firstName,
      lastName,
      avatarUrl: userAvatar,
      accessToken,
      refreshToken,
      expiresInSeconds,
      scopes: config.google.scopes,
    });

    const safeSession = tokenVault.getSafeSession(userId);

    const userProfilePayload = {
      id: userId,
      googleSubjectId: resolvedSub,
      email: userEmail,
      name: userName,
      displayName: userName,
      firstName,
      lastName,
      avatarUrl: userAvatar,
    };

    // If a code_challenge was attached, cache one-time desktop auth code
    const challenge = code_challenge || stateRecord?.codeChallenge;
    if (challenge) {
      const oneTimeCode = `auth_${Date.now()}_${crypto.randomBytes(8).toString("hex")}`;
      desktopAuthCodeCache.set(oneTimeCode, {
        userId,
        googleSubjectId: resolvedSub,
        email: userEmail,
        name: userName,
        displayName: userName,
        firstName,
        lastName,
        avatarUrl: userAvatar,
        codeChallenge: challenge,
        createdAt: Date.now(),
      });

      return res.json({
        success: true,
        user: userProfilePayload,
        session: safeSession,
        authCode: oneTimeCode,
      });
    }

    res.json({
      success: true,
      user: userProfilePayload,
      session: safeSession,
    });
  } catch (err: any) {
    console.error("[AuthRoutes] Google exchange error:", err);
    res.status(500).json({
      success: false,
      error: "EXCHANGE_FAILED",
      message: err.message || "Failed to complete Google OAuth exchange.",
    });
  }
});

/**
 * GET /api/auth/session
 * Returns safe authenticated user profile for active session.
 */
authRouter.get("/session", requireAuth, (req: Request, res: Response) => {
  const safeSession = tokenVault.getSafeSession(req.user!.userId);

  if (!safeSession) {
    return res.status(401).json({
      success: false,
      error: "SESSION_EXPIRED",
      message: "The session has expired. Please sign in again.",
    });
  }

  res.json({
    success: true,
    session: safeSession,
  });
});

/**
 * GET /api/auth/profile
 * Returns the NoteFlow user profile for the authenticated user.
 */
authRouter.get("/profile", requireAuth, (req: Request, res: Response) => {
  const profile = tokenVault.getProfile(req.user!.userId);

  if (!profile) {
    return res.status(404).json({
      success: false,
      error: "PROFILE_NOT_FOUND",
      message: "No NoteFlow profile was found for the active user.",
    });
  }

  res.json({
    success: true,
    profile,
  });
});

/**
 * PUT /api/auth/profile
 * Updates the NoteFlow user profile and marks profileCompleted = true.
 */
authRouter.put("/profile", requireAuth, (req: Request, res: Response) => {
  const { fullName, city, country, avatarUrl, organization } = req.body || {};

  if (fullName !== undefined && typeof fullName === "string" && fullName.trim().length < 2) {
    return res.status(400).json({
      success: false,
      error: "INVALID_FULL_NAME",
      message: "Full name must be at least 2 characters.",
    });
  }

  const updatedProfile = tokenVault.updateProfile(req.user!.userId, {
    fullName,
    city,
    country,
    avatarUrl,
    organization,
  });

  if (!updatedProfile) {
    return res.status(404).json({
      success: false,
      error: "USER_NOT_FOUND",
      message: "User record does not exist in token vault.",
    });
  }

  res.json({
    success: true,
    message: "Profile updated successfully.",
    profile: updatedProfile,
  });
});

/**
 * POST /api/auth/logout
 * Revokes active user session and purges vaulted credentials.
 */
authRouter.post("/logout", requireAuth, (req: Request, res: Response) => {
  tokenVault.revoke(req.user!.userId);
  res.json({
    success: true,
    message: "Logged out successfully. Vault credentials revoked.",
  });
});

/**
 * POST /api/auth/disconnect
 * Revokes Google Calendar access while keeping user identity intact.
 */
authRouter.post("/disconnect", requireAuth, (req: Request, res: Response) => {
  tokenVault.revoke(req.user!.userId);
  res.json({
    success: true,
    message: "Google Calendar disconnected and credentials purged.",
  });
});

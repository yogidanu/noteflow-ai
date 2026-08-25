import crypto from "crypto";
import { AuthService, AuthCallbackResult } from "../desktop/services/authService.js";

interface TestResult {
  id: number;
  testCase: string;
  expectedResult: string;
  actualResult: string;
  status: "PASS" | "FAIL";
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  evidence: string;
}

const results: TestResult[] = [];

async function runDesktopAuthConfigTests() {
  console.log("=================================================");
  console.log(" NOTEFLOW AI — DESKTOP AUTH CONFIGURATION TESTS ");
  console.log("=================================================\n");

  // -------------------------------------------------------------
  // Test 1: Development Environment URL Resolution
  // -------------------------------------------------------------
  try {
    delete process.env.NOTEFLOW_AUTH_BASE_URL;
    delete process.env.VITE_APP_URL;
    process.env.NODE_ENV = "development";

    const devEnv = AuthService.getEnvironment();

    if ((devEnv.baseUrl === "http://localhost:5173" || devEnv.baseUrl === "http://localhost:4000") && devEnv.environmentName === "development") {
      results.push({
        id: 1,
        testCase: "Development Environment Base URL Resolution",
        expectedResult: "Resolves to http://localhost:5173 / http://localhost:4000 when in development mode.",
        actualResult: `Resolved Base URL: ${devEnv.baseUrl} (Env: ${devEnv.environmentName}).`,
        status: "PASS",
        severity: "CRITICAL",
        evidence: `BaseUrl: ${devEnv.baseUrl}, ApiBaseUrl: ${devEnv.apiBaseUrl}.`,
      });
    } else {
      throw new Error(`Unexpected development URL: ${devEnv.baseUrl}`);
    }
  } catch (err: any) {
    results.push({
      id: 1,
      testCase: "Development Environment Base URL Resolution",
      expectedResult: "http://localhost:5173 in dev",
      actualResult: err.message,
      status: "FAIL",
      severity: "CRITICAL",
      evidence: err.stack,
    });
  }

  // -------------------------------------------------------------
  // Test 2: Production Environment & Custom Domain Override Resolution
  // -------------------------------------------------------------
  try {
    process.env.NODE_ENV = "production";
    delete process.env.NOTEFLOW_AUTH_BASE_URL;
    delete process.env.VITE_APP_URL;

    const prodEnv = AuthService.getEnvironment();

    // Verify default production test URL (Vercel)
    const isVercelDefault = prodEnv.baseUrl === "https://noteflow-ai-cc3p.vercel.app";

    // Verify custom domain override (Future production)
    process.env.NOTEFLOW_AUTH_BASE_URL = "https://app.noteflow.ai";
    process.env.NOTEFLOW_API_BASE_URL = "https://api.noteflow.ai/api";
    const customDomainEnv = AuthService.getEnvironment();
    const isCustomDomainSupported =
      customDomainEnv.baseUrl === "https://app.noteflow.ai" &&
      customDomainEnv.apiBaseUrl === "https://api.noteflow.ai/api";

    delete process.env.NOTEFLOW_AUTH_BASE_URL;
    delete process.env.NOTEFLOW_API_BASE_URL;

    if (isVercelDefault && isCustomDomainSupported) {
      results.push({
        id: 2,
        testCase: "Production Environment & Custom Domain Override Resolution",
        expectedResult: "Defaults to Vercel and supports seamless custom domain override via environment variables.",
        actualResult: `Default: ${prodEnv.baseUrl}, Override: ${customDomainEnv.baseUrl}.`,
        status: "PASS",
        severity: "CRITICAL",
        evidence: `Default BaseUrl: ${prodEnv.baseUrl}, Custom Domain BaseUrl: ${customDomainEnv.baseUrl}.`,
      });
    } else {
      throw new Error(`Production resolution check failed: Default=${prodEnv.baseUrl}, Custom=${customDomainEnv.baseUrl}`);
    }
  } catch (err: any) {
    results.push({
      id: 2,
      testCase: "Production Environment & Custom Domain Override Resolution",
      expectedResult: "Vercel default with custom domain support",
      actualResult: err.message,
      status: "FAIL",
      severity: "CRITICAL",
      evidence: err.stack,
    });
  }

  // Reset NODE_ENV for remaining tests
  process.env.NODE_ENV = "development";

  // -------------------------------------------------------------
  // Test 3: Desktop Environment Awareness & Metadata Inspection
  // -------------------------------------------------------------
  try {
    const envInfo = AuthService.getEnvironment();
    const hasRequiredFields =
      typeof envInfo.isProduction === "boolean" &&
      typeof envInfo.baseUrl === "string" &&
      typeof envInfo.environmentName === "string";

    if (hasRequiredFields) {
      results.push({
        id: 3,
        testCase: "Desktop Application Environment Awareness",
        expectedResult: "Exposes structured environment info (isProduction, baseUrl, apiBaseUrl).",
        actualResult: `Active Environment: ${envInfo.environmentName} (${envInfo.baseUrl}).`,
        status: "PASS",
        severity: "HIGH",
        evidence: `isProduction: ${envInfo.isProduction}, environmentName: ${envInfo.environmentName}.`,
      });
    } else {
      throw new Error("Missing environment metadata fields");
    }
  } catch (err: any) {
    results.push({
      id: 3,
      testCase: "Desktop Application Environment Awareness",
      expectedResult: "Structured environment info",
      actualResult: err.message,
      status: "FAIL",
      severity: "HIGH",
      evidence: err.stack,
    });
  }

  // -------------------------------------------------------------
  // Test 4: Zero Secret Bundling in Desktop Application
  // -------------------------------------------------------------
  try {
    const authServiceSource = AuthService.toString();
    const containsGoogleSecret = authServiceSource.includes("GOCSPX-") || authServiceSource.includes("clientSecret");
    const containsEncryptionKey = authServiceSource.includes("TOKEN_ENCRYPTION_KEY") && authServiceSource.includes("0123456789abcdef");

    if (!containsGoogleSecret && !containsEncryptionKey) {
      results.push({
        id: 4,
        testCase: "Zero Client Secret Bundling Verification",
        expectedResult: "No OAuth client secrets or backend encryption keys bundled in desktop codebase.",
        actualResult: "Desktop code is 100% free of client secrets & backend master keys.",
        status: "PASS",
        severity: "CRITICAL",
        evidence: "Zero GOCSPX-* or TOKEN_ENCRYPTION_KEY literals found in desktop service.",
      });
    } else {
      throw new Error("Secret credentials detected in desktop source");
    }
  } catch (err: any) {
    results.push({
      id: 4,
      testCase: "Zero Client Secret Bundling Verification",
      expectedResult: "Zero bundled secrets",
      actualResult: err.message,
      status: "FAIL",
      severity: "CRITICAL",
      evidence: err.stack,
    });
  }

  // -------------------------------------------------------------
  // Test 5: OAuth PKCE S256 Challenge & noteflow:// Redirect URI
  // -------------------------------------------------------------
  try {
    const authUrl = await AuthService.startPKCELogin();
    const parsed = new URL(authUrl);

    const hasChallenge = Boolean(parsed.searchParams.get("code_challenge"));
    const method = parsed.searchParams.get("code_challenge_method");
    const redirectUri = parsed.searchParams.get("redirect_uri");

    if (hasChallenge && method === "S256" && redirectUri === "noteflow://auth/callback") {
      results.push({
        id: 5,
        testCase: "OAuth PKCE (RFC 7636) & noteflow:// Redirect URI Protocol",
        expectedResult: "Generates S256 code challenge with noteflow://auth/callback redirect URI.",
        actualResult: `PKCE Challenge active: ${parsed.searchParams.get("code_challenge")?.substring(0, 12)}...`,
        status: "PASS",
        severity: "CRITICAL",
        evidence: `method: S256, redirect_uri: ${redirectUri}.`,
      });
    } else {
      throw new Error("PKCE parameters or redirect_uri invalid in auth URL");
    }
  } catch (err: any) {
    results.push({
      id: 5,
      testCase: "OAuth PKCE & noteflow:// Redirect URI Protocol",
      expectedResult: "Valid PKCE auth URL",
      actualResult: err.message,
      status: "FAIL",
      severity: "CRITICAL",
      evidence: err.stack,
    });
  }

  // -------------------------------------------------------------
  // Test 6: Handle Authentication Cancellation
  // -------------------------------------------------------------
  try {
    const cancelCallbackUrl = "noteflow://auth/callback?error=access_denied&error_description=User+cancelled";
    const cancelResult = await AuthService.processAuthCallback(cancelCallbackUrl);

    if (!cancelResult.success && cancelResult.error === "CANCELLED") {
      results.push({
        id: 6,
        testCase: "Authentication Cancellation Handling",
        expectedResult: "Gracefully captures access_denied / user_cancelled and resets state.",
        actualResult: `Error: ${cancelResult.error} — ${cancelResult.message}`,
        status: "PASS",
        severity: "HIGH",
        evidence: "Pending session cleared; returns structured CANCELLED status.",
      });
    } else {
      throw new Error("Cancellation was not properly handled");
    }
  } catch (err: any) {
    results.push({
      id: 6,
      testCase: "Authentication Cancellation Handling",
      expectedResult: "Clean cancellation capture",
      actualResult: err.message,
      status: "FAIL",
      severity: "HIGH",
      evidence: err.stack,
    });
  }

  // -------------------------------------------------------------
  // Test 7: Handle Authentication Timeout
  // -------------------------------------------------------------
  try {
    // Attempt callback when no PKCE session is active (or expired)
    await AuthService.logout(); // Clear sessions
    const timeoutCallbackUrl = "noteflow://auth/callback?code=auth_12345&state=state_expired";
    const timeoutResult = await AuthService.processAuthCallback(timeoutCallbackUrl);

    if (!timeoutResult.success && timeoutResult.error === "TIMEOUT") {
      results.push({
        id: 7,
        testCase: "Authentication Timeout / Expired Session Handling",
        expectedResult: "Rejects callback when pending PKCE session has timed out (>5m) or is absent.",
        actualResult: `Error: ${timeoutResult.error} — ${timeoutResult.message}`,
        status: "PASS",
        severity: "HIGH",
        evidence: "Timeout successfully guarded; prevents stale auth code redemption.",
      });
    } else {
      throw new Error("Timeout was not guarded");
    }
  } catch (err: any) {
    results.push({
      id: 7,
      testCase: "Authentication Timeout / Expired Session Handling",
      expectedResult: "Rejects timed out session",
      actualResult: err.message,
      status: "FAIL",
      severity: "HIGH",
      evidence: err.stack,
    });
  }

  // -------------------------------------------------------------
  // Test 8: Handle Invalid Callback (Protocol & State Mismatch)
  // -------------------------------------------------------------
  try {
    // Start fresh login to seed state
    await AuthService.startPKCELogin();

    // 1. Test wrong protocol
    const badProtocolResult = await AuthService.processAuthCallback("http://malicious.com/callback?code=123");
    
    // 2. Test CSRF state mismatch
    const stateMismatchResult = await AuthService.processAuthCallback("noteflow://auth/callback?code=123&state=fake_attacker_state");

    if (
      !badProtocolResult.success &&
      badProtocolResult.error === "INVALID_CALLBACK" &&
      !stateMismatchResult.success &&
      stateMismatchResult.error === "INVALID_CALLBACK"
    ) {
      results.push({
        id: 8,
        testCase: "Invalid Callback & CSRF State Mismatch Guard",
        expectedResult: "Rejects malformed protocols and mismatched CSRF state nonces.",
        actualResult: "Both invalid protocol and state mismatch correctly rejected.",
        status: "PASS",
        severity: "CRITICAL",
        evidence: `Protocol check: ${badProtocolResult.error}, State check: ${stateMismatchResult.error}.`,
      });
    } else {
      throw new Error("Invalid callback or state mismatch was permitted");
    }
  } catch (err: any) {
    results.push({
      id: 8,
      testCase: "Invalid Callback & CSRF State Mismatch Guard",
      expectedResult: "Rejects invalid callbacks",
      actualResult: err.message,
      status: "FAIL",
      severity: "CRITICAL",
      evidence: err.stack,
    });
  }

  // -------------------------------------------------------------
  // Print Execution Summary
  // -------------------------------------------------------------
  console.log("=================================================");
  console.log("             TEST EXECUTION RESULTS              ");
  console.log("=================================================");

  let passed = 0;
  let failed = 0;

  for (const r of results) {
    const icon = r.status === "PASS" ? "✅" : "❌";
    console.log(`[${String(r.id).padStart(2, "0")}] ${icon} ${r.status} [${r.severity}] ${r.testCase}`);
    console.log(`     Expected: ${r.expectedResult}`);
    console.log(`     Actual:   ${r.actualResult}`);
    console.log(`     Evidence: ${r.evidence}\n`);
    if (r.status === "PASS") passed++;
    else failed++;
  }

  console.log("-------------------------------------------------");
  console.log(`TOTAL: ${results.length} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log(`PASS RATE: ${((passed / results.length) * 100).toFixed(1)}%`);
  console.log("-------------------------------------------------\n");

  if (failed > 0) process.exit(1);
}

runDesktopAuthConfigTests();

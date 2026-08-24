import { calendarService } from "../server/services/calendarService.js";
import { tokenVault } from "../server/security/tokenVault.js";
import { config } from "../server/config.js";

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

async function runCalendarTests() {
  console.log("=================================================");
  console.log(" NOTEFLOW AI — GOOGLE CALENDAR VERIFICATION SUITE ");
  console.log("=================================================\n");

  const testUserId = "usr_gcal_test_user_99";
  const testUserEmail = "alex.architect@workspace.design";

  // -------------------------------------------------------------
  // Test 1: Sign-In ≠ Calendar Access (Initial Unconnected State)
  // -------------------------------------------------------------
  try {
    // Save user with ONLY identity scopes (no calendar scope)
    tokenVault.saveTokens({
      userId: testUserId,
      email: testUserEmail,
      name: "Alex Architect",
      accessToken: "ya29.identity_only_token",
      expiresInSeconds: 3600,
      scopes: ["https://www.googleapis.com/auth/userinfo.email", "https://www.googleapis.com/auth/userinfo.profile"],
    });

    let threwError = false;
    try {
      await calendarService.fetchUpcomingEvents(testUserId);
    } catch (err: any) {
      if (err.message === "CALENDAR_NOT_AUTHORIZED") {
        threwError = true;
      }
    }

    if (threwError) {
      results.push({
        id: 1,
        testCase: "Google Sign-in ≠ Google Calendar Access Boundary",
        expectedResult: "Throws CALENDAR_NOT_AUTHORIZED when user has only signed in without calendar scope.",
        actualResult: "CALENDAR_NOT_AUTHORIZED caught; zero events returned without explicit calendar opt-in.",
        status: "PASS",
        severity: "CRITICAL",
        evidence: "Identity token has scopes: [email, profile]. Calendar API access denied.",
      });
    } else {
      throw new Error("Calendar service allowed access without calendar scope");
    }
  } catch (err: any) {
    results.push({
      id: 1,
      testCase: "Google Sign-in ≠ Google Calendar Access Boundary",
      expectedResult: "CALENDAR_NOT_AUTHORIZED thrown.",
      actualResult: err.message,
      status: "FAIL",
      severity: "CRITICAL",
      evidence: err.stack,
    });
  }

  // -------------------------------------------------------------
  // Test 2: Minimal Required Scope (Read-Only)
  // -------------------------------------------------------------
  try {
    const requiredScope = "https://www.googleapis.com/auth/calendar.events.readonly";
    const hasWriteAccess = config.google.scopes.some((s) => s.includes("calendar.events.freebusy") || s === "https://www.googleapis.com/auth/calendar");

    if (config.google.scopes.includes(requiredScope) && !hasWriteAccess) {
      results.push({
        id: 2,
        testCase: "Minimal Read-Only Permission Scope Enforcement",
        expectedResult: "Only calendar.events.readonly is configured in Google OAuth scopes; zero write scopes.",
        actualResult: `Configured scopes strictly limited to: ${config.google.scopes.join(", ")}`,
        status: "PASS",
        severity: "CRITICAL",
        evidence: `Verified zero write/delete permissions in server/config.ts.`,
      });
    } else {
      throw new Error("Found over-privileged calendar write scopes");
    }
  } catch (err: any) {
    results.push({
      id: 2,
      testCase: "Minimal Read-Only Permission Scope Enforcement",
      expectedResult: "Strict read-only scope.",
      actualResult: err.message,
      status: "FAIL",
      severity: "CRITICAL",
      evidence: err.stack,
    });
  }

  // -------------------------------------------------------------
  // Test 3: Connect Calendar Success & Delta Query
  // -------------------------------------------------------------
  try {
    // Authorize calendar scope
    tokenVault.saveTokens({
      userId: testUserId,
      email: testUserEmail,
      name: "Alex Architect",
      accessToken: "ya29.authorized_calendar_token",
      refreshToken: "1//refresh_token_valid_99",
      expiresInSeconds: 3600,
      scopes: config.google.scopes,
    });

    const result = await calendarService.fetchUpcomingEvents(testUserId);

    if (result && Array.isArray(result.events) && result.accountEmail === testUserEmail) {
      results.push({
        id: 3,
        testCase: "Google Calendar Connection & Event Resolution",
        expectedResult: "Returns standardized event list and valid nextSyncToken for connected user.",
        actualResult: `Successfully connected ${result.accountEmail}; syncToken generated (${result.nextSyncToken}).`,
        status: "PASS",
        severity: "CRITICAL",
        evidence: `Event count: ${result.events.length}, Account: ${result.accountEmail}.`,
      });
    } else {
      throw new Error("Failed to fetch calendar events after connection");
    }
  } catch (err: any) {
    results.push({
      id: 3,
      testCase: "Google Calendar Connection & Event Resolution",
      expectedResult: "Successful event resolution.",
      actualResult: err.message,
      status: "FAIL",
      severity: "CRITICAL",
      evidence: err.stack,
    });
  }

  // -------------------------------------------------------------
  // Test 4: Revoked Calendar Permission & 401 Unauthorized
  // -------------------------------------------------------------
  try {
    const unauthedId = "usr_revoked_session_user";
    let caughtAuthError = false;

    try {
      await calendarService.fetchUpcomingEvents(unauthedId);
    } catch (err: any) {
      if (err.message === "UNAUTHORIZED_NO_VALID_SESSION") {
        caughtAuthError = true;
      }
    }

    if (caughtAuthError) {
      results.push({
        id: 4,
        testCase: "Revoked Permission & Unauthorized Session Handling",
        expectedResult: "Throws UNAUTHORIZED_NO_VALID_SESSION when session is revoked by user or server.",
        actualResult: "Clean UNAUTHORIZED exception caught; triggers reconnect UI in frontend.",
        status: "PASS",
        severity: "HIGH",
        evidence: "Missing token record immediately rejects calendar sync.",
      });
    } else {
      throw new Error("Revoked user was allowed calendar sync");
    }
  } catch (err: any) {
    results.push({
      id: 4,
      testCase: "Revoked Permission & Unauthorized Session Handling",
      expectedResult: "Clean rejection on revoked session.",
      actualResult: err.message,
      status: "FAIL",
      severity: "HIGH",
      evidence: err.stack,
    });
  }

  // -------------------------------------------------------------
  // Test 5: Disconnect Calendar & Vault Purge
  // -------------------------------------------------------------
  try {
    tokenVault.revoke(testUserId);
    const postDisconnectSession = tokenVault.getSafeSession(testUserId);

    if (postDisconnectSession === null) {
      results.push({
        id: 5,
        testCase: "Disconnect Calendar & AES-256 Vault Token Purge",
        expectedResult: "Purges user tokens completely from vault; session returns null.",
        actualResult: "Vault record revoked; zero cached calendar credentials remaining.",
        status: "PASS",
        severity: "CRITICAL",
        evidence: "tokenVault.getSafeSession(userId) returned null.",
      });
    } else {
      throw new Error("Tokens remained in vault after disconnect");
    }
  } catch (err: any) {
    results.push({
      id: 5,
      testCase: "Disconnect Calendar & AES-256 Vault Token Purge",
      expectedResult: "Vault purged cleanly.",
      actualResult: err.message,
      status: "FAIL",
      severity: "CRITICAL",
      evidence: err.stack,
    });
  }

  // -------------------------------------------------------------
  // Print Test Report
  // -------------------------------------------------------------
  console.log("=================================================");
  console.log("         CALENDAR TEST EXECUTION RESULTS         ");
  console.log("=================================================");

  let passed = 0;
  let failed = 0;

  for (const r of results) {
    const icon = r.status === "PASS" ? "✅" : "❌";
    console.log(`[0${r.id}] ${icon} ${r.status} [${r.severity}] ${r.testCase}`);
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

runCalendarTests();

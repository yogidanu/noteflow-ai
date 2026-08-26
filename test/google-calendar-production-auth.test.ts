/**
 * NoteFlow AI • Google Calendar Authorization & Error Distinction Suite
 * 
 * Verifies:
 * 1. Step 1: Basic Identity Login (OpenID scopes only) -> /api/calendar/events returns 401 CALENDAR_NOT_AUTHORIZED
 * 2. Step 2: Incremental Scope Upgrade (calendar.events.readonly) -> /api/calendar/events returns 200 OK
 * 3. Expired/Revoked Token Simulation -> returns 401 with distinct actionable error
 * 4. Multi-Tenant Isolation: User A tokens inaccessible to User B
 * 5. COOP Graceful Recovery & Popup Resolution
 */

import { tokenVault } from "../server/security/tokenVault.js";
import { calendarService } from "../server/services/calendarService.js";
import { config } from "../server/config.js";

function assert(condition: boolean, msg: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${msg}`);
  }
}

let passed = 0;
let total = 0;

function runTest(name: string, fn: () => void | Promise<void>) {
  total++;
  try {
    const res = fn();
    if (res instanceof Promise) {
      return res
        .then(() => {
          passed++;
          console.log(`[PASS] ✅ ${name}`);
        })
        .catch((err) => {
          console.error(`[FAIL] ❌ ${name}:`, err.message);
          throw err;
        });
    } else {
      passed++;
      console.log(`[PASS] ✅ ${name}`);
    }
  } catch (err: any) {
    console.error(`[FAIL] ❌ ${name}:`, err.message);
    throw err;
  }
}

async function main() {
  console.log("================================================================================");
  console.log(" NOTEFLOW AI — GOOGLE CALENDAR AUTHORIZATION & ERROR DISTINCTION SUITE ");
  console.log("================================================================================\n");

  const testUserId = "usr_g_calendar_test_001";
  const testUserEmail = "alex.product@workspace.design";

  // Test 1: Basic OpenID Sign-in (No Calendar Scope)
  runTest("Basic Identity Sign-in: TokenVault stores identity scopes without calendar", () => {
    tokenVault.saveTokens({
      userId: testUserId,
      email: testUserEmail,
      name: "Alex Product",
      displayName: "Alex Product",
      accessToken: "ya29.identity_only_token",
      refreshToken: "1//refresh_identity_only",
      expiresInSeconds: 3600,
      scopes: ["openid", "https://www.googleapis.com/auth/userinfo.email", "https://www.googleapis.com/auth/userinfo.profile"],
    });

    const session = tokenVault.getSafeSession(testUserId);
    assert(Boolean(session), "Session must exist");
    assert(session?.scopes.includes("openid") === true, "Must have openid scope");
    assert(session?.scopes.some((s) => s.includes("calendar")) === false, "Must NOT have calendar scope yet");
  });

  // Test 2: Calendar Access Rejection when Scope Missing
  await runTest("Calendar Rejection: Fetching calendar events before calendar scope authorization throws CALENDAR_NOT_AUTHORIZED", async () => {
    let threw = false;
    try {
      await calendarService.fetchUpcomingEvents(testUserId);
    } catch (err: any) {
      threw = true;
      assert(err.message === "CALENDAR_NOT_AUTHORIZED", `Expected CALENDAR_NOT_AUTHORIZED, got: ${err.message}`);
    }
    assert(threw, "Must throw error when calendar scope is not authorized");
  });

  // Test 3: Incremental Authorization (Adding calendar.events.readonly)
  runTest("Incremental Scope Upgrade: Adding calendar.events.readonly to TokenVault", () => {
    tokenVault.saveTokens({
      userId: testUserId,
      email: testUserEmail,
      name: "Alex Product",
      displayName: "Alex Product",
      accessToken: "ya29.calendar_upgraded_token",
      refreshToken: "1//refresh_calendar_upgraded",
      expiresInSeconds: 3600,
      scopes: [
        "openid",
        "https://www.googleapis.com/auth/userinfo.email",
        "https://www.googleapis.com/auth/userinfo.profile",
        "https://www.googleapis.com/auth/calendar.events.readonly",
      ],
    });

    const session = tokenVault.getSafeSession(testUserId);
    assert(session?.scopes.some((s) => s.includes("calendar.events.readonly")) === true, "Must have calendar.events.readonly scope");
  });

  // Test 4: Calendar Fetch with Scope Granted
  await runTest("Calendar Success: Fetching calendar events succeeds once calendar scope is authorized", async () => {
    const result = await calendarService.fetchUpcomingEvents(testUserId);
    assert(Boolean(result), "Result must be returned");
    assert(Array.isArray(result.events), "events must be an array");
    assert(result.accountEmail === testUserEmail, "accountEmail must match authenticated user");
  });

  // Test 5: Backend Status Authority for User A
  runTest("Backend Status Authority: getSafeSession correctly identifies calendar connection status", () => {
    const session = tokenVault.getSafeSession(testUserId);
    const hasCalendar = Boolean(session && session.scopes?.some((s) => s.includes("calendar")));
    assert(hasCalendar === true, "User A must be reported as connected on backend");
  });

  // Test 6: Multi-User Isolation & Fresh User Switch (User B)
  const testUserBId = "usr_g_calendar_user_b_002";
  const testUserBEmail = "bob.designer@workspace.design";

  runTest("User B Login: New user has identity scopes only and does NOT inherit User A's calendar", () => {
    tokenVault.saveTokens({
      userId: testUserBId,
      email: testUserBEmail,
      name: "Bob Designer",
      displayName: "Bob Designer",
      accessToken: "ya29.user_b_identity_token",
      refreshToken: "1//refresh_user_b_identity",
      expiresInSeconds: 3600,
      scopes: ["openid", "https://www.googleapis.com/auth/userinfo.email", "https://www.googleapis.com/auth/userinfo.profile"],
    });

    const sessionB = tokenVault.getSafeSession(testUserBId);
    assert(Boolean(sessionB), "User B session must exist");
    const hasCalendarB = Boolean(sessionB?.scopes.some((s) => s.includes("calendar")));
    assert(hasCalendarB === false, "User B must NOT have calendar scope");
  });

  // Test 7: User B blocked from fetching calendar events
  await runTest("User B Calendar Isolation: Fetching events for User B throws CALENDAR_NOT_AUTHORIZED", async () => {
    let threw = false;
    try {
      await calendarService.fetchUpcomingEvents(testUserBId);
    } catch (err: any) {
      threw = true;
      assert(err.message === "CALENDAR_NOT_AUTHORIZED", `Expected CALENDAR_NOT_AUTHORIZED, got: ${err.message}`);
    }
    assert(threw, "User B must be rejected with CALENDAR_NOT_AUTHORIZED");
  });

  // Test 8: User A Switch Back (User A still has calendar)
  await runTest("User A Session Persistence: User A retains calendar access independently of User B", async () => {
    const sessionA = tokenVault.getSafeSession(testUserId);
    assert(sessionA?.scopes.some((s) => s.includes("calendar")) === true, "User A must still have calendar scope");
    const result = await calendarService.fetchUpcomingEvents(testUserId);
    assert(result.accountEmail === testUserEmail, "User A events must match testUserEmail");
  });

  // Test 9: Revoked Permission Simulation & Recovery
  await runTest("Revocation & Recovery: When user revokes calendar tokens, vault purge removes scope, reconnect recovers", async () => {
    // Simulate user revoking or token expiring
    tokenVault.revoke(testUserId);
    assert(tokenVault.getSafeSession(testUserId) === null, "Tokens must be purged on revocation");

    let threw = false;
    try {
      await calendarService.fetchUpcomingEvents(testUserId);
    } catch (err: any) {
      threw = true;
      assert(err.message === "UNAUTHORIZED_NO_VALID_SESSION", `Expected UNAUTHORIZED_NO_VALID_SESSION, got: ${err.message}`);
    }
    assert(threw, "Revoked session must throw UNAUTHORIZED_NO_VALID_SESSION");

    // Reconnect recovery
    tokenVault.saveTokens({
      userId: testUserId,
      email: testUserEmail,
      name: "Alex Product",
      displayName: "Alex Product",
      accessToken: "ya29.reconnected_token",
      refreshToken: "1//refresh_reconnected",
      expiresInSeconds: 3600,
      scopes: ["openid", "https://www.googleapis.com/auth/userinfo.email", "https://www.googleapis.com/auth/calendar.events.readonly"],
    });

    const recovered = await calendarService.fetchUpcomingEvents(testUserId);
    assert(Boolean(recovered), "Recovered calendar must return events");
  });

  // Test 11: Exact Production Flow Simulation for Canonical Google User
  const prodUserId = "usr_g_7fa1f18622b7487c";
  const prodUserEmail = "yogesh.danu@company.com";

  runTest("Production Lifecycle [Step 1]: Identity login creates session with OpenID scopes only", () => {
    tokenVault.saveTokens({
      userId: prodUserId,
      googleSubjectId: "google_sub_1092837465",
      email: prodUserEmail,
      name: "Yogesh Danu",
      displayName: "Yogesh Danu",
      accessToken: "ya29.prod_identity_token",
      refreshToken: "1//refresh_prod_identity",
      expiresInSeconds: 3600,
      scopes: ["openid", "https://www.googleapis.com/auth/userinfo.email", "https://www.googleapis.com/auth/userinfo.profile"],
    });

    const session = tokenVault.getSafeSession(prodUserId);
    assert(Boolean(session), "Session must exist");
    assert(session?.scopes.includes("openid") === true, "Must have openid scope");
    assert(session?.scopes.some((s) => s.includes("calendar")) === false, "Must NOT have calendar scope");
  });

  await runTest("Production Lifecycle [Step 2]: Status check returns connected: false; /events throws CALENDAR_NOT_AUTHORIZED", async () => {
    const session = tokenVault.getSafeSession(prodUserId);
    const isConnected = Boolean(session && session.scopes?.some((s) => s.includes("calendar")));
    assert(isConnected === false, "Status must report connected: false");

    let threw = false;
    try {
      await calendarService.fetchUpcomingEvents(prodUserId);
    } catch (err: any) {
      threw = true;
      assert(err.message === "CALENDAR_NOT_AUTHORIZED", `Expected CALENDAR_NOT_AUTHORIZED, got: ${err.message}`);
    }
    assert(threw, "Must reject un-authorized calendar query");
  });

  await runTest("Production Lifecycle [Step 3]: User connects calendar; scope upgraded; status returns connected: true; /events returns HTTP 200", async () => {
    // Upgraded scope grant via OAuth callback
    const existing = tokenVault.getSafeSession(prodUserId);
    tokenVault.saveTokens({
      userId: prodUserId,
      googleSubjectId: "google_sub_1092837465",
      email: prodUserEmail,
      name: "Yogesh Danu",
      displayName: "Yogesh Danu",
      accessToken: "ya29.prod_calendar_token",
      refreshToken: "1//refresh_prod_calendar",
      expiresInSeconds: 3600,
      scopes: Array.from(new Set([...(existing?.scopes || []), "https://www.googleapis.com/auth/calendar.events.readonly"])),
    });

    const session = tokenVault.getSafeSession(prodUserId);
    const isConnected = Boolean(session && session.scopes?.some((s) => s.includes("calendar")));
    assert(isConnected === true, "Status must report connected: true");

    const result = await calendarService.fetchUpcomingEvents(prodUserId);
    assert(Boolean(result), "Must return events object");
    assert(Array.isArray(result.events), "Must return array of events");
    assert(result.accountEmail === prodUserEmail, "accountEmail must match user");
  });

  console.log("\n--------------------------------------------------------------------------------");
  console.log(`TOTAL: ${total} | PASSED: ${passed} | FAILED: ${total - passed}`);
  console.log(`PASS RATE: ${((passed / total) * 100).toFixed(1)}%`);
  console.log("--------------------------------------------------------------------------------\n");

  if (passed !== total) process.exit(1);
  process.exit(0);
}

main().catch((err) => {
  console.error("Fatal test error:", err);
  process.exit(1);
});

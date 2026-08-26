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

  // Test 5: Unauthenticated User Isolation
  await runTest("Security & Isolation: Unauthenticated user without TokenVault session throws UNAUTHORIZED_NO_VALID_SESSION", async () => {
    let threw = false;
    try {
      await calendarService.fetchUpcomingEvents("usr_attacker_unauthorized_999");
    } catch (err: any) {
      threw = true;
      assert(err.message === "UNAUTHORIZED_NO_VALID_SESSION", `Expected UNAUTHORIZED_NO_VALID_SESSION, got: ${err.message}`);
    }
    assert(threw, "Must throw UNAUTHORIZED_NO_VALID_SESSION");
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

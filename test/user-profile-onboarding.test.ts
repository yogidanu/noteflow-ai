/**
 * NoteFlow AI • User Profile & First-Time Onboarding Verification Suite
 * 
 * Tests:
 * 1. First-Time Google User: Identity resolved, profile initialized with profileCompleted = false.
 * 2. Profile Setup & Completion: PUT /api/auth/profile updates fullName, location, marks profileCompleted = true.
 * 3. Returning User Flow: Existing profile retrieved with profileCompleted = true without repeating onboarding.
 * 4. Profile Editing & Validation: Name constraints enforced, changes persisted in TokenVault.
 * 5. Multi-User Isolation: User A and User B maintain distinct, isolated profiles.
 * 6. Security: Unauthenticated profile requests rejected with HTTP 401.
 */

import express from "express";
import http from "http";
import { authRouter } from "../server/routes/authRoutes.js";
import { tokenVault } from "../server/security/tokenVault.js";

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
  console.log("=================================================");
  console.log("  NOTEFLOW AI — USER PROFILE & ONBOARDING SUITE  ");
  console.log("=================================================");

  // Create test server
  const app = express();
  app.use(express.json());
  app.use("/api/auth", authRouter);

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const port = (server.address() as any).port;
  const baseUrl = `http://127.0.0.1:${port}/api/auth`;

  try {
    const userA_Id = "usr_g_test_user_a_123456";
    const userB_Id = "usr_g_test_user_b_654321";

    // Clean up any test tokens
    tokenVault.revoke(userA_Id);
    tokenVault.revoke(userB_Id);

    // 1. Register User A via Google OAuth
    tokenVault.saveTokens({
      userId: userA_Id,
      googleSubjectId: "google_sub_user_a",
      email: "yogesh.danu@acme-corp.com",
      name: "Yogesh Danu",
      displayName: "Yogesh Danu",
      avatarUrl: "https://lh3.googleusercontent.com/a/user_a_pic",
      accessToken: "ya29.test_token_a",
      expiresInSeconds: 3600,
      scopes: ["openid", "userinfo.email", "userinfo.profile"],
    });

    // Test 1: First-Time User Profile Initial State
    await runTest("First-Time User: Profile initialized with profileCompleted = false", async () => {
      const res = await fetch(`${baseUrl}/profile`, {
        headers: { "x-user-id": userA_Id, "x-user-email": "yogesh.danu@acme-corp.com" },
      });
      assert(res.status === 200, `Expected 200, got ${res.status}`);
      const data = await res.json();
      assert(data.success === true, "Response must be successful");
      assert(data.profile.fullName === "Yogesh Danu", "Must match Google name");
      assert(data.profile.email === "yogesh.danu@acme-corp.com", "Must match Google email");
      assert(data.profile.profileCompleted === false, "Profile must be incomplete for new user");
    });

    // Test 2: Complete Profile Setup (First-Time Onboarding)
    await runTest("Onboarding Completion: PUT /api/auth/profile persists custom details and marks profileCompleted = true", async () => {
      const res = await fetch(`${baseUrl}/profile`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": userA_Id,
          "x-user-email": "yogesh.danu@acme-corp.com",
        },
        body: JSON.stringify({
          fullName: "Yogesh Singh Danu",
          city: "Bengaluru",
          country: "India",
        }),
      });

      assert(res.status === 200, `Expected 200, got ${res.status}`);
      const data = await res.json();
      assert(data.profile.fullName === "Yogesh Singh Danu", "Name must be updated");
      assert(data.profile.city === "Bengaluru", "City must be set");
      assert(data.profile.country === "India", "Country must be set");
      assert(data.profile.profileCompleted === true, "profileCompleted must be true");
    });

    // Test 3: Returning User Flow (Re-login preserves completed profile)
    await runTest("Returning User: Second Google login preserves custom profile & does not reset to incomplete", async () => {
      // Simulate subsequent Google login for User A
      tokenVault.saveTokens({
        userId: userA_Id,
        googleSubjectId: "google_sub_user_a",
        email: "yogesh.danu@acme-corp.com",
        name: "Yogesh Danu", // Google returns short name
        accessToken: "ya29.test_token_a_refreshed",
        expiresInSeconds: 3600,
        scopes: ["openid", "userinfo.email", "userinfo.profile"],
      });

      const res = await fetch(`${baseUrl}/profile`, {
        headers: { "x-user-id": userA_Id, "x-user-email": "yogesh.danu@acme-corp.com" },
      });
      const data = await res.json();
      assert(data.profile.fullName === "Yogesh Singh Danu", "Custom full name must be preserved");
      assert(data.profile.city === "Bengaluru", "City must be preserved");
      assert(data.profile.profileCompleted === true, "profileCompleted must remain true");
    });

    // Test 4: Profile Validation (Reject empty full name)
    await runTest("Validation: Rejects empty or single-character full name with HTTP 400", async () => {
      const res = await fetch(`${baseUrl}/profile`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": userA_Id,
        },
        body: JSON.stringify({
          fullName: " ",
        }),
      });

      assert(res.status === 400, `Expected 400, got ${res.status}`);
      const data = await res.json();
      assert(data.error === "INVALID_FULL_NAME", "Expected INVALID_FULL_NAME error code");
    });

    // Test 5: Multi-User Profile Isolation
    await runTest("Multi-User Isolation: User B receives distinct, isolated profile", async () => {
      tokenVault.saveTokens({
        userId: userB_Id,
        googleSubjectId: "google_sub_user_b",
        email: "elena.rostova@enterprise.cloud",
        name: "Elena Rostova",
        displayName: "Elena Rostova",
        avatarUrl: "https://lh3.googleusercontent.com/a/user_b_pic",
        accessToken: "ya29.test_token_b",
        expiresInSeconds: 3600,
        scopes: ["openid", "userinfo.email", "userinfo.profile"],
      });

      const resB = await fetch(`${baseUrl}/profile`, {
        headers: { "x-user-id": userB_Id, "x-user-email": "elena.rostova@enterprise.cloud" },
      });
      const dataB = await resB.json();
      assert(dataB.profile.fullName === "Elena Rostova", "User B must have Elena's name");
      assert(dataB.profile.email === "elena.rostova@enterprise.cloud", "User B must have Elena's email");
      assert(dataB.profile.profileCompleted === false, "User B profile must be initially incomplete");

      // Verify User A remained unchanged
      const resA = await fetch(`${baseUrl}/profile`, {
        headers: { "x-user-id": userA_Id },
      });
      const dataA = await resA.json();
      assert(dataA.profile.fullName === "Yogesh Singh Danu", "User A profile must remain intact");
      assert(dataA.profile.city === "Bengaluru", "User A city must remain intact");
    });

    // Test 6: Security: Unauthenticated request rejected
    await runTest("Security: Missing authentication credentials returns HTTP 401", async () => {
      const res = await fetch(`${baseUrl}/profile`);
      assert(res.status === 401, `Expected 401, got ${res.status}`);
    });

    console.log("-------------------------------------------------");
    console.log(`TOTAL: ${total} | PASSED: ${passed} | FAILED: ${total - passed}`);
    console.log(`PASS RATE: ${((passed / total) * 100).toFixed(1)}%`);
    console.log("-------------------------------------------------");

    if (passed !== total) {
      process.exit(1);
    }
  } finally {
    server.close();
  }
}

main().catch((err) => {
  console.error("Test execution fatal error:", err);
  process.exit(1);
});

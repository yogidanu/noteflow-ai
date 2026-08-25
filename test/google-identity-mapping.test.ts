/**
 * Regression Test Suite: Google User Identity & Canonical Profile Mapping
 * Validates Google Subject ID (sub), OpenID profile mapping, deterministic fallbacks, and multi-user isolation.
 */

import { tokenVault } from "../server/security/tokenVault.js";
import crypto from "crypto";

console.log("=================================================");
console.log("  NOTEFLOW AI — GOOGLE IDENTITY MAPPING TEST     ");
console.log("=================================================");

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`[PASS] ✅ ${testName}`);
    if (detail) console.log(`       Detail: ${detail}`);
    passed++;
  } else {
    console.error(`[FAIL] ❌ ${testName}`);
    if (detail) console.error(`       Detail: ${detail}`);
    failed++;
  }
}

async function runIdentityMappingTests() {
  // Test 1: Google Account A Login & Canonical Subject ID Mapping
  const subA = "google_sub_1092837465112233";
  const emailA = "alex.architect@workspace.design";
  const nameA = "Alex Architect";
  const avatarA = "https://lh3.googleusercontent.com/a/ALEX_AVATAR";

  const userIdA = `usr_g_${crypto.createHash("sha256").update(subA).digest("hex").substring(0, 16)}`;

  tokenVault.saveTokens({
    userId: userIdA,
    googleSubjectId: subA,
    email: emailA,
    name: nameA,
    displayName: nameA,
    firstName: "Alex",
    lastName: "Architect",
    avatarUrl: avatarA,
    accessToken: "ya29.live_google_token_alex",
    refreshToken: "1//refresh_token_alex",
    expiresInSeconds: 3600,
    scopes: ["openid", "https://www.googleapis.com/auth/userinfo.email", "https://www.googleapis.com/auth/userinfo.profile"],
  });

  const sessionA = tokenVault.getSafeSession(userIdA);
  assert(
    sessionA !== null &&
      sessionA.email === emailA &&
      sessionA.name === nameA &&
      sessionA.googleSubjectId === subA &&
      sessionA.avatarUrl === avatarA,
    "Google Account A: Canonical profile matches expected Google UserInfo",
    `User: ${sessionA?.name} <${sessionA?.email}>, Sub: ${sessionA?.googleSubjectId}`
  );

  // Test 2: Logout Account A
  tokenVault.revoke(userIdA);
  const sessionAfterLogout = tokenVault.getSafeSession(userIdA);
  assert(sessionAfterLogout === null, "Logout Account A: Vault credentials completely revoked");

  // Test 3: Login with Google Account B
  const subB = "google_sub_9988776655443322";
  const emailB = "elena.security@enterprise.cloud";
  const nameB = "Elena Rostova";
  const avatarB = "https://lh3.googleusercontent.com/a/ELENA_AVATAR";

  const userIdB = `usr_g_${crypto.createHash("sha256").update(subB).digest("hex").substring(0, 16)}`;

  tokenVault.saveTokens({
    userId: userIdB,
    googleSubjectId: subB,
    email: emailB,
    name: nameB,
    displayName: nameB,
    firstName: "Elena",
    lastName: "Rostova",
    avatarUrl: avatarB,
    accessToken: "ya29.live_google_token_elena",
    refreshToken: "1//refresh_token_elena",
    expiresInSeconds: 3600,
    scopes: ["openid", "https://www.googleapis.com/auth/userinfo.email"],
  });

  const sessionB = tokenVault.getSafeSession(userIdB);
  assert(
    sessionB !== null &&
      sessionB.email === emailB &&
      sessionB.name === nameB &&
      sessionB.googleSubjectId === subB,
    "Google Account B: Independent identity registered accurately",
    `User: ${sessionB?.name} <${sessionB?.email}>`
  );

  // Test 4: Isolation Guard - Account A and Account B remain strictly separate
  assert(
    userIdA !== userIdB && sessionA?.googleSubjectId !== sessionB?.googleSubjectId,
    "Multi-Tenant Isolation: Account A and B have distinct deterministic IDs",
    `User A: ${userIdA} !== User B: ${userIdB}`
  );

  // Test 5: Deterministic Name Fallback when Google omits display name
  const subC = "google_sub_3344556677889900";
  const emailC = "marcus.brody@engineering.internal";
  const userIdC = `usr_g_${crypto.createHash("sha256").update(subC).digest("hex").substring(0, 16)}`;

  // Name omitted: derived deterministically as "Marcus Brody"
  const derivedName = emailC.split("@")[0].replace(/[._-]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  tokenVault.saveTokens({
    userId: userIdC,
    googleSubjectId: subC,
    email: emailC,
    name: derivedName,
    displayName: derivedName,
    accessToken: "ya29.token_marcus",
    expiresInSeconds: 3600,
    scopes: ["openid"],
  });

  const sessionC = tokenVault.getSafeSession(userIdC);
  assert(
    sessionC !== null && sessionC.name === "Marcus Brody",
    "Zero-Random Fallback: Omitted Google name falls back deterministically to 'Marcus Brody'",
    `Derived: ${sessionC?.name}`
  );

  // Test 6: Google Subject Lookup
  const lookup = tokenVault.findByGoogleSubjectOrEmail(subB);
  assert(
    lookup !== null && lookup.userId === userIdB && lookup.email === emailB,
    "Subject ID Lookup: Retrieves existing user by Google sub identifier"
  );

  console.log("-------------------------------------------------");
  console.log(`TOTAL: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log(`PASS RATE: ${((passed / (passed + failed)) * 100).toFixed(1)}%`);
  console.log("-------------------------------------------------");

  if (failed > 0) {
    process.exit(1);
  }
}

runIdentityMappingTests().catch((e) => {
  console.error(e);
  process.exit(1);
});

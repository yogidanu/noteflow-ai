import { app } from "../server/index.js";
import { config } from "../server/config.js";
import { oauthStateStore } from "../server/security/stateStore.js";
import crypto from "crypto";
import http from "http";

let server: http.Server;
const PORT = 4077;
const BASE_URL = `http://127.0.0.1:${PORT}`;

async function runRouteTests() {
  console.log("=================================================");
  console.log(" NOTEFLOW AI — GOOGLE OAUTH STATE LIFECYCLE TEST ");
  console.log("=================================================\n");

  server = app.listen(PORT, "127.0.0.1");
  await new Promise((resolve) => setTimeout(resolve, 300));

  let passed = 0;
  let total = 0;

  function assert(name: string, condition: boolean, detail: string) {
    total++;
    if (condition) {
      passed++;
      console.log(`[0${total}] ✅ PASS ${name}`);
      console.log(`     Detail: ${detail}\n`);
    } else {
      console.log(`[0${total}] ❌ FAIL ${name}`);
      console.log(`     Detail: ${detail}\n`);
    }
  }

  try {
    // -------------------------------------------------------------
    // Test 1: Fresh Google Login Initiation (GET /api/auth/google/url)
    // -------------------------------------------------------------
    const urlRes = await fetch(`${BASE_URL}/api/auth/google/url`);
    const urlJson = await urlRes.json();
    const generatedState = urlJson.state;

    assert(
      "Fresh Google Login: /google/url generates signed state and Google authUrl",
      urlRes.status === 200 && urlJson.success && Boolean(generatedState) && Boolean(urlJson.authUrl?.includes(generatedState)),
      `State: ${generatedState}, Redirect URI: ${urlJson.authUrl?.substring(0, 50)}...`
    );

    // -------------------------------------------------------------
    // Test 2: Callback with Matching State (GET /api/auth/google/callback)
    // -------------------------------------------------------------
    const matchingCallbackRes = await fetch(
      `${BASE_URL}/api/auth/google/callback?code=sample_google_auth_code_123&state=${generatedState}`,
      { redirect: "manual" }
    );
    const redirectLocation = matchingCallbackRes.headers.get("location");

    assert(
      "Callback with Matching State: Validates and redirects to frontend with session (HTTP 302)",
      matchingCallbackRes.status === 302 && Boolean(redirectLocation?.includes("userId=")),
      `HTTP Status: ${matchingCallbackRes.status}, Location: ${redirectLocation}`
    );

    // -------------------------------------------------------------
    // Test 3: Callback with Invalid State
    // -------------------------------------------------------------
    const invalidStateRes = await fetch(`${BASE_URL}/api/auth/google/callback?code=code_123&state=tampered_or_fake_state_999`);
    const invalidStateJson = await invalidStateRes.json();

    assert(
      "Callback with Invalid State: Strictly rejected (HTTP 400 INVALID_OR_EXPIRED_STATE)",
      invalidStateRes.status === 400 && invalidStateJson.error === "INVALID_OR_EXPIRED_STATE",
      `HTTP Status: ${invalidStateRes.status}, Error: ${invalidStateJson.error}`
    );

    // -------------------------------------------------------------
    // Test 4: Callback with Expired State
    // -------------------------------------------------------------
    // Inject artificially expired state (>10m ago) directly into store
    const expiredState = oauthStateStore.generateState({
      redirectUri: config.frontendUrl,
      flowType: "web",
    });
    const record = oauthStateStore.getState(expiredState);
    if (record) {
      record.createdAt = Date.now() - 11 * 60 * 1000; // 11 minutes old
    }

    const expiredRes = await fetch(`${BASE_URL}/api/auth/google/callback?code=code_123&state=${expiredState}`);
    const expiredJson = await expiredRes.json();

    assert(
      "Callback with Expired State: Rejects TTL-exceeded nonce (HTTP 400)",
      expiredRes.status === 400 && expiredJson.error === "INVALID_OR_EXPIRED_STATE",
      `HTTP Status: ${expiredRes.status}, Error: ${expiredJson.error}`
    );

    // -------------------------------------------------------------
    // Test 5: Replay of Already-Consumed State
    // -------------------------------------------------------------
    const replayRes = await fetch(
      `${BASE_URL}/api/auth/google/callback?code=replay_code_456&state=${generatedState}`
    );
    const replayJson = await replayRes.json();

    assert(
      "Replay Attack Guard: Replay of already-consumed state fails (HTTP 400)",
      replayRes.status === 400 && replayJson.error === "INVALID_OR_EXPIRED_STATE",
      `HTTP Status: ${replayRes.status}, Error: ${replayJson.error}`
    );

    // -------------------------------------------------------------
    // Test 6: Two Simultaneous Concurrent Login Attempts
    // -------------------------------------------------------------
    const [resUser1, resUser2] = await Promise.all([
      fetch(`${BASE_URL}/api/auth/google/url`).then((r) => r.json()),
      fetch(`${BASE_URL}/api/auth/google/url`).then((r) => r.json()),
    ]);

    const stateUser1 = resUser1.state;
    const stateUser2 = resUser2.state;

    // Both complete callbacks independently
    const [cb1, cb2] = await Promise.all([
      fetch(`${BASE_URL}/api/auth/google/callback?code=code_u1&state=${stateUser1}`, { redirect: "manual" }),
      fetch(`${BASE_URL}/api/auth/google/callback?code=code_u2&state=${stateUser2}`, { redirect: "manual" }),
    ]);

    assert(
      "Concurrent Logins: Two simultaneous sessions validate and redirect independently",
      stateUser1 !== stateUser2 && cb1.status === 302 && cb2.status === 302,
      `User 1 Status: ${cb1.status}, User 2 Status: ${cb2.status}`
    );

    // -------------------------------------------------------------
    // Test 7: Desktop PKCE Login Flow with noteflow:// Deep Link
    // -------------------------------------------------------------
    const codeVerifier = crypto.randomBytes(32).toString("base64url");
    const codeChallenge = crypto.createHash("sha256").update(codeVerifier).digest("base64url");

    const desktopUrlRes = await fetch(
      `${BASE_URL}/api/auth/google/url?redirectUri=noteflow://auth/callback&code_challenge=${codeChallenge}&code_challenge_method=S256`
    );
    const desktopUrlJson = await desktopUrlRes.json();
    const desktopState = desktopUrlJson.state;

    // Google browser callback returns
    const desktopCallbackRes = await fetch(
      `${BASE_URL}/api/auth/google/callback?code=google_auth_desktop_code_789&state=${desktopState}`,
      { redirect: "manual" }
    );
    const desktopRedirectLoc = desktopCallbackRes.headers.get("location") || "";
    const parsedParams = new URL(desktopRedirectLoc).searchParams;
    const oneTimeCode = parsedParams.get("code") || "";

    // Electron desktop companion redeems one-time code via POST /api/auth/token
    const tokenExchangeRes = await fetch(`${BASE_URL}/api/auth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code: oneTimeCode,
        code_verifier: codeVerifier,
        state: desktopState,
      }),
    });
    const tokenExchangeJson = await tokenExchangeRes.json();

    assert(
      "Desktop PKCE Flow: Redirects to noteflow:// protocol and redeems token via PKCE",
      desktopCallbackRes.status === 302 &&
        desktopRedirectLoc.startsWith("noteflow://auth/callback") &&
        tokenExchangeRes.status === 200 &&
        tokenExchangeJson.success &&
        tokenExchangeJson.tokenType === "Bearer",
      `Protocol Redirect: ${desktopRedirectLoc.substring(0, 45)}..., Token: ${tokenExchangeJson.tokenType}`
    );

    // -------------------------------------------------------------
    // Test 8: Backwards Compatibility of POST /api/auth/google/exchange
    // -------------------------------------------------------------
    const exchangeRes = await fetch(`${BASE_URL}/api/auth/google/exchange`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "sarah.chen@acme-corp.com",
        name: "Sarah Chen",
      }),
    });
    const exchangeJson = await exchangeRes.json();

    assert(
      "Backwards Compatibility: POST /api/auth/google/exchange remains functional",
      exchangeRes.status === 200 && exchangeJson.success && exchangeJson.user?.email === "sarah.chen@acme-corp.com",
      `Status: ${exchangeRes.status}, User: ${exchangeJson.user?.name}`
    );

  } catch (err: any) {
    console.error("Test error:", err);
  } finally {
    server.close();
  }

  console.log("-------------------------------------------------");
  console.log(`TOTAL: ${total} | PASSED: ${passed} | FAILED: ${total - passed}`);
  console.log(`PASS RATE: ${((passed / total) * 100).toFixed(1)}%`);
  console.log("-------------------------------------------------\n");

  process.exit(passed === total ? 0 : 1);
}

runRouteTests();

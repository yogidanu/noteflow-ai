import { app } from "../server/index.js";
import { config } from "../server/config.js";
import http from "http";

let server: http.Server;
const PORT = 4077;
const BASE_URL = `http://127.0.0.1:${PORT}`;

async function runRouteTests() {
  console.log("=================================================");
  console.log(" NOTEFLOW AI — GOOGLE OAUTH CALLBACK ROUTE TEST  ");
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
    // 1. Test GET /api/auth/google/url returns valid auth URL & state
    const urlRes = await fetch(`${BASE_URL}/api/auth/google/url`);
    const urlJson = await urlRes.json();
    assert(
      "GET /api/auth/google/url generates state and authUrl",
      urlRes.status === 200 && urlJson.success && Boolean(urlJson.state) && Boolean(urlJson.authUrl),
      `State: ${urlJson.state?.substring(0, 16)}..., AuthUrl: ${urlJson.authUrl?.substring(0, 45)}...`
    );

    const generatedState = urlJson.state;

    // 2. Test GET /api/auth/google/callback with MISSING state -> HTTP 400
    const missingStateRes = await fetch(`${BASE_URL}/api/auth/google/callback?code=test_code`);
    const missingStateJson = await missingStateRes.json();
    assert(
      "GET /api/auth/google/callback rejects missing state (HTTP 400)",
      missingStateRes.status === 400 && missingStateJson.error === "INVALID_OR_EXPIRED_STATE",
      `Status: ${missingStateRes.status}, Error: ${missingStateJson.error}`
    );

    // 3. Test GET /api/auth/google/callback with INVALID state -> HTTP 400
    const invalidStateRes = await fetch(`${BASE_URL}/api/auth/google/callback?code=test_code&state=nonexistent_state_123`);
    const invalidStateJson = await invalidStateRes.json();
    assert(
      "GET /api/auth/google/callback rejects invalid state (HTTP 400)",
      invalidStateRes.status === 400 && invalidStateJson.error === "INVALID_OR_EXPIRED_STATE",
      `Status: ${invalidStateRes.status}, Error: ${invalidStateJson.error}`
    );

    // 4. Test GET /api/auth/google/callback with VALID state -> 302 Redirect
    const validCallbackRes = await fetch(
      `${BASE_URL}/api/auth/google/callback?code=sample_google_auth_code_123&state=${generatedState}`,
      { redirect: "manual" }
    );
    const location = validCallbackRes.headers.get("location");
    assert(
      "GET /api/auth/google/callback successfully handles Google redirect (HTTP 302)",
      validCallbackRes.status === 302 && Boolean(location),
      `Status: ${validCallbackRes.status}, Redirect Location: ${location}`
    );

    // 5. Test POST /api/auth/google/exchange remains functional
    const exchangeRes = await fetch(`${BASE_URL}/api/auth/google/exchange`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "route.verifier@noteflow.ai",
        name: "Route Verifier",
      }),
    });
    const exchangeJson = await exchangeRes.json();
    assert(
      "POST /api/auth/google/exchange remains backwards compatible & functional",
      exchangeRes.status === 200 && exchangeJson.success && exchangeJson.user?.email === "route.verifier@noteflow.ai",
      `Status: ${exchangeRes.status}, User: ${exchangeJson.user?.name} (${exchangeJson.user?.email})`
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

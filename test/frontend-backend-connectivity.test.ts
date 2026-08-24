import app from "../server/index.js";
import { tokenVault } from "../server/security/tokenVault.js";
import http from "http";

interface TestReport {
  name: string;
  endpoint: string;
  status: "PASS" | "FAIL";
  httpStatus: number;
  responsePreview: string;
}

const reports: TestReport[] = [];

async function testApiConnectivity() {
  console.log("=================================================");
  console.log(" NOTEFLOW AI — FRONTEND ⇄ BACKEND API SUITE      ");
  console.log("=================================================\n");

  const port = 4055;
  const server = http.createServer(app);

  await new Promise<void>((resolve) => {
    server.listen(port, "127.0.0.1", () => {
      console.log(`[Testbed] Ingress server active on http://127.0.0.1:${port}\n`);
      resolve();
    });
  });

  const baseUrl = `http://127.0.0.1:${port}`;

  // Seed a valid authenticated test user session in tokenVault
  const testUserId = "usr_integration_test_88";
  tokenVault.saveTokens({
    userId: testUserId,
    email: "sarah.architect@noteflow.ai",
    name: "Sarah Architect",
    accessToken: "mock_test_access_token_123",
    refreshToken: "mock_test_refresh_token_456",
    expiresInSeconds: 3600,
    scopes: [
      "https://www.googleapis.com/auth/calendar.events.readonly",
      "https://www.googleapis.com/auth/userinfo.email",
      "https://www.googleapis.com/auth/userinfo.profile",
    ],
  });

  const authHeaders = {
    "Content-Type": "application/json",
    "x-user-id": testUserId,
    Authorization: "Bearer mock_test_access_token_123",
  };

  try {
    // 1. Health Probe
    {
      const res = await fetch(`${baseUrl}/health`);
      const body = await res.json();
      reports.push({
        name: "Backend Operational Health Check Probe",
        endpoint: "GET /health",
        status: res.status === 200 && body.status === "ok" ? "PASS" : "FAIL",
        httpStatus: res.status,
        responsePreview: JSON.stringify(body),
      });
    }

    // 2. Google OAuth URL Generation
    {
      const res = await fetch(`${baseUrl}/api/auth/google/url?redirectUri=https://app.noteflow.ai/auth/desktop-login`);
      const body = await res.json();
      reports.push({
        name: "Google OAuth 2.0 URL & PKCE Nonce Generation",
        endpoint: "GET /api/auth/google/url",
        status: res.status === 200 && body.authUrl && body.state ? "PASS" : "FAIL",
        httpStatus: res.status,
        responsePreview: `authUrl: ${body.authUrl?.slice(0, 40)}..., state: ${body.state}`,
      });
    }

    // 3. User Session Verification Endpoint
    {
      const res = await fetch(`${baseUrl}/api/auth/session`, { headers: authHeaders });
      const body = await res.json();
      reports.push({
        name: "Authenticated User Session Profile Lookup",
        endpoint: "GET /api/auth/session",
        status: res.status === 200 && body.success && body.session.isConnected ? "PASS" : "FAIL",
        httpStatus: res.status,
        responsePreview: `email: ${body.session?.email}, isConnected: ${body.session?.isConnected}`,
      });
    }

    // 4. Calendar Delta Events Sync
    {
      const res = await fetch(`${baseUrl}/api/calendar/events`, { headers: authHeaders });
      const body = await res.json();
      reports.push({
        name: "Google Calendar Delta Events Sync",
        endpoint: "GET /api/calendar/events",
        status: res.status === 200 && body.success && Array.isArray(body.data) ? "PASS" : "FAIL",
        httpStatus: res.status,
        responsePreview: `eventCount: ${body.data?.length}, accountEmail: ${body.accountEmail}`,
      });
    }

    // 5. Ingress Recording Schedule Session
    {
      const res = await fetch(`${baseUrl}/api/recording/schedule`, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({
          meetingUrl: "https://meet.google.com/qrp-zvmk-sxc",
          title: "Product Strategy & Architecture Review",
        }),
      });
      const body = await res.json();
      reports.push({
        name: "Meeting Ingress Recording Scheduling",
        endpoint: "POST /api/recording/schedule",
        status: res.status === 200 && body.success ? "PASS" : "FAIL",
        httpStatus: res.status,
        responsePreview: `sessionStatus: ${body.session?.status}, dedupHash: ${body.session?.dedupHash}`,
      });
    }

    // 6. Live Recording Start & Stop
    {
      const startRes = await fetch(`${baseUrl}/api/recording/start`, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({
          meetingUrl: "https://meet.google.com/qrp-zvmk-sxc",
        }),
      });
      const startBody = await startRes.json();

      const stopRes = await fetch(`${baseUrl}/api/recording/stop`, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({
          dedupHash: startBody.session?.dedupHash,
        }),
      });
      const stopBody = await stopRes.json();

      reports.push({
        name: "Live Audio Recording Lifecycle (Start/Stop)",
        endpoint: "POST /api/recording/start & stop",
        status: startRes.status === 200 && stopRes.status === 200 && stopBody.success ? "PASS" : "FAIL",
        httpStatus: stopRes.status,
        responsePreview: `started: ${startBody.session?.status}, stopped: ${stopBody.session?.status}, duration: ${stopBody.session?.durationSeconds}s`,
      });
    }

    // 7. AI Meeting Synthesis
    {
      const res = await fetch(`${baseUrl}/api/summary/generate`, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({
          transcript: "Sarah Chen: We approved deploying Render for the backend and Vercel for the frontend. Alex: Perfect, all tests are passing.",
          refinement: "standard",
        }),
      });
      const body = await res.json();
      reports.push({
        name: "AI Grounded Summary & Action Extraction",
        endpoint: "POST /api/summary/generate",
        status: res.status === 200 && body.success && body.data?.executiveSummary ? "PASS" : "FAIL",
        httpStatus: res.status,
        responsePreview: `Executive Summary: ${body.data?.executiveSummary?.slice(0, 50)}...`,
      });
    }
  } finally {
    server.close();
  }

  // Print Results
  console.log("=================================================");
  console.log("         API CONNECTIVITY TEST RESULTS           ");
  console.log("=================================================");
  let passed = 0;
  for (const r of reports) {
    const icon = r.status === "PASS" ? "✅" : "❌";
    console.log(`[${r.status}] ${icon} ${r.name} (${r.endpoint})`);
    console.log(`       Status: HTTP ${r.httpStatus}`);
    console.log(`       Preview: ${r.responsePreview}\n`);
    if (r.status === "PASS") passed++;
  }

  console.log("-------------------------------------------------");
  console.log(`TOTAL: ${reports.length} | PASSED: ${passed} | FAILED: ${reports.length - passed}`);
  console.log(`PASS RATE: ${((passed / reports.length) * 100).toFixed(1)}%`);
  console.log("-------------------------------------------------\n");

  if (passed !== reports.length) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

testApiConnectivity();

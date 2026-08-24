import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import { config } from "./config.js";
import { authRouter } from "./routes/authRoutes.js";
import { calendarRouter } from "./routes/calendarRoutes.js";
import { recordingRouter } from "./routes/recordingRoutes.js";
import { summaryRouter } from "./routes/summaryRoutes.js";

const app = express();

// Trust reverse proxies (AWS ALB, Cloudflare, Traefik) for HTTPS & client IP resolution
app.set("trust proxy", 1);

// Production Structured Request Logging
app.use((req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  res.on("finish", () => {
    const duration = Date.now() - start;
    if (req.path !== "/health" && req.path !== "/api/health") {
      console.log(
        JSON.stringify({
          timestamp: new Date().toISOString(),
          method: req.method,
          path: req.path,
          status: res.statusCode,
          durationMs: duration,
          ip: req.ip,
          userAgent: req.headers["user-agent"] || "unknown",
        })
      );
    }
  });
  next();
});

// Middleware
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow non-browser requests (e.g. Electron backend / mobile / curl / health checks)
      if (!origin) return callback(null, true);
      if (config.corsOrigins.includes(origin) || config.corsOrigins.includes("*")) {
        return callback(null, true);
      }
      return callback(new Error(`[CORS Blocked] Origin ${origin} not permitted.`));
    },
    credentials: true,
  })
);
app.use(express.json({ limit: "10mb" }));

// -------------------------------------------------------------
// Health Check Endpoints (Root & API Namespaces)
// -------------------------------------------------------------
app.get("/health", (_req: Request, res: Response) => {
  res.status(200).json({
    status: "ok",
    service: "noteflow-meet-record-api",
    version: "1.0.0",
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});

app.get("/api/health", (_req: Request, res: Response) => {
  res.status(200).json({
    status: "ok",
    service: "noteflow-meet-record-backend",
    version: "1.0.0",
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});

// Support direct /auth/desktop-login route
app.get("/auth/desktop-login", (req: Request, res: Response) => {
  const codeChallenge = (req.query.code_challenge as string) || "";
  const codeChallengeMethod = (req.query.code_challenge_method as string) || "S256";
  const state = (req.query.state as string) || `state_${Date.now()}`;
  const redirectUri = (req.query.redirect_uri as string) || "noteflow://auth/callback";

  res.redirect(
    `http://localhost:5173/auth/desktop-login?code_challenge=${encodeURIComponent(codeChallenge)}&code_challenge_method=${encodeURIComponent(codeChallengeMethod)}&state=${encodeURIComponent(state)}&redirect_uri=${encodeURIComponent(redirectUri)}`
  );
});

// Route Mounts
app.use("/api/auth", authRouter);
app.use("/api/calendar", calendarRouter);
app.use("/api/recording", recordingRouter);
app.use("/api/summary", summaryRouter);

// Global Error Handler
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error("[ServerError]", {
    timestamp: new Date().toISOString(),
    error: err.message || "INTERNAL_SERVER_ERROR",
    stack: config.nodeEnv === "development" ? err.stack : undefined,
  });

  res.status(500).json({
    success: false,
    error: err.message || "INTERNAL_SERVER_ERROR",
  });
});

// Start Server & Lifecycle Management
let serverInstance: any = null;

if (process.env.NODE_ENV !== "test") {
  serverInstance = app.listen(config.port, () => {
    console.log(`[MeetRecordBackend] Server running at http://localhost:${config.port}`);
    console.log(`[MeetRecordBackend] Health check available at http://localhost:${config.port}/health`);
  });
}

// Graceful Shutdown Handlers (SIGTERM, SIGINT)
const handleGracefulShutdown = (signal: string) => {
  console.log(`[MeetRecordBackend] Received ${signal}. Initiating graceful shutdown...`);
  if (serverInstance) {
    serverInstance.close(() => {
      console.log("[MeetRecordBackend] HTTP server closed cleanly. Exiting process.");
      process.exit(0);
    });

    // Enforce hard exit if lingering connections do not terminate within 10s
    setTimeout(() => {
      console.error("[MeetRecordBackend] Forcefully terminating active connections after 10s timeout.");
      process.exit(1);
    }, 10000).unref();
  } else {
    process.exit(0);
  }
};

process.on("SIGTERM", () => handleGracefulShutdown("SIGTERM"));
process.on("SIGINT", () => handleGracefulShutdown("SIGINT"));

export default app;

import { Router, Request, Response } from "express";
import { calendarService } from "../services/calendarService.js";
import { tokenVault } from "../security/tokenVault.js";
import { requireAuth } from "../middleware/authMiddleware.js";

export const calendarRouter = Router();

const authErrors = [
  "UNAUTHORIZED_NO_VALID_SESSION",
  "CALENDAR_NOT_AUTHORIZED",
  "CALENDAR_PERMISSION_REVOKED",
  "CALENDAR_TOKEN_EXPIRED",
];

/**
 * GET /api/calendar/status
 * Returns authoritative backend calendar connection state for the authenticated user.
 */
calendarRouter.get("/status", requireAuth, (req: Request, res: Response) => {
  const userId = req.user?.userId || "user_default_workspace_id";
  const session = tokenVault.getSafeSession(userId);
  const connected = Boolean(session && session.scopes?.some((s: string) => s.includes("calendar")));

  res.json({
    success: true,
    connected,
    accountEmail: session?.email || null,
    scopes: session?.scopes || [],
  });
});

/**
 * GET /api/calendar/events
 * Returns today's detected calendar meetings with Google Meet URLs for the authenticated user.
 */
calendarRouter.get("/events", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId || "user_default_workspace_id";
    const syncToken = req.query.syncToken as string | undefined;
    const result = await calendarService.fetchUpcomingEvents(userId, syncToken);

    res.json({
      success: true,
      data: result.events,
      syncToken: result.nextSyncToken,
      accountEmail: result.accountEmail,
      lastSyncedAt: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    });
  } catch (error: any) {
    const isAuthError = authErrors.includes(error.message);
    const requiresReconnect = error.message === "CALENDAR_TOKEN_EXPIRED" || error.message === "CALENDAR_PERMISSION_REVOKED";
    res.status(isAuthError ? 401 : 500).json({
      success: false,
      error: error.message || "FAILED_TO_FETCH_CALENDAR_EVENTS",
      requiresReconnect,
    });
  }
});

/**
 * POST /api/calendar/sync
 * Manually forces immediate calendar synchronization for the authenticated user.
 */
calendarRouter.post("/sync", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId || "user_default_workspace_id";
    const result = await calendarService.fetchUpcomingEvents(userId);
    res.json({
      success: true,
      message: "Calendar synchronized successfully",
      data: result.events,
      syncToken: result.nextSyncToken,
      lastSyncedAt: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    });
  } catch (error: any) {
    const isAuthError = authErrors.includes(error.message);
    const requiresReconnect = error.message === "CALENDAR_TOKEN_EXPIRED" || error.message === "CALENDAR_PERMISSION_REVOKED";
    res.status(isAuthError ? 401 : 500).json({
      success: false,
      error: error.message || "SYNC_FAILED",
      requiresReconnect,
    });
  }
});

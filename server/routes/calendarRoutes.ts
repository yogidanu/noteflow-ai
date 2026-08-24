import { Router, Request, Response } from "express";
import { calendarService } from "../services/calendarService.js";
import { requireAuth } from "../middleware/authMiddleware.js";

export const calendarRouter = Router();

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
    res.status(error.message === "UNAUTHORIZED_NO_VALID_SESSION" ? 401 : 500).json({
      success: false,
      error: error.message || "FAILED_TO_FETCH_CALENDAR_EVENTS",
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
    res.status(500).json({
      success: false,
      error: error.message || "SYNC_FAILED",
    });
  }
});

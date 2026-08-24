import { Request, Response, NextFunction } from "express";

interface RateLimitConfig {
  windowMs: number;
  max: number;
  message: string;
}

export function createRateLimiter(options: RateLimitConfig) {
  const hits = new Map<string, { count: number; resetTime: number }>();

  return (req: Request, res: Response, next: NextFunction) => {
    const key = req.user?.userId || req.ip || "global_client";
    const now = Date.now();

    const record = hits.get(key);

    if (!record || now > record.resetTime) {
      hits.set(key, { count: 1, resetTime: now + options.windowMs });
      return next();
    }

    if (record.count >= options.max) {
      return res.status(429).json({
        success: false,
        error: "RATE_LIMIT_EXCEEDED",
        message: options.message,
        retryAfterMs: record.resetTime - now,
      });
    }

    record.count += 1;
    next();
  };
}

// 60 requests per minute for recording operations
export const recordingRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 60,
  message: "Too many recording requests. Please slow down.",
});

// 40 requests per minute for AI summary generation
export const summaryRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 40,
  message: "Too many summary requests. Please slow down.",
});

// 30 requests per minute for authentication endpoints
export const authRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 30,
  message: "Too many authentication requests. Please try again in a minute.",
});


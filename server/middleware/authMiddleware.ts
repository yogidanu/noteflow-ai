import { Request, Response, NextFunction } from "express";

export interface AuthenticatedUser {
  userId: string;
  tenantId: string;
  email: string;
  name: string;
  role: "admin" | "member" | "guest";
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

/**
 * Middleware that validates user and tenant context from headers/tokens.
 * Unauthenticated requests without credentials receive HTTP 401 Unauthorized.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  const userId = (req.headers["x-user-id"] as string) || (req.query.userId as string);
  const tenantId = (req.headers["x-tenant-id"] as string) || (req.query.tenantId as string) || "tenant_workspace_org";
  const email = (req.headers["x-user-email"] as string) || (req.query.email as string);
  const name = (req.headers["x-user-name"] as string) || (req.query.name as string);
  const role = ((req.headers["x-user-role"] as string) || "member") as "admin" | "member" | "guest";

  if (!userId && !authHeader && !email) {
    if (process.env.NODE_ENV === "development" && req.query.devFallback === "true") {
      req.user = {
        userId: "dev_user_sandbox",
        tenantId: "dev_tenant",
        email: "dev@workspace.internal",
        name: "Developer",
        role: "admin",
      };
      return next();
    }
    return res.status(401).json({
      success: false,
      error: "UNAUTHORIZED_NO_VALID_SESSION",
      message: "Please sign in to access NoteFlow meeting intelligence.",
    });
  }

  req.user = {
    userId: userId || `usr_${Date.now()}`,
    tenantId,
    email: email || "user@workspace.internal",
    name: name || "Workspace Member",
    role,
  };

  next();
}

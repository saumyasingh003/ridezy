import type { NextFunction, Request, Response } from "express";
import type { Role } from "../models/User.js";
import { AppError } from "../utils/AppError.js";

/**
 * Allows the request through only if the authenticated user has one of the
 * given roles. Must run after `requireAuth`.
 *
 *   router.get("/stats", requireAuth, requireRole("ADMIN"), handler)
 *   router.use(requireAuth, requireRole("DRIVER", "ADMIN"))
 */
export function requireRole(...allowed: [Role, ...Role[]]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new AppError(401, "Authentication required."));
    }
    if (!allowed.includes(req.user.role)) {
      return next(new AppError(403, "You do not have permission to perform this action."));
    }
    next();
  };
}

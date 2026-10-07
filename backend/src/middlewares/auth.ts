import type { NextFunction, Request, Response } from "express";
import { AppError } from "../utils/AppError.js";
import { verifyAccessToken, type AuthTokenPayload } from "../utils/jwt.js";

export type AuthUser = AuthTokenPayload;

// Adds `req.user` to Express' Request type for the whole project.
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

/** A request that has passed `requireAuth`, so `user` is guaranteed to be set. */
export type AuthenticatedRequest = Request & { user: AuthUser };

/**
 * Requires `Authorization: Bearer <token>`. On success sets `req.user`.
 * Stateless: it trusts the signed token and doesn't hit the database.
 */
export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  const [scheme, token] = header?.split(" ") ?? [];

  if (scheme !== "Bearer" || !token) {
    return next(new AppError(401, "Authentication required."));
  }

  try {
    req.user = verifyAccessToken(token);
    next();
  } catch {
    // Same message for expired, tampered or malformed tokens.
    next(new AppError(401, "Invalid or expired token."));
  }
}

/** Narrowing helper for controllers that run after `requireAuth`. */
export function getAuthUser(req: Request): AuthUser {
  if (!req.user) throw new AppError(401, "Authentication required.");
  return req.user;
}

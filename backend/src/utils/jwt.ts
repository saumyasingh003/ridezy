import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { ROLES, type Role } from "../models/User.js";

export interface AuthTokenPayload {
  userId: string;
  role: Role;
}

const ALGORITHM = "HS256";

export function signAccessToken({ userId, role }: AuthTokenPayload): string {
  // `sub` (subject) is the standard JWT claim for "who this token is about".
  return jwt.sign({ role }, env.jwt.secret, {
    algorithm: ALGORITHM,
    subject: userId,
    expiresIn: env.jwt.expiresIn,
  });
}

/**
 * Verifies signature + expiry and returns the payload.
 * Throws (JsonWebTokenError / TokenExpiredError) if the token is not valid.
 */
export function verifyAccessToken(token: string): AuthTokenPayload {
  // Pinning `algorithms` blocks "alg: none" and algorithm-confusion attacks.
  const decoded = jwt.verify(token, env.jwt.secret, { algorithms: [ALGORITHM] });

  if (typeof decoded === "string" || typeof decoded.sub !== "string") {
    throw new jwt.JsonWebTokenError("Malformed token payload");
  }
  const role: unknown = decoded.role;
  if (!ROLES.includes(role as Role)) {
    throw new jwt.JsonWebTokenError("Malformed token payload");
  }

  return { userId: decoded.sub, role: role as Role };
}

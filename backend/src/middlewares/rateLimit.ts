import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import { env } from "../config/env.js";

// Counters live in this process's memory: fine for one server, but each
// instance counts separately once we scale out. That is the point where a
// shared store (e.g. Redis) earns its place.
const common = {
  standardHeaders: "draft-8",
  legacyHeaders: false,
  // Tests fire many requests from one IP; limits are disabled there.
  skip: () => env.isTest,
  message: { success: false, message: "Too many requests. Please try again later." },
} as const;

/** Register / verify-email: slows down bulk sign-ups and OTP guessing per IP. */
export const authLimiter = rateLimit({ ...common, windowMs: 15 * 60 * 1000, limit: 20 });

/** Login: brute-force protection. Successful logins don't count. */
export const loginLimiter = rateLimit({
  ...common,
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true,
});

/** Resend OTP: sends real emails, so it's the strictest (on top of the 60s per-user cooldown). */
export const otpResendLimiter = rateLimit({ ...common, windowMs: 60 * 60 * 1000, limit: 5 });

/**
 * Driver location updates: counted per driver (from the JWT), not per IP,
 * since many drivers can share a mobile carrier's IP. 120/min allows an
 * update every 0.5s, far above normal use, while capping database writes.
 * Must run after requireAuth.
 */
export const locationLimiter = rateLimit({
  ...common,
  windowMs: 60 * 1000,
  limit: 120,
  keyGenerator: (req) => req.user?.userId ?? ipKeyGenerator(req.ip ?? ""),
});

/** Fare estimates call the routing provider (public OSRM allows ~1 req/s). Per user. */
export const estimateLimiter = rateLimit({
  ...common,
  windowMs: 60 * 1000,
  limit: 30,
  keyGenerator: (req) => req.user?.userId ?? ipKeyGenerator(req.ip ?? ""),
});

/** Booking also routes and runs a geo search. Per user. */
export const bookingLimiter = rateLimit({
  ...common,
  windowMs: 60 * 1000,
  limit: 10,
  keyGenerator: (req) => req.user?.userId ?? ipKeyGenerator(req.ip ?? ""),
});

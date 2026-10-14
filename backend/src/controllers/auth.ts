import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import type { Request, Response } from "express";
import bcrypt from "bcryptjs";
import { mongo } from "mongoose";
import { z } from "zod";
import { env } from "../config/env.js";
import { User, PUBLIC_ROLES, type UserDocument } from "../models/User.js";
import { EmailVerificationOTP } from "../models/EmailVerificationOTP.js";
import { getAuthUser } from "../middlewares/auth.js";
import { emailService } from "../utils/email.js";
import { logger } from "../utils/logger.js";
import { AppError } from "../utils/AppError.js";
import { signAccessToken } from "../utils/jwt.js";
import { phoneSchema } from "../utils/validation.js";

const BCRYPT_ROUNDS = 12; // ~250ms per hash: slow on purpose
const OTP_TTL_MINUTES = 10;
const OTP_MAX_ATTEMPTS = 5;
const OTP_RESEND_COOLDOWN_MS = 60 * 1000;

const MSG = {
  emailTaken: "An account with this email already exists.",
  phoneTaken: "An account with this phone number already exists.",
  invalidOtp: "Invalid or expired OTP.",
  invalidCredentials: "Invalid email or password.",
  resendGeneric: "If an unverified account exists for this email, a new verification code has been sent.",
} as const;

// Used when the email doesn't exist, so login takes the same time either way.
const DUMMY_PASSWORD_HASH = bcrypt.hashSync("ridezy-timing-equaliser", BCRYPT_ROUNDS);

// Note: Express 5 sends thrown errors to the error middleware,
// and a failed `schema.parse()` becomes a 400 "Validation failed." there.

/* ========================================================================== */
/*  Controllers                                                               */
/* ========================================================================== */

/** POST /api/auth/register: create a PASSENGER/DRIVER account and email an OTP. */
export async function register(req: Request, res: Response): Promise<void> {
  const { name, email, phone, password, role } = registerSchema.parse(req.body);

  const existing = await User.findOne({ $or: [{ email }, { phone }] }, { email: 1 });
  if (existing) throw new AppError(409, existing.email === email ? MSG.emailTaken : MSG.phoneTaken);

  const user = await User.create({
    name,
    email,
    phone,
    password: await hashPassword(password),
    role, // only PASSENGER or DRIVER can get past the schema
    isEmailVerified: false,
  }).catch((err: unknown) => {
    // Lost a race with a parallel sign-up using the same email or phone.
    if (!isDuplicateKeyError(err)) throw err;
    const field = Object.keys((err as mongo.MongoServerError).keyPattern ?? {})[0];
    throw new AppError(409, field === "phone" ? MSG.phoneTaken : MSG.emailTaken);
  });

  const generatedOtp = await sendNewOtp(user).catch((err: unknown) => {
    throw new AppError(503, "Account created, but we couldn't send the verification email. Please request a new code.", {
      cause: err,
    });
  });

  res.status(201).json({
    success: true,
    message: "Registration successful. Verification email sent successfully.",
    otp: generatedOtp,
  });
}

/** POST /api/auth/verify-email: check the 6-digit OTP and mark the email verified. */
export async function verifyEmail(req: Request, res: Response): Promise<void> {
  const { email, otp } = verifyEmailSchema.parse(req.body);

  const user = await User.findOne({ email });
  if (!user) throw new AppError(400, MSG.invalidOtp);
  if (user.isEmailVerified) throw new AppError(400, "Email is already verified.");

  const record = await EmailVerificationOTP.findOne({ userId: user._id });
  if (!record || record.used || record.expiresAt <= new Date()) {
    throw new AppError(400, MSG.invalidOtp);
  }

  // Count this attempt atomically BEFORE comparing, so parallel guesses
  // can't slip past the limit.
  const counted = await EmailVerificationOTP.findOneAndUpdate(
    { _id: record._id, used: false, attempts: { $lt: OTP_MAX_ATTEMPTS } },
    { $inc: { attempts: 1 } },
    { returnDocument: "after" },
  );
  if (!counted) throw new AppError(429, "Too many incorrect attempts. Please request a new code.");

  if (!otpMatches(otp, user.id as string, counted.otpHash)) throw new AppError(400, MSG.invalidOtp);

  // `used: false` in the filter makes the OTP single-use even under races.
  const consumed = await EmailVerificationOTP.updateOne({ _id: counted._id, used: false }, { used: true });
  if (consumed.modifiedCount !== 1) throw new AppError(400, MSG.invalidOtp);

  await User.updateOne({ _id: user._id }, { isEmailVerified: true });

  res.json({ success: true, message: "Email verified successfully. You can now log in." });
}

/** POST /api/auth/resend-otp: replace the OTP (60s cooldown) and email it again. */
export async function resendOTP(req: Request, res: Response): Promise<void> {
  const { email } = resendOtpSchema.parse(req.body);

  const user = await User.findOne({ email });

  let otp: string | undefined;
  if (user && !user.isEmailVerified) {
    otp = await sendNewOtp(user);
  }

  res.json({ success: true, message: MSG.resendGeneric, ...(otp ? { otp } : {}) });
}

/** POST /api/auth/login: verify credentials and issue a JWT. */
export async function login(req: Request, res: Response): Promise<void> {
  const { email, password } = loginSchema.parse(req.body);

  const user = await User.findOne({ email }).select("+password");
  const passwordOk = await bcrypt.compare(password, user?.password ?? DUMMY_PASSWORD_HASH);

  // Same message for "no such user" and "wrong password".
  if (!user || !passwordOk) throw new AppError(401, MSG.invalidCredentials);

  // Only revealed to someone who already knows the password.
  if (!user.isEmailVerified) throw new AppError(403, "Please verify your email before logging in.");

  const token = signAccessToken({ userId: user.id as string, role: user.role });

  res.json({
    success: true,
    message: "Logged in successfully.",
    data: { token, user: toPublicUser(user) },
  });
}

/** GET /api/auth/me: the logged-in user (route is behind requireAuth). */
export async function getMe(req: Request, res: Response): Promise<void> {
  const { userId } = getAuthUser(req);

  const user = await User.findById(userId);
  if (!user) throw new AppError(401, "Authentication required."); // account deleted

  res.json({ success: true, data: toPublicUser(user) });
}

/* ========================================================================== */
/*  Validation                                                                */
/* ========================================================================== */

const emailSchema = z
  .string({ error: "Email is required" })
  .trim()
  .toLowerCase()
  .max(254, "Email is too long")
  .pipe(z.email("Enter a valid email address"));

export const nameSchema = z
  .string({ error: "Name is required" })
  .trim()
  .min(2, "Name must be at least 2 characters")
  .max(50, "Name must be at most 50 characters");

export const passwordSchema = z
  .string({ error: "Password is required" })
  .min(8, "Password must be at least 8 characters")
  // bcrypt ignores everything after 72 bytes
  .refine((value) => Buffer.byteLength(value, "utf8") <= 72, "Password must be at most 72 bytes")
  .regex(/[a-z]/, "Password must contain a lowercase letter")
  .regex(/[A-Z]/, "Password must contain an uppercase letter")
  .regex(/\d/, "Password must contain a number");

const registerSchema = z.object({
  name: nameSchema,
  email: emailSchema,
  phone: phoneSchema,
  password: passwordSchema,
  role: z.enum(PUBLIC_ROLES, { error: "Role must be PASSENGER or DRIVER" }), // never ADMIN
});

const verifyEmailSchema = z.object({
  email: emailSchema,
  otp: z
    .string({ error: "OTP is required" })
    .trim()
    .regex(/^\d{6}$/, "OTP must be exactly 6 digits"),
});

const resendOtpSchema = z.object({ email: emailSchema });

const loginSchema = z.object({
  email: emailSchema,
  password: z.string({ error: "Password is required" }).min(1, "Password is required").max(128),
});

/* ========================================================================== */
/*  Helpers                                                                   */
/* ========================================================================== */

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

/** Only these fields ever leave the server. */
function toPublicUser(user: UserDocument) {
  return {
    id: user.id as string,
    name: user.name,
    email: user.email,
    phone: user.phone ?? null,
    role: user.role,
    isEmailVerified: user.isEmailVerified,
  };
}

function isDuplicateKeyError(err: unknown): boolean {
  return err instanceof mongo.MongoServerError && err.code === 11000;
}

/** Secure random 6-digit code, e.g. "048213". */
function generateOtp(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}

/** HMAC-SHA256 with OTP_SECRET, so a leaked hash can't be brute-forced. */
function hashOtp(otp: string, userId: string): string {
  return createHmac("sha256", env.otpSecret).update(`${userId}:${otp}`).digest("hex");
}

/** Constant-time compare, so timing doesn't leak partial matches. */
function otpMatches(otp: string, userId: string, storedHash: string): boolean {
  const candidate = Buffer.from(hashOtp(otp, userId), "hex");
  const stored = Buffer.from(storedHash, "hex");
  return candidate.length === stored.length && timingSafeEqual(candidate, stored);
}

/**
 * Stores a fresh OTP (replacing the old one) and emails it.
 *
 * Cooldown, enforced atomically: the filter only matches an OTP older than
 * 60s. If a newer one exists, the upsert tries to insert a second document
 * for this user, the unique index on userId rejects it, and we answer 429.
 */
async function sendNewOtp(user: UserDocument): Promise<string> {
  const otp = generateOtp();
  const now = Date.now();

  try {
    await EmailVerificationOTP.findOneAndUpdate(
      { userId: user._id, createdAt: { $lte: new Date(now - OTP_RESEND_COOLDOWN_MS) } },
      {
        otpHash: hashOtp(otp, user.id as string),
        expiresAt: new Date(now + OTP_TTL_MINUTES * 60 * 1000),
        attempts: 0,
        used: false,
        createdAt: new Date(now),
      },
      { upsert: true },
    );
  } catch (err) {
    if (isDuplicateKeyError(err)) throw new AppError(429, "Please wait before requesting another code.");
    throw err;
  }

  try {
    await emailService.sendVerificationEmail(user.email, user.name, otp, OTP_TTL_MINUTES);
  } catch (err) {
    // The client only gets a generic message; the log needs the real reason
    // (e.g. an SMTP timeout on a host that blocks mail ports).
    logger.error(`Verification email to ${user.email} failed`, err);
    throw err;
  }
  return otp;
}

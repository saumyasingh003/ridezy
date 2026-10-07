import { Schema, Types, model, type InferSchemaType } from "mongoose";

const emailVerificationOtpSchema = new Schema({
  userId: {
    type: Types.ObjectId,
    ref: "User",
    required: true,
    // Unique index: fast lookup by user AND at most one active OTP per user.
    // Resending replaces this single document instead of adding another one.
    unique: true,
  },
  // HMAC-SHA256 of the code. The plain 6-digit code is never stored.
  otpHash: { type: String, required: true },
  expiresAt: { type: Date, required: true },
  attempts: { type: Number, required: true, default: 0 },
  used: { type: Boolean, required: true, default: false },
  // Set explicitly (not via `timestamps`) because a resend overwrites it,
  // and the resend cooldown is measured from it.
  createdAt: { type: Date, required: true, default: Date.now },
});

// TTL index: MongoDB's background monitor (runs about every 60s) deletes a
// document once `expiresAt` is in the past. Expiry is still checked in code,
// because a document can outlive its expiresAt by up to a minute.
emailVerificationOtpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export type EmailVerificationOtpFields = InferSchemaType<typeof emailVerificationOtpSchema>;

export const EmailVerificationOTP = model("EmailVerificationOTP", emailVerificationOtpSchema);

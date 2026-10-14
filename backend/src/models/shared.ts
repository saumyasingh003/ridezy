// Enums and schema options shared by more than one model.

export const GENDERS = ["MALE", "FEMALE", "OTHER", "PREFER_NOT_TO_SAY"] as const;
export type Gender = (typeof GENDERS)[number];

export const VERIFICATION_STATUSES = ["PENDING", "VERIFIED", "REJECTED", "SUSPENDED"] as const;
export type VerificationStatus = (typeof VERIFICATION_STATUSES)[number];

/**
 * Applied to every schema: `_id` → `id` and drop `__v`, so API responses
 * never leak Mongo internals.
 */
export const cleanJSON = {
  virtuals: false,
  versionKey: false,
  transform: (_doc: unknown, ret: Record<string, unknown>) => {
    if (ret._id !== undefined) {
      ret.id = String(ret._id);
      delete ret._id;
    }
    return ret;
  },
};

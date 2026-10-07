import { Schema, model, type HydratedDocument, type InferSchemaType } from "mongoose";

export const ROLES = ["PASSENGER", "DRIVER", "ADMIN"] as const;
export type Role = (typeof ROLES)[number];

// Roles anyone can pick on the public sign-up form. ADMIN is deliberately absent.
export const PUBLIC_ROLES = ["PASSENGER", "DRIVER"] as const satisfies readonly Role[];

const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 50 },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      // Unique index: guarantees one account per email even when two sign-ups race.
      unique: true,
    },
    // E.164 format, e.g. "+919876543210". Required at registration (see the
    // controller) but optional here, so the admin and older accounts stay valid.
    // `sparse`: the unique index skips documents without a phone number.
    phone: { type: String, trim: true, unique: true, sparse: true },
    // bcrypt hash, never the raw password. `select: false` keeps it out of every
    // query result unless a query explicitly asks for it with .select("+password").
    password: { type: String, required: true, select: false },
    role: { type: String, enum: ROLES, required: true, default: "PASSENGER" },
    isEmailVerified: { type: Boolean, required: true, default: false },
  },
  {
    timestamps: true,
    toJSON: {
      // Second line of defence: even if a password hash was selected, it never
      // makes it into a JSON response.
      transform: (_doc, ret: Record<string, unknown>) => {
        ret.id = String(ret._id);
        delete ret._id;
        delete ret.__v;
        delete ret.password;
        return ret;
      },
    },
  },
);

export type UserFields = InferSchemaType<typeof userSchema>;
export type UserDocument = HydratedDocument<UserFields>;

export const User = model("User", userSchema);

import { Schema, Types, model, type HydratedDocument, type InferSchemaType } from "mongoose";
import { VERIFICATION_STATUSES, cleanJSON } from "./shared.js";

// The documents a driver must submit. Admin verification requires all of them,
// so adding or removing a type here changes that rule too.
export const DOCUMENT_TYPES = ["AADHAAR", "DRIVING_LICENSE"] as const;
export type DocumentType = (typeof DOCUMENT_TYPES)[number];

/** Format of each document's number, checked after normalising (spaces/dashes removed, upper-cased). */
export const DOCUMENT_NUMBER_RULES: Record<DocumentType, { pattern: RegExp; message: string }> = {
  // 12 digits; UIDAI never issues numbers starting with 0 or 1.
  AADHAAR: { pattern: /^[2-9]\d{11}$/, message: "Aadhaar number must be 12 digits and can't start with 0 or 1" },
  // Indian DL numbers vary by state and era (typically 15-16 characters), so stay permissive.
  DRIVING_LICENSE: {
    pattern: /^[A-Z0-9]{8,20}$/,
    message: "Driving licence number must be 8-20 letters and digits",
  },
};

export function documentNumberError(type: DocumentType, documentNumber: string): string | null {
  const rule = DOCUMENT_NUMBER_RULES[type];
  return rule.pattern.test(documentNumber) ? null : rule.message;
}

const driverDocumentSchema = new Schema(
  {
    driverId: { type: Types.ObjectId, ref: "DriverProfile", required: true },
    documentType: { type: String, enum: DOCUMENT_TYPES, required: true },
    documentNumber: { type: String, required: true },
    // Where the file lives (cloud storage later). The file itself never goes in MongoDB.
    documentUrl: { type: String, required: true },

    // ---- Admin-controlled ----
    verificationStatus: { type: String, enum: VERIFICATION_STATUSES, required: true, default: "PENDING" },
    rejectionReason: { type: String },
    verifiedAt: { type: Date },
  },
  { timestamps: true, toJSON: cleanJSON },
);

// One document of each type per driver. Also serves "all documents of a driver"
// queries, because a compound index can be used for its leading field alone.
driverDocumentSchema.index({ driverId: 1, documentType: 1 }, { unique: true });

export type DriverDocumentDocument = HydratedDocument<InferSchemaType<typeof driverDocumentSchema>>;

export const DriverDocument = model("DriverDocument", driverDocumentSchema);

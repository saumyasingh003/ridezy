import { Schema, Types, model, type HydratedDocument, type InferSchemaType } from "mongoose";
import { cleanJSON } from "./shared.js";

const auditLogSchema = new Schema(
  {
    adminId: { type: Types.ObjectId, ref: "User", required: true },
    action: { type: String, required: true },
    targetType: { type: String, required: true },
    targetId: { type: String, required: true },
    details: { type: Schema.Types.Mixed },
  },
  { timestamps: true, toJSON: cleanJSON },
);

auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ adminId: 1, createdAt: -1 });

export type AuditLogDocument = HydratedDocument<InferSchemaType<typeof auditLogSchema>>;

export const AuditLog = model("AuditLog", auditLogSchema);

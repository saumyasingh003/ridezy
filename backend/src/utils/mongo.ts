import mongoose from "mongoose";

/**
 * For a unique-index violation (E11000), returns the field that clashed,
 * e.g. "registrationNumber"; otherwise undefined.
 */
export function duplicateKeyField(err: unknown): string | undefined {
  if (!(err instanceof mongoose.mongo.MongoServerError) || err.code !== 11000) return undefined;
  return Object.keys((err.keyPattern as Record<string, unknown> | undefined) ?? {}).at(-1) ?? "unknown";
}

/**
 * Turns a validated PATCH body into a MongoDB update:
 *   value     → $set
 *   null      → $unset (clear an optional field)
 *   undefined → untouched (field not sent)
 */
export function toMongoUpdate(fields: Record<string, unknown>, prefix = "") {
  const $set: Record<string, unknown> = {};
  const $unset: Record<string, ""> = {};

  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined) continue;
    if (value === null) $unset[prefix + key] = "";
    else $set[prefix + key] = value;
  }

  return {
    ...(Object.keys($set).length ? { $set } : {}),
    ...(Object.keys($unset).length ? { $unset } : {}),
  };
}

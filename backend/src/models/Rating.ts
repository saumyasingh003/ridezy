import { Schema, Types, model, type HydratedDocument, type InferSchemaType } from "mongoose";
import { cleanJSON } from "./shared.js";

/**
 * Who gave the rating. Only PASSENGER ratings are created now (riders rate
 * drivers); DRIVER stays valid so older records still load.
 */
export const RATER_ROLES = ["PASSENGER", "DRIVER"] as const;
export type RaterRole = (typeof RATER_ROLES)[number];

export const MIN_SCORE = 1;
export const MAX_SCORE = 5;
export const MAX_COMMENT_LENGTH = 500;

const ratingSchema = new Schema(
  {
    rideId: { type: Types.ObjectId, ref: "Ride", required: true },
    fromRole: { type: String, enum: RATER_ROLES, required: true },
    fromUserId: { type: Types.ObjectId, ref: "User", required: true },
    // The person being rated (User id, for both roles), so averages are one indexed query.
    toUserId: { type: Types.ObjectId, ref: "User", required: true },
    score: { type: Number, required: true, min: MIN_SCORE, max: MAX_SCORE },
    comment: { type: String, trim: true, maxlength: MAX_COMMENT_LENGTH },
  },
  { timestamps: true, toJSON: cleanJSON },
);

/*
 * One rating per participant per ride, enforced by MongoDB: a second rating
 * (or two submitted at once) fails with a duplicate-key error.
 */
ratingSchema.index({ rideId: 1, fromRole: 1 }, { unique: true, name: "one_rating_per_side_per_ride" });
// "Ratings received by this person", for averages and review lists.
ratingSchema.index({ toUserId: 1, createdAt: -1 });

export type RatingDocument = HydratedDocument<InferSchemaType<typeof ratingSchema>>;

export const Rating = model("Rating", ratingSchema);

"use client";

import { useState } from "react";
import { AlertCircle, Loader2, Star } from "lucide-react";
import { api, type RatingView } from "@/lib/rideApi";

const LABELS = ["", "Terrible", "Bad", "Okay", "Good", "Excellent"];
const MAX_COMMENT = 500;

/** Read-only stars, e.g. ★★★★☆ */
export function Stars({ score, size = 14 }: { score: number; size?: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${score} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          size={size}
          className={i <= Math.round(score) ? "fill-amber-400 text-amber-400" : "fill-stone-200 text-stone-200"}
        />
      ))}
    </span>
  );
}

/**
 * Rate a completed ride (POST /api/rides/:rideId/rating): 1-5 stars and an
 * optional comment. The backend decides whose side the caller is on.
 */
export default function RateRide({
  rideId,
  subject,
  onRated,
  compact = false,
}: {
  rideId: string;
  /** Who is being rated, e.g. "Bikki (your driver)". */
  subject: string;
  onRated: (rating: RatingView) => void;
  /** Tighter layout for lists. */
  compact?: boolean;
}) {
  const [score, setScore] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const shown = hover || score;

  const submit = async () => {
    if (!score) return;
    setSaving(true);
    setError("");
    const { ok, message, data } = await api<RatingView>(`/rides/${rideId}/rating`, {
      method: "POST",
      body: JSON.stringify({ score, ...(comment.trim() ? { comment: comment.trim() } : {}) }),
    });
    setSaving(false);
    if (ok && data) onRated(data);
    else setError(message);
  };

  return (
    <div className={`w-full text-left ${compact ? "" : "rounded-md border border-[#E8E8E8] bg-white p-5"}`}>
      {!compact && <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#8A8A8A]">Rate your trip</p>}
      <p className={`text-sm font-bold text-[#111111] ${compact ? "" : "mt-1"}`}>How was {subject}?</p>

      {/* Star picker */}
      <div className="mt-3 flex items-center gap-3">
        <div className="flex items-center gap-1" role="radiogroup" aria-label="Rating" onMouseLeave={() => setHover(0)}>
          {[1, 2, 3, 4, 5].map((i) => (
            <button
              key={i}
              type="button"
              role="radio"
              aria-checked={score === i}
              aria-label={`${i} star${i > 1 ? "s" : ""}`}
              onClick={() => setScore(i)}
              onMouseEnter={() => setHover(i)}
              className="rounded p-0.5 transition-transform duration-150 hover:scale-110 active:scale-95"
            >
              <Star
                size={compact ? 22 : 28}
                className={`transition-colors ${
                  i <= shown ? "fill-amber-400 text-amber-400" : "fill-transparent text-stone-300"
                }`}
              />
            </button>
          ))}
        </div>
        <span className="text-xs font-semibold text-[#7A7A7A]">{LABELS[shown]}</span>
      </div>

      {score > 0 && (
        <>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value.slice(0, MAX_COMMENT))}
            rows={compact ? 2 : 3}
            placeholder="Add a comment (optional)"
            className="mt-3 w-full resize-none rounded-md border border-transparent bg-[#F4F4F4] px-3.5 py-2.5 text-sm text-[#111111] placeholder:text-[#A3A3A3] outline-none focus:border-[#111111] focus:bg-white"
          />
          <p className="mt-1 text-right text-[10px] text-[#A3A3A3]">
            {comment.length}/{MAX_COMMENT}
          </p>
        </>
      )}

      {error && (
        <p role="alert" className="mt-2 flex items-start gap-1.5 text-xs font-medium text-[#B3261E]">
          <AlertCircle size={14} className="mt-px shrink-0" />
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={submit}
        disabled={!score || saving}
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-md bg-[#111111] py-3 text-sm font-semibold text-white transition-colors hover:bg-black disabled:cursor-not-allowed disabled:opacity-40"
      >
        {saving && <Loader2 size={15} className="animate-spin" />}
        {score ? `Submit ${score}-star rating` : "Tap a star to rate"}
      </button>
    </div>
  );
}

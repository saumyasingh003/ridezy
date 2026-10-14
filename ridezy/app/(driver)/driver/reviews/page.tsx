"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import { AlertCircle, Loader2, MessageSquare, Star, ThumbsUp } from "lucide-react";
import { Stars } from "@/components/ratings/RateRide";
import { api, type ReceivedRatings } from "@/lib/rideApi";

// Everything here comes from GET /api/ratings/me (ratings passengers gave this driver).
const PAGE_SIZE = 10;

const AVATAR_COLORS = ["bg-emerald-600", "bg-blue-600", "bg-purple-600", "bg-amber-600", "bg-rose-600", "bg-stone-700"];

function avatarColor(name: string) {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

function formatDate(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const date = d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  if (d.toDateString() === today.toDateString()) return `Today • ${date}`;
  if (d.toDateString() === yesterday.toDateString()) return `Yesterday • ${date}`;
  return date;
}

type Filter = "ALL" | "5_STAR";

export default function DriverReviewsPage() {
  const [filter, setFilter] = useState<Filter>("ALL");
  const [list, setList] = useState<{ filter: Filter; data: ReceivedRatings } | null>(null);
  const [overall, setOverall] = useState<ReceivedRatings["summary"] | null>(null);
  const [error, setError] = useState("");
  const [loadingMore, setLoadingMore] = useState(false);

  const pathFor = (f: Filter, page: number) =>
    `/ratings/me?page=${page}&limit=${PAGE_SIZE}${f === "5_STAR" ? "&score=5" : ""}`;

  useEffect(() => {
    let cancelled = false;
    api<ReceivedRatings>(pathFor(filter, 1)).then(({ ok, data, message }) => {
      if (cancelled) return;
      if (ok && data) {
        setList({ filter, data });
        setOverall(data.summary); // summary always covers all ratings
        setError("");
      } else {
        setError(message);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [filter]);

  const loadMore = async () => {
    if (!list) return;
    setLoadingMore(true);
    const { ok, data, message } = await api<ReceivedRatings>(pathFor(filter, list.data.pagination.page + 1));
    setLoadingMore(false);
    if (ok && data) setList({ filter, data: { ...data, reviews: [...list.data.reviews, ...data.reviews] } });
    else setError(message);
  };

  const loading = list?.filter !== filter;
  const reviews = list && !loading ? list.data.reviews : [];
  const hasMore = !loading && list ? list.data.pagination.page < list.data.pagination.pages : false;

  const count = overall?.count ?? 0;
  const breakdown = overall?.breakdown ?? { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0 };
  const positive = count ? Math.round(((breakdown["4"] + breakdown["5"]) / count) * 100) : 0;
  const latestComment = list?.data.reviews.find((r) => r.comment);
  const withComments = reviews.filter((r) => r.comment).length;

  return (
    <div className="min-h-screen bg-[#FBFBFA] pb-24 text-black">
      <div className="w-full px-4 sm:px-6 lg:px-8 pt-3 sm:pt-4 space-y-6">

        {/* 1. TOP HERO BANNER */}
        <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl bg-white border border-[#EDEDE8] shadow-xs h-[170px] sm:h-[190px] lg:h-[205px] flex items-center w-full shrink-0">
          <div className="absolute inset-0 w-full h-full pointer-events-none select-none">
            <Image
              src="/smiling-driver-banner.webp"
              alt="Ratings and reviews banner"
              fill
              priority
              sizes="100vw"
              className="object-cover"
              style={{ objectPosition: "center 15%" }}
            />
          </div>

          <div className="relative z-10 w-full px-6 sm:px-8 lg:px-12 flex flex-col justify-center">
            <div className="max-w-2xl">
              <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#555550]">
                Quality &amp; Feedback &bull; Ridezy Partner
              </span>
              <h1 className="font-caslon text-2xl sm:text-3xl lg:text-4xl font-bold text-[#111111] tracking-tight leading-tight mt-1">
                Ratings &amp; Reviews
              </h1>
              <p className="text-xs sm:text-sm text-zinc-700 mt-1 sm:mt-1.5 font-medium leading-relaxed">
                What passengers said after their trips with you.
              </p>
            </div>
          </div>
        </div>

        {/* 2. OVERALL RATING & INSIGHTS */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          {/* Overall rating */}
          <div className="lg:col-span-5 rounded-2xl sm:rounded-3xl border border-[#EDEDE8] bg-white p-6 sm:p-8 shadow-xs space-y-6">
            <div className="flex items-center justify-between pb-3 border-b border-[#F0EFEA]">
              <h3 className="font-caslon text-xl font-bold text-[#111111]">Overall Rating</h3>
              <span className="text-[11px] font-semibold text-stone-500">
                {count} {count === 1 ? "rating" : "ratings"}
              </span>
            </div>

            <div className="flex items-center gap-4">
              <span className="font-caslon text-5xl sm:text-6xl font-bold text-black leading-none">
                {overall?.average != null ? overall.average.toFixed(1) : "—"}
              </span>
              <div>
                <Stars score={overall?.average ?? 0} size={16} />
                <p className="text-xs text-stone-500 mt-1 font-medium">
                  {count ? `${positive}% positive (4–5 stars)` : "No ratings yet"}
                </p>
              </div>
            </div>

            <div className="space-y-2 text-xs">
              {(["5", "4", "3", "2", "1"] as const).map((star) => {
                const pct = count ? Math.round((breakdown[star] / count) * 100) : 0;
                return (
                  <div key={star} className="flex items-center gap-2.5">
                    <div className="w-14 flex items-center gap-1 shrink-0 font-medium text-stone-700">
                      <span>{star}</span>
                      <Star className="w-3 h-3 fill-amber-400 text-amber-400 shrink-0" />
                      <span className="text-[11px] text-stone-400">Star{star !== "1" ? "s" : ""}</span>
                    </div>
                    <div className="flex-1 bg-stone-100 h-2.5 rounded-full overflow-hidden">
                      <div className="bg-amber-400 h-full rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="w-14 text-right font-mono text-stone-500 font-medium text-[11px]">
                      {breakdown[star]} · {pct}%
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Insights */}
          <div className="lg:col-span-7 rounded-2xl sm:rounded-3xl border border-[#EDEDE8] bg-white p-6 sm:p-8 shadow-xs space-y-5">
            <div className="pb-3 border-b border-[#F0EFEA]">
              <h3 className="font-caslon text-xl font-bold text-[#111111]">Rating Insights</h3>
              <p className="text-xs text-stone-500 mt-0.5">Updated after every rating a passenger submits.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              {[
                { icon: ThumbsUp, label: "Positive", value: count ? `${positive}%` : "—" },
                { icon: Star, label: "5-star ratings", value: String(breakdown["5"]) },
                { icon: MessageSquare, label: "With comments (shown)", value: String(withComments) },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.label}
                    className="p-4 rounded-2xl border border-[#EDEDE8] bg-[#FAFAF8] flex flex-col items-center text-center space-y-1"
                  >
                    <Icon className="w-5 h-5 text-stone-500" />
                    <p className="font-caslon text-2xl font-bold text-black">{item.value}</p>
                    <p className="text-[11px] font-semibold text-stone-600">{item.label}</p>
                  </div>
                );
              })}
            </div>

            {latestComment ? (
              <div className="rounded-2xl border border-[#EDEDE8] bg-[#FAFAF8] p-4">
                <p className="text-[10px] font-bold uppercase tracking-wider text-stone-400">Latest comment</p>
                <p className="mt-1.5 text-sm text-stone-800">&ldquo;{latestComment.comment}&rdquo;</p>
                <p className="mt-1 text-[11px] text-stone-500">
                  {latestComment.from.name} &bull; <Stars score={latestComment.score} size={11} />
                </p>
              </div>
            ) : (
              <p className="text-xs text-stone-500">Comments passengers leave will show up here.</p>
            )}
          </div>
        </div>

        {/* 3. REVIEWS LIST */}
        <section className="rounded-2xl sm:rounded-3xl border border-[#EDEDE8] bg-white p-6 sm:p-8 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#F0EFEA]">
            <div>
              <h3 className="font-caslon text-xl font-bold text-[#111111]">Passenger Feedback</h3>
              <p className="text-xs text-stone-500 mt-0.5">Every rating passengers gave you, newest first.</p>
            </div>

            <div className="flex items-center gap-1.5 p-1 rounded-xl bg-neutral-100 border border-neutral-200">
              {(
                [
                  { id: "ALL", label: "All Reviews" },
                  { id: "5_STAR", label: "⭐ 5-Star Only" },
                ] as const
              ).map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setFilter(t.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    filter === t.id ? "bg-white text-black shadow-2xs" : "text-stone-600 hover:text-black"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            {loading && (
              <div className="flex items-center justify-center gap-2 py-10 text-xs text-stone-400">
                <Loader2 className="w-4 h-4 animate-spin" /> Loading reviews…
              </div>
            )}

            {reviews.map((rev) => (
              <div
                key={rev.id}
                className="p-5 rounded-2xl border border-[#EDEDE8] bg-[#FAFAF8] space-y-3 hover:border-[#DCDCD4] transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-10 h-10 rounded-full ${avatarColor(rev.from.name)} text-white flex items-center justify-center font-bold text-sm shadow-2xs`}
                  >
                    {rev.from.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold text-black">{rev.from.name}</p>
                      <Stars score={rev.score} />
                    </div>
                    <p className="text-[11px] text-stone-500 mt-0.5 font-medium truncate">
                      {formatDate(rev.createdAt)}
                      {rev.ride ? ` • ${rev.ride.pickup} → ${rev.ride.destination}` : ""}
                    </p>
                  </div>
                </div>

                {rev.comment ? (
                  <p className="text-xs sm:text-sm text-stone-800 leading-relaxed">&ldquo;{rev.comment}&rdquo;</p>
                ) : (
                  <p className="text-xs text-stone-400 italic">No comment left.</p>
                )}
              </div>
            ))}

            {!loading && reviews.length === 0 && (
              <div className="py-10 text-center text-xs text-stone-400">
                {error ? (
                  <span className="inline-flex items-center gap-1.5 text-rose-700">
                    <AlertCircle className="w-3.5 h-3.5" /> {error}
                  </span>
                ) : filter === "5_STAR" ? (
                  "No 5-star reviews yet."
                ) : (
                  "No reviews yet. Riders can rate you once they have paid for a trip."
                )}
              </div>
            )}
          </div>

          {hasMore && (
            <div className="text-center">
              <button
                type="button"
                onClick={loadMore}
                disabled={loadingMore}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-stone-200 text-xs font-semibold text-black hover:bg-stone-50 transition-colors disabled:opacity-50"
              >
                {loadingMore && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Load more
              </button>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

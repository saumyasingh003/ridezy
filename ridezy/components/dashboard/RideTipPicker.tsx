"use client";

import { useState } from "react";
import { AlertCircle, HandCoins, Loader2 } from "lucide-react";
import { api, TIP_OPTIONS, type RideView, type TipAmount } from "@/lib/rideApi";

/**
 * Offer a driver tip while the ride is active (PATCH /api/rides/:rideId/tip).
 * Drivers see it on the ride offer; it's added once to the final payment and
 * can still be changed on the payment screen.
 */
export default function RideTipPicker({
  ride,
  onChange,
}: {
  ride: RideView;
  onChange: (ride: RideView) => void;
}) {
  const current = (ride.tipAmount ?? 0) as TipAmount;
  const [saving, setSaving] = useState<TipAmount | null>(null);
  const [error, setError] = useState("");

  const choose = async (tip: TipAmount) => {
    if (tip === current || saving !== null) return;
    setSaving(tip);
    setError("");
    const { ok, message, data } = await api<RideView>(`/rides/${ride.id}/tip`, {
      method: "PATCH",
      body: JSON.stringify({ tip }),
    });
    setSaving(null);
    if (ok && data) onChange(data);
    else setError(message);
  };

  return (
    <div className="mt-4 rounded-md border border-[#E8E8E8] bg-[#FAFAF8] p-4">
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[#111111] text-white">
          <HandCoins size={17} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-[#111111]">
            {current > 0 ? `₹${current} tip added for your driver` : "Add a tip to find a driver faster"}
          </p>
          <p className="mt-0.5 text-xs text-[#7A7A7A]">
            Drivers see your tip with the ride request. It&apos;s added to your fare and goes fully to the driver.
          </p>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-5 gap-1.5" role="radiogroup" aria-label="Driver tip">
        {([0, ...TIP_OPTIONS] as TipAmount[]).map((value) => {
          const active = current === value;
          return (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={active}
              disabled={saving !== null}
              onClick={() => void choose(value)}
              className={`flex items-center justify-center gap-1 rounded-md border py-2 text-xs font-bold transition-colors disabled:cursor-wait ${
                active
                  ? "border-[#111111] bg-[#111111] text-white"
                  : "border-[#E8E8E8] bg-white text-[#111111] hover:border-[#111111]"
              }`}
            >
              {saving === value && <Loader2 size={12} className="animate-spin" />}
              {value === 0 ? "No tip" : `₹${value}`}
            </button>
          );
        })}
      </div>

      {error && (
        <p role="alert" className="mt-2 flex items-start gap-1.5 text-xs font-medium text-[#B3261E]">
          <AlertCircle size={14} className="mt-px shrink-0" />
          {error}
        </p>
      )}
    </div>
  );
}

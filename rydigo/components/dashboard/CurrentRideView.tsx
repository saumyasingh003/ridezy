"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Phone,
  MessageSquare,
  Star,
  ShieldCheck,
  Wallet,
  Smartphone,
  CreditCard,
  Banknote,
  Check,
  CheckCircle2,
  ArrowRight,
  Tag,
  X,
  type LucideIcon,
} from "lucide-react";
import { rideOptions } from "./data";
import RideProgress from "./RideProgress";

export interface CurrentRideViewProps {
  pickup: string;
  destination: string;
  rideId: string;
}

const vehicleByRide: Record<string, { model: string; plate: string }> = {
  bike: { model: "Honda Activa · Black", plate: "KA 05 HM 7712" },
  auto: { model: "Bajaj RE Auto · Yellow", plate: "KA 01 AB 3390" },
  standard: { model: "Maruti Swift Dzire · White", plate: "KA 05 MJ 2841" },
  premium: { model: "Toyota Camry · Black", plate: "KA 03 PZ 0099" },
};

const driver = { name: "Ravi Kumar", rating: 4.9, trips: 2140, otp: "4821" };

const currentStep = 2;

interface Method {
  id: string;
  label: string;
  detail: string;
  icon: LucideIcon;
}

const methods: Method[] = [
  { id: "wallet", label: "Ridezy Wallet", detail: "Balance ₹1,240", icon: Wallet },
  { id: "upi", label: "UPI", detail: "rider@okaxis", icon: Smartphone },
  { id: "card", label: "Visa Card", detail: "•••• 4821", icon: CreditCard },
  { id: "cash", label: "Cash", detail: "Pay the driver", icon: Banknote },
];

const PROMOS: Record<string, (fare: number) => number> = {
  WELCOME50: (fare) => Math.min(Math.round(fare * 0.5), 100),
  BIKE20: () => 20,
  AUTO30: (fare) => Math.min(Math.round(fare * 0.3), 40),
  CABWKND: () => 75,
};

const eyebrow = "text-[10px] font-bold uppercase tracking-[0.2em] text-[#8A8A8A]";
const card = "rounded-md border border-[#E8E8E8] bg-white p-5 sm:p-6";

/** Same header style as the dashboard side panels: eyebrow, Caslon title, black bar. */
function CardHeader({ label, title }: { label: string; title: string }) {
  return (
    <div>
      <p className={eyebrow}>{label}</p>
      <h2 className="mt-1.5 font-caslon text-2xl font-bold leading-none tracking-tight text-[#111111]">
        {title}
      </h2>
      <div className="mt-3 h-[3px] w-10 bg-[#111111]" />
    </div>
  );
}

export default function CurrentRideView({ pickup, destination, rideId }: CurrentRideViewProps) {
  const ride = rideOptions.find((r) => r.id === rideId);

  const [method, setMethod] = useState("wallet");
  const [promoInput, setPromoInput] = useState("");
  const [promo, setPromo] = useState<string | null>(null);
  const [promoError, setPromoError] = useState("");
  const [paid, setPaid] = useState(false);
  const [cancelled, setCancelled] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);

  /* ---------- No active ride ---------- */
  if (!ride || !pickup || !destination || cancelled) {
    return (
      <div className="mx-auto flex w-full max-w-md flex-col items-center px-4 py-20 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-md bg-[#F4F4F4] text-[#111111]">
          {cancelled ? <X size={24} /> : <ArrowRight size={24} />}
        </span>
        <h1 className="mt-5 font-caslon text-3xl font-bold tracking-tight text-[#111111]">
          {cancelled ? "Ride cancelled" : "No active ride"}
        </h1>
        <p className="mt-2 text-sm text-[#7A7A7A]">
          {cancelled
            ? "Your ride was cancelled. You haven't been charged."
            : "Book a ride from the dashboard and it will show up here."}
        </p>
        <Link
          href="/dashboard"
          className="mt-6 inline-flex items-center gap-2 rounded-md bg-[#111111] px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-black"
        >
          Book a ride
          <ArrowRight size={15} />
        </Link>
      </div>
    );
  }

  const RideIcon = ride.icon;
  const vehicle = vehicleByRide[ride.id] ?? vehicleByRide.standard;

  // Fare breakdown (sample numbers derived from the quoted fare)
  const taxes = Math.round(ride.price * 0.05);
  const base = Math.round(ride.price * 0.4);
  const distanceCharge = ride.price - base - taxes;
  const discount = promo ? PROMOS[promo](ride.price) : 0;
  const total = ride.price - discount;

  const applyPromo = () => {
    const code = promoInput.trim().toUpperCase();
    if (PROMOS[code]) {
      setPromo(code);
      setPromoError("");
      setPromoInput("");
    } else {
      setPromoError("That code isn't valid.");
    }
  };

  const selectedMethod = methods.find((m) => m.id === method) ?? methods[0];

  return (
    <>
      {/* Banner — full width */}
      <div className="relative h-44 w-full overflow-hidden bg-[#F6EFDD] sm:h-60">
        <Image
          src="/current-ride-banner.webp"
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover object-[center_85%]"
        />
        <div className="absolute inset-0 mx-auto flex w-full max-w-6xl flex-col justify-center px-4 sm:px-6">
          <h1 className="font-caslon text-3xl font-bold leading-none tracking-tight text-[#111111] sm:text-4xl lg:text-5xl">
            Your Current Ride
          </h1>
          <div className="mt-3 h-[3px] w-10 bg-[#111111]" />
        </div>
      </div>

    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8">

      {/* Progress */}
      <div className={card}>
        <RideProgress current={paid ? 4 : currentStep} eta={ride.eta} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        {/* ================= LEFT: Ride details ================= */}
        <div className="space-y-6">
          {/* Driver */}
          <section className={card}>
            <div className="flex items-start justify-between gap-3">
              <CardHeader label="On the way" title="Your Driver" />
              <span className="inline-flex items-center gap-1.5 rounded-md bg-[#111111] px-2.5 py-1 text-[11px] font-semibold text-white">
                Arriving in {ride.eta} min
              </span>
            </div>

            <div className="mt-6 flex items-center gap-4">
              <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-md bg-[#111111] text-lg font-bold text-white">
                RK
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-lg font-bold text-[#111111]">{driver.name}</p>
                <p className="flex items-center gap-1 text-xs text-[#7A7A7A]">
                  <Star size={12} className="fill-[#111111] text-[#111111]" />
                  {driver.rating} · {driver.trips.toLocaleString("en-IN")} trips
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  aria-label="Call driver"
                  className="flex h-10 w-10 items-center justify-center rounded-md bg-[#DCFCE7] text-[#15803D] transition-colors hover:bg-[#16A34A] hover:text-white"
                >
                  <Phone size={16} />
                </button>
                <button
                  type="button"
                  aria-label="Message driver"
                  className="flex h-10 w-10 items-center justify-center rounded-md bg-[#FEF3C7] text-[#B45309] transition-colors hover:bg-[#F59E0B] hover:text-white"
                >
                  <MessageSquare size={16} />
                </button>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="rounded-md bg-[#F4F4F4] px-4 py-3">
                <p className={eyebrow}>Vehicle</p>
                <p className="mt-1 flex items-center gap-1.5 text-sm font-semibold text-[#111111]">
                  <RideIcon size={14} />
                  {ride.name}
                </p>
                <p className="text-xs text-[#7A7A7A]">{vehicle.model}</p>
              </div>
              <div className="rounded-md bg-[#F4F4F4] px-4 py-3">
                <p className={eyebrow}>Number plate</p>
                <p className="mt-1 font-mono text-sm font-bold tracking-wider text-[#111111]">
                  {vehicle.plate}
                </p>
              </div>
              <div className="rounded-md bg-[#111111] px-4 py-3 text-white">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/60">
                  Ride OTP
                </p>
                <p className="mt-1 font-mono text-xl font-bold tracking-[0.3em]">{driver.otp}</p>
              </div>
            </div>
          </section>

          {/* Trip */}
          <section className={card}>
            <CardHeader label="Route" title="Trip Details" />

            <div className="relative mt-6">
              <div
                aria-hidden="true"
                className="pointer-events-none absolute left-[5px] top-[18px] bottom-[18px] w-px bg-[#111111]/25"
              />
              <div className="flex items-start gap-3">
                <span className="relative z-10 mt-1.5 flex h-3 w-3 shrink-0 items-center justify-center rounded-full bg-[#111111]">
                  <span className="h-1 w-1 rounded-full bg-white" />
                </span>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8A8A8A]">
                    Pickup
                  </p>
                  <p className="text-sm font-medium text-[#111111]">{pickup}</p>
                </div>
              </div>
              <div className="mt-5 flex items-start gap-3">
                <span className="relative z-10 mt-1.5 flex h-3 w-3 shrink-0 items-center justify-center rounded-full bg-[#111111]">
                  <span className="h-1 w-1 rounded-full bg-white" />
                </span>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8A8A8A]">
                    Destination
                  </p>
                  <p className="text-sm font-medium text-[#111111]">{destination}</p>
                </div>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-3 gap-3">
              {[
                { label: "Distance", value: "12.4 km" },
                { label: "Est. time", value: `${ride.eta + 24} min` },
                { label: "Seats", value: String(ride.seats) },
              ].map((item) => (
                <div key={item.label} className="rounded-md bg-[#F4F4F4] px-4 py-3">
                  <p className={eyebrow}>{item.label}</p>
                  <p className="mt-1 text-sm font-bold text-[#111111]">{item.value}</p>
                </div>
              ))}
            </div>

            <p className="mt-4 flex items-center gap-2 text-xs text-[#7A7A7A]">
              <ShieldCheck size={14} className="text-[#111111]" />
              Share your OTP only after you&apos;re in the vehicle.
            </p>
          </section>

          {!paid &&
            (confirmCancel ? (
              <div
                role="alertdialog"
                aria-label="Confirm cancellation"
                className="flex flex-col gap-3 rounded-md border border-[#F3C7C7] bg-[#FDF3F3] p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="text-sm font-bold text-[#B42318]">Cancel this ride?</p>
                  <p className="text-xs text-[#7A7A7A]">
                    Your driver is already on the way. Free cancellation for 2 more minutes.
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    onClick={() => setConfirmCancel(false)}
                    className="rounded-md border border-[#E8E8E8] bg-white px-4 py-2.5 text-sm font-semibold text-[#111111] transition-colors hover:bg-[#F4F4F4]"
                  >
                    Keep ride
                  </button>
                  <button
                    type="button"
                    onClick={() => setCancelled(true)}
                    className="rounded-md bg-[#D92D20] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_6px_16px_-6px_rgba(217,45,32,0.6)] transition-colors hover:bg-[#B42318]"
                  >
                    Yes, cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmCancel(true)}
                className="
                  group
                  flex
                  w-full
                  items-center
                  justify-center
                  gap-2
                  rounded-md
                  border
                 
                  py-3.5
                  text-sm
                  font-semibold
                  text-white
                  transition-all
                  duration-200
            border-[#D92D20]
            bg-[#D92D20]
                  
                  active:scale-[0.99]
                "
              >
             
                Cancel Ride
              </button>
            ))}
        </div>

        {/* ================= RIGHT: Payment ================= */}
        <aside className={`h-fit ${card}`}>
          <CardHeader label="Payment" title="Fare Details" />

          {/* Breakdown */}
          <dl className="mt-6 space-y-2.5 text-sm">
            <div className="flex justify-between">
              <dt className="text-[#7A7A7A]">Base fare</dt>
              <dd className="font-semibold text-[#111111]">₹{base}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-[#7A7A7A]">Distance (12.4 km)</dt>
              <dd className="font-semibold text-[#111111]">₹{distanceCharge}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-[#7A7A7A]">Taxes &amp; fees</dt>
              <dd className="font-semibold text-[#111111]">₹{taxes}</dd>
            </div>
            {promo && (
              <div className="flex justify-between">
                <dt className="flex items-center gap-1.5 text-[#111111]">
                  <Tag size={13} />
                  {promo}
                  {!paid && (
                    <button
                      type="button"
                      onClick={() => setPromo(null)}
                      aria-label="Remove promo code"
                      className="text-[#7A7A7A] hover:text-[#111111]"
                    >
                      <X size={13} />
                    </button>
                  )}
                </dt>
                <dd className="font-semibold text-[#111111]">−₹{discount}</dd>
              </div>
            )}
          </dl>

          <div className="mt-4 flex items-end justify-between border-t border-dashed border-[#D4D4D4] pt-4">
            <p className={eyebrow}>Total</p>
            <p className="font-caslon text-4xl font-bold leading-none tracking-tight text-[#111111]">
              ₹{total}
            </p>
          </div>

          {paid ? (
            <div role="status" className="mt-6 rounded-md bg-[#111111] p-4 text-white">
              <div className="flex items-center gap-3">
                <CheckCircle2 size={22} />
                <div>
                  <p className="text-sm font-semibold">Payment successful</p>
                  <p className="text-xs text-white/70">
                    ₹{total} paid via {selectedMethod.label}.
                  </p>
                </div>
              </div>
              <Link
                href="/dashboard/history"
                className="mt-4 flex items-center justify-center gap-1.5 rounded-md bg-white py-2.5 text-sm font-semibold text-[#111111] transition-colors hover:bg-[#F4F4F4]"
              >
                View in history
                <ArrowRight size={14} />
              </Link>
            </div>
          ) : (
            <>
              {/* Promo */}
              {!promo && (
                <div className="mt-6">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={promoInput}
                      onChange={(e) => {
                        setPromoInput(e.target.value);
                        setPromoError("");
                      }}
                      onKeyDown={(e) => e.key === "Enter" && applyPromo()}
                      placeholder="Promo code"
                      aria-label="Promo code"
                      className="min-w-0 flex-1 rounded-md border border-transparent bg-[#F4F4F4] px-3.5 py-2.5 text-sm font-semibold uppercase text-[#111111] placeholder:font-normal placeholder:normal-case placeholder:text-[#A3A3A3] outline-none focus:border-[#111111] focus:bg-white"
                    />
                    <button
                      type="button"
                      onClick={applyPromo}
                      disabled={!promoInput.trim()}
                      className="rounded-md border border-[#111111] px-4 text-sm font-semibold text-[#111111] transition-colors hover:bg-[#111111] hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Apply
                    </button>
                  </div>
                  {promoError && (
                    <p role="alert" className="mt-1.5 text-xs font-medium text-[#B3261E]">
                      {promoError}
                    </p>
                  )}
                </div>
              )}

              {/* Method */}
              <p className={`mt-6 ${eyebrow}`}>Pay with</p>
              <div className="mt-3 space-y-2" role="radiogroup" aria-label="Payment method">
                {methods.map((m) => {
                  const Icon = m.icon;
                  const active = m.id === method;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      onClick={() => setMethod(m.id)}
                      className={`group flex w-full items-center gap-3 rounded-md border px-3 py-2.5 text-left transition-all duration-200 ${
                        active
                          ? "border-[#111111] bg-white shadow-[0_6px_16px_-8px_rgba(0,0,0,0.35)]"
                          : "border-transparent bg-[#F4F4F4] hover:bg-[#EDEDED]"
                      }`}
                    >
                      <span
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md transition-colors ${
                          active
                            ? "bg-[#111111] text-white"
                            : "bg-white text-[#111111] group-hover:bg-[#111111] group-hover:text-white"
                        }`}
                      >
                        <Icon size={16} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-bold text-[#111111]">{m.label}</span>
                        <span className="block truncate text-xs text-[#7A7A7A]">{m.detail}</span>
                      </span>
                      {active && <Check size={16} className="text-[#111111]" />}
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={() => setPaid(true)}
                className="group mt-6 flex w-full items-center justify-center gap-2 rounded-md bg-[#111111] py-3.5 text-[15px] font-semibold text-white shadow-[0_8px_18px_-6px_rgba(0,0,0,0.45)] transition-all duration-300 hover:bg-black active:scale-[0.99]"
              >
                {method === "cash" ? "Confirm cash payment" : `Pay ₹${total}`}
                <ArrowRight
                  size={16}
                  strokeWidth={2.25}
                  className="transition-transform duration-300 group-hover:translate-x-0.5"
                />
              </button>
            </>
          )}
        </aside>
      </div>
    </div>
    </>
  );
}

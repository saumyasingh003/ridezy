"use client";

import { useState } from "react";
import Image from "next/image";
import { Copy, Check, Gift, Bike, CarFront, Truck, Users, type LucideIcon } from "lucide-react";

interface Offer {
  code: string;
  title: string;
  description: string;
  validTill: string;
  icon: LucideIcon;
  highlight?: boolean;
}

const offers: Offer[] = [
  {
    code: "WELCOME50",
    title: "50% off your next ride",
    description: "Up to ₹100 off on any ride type. Valid once per user.",
    validTill: "Oct 31",
    icon: Gift,
    highlight: true,
  },
  {
    code: "BIKE20",
    title: "Flat ₹20 off on bikes",
    description: "Beat the traffic for less on rides above ₹60.",
    validTill: "Oct 15",
    icon: Bike,
  },
  {
    code: "AUTO30",
    title: "30% off autos",
    description: "Up to ₹40 off on your next 3 auto rides.",
    validTill: "Oct 20",
    icon: Truck,
  },
  {
    code: "CABWKND",
    title: "Weekend cab deal",
    description: "₹75 off Standard and Premium rides on Sat & Sun.",
    validTill: "Nov 2",
    icon: CarFront,
  },
];

export default function OfferView() {
  const [copied, setCopied] = useState<string | null>(null);

  const copy = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
    } catch {
      // Clipboard can be unavailable (e.g. insecure context); still show feedback.
    }
    setCopied(code);
    setTimeout(() => setCopied((c) => (c === code ? null : c)), 1800);
  };

  const eyebrow = "text-[10px] font-bold uppercase tracking-[0.2em] text-[#8A8A8A]";

  return (
    <>
    {/* Banner — full width, same size as the History and Payments banners */}
    <div className="relative h-44 w-full overflow-hidden bg-[#F6EFDD] sm:h-60">
      <Image
        src="/offers-banner.webp"
        alt=""
        fill
        priority
        sizes="100vw"
        className="object-cover object-[center_90%]"
      />
    </div>

    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      {/* Header — same style as the dashboard panels */}
      <p className={eyebrow}>Save more</p>
      <h1 className="mt-1.5 font-caslon text-3xl font-bold leading-none tracking-tight text-[#111111] sm:text-4xl">
        Offers
      </h1>
      <div className="mt-3 h-[3px] w-10 bg-[#111111]" />

      {/* Offers */}
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {offers.map((offer) => {
          const Icon = offer.icon;
          const isCopied = copied === offer.code;
          const dark = offer.highlight;
          return (
            <article
              key={offer.code}
              className={`group relative flex flex-col overflow-hidden rounded-md border p-5 transition-all duration-300 hover:-translate-y-0.5 sm:p-6 ${
                dark
                  ? "border-[#111111] bg-[#111111] text-white shadow-[0_16px_32px_-16px_rgba(0,0,0,0.6)]"
                  : "border-[#E8E8E8] bg-white hover:border-[#111111]/40 hover:shadow-[0_16px_32px_-18px_rgba(0,0,0,0.3)]"
              }`}
            >
              {dark && (
                <>
                  <div className="pointer-events-none absolute -right-14 -top-14 h-44 w-44 rounded-full border border-white/10" />
                  <div className="pointer-events-none absolute -right-4 -top-4 h-24 w-24 rounded-full border border-white/10" />
                </>
              )}

              <div className="relative flex items-start justify-between gap-3">
                <span
                  className={`flex h-11 w-11 items-center justify-center rounded-md transition-colors duration-200 ${
                    dark
                      ? "bg-white text-[#111111]"
                      : "border border-[#E0E0E0] bg-white text-[#111111] group-hover:border-[#111111] group-hover:bg-[#111111] group-hover:text-white"
                  }`}
                >
                  <Icon size={19} />
                </span>
                <span
                  className={`rounded-md px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] ${
                    dark ? "bg-white/10 text-white/80" : "bg-[#F4F4F4] text-[#7A7A7A]"
                  }`}
                >
                  Till {offer.validTill}
                </span>
              </div>

              {dark && (
                <p className="relative mt-5 text-[10px] font-bold uppercase tracking-[0.2em] text-white/60">
                  Best offer
                </p>
              )}
              <h2
                className={`relative font-caslon text-2xl font-bold leading-tight tracking-tight ${
                  dark ? "mt-1.5 text-white" : "mt-5 text-[#111111]"
                }`}
              >
                {offer.title}
              </h2>
              <p className={`relative mt-1.5 text-sm leading-6 ${dark ? "text-white/70" : "text-[#7A7A7A]"}`}>
                {offer.description}
              </p>

              <div className="relative mt-auto flex items-stretch gap-2 pt-5">
                <span
                  className={`flex flex-1 items-center rounded-md border border-dashed px-4 font-mono text-sm font-bold tracking-[0.18em] ${
                    dark ? "border-white/30 text-white" : "border-[#C4C4C4] bg-[#F4F4F4] text-[#111111]"
                  }`}
                >
                  {offer.code}
                </span>
                <button
                  type="button"
                  onClick={() => copy(offer.code)}
                  aria-label={`Copy code ${offer.code}`}
                  className={`flex items-center gap-1.5 rounded-md px-4 py-2.5 text-sm font-semibold transition-colors ${
                    dark
                      ? "bg-white text-[#111111] hover:bg-[#F4F4F4]"
                      : "bg-[#111111] text-white hover:bg-black"
                  }`}
                >
                  {isCopied ? <Check size={15} /> : <Copy size={15} />}
                  {isCopied ? "Copied" : "Copy"}
                </button>
              </div>
            </article>
          );
        })}
      </div>

      {/* Referral */}
      <section className="mt-6 flex flex-col gap-5 rounded-md bg-[#F4F4F4] p-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-[#111111] text-white">
            <Users size={21} />
          </span>
          <div>
            <p className={eyebrow}>Refer &amp; earn</p>
            <h2 className="mt-1 font-caslon text-2xl font-bold leading-tight tracking-tight text-[#111111]">
              Refer a friend, earn ₹100
            </h2>
            <p className="text-sm text-[#7A7A7A]">
              They get ₹50 off their first ride. You get ₹100 in your wallet.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => copy("RIDEZY-RIDER")}
          className="flex shrink-0 items-center justify-center gap-1.5 rounded-md bg-[#111111] px-5 py-3 text-sm font-semibold text-white shadow-[0_8px_18px_-6px_rgba(0,0,0,0.45)] transition-colors hover:bg-black"
        >
          {copied === "RIDEZY-RIDER" ? <Check size={15} /> : <Copy size={15} />}
          {copied === "RIDEZY-RIDER" ? "Code copied" : "Copy invite code"}
        </button>
      </section>
    </div>
    </>
  );
}

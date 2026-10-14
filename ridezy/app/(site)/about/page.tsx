import type { Metadata } from "next";
import Link from "next/link";
import { ShieldCheck, Leaf, Users, Sparkles } from "lucide-react";

export const metadata: Metadata = {
  title: "About | Ridezy",
  description:
    "Ridezy makes everyday travel simple, safe and affordable across Indian cities.",
};

const stats = [
  { value: "2M+", label: "Rides completed" },
  { value: "45K+", label: "Verified partners" },
  { value: "18", label: "Cities served" },
  { value: "4.8★", label: "Average rating" },
];

const values = [
  {
    icon: ShieldCheck,
    title: "Safety First",
    description:
      "Every partner is background-verified, and every ride is tracked live from pickup to drop.",
  },
  {
    icon: Sparkles,
    title: "Simple by Design",
    description:
      "Three taps to book. No surge surprises, no hidden fees — just the fare you see upfront.",
  },
  {
    icon: Users,
    title: "Partners Matter",
    description:
      "Fair commissions, weekly payouts and insurance cover for the people who keep cities moving.",
  },
  {
    icon: Leaf,
    title: "Greener Streets",
    description:
      "Shared rides and an expanding EV fleet help us cut emissions one trip at a time.",
  },
];

export default function AboutPage() {
  return (
    <main className="relative w-full bg-[#FFFDF6]">

      {/* ==================================================
          HERO
      =================================================== */}
      <section className="relative overflow-hidden pt-36 pb-16 sm:pt-44 sm:pb-20">
        <div className="pointer-events-none absolute -left-40 top-10 h-80 w-80 rounded-full bg-[#E5E9CA]/40 blur-3xl" />
        <div className="pointer-events-none absolute -right-40 top-40 h-96 w-96 rounded-full bg-[#E5E9CA]/30 blur-3xl" />

        <div className="relative mx-auto max-w-7xl px-6 sm:px-10 lg:px-14">
          <span className="inline-flex items-center gap-2 rounded-full bg-[#F3F4E5] px-4 py-1.5 text-sm font-semibold text-stone-900 shadow-sm">
            Our Story
          </span>

          <h1 className="mt-6 max-w-4xl font-caslon text-5xl font-bold leading-[0.98] tracking-tight text-[#111111] sm:text-6xl lg:text-7xl">
            Built for the way{" "}
            <span className="text-[#214D2A]">your city</span> moves.
          </h1>

          <p className="mt-6 max-w-2xl text-base leading-7 text-[#62635F] sm:text-lg sm:leading-8">
            Ridezy started in 2021 with a simple question: why is getting
            across town still so hard? Today we connect millions of riders
            with trusted local partners on bikes, autos and cabs — making
            every journey quicker, safer and kinder on the wallet.
          </p>
        </div>
      </section>

      {/* ==================================================
          STATS
      =================================================== */}
      <section className="mx-auto max-w-7xl px-6 sm:px-10 lg:px-14">
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-3xl border border-[#EDEDE8] bg-[#EDEDE8] md:grid-cols-4">
          {stats.map((stat) => (
            <div key={stat.label} className="bg-white px-6 py-8 text-center">
              <p className="font-caslon text-4xl font-bold tracking-tight text-[#214D2A] sm:text-5xl">
                {stat.value}
              </p>
              <p className="mt-2 text-sm text-[#686863]">{stat.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ==================================================
          MISSION
      =================================================== */}
      <section className="mx-auto grid max-w-7xl gap-10 px-6 py-20 sm:px-10 sm:py-24 lg:grid-cols-2 lg:gap-16 lg:px-14">
        <div>
          <h2 className="font-caslon text-4xl font-bold tracking-tight text-[#111111] sm:text-5xl">
            Our Mission
          </h2>
          <div className="mt-3 h-1 w-16 rounded-full bg-[#6E8F47]" />
        </div>

        <div className="space-y-5 text-[15px] leading-7 text-[#62635F]">
          <p>
            We believe reliable transport shouldn&apos;t be a luxury. Whether
            it&apos;s a quick hop to the metro, the daily office commute or a
            late-night ride home, everyone deserves a way to get there
            without the stress.
          </p>
          <p>
            That&apos;s why we work closely with local riders and drivers,
            invest in technology that keeps fares transparent, and design
            every feature around one goal — getting you where you need to
            be, safely and on time.
          </p>
          <p>
            From a small team of five in Bengaluru, we&apos;ve grown into a
            community of thousands. But our promise hasn&apos;t changed: move
            cities forward, one ride at a time.
          </p>
        </div>
      </section>

      {/* ==================================================
          VALUES
      =================================================== */}
      <section className="mx-auto max-w-7xl px-6 pb-20 sm:px-10 sm:pb-24 lg:px-14">
        <h2 className="font-caslon text-4xl font-bold tracking-tight text-[#111111] sm:text-5xl">
          What We Stand For
        </h2>

        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {values.map((value) => {
            const Icon = value.icon;
            return (
              <div
                key={value.title}
                className="group rounded-3xl border border-[#EDEDE8] bg-white p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_20px_40px_-16px_rgba(33,77,42,0.2)]"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#E5E9CA] text-[#214D2A] transition-colors duration-300 group-hover:bg-[#214D2A] group-hover:text-white">
                  <Icon size={20} strokeWidth={2} />
                </div>
                <h3 className="mt-5 text-lg font-bold tracking-[-0.02em] text-[#111111]">
                  {value.title}
                </h3>
                <p className="mt-2 text-sm leading-6 text-[#686863]">
                  {value.description}
                </p>
              </div>
            );
          })}
        </div>

        {/* CTA */}
        <div className="mt-16 flex flex-col items-start justify-between gap-6 rounded-3xl bg-[#214D2A] px-8 py-10 sm:flex-row sm:items-center sm:px-12">
          <div>
            <h3 className="font-caslon text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Ready for your next ride?
            </h3>
            <p className="mt-2 text-sm text-white/75 sm:text-base">
              Join millions who move smarter with Ridezy.
            </p>
          </div>
          <Link
            href="/onboarding"
            className="shrink-0 rounded-full bg-white px-8 py-3.5 text-sm font-semibold text-[#111111] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl sm:text-base"
          >
            Book Your Ride
          </Link>
        </div>
      </section>
    </main>
  );
}

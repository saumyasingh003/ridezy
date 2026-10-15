import type { Metadata } from "next";
import {
  ShieldCheck,
  Leaf,
  Users,
  Sparkles,
  KeyRound,
  UserCog,
  MapPinned,
  CarFront,
  RadioTower,
  Route,
  CreditCard,
  Star,
  BellRing,
  LayoutDashboard,
  CircleCheck,
  ArrowUpRight,
  Code2,
} from "lucide-react";

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

const developerSkills = ["React", "Next.js", "TypeScript", "Node.js", "Express.js", "MongoDB", "PostgreSQL"];

const PORTFOLIO_URL = "https://saumya-singhs-portfolio.vercel.app/";

// Every module of the platform, in the order a ride flows through them.
const modules = [
  {
    icon: KeyRound,
    title: "Authentication",
    features: ["Register", "Email OTP", "Login / JWT", "Role-based access", "/me"],
  },
  {
    icon: UserCog,
    title: "User & Profile Management",
    features: ["Passenger profile", "Driver profile", "Vehicle details", "Driver documents"],
  },
  {
    icon: MapPinned,
    title: "Driver Availability & Location",
    features: ["Online / offline", "Current location", "Geospatial data", "Location foundation"],
  },
  {
    icon: CarFront,
    title: "Ride Module",
    featured: true,
    features: [
      "Pickup address",
      "Destination address",
      "Vehicle selection",
      "Route & distance",
      "Fare calculation",
      "Ride summary",
      "Book ride",
      "Nearby driver search",
      "Ride requests",
      "Driver accept / reject",
      "Driver assignment",
      "Ride lifecycle",
    ],
  },
  {
    icon: RadioTower,
    title: "Real-Time System",
    features: [
      "Socket.IO",
      "Live driver location",
      "Driver → pickup tracking",
      "Distance & ETA to pickup",
      "Driver arrival",
      "Ride status updates",
      "Passenger live tracking",
      "Driver → destination tracking",
      "In-ride chat",
      "Phone call",
    ],
  },
  {
    icon: Route,
    title: "Driver Simulator",
    features: ["Simulated driver", "Movement", "Route progression", "Real-time location events"],
  },
  {
    icon: CreditCard,
    title: "Payments",
    features: ["Payment simulation", "Transactions", "Payment status"],
  },
  {
    icon: Star,
    title: "Ratings & Reviews",
    features: ["Passenger → Driver", "Driver → Passenger"],
  },
  {
    icon: BellRing,
    title: "Notifications",
    features: ["Ride accepted", "Driver arriving", "Driver arrived", "Ride started", "Ride completed"],
  },
  {
    icon: LayoutDashboard,
    title: "Admin",
    features: ["Driver verification", "User management", "Active rides", "Payments", "Analytics"],
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
            Ridezy started in 2026 with a simple question: why is getting
            across town still so hard? Today we connect millions of riders
            with trusted local partners on bikes, autos and cabs — making
            every journey quicker, safer and kinder on the wallet.
          </p>
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

      </section>

      {/* ==================================================
          PLATFORM: every module, fully integrated
      =================================================== */}
      <section className="relative overflow-hidden border-t border-[#EDEDE8] bg-[#F7F6EE] pt-20 pb-30 sm:pt-24 sm:pb-38 -mb-10 sm:-mb-14">
        <div className="pointer-events-none absolute -right-32 -top-32 h-96 w-96 rounded-full bg-[#E5E9CA]/60 blur-3xl" />

        <div className="relative mx-auto max-w-7xl px-6 sm:px-10 lg:px-14">
          <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <span className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-1.5 text-sm font-semibold text-stone-900 shadow-sm ring-1 ring-[#EDEDE8]">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#6E8F47] opacity-60" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-[#214D2A]" />
                </span>
                Under the Hood
              </span>
              <h2 className="mt-5 font-caslon text-4xl font-bold leading-[1.02] tracking-tight text-[#111111] sm:text-5xl">
                One platform. <span className="text-[#214D2A]">Every piece connected.</span>
              </h2>
              <p className="mt-4 text-[15px] leading-7 text-[#62635F]">
                From the moment you sign up to the rating after your trip, each module hands off to
                the next, so a ride flows end to end without a single gap.
              </p>
            </div>

            {/* Integration meter */}
            <div className="w-full rounded-2xl border border-[#EDEDE8] bg-white p-5 shadow-xs lg:w-80">
              <div className="flex items-baseline justify-between">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#7A7A74]">Integrated</p>
                <p className="font-caslon text-3xl font-bold text-[#214D2A]">
                  {modules.length}
                  <span className="text-lg text-[#9A9A92]">/{modules.length}</span>
                </p>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#E5E9CA]">
                <div className="h-full w-full rounded-full bg-gradient-to-r from-[#6E8F47] to-[#214D2A]" />
              </div>
              <p className="mt-2 text-xs text-[#686863]">
                {modules.reduce((sum, m) => sum + m.features.length, 0)} features live across all modules
              </p>
            </div>
          </div>

          {/* Module flow */}
          <ol className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {modules.map((module, index) => {
              const Icon = module.icon;
              const step = String(index + 1).padStart(2, "0");
              const featured = module.featured === true;
              return (
                <li
                  key={module.title}
                  className={`group relative flex flex-col rounded-3xl border p-6 transition-all duration-300 hover:-translate-y-1 ${
                    featured
                      ? "border-[#214D2A] bg-[#214D2A] text-white shadow-[0_24px_48px_-20px_rgba(33,77,42,0.55)] md:col-span-2"
                      : "border-[#EDEDE8] bg-white hover:shadow-[0_20px_40px_-16px_rgba(33,77,42,0.2)]"
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div
                      className={`flex h-12 w-12 items-center justify-center rounded-2xl transition-colors duration-300 ${
                        featured
                          ? "bg-white/10 text-[#E5E9CA] ring-1 ring-white/15"
                          : "bg-[#E5E9CA] text-[#214D2A] group-hover:bg-[#214D2A] group-hover:text-white"
                      }`}
                    >
                      <Icon size={20} strokeWidth={2} />
                    </div>
                    <span
                      className={`font-caslon text-4xl font-bold leading-none ${
                        featured ? "text-white/15" : "text-[#E5E9CA]"
                      }`}
                    >
                      {step}
                    </span>
                  </div>

                  <div className="mt-5 flex flex-wrap items-center gap-2">
                    <h3
                      className={`font-bold tracking-[-0.02em] ${
                        featured ? "text-2xl text-white sm:text-3xl" : "text-lg text-[#111111]"
                      }`}
                    >
                      {module.title}
                    </h3>
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                        featured ? "bg-[#E5E9CA] text-[#214D2A]" : "bg-[#F3F4E5] text-[#214D2A]"
                      }`}
                    >
                      <CircleCheck size={11} strokeWidth={2.5} />
                      Live
                    </span>
                  </div>

                  {featured && (
                    <p className="mt-2 max-w-xl text-sm leading-6 text-white/70">
                      The heart of Ridezy: from choosing where you&apos;re going to the moment a
                      driver is on the way, every step is handled in one connected flow.
                    </p>
                  )}

                  <ul className={`mt-5 gap-2 ${featured ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3" : "flex flex-wrap"}`}>
                    {module.features.map((feature) => (
                      <li
                        key={feature}
                        className={`inline-flex items-center gap-1.5 rounded-full text-xs font-medium ${
                          featured
                            ? "bg-white/[0.07] px-3 py-2 text-white/90 ring-1 ring-white/10"
                            : "bg-[#FAFAF7] px-2.5 py-1 text-[#4A4B47] ring-1 ring-[#EDEDE8]"
                        }`}
                      >
                        <CircleCheck
                          size={12}
                          strokeWidth={2.5}
                          className={featured ? "shrink-0 text-[#B9C98F]" : "shrink-0 text-[#6E8F47]"}
                        />
                        {feature}
                      </li>
                    ))}
                  </ul>
                </li>
              );
            })}
          </ol>

          {/* Meet the developer */}
          <div className="relative mt-16 overflow-hidden rounded-3xl border border-[#EDEDE8] bg-white p-6 shadow-[0_20px_40px_-24px_rgba(33,77,42,0.25)] sm:p-10">
            <div className="pointer-events-none absolute -left-24 -bottom-24 h-64 w-64 rounded-full bg-[#E5E9CA]/50 blur-3xl" />

            <div className="relative grid gap-8 lg:grid-cols-[auto_1fr] lg:gap-12">
              {/* Identity */}
              <div className="flex items-center gap-4 lg:flex-col lg:items-start">
                <div className="relative">
                  <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-[#214D2A] font-caslon text-4xl font-bold text-[#E5E9CA] shadow-[0_16px_32px_-12px_rgba(33,77,42,0.6)] sm:h-24 sm:w-24 sm:text-5xl">
                    S
                  </div>
                  <span className="absolute -bottom-1.5 -right-1.5 flex h-8 w-8 items-center justify-center rounded-full bg-[#E5E9CA] text-[#214D2A] ring-4 ring-white">
                    <Code2 size={15} strokeWidth={2.5} />
                  </span>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#7A7A74]">Meet the Developer</p>
                  <p className="mt-1 font-caslon text-2xl font-bold tracking-tight text-[#111111] sm:text-3xl">
                    Saumya Singh
                  </p>
                  <p className="text-sm text-[#686863]">Full Stack Developer · CS Graduate</p>
                </div>
              </div>

              {/* About */}
              <div>
                <div className="flex flex-wrap items-center gap-3">
                  <h3 className="font-caslon text-3xl font-bold tracking-tight text-[#111111] sm:text-4xl">
                    About Me
                  </h3>
                  <span className="inline-flex items-center gap-2 rounded-full bg-[#F3F4E5] px-3 py-1 text-xs font-semibold text-[#214D2A]">
                    <span className="relative flex h-2 w-2">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#6E8F47] opacity-60" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-[#214D2A]" />
                    </span>
                    Open to opportunities
                  </span>
                </div>

                <p className="mt-4 max-w-3xl text-[15px] leading-7 text-[#62635F]">
                  I&apos;m a Full Stack Developer and Computer Science graduate passionate about building
                  scalable, user-friendly web applications. I have hands-on experience with React, Next.js,
                  TypeScript, Node.js, Express.js, MongoDB, and PostgreSQL. I enjoy solving real-world
                  problems, learning new technologies, and continuously improving my development skills.
                  I&apos;m currently exploring new career opportunities where I can contribute, learn from
                  experienced developers, and grow as a software engineer.
                </p>

                <ul className="mt-5 flex flex-wrap gap-2">
                  {developerSkills.map((skill) => (
                    <li
                      key={skill}
                      className="rounded-full bg-[#FAFAF7] px-3 py-1 text-xs font-medium text-[#4A4B47] ring-1 ring-[#EDEDE8]"
                    >
                      {skill}
                    </li>
                  ))}
                </ul>

                <a
                  href={PORTFOLIO_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group mt-7 inline-flex items-center gap-2 rounded-full bg-[#214D2A] px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#183A1F]"
                >
                  View Portfolio
                  <ArrowUpRight
                    size={16}
                    className="transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                  />
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

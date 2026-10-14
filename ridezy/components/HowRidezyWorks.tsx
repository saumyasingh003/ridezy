"use client";

import React from "react";
import { useRouter } from "next/navigation";
import {
  Smartphone,
  Bike,
  CarFront,
  Flag,
  Navigation,
  Sparkles,
  Clock3,
  ShieldCheck,
  ArrowRight,
} from "lucide-react";

interface StepItem {
  number: number;
  badge: string;
  title: string;
  description: string;
  icon: React.ComponentType<{
    size?: number;
    strokeWidth?: number;
    className?: string;
  }>;
  tagIcon: React.ComponentType<{
    size?: number;
    className?: string;
  }>;
}

const steps: StepItem[] = [
  {
    number: 1,
    badge: "START YOUR JOURNEY",
    title: "Set Your Location",
    description:
      "Enter your pickup and destination to find available rides around you.",
    icon: Smartphone,
    tagIcon: Navigation,
  },
  {
    number: 2,
    badge: "PICK YOUR RIDE",
    title: "Choose a Ride",
    description:
      "Choose from quick bikes, comfortable autos, or spacious cabs.",
    icon: Bike,
    tagIcon: Sparkles,
  },
  {
    number: 3,
    badge: "GET ON THE MOVE",
    title: "Get Matched",
    description:
      "A nearby verified partner accepts your ride and heads your way.",
    icon: CarFront,
    tagIcon: Clock3,
  },
  {
    number: 4,
    badge: "ARRIVE SAFELY",
    title: "Reach Your Destination",
    description:
      "Track your journey in real-time and arrive safely at your destination.",
    icon: Flag,
    tagIcon: ShieldCheck,
  },
];

function StepItemRow({ step }: { step: StepItem }) {
  const Icon = step.icon;
  const TagIcon = step.tagIcon;

  return (
    <div className="group relative flex items-start gap-5 sm:gap-7">
      {/* ---------------------------------------------
          TIMELINE NODE
      ---------------------------------------------- */}
      <div
        className="
          relative
          z-10
          flex
          h-[52px]
          w-[52px]
          shrink-0
          items-center
          justify-center
        "
      >
        {/* Outer subtle ring */}
        <div
          className="
            absolute
            inset-0
            rounded-full
            border
            border-[#214D2A]/15
            bg-[#FFFDF6]
            transition-all
            duration-300
            group-hover:border-[#214D2A]/30
            group-hover:scale-105
          "
        />

        {/* Green node */}
        <div
          className="
            relative
            flex
            h-10
            w-10
            items-center
            justify-center
            rounded-full
            bg-[#214D2A]
            text-white
            shadow-[0_5px_15px_rgba(33,77,42,0.15)]
            transition-all
            duration-300
            group-hover:scale-105
          "
        >
          <Icon size={16} strokeWidth={2} />
        </div>

        {/* Small checkpoint */}
        {step.number !== 4 && (
          <div
            className="
              absolute
              -bottom-1
              h-2.5
              w-2.5
              rounded-full
              border-2
              border-[#FFFDF6]
              bg-[#6E8F47]
            "
          />
        )}
      </div>

      {/* ---------------------------------------------
          CONTENT
      ---------------------------------------------- */}
      <div className="pt-0.5">
        {/* Top label */}
        <div
          className="
            mb-1.5
            flex
            items-center
            gap-1.5
            text-[10px]
            font-bold
            uppercase
            tracking-[0.16em]
            text-[#6E8F47]
          "
        >
          <TagIcon size={11} />
          {step.badge}
        </div>

        {/* Title */}
        <h3
          className="
            text-xl
            sm:text-[22px]
            font-bold
            tracking-[-0.025em]
            text-[#111111]
            transition-colors
            duration-300
            group-hover:text-[#214D2A]
          "
        >
          {step.title}
        </h3>

        {/* Description */}
        <p
          className="
            mt-1.5
            max-w-[620px]
            text-sm
            leading-6
            text-[#686863]
          "
        >
          {step.description}
        </p>
      </div>
    </div>
  );
}

function BookingCard() {
  const router = useRouter();

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (typeof window !== "undefined") {
          const token = localStorage.getItem("token");
          const role = localStorage.getItem("userRole");
          if (token) {
            router.push(role === "DRIVER" ? "/driver" : "/dashboard");
            return;
          }
        }
        router.push("/onboarding");
      }}
      className="
        w-full
        max-w-[340px]
        justify-self-center
        lg:justify-self-end
        lg:translate-y-16
        rounded-[26px]
        border
        border-black/[0.04]
        bg-white
        p-5
        shadow-[0_1px_2px_rgba(0,0,0,0.04),0_24px_60px_-12px_rgba(33,77,42,0.18)]
      "
    >
      {/* Header */}
      <div className="flex items-center justify-between px-1">
        <h3 className="text-[17px] font-bold tracking-[-0.02em] text-[#111111]">
          Get Moving
        </h3>
        <span className="flex items-center gap-1 rounded-full bg-[#F1F4E6] px-2.5 py-1 text-[11px] font-semibold text-[#214D2A]">
          <Clock3 size={11} strokeWidth={2.5} />
          Now
        </span>
      </div>

      {/* Route box */}
      <div className="relative mt-4 rounded-2xl border border-[#EDEDE8] bg-white">
        {/* Dashed connector */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-[23px] top-[30px] bottom-[30px] border-l-[1.5px] border-dashed border-[#CFCFC8]"
        />

        <label className="flex cursor-text items-center gap-3.5 px-4 py-3">
          <span className="relative z-10 flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full bg-[#2E8B3A] ring-4 ring-[#2E8B3A]/12">
            <span className="h-1.5 w-1.5 rounded-full bg-white" />
          </span>
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="text-[14px] font-semibold leading-5 text-[#111111]">
              Home
            </span>
            <input
              type="text"
              name="pickup"
              defaultValue="MG Road, Bangalore"
              placeholder="Enter pickup location"
              className="w-full bg-transparent text-[12.5px] leading-5 text-[#7A7A75] placeholder:text-[#B0B0AA] outline-none focus:text-[#111111]"
            />
          </span>
        </label>

        <div className="ml-[46px] mr-4 h-px bg-[#EFEFEA]" />

        <label className="flex cursor-text items-center gap-3.5 px-4 py-3">
          <span className="relative z-10 flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full bg-[#E5484D] ring-4 ring-[#E5484D]/12">
            <span className="h-1.5 w-1.5 rounded-full bg-white" />
          </span>
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="text-[14px] font-semibold leading-5 text-[#111111]">
              Office
            </span>
            <input
              type="text"
              name="drop"
              defaultValue="Electronic City"
              placeholder="Enter drop location"
              className="w-full bg-transparent text-[12.5px] leading-5 text-[#7A7A75] placeholder:text-[#B0B0AA] outline-none focus:text-[#111111]"
            />
          </span>
        </label>
      </div>

      {/* CTA */}
      <button
        type="submit"
        className="
          group/btn
          mt-4
          flex
          w-full
          items-center
          justify-center
          gap-2
          rounded-xl
          bg-[#111111]
          py-3
          text-[15px]
          font-semibold
          text-white
          shadow-[0_8px_18px_-6px_rgba(0,0,0,0.45)]
          transition-all
          duration-300
          hover:bg-black
          active:scale-[0.98]
        "
      >
        Find a Ride
        <ArrowRight
          size={16}
          strokeWidth={2.25}
          className="transition-transform duration-300 group-hover/btn:translate-x-0.5"
        />
      </button>
    </form>
  );
}

export default function HowRidezyWorks() {
  return (
    <section
      aria-labelledby="how-ridezy-works-title"
      className="
        relative
        w-full
        overflow-hidden
        bg-[#FFFDF6]
        py-20
        sm:py-24
        lg:py-28
      "
    >
      {/* ==================================================
          SUBTLE BACKGROUND
      =================================================== */}

      <div
        className="
          pointer-events-none
          absolute
          -left-40
          top-10
          h-80
          w-80
          rounded-full
          bg-[#E5E9CA]/30
          blur-3xl
        "
      />

      <div
        className="
          pointer-events-none
          absolute
          -right-40
          bottom-0
          h-96
          w-96
          rounded-full
          bg-[#E5E9CA]/20
          blur-3xl
        "
      />

      {/* ==================================================
          MAIN CONTAINER
          LEFT ALIGNED
      =================================================== */}

      <div
        className="
          relative
          mx-auto
          w-full
          max-w-7xl
          px-6
          sm:px-10
          lg:px-14
          -translate-x-3
          sm:-translate-x-5
          lg:-translate-x-6
        "
      >
        <div
          className="
            grid
            grid-cols-1
            items-center
            gap-14
            lg:grid-cols-[minmax(0,1fr)_400px]
            lg:gap-16
          "
        >
        <div>
        {/* ==================================================
            HEADER
        =================================================== */}

        <div
          className="
            max-w-[720px]
            text-left
          "
        >
        

          {/* Heading */}
          <h2
            id="how-ridezy-works-title"
            className="
              font-caslon
              text-4xl
              sm:text-5xl
              lg:text-6xl
              font-bold
              leading-[0.98]
              tracking-tight
              text-[#111111]
            "
          >
            How{" "}
            <span className="relative inline-block text-[#214D2A]">
              Ridezy
              
              {/* Hand drawn underline */}
              <svg
                className="
                  absolute
                  -bottom-2
                  left-0
                  h-3
                  w-full
                  overflow-visible
                  text-[#6E8F47]
                "
                viewBox="0 0 100 12"
                fill="none"
                preserveAspectRatio="none"
              >
                <path
                  d="M2 8.5C27 2 72 2 98 8"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                />
              </svg>
            </span>{" "}
            Works
          </h2>

          <p
            className="
              mt-5
              max-w-[620px]
              text-sm
              sm:text-base
              leading-7
              text-[#62635F]
            "
          >
            From finding your ride to reaching your destination,
            everything is designed to keep your journey simple.
          </p>
        </div>

        {/* ==================================================
            JOURNEY TIMELINE
        =================================================== */}

        <div
          className="
            relative
            mt-14
            sm:mt-16
            lg:mt-20

            max-w-[850px]
          "
        >
          {/* ----------------------------------------------
              GREEN DOTTED ROUTE
          ----------------------------------------------- */}

          <div
            className="
              pointer-events-none
              absolute
              left-[25px]
              top-[26px]
              bottom-[26px]
              w-[2px]
              border-l-2
              border-dashed
              border-[#214D2A]/30
            "
            aria-hidden="true"
          />

          {/* Slight route glow */}
          <div
            className="
              pointer-events-none
              absolute
              left-[21px]
              top-[26px]
              bottom-[26px]
              w-[10px]
              rounded-full
              bg-[#E5E9CA]/30
              blur-md
            "
          />

          {/* Steps */}
          <div className="relative space-y-12 sm:space-y-14 lg:space-y-16">
            {steps.map((step) => (
              <StepItemRow
                key={step.number}
                step={step}
              />
            ))}
          </div>
        </div>
        </div>

        {/* ==================================================
            BOOKING CARD
        =================================================== */}

        <BookingCard />
        </div>

      </div>
    </section>
  );
}
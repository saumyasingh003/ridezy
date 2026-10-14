"use client";

import React, { useState, useEffect } from "react";
import HowRidezyWorks from "@/components/HowRidezyWorks";
import Testimonials from "@/components/Testimonials";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";

const Page = () => {
  const router = useRouter();
  const [ctaUrl, setCtaUrl] = useState("/onboarding");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const token = localStorage.getItem("token");
      const role = localStorage.getItem("userRole");
      if (token) {
        setCtaUrl(role === "ADMIN" ? "/admin" : role === "DRIVER" ? "/driver" : "/dashboard");
      }
    }
  }, []);

  const handleBookRide = (e: React.MouseEvent) => {
    if (typeof window !== "undefined") {
      const token = localStorage.getItem("token");
      const role = localStorage.getItem("userRole");
      if (token) {
        e.preventDefault();
        router.push(role === "ADMIN" ? "/admin" : role === "DRIVER" ? "/driver" : "/dashboard");
        return;
      }
    }
  };

  return (
    <main className="relative w-full bg-[#FFFDF6]">

      {/* Hero Section */}
      <div className="relative w-full h-[700px] lg:h-[750px] overflow-hidden bg-[#FFFDF6]">
        {/* Background Hero Image */}
        <Image
          src="/home-hero.webp"
          alt="Ridezy"
          fill
          className="object-cover object-right lg:object-center"
          priority
        />

        {/* Overlay with Content on the Left Side */}
        <div className="absolute inset-0 flex items-center z-10 -translate-y-6 sm:-translate-y-10">
          <div className="w-full px-6 sm:px-10 lg:px-14">
            <div className="max-w-xl lg:max-w-2xl text-left">
              {/* Pill Tag */}
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#F3F4E5] text-stone-900 text-sm font-semibold tracking-wide mb-6 shadow-sm">
                <svg
                  className="w-4 h-4 text-black shrink-0"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
                </svg>
                <span>Your City. Your Ride. Your Way.</span>
              </div>

              {/* Heading */}
              <h1 className="font-caslon text-6xl sm:text-7xl md:text-8xl lg:text-[6.2rem] font-bold tracking-tight text-[#111111] leading-[0.98] mb-6">
                Move Freely <br />
                With{" "}
                <span className="relative inline-block text-[#214D2A]">
                  Ridezy
                  <svg
                    className="absolute left-0 -bottom-2 w-full h-3 text-[#6E8F47] overflow-visible"
                    viewBox="0 0 100 12"
                    fill="none"
                    preserveAspectRatio="none"
                  >
                    <path
                      d="M2 9C30 2 70 2 98 8"
                      stroke="currentColor"
                      strokeWidth="3.5"
                      strokeLinecap="round"
                    />
                  </svg>
                </span>
              </h1>

              {/* Subtitle / Paragraph */}
              <p className="text-base sm:text-lg md:text-xl text-slate-600 font-normal leading-relaxed max-w-lg mb-8">
                Fast, safe and affordable rides for your everyday journeys. Bikes, auto,
                and cabs &mdash; all in one app.
              </p>

              {/* CTA Button */}
              <div>
                <Link
                  href={ctaUrl}
                  onClick={handleBookRide}
                  className="inline-block bg-black text-white py-4 px-10 rounded-full text-base sm:text-lg font-semibold cursor-pointer transition-colors duration-200 shadow-xl hover:shadow-2xl hover:-translate-y-0.5"
                >
                  Book Your Ride
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Feature Highlights Bar */}
      <section className="bg-[#FFFDF6] border-t border-[#F2EFE5]/90 py-8 lg:py-10">
        <div className="max-w-7xl mx-auto px-6 sm:px-10 lg:px-14">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 lg:gap-8">
            {/* Quick Rides */}
            <div className="flex items-center gap-3.5 sm:gap-4">
              <div className="w-12 h-12 rounded-full bg-[#E5E9CA] flex items-center justify-center shrink-0 shadow-xs">
                <svg
                  className="w-5 h-5 text-[#2C3B24]"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                </svg>
              </div>
              <div>
                <h3 className="font-caslon text-lg sm:text-xl font-bold text-[#111111] tracking-tight leading-snug">
                  Quick Rides
                </h3>
                <p className="text-xs sm:text-sm text-slate-500 font-normal">
                  Get a ride in minutes
                </p>
              </div>
            </div>

            {/* Safe & Secure */}
            <div className="flex items-center gap-3.5 sm:gap-4">
              <div className="w-12 h-12 rounded-full bg-[#E5E9CA] flex items-center justify-center shrink-0 shadow-xs">
                <svg
                  className="w-5 h-5 text-[#2C3B24]"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-1 16l-4-4 1.41-1.41L11 14.17l6.59-6.59L19 9l-8 8z" />
                </svg>
              </div>
              <div>
                <h3 className="font-caslon text-lg sm:text-xl font-bold text-[#111111] tracking-tight leading-snug">
                  Safe &amp; Secure
                </h3>
                <p className="text-xs sm:text-sm text-slate-500 font-normal">
                  Verified partners
                </p>
              </div>
            </div>

            {/* Affordable */}
            <div className="flex items-center gap-3.5 sm:gap-4">
              <div className="w-12 h-12 rounded-full bg-[#E5E9CA] flex items-center justify-center shrink-0 shadow-xs">
                <span className="text-xl font-bold text-[#2C3B24] leading-none">₹</span>
              </div>
              <div>
                <h3 className="font-caslon text-lg sm:text-xl font-bold text-[#111111] tracking-tight leading-snug">
                  Affordable
                </h3>
                <p className="text-xs sm:text-sm text-slate-500 font-normal">
                  Transparent pricing
                </p>
              </div>
            </div>

            {/* Eco Friendly */}
            <div className="flex items-center gap-3.5 sm:gap-4">
              <div className="w-12 h-12 rounded-full bg-[#E5E9CA] flex items-center justify-center shrink-0 shadow-xs">
                <svg
                  className="w-5 h-5 text-[#2C3B24]"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z" />
                  <path d="M2 21c0-3 1.85-5.36 5.08-6" />
                </svg>
              </div>
              <div>
                <h3 className="font-caslon text-lg sm:text-xl font-bold text-[#111111] tracking-tight leading-snug">
                  Eco Friendly
                </h3>
                <p className="text-xs sm:text-sm text-slate-500 font-normal">
                  Fewer cars, greener cities
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    

      {/* How Ridezy Works Section */}
      <HowRidezyWorks />

        {/* Choose Your Ride Section */}
      <section className="bg-[#FFFDF6]  py-14 sm:py-20 border-t border-[#F2EFE5]/60">
        <div className="max-w-7xl mx-auto px-6 sm:px-10 lg:px-14">
          {/* Section Header */}
          <div className="text-right mb-4 sm:mb-6 flex flex-col items-end">
            <h2 className="text-4xl font-caslon sm:text-5xl lg:text-6xl font-bold text-[#111111] tracking-tight leading-none mb-2">
              Choose Your Ride
            </h2>

            <p className="text-sm sm:text-base text-slate-500 max-w-md leading-relaxed">
              From short city hops to daily commutes — Ridezy has you covered.
            </p>
          </div>

          {/* Full Width Hero2 Image Banner */}
          <div className="relative w-full rounded-3xl -mt-4 sm:-mt-8">
            <Image
              src="/choose-your-ride.webp"
              alt="Ridezy Commute Experience"
              width={2000}
              height={960}
              className="w-full h-auto object-cover"
              priority
            />
          </div>

        </div>
      </section>

      {/* Testimonials */}
      <Testimonials />
    </main>
  );
};

export default Page;
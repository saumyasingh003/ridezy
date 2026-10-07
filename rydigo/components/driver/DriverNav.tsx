"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { ChevronDown, LogOut, User as UserIcon } from "lucide-react";

export default function DriverNav() {
  const router = useRouter();
  const pathname = usePathname();
  const [driverName, setDriverName] = useState("Driver Partner");
  const [driverEmail, setDriverEmail] = useState("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const storedName = localStorage.getItem("userName");
      if (storedName) {
        setDriverName(storedName);
      }
      const storedEmail = localStorage.getItem("userEmail");
      if (storedEmail) {
        setDriverEmail(storedEmail);
      }
    }
  }, []);

  const handleLogout = () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      localStorage.removeItem("userRole");
      localStorage.removeItem("userName");
      localStorage.removeItem("userEmail");
      localStorage.removeItem("userPhone");
    }
    router.replace("/onboarding");
  };

  return (
    <header className="z-30 w-full shrink-0 border-b border-zinc-200 bg-white/95 backdrop-blur-md sticky top-0">
      <nav
        aria-label="Driver Navigation"
        className="flex h-16 w-full items-center justify-between gap-4 px-4 sm:px-6 lg:px-8"
      >
        {/* Left: Logo + Driver Badge */}
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2.5 group" aria-label="Ridezy Driver Portal">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-black text-white shadow-xs group-hover:bg-neutral-800 transition-colors">
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden="true">
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5z" />
              </svg>
            </span>
            <div className="flex flex-col">
              <span className="text-lg font-bold tracking-tight text-black leading-none">
                Ridezy
              </span>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 mt-0.5">
                Driver Portal
              </span>
            </div>
          </Link>
        </div>

        {/* Center: Quick Links (Profile removed, now in profile dropdown) */}
        <div className="hidden md:flex items-center gap-1 font-caslon">
          <Link
            href="/driver"
            className="px-3.5 py-1.5 rounded-lg text-sm font-semibold bg-black text-white shadow-xs transition-colors"
          >
            Dashboard
          </Link>
          <a
            href="#rides"
            className="px-3.5 py-1.5 rounded-lg text-sm font-semibold text-zinc-600 hover:text-black hover:bg-zinc-100 transition-colors"
          >
            Live Rides
          </a>
          <a
            href="#earnings"
            className="px-3.5 py-1.5 rounded-lg text-sm font-semibold text-zinc-600 hover:text-black hover:bg-zinc-100 transition-colors"
          >
            Earnings
          </a>
          <a
            href="#vehicle"
            className="px-3.5 py-1.5 rounded-lg text-sm font-semibold text-zinc-600 hover:text-black hover:bg-zinc-100 transition-colors"
          >
            Vehicle & Docs
          </a>
        </div>

        {/* Right: Profile Dropdown */}
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="relative" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              aria-expanded={isDropdownOpen}
              aria-label="Driver profile menu"
              className="flex items-center gap-2 rounded-full border border-zinc-200 bg-white py-1 pl-1 pr-2.5 transition-colors hover:bg-zinc-50 cursor-pointer shadow-2xs"
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-black text-xs font-bold text-white">
                {driverName.charAt(0).toUpperCase()}
              </span>
              <span className="hidden sm:block text-xs font-semibold text-zinc-800 max-w-[120px] truncate">
                {driverName}
              </span>
              <ChevronDown
                size={14}
                className={`text-zinc-400 shrink-0 transition-transform duration-150 ${
                  isDropdownOpen ? "rotate-180" : ""
                }`}
              />
            </button>

            {isDropdownOpen && (
              <div className="absolute right-0 mt-2 w-56 rounded-xl border border-zinc-200 bg-white p-1.5 shadow-lg z-50 animate-in fade-in zoom-in-95 duration-100 ring-1 ring-black/5">
                {/* Minimal Header */}
                <div className="px-2.5 py-2 border-b border-zinc-100 mb-1">
                  <div className="flex items-center gap-2">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-black text-[11px] font-bold text-white">
                      {driverName.charAt(0).toUpperCase()}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-zinc-900 truncate">
                        {driverName}
                      </p>
                      <p className="text-[10px] text-zinc-400 truncate">
                        {driverEmail || "Driver Partner"}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Minimal Items - No Subheadings */}
                <a
                  href="#profile"
                  onClick={() => setIsDropdownOpen(false)}
                  className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium text-zinc-700 hover:text-black hover:bg-zinc-100 transition-colors cursor-pointer"
                >
                  <UserIcon className="w-3.5 h-3.5 text-zinc-500" />
                  <span>My Profile</span>
                </a>

                {/* Divider */}
                <div className="my-1 border-t border-zinc-100" />

                {/* Logout - No Subheadings */}
                <button
                  type="button"
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium text-red-600 hover:bg-red-50 transition-colors cursor-pointer text-left"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Log out</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </nav>
    </header>
  );
}

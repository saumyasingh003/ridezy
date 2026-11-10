"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import {
  ChevronDown,
  LogOut,
  User as UserIcon,
  LayoutDashboard,
  Navigation,
  Wallet,
  Star,
  FileText,
} from "lucide-react";
import NotificationBell from "@/components/notifications/NotificationBell";
import { API_BASE } from "@/lib/config";

const links = [
  { label: "Dashboard", href: "/driver", icon: LayoutDashboard },
  { label: "Live Rides", href: "/driver/live-rides", icon: Navigation },
  { label: "Earnings", href: "/driver/earnings", icon: Wallet },
  { label: "Reviews", href: "/driver/reviews", icon: Star },
  { label: "Vehicle & Docs", href: "/driver/vehicle-docs", icon: FileText },
];

export default function DriverNav() {
  const router = useRouter();
  const pathname = usePathname();
  const [driverName, setDriverName] = useState("Driver Partner");
  const [driverEmail, setDriverEmail] = useState("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on route change
  useEffect(() => {
    setIsDropdownOpen(false);
  }, [pathname]);

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
    // 1. Initial read from localStorage
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

    // 2. Fetch fresh profile directly from backend
    const fetchProfile = async () => {
      try {
        const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
        if (!token) return;

        const res = await fetch(`${API_BASE}/drivers/profile`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (res.ok) {
          const json = await res.json().catch(() => ({}));
          if (json.success && json.data) {
            if (json.data.name) {
              setDriverName(json.data.name);
              localStorage.setItem("userName", json.data.name);
            }
            if (json.data.email) {
              setDriverEmail(json.data.email);
              localStorage.setItem("userEmail", json.data.email);
            }
          }
        }
      } catch {}
    };

    fetchProfile();

    // 3. Listen for name/profile updates from profile page or dashboard
    const handleProfileUpdate = (e: Event) => {
      const customEvent = e as CustomEvent<{ name?: string; email?: string }>;
      if (customEvent.detail?.name) {
        setDriverName(customEvent.detail.name);
      }
      if (customEvent.detail?.email) {
        setDriverEmail(customEvent.detail.email);
      }
      fetchProfile();
    };

    window.addEventListener("userNameUpdated", handleProfileUpdate);
    window.addEventListener("userProfileUpdated", handleProfileUpdate);
    window.addEventListener("storage", handleProfileUpdate);

    return () => {
      window.removeEventListener("userNameUpdated", handleProfileUpdate);
      window.removeEventListener("userProfileUpdated", handleProfileUpdate);
      window.removeEventListener("storage", handleProfileUpdate);
    };
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
    router.replace("/");
  };

  const initial = driverName.trim() ? driverName.trim().charAt(0).toUpperCase() : "D";
  const firstName = driverName.trim() ? driverName.trim().split(" ")[0] : "Driver";

  return (
    <header className="z-30 w-full shrink-0 border-b border-zinc-200 bg-white/95 backdrop-blur-md sticky top-0">
      <nav
        aria-label="Driver Navigation"
        className="flex h-16 w-full items-center justify-between gap-3 px-3.5 sm:px-6 lg:px-8"
      >
        {/* Left: Logo + Driver Badge */}
        <div className="flex items-center gap-3 shrink-0">
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

        {/* Center: Quick Links (Visible on md+ screens) */}
        <div className="hidden md:flex items-center gap-1 font-caslon">
          {links.map((link) => {
            const active =
              link.href === "/driver"
                ? pathname === "/driver" || pathname === "/driver/dashboard"
                : pathname === link.href || pathname.startsWith(link.href + "/");
            return (
              <Link
                key={link.label}
                href={link.href}
                className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors ${
                  active
                    ? "bg-black text-white shadow-xs"
                    : "text-zinc-600 hover:text-black hover:bg-zinc-100"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </div>

        {/* Right: Notifications + Profile Dropdown */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <NotificationBell />

          <div className="relative" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              aria-expanded={isDropdownOpen}
              aria-label="Driver profile and navigation menu"
              className="flex items-center gap-1.5 sm:gap-2 rounded-full border border-zinc-200 bg-white py-1 pl-1 pr-2 sm:pr-2.5 transition-colors hover:bg-zinc-50 cursor-pointer shadow-2xs"
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-black text-xs font-bold text-white uppercase">
                {initial}
              </span>
              <span className="hidden sm:block text-xs font-semibold text-zinc-800 max-w-[110px] truncate font-caslon">
                {firstName}
              </span>
              <ChevronDown
                size={14}
                className={`text-zinc-400 shrink-0 transition-transform duration-150 ${
                  isDropdownOpen ? "rotate-180" : ""
                }`}
              />
            </button>

            {isDropdownOpen && (
              <div className="absolute right-0 mt-2 w-64 rounded-2xl border border-zinc-200/90 bg-white p-2 shadow-xl z-50 animate-in fade-in zoom-in-95 duration-100 ring-1 ring-black/5">
                {/* Profile Header */}
                <div className="px-2.5 py-2 border-b border-zinc-100 mb-1">
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-black text-xs font-bold text-white uppercase">
                      {initial}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-zinc-900 truncate font-caslon">
                        {driverName}
                      </p>
                      <p className="text-[10px] text-zinc-400 truncate">
                        {driverEmail || "Driver Partner"}
                      </p>
                    </div>
                  </div>
                </div>

                {/* All Navigation Links inside this Dropdown */}
                <div className="py-1 border-b border-zinc-100 max-h-[60vh] overflow-y-auto">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-stone-400 px-2.5 py-1">
                    Navigation
                  </p>
                  <div className="space-y-0.5">
                    {links.map((link) => {
                      const Icon = link.icon;
                      const active =
                        link.href === "/driver"
                          ? pathname === "/driver" || pathname === "/driver/dashboard"
                          : pathname === link.href || pathname.startsWith(link.href + "/");
                      return (
                        <Link
                          key={link.label}
                          href={link.href}
                          onClick={() => setIsDropdownOpen(false)}
                          className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                            active
                              ? "bg-black text-white font-semibold"
                              : "text-zinc-700 hover:bg-zinc-100 hover:text-black"
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <Icon
                              className={`w-3.5 h-3.5 shrink-0 transition-colors ${
                                active ? "text-white" : "text-zinc-500"
                              }`}
                            />
                            <span className="truncate">{link.label}</span>
                          </div>
                          {active && (
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shrink-0" />
                          )}
                        </Link>
                      );
                    })}
                  </div>
                </div>

                {/* Account Section */}
                <div className="py-1 border-b border-zinc-100">
                  <Link
                    href="/driver/profile"
                    onClick={() => setIsDropdownOpen(false)}
                    className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      pathname === "/driver/profile"
                        ? "bg-black text-white font-semibold"
                        : "text-zinc-700 hover:bg-zinc-100 hover:text-black"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <UserIcon
                        className={`w-3.5 h-3.5 shrink-0 ${
                          pathname === "/driver/profile" ? "text-white" : "text-zinc-500"
                        }`}
                      />
                      <span>My Profile</span>
                    </div>
                    {pathname === "/driver/profile" && (
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shrink-0" />
                    )}
                  </Link>
                </div>

                {/* Logout */}
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium text-red-600 hover:bg-red-50 hover:text-red-700 transition-colors cursor-pointer text-left"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Log out</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </nav>
    </header>
  );
}

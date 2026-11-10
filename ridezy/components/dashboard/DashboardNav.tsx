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
  Clock,
  CreditCard,
  Tag,
} from "lucide-react";
import NotificationBell from "@/components/notifications/NotificationBell";

const links = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Current Ride", href: "/dashboard/current-ride", icon: Navigation },
  { label: "History", href: "/dashboard/history", icon: Clock },
  { label: "Payments", href: "/dashboard/payments", icon: CreditCard },
  { label: "Offer", href: "/dashboard/offer", icon: Tag },
];

export default function DashboardNav() {
  const router = useRouter();
  const pathname = usePathname();
  const [userName, setUserName] = useState("User");
  const [userEmail, setUserEmail] = useState("");
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
    const readUserFromStorage = () => {
      if (typeof window !== "undefined") {
        const storedName = localStorage.getItem("userName");
        if (storedName) {
          setUserName(storedName);
        } else {
          const storedUser = localStorage.getItem("user");
          if (storedUser) {
            try {
              const parsed = JSON.parse(storedUser);
              if (parsed.name) setUserName(parsed.name);
            } catch {}
          }
        }
        const storedEmail = localStorage.getItem("userEmail");
        if (storedEmail) {
          setUserEmail(storedEmail);
        } else {
          const storedUser = localStorage.getItem("user");
          if (storedUser) {
            try {
              const parsed = JSON.parse(storedUser);
              if (parsed.email) setUserEmail(parsed.email);
            } catch {}
          }
        }
      }
    };

    readUserFromStorage();

    const handleProfileUpdate = (e: Event) => {
      const customEvent = e as CustomEvent<{ name?: string; email?: string }>;
      if (customEvent.detail?.name) {
        setUserName(customEvent.detail.name);
      }
      if (customEvent.detail?.email) {
        setUserEmail(customEvent.detail.email);
      }
      readUserFromStorage();
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

  const initial = userName.trim() ? userName.trim().charAt(0).toUpperCase() : "U";
  const firstName = userName.trim() ? userName.trim().split(" ")[0] : "User";

  return (
    <header className="z-20 w-full shrink-0 border-b border-[#EDEDE8] bg-white/95 backdrop-blur-md">
      <nav
        aria-label="Passenger Dashboard"
        className="flex h-16 w-full items-center justify-between gap-3 px-3.5 sm:px-6"
      >
        {/* Left: Logo */}
        <Link href="/" className="flex items-center gap-2 shrink-0" aria-label="Ridezy home">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#214D2A] text-white shadow-xs">
            <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="currentColor" aria-hidden="true">
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5z" />
            </svg>
          </span>
          <span className="hidden sm:block text-lg font-bold tracking-[-0.03em] text-[#111111]">
            Ridezy
          </span>
        </Link>

        {/* Center: Navlinks (Visible on md+ screens to prevent mobile overflow) */}
        <ul className="hidden md:flex items-center gap-1 font-caslon">
          {links.map((link) => {
            const active =
              link.href === "/dashboard"
                ? pathname === "/dashboard"
                : pathname === link.href || pathname.startsWith(link.href + "/");
            return (
              <li key={link.label}>
                <Link
                  href={link.href}
                  aria-current={active ? "page" : undefined}
                  className={`
                    block
                    whitespace-nowrap
                    rounded-md
                    px-3
                    py-1.5
                    text-sm
                    font-semibold
                    transition-colors
                    duration-200
                    ${
                      active
                        ? "bg-[#111111] text-white"
                        : "text-[#5A5B55] hover:bg-[#F3F4E5] hover:text-[#214D2A]"
                    }
                  `}
                >
                  {link.label}
                </Link>
              </li>
            );
          })}
        </ul>

        {/* Right: Notifications & Profile Pill with Dropdown containing all Navlinks */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <NotificationBell />

          <div className="relative" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              aria-expanded={isDropdownOpen}
              aria-label="User profile and navigation menu"
              className="flex items-center gap-1.5 sm:gap-2 rounded-full border border-[#EDEDE8] bg-white py-1 pl-1 pr-2 sm:pr-2.5 transition-colors hover:bg-[#F7F7F4] cursor-pointer shadow-2xs"
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#E5E9CA] text-xs font-bold text-[#214D2A] uppercase">
                {initial}
              </span>
              <span className="hidden sm:block text-xs font-semibold text-[#111111] max-w-[110px] truncate font-caslon">
                {firstName}
              </span>
              <ChevronDown
                size={14}
                className={`text-[#8A8A84] shrink-0 transition-transform duration-150 ${
                  isDropdownOpen ? "rotate-180" : ""
                }`}
              />
            </button>

            {isDropdownOpen && (
              <div className="absolute right-0 mt-2 w-64 rounded-2xl border border-zinc-200/90 bg-white p-2 shadow-xl z-50 animate-in fade-in zoom-in-95 duration-100 ring-1 ring-black/5">
                {/* Profile Header */}
                <div className="px-2.5 py-2 border-b border-zinc-100 mb-1">
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#E5E9CA] text-xs font-bold text-[#214D2A] uppercase">
                      {initial}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-zinc-900 truncate font-caslon">
                        {userName}
                      </p>
                      <p className="text-[10px] text-zinc-400 truncate">
                        {userEmail || "Passenger"}
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
                        link.href === "/dashboard"
                          ? pathname === "/dashboard"
                          : pathname === link.href || pathname.startsWith(link.href + "/");
                      return (
                        <Link
                          key={link.label}
                          href={link.href}
                          onClick={() => setIsDropdownOpen(false)}
                          className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                            active
                              ? "bg-[#111111] text-white font-semibold"
                              : "text-stone-700 hover:bg-[#F3F4E5] hover:text-[#214D2A]"
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <Icon
                              className={`w-3.5 h-3.5 shrink-0 transition-colors ${
                                active ? "text-white" : "text-stone-500"
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
                    href="/dashboard/profile"
                    onClick={() => setIsDropdownOpen(false)}
                    className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      pathname === "/dashboard/profile"
                        ? "bg-[#111111] text-white font-semibold"
                        : "text-stone-700 hover:bg-[#F3F4E5] hover:text-[#214D2A]"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <UserIcon
                        className={`w-3.5 h-3.5 shrink-0 ${
                          pathname === "/dashboard/profile" ? "text-white" : "text-stone-500"
                        }`}
                      />
                      <span>My Profile</span>
                    </div>
                    {pathname === "/dashboard/profile" && (
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

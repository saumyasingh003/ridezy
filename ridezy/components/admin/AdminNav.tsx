"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { ChevronDown, LogOut } from "lucide-react";
import NotificationBell from "@/components/notifications/NotificationBell";

const links = [
  { label: "Dashboard", href: "/admin" },
  { label: "Analytics", href: "/admin/analytics" },
  { label: "Customer", href: "/admin/customer" },
  { label: "Driver", href: "/admin/driver" },
  { label: "Rides", href: "/admin/rides" },
  { label: "Payments", href: "/admin/payments" },
  { label: "Rating & Review", href: "/admin/rating-and-review" },
  { label: "Audit Logs", href: "/admin/audit-logs" },
];

export default function AdminNav() {
  const router = useRouter();
  const pathname = usePathname();
  const [adminName, setAdminName] = useState("Saumya Singh");
  const [adminEmail, setAdminEmail] = useState("saumyasingh98982@gmail.com");
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
        setAdminName(storedName);
      } else {
        const storedUser = localStorage.getItem("user");
        if (storedUser) {
          try {
            const parsed = JSON.parse(storedUser);
            if (parsed.name) setAdminName(parsed.name);
          } catch {}
        }
      }
      const storedEmail = localStorage.getItem("userEmail");
      if (storedEmail) {
        setAdminEmail(storedEmail);
      }
    }

    // Name/email come from what login stored; there is no /api/admin/profile endpoint.

    const handleProfileUpdate = (e: Event) => {
      const customEvent = e as CustomEvent<{ name?: string; email?: string }>;
      if (customEvent.detail?.name) {
        setAdminName(customEvent.detail.name);
      }
      if (customEvent.detail?.email) {
        setAdminEmail(customEvent.detail.email);
      }
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

  const initial = adminName.trim() ? adminName.trim().charAt(0).toUpperCase() : "S";
  const firstName = adminName.trim() ? adminName.trim().split(" ")[0] : "Saumya";

  return (
    <header className="z-20 w-full shrink-0 border-b border-[#EDEDE8] bg-white/90 backdrop-blur-md">
      <nav
        aria-label="Admin Dashboard"
        className="flex h-16 w-full items-center justify-between gap-4 px-4 sm:px-6"
      >
        {/* Left: Logo */}
        <Link href="/" className="flex items-center gap-2" aria-label="Ridezy home">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#214D2A] text-white">
            <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="currentColor" aria-hidden="true">
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5z" />
            </svg>
          </span>
          <span className="hidden text-lg font-bold tracking-[-0.03em] text-[#111111] sm:block">
            Ridezy
          </span>
        </Link>

        {/* Center: Navlinks (Exact pic1 style) */}
        <ul className="flex items-center gap-0.5 font-caslon overflow-x-auto sm:gap-1">
          {links.map((link) => {
            const active =
              link.href === "/admin"
                ? pathname === "/admin" || pathname === "/admin/dashboard"
                : pathname.startsWith(link.href);
            return (
              <li key={link.label}>
                <Link
                  href={link.href}
                  aria-current={active ? "page" : undefined}
                  className={`
                    block
                    whitespace-nowrap
                    rounded-sm
                    px-3
                    py-2
                    text-sm
                    font-semibold
                    transition-colors
                    duration-200
                    sm:px-4
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

        {/* Right: Notifications & Profile Pill (Exact pic1 style) */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Notifications (GET /api/notifications) */}
          <NotificationBell />

          {/* Profile pill with dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              aria-expanded={isDropdownOpen}
              aria-label="Admin profile menu"
              className="flex items-center gap-2 rounded-full border border-[#EDEDE8] bg-white py-1 pl-1 pr-2.5 transition-colors hover:bg-[#F7F7F4] cursor-pointer shadow-2xs"
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#E5E9CA] text-xs font-bold text-[#214D2A] uppercase">
                {initial}
              </span>
              <span className="hidden sm:block text-xs font-semibold text-[#111111] max-w-[120px] truncate font-caslon">
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
              <div className="absolute right-0 mt-2 w-56 rounded-xl border border-zinc-200 bg-white p-1.5 shadow-lg z-50 animate-in fade-in zoom-in-95 duration-100 ring-1 ring-black/5">
                {/* Header */}
                <div className="px-2.5 py-2 border-b border-zinc-100 mb-1">
                  <div className="flex items-center gap-2">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#E5E9CA] text-[11px] font-bold text-[#214D2A] uppercase">
                      {initial}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-zinc-900 truncate font-caslon">
                        {adminName}
                      </p>
                      <p className="text-[10px] text-zinc-400 truncate">
                        {adminEmail}
                      </p>
                    </div>
                  </div>
                </div>


                {/* Logout */}
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

"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { ChevronDown, LogOut, User as UserIcon } from "lucide-react";
import NotificationBell from "@/components/notifications/NotificationBell";

const links = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "History", href: "/dashboard/history" },
  { label: "Payments", href: "/dashboard/payments" },
  { label: "Offer", href: "/dashboard/offer" },
];

export default function DashboardNav() {
  const router = useRouter();
  const pathname = usePathname();
  const [userName, setUserName] = useState("User");
  const [userEmail, setUserEmail] = useState("");
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
    router.replace("/");
  };

  const initial = userName.trim() ? userName.trim().charAt(0).toUpperCase() : "U";

  return (
    <header className="z-20 w-full shrink-0 border-b border-[#EDEDE8] bg-white/90 backdrop-blur-md">
      <nav
        aria-label="Dashboard"
        className="flex h-16 w-full items-center justify-between gap-4 px-4 sm:px-6"
      >
        {/* Logo */}
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

        {/* Links */}
        <ul className="flex items-center gap-0.5 font-caslon  overflow-x-auto sm:gap-1">
          {links.map((link) => {
            const active = pathname === link.href;
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

        {/* Right */}
        <div className="flex items-center gap-2 sm:gap-3">
          <NotificationBell />

          <div className="relative" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              aria-expanded={isDropdownOpen}
              aria-label="User profile menu"
              className="flex items-center gap-2 rounded-full border border-[#EDEDE8] bg-white py-1 pl-1 pr-2.5 transition-colors hover:bg-[#F7F7F4] cursor-pointer shadow-2xs"
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#E5E9CA] text-xs font-bold text-[#214D2A] uppercase">
                {initial}
              </span>
              <span className="hidden sm:block text-xs font-semibold text-[#111111] max-w-[120px] truncate font-caslon">
                {userName}
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
                {/* Minimal Header */}
                <div className="px-2.5 py-2 border-b border-zinc-100 mb-1">
                  <div className="flex items-center gap-2">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#E5E9CA] text-[11px] font-bold text-[#214D2A] uppercase">
                      {initial}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-zinc-900 truncate font-caslon">
                        {userName}
                      </p>
                      <p className="text-[10px] text-zinc-400 truncate">
                        {userEmail || "Passenger"}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Minimal Items - No Subheadings */}
                <Link
                  href="/dashboard/profile"
                  onClick={() => setIsDropdownOpen(false)}
                  className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium text-zinc-700 hover:text-black hover:bg-zinc-100 transition-colors"
                >
                  <UserIcon className="w-3.5 h-3.5 text-zinc-500" />
                  <span>My Profile</span>
                </Link>

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

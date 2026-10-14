"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck, Lock, Mail, ArrowRight, AlertCircle, Eye, EyeOff } from "lucide-react";
import { API_BASE } from "@/lib/config";

interface AuthGuardProps {
  children: React.ReactNode;
  allowedRole?: "PASSENGER" | "DRIVER" | "ADMIN";
}


export default function AuthGuard({ children, allowedRole }: AuthGuardProps) {
  const router = useRouter();
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [showAdminLogin, setShowAdminLogin] = useState(false);

  // Admin inline login state
  const [adminEmail, setAdminEmail] = useState("saumyasingh98982@gmail.com");
  const [adminPassword, setAdminPassword] = useState("Admin@12345");
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const token = localStorage.getItem("token");
      const role = localStorage.getItem("userRole");

      if (!token) {
        if (allowedRole === "ADMIN") {
          setShowAdminLogin(true);
          return;
        }
        router.replace("/");
        return;
      }

      if (allowedRole && role && role !== allowedRole) {
        if (allowedRole === "ADMIN") {
          setShowAdminLogin(true);
          return;
        }
        router.replace(role === "ADMIN" ? "/admin" : role === "DRIVER" ? "/driver" : "/dashboard");
        return;
      }

      // Check if user is still valid on the server
      fetch(`${API_BASE}/auth/me`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
        .then((res) => {
          if (res.status === 401 || res.status === 404) {
            localStorage.clear();
            if (allowedRole === "ADMIN") {
              setShowAdminLogin(true);
              return;
            }
            router.replace("/");
            return;
          }
          setIsAuthorized(true);
        })
        .catch(() => {
          // If offline/network error, allow current session
          setIsAuthorized(true);
        });
    }
  }, [router, allowedRole]);

  // localStorage is shared by every tab of this browser. If another tab logs
  // in as someone else (or logs out), this tab would silently start using
  // that account's token. The `storage` event fires only in the *other* tabs,
  // so reload here and let the checks above send us to the right place.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === null || e.key === "token" || e.key === "userRole") {
        window.location.reload();
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // Handle Admin inline authentication
  const handleAdminSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError("");
    setIsLoggingIn(true);

    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: adminEmail.trim(),
          password: adminPassword,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok && data.success && data.data?.token) {
        if (typeof window !== "undefined") {
          localStorage.setItem("token", data.data.token);
          localStorage.setItem("userRole", data.data.user?.role || "ADMIN");
          localStorage.setItem("userName", data.data.user?.name || "Saumya Singh");
          localStorage.setItem("userEmail", data.data.user?.email || adminEmail);
          if (data.data.user) {
            localStorage.setItem("user", JSON.stringify(data.data.user));
          }
        }
        setShowAdminLogin(false);
        setIsAuthorized(true);
      } else {
        setLoginError(data.message || "Invalid credentials. Please verify your email and password.");
      }
    } catch {
      setLoginError("Cannot connect to server. Please ensure the backend is running.");
    } finally {
      setIsLoggingIn(false);
    }
  };

  // If unauthenticated on Admin route, render dedicated Admin Access screen
  if (showAdminLogin && allowedRole === "ADMIN") {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-[#FBFBFA] px-4 py-12">
        <div className="w-full max-w-md rounded-3xl bg-white border border-[#EDEDE8] p-7 sm:p-8 shadow-xl animate-in zoom-in-95">
          <div className="flex items-center gap-3 mb-6">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-black text-white shadow-xs">
              <ShieldCheck className="h-6 w-6 text-emerald-400" />
            </span>
            <div>
              <h2 className="font-caslon text-2xl font-bold text-[#111111] leading-tight">
                Ridezy Admin Access
              </h2>
              <p className="text-xs text-stone-500 mt-0.5">
                Saumya Singh &bull; Platform Administrator
              </p>
            </div>
          </div>

          {loginError && (
            <div className="mb-4 flex items-center gap-2 rounded-xl bg-rose-50 border border-rose-200 p-3 text-xs text-rose-700">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{loginError}</span>
            </div>
          )}

          <form onSubmit={handleAdminSignIn} className="space-y-4">
            {/* Email */}
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-stone-600 mb-1.5">
                Admin Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                <input
                  type="email"
                  required
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-[#EDEDE8] bg-stone-50/50 text-xs sm:text-sm text-stone-900 focus:bg-white focus:outline-hidden focus:border-black transition-colors"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-stone-600 mb-1.5">
                Admin Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-[#EDEDE8] bg-stone-50/50 text-xs sm:text-sm text-stone-900 focus:bg-white focus:outline-hidden focus:border-black transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-black cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoggingIn}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-black hover:bg-neutral-800 text-white font-semibold text-xs sm:text-sm py-3 transition-all cursor-pointer shadow-md active:scale-95 disabled:opacity-50 mt-2"
            >
              {isLoggingIn ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Verifying credentials...</span>
                </>
              ) : (
                <>
                  <span>Enter Admin Dashboard</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <div className="mt-5 text-center">
            <button
              type="button"
              onClick={() => {
                setAdminEmail("saumyasingh98982@gmail.com");
                setAdminPassword("Admin@12345");
              }}
              className="text-[11px] text-stone-500 hover:text-black underline cursor-pointer"
            >
              Reset to Saumya Singh Admin Credentials
            </button>
          </div>
        </div>
      </div>
    );
  }

  // While verifying session
  if (!isAuthorized) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-[#FBFBFA]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-7 w-7 animate-spin rounded-full border-2 border-stone-300 border-t-black" />
          <p className="text-xs font-semibold tracking-wider uppercase text-stone-500">
            Verifying admin session...
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface AuthGuardProps {
  children: React.ReactNode;
  allowedRole?: "PASSENGER" | "DRIVER";
}

export default function AuthGuard({ children, allowedRole }: AuthGuardProps) {
  const router = useRouter();
  const [isAuthorized, setIsAuthorized] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const token = localStorage.getItem("token");
      if (!token) {
        // Not logged in -> block access and redirect to onboarding
        router.replace("/onboarding");
        return;
      }

      const role = localStorage.getItem("userRole");
      if (allowedRole && role && role !== allowedRole) {
        // Wrong role -> send to their designated dashboard
        router.replace(role === "DRIVER" ? "/driver" : "/dashboard");
        return;
      }

      setIsAuthorized(true);
    }
  }, [router, allowedRole]);

  // While verifying, render a minimal loader to prevent unauthorized content flashing
  if (!isAuthorized) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-[#FFFDF6]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-7 w-7 animate-spin rounded-full border-2 border-stone-300 border-t-black" />
          <p className="text-xs font-semibold tracking-wider uppercase text-stone-500">
            Verifying session...
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

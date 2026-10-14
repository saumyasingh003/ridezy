import type { Metadata } from "next";
import DriverNav from "@/components/driver/DriverNav";
import AuthGuard from "@/components/auth/AuthGuard";

export const metadata: Metadata = {
  title: "Driver Dashboard | Ridezy",
  description: "Manage ride requests, track earnings, and view your vehicle status.",
};

export default function DriverLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGuard allowedRole="DRIVER">
      <div className="min-h-screen w-full flex flex-col bg-[#FBFBFA] text-black">
        <DriverNav />
        <main className="flex-1 w-full">{children}</main>
      </div>
    </AuthGuard>
  );
}

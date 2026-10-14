import type { Metadata } from "next";
import AdminNav from "@/components/admin/AdminNav";
import AuthGuard from "@/components/auth/AuthGuard";

export const metadata: Metadata = {
  title: "Admin Dashboard | Ridezy",
  description: "Ridezy Platform Administration & Management Console",
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGuard allowedRole="ADMIN">
      <div className="min-h-screen w-full flex flex-col bg-[#FBFBFA] text-[#111111]">
        <AdminNav />
        <main className="flex-1 w-full px-4 sm:px-6 pt-2 sm:pt-3 pb-8">
          {children}
        </main>
      </div>
    </AuthGuard>
  );
}

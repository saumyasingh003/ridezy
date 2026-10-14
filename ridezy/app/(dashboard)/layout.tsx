import DashboardNav from "@/components/dashboard/DashboardNav";
import AuthGuard from "@/components/auth/AuthGuard";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGuard allowedRole="PASSENGER">
      <div className="flex min-h-screen w-full flex-col bg-white lg:h-screen lg:overflow-hidden">
        <DashboardNav />
        {children}
      </div>
    </AuthGuard>
  );
}

import type { Metadata } from "next";
import PaymentsView from "@/components/dashboard/PaymentsView";

export const metadata: Metadata = {
  title: "Payments | Ridezy",
  description: "Manage your Ridezy wallet, payment methods and transactions.",
};

export default function PaymentsPage() {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto bg-white">
      <PaymentsView />
    </div>
  );
}

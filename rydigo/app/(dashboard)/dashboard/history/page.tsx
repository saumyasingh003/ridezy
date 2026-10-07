import type { Metadata } from "next";
import HistoryView from "@/components/dashboard/HistoryView";

export const metadata: Metadata = {
  title: "Ride History | Ridezy",
  description: "See all your past Ridezy trips and receipts.",
};

export default function HistoryPage() {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto bg-white">
      <HistoryView />
    </div>
  );
}

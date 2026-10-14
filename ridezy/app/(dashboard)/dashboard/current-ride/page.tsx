import type { Metadata } from "next";
import CurrentRideView from "@/components/dashboard/CurrentRideView";

export const metadata: Metadata = {
  title: "Current Ride | Ridezy",
  description: "Track your ride, see driver details and your fare.",
};

// The ride is read from the backend (GET /api/rides/current), not from the URL.
export default function CurrentRidePage() {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto bg-white">
      <CurrentRideView />
    </div>
  );
}

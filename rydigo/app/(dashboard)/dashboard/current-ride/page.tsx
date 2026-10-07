import type { Metadata } from "next";
import CurrentRideView from "@/components/dashboard/CurrentRideView";

export const metadata: Metadata = {
  title: "Current Ride | Ridezy",
  description: "Track your ride, see driver details and pay for your trip.",
};

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

export default async function CurrentRidePage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;

  return (
    <div className="min-h-0 flex-1 overflow-y-auto bg-white">
      <CurrentRideView
        pickup={first(params.pickup)}
        destination={first(params.destination)}
        rideId={first(params.ride)}
      />
    </div>
  );
}

import type { Metadata } from "next";
import RideBooker from "@/components/dashboard/RideBooker";

export const metadata: Metadata = {
  title: "Dashboard | Ridezy",
  description: "Book a ride, see your route and confirm your fare.",
};

export default function DashboardPage() {
  return <RideBooker />;
}

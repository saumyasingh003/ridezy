import type { Metadata } from "next";
import OfferView from "@/components/dashboard/OfferView";

export const metadata: Metadata = {
  title: "Offers | Ridezy",
  description: "Promo codes and deals to save on your Ridezy rides.",
};

export default function OfferPage() {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto bg-white">
      <OfferView />
    </div>
  );
}

import {
  Bike,
  CarFront,
  Truck,
  Crown,
  Home,
  Briefcase,
  type LucideIcon,
} from "lucide-react";

export interface RideOption {
  id: string;
  name: string;
  icon: LucideIcon;
  price: number;
  eta: number;
  seats: number;
}

export interface RecentPlace {
  label: string;
  address: string;
  icon: LucideIcon;
}

export const rideOptions: RideOption[] = [
  { id: "bike", name: "Bike", icon: Bike, price: 84, eta: 3, seats: 1 },
  { id: "auto", name: "Auto", icon: Truck, price: 142, eta: 5, seats: 3 },
  { id: "standard", name: "Standard", icon: CarFront, price: 284, eta: 8, seats: 4 },
  { id: "premium", name: "Premium", icon: Crown, price: 412, eta: 10, seats: 4 },
];

export const recentPlaces: RecentPlace[] = [
  { label: "Home", address: "MG Road, Bangalore", icon: Home },
  { label: "Work", address: "Electronic City Phase 1", icon: Briefcase },

];

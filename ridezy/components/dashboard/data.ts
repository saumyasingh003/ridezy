import {
  Bike,
  CarFront,
  Truck,
  Home,
  Briefcase,
  type LucideIcon,
} from "lucide-react";
import type { VehicleType } from "@/lib/rideApi";

// Fares and durations are NOT stored here: they come from POST /api/rides/estimate.
export interface RideOption {
  id: VehicleType;
  name: string;
  icon: LucideIcon;
  seats: number;
}

export interface RecentPlace {
  label: string;
  address: string;
  icon: LucideIcon;
}

export const rideOptions: RideOption[] = [
  // Matches VEHICLE_TYPES in backend/src/models/Vehicle.ts
  { id: "BIKE", name: "Bike", icon: Bike, seats: 1 },
  { id: "AUTO", name: "Auto", icon: Truck, seats: 3 },
  { id: "CAB", name: "Cab", icon: CarFront, seats: 4 },
];

export function rideOptionFor(vehicleType: string): RideOption {
  return rideOptions.find((r) => r.id === vehicleType) ?? rideOptions[2];
}

export const recentPlaces: RecentPlace[] = [
  { label: "Home", address: "MG Road, Bangalore", icon: Home },
  { label: "Work", address: "Electronic City Phase 1", icon: Briefcase },
];

export interface SavedPlaceItem {
  id?: string;
  _id?: string;
  type?: "HOME" | "WORK" | "OTHER" | string;
  label: string;
  address: string;
  latitude?: number;
  longitude?: number;
  isDefault?: boolean;
}

export const DEFAULT_SAVED_PLACES: SavedPlaceItem[] = [
  {
    id: "sp-1",
    type: "HOME",
    label: "Home",
    address: "Boring Road, Patna",
    latitude: 25.612,
    longitude: 85.115,
    isDefault: true,
  },
  {
    id: "sp-2",
    type: "WORK",
    label: "Work",
    address: "Fraser Road, Patna",
    latitude: 25.608,
    longitude: 85.138,
  },
  {
    id: "sp-3",
    type: "OTHER",
    label: "College",
    address: "Amity University, Patna",
    latitude: 25.594,
    longitude: 85.122,
  },
  {
    id: "sp-4",
    type: "OTHER",
    label: "Gym",
    address: "Kankarbagh, Patna",
    latitude: 25.589,
    longitude: 85.155,
  },
  {
    id: "sp-5",
    type: "OTHER",
    label: "Cafe",
    address: "Rajendra Nagar, Patna",
    latitude: 25.602,
    longitude: 85.161,
  },
];

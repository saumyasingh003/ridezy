import type { VEHICLE_TYPES } from "../models/Vehicle.js";

type VehicleType = (typeof VEHICLE_TYPES)[number];

export interface FareRule {
  baseFare: number; // flat charge for starting a ride (INR)
  perKmRate: number; // INR per km of route distance
  minimumFare: number; // floor for very short rides (INR)
}

export const CURRENCY = "INR";

/**
 * Pricing per vehicle type. Lives in config, never in controllers, and is only
 * read through FareService.getFareRule(), so moving it to an admin-managed
 * database collection later (Step 10) changes one function, not callers.
 */
export const FARE_RULES: Record<VehicleType, FareRule> = {
  BIKE: { baseFare: 20, perKmRate: 8, minimumFare: 30 },
  AUTO: { baseFare: 30, perKmRate: 12, minimumFare: 40 },
  CAB: { baseFare: 50, perKmRate: 16, minimumFare: 80 },
};

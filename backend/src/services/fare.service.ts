import { CURRENCY, FARE_RULES, type FareRule } from "../config/fare.js";
import type { VEHICLE_TYPES } from "../models/Vehicle.js";
import { AppError } from "../utils/AppError.js";

type VehicleType = (typeof VEHICLE_TYPES)[number];

export interface FareEstimate {
  vehicleType: VehicleType;
  distanceKm: number;
  estimatedFare: number;
  currency: string;
  breakdown: { baseFare: number; distanceFare: number; minimumFare: number };
}

/** The only reader of pricing config. Swap this for a DB lookup when Admin manages prices. */
export function getFareRule(vehicleType: VehicleType): FareRule {
  const rule = FARE_RULES[vehicleType];
  if (!rule) throw new AppError(500, "Fare configuration missing.");
  return rule;
}

/** fare = max(minimumFare, baseFare + perKmRate × distanceKm), in whole rupees. */
export function calculateFare({ vehicleType, distanceKm }: { vehicleType: VehicleType; distanceKm: number }): FareEstimate {
  if (!Number.isFinite(distanceKm) || distanceKm < 0) throw new AppError(500, "Fare calculation failed.");

  const { baseFare, perKmRate, minimumFare } = getFareRule(vehicleType);
  const distanceFare = Math.round(perKmRate * distanceKm);
  const estimatedFare = Math.max(minimumFare, baseFare + distanceFare);

  return { vehicleType, distanceKm, estimatedFare, currency: CURRENCY, breakdown: { baseFare, distanceFare, minimumFare } };
}

// Thin client for the backend Rides module (backend/src/services/ride.service.ts).
// Every price, distance and status comes from the server; the UI never
// computes a fare itself.

import { API_BASE } from "./config";

export { API_BASE };

export type VehicleType = "BIKE" | "AUTO" | "CAB";

export type RideStatus =
  | "SEARCHING"
  | "DRIVER_ASSIGNED"
  | "DRIVER_ARRIVING"
  | "DRIVER_ARRIVED"
  | "RIDE_STARTED"
  | "RIDE_COMPLETED"
  | "CANCELLED";

/** A place the user picked: what to show plus where it is. */
export interface Place {
  address: string;
  latitude: number;
  longitude: number;
}

/** POST /api/rides/estimate → data */
export interface RideEstimate {
  vehicleType: VehicleType;
  distanceKm: number;
  durationMinutes: number;
  estimatedFare: number;
  currency: string;
  fareBreakdown: { baseFare: number; distanceFare: number; minimumFare: number };
  routeSource: "OSRM" | "ESTIMATED";
  /** Encoded polyline of the road route (OSRM); null when estimated. */
  routeGeometry?: string | null;
}

/** toRideView() in ride.service.ts */
export interface RideView {
  id: string;
  status: RideStatus;
  pickup: Place;
  destination: Place;
  vehicleType: VehicleType;
  distanceKm: number;
  estimatedDurationMinutes: number;
  estimatedFare: number;
  currency: string;
  routeSource: "OSRM" | "ESTIMATED";
  assignedAt: string | null;
  arrivedAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  /** Set when the ride completes (= estimatedFare, upfront pricing). */
  finalFare: number | null;
  /** Tip offered for the driver (PATCH /rides/:rideId/tip); default tip of the payment. */
  tipAmount?: TipAmount;
  /** Only on RIDE_COMPLETED rides: the score the viewer gave (null = not rated yet). */
  myRating?: number | null;
  /** Only on RIDE_COMPLETED rides: the open payment, or null if unpaid. */
  payment?: ({ id: string; status: PaymentStatus; method: PaymentMethod; amount: number } & Partial<TipFields>) | null;
  /** Passenger only, until the ride starts: read it out to the driver. */
  startOtp?: string | null;
  cancelledAt: string | null;
  cancelledBy: "PASSENGER" | "DRIVER" | "SYSTEM" | null;
  cancellationReason: string | null;
  createdAt: string;
  updatedAt: string;
  driver: {
    name: string;
    profileImage: string | null;
    rating: number | null;
    ratingCount?: number;
    vehicle: {
      vehicleType: VehicleType;
      make: string;
      model: string;
      color?: string;
      registrationNumber: string;
    } | null;
  } | null;
  /** Only for DRIVER / ADMIN viewers */
  passenger?: { name: string };
  /** Only in GET /api/drivers/rides/requests */
  distanceToPickupKm?: number | null;
}

/* --------------------------------- Payments -------------------------------- */

export type PaymentMethod = "CASH" | "UPI" | "CARD";
export type PaymentStatus = "PENDING" | "COMPLETED" | "FAILED" | "REFUNDED";

/** Driver tip choices (₹), as accepted by POST /rides/:rideId/payment. 0 = no tip. */
export const TIP_OPTIONS = [20, 40, 50, 60] as const;
export type TipAmount = 0 | (typeof TIP_OPTIONS)[number];

/** Final Amount = baseFare + tip + taxes + additionalCharges - discount (computed by the backend). */
export interface FareBreakdown {
  baseFare: number;
  tip: number;
  taxes: number;
  additionalCharges: number;
  discount: number;
  total: number;
}

export interface TipFields {
  tipAmount: TipAmount;
  /** Only true once the payment is COMPLETED. */
  tipPaid: boolean;
  breakdown: FareBreakdown;
}

/** payment.service.ts toPaymentView() */
export interface PaymentView extends Partial<TipFields> {
  id: string;
  rideId: string;
  amount: number;
  currency: string;
  method: PaymentMethod;
  status: PaymentStatus;
  provider: "CASH" | "MOCK";
  providerPaymentId: string | null;
  failureReason: string | null;
  paidAt: string | null;
  createdAt: string;
  ride: {
    pickup: string;
    destination: string;
    vehicleType: VehicleType;
    distanceKm: number;
    completedAt: string | null;
  } | null;
  /** Driver / admin viewers only */
  passenger?: { name: string };
  /** Passenger viewers only: who drove, and their rating of this ride (riders rate after paying). */
  driver?: { name: string };
  myRating?: { score: number; comment: string | null } | null;
  canRate?: boolean;
}

/** GET /api/payments/history → data */
export interface PaymentHistory {
  payments: PaymentView[];
  summary: {
    currency: string;
    paidAmount: number;
    paidCount: number;
    /** paidAmount split: fares vs tips (driver earnings). */
    paidFares?: number;
    paidTips?: number;
    pendingAmount: number;
    pendingCount: number;
  };
  pagination: { page: number; limit: number; total: number; pages: number };
}

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = { UPI: "UPI", CARD: "Card", CASH: "Cash" };

/** GET /api/rides/nearby-drivers → data: drivers that matching would really reach. */
export interface NearbyAvailability {
  radiusKm: number;
  /** Backend MATCH_ALL_DRIVERS: every online driver can take any ride. */
  matchAllDrivers: boolean;
  byType: Record<VehicleType, { count: number; etaMinutes: number | null }>;
}

/** GET /api/rides/:rideId/driver → data (passenger only) */
export interface AssignedDriverView {
  rideId: string;
  rideStatus: RideStatus;
  name: string;
  profileImage: string | null;
  rating: number | null;
  vehicle: NonNullable<RideView["driver"]>["vehicle"];
  /** Only while the ride is active; null before assignment / after it ends. */
  location: {
    latitude: number;
    longitude: number;
    lastLocationUpdatedAt: string | null;
    isLocationStale: boolean;
    heading: "PICKUP" | "DESTINATION";
    distanceKm: number;
    etaMinutes: number;
  } | null;
}

/** Google Maps pin at a point (e.g. the driver's live position). */
export function mapPinUrl(latitude: number, longitude: number): string {
  return `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
}

/** Statuses during which the passenger may still cancel (RIDE_TRANSITIONS in models/Ride.ts). */
export const CANCELLABLE_STATUSES: RideStatus[] = [
  "SEARCHING",
  "DRIVER_ASSIGNED",
  "DRIVER_ARRIVING",
  "DRIVER_ARRIVED",
];

export interface ApiResult<T> {
  ok: boolean;
  status: number;
  message: string;
  data: T | null;
}

/** fetch + Bearer token + JSON. A 401 logs the user out, as on the other pages. */
export async function api<T = unknown>(path: string, init?: RequestInit): Promise<ApiResult<T>> {
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...init?.headers,
      },
    });
    if (res.status === 401 && typeof window !== "undefined") {
      localStorage.clear();
      window.location.href = "/";
    }
    const json = await res.json().catch(() => ({}));
    return {
      ok: res.ok && json.success !== false,
      status: res.status,
      message: json.message || (res.ok ? "" : "Something went wrong. Please try again."),
      data: (json.data ?? null) as T | null,
    };
  } catch {
    return { ok: false, status: 0, message: "Can't reach the server. Check your connection.", data: null };
  }
}

export function formatDuration(minutes: number): string {
  const m = Math.max(1, Math.round(minutes));
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)} h ${m % 60} min`;
}

export function formatKm(km: number): string {
  return `${km < 10 ? km.toFixed(1) : Math.round(km)} km`;
}

/** Google Maps directions link to a point (driver navigation). */
export function directionsUrl(place: Place): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${place.latitude},${place.longitude}`;
}

/* --------------------------------- Ratings --------------------------------- */

/** POST/GET /api/rides/:rideId/rating */
export interface RatingView {
  id: string;
  rideId: string;
  fromRole: "PASSENGER" | "DRIVER";
  score: number;
  comment: string | null;
  createdAt: string;
}

/** GET /api/ratings/me → data: ratings the caller received */
export interface ReceivedRatings {
  summary: { average: number | null; count: number; breakdown: Record<"1" | "2" | "3" | "4" | "5", number> };
  reviews: (RatingView & {
    from: { name: string };
    ride: { pickup: string; destination: string; vehicleType: VehicleType; completedAt: string | null } | null;
  })[];
  pagination: { page: number; limit: number; total: number; pages: number };
}

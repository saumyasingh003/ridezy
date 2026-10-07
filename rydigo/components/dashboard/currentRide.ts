// Remembers the last booked ride for this browser tab so the
// "Current Ride" sidebar button can reopen it.

const STORAGE_KEY = "ridezy:current-ride";
const BASE = "/dashboard/current-ride";

export interface BookedRide {
  pickup: string;
  destination: string;
  ride: string;
}

export function currentRideHref(booking: BookedRide) {
  const params = new URLSearchParams({
    pickup: booking.pickup,
    destination: booking.destination,
    ride: booking.ride,
  });
  return `${BASE}?${params.toString()}`;
}

export function saveCurrentRide(booking: BookedRide) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(booking));
  } catch {
    // Storage can be unavailable (private mode etc.) — the URL still carries the ride.
  }
}

export function loadCurrentRideHref() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (raw) return currentRideHref(JSON.parse(raw) as BookedRide);
  } catch {
    // Fall through to the empty "No active ride" page.
  }
  return BASE;
}

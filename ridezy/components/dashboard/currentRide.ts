// Remembers the id of the last booked ride for this browser tab.
// The active ride itself always comes from GET /api/rides/current; the id is
// only used to show how a ride ended (completed / cancelled / timed out) once
// it is no longer "current".

const STORAGE_KEY = "ridezy:last-ride-id";

export const CURRENT_RIDE_HREF = "/dashboard/current-ride";

export function saveLastRideId(rideId: string) {
  try {
    sessionStorage.setItem(STORAGE_KEY, rideId);
  } catch {
    // Storage can be unavailable (private mode etc.); the page still works via /rides/current.
  }
}

export function loadLastRideId(): string | null {
  try {
    return sessionStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function clearLastRideId() {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {}
}

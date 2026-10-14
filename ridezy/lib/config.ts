// Where the backend lives. Set NEXT_PUBLIC_API_URL per environment
// (.env.local for development, the hosting provider's settings in production),
// e.g. https://ridezy-backend.onrender.com/api. NEXT_PUBLIC_ values are built
// into the browser bundle: never put secrets in them.
//
// Falls back to the local backend so `npm run dev` works without any setup.
export const API_BASE = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api").replace(/\/+$/, "");

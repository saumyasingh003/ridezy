# Ridezy Backend

Express 5 + TypeScript + MongoDB Atlas (Mongoose) + Socket.IO.

## Quick start

```bash
cp .env.example .env     # fill in MONGODB_URI, JWT_SECRET, OTP_SECRET
npm install
npm run dev              # http://localhost:5000
```

Without `EMAIL_*` set (development only), emails go to a throwaway Ethereal
inbox and a preview link is logged for each one.

Create the admin account (there is no public endpoint for this):

```bash
# set ADMIN_NAME, ADMIN_EMAIL, ADMIN_PASSWORD in .env, then:
npm run create-admin
# then remove ADMIN_PASSWORD from .env
```

## Auth API

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| POST | `/api/auth/register` | – | Create PASSENGER/DRIVER account, email a 6-digit OTP |
| POST | `/api/auth/verify-email` | – | Verify email with the OTP |
| POST | `/api/auth/resend-otp` | – | New OTP (60s cooldown) |
| POST | `/api/auth/login` | – | Returns a JWT (verified users only) |
| GET | `/api/auth/me` | Bearer token | Current user |
| GET | `/api/health` | – | Liveness + database status |

Profile APIs: `/api/passengers/*` (PASSENGER), `/api/drivers/*` (DRIVER), `/api/admin/*` (ADMIN).
Ride APIs: `/api/rides/*` (estimate, book, current, cancel, accept/reject). Full reference at `/api/docs`.
Import `postman/Ridezy.postman_collection.json` into Postman to try every endpoint.

## Scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` | Start with hot reload (tsx) |
| `npm run build` / `npm start` | Compile to `dist/` and run it |
| `npm run typecheck` | Type check without emitting |
| `npm run lint` | ESLint |
| `npm test` | Tests against an in-memory MongoDB (first run downloads it) |
| `npm run create-admin` | Create the ADMIN user from `ADMIN_*` env vars |

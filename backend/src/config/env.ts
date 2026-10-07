import "dotenv/config";
import { z } from "zod";

// Every setting the app needs, validated once at startup. If anything is
// missing or malformed the process exits immediately instead of failing later
// in the middle of a request.
const envSchema = z
  .object({
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
    PORT: z.coerce.number().int().min(0).max(65535).default(5000),

    MONGODB_URI: z.string().min(1, "MONGODB_URI is required"),

    JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),
    JWT_EXPIRES_IN: z.string().regex(/^\d+[smhd]$/, "JWT_EXPIRES_IN must look like 15m, 12h or 7d").default("7d"),

    // Key for HMAC-hashing OTPs. Kept separate from JWT_SECRET so that leaking
    // one secret doesn't compromise the other feature.
    OTP_SECRET: z.string().min(32, "OTP_SECRET must be at least 32 characters"),

    CORS_ORIGIN: z.string().default("http://localhost:3000"),

    // A driver location older than this is "stale": the driver can't go
    // AVAILABLE with it and is skipped by nearby-driver searches.
    LOCATION_STALE_AFTER_SECONDS: z.coerce.number().int().min(10).max(3600).default(60),
    // Default search radius for nearby-driver discovery.
    NEARBY_SEARCH_RADIUS_METERS: z.coerce.number().int().min(100).max(50_000).default(5000),

    // Routing. "osrm" calls OSRM_BASE_URL; "haversine" is an offline straight-line
    // estimate (used in tests, and as the automatic fallback when OSRM fails).
    ROUTING_PROVIDER: z.enum(["osrm", "haversine"]).default("osrm"),
    OSRM_BASE_URL: z.url().default("https://router.project-osrm.org"),
    ROUTING_TIMEOUT_MS: z.coerce.number().int().min(500).max(30_000).default(5000),

    // Rides & matching
    MAX_RIDE_DISTANCE_KM: z.coerce.number().min(1).max(500).default(100),
    MATCHING_BATCH_SIZE: z.coerce.number().int().min(1).max(10).default(3),
    RIDE_SEARCH_TIMEOUT_SECONDS: z.coerce.number().int().min(30).max(3600).default(300),

    // Optional in development (falls back to an Ethereal test inbox), required in production.
    EMAIL_HOST: z.string().optional(),
    EMAIL_PORT: z.coerce.number().int().positive().optional(),
    EMAIL_USER: z.string().optional(),
    EMAIL_PASSWORD: z.string().optional(),
    EMAIL_FROM: z.string().default("Ridezy <no-reply@ridezy.app>"),
  })
  .superRefine((value, ctx) => {
    if (value.NODE_ENV !== "production") return;
    for (const key of ["EMAIL_HOST", "EMAIL_PORT", "EMAIL_USER", "EMAIL_PASSWORD"] as const) {
      if (!value[key]) {
        ctx.addIssue({ code: "custom", path: [key], message: `${key} is required in production` });
      }
    }
  });

// Treat `KEY=` (empty) in .env the same as not setting KEY at all.
const definedVars = Object.fromEntries(Object.entries(process.env).filter(([, value]) => value !== ""));

const parsed = envSchema.safeParse(definedVars);

if (!parsed.success) {
  const problems = parsed.error.issues.map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`);
  throw new Error(`Invalid environment configuration:\n${problems.join("\n")}`);
}

const raw = parsed.data;

export const env = {
  nodeEnv: raw.NODE_ENV,
  isProduction: raw.NODE_ENV === "production",
  isTest: raw.NODE_ENV === "test",
  port: raw.PORT,
  mongodbUri: raw.MONGODB_URI,
  jwt: {
    secret: raw.JWT_SECRET,
    expiresIn: raw.JWT_EXPIRES_IN as `${number}${"s" | "m" | "h" | "d"}`,
  },
  otpSecret: raw.OTP_SECRET,
  location: {
    staleAfterMs: raw.LOCATION_STALE_AFTER_SECONDS * 1000,
    nearbyRadiusMeters: raw.NEARBY_SEARCH_RADIUS_METERS,
  },
  routing: {
    provider: raw.ROUTING_PROVIDER,
    osrmBaseUrl: raw.OSRM_BASE_URL.replace(/\/+$/, ""),
    timeoutMs: raw.ROUTING_TIMEOUT_MS,
  },
  rides: {
    maxDistanceKm: raw.MAX_RIDE_DISTANCE_KM,
    matchingBatchSize: raw.MATCHING_BATCH_SIZE,
    searchTimeoutMs: raw.RIDE_SEARCH_TIMEOUT_SECONDS * 1000,
  },
  corsOrigins: raw.CORS_ORIGIN.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
  email: {
    host: raw.EMAIL_HOST,
    port: raw.EMAIL_PORT,
    user: raw.EMAIL_USER,
    password: raw.EMAIL_PASSWORD,
    from: raw.EMAIL_FROM,
  },
} as const;

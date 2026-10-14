import "dotenv/config";
import { z } from "zod";

const iceServersSchema = z
  .array(
    z.object({
      urls: z.union([z.string().regex(/^(stun|turns?):/), z.array(z.string().regex(/^(stun|turns?):/)).min(1)]),
      username: z.string().optional(),
      credential: z.string().optional(),
    }),
  )
  .min(1);

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
    // Public URL of the web app, for links in emails. Defaults to the first CORS origin.
    APP_URL: z.url().optional(),

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
    // "true" (temporary default while testing with few drivers): every online,
    // verified driver gets every ride, ignoring vehicle type, distance and
    // location age. "false": strict matching (same type, within the radius,
    // fresh location). Verification and document checks apply either way.
    MATCH_ALL_DRIVERS: z.enum(["true", "false"]).default("true"),

    // Ride chat & calling. ICE servers are handed to browsers for WebRTC:
    // a JSON array of RTCIceServer objects. STUN alone works on most home
    // networks; add a TURN server here for mobile/corporate networks.
    WEBRTC_ICE_SERVERS: z
      .string()
      .default('[{"urls":"stun:stun.l.google.com:19302"}]')
      .transform((value, ctx) => {
        try {
          return iceServersSchema.parse(JSON.parse(value));
        } catch {
          ctx.addIssue({ code: "custom", message: "WEBRTC_ICE_SERVERS must be a JSON array of { urls, username?, credential? }" });
          return z.NEVER;
        }
      }),
    // Unanswered calls end after this; accepted calls that never get audio
    // flowing end after the connect timeout; a dropped socket gets a grace period.
    CALL_RING_TIMEOUT_SECONDS: z.coerce.number().int().min(1).max(120).default(30),
    CALL_CONNECT_TIMEOUT_SECONDS: z.coerce.number().int().min(1).max(120).default(20),
    CALL_RECONNECT_GRACE_SECONDS: z.coerce.number().int().min(1).max(120).default(15),

    // Image storage (Supabase Storage). Without these, images are saved to the
    // local uploads/ folder (development only). The service role key is a
    // server-side secret: never expose it to the browser.
    SUPABASE_URL: z.url().optional(),
    SUPABASE_SERVICE_ROLE_KEY: z.string().min(20).optional(),
    // Public bucket: profile and vehicle photos. Private bucket: driver documents
    // (Aadhaar, licence), only ever served through short-lived signed URLs.
    SUPABASE_PUBLIC_BUCKET: z.string().min(3).default("ridezy-public"),
    SUPABASE_PRIVATE_BUCKET: z.string().min(3).default("ridezy-documents"),

    // Payments. "razorpay" needs the three RAZORPAY_* values; "mock" simulates
    // a gateway (no real money, used by tests). Default: razorpay when keys are set.
    PAYMENT_PROVIDER: z.enum(["razorpay", "mock"]).optional(),
    RAZORPAY_KEY_ID: z.string().regex(/^rzp_(test|live)_/, "RAZORPAY_KEY_ID must start with rzp_test_ or rzp_live_").optional(),
    // Letters and digits only: a stray "=" or quote from copy-pasting makes Razorpay answer 401.
    RAZORPAY_KEY_SECRET: z
      .string()
      .regex(/^[A-Za-z0-9]{10,}$/, "RAZORPAY_KEY_SECRET must be only letters and digits (check for a stray = or quote)")
      .optional(),
    // The secret you type when creating the webhook in the Razorpay dashboard.
    RAZORPAY_WEBHOOK_SECRET: z.string().min(8).optional(),

    // Optional in development (falls back to an Ethereal test inbox), required in production.
    EMAIL_HOST: z.string().optional(),
    EMAIL_PORT: z.coerce.number().int().positive().optional(),
    EMAIL_USER: z.string().optional(),
    EMAIL_PASSWORD: z.string().optional(),
    EMAIL_FROM: z.string().default("Ridezy <no-reply@ridezy.app>"),
  })
  .superRefine((value, ctx) => {
    if (Boolean(value.SUPABASE_URL) !== Boolean(value.SUPABASE_SERVICE_ROLE_KEY)) {
      ctx.addIssue({ code: "custom", path: ["SUPABASE_SERVICE_ROLE_KEY"], message: "Set both SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or neither)" });
    }
    // Production refuses to start half-configured; development falls back to the mock (with a warning below).
    if (value.NODE_ENV === "production" && value.PAYMENT_PROVIDER === "razorpay" && !(value.RAZORPAY_KEY_ID && value.RAZORPAY_KEY_SECRET)) {
      ctx.addIssue({ code: "custom", path: ["RAZORPAY_KEY_SECRET"], message: "PAYMENT_PROVIDER=razorpay needs RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET" });
    }
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

/** Razorpay only when its keys are complete; otherwise the simulated gateway. */
function paymentProvider(): "razorpay" | "mock" {
  const hasKeys = Boolean(raw.RAZORPAY_KEY_ID && raw.RAZORPAY_KEY_SECRET);
  const wanted = raw.PAYMENT_PROVIDER ?? (hasKeys && raw.NODE_ENV !== "test" ? "razorpay" : "mock");
  if (wanted === "razorpay" && !hasKeys) {
    console.warn(
      "[env] PAYMENT_PROVIDER=razorpay but RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET are incomplete: using simulated payments.",
    );
    return "mock";
  }
  return wanted;
}

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
    matchAllDrivers: raw.MATCH_ALL_DRIVERS === "true",
  },
  storage: {
    supabase:
      raw.SUPABASE_URL && raw.SUPABASE_SERVICE_ROLE_KEY
        ? { url: raw.SUPABASE_URL, serviceRoleKey: raw.SUPABASE_SERVICE_ROLE_KEY }
        : null,
    publicBucket: raw.SUPABASE_PUBLIC_BUCKET,
    privateBucket: raw.SUPABASE_PRIVATE_BUCKET,
  },
  payments: {
    provider: paymentProvider(),
    razorpay: {
      keyId: raw.RAZORPAY_KEY_ID ?? "",
      keySecret: raw.RAZORPAY_KEY_SECRET ?? "",
      webhookSecret: raw.RAZORPAY_WEBHOOK_SECRET ?? "",
    },
  },
  communication: {
    iceServers: raw.WEBRTC_ICE_SERVERS,
    ringTimeoutMs: raw.CALL_RING_TIMEOUT_SECONDS * 1000,
    connectTimeoutMs: raw.CALL_CONNECT_TIMEOUT_SECONDS * 1000,
    reconnectGraceMs: raw.CALL_RECONNECT_GRACE_SECONDS * 1000,
  },
  appUrl: (raw.APP_URL ?? raw.CORS_ORIGIN.split(",")[0]?.trim() ?? "http://localhost:3000").replace(/\/+$/, ""),
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

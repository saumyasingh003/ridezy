import { after, afterEach, before, beforeEach, describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import { createServer, type Server as HttpServer } from "node:http";
import type { AddressInfo } from "node:net";
import express from "express";
import jwt from "jsonwebtoken";
import { MongoMemoryServer } from "mongodb-memory-server";

// A real (in-memory) MongoDB, so unique/TTL indexes and atomic updates behave
// exactly like they do on Atlas. Only the email transport is mocked.
const mongod = await MongoMemoryServer.create();

process.env.NODE_ENV = "test";
process.env.PAYMENT_PROVIDER = "mock"; // tests never call real Razorpay
// ...nor real Supabase Storage (empty = unset; images go to the local folder).
process.env.SUPABASE_URL = "";
process.env.SUPABASE_SERVICE_ROLE_KEY = "";
process.env.MONGODB_URI = mongod.getUri("ridezy-test");
process.env.JWT_SECRET = "test-jwt-secret-that-is-at-least-32-characters";
process.env.JWT_EXPIRES_IN = "1h";
process.env.OTP_SECRET = "test-otp-secret-that-is-at-least-32-characters";

const { createApp } = await import("./app.js");
const { connectDB, disconnectDB } = await import("./config/db.js");
const { User } = await import("./models/User.js");
const { EmailVerificationOTP } = await import("./models/EmailVerificationOTP.js");
const { emailService } = await import("./utils/email.js");
const { hashPassword } = await import("./controllers/auth.js");
const { requireAuth } = await import("./middlewares/auth.js");
const { requireRole } = await import("./middlewares/role.js");
const { errorHandler } = await import("./middlewares/error.js");

const PASSWORD = "StrongPassword123";

interface ApiBody {
  success: boolean;
  message?: string;
  errors?: { field: string; message: string }[];
  data?: Record<string, unknown> & { token?: string; user?: Record<string, unknown> };
}

let server: HttpServer;
let baseUrl: string;
// Last OTP "emailed" to each address, captured by the mocked email service.
const outbox = new Map<string, string>();

function listen(app: express.Express): Promise<{ server: HttpServer; url: string }> {
  const srv = createServer(app);
  return new Promise((resolve) =>
    srv.listen(0, () => resolve({ server: srv, url: `http://127.0.0.1:${(srv.address() as AddressInfo).port}` })),
  );
}

async function api(method: string, path: string, body?: unknown, token?: string, url = baseUrl) {
  const res = await fetch(`${url}${path}`, {
    method,
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, body: (await res.json()) as ApiBody };
}

// Each registration gets its own phone number unless one is given.
let phoneSeq = 0;
const nextPhone = () => `+9198765${String(++phoneSeq).padStart(5, "0")}`;

const register = (email: string, role = "PASSENGER", phone = nextPhone()) =>
  api("POST", "/api/auth/register", { name: "Saumya Singh", email, phone, password: PASSWORD, role });

async function registerAndVerify(email: string, role = "PASSENGER"): Promise<void> {
  assert.equal((await register(email, role)).status, 201);
  assert.equal((await api("POST", "/api/auth/verify-email", { email, otp: outbox.get(email) })).status, 200);
}

async function loginToken(email: string): Promise<string> {
  const res = await api("POST", "/api/auth/login", { email, password: PASSWORD });
  assert.equal(res.status, 200);
  return res.body.data!.token!;
}

/** Pretend the current OTP was issued `ms` milliseconds earlier. */
async function ageOtp(email: string, ms: number): Promise<void> {
  const user = await User.findOne({ email });
  const otp = await EmailVerificationOTP.findOne({ userId: user!._id });
  await EmailVerificationOTP.updateOne(
    { _id: otp!._id },
    { $set: { createdAt: new Date(otp!.createdAt.getTime() - ms), expiresAt: new Date(otp!.expiresAt.getTime() - ms) } },
  );
}

before(async () => {
  await connectDB();
  ({ server, url: baseUrl } = await listen(createApp()));
});

beforeEach(() => {
  outbox.clear();
  mock.method(emailService, "sendVerificationEmail", async (to: string, _name: string, otp: string, _minutes: number) => {
    outbox.set(to, otp);
  });
});

afterEach(async () => {
  mock.restoreAll();
  await Promise.all([User.deleteMany({}), EmailVerificationOTP.deleteMany({})]);
});

after(async () => {
  server?.closeAllConnections();
  server?.close();
  await disconnectDB();
  await mongod.stop();
});

describe("POST /api/auth/register", () => {
  it("registers a passenger, hashes the password and OTP, and emails the code", async () => {
    const res = await register("  Saumya@Example.COM ");

    assert.equal(res.status, 201);
    assert.deepEqual(res.body, {
      success: true,
      message: "Registration successful. Verification email sent successfully.",
    });

    const user = await User.findOne({ email: "saumya@example.com" }).select("+password");
    assert.ok(user, "email is stored normalised");
    assert.equal(user.role, "PASSENGER");
    assert.equal(user.isEmailVerified, false);
    assert.notEqual(user.password, PASSWORD);
    assert.match(user.password, /^\$2[aby]\$12\$/, "bcrypt hash with cost 12");

    const otp = outbox.get("saumya@example.com");
    assert.match(otp ?? "", /^\d{6}$/);
    const record = await EmailVerificationOTP.findOne({ userId: user._id });
    assert.ok(record);
    assert.notEqual(record.otpHash, otp, "OTP is not stored in plain text");
    assert.ok(!JSON.stringify(res.body).includes(otp!), "OTP is not in the response");
  });

  it("registers a driver", async () => {
    const res = await register("driver@example.com", "DRIVER");

    assert.equal(res.status, 201);
    assert.equal((await User.findOne({ email: "driver@example.com" }))?.role, "DRIVER");
  });

  it("rejects public ADMIN registration", async () => {
    const res = await register("sneaky@example.com", "ADMIN");

    assert.equal(res.status, 400);
    assert.equal(res.body.errors?.[0]?.field, "role");
    assert.equal(await User.countDocuments(), 0);
  });

  it("ignores extra fields like isEmailVerified (mass assignment)", async () => {
    await api("POST", "/api/auth/register", {
      name: "Sneaky",
      email: "mass@example.com",
      phone: nextPhone(),
      password: PASSWORD,
      role: "PASSENGER",
      isEmailVerified: true,
    });

    assert.equal((await User.findOne({ email: "mass@example.com" }))?.isEmailVerified, false);
  });

  it("rejects a duplicate email regardless of case", async () => {
    await register("dup@example.com");
    const res = await register("DUP@example.com");

    assert.equal(res.status, 409);
    assert.equal(res.body.message, "An account with this email already exists.");
    assert.equal(await User.countDocuments(), 1);
  });

  it("returns clean validation errors", async () => {
    const res = await api("POST", "/api/auth/register", {
      name: " ",
      email: "not-an-email",
      phone: "12345",
      password: "weak",
      role: "PASSENGER",
    });

    assert.equal(res.status, 400);
    assert.equal(res.body.message, "Validation failed.");
    const fields = new Set(res.body.errors?.map((e) => e.field));
    assert.ok(fields.has("name") && fields.has("email") && fields.has("phone") && fields.has("password"));
  });

  it("requires a phone number", async () => {
    const res = await api("POST", "/api/auth/register", {
      name: "No Phone",
      email: "nophone@example.com",
      password: PASSWORD,
      role: "PASSENGER",
    });

    assert.equal(res.status, 400);
    assert.equal(res.body.errors?.[0]?.field, "phone");
  });

  it("stores the phone number in E.164 format", async () => {
    const res = await register("phone@example.com", "PASSENGER", "+91 98765-43210");

    assert.equal(res.status, 201);
    assert.equal((await User.findOne({ email: "phone@example.com" }))?.phone, "+919876543210");
  });

  it("rejects a phone number that is already registered", async () => {
    await register("first@example.com", "PASSENGER", "+919876543210");
    const res = await register("second@example.com", "DRIVER", "+91 98765 43210");

    assert.equal(res.status, 409);
    assert.equal(res.body.message, "An account with this phone number already exists.");
    assert.equal(await User.countDocuments(), 1);
  });
});

describe("POST /api/auth/verify-email", () => {
  it("verifies the email with the correct OTP and burns the OTP", async () => {
    await register("verify@example.com");
    const otp = outbox.get("verify@example.com");

    const res = await api("POST", "/api/auth/verify-email", { email: "verify@example.com", otp });
    assert.equal(res.status, 200);
    assert.equal((await User.findOne({ email: "verify@example.com" }))?.isEmailVerified, true);
    assert.equal((await EmailVerificationOTP.findOne())?.used, true);

    const reuse = await api("POST", "/api/auth/verify-email", { email: "verify@example.com", otp });
    assert.equal(reuse.status, 400);
  });

  it("rejects an invalid OTP and locks after 5 attempts", async () => {
    await register("wrong@example.com");
    const otp = outbox.get("wrong@example.com")!;
    const wrong = otp === "000000" ? "111111" : "000000";

    const res = await api("POST", "/api/auth/verify-email", { email: "wrong@example.com", otp: wrong });
    assert.equal(res.status, 400);
    assert.equal(res.body.message, "Invalid or expired OTP.");

    for (let i = 0; i < 4; i++) {
      await api("POST", "/api/auth/verify-email", { email: "wrong@example.com", otp: wrong });
    }

    // Even the correct code is refused once the attempt limit is reached.
    const locked = await api("POST", "/api/auth/verify-email", { email: "wrong@example.com", otp });
    assert.equal(locked.status, 429);
    assert.equal((await User.findOne({ email: "wrong@example.com" }))?.isEmailVerified, false);
  });

  it("rejects an expired OTP", async () => {
    await register("expired@example.com");
    await ageOtp("expired@example.com", 11 * 60 * 1000);

    const res = await api("POST", "/api/auth/verify-email", {
      email: "expired@example.com",
      otp: outbox.get("expired@example.com"),
    });
    assert.equal(res.status, 400);
    assert.equal(res.body.message, "Invalid or expired OTP.");
  });

  it("gives the same answer for an unknown email", async () => {
    const res = await api("POST", "/api/auth/verify-email", { email: "ghost@example.com", otp: "123456" });

    assert.equal(res.status, 400);
    assert.equal(res.body.message, "Invalid or expired OTP.");
  });

  it("rejects an OTP that isn't exactly 6 digits", async () => {
    const res = await api("POST", "/api/auth/verify-email", { email: "a@example.com", otp: "12345a" });

    assert.equal(res.status, 400);
    assert.equal(res.body.errors?.[0]?.field, "otp");
  });
});

describe("POST /api/auth/resend-otp", () => {
  it("enforces the 60s cooldown, then issues a new OTP that replaces the old one", async () => {
    await register("resend@example.com");
    const firstOtp = outbox.get("resend@example.com")!;

    const tooSoon = await api("POST", "/api/auth/resend-otp", { email: "resend@example.com" });
    assert.equal(tooSoon.status, 429);

    await ageOtp("resend@example.com", 61 * 1000);
    outbox.clear();

    const res = await api("POST", "/api/auth/resend-otp", { email: "resend@example.com" });
    assert.equal(res.status, 200);
    const secondOtp = outbox.get("resend@example.com");
    assert.match(secondOtp ?? "", /^\d{6}$/);
    assert.equal(await EmailVerificationOTP.countDocuments(), 1, "only one active OTP per user");

    if (firstOtp !== secondOtp) {
      const old = await api("POST", "/api/auth/verify-email", { email: "resend@example.com", otp: firstOtp });
      assert.equal(old.status, 400, "previous OTP is invalidated");
    }
    const ok = await api("POST", "/api/auth/verify-email", { email: "resend@example.com", otp: secondOtp });
    assert.equal(ok.status, 200);
  });

  it("returns the same generic response for unknown emails without sending anything", async () => {
    const res = await api("POST", "/api/auth/resend-otp", { email: "nobody@example.com" });

    assert.equal(res.status, 200);
    assert.match(res.body.message ?? "", /If an unverified account exists/);
    assert.equal(outbox.size, 0);
  });
});

describe("POST /api/auth/login", () => {
  it("rejects login before the email is verified", async () => {
    await register("unverified@example.com");
    const res = await api("POST", "/api/auth/login", { email: "unverified@example.com", password: PASSWORD });

    assert.equal(res.status, 403);
    assert.equal(res.body.data, undefined);
  });

  it("logs in a verified user and returns a JWT with userId and role", async () => {
    await registerAndVerify("login@example.com", "DRIVER");
    const res = await api("POST", "/api/auth/login", { email: "LOGIN@example.com", password: PASSWORD });

    assert.equal(res.status, 200);
    const { token, user } = res.body.data!;
    assert.ok(token);
    assert.equal(user?.password, undefined);
    assert.deepEqual(Object.keys(user!).sort(), ["email", "id", "isEmailVerified", "name", "phone", "role"]);

    const payload = jwt.verify(token, process.env.JWT_SECRET!) as jwt.JwtPayload;
    assert.equal(payload.sub, user!.id);
    assert.equal(payload.role, "DRIVER");
  });

  it("rejects a wrong password with the same message as an unknown email", async () => {
    await registerAndVerify("pw@example.com");

    const wrongPassword = await api("POST", "/api/auth/login", { email: "pw@example.com", password: "WrongPassword1" });
    const unknownEmail = await api("POST", "/api/auth/login", { email: "who@example.com", password: PASSWORD });

    assert.equal(wrongPassword.status, 401);
    assert.equal(unknownEmail.status, 401);
    assert.equal(wrongPassword.body.message, unknownEmail.body.message);
  });
});

describe("GET /api/auth/me", () => {
  it("returns the current user without sensitive fields", async () => {
    await registerAndVerify("me@example.com");
    const token = await loginToken("me@example.com");

    const res = await api("GET", "/api/auth/me", undefined, token);
    const stored = (await User.findOne({ email: "me@example.com" }))!;
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.data, {
      id: stored.id,
      name: "Saumya Singh",
      email: "me@example.com",
      phone: stored.phone,
      role: "PASSENGER",
      isEmailVerified: true,
    });
  });

  it("requires a token", async () => {
    const res = await api("GET", "/api/auth/me");
    assert.equal(res.status, 401);
  });

  it("rejects invalid, tampered, expired and alg:none tokens", async () => {
    await registerAndVerify("jwt@example.com");
    const token = await loginToken("jwt@example.com");
    const [header, payload] = token.split(".");
    const userId = (await User.findOne({ email: "jwt@example.com" }))!.id as string;

    const forgedPayload = Buffer.from(JSON.stringify({ sub: userId, role: "ADMIN" })).toString("base64url");
    const badTokens = {
      garbage: "not-a-jwt",
      wrongSecret: jwt.sign({ role: "ADMIN" }, "some-other-secret-that-is-32-chars-long!", { subject: userId }),
      tampered: `${header}.${forgedPayload}.${token.split(".")[2]}`,
      expired: jwt.sign({ role: "PASSENGER", exp: Math.floor(Date.now() / 1000) - 60 }, process.env.JWT_SECRET!, {
        subject: userId,
      }),
      algNone: `${Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url")}.${payload}.`,
    };

    for (const [name, bad] of Object.entries(badTokens)) {
      const res = await api("GET", "/api/auth/me", undefined, bad);
      assert.equal(res.status, 401, `${name} token should be rejected`);
      assert.equal(res.body.message, "Invalid or expired token.");
    }
  });
});

describe("role-based authorization", () => {
  let roleServer: HttpServer;
  let roleUrl: string;

  before(async () => {
    // A throwaway app wired exactly like future /api/admin, /api/driver and /api/passenger routers.
    const app = express();
    app.get("/admin", requireAuth, requireRole("ADMIN"), (_req, res) => void res.json({ success: true }));
    app.get("/driver", requireAuth, requireRole("DRIVER"), (_req, res) => void res.json({ success: true }));
    app.get("/passenger", requireAuth, requireRole("PASSENGER"), (_req, res) => void res.json({ success: true }));
    app.use(errorHandler);
    ({ server: roleServer, url: roleUrl } = await listen(app));
  });

  after(() => {
    roleServer.closeAllConnections();
    roleServer.close();
  });

  it("lets each role into its own area only", async () => {
    await User.create({
      name: "Admin",
      email: "admin@example.com",
      password: await hashPassword(PASSWORD),
      role: "ADMIN",
      isEmailVerified: true,
    });
    await registerAndVerify("p@example.com", "PASSENGER");
    await registerAndVerify("d@example.com", "DRIVER");

    const tokens = {
      ADMIN: await loginToken("admin@example.com"),
      DRIVER: await loginToken("d@example.com"),
      PASSENGER: await loginToken("p@example.com"),
    };

    for (const [role, token] of Object.entries(tokens)) {
      for (const area of ["admin", "driver", "passenger"]) {
        const res = await api("GET", `/${area}`, undefined, token, roleUrl);
        const expected = area.toUpperCase() === role ? 200 : 403;
        assert.equal(res.status, expected, `${role} -> /${area}`);
      }
    }

    assert.equal((await api("GET", "/admin", undefined, undefined, roleUrl)).status, 401);
  });
});

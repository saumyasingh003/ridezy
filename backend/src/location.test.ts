import { after, afterEach, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { createServer, type Server as HttpServer } from "node:http";
import type { AddressInfo } from "node:net";
import { MongoMemoryServer } from "mongodb-memory-server";

const mongod = await MongoMemoryServer.create();

process.env.NODE_ENV = "test";
process.env.MONGODB_URI = mongod.getUri("ridezy-location-test");
process.env.JWT_SECRET = "test-jwt-secret-that-is-at-least-32-characters";
process.env.OTP_SECRET = "test-otp-secret-that-is-at-least-32-characters";
process.env.LOCATION_STALE_AFTER_SECONDS = "60";

const { createApp } = await import("./app.js");
const { connectDB, disconnectDB } = await import("./config/db.js");
const { User } = await import("./models/User.js");
const { DriverProfile } = await import("./models/DriverProfile.js");
const { Vehicle } = await import("./models/Vehicle.js");
const { signAccessToken } = await import("./utils/jwt.js");
const { findNearbyAvailableDrivers } = await import("./services/driverLocation.service.js");

type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
interface ApiResult {
  status: number;
  body: { success: boolean; message: string; data?: Json; errors?: { field: string; message: string }[] };
}

// Patna Junction, and points roughly 1 km / 3 km / 20 km away.
const PATNA = { latitude: 25.5941, longitude: 85.1376 };
const NEAR_1KM = { latitude: 25.6031, longitude: 85.1376 };
const NEAR_3KM = { latitude: 25.6211, longitude: 85.1376 };
const FAR_20KM = { latitude: 25.7741, longitude: 85.1376 };

let server: HttpServer;
let baseUrl: string;

async function api(method: string, path: string, token?: string, body?: unknown): Promise<ApiResult> {
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, body: (await res.json()) as ApiResult["body"] };
}

let seq = 0;
async function makeUser(role: "PASSENGER" | "DRIVER" | "ADMIN") {
  seq += 1;
  const user = await User.create({
    name: `${role} ${seq}`,
    email: `${role.toLowerCase()}${seq}@example.com`,
    password: "not-a-real-hash",
    role,
    isEmailVerified: true,
  });
  return { id: user.id as string, token: signAccessToken({ userId: user.id as string, role }) };
}

/** Driver created directly in the DB in any state we need. */
async function makeDriver(options: {
  verificationStatus?: "PENDING" | "VERIFIED" | "REJECTED";
  availabilityStatus?: "OFFLINE" | "AVAILABLE" | "BUSY";
  vehicleType?: "BIKE" | "AUTO" | "CAB" | null;
  at?: { latitude: number; longitude: number };
  locationAgeSeconds?: number;
} = {}) {
  const { verificationStatus = "VERIFIED", availabilityStatus = "OFFLINE", vehicleType = "BIKE", at, locationAgeSeconds = 0 } =
    options;
  const user = await makeUser("DRIVER");
  const profile = await DriverProfile.create({
    userId: user.id,
    licenseNumber: `BR01DL${String(seq).padStart(6, "0")}`,
    verificationStatus,
    availabilityStatus,
    ...(at
      ? {
          location: { type: "Point", coordinates: [at.longitude, at.latitude] },
          lastLocationUpdatedAt: new Date(Date.now() - locationAgeSeconds * 1000),
        }
      : {}),
  });
  if (vehicleType) {
    await Vehicle.create({
      driverId: profile._id,
      vehicleType,
      make: "Honda",
      model: "Shine",
      year: 2024,
      color: "Black",
      registrationNumber: `BR01AB${String(seq).padStart(4, "0")}`,
    });
  }
  return { ...user, profileId: profile.id as string };
}

before(async () => {
  await connectDB();
  server = createServer(createApp());
  await new Promise<void>((resolve) => server.listen(0, resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterEach(async () => {
  await Promise.all([User.deleteMany({}), DriverProfile.deleteMany({}), Vehicle.deleteMany({})]);
});

after(async () => {
  server.closeAllConnections();
  server.close();
  await disconnectDB();
  await mongod.stop();
});

/* ============================== Location updates =========================== */

describe("PATCH/GET /api/drivers/location", () => {
  it("stores the location as GeoJSON [longitude, latitude] without touching profile updatedAt", async () => {
    const d = await makeDriver();
    const before = (await DriverProfile.findById(d.profileId))!.updatedAt;

    const res = await api("PATCH", "/api/drivers/location", d.token, PATNA);
    assert.equal(res.status, 200);
    assert.equal(res.body.data!.latitude, PATNA.latitude);
    assert.equal(res.body.data!.longitude, PATNA.longitude);

    const stored = (await DriverProfile.findById(d.profileId))!;
    assert.equal(stored.location!.type, "Point");
    assert.deepEqual([...stored.location!.coordinates], [PATNA.longitude, PATNA.latitude], "[lng, lat] order");
    assert.ok(stored.lastLocationUpdatedAt);
    assert.equal(stored.updatedAt.getTime(), before.getTime());
  });

  it("returns the driver's own current location", async () => {
    const d = await makeDriver();
    await api("PATCH", "/api/drivers/location", d.token, PATNA);

    const res = await api("GET", "/api/drivers/location", d.token);
    assert.equal(res.status, 200);
    assert.equal(res.body.data!.latitude, PATNA.latitude);
    assert.equal(res.body.data!.longitude, PATNA.longitude);
    assert.equal(res.body.data!.isLocationStale, false);
    assert.ok(res.body.data!.lastLocationUpdatedAt);
  });

  it("404s when no location was shared", async () => {
    const d = await makeDriver();
    assert.equal((await api("GET", "/api/drivers/location", d.token)).status, 404);
  });

  it("rejects an invalid latitude", async () => {
    const d = await makeDriver();
    const res = await api("PATCH", "/api/drivers/location", d.token, { latitude: 150, longitude: 85 });
    assert.equal(res.status, 400);
    assert.deepEqual(res.body.errors!.map((e) => e.field), ["latitude"]);
  });

  it("rejects an invalid longitude", async () => {
    const d = await makeDriver();
    const res = await api("PATCH", "/api/drivers/location", d.token, { latitude: 25, longitude: 200 });
    assert.equal(res.status, 400);
    assert.deepEqual(res.body.errors!.map((e) => e.field), ["longitude"]);
  });

  it("rejects missing or partial coordinates", async () => {
    const d = await makeDriver();
    const onlyLat = await api("PATCH", "/api/drivers/location", d.token, { latitude: 25.5 });
    assert.equal(onlyLat.status, 400);
    assert.deepEqual(onlyLat.body.errors!.map((e) => e.field), ["longitude"]);

    const empty = await api("PATCH", "/api/drivers/location", d.token, {});
    assert.equal(empty.status, 400);
    assert.deepEqual(empty.body.errors!.map((e) => e.field).sort(), ["latitude", "longitude"]);

    const strings = await api("PATCH", "/api/drivers/location", d.token, { latitude: "25.5", longitude: "85.1" });
    assert.equal(strings.status, 400, "numbers only");
  });

  it("only lets VERIFIED drivers share a location", async () => {
    const pending = await makeDriver({ verificationStatus: "PENDING" });
    const res = await api("PATCH", "/api/drivers/location", pending.token, PATNA);
    assert.equal(res.status, 403);
    assert.equal((await DriverProfile.findById(pending.profileId))!.location, undefined);
  });

  it("ignores ids in the body: a driver can't move another driver", async () => {
    const a = await makeDriver();
    const b = await makeDriver();

    await api("PATCH", "/api/drivers/location", a.token, { ...PATNA, userId: b.id, driverId: b.profileId });

    assert.ok((await DriverProfile.findById(a.profileId))!.location, "A's own location was set");
    assert.equal((await DriverProfile.findById(b.profileId))!.location, undefined, "B untouched");
  });

  it("passengers cannot update or read driver location", async () => {
    const p = await makeUser("PASSENGER");
    assert.equal((await api("PATCH", "/api/drivers/location", p.token, PATNA)).status, 403);
    assert.equal((await api("GET", "/api/drivers/location", p.token)).status, 403);
    assert.equal((await api("PATCH", "/api/drivers/location", undefined, PATNA)).status, 401);
  });
});

/* =============================== Availability ============================== */

describe("PATCH /api/drivers/availability", () => {
  it("a verified driver with a vehicle and fresh location goes AVAILABLE", async () => {
    const d = await makeDriver();
    await api("PATCH", "/api/drivers/location", d.token, PATNA);

    const res = await api("PATCH", "/api/drivers/availability", d.token, { status: "AVAILABLE" });
    assert.equal(res.status, 200);
    assert.equal(res.body.data!.availabilityStatus, "AVAILABLE");

    const again = await api("PATCH", "/api/drivers/availability", d.token, { status: "AVAILABLE" });
    assert.equal(again.status, 200, "repeating is harmless");
  });

  it("going OFFLINE deletes the stored location", async () => {
    const d = await makeDriver();
    await api("PATCH", "/api/drivers/location", d.token, PATNA);
    await api("PATCH", "/api/drivers/availability", d.token, { status: "AVAILABLE" });

    const res = await api("PATCH", "/api/drivers/availability", d.token, { status: "OFFLINE" });
    assert.equal(res.status, 200);
    assert.equal(res.body.data!.availabilityStatus, "OFFLINE");
    assert.equal(res.body.data!.latitude, null);
    assert.equal((await api("GET", "/api/drivers/location", d.token)).status, 404);
  });

  it("an unverified driver cannot go AVAILABLE", async () => {
    for (const verificationStatus of ["PENDING", "REJECTED"] as const) {
      const d = await makeDriver({ verificationStatus, at: PATNA });
      const res = await api("PATCH", "/api/drivers/availability", d.token, { status: "AVAILABLE" });
      assert.equal(res.status, 403, verificationStatus);
      assert.match(res.body.message, new RegExp(verificationStatus));
    }
  });

  it("a driver without a vehicle cannot go AVAILABLE", async () => {
    const d = await makeDriver({ vehicleType: null, at: PATNA });
    const res = await api("PATCH", "/api/drivers/availability", d.token, { status: "AVAILABLE" });
    assert.equal(res.status, 400);
    assert.equal(res.body.message, "Add a vehicle before going online.");
  });

  it("requires a location, and a fresh one", async () => {
    const noLocation = await makeDriver();
    const r1 = await api("PATCH", "/api/drivers/availability", noLocation.token, { status: "AVAILABLE" });
    assert.equal(r1.status, 400);
    assert.match(r1.body.message, /Share your current location/);

    const stale = await makeDriver({ at: PATNA, locationAgeSeconds: 120 });
    const r2 = await api("PATCH", "/api/drivers/availability", stale.token, { status: "AVAILABLE" });
    assert.equal(r2.status, 400);
    assert.match(r2.body.message, /out of date/);
  });

  it("rejects BUSY and invalid statuses; a BUSY driver can't change status", async () => {
    const d = await makeDriver({ availabilityStatus: "BUSY", at: PATNA });
    assert.equal((await api("PATCH", "/api/drivers/availability", d.token, { status: "BUSY" })).status, 400);
    assert.equal((await api("PATCH", "/api/drivers/availability", d.token, { status: "SLEEPING" })).status, 400);
    assert.equal((await api("PATCH", "/api/drivers/availability", d.token, { status: "OFFLINE" })).status, 409);
    assert.equal((await api("PATCH", "/api/drivers/availability", d.token, { status: "AVAILABLE" })).status, 409);
  });

  it("a passenger cannot change driver availability", async () => {
    const p = await makeUser("PASSENGER");
    assert.equal((await api("PATCH", "/api/drivers/availability", p.token, { status: "AVAILABLE" })).status, 403);
  });

  it("changing the vehicle takes an AVAILABLE driver offline (re-verification)", async () => {
    const d = await makeDriver();
    await api("PATCH", "/api/drivers/location", d.token, PATNA);
    await api("PATCH", "/api/drivers/availability", d.token, { status: "AVAILABLE" });

    await api("PATCH", "/api/drivers/vehicle", d.token, { color: "Red" });

    const profile = (await DriverProfile.findById(d.profileId))!;
    assert.equal(profile.verificationStatus, "PENDING");
    assert.equal(profile.availabilityStatus, "OFFLINE");
    assert.equal(profile.location, undefined);
  });
});

/* ============================ Nearby driver search ========================= */

describe("findNearbyAvailableDrivers (service)", () => {
  it("returns only AVAILABLE, VERIFIED, fresh drivers with a vehicle, nearest first", async () => {
    const near = await makeDriver({ availabilityStatus: "AVAILABLE", at: NEAR_1KM });
    const farther = await makeDriver({ availabilityStatus: "AVAILABLE", at: NEAR_3KM, vehicleType: "CAB" });
    await makeDriver({ availabilityStatus: "OFFLINE", at: PATNA }); // offline
    await makeDriver({ availabilityStatus: "AVAILABLE", verificationStatus: "PENDING", at: PATNA }); // unverified
    await makeDriver({ availabilityStatus: "AVAILABLE", at: PATNA, locationAgeSeconds: 300 }); // stale
    await makeDriver({ availabilityStatus: "AVAILABLE", at: PATNA, vehicleType: null }); // no vehicle
    await makeDriver({ availabilityStatus: "BUSY", at: PATNA }); // on a ride
    await makeDriver({ availabilityStatus: "AVAILABLE", at: FAR_20KM }); // outside 5 km

    const result = await findNearbyAvailableDrivers(PATNA);

    assert.deepEqual(result.map((d) => d.driverId), [near.profileId, farther.profileId]);
    assert.ok(result[0]!.distanceMeters > 900 && result[0]!.distanceMeters < 1100, `${result[0]!.distanceMeters} m`);
    assert.ok(result[1]!.distanceMeters > result[0]!.distanceMeters);
    assert.equal(result[1]!.vehicleType, "CAB");
  });

  it("filters by vehicle type and respects radius and limit", async () => {
    await makeDriver({ availabilityStatus: "AVAILABLE", at: NEAR_1KM, vehicleType: "BIKE" });
    const cab = await makeDriver({ availabilityStatus: "AVAILABLE", at: NEAR_3KM, vehicleType: "CAB" });

    assert.deepEqual((await findNearbyAvailableDrivers({ ...PATNA, vehicleType: "CAB" })).map((d) => d.driverId), [
      cab.profileId,
    ]);
    assert.equal((await findNearbyAvailableDrivers({ ...PATNA, radiusMeters: 2000 })).length, 1);
    assert.equal((await findNearbyAvailableDrivers({ ...PATNA, limit: 1 })).length, 1);
    assert.equal((await findNearbyAvailableDrivers({ ...PATNA, radiusMeters: 30_000 })).length, 2);
  });
});

describe("GET /api/admin/drivers/nearby", () => {
  it("is ADMIN-only", async () => {
    const admin = await makeUser("ADMIN");
    const passenger = await makeUser("PASSENGER");
    const driver = await makeDriver();
    await makeDriver({ availabilityStatus: "AVAILABLE", at: NEAR_1KM });
    const q = `?latitude=${PATNA.latitude}&longitude=${PATNA.longitude}`;

    const res = await api("GET", `/api/admin/drivers/nearby${q}`, admin.token);
    assert.equal(res.status, 200);
    assert.equal((res.body.data as unknown as Json[]).length, 1);

    assert.equal((await api("GET", `/api/admin/drivers/nearby${q}`, passenger.token)).status, 403);
    assert.equal((await api("GET", `/api/admin/drivers/nearby${q}`, driver.token)).status, 403);
    assert.equal((await api("GET", "/api/admin/drivers/nearby?latitude=150&longitude=85", admin.token)).status, 400);
  });
});

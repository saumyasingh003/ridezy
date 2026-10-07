import { after, afterEach, before, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { createServer, type Server as HttpServer } from "node:http";
import type { AddressInfo } from "node:net";
import { MongoMemoryReplSet } from "mongodb-memory-server";

// Transactions need a replica set; a single-node one is enough.
const replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });

// Fake OSRM: lets us test the real OSRM code path (and its failures) offline.
let osrmMode: "ok" | "error" | "noroute" = "ok";
const fakeOsrm = createServer((_req, res) => {
  res.setHeader("Content-Type", "application/json");
  if (osrmMode === "error") return void res.writeHead(503).end(JSON.stringify({ code: "Unavailable" }));
  if (osrmMode === "noroute") return void res.writeHead(400).end(JSON.stringify({ code: "NoRoute" }));
  res.end(JSON.stringify({ code: "Ok", routes: [{ distance: 8400, duration: 1440, geometry: "_p~iF~ps|U_ulLnnqC" }] }));
});
await new Promise<void>((resolve) => fakeOsrm.listen(0, resolve));

process.env.NODE_ENV = "test";
process.env.MONGODB_URI = replSet.getUri("ridezy-ride-test");
process.env.JWT_SECRET = "test-jwt-secret-that-is-at-least-32-characters";
process.env.OTP_SECRET = "test-otp-secret-that-is-at-least-32-characters";
process.env.ROUTING_PROVIDER = "osrm";
process.env.OSRM_BASE_URL = `http://127.0.0.1:${(fakeOsrm.address() as AddressInfo).port}`;
process.env.MATCHING_BATCH_SIZE = "3";
process.env.RIDE_SEARCH_TIMEOUT_SECONDS = "300";

const { createApp } = await import("./app.js");
const { connectDB, disconnectDB } = await import("./config/db.js");
const { User } = await import("./models/User.js");
const { DriverProfile } = await import("./models/DriverProfile.js");
const { Vehicle } = await import("./models/Vehicle.js");
const { Ride, canTransition, statusesThatCanBecome } = await import("./models/Ride.js");
const { signAccessToken } = await import("./utils/jwt.js");

type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
interface ApiResult {
  status: number;
  body: { success: boolean; message: string; data?: Json; errors?: { field: string; message: string }[] };
}

const BORING_ROAD = { address: "Boring Road, Patna", latitude: 25.6127, longitude: 85.1589 };
const PATNA_JN = { address: "Patna Junction", latitude: 25.5941, longitude: 85.1376 };
const bikeRide = { pickup: BORING_ROAD, destination: PATNA_JN, vehicleType: "BIKE" };

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

/** A VERIFIED, AVAILABLE driver with a fresh location `kmNorth` of the pickup. */
async function makeDriver({
  vehicleType = "BIKE",
  kmNorth = 1,
  availabilityStatus = "AVAILABLE",
}: { vehicleType?: "BIKE" | "AUTO" | "CAB"; kmNorth?: number; availabilityStatus?: "AVAILABLE" | "OFFLINE" } = {}) {
  const user = await makeUser("DRIVER");
  const profile = await DriverProfile.create({
    userId: user.id,
    licenseNumber: `BR01DL${String(seq).padStart(6, "0")}`,
    verificationStatus: "VERIFIED",
    availabilityStatus,
    location: { type: "Point", coordinates: [BORING_ROAD.longitude, BORING_ROAD.latitude + kmNorth / 111] },
    lastLocationUpdatedAt: new Date(),
  });
  await Vehicle.create({
    driverId: profile._id,
    vehicleType,
    make: "Honda",
    model: "Shine",
    year: 2024,
    color: "Black",
    registrationNumber: `BR01AB${String(seq).padStart(4, "0")}`,
  });
  return { ...user, profileId: profile.id as string };
}

async function book(token: string, body: unknown = bikeRide) {
  const res = await api("POST", "/api/rides", token, body);
  return { ...res, rideId: res.body.data?.id as string };
}

before(async () => {
  await connectDB();
  server = createServer(createApp());
  await new Promise<void>((resolve) => server.listen(0, resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

beforeEach(() => {
  osrmMode = "ok";
});

afterEach(async () => {
  await Promise.all([User.deleteMany({}), DriverProfile.deleteMany({}), Vehicle.deleteMany({}), Ride.deleteMany({})]);
});

after(async () => {
  server.closeAllConnections();
  server.close();
  fakeOsrm.close();
  await disconnectDB();
  await replSet.stop();
});

/* ============================== State machine ============================== */

describe("Ride state machine", () => {
  it("allows only defined transitions", () => {
    assert.equal(canTransition("SEARCHING", "DRIVER_ASSIGNED"), true);
    assert.equal(canTransition("SEARCHING", "CANCELLED"), true);
    assert.equal(canTransition("SEARCHING", "RIDE_COMPLETED"), false);
    assert.equal(canTransition("CANCELLED", "SEARCHING"), false);
    assert.equal(canTransition("RIDE_STARTED", "CANCELLED"), false);
    assert.deepEqual(statusesThatCanBecome("DRIVER_ASSIGNED"), ["SEARCHING"]);
  });
});

/* ================================= Estimate ================================ */

describe("POST /api/rides/estimate", () => {
  it("calculates route and fare on the server", async () => {
    const p = await makeUser("PASSENGER");
    const res = await api("POST", "/api/rides/estimate", p.token, bikeRide);

    assert.equal(res.status, 200);
    const d = res.body.data!;
    assert.equal(d.distanceKm, 8.4);
    assert.equal(d.durationMinutes, 24);
    assert.equal(d.estimatedFare, 87); // max(30, 20 + round(8 × 8.4))
    assert.equal(d.routeSource, "OSRM");
    assert.ok(d.routeGeometry);
    assert.deepEqual(d.pickup, BORING_ROAD);
  });

  it("prices each vehicle type differently", async () => {
    const p = await makeUser("PASSENGER");
    const cab = await api("POST", "/api/rides/estimate", p.token, { ...bikeRide, vehicleType: "CAB" });
    assert.equal(cab.body.data!.estimatedFare, 184); // 50 + round(16 × 8.4)
  });

  it("falls back to a straight-line estimate when routing is down", async () => {
    osrmMode = "error";
    const p = await makeUser("PASSENGER");
    const res = await api("POST", "/api/rides/estimate", p.token, bikeRide);

    assert.equal(res.status, 200);
    assert.equal(res.body.data!.routeSource, "ESTIMATED");
    assert.ok(res.body.data!.distanceKm > 2 && res.body.data!.distanceKm < 6);
  });

  it("returns 422 when no drivable route exists", async () => {
    osrmMode = "noroute";
    const p = await makeUser("PASSENGER");
    assert.equal((await api("POST", "/api/rides/estimate", p.token, bikeRide)).status, 422);
  });

  it("validates locations and vehicle type", async () => {
    const p = await makeUser("PASSENGER");
    const bad = await api("POST", "/api/rides/estimate", p.token, {
      pickup: { ...BORING_ROAD, latitude: 150 },
      vehicleType: "TRUCK",
    });
    assert.equal(bad.status, 400);
    const fields = bad.body.errors!.map((e) => e.field);
    assert.ok(fields.includes("pickup.latitude") && fields.includes("destination") && fields.includes("vehicleType"));

    const same = await api("POST", "/api/rides/estimate", p.token, { ...bikeRide, destination: BORING_ROAD });
    assert.equal(same.status, 400);
    assert.match(same.body.message, /too close/);
  });

  it("is for passengers only", async () => {
    const d = await makeDriver();
    assert.equal((await api("POST", "/api/rides/estimate", d.token, bikeRide)).status, 403);
  });
});

/* ================================= Booking ================================= */

describe("POST /api/rides", () => {
  it("creates a SEARCHING ride with server-side fare, ignoring client-sent prices", async () => {
    const p = await makeUser("PASSENGER");
    const res = await book(p.token, { ...bikeRide, estimatedFare: 10, distanceKm: 1, passengerId: "x" });

    assert.equal(res.status, 201);
    assert.equal(res.body.data!.status, "SEARCHING");
    assert.equal(res.body.data!.estimatedFare, 87);
    assert.equal(res.body.data!.distanceKm, 8.4);
    assert.equal(res.body.data!.offeredDriverIds, undefined, "matching internals hidden from passenger");
    assert.equal(String((await Ride.findById(res.rideId))!.passengerId), p.id);
  });

  it("offers the nearest matching-vehicle drivers only (batch of 3)", async () => {
    const p = await makeUser("PASSENGER");
    const bikes = [await makeDriver({ kmNorth: 0.5 }), await makeDriver({ kmNorth: 1 }), await makeDriver({ kmNorth: 2 })];
    const farBike = await makeDriver({ kmNorth: 3 });
    const auto = await makeDriver({ vehicleType: "AUTO", kmNorth: 0.2 });
    await makeDriver({ kmNorth: 0.1, availabilityStatus: "OFFLINE" });

    const res = await book(p.token);
    assert.equal(res.body.data!.driversContacted, 3);

    const offered = (await Ride.findById(res.rideId))!.offeredDriverIds.map(String).sort();
    assert.deepEqual(offered, bikes.map((b) => b.profileId).sort());
    assert.ok(!offered.includes(auto.profileId), "AUTO driver never offered a BIKE ride");
    assert.ok(!offered.includes(farBike.profileId));
  });

  it("stays SEARCHING and says so when no drivers are available", async () => {
    const p = await makeUser("PASSENGER");
    const res = await book(p.token);

    assert.equal(res.status, 201);
    assert.equal(res.body.data!.status, "SEARCHING");
    assert.equal(res.body.data!.driversContacted, 0);
    assert.equal(res.body.message, "No drivers are currently available. We'll keep searching.");
  });

  it("allows only one active ride per passenger, even for simultaneous bookings", async () => {
    const p = await makeUser("PASSENGER");
    const [a, b] = await Promise.all([book(p.token), book(p.token)]);

    assert.deepEqual([a.status, b.status].sort(), [201, 409]);
    assert.equal(await Ride.countDocuments({ passengerId: p.id }), 1);
    assert.equal((await book(p.token)).status, 409);
  });
});

/* ========================== Driver requests & accept ======================= */

describe("Driver ride requests and acceptance", () => {
  it("only offered drivers see the request", async () => {
    const p = await makeUser("PASSENGER");
    const offered = await makeDriver({ kmNorth: 1 });
    const cab = await makeDriver({ vehicleType: "CAB", kmNorth: 1 });
    await book(p.token);

    const mine = await api("GET", "/api/drivers/rides/requests", offered.token);
    assert.equal(mine.status, 200);
    const requests = mine.body.data as unknown as Json[];
    assert.equal(requests.length, 1);
    assert.equal(requests[0]!.passenger.name, "PASSENGER " + (seq - 2));
    assert.ok(requests[0]!.distanceToPickupKm > 0.9 && requests[0]!.distanceToPickupKm < 1.1);

    assert.equal(((await api("GET", "/api/drivers/rides/requests", cab.token)).body.data as unknown as Json[]).length, 0);
    assert.equal((await api("GET", "/api/drivers/rides/requests", p.token)).status, 403);
  });

  it("accepting assigns the driver and makes them BUSY", async () => {
    const p = await makeUser("PASSENGER");
    const d = await makeDriver();
    const { rideId } = await book(p.token);

    const res = await api("POST", `/api/rides/${rideId}/accept`, d.token);
    assert.equal(res.status, 200);
    assert.equal(res.body.data!.status, "DRIVER_ASSIGNED");
    assert.ok(res.body.data!.assignedAt);

    const ride = (await Ride.findById(rideId))!;
    assert.equal(String(ride.assignedDriverId), d.profileId);
    assert.equal((await DriverProfile.findById(d.profileId))!.availabilityStatus, "BUSY");
  });

  it("RACE: two drivers accept at the same moment, exactly one wins", async () => {
    const p = await makeUser("PASSENGER");
    const a = await makeDriver({ kmNorth: 1 });
    const b = await makeDriver({ kmNorth: 1.2 });
    const { rideId } = await book(p.token);

    const results = await Promise.all([
      api("POST", `/api/rides/${rideId}/accept`, a.token),
      api("POST", `/api/rides/${rideId}/accept`, b.token),
    ]);
    assert.deepEqual(results.map((r) => r.status).sort(), [200, 409]);

    const ride = (await Ride.findById(rideId))!;
    const winner = String(ride.assignedDriverId);
    const loser = winner === a.profileId ? b.profileId : a.profileId;
    assert.equal(ride.status, "DRIVER_ASSIGNED");
    assert.equal((await DriverProfile.findById(winner))!.availabilityStatus, "BUSY");
    assert.equal((await DriverProfile.findById(loser))!.availabilityStatus, "AVAILABLE", "loser rolled back");
  });

  it("RACE: one driver accepting two rides at once gets only one", async () => {
    const p1 = await makeUser("PASSENGER");
    const p2 = await makeUser("PASSENGER");
    const d = await makeDriver();
    const r1 = await book(p1.token);
    const r2 = await book(p2.token);

    const results = await Promise.all([
      api("POST", `/api/rides/${r1.rideId}/accept`, d.token),
      api("POST", `/api/rides/${r2.rideId}/accept`, d.token),
    ]);
    assert.deepEqual(results.map((r) => r.status).sort(), [200, 409]);
    assert.equal(await Ride.countDocuments({ assignedDriverId: d.profileId }), 1);
  });

  it("refuses drivers who weren't offered, aren't available, or the wrong role", async () => {
    const p = await makeUser("PASSENGER");
    await makeDriver();
    const { rideId } = await book(p.token);
    const outsider = await makeDriver({ kmNorth: 1 }); // created after the offer round

    assert.equal((await api("POST", `/api/rides/${rideId}/accept`, outsider.token)).status, 404);
    assert.equal((await api("POST", `/api/rides/${rideId}/accept`, p.token)).status, 403);
    assert.equal((await api("POST", "/api/rides/not-an-id/accept", outsider.token)).status, 400);
  });

  it("an offered driver who went OFFLINE can't accept", async () => {
    const p = await makeUser("PASSENGER");
    const d = await makeDriver();
    const { rideId } = await book(p.token);
    await DriverProfile.updateOne({ _id: d.profileId }, { availabilityStatus: "OFFLINE" });

    const res = await api("POST", `/api/rides/${rideId}/accept`, d.token);
    assert.equal(res.status, 409);
    assert.equal((await Ride.findById(rideId))!.status, "SEARCHING");
  });

  it("rejecting keeps the ride SEARCHING and offers the next driver", async () => {
    const p = await makeUser("PASSENGER");
    const near = [await makeDriver({ kmNorth: 0.5 }), await makeDriver({ kmNorth: 0.6 }), await makeDriver({ kmNorth: 0.7 })];
    const next = await makeDriver({ kmNorth: 2 });
    const { rideId } = await book(p.token);

    for (const d of near) {
      const res = await api("POST", `/api/rides/${rideId}/reject`, d.token);
      assert.equal(res.status, 200);
      assert.equal((await DriverProfile.findById(d.profileId))!.availabilityStatus, "AVAILABLE");
    }

    const ride = (await Ride.findById(rideId))!;
    assert.equal(ride.status, "SEARCHING");
    assert.deepEqual(ride.offeredDriverIds.map(String), [next.profileId]);
    assert.equal(ride.rejectedDriverIds.length, 3);
    assert.equal(((await api("GET", "/api/drivers/rides/requests", near[0]!.token)).body.data as unknown as Json[]).length, 0);
    assert.equal((await api("POST", `/api/rides/${rideId}/reject`, near[0]!.token)).status, 404, "can't reject twice");
  });
});

/* ============================= Reading rides =============================== */

describe("GET /api/rides/:rideId and /current", () => {
  it("shows the passenger their ride with public driver info only", async () => {
    const p = await makeUser("PASSENGER");
    const d = await makeDriver();
    const { rideId } = await book(p.token);
    await api("POST", `/api/rides/${rideId}/accept`, d.token);

    const res = await api("GET", `/api/rides/${rideId}`, p.token);
    assert.equal(res.status, 200);
    const driver = res.body.data!.driver;
    assert.equal(driver.vehicle.registrationNumber.startsWith("BR01AB"), true);
    assert.equal(driver.vehicle.model, "Shine");
    assert.equal(driver.phone, undefined);
    assert.equal(driver.licenseNumber, undefined);
    assert.equal(driver.location, undefined, "no live location in Step 4");
  });

  it("hides other people's rides (404)", async () => {
    const owner = await makeUser("PASSENGER");
    const other = await makeUser("PASSENGER");
    const stranger = await makeDriver();
    const { rideId } = await book(owner.token);
    await DriverProfile.updateOne({ _id: stranger.profileId }, { availabilityStatus: "OFFLINE" });

    assert.equal((await api("GET", `/api/rides/${rideId}`, other.token)).status, 404);
    const admin = await makeUser("ADMIN");
    const adminView = await api("GET", `/api/rides/${rideId}`, admin.token);
    assert.equal(adminView.status, 200);
    assert.ok(adminView.body.data!.matching, "admin sees matching details");
  });

  it("returns the current ride for passenger and assigned driver", async () => {
    const p = await makeUser("PASSENGER");
    const d = await makeDriver();
    assert.equal((await api("GET", "/api/rides/current", p.token)).status, 404);

    const { rideId } = await book(p.token);
    assert.equal((await api("GET", "/api/rides/current", p.token)).body.data!.id, rideId);

    await api("POST", `/api/rides/${rideId}/accept`, d.token);
    const driverCurrent = await api("GET", "/api/rides/current", d.token);
    assert.equal(driverCurrent.body.data!.id, rideId);
    assert.ok(driverCurrent.body.data!.passenger.name);
  });

  it("times out a search: ride becomes CANCELLED by SYSTEM and the passenger can rebook", async () => {
    const p = await makeUser("PASSENGER");
    const { rideId } = await book(p.token);
    // createdAt is immutable in Mongoose; age it with the raw driver.
    await Ride.collection.updateOne({ _id: new (await import("mongoose")).Types.ObjectId(rideId) }, {
      $set: { createdAt: new Date(Date.now() - 301_000) },
    });

    assert.equal((await api("GET", "/api/rides/current", p.token)).status, 404);
    const ride = (await Ride.findById(rideId))!;
    assert.equal(ride.status, "CANCELLED");
    assert.equal(ride.cancelledBy, "SYSTEM");
    assert.equal((await book(p.token)).status, 201);
  });
});

/* ================================= Cancel ================================== */

describe("PATCH /api/rides/:rideId/cancel", () => {
  it("cancels a searching ride with a reason, once", async () => {
    const p = await makeUser("PASSENGER");
    const { rideId } = await book(p.token);

    const res = await api("PATCH", `/api/rides/${rideId}/cancel`, p.token, { reason: "Changed my plans" });
    assert.equal(res.status, 200);
    assert.equal(res.body.data!.status, "CANCELLED");
    assert.equal(res.body.data!.cancelledBy, "PASSENGER");
    assert.equal(res.body.data!.cancellationReason, "Changed my plans");

    assert.equal((await api("PATCH", `/api/rides/${rideId}/cancel`, p.token, {})).status, 409);
    assert.equal((await book(p.token)).status, 201, "can book again");
  });

  it("cancelling after assignment frees the driver", async () => {
    const p = await makeUser("PASSENGER");
    const d = await makeDriver();
    const { rideId } = await book(p.token);
    await api("POST", `/api/rides/${rideId}/accept`, d.token);

    assert.equal((await api("PATCH", `/api/rides/${rideId}/cancel`, p.token, {})).status, 200);
    assert.equal((await DriverProfile.findById(d.profileId))!.availabilityStatus, "AVAILABLE");
  });

  it("only the owner can cancel; accepting a cancelled ride fails", async () => {
    const p = await makeUser("PASSENGER");
    const other = await makeUser("PASSENGER");
    const d = await makeDriver();
    const { rideId } = await book(p.token);

    assert.equal((await api("PATCH", `/api/rides/${rideId}/cancel`, other.token, {})).status, 404);
    await api("PATCH", `/api/rides/${rideId}/cancel`, p.token, {});
    assert.equal((await api("POST", `/api/rides/${rideId}/accept`, d.token)).status, 409);
  });
});

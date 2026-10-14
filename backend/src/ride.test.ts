import { after, afterEach, before, beforeEach, describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import { createServer, type Server as HttpServer } from "node:http";
import type { AddressInfo } from "node:net";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { createHmac } from "node:crypto";
import type { PaymentReceiptEmail as ReceiptEmail } from "./utils/email.js";

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
process.env.PAYMENT_PROVIDER = "mock"; // tests never call real Razorpay
// ...nor real Supabase Storage (empty = unset; images go to the local folder).
process.env.SUPABASE_URL = "";
process.env.SUPABASE_SERVICE_ROLE_KEY = "";
process.env.MATCH_ALL_DRIVERS = "false"; // strict matching rules are what these tests check
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
const { DriverDocument } = await import("./models/DriverDocument.js");
const { Ride, canTransition, statusesThatCanBecome } = await import("./models/Ride.js");
const { signAccessToken } = await import("./utils/jwt.js");
const { env } = await import("./config/env.js");
const { Payment } = await import("./models/Payment.js");
const { Rating } = await import("./models/Rating.js");
const { Notification } = await import("./models/Notification.js");
type NotificationType = import("./models/Notification.js").NotificationType;
const { mockGateway, setPaymentGateway, createRazorpayGateway } = await import("./services/paymentGateway.js");
const { emailService } = await import("./utils/email.js");

// Receipt emails are captured, never sent.
const sentReceipts: { to: string; receipt: ReceiptEmail }[] = [];
mock.method(emailService, "sendPaymentReceiptEmail", async (to: string, receipt: ReceiptEmail) => {
  sentReceipts.push({ to, receipt });
});

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
  documentStatus = "VERIFIED",
}: {
  vehicleType?: "BIKE" | "AUTO" | "CAB";
  kmNorth?: number;
  availabilityStatus?: "AVAILABLE" | "OFFLINE";
  documentStatus?: "PENDING" | "VERIFIED" | "REJECTED";
} = {}) {
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
  await DriverDocument.create(
    (["AADHAAR", "DRIVING_LICENSE"] as const).map((documentType) => ({
      driverId: profile._id,
      documentType,
      documentNumber: documentType === "AADHAAR" ? "234567890123" : `BR01DL${String(seq).padStart(8, "0")}`,
      documentUrl: "https://example.com/doc.png",
      verificationStatus: documentStatus,
    })),
  );
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
  await Promise.all([
    User.deleteMany({}),
    DriverProfile.deleteMany({}),
    Vehicle.deleteMany({}),
    Ride.deleteMany({}),
    DriverDocument.deleteMany({}),
    Payment.deleteMany({}),
    Rating.deleteMany({}),
    Notification.deleteMany({}),
  ]);
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
    assert.equal(res.body.message, "No bike drivers within 5 km right now. We'll keep searching.");
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

/* ============================== Trip lifecycle ============================= */

/** Books a ride and has a fresh driver accept it. */
async function assignedRide() {
  const p = await makeUser("PASSENGER");
  const d = await makeDriver();
  const { rideId } = await book(p.token);
  await api("POST", `/api/rides/${rideId}/accept`, d.token);
  return { p, d, rideId };
}

describe("Trip lifecycle: arrive → start (OTP) → complete", () => {
  it("runs the full trip and frees the driver at the end", async () => {
    const { p, d, rideId } = await assignedRide();

    // Passenger sees a 4-digit OTP; the driver never does.
    const passengerView = await api("GET", `/api/rides/${rideId}`, p.token);
    const otp = passengerView.body.data!.startOtp as string;
    assert.match(otp, /^\d{4}$/);
    assert.equal((await api("GET", `/api/rides/${rideId}`, d.token)).body.data!.startOtp, undefined);

    const arrived = await api("POST", `/api/rides/${rideId}/arrive`, d.token);
    assert.equal(arrived.status, 200);
    assert.equal(arrived.body.data!.status, "DRIVER_ARRIVED");
    assert.ok(arrived.body.data!.arrivedAt);

    const started = await api("POST", `/api/rides/${rideId}/start`, d.token, { otp });
    assert.equal(started.status, 200);
    assert.equal(started.body.data!.status, "RIDE_STARTED");
    // OTP is gone once used.
    assert.equal((await api("GET", `/api/rides/${rideId}`, p.token)).body.data!.startOtp, undefined);

    const completed = await api("POST", `/api/rides/${rideId}/complete`, d.token);
    assert.equal(completed.status, 200);
    assert.equal(completed.body.data!.status, "RIDE_COMPLETED");
    assert.equal(completed.body.data!.finalFare, completed.body.data!.estimatedFare);
    assert.ok(completed.body.data!.completedAt);

    assert.equal((await DriverProfile.findById(d.profileId))!.availabilityStatus, "AVAILABLE");
    // Neither side has an active ride any more; the passenger can book again.
    assert.equal((await api("GET", "/api/rides/current", p.token)).status, 404);
    assert.equal((await api("GET", "/api/rides/current", d.token)).status, 404);
    assert.equal((await book(p.token)).status, 201);
  });

  it("enforces the order of steps", async () => {
    const { d, rideId } = await assignedRide();
    const otp = (await Ride.findById(rideId))!.startOtp!;

    assert.equal((await api("POST", `/api/rides/${rideId}/start`, d.token, { otp })).status, 409); // not arrived
    assert.equal((await api("POST", `/api/rides/${rideId}/complete`, d.token)).status, 409); // not started
    await api("POST", `/api/rides/${rideId}/arrive`, d.token);
    assert.equal((await api("POST", `/api/rides/${rideId}/arrive`, d.token)).status, 409); // twice
  });

  it("rejects wrong OTPs and locks after 5 attempts", async () => {
    const { d, rideId } = await assignedRide();
    await api("POST", `/api/rides/${rideId}/arrive`, d.token);
    const otp = (await Ride.findById(rideId))!.startOtp!;
    const wrong = otp === "0000" ? "1111" : "0000";

    assert.equal((await api("POST", `/api/rides/${rideId}/start`, d.token, { otp: "12" })).status, 400); // format
    for (let i = 0; i < 5; i++) {
      assert.equal((await api("POST", `/api/rides/${rideId}/start`, d.token, { otp: wrong })).status, 400);
    }
    // Even the right code is refused now.
    assert.equal((await api("POST", `/api/rides/${rideId}/start`, d.token, { otp })).status, 429);
    assert.equal((await Ride.findById(rideId))!.status, "DRIVER_ARRIVED");
  });

  it("only the assigned driver can move the ride (others get 404)", async () => {
    const { p, rideId } = await assignedRide();
    const stranger = await makeDriver({ kmNorth: 2 });

    assert.equal((await api("POST", `/api/rides/${rideId}/arrive`, stranger.token)).status, 404);
    assert.equal((await api("POST", `/api/rides/${rideId}/arrive`, p.token)).status, 403); // wrong role
  });

  it("RACE: passenger cancels while the driver arrives: exactly one wins", async () => {
    const { p, d, rideId } = await assignedRide();

    const [cancel, arrive] = await Promise.all([
      api("PATCH", `/api/rides/${rideId}/cancel`, p.token, {}),
      api("POST", `/api/rides/${rideId}/arrive`, d.token),
    ]);
    const ride = (await Ride.findById(rideId))!;
    if (ride.status === "CANCELLED") {
      assert.equal(cancel.status, 200);
      assert.equal(arrive.status, 409);
    } else {
      // Arrived first; cancelling is still allowed after arrival.
      assert.equal(arrive.status, 200);
      assert.equal(cancel.status, 200);
    }
  });

  it("a started ride can't be cancelled", async () => {
    const { p, d, rideId } = await assignedRide();
    await api("POST", `/api/rides/${rideId}/arrive`, d.token);
    const otp = (await Ride.findById(rideId))!.startOtp!;
    await api("POST", `/api/rides/${rideId}/start`, d.token, { otp });

    assert.equal((await api("PATCH", `/api/rides/${rideId}/cancel`, p.token, {})).status, 409);
  });
});

describe("GET /api/rides/history", () => {
  it("lists my rides newest first with pagination and a status filter", async () => {
    const { p, d, rideId } = await assignedRide();
    await api("PATCH", `/api/rides/${rideId}/cancel`, p.token, {});
    const { rideId: second } = await book(p.token);

    const all = await api("GET", "/api/rides/history?limit=1", p.token);
    assert.equal(all.status, 200);
    assert.equal(all.body.data!.rides.length, 1);
    assert.equal(all.body.data!.rides[0].id, second);
    assert.deepEqual(all.body.data!.pagination, { page: 1, limit: 1, total: 2, pages: 2 });

    const cancelled = await api("GET", "/api/rides/history?status=CANCELLED", p.token);
    assert.deepEqual(
      cancelled.body.data!.rides.map((r: Json) => r.id),
      [rideId],
    );

    // The driver sees only rides assigned to them, with the passenger's name.
    const driverHistory = await api("GET", "/api/rides/history", d.token);
    assert.equal(driverHistory.body.data!.pagination.total, 1);
    assert.ok(driverHistory.body.data!.rides[0].passenger.name);
  });

  it("never shows other passengers' rides and validates the query", async () => {
    const { p } = await assignedRide();
    const other = await makeUser("PASSENGER");

    assert.equal((await api("GET", "/api/rides/history", other.token)).body.data!.pagination.total, 0);
    assert.equal((await api("GET", "/api/rides/history?status=FLYING", p.token)).status, 400);
    assert.equal((await api("GET", "/api/rides/history?limit=500", p.token)).status, 400);
  });
});

describe("Drivers with unverified documents never see rides", () => {
  it("are not offered rides, see no requests and can't accept", async () => {
    const p = await makeUser("PASSENGER");
    const pending = await makeDriver({ documentStatus: "PENDING" });
    const good = await makeDriver({ kmNorth: 2 });
    const { rideId } = await book(p.token);

    const ride = (await Ride.findById(rideId))!;
    assert.deepEqual(ride.offeredDriverIds.map(String), [good.profileId]); // nearer driver skipped

    assert.deepEqual((await api("GET", "/api/drivers/rides/requests", pending.token)).body.data, []);
    assert.equal((await api("POST", `/api/rides/${rideId}/accept`, pending.token)).status, 404); // not offered
  });

  it("an offered driver whose document gets rejected loses the offer", async () => {
    const p = await makeUser("PASSENGER");
    const d = await makeDriver();
    const { rideId } = await book(p.token);
    assert.equal((await api("GET", "/api/drivers/rides/requests", d.token)).body.data!.length, 1);

    await DriverDocument.updateOne({ driverId: d.profileId, documentType: "AADHAAR" }, { verificationStatus: "REJECTED" });

    assert.deepEqual((await api("GET", "/api/drivers/rides/requests", d.token)).body.data, []);
    const accept = await api("POST", `/api/rides/${rideId}/accept`, d.token);
    assert.equal(accept.status, 403);
    assert.match(accept.body.message, /documents/);
  });
});

describe("POST /api/rides/:rideId/match", () => {
  it("searches again and reaches a driver who came online after booking", async () => {
    const p = await makeUser("PASSENGER");
    const { rideId, body } = await book(p.token);
    assert.equal(body.data!.driversContacted, 0); // nobody online yet

    const d = await makeDriver();
    await Ride.updateOne({ _id: rideId }, { $set: { lastMatchedAt: new Date(Date.now() - 60_000) } }); // past cooldown

    const res = await api("POST", `/api/rides/${rideId}/match`, p.token);
    assert.equal(res.status, 202);
    assert.equal(res.body.data!.newlyContacted, 1);
    assert.equal((await api("GET", "/api/drivers/rides/requests", d.token)).body.data!.length, 1);
  });

  it("has a cooldown, skips drivers who declined, and only works while SEARCHING", async () => {
    const p = await makeUser("PASSENGER");
    const d = await makeDriver();
    const { rideId } = await book(p.token);

    assert.equal((await api("POST", `/api/rides/${rideId}/match`, p.token)).status, 429); // just matched

    await api("POST", `/api/rides/${rideId}/reject`, d.token);
    await Ride.updateOne({ _id: rideId }, { $set: { lastMatchedAt: new Date(Date.now() - 60_000) } });
    const again = await api("POST", `/api/rides/${rideId}/match`, p.token);
    assert.equal(again.status, 202);
    assert.equal(again.body.data!.newlyContacted, 0); // the decliner is not asked again

    await api("PATCH", `/api/rides/${rideId}/cancel`, p.token, {});
    assert.equal((await api("POST", `/api/rides/${rideId}/match`, p.token)).status, 409);
  });

  it("only the ride's passenger can use it", async () => {
    const p = await makeUser("PASSENGER");
    const other = await makeUser("PASSENGER");
    const d = await makeDriver();
    const { rideId } = await book(p.token);

    assert.equal((await api("POST", `/api/rides/${rideId}/match`, other.token)).status, 404);
    assert.equal((await api("POST", `/api/rides/${rideId}/match`, d.token)).status, 403);
  });
});

describe("GET /api/rides/:rideId/driver", () => {
  it("404 before a driver is assigned", async () => {
    const p = await makeUser("PASSENGER");
    const { rideId } = await book(p.token);
    assert.equal((await api("GET", `/api/rides/${rideId}/driver`, p.token)).status, 404);
  });

  it("shows public details and live location with ETA while active, no location after", async () => {
    const { p, d, rideId } = await assignedRide();

    const res = await api("GET", `/api/rides/${rideId}/driver`, p.token);
    assert.equal(res.status, 200);
    const data = res.body.data!;
    assert.equal(data.vehicle.vehicleType, "BIKE");
    assert.equal(data.phone, undefined);
    assert.equal(data.location.heading, "PICKUP");
    assert.ok(data.location.distanceKm > 0);
    assert.ok(data.location.etaMinutes >= 1);

    // Finish the trip: the location is no longer shared.
    await api("POST", `/api/rides/${rideId}/arrive`, d.token);
    const otp = (await Ride.findById(rideId))!.startOtp!;
    await api("POST", `/api/rides/${rideId}/start`, d.token, { otp });
    assert.equal((await api("GET", `/api/rides/${rideId}/driver`, p.token)).body.data!.location.heading, "DESTINATION");
    await api("POST", `/api/rides/${rideId}/complete`, d.token);
    assert.equal((await api("GET", `/api/rides/${rideId}/driver`, p.token)).body.data!.location, null);
  });

  it("is only for the ride's passenger", async () => {
    const { d, rideId } = await assignedRide();
    const other = await makeUser("PASSENGER");
    assert.equal((await api("GET", `/api/rides/${rideId}/driver`, other.token)).status, 404);
    assert.equal((await api("GET", `/api/rides/${rideId}/driver`, d.token)).status, 403);
  });
});

describe("GET /api/rides/nearby-drivers", () => {
  const at = `latitude=${BORING_ROAD.latitude}&longitude=${BORING_ROAD.longitude}`;

  it("counts ride-eligible drivers per vehicle type, without revealing them", async () => {
    const p = await makeUser("PASSENGER");
    await makeDriver({ vehicleType: "BIKE", kmNorth: 1 });
    await makeDriver({ vehicleType: "BIKE", kmNorth: 2 });
    await makeDriver({ vehicleType: "CAB", kmNorth: 1 });
    await makeDriver({ vehicleType: "AUTO", kmNorth: 20 }); // outside the radius
    await makeDriver({ vehicleType: "AUTO", kmNorth: 1, documentStatus: "PENDING" }); // not eligible
    await makeDriver({ vehicleType: "CAB", kmNorth: 1, availabilityStatus: "OFFLINE" }); // offline

    const res = await api("GET", `/api/rides/nearby-drivers?${at}`, p.token);
    assert.equal(res.status, 200);
    const { byType, radiusKm } = res.body.data!;
    assert.equal(radiusKm, 5);
    assert.equal(byType.BIKE.count, 2);
    assert.equal(byType.CAB.count, 1);
    assert.equal(byType.AUTO.count, 0);
    assert.equal(byType.AUTO.etaMinutes, null);
    assert.ok(byType.BIKE.etaMinutes >= 1);
    assert.equal(JSON.stringify(res.body.data).includes("driverId"), false);
  });

  it("names the vehicle type when nobody can be contacted", async () => {
    const p = await makeUser("PASSENGER");
    await makeDriver({ vehicleType: "CAB" });
    const res = await book(p.token, { ...bikeRide, vehicleType: "AUTO" });
    assert.equal(res.body.data!.driversContacted, 0);
    assert.match(res.body.message, /No auto drivers within 5 km/);
  });

  it("validates the point and is for passengers only", async () => {
    const p = await makeUser("PASSENGER");
    const d = await makeDriver();
    assert.equal((await api("GET", "/api/rides/nearby-drivers?latitude=abc&longitude=85", p.token)).status, 400);
    assert.equal((await api("GET", `/api/rides/nearby-drivers?${at}`, d.token)).status, 403);
  });
});

describe("MATCH_ALL_DRIVERS mode", () => {
  // env is read-only by type; tests flip the flag at runtime.
  const rides = env.rides as { matchAllDrivers: boolean };
  beforeEach(() => {
    rides.matchAllDrivers = true;
  });
  afterEach(() => {
    rides.matchAllDrivers = false;
  });

  it("offers a ride to every eligible online driver: any vehicle, any distance, any location age", async () => {
    const p = await makeUser("PASSENGER");
    const cab = await makeDriver({ vehicleType: "CAB", kmNorth: 1 });
    const far = await makeDriver({ vehicleType: "AUTO", kmNorth: 30 });
    const stale = await makeDriver({ vehicleType: "BIKE", kmNorth: 2 });
    await DriverProfile.updateOne({ _id: stale.profileId }, { lastLocationUpdatedAt: new Date(Date.now() - 3_600_000) });
    const unverifiedDocs = await makeDriver({ vehicleType: "BIKE", documentStatus: "PENDING" });
    await makeDriver({ vehicleType: "BIKE", availabilityStatus: "OFFLINE" });

    const { rideId } = await book(p.token); // a BIKE ride
    const offered = (await Ride.findById(rideId))!.offeredDriverIds.map(String).sort();
    assert.deepEqual(offered, [cab.profileId, far.profileId, stale.profileId].sort());
    assert.equal(offered.includes(unverifiedDocs.profileId), false); // safety rules still apply

    // A CAB driver can accept a BIKE ride in this mode.
    const accept = await api("POST", `/api/rides/${rideId}/accept`, cab.token);
    assert.equal(accept.status, 200);
  });

  it("reports every online driver as available for every vehicle type", async () => {
    const p = await makeUser("PASSENGER");
    await makeDriver({ vehicleType: "CAB", kmNorth: 30 });
    const res = await api(
      "GET",
      `/api/rides/nearby-drivers?latitude=${BORING_ROAD.latitude}&longitude=${BORING_ROAD.longitude}`,
      p.token,
    );
    assert.equal(res.body.data!.matchAllDrivers, true);
    for (const type of ["BIKE", "AUTO", "CAB"]) assert.equal(res.body.data!.byType[type].count, 1);
  });
});

/* ================================= Payments ================================ */

/** A ride driven all the way to RIDE_COMPLETED. */
async function completedRide() {
  const { p, d, rideId } = await assignedRide();
  await api("POST", `/api/rides/${rideId}/arrive`, d.token);
  const otp = (await Ride.findById(rideId))!.startOtp!;
  await api("POST", `/api/rides/${rideId}/start`, d.token, { otp });
  await api("POST", `/api/rides/${rideId}/complete`, d.token);
  return { p, d, rideId, fare: (await Ride.findById(rideId))!.finalFare! };
}

describe("Payments", () => {
  afterEach(() => setPaymentGateway(mockGateway));

  it("UPI is charged via the gateway with the server's fare, once", async () => {
    const { p, d, rideId, fare } = await completedRide();

    const res = await api("POST", `/api/rides/${rideId}/payment`, p.token, { method: "UPI", amount: 1 });
    assert.equal(res.status, 201);
    assert.equal(res.body.data!.status, "COMPLETED");
    assert.equal(res.body.data!.amount, fare); // client amount ignored
    assert.match(res.body.data!.providerPaymentId, /^mock_pay_/);

    assert.equal((await api("POST", `/api/rides/${rideId}/payment`, p.token, { method: "CARD" })).status, 409);
    // The ride shows it is paid.
    assert.equal((await api("GET", `/api/rides/${rideId}`, p.token)).body.data!.payment.status, "COMPLETED");
    // Both histories have it; the driver sees who paid.
    const driverHistory = await api("GET", "/api/payments/history", d.token);
    assert.equal(driverHistory.body.data!.summary.paidAmount, fare);
    assert.ok(driverHistory.body.data!.payments[0].passenger.name);
  });

  it("CASH stays pending until the ride's driver confirms it", async () => {
    const { p, d, rideId, fare } = await completedRide();

    const cash = await api("POST", `/api/rides/${rideId}/payment`, p.token, { method: "CASH" });
    assert.equal(cash.status, 201);
    assert.equal(cash.body.data!.status, "PENDING");
    // Same method again is idempotent.
    const again = await api("POST", `/api/rides/${rideId}/payment`, p.token, { method: "CASH" });
    assert.equal(again.status, 200);
    assert.equal(again.body.data!.id, cash.body.data!.id);

    const pending = await api("GET", "/api/payments/history?status=PENDING", d.token);
    assert.equal(pending.body.data!.summary.pendingAmount, fare);

    const stranger = await makeDriver({ kmNorth: 3 });
    const paymentId = cash.body.data!.id;
    assert.equal((await api("POST", `/api/payments/${paymentId}/confirm-cash`, stranger.token)).status, 404);
    assert.equal((await api("POST", `/api/payments/${paymentId}/confirm-cash`, p.token)).status, 403);

    const confirmed = await api("POST", `/api/payments/${paymentId}/confirm-cash`, d.token);
    assert.equal(confirmed.status, 200);
    assert.equal(confirmed.body.data!.status, "COMPLETED");
    assert.ok(confirmed.body.data!.paidAt);
    assert.equal((await api("POST", `/api/payments/${paymentId}/confirm-cash`, d.token)).status, 409);
  });

  it("switching from pending cash to UPI closes the cash attempt", async () => {
    const { p, rideId } = await completedRide();
    const cash = await api("POST", `/api/rides/${rideId}/payment`, p.token, { method: "CASH" });
    const upi = await api("POST", `/api/rides/${rideId}/payment`, p.token, { method: "UPI" });
    assert.equal(upi.body.data!.status, "COMPLETED");
    assert.equal((await Payment.findById(cash.body.data!.id))!.status, "FAILED");
  });

  it("a declined charge is recorded as FAILED (402) and can be retried", async () => {
    const { p, rideId } = await completedRide();
    setPaymentGateway({
      kind: "instant",
      name: "MOCK",
      charge: async () => ({ status: "FAILED", providerPaymentId: "mock_fail", failureReason: "Card declined" }),
    });
    const declined = await api("POST", `/api/rides/${rideId}/payment`, p.token, { method: "CARD" });
    assert.equal(declined.status, 402);
    assert.match(declined.body.message, /Card declined/);

    setPaymentGateway(mockGateway);
    assert.equal((await api("POST", `/api/rides/${rideId}/payment`, p.token, { method: "UPI" })).status, 201);
    assert.equal(await Payment.countDocuments({ rideId }), 2); // failed attempt kept as history
  });

  it("RACE: two payments at once, exactly one goes through", async () => {
    const { p, rideId } = await completedRide();
    const [a, b] = await Promise.all([
      api("POST", `/api/rides/${rideId}/payment`, p.token, { method: "UPI" }),
      api("POST", `/api/rides/${rideId}/payment`, p.token, { method: "CARD" }),
    ]);
    assert.deepEqual([a.status, b.status].sort(), [201, 409]);
    assert.equal(await Payment.countDocuments({ rideId, status: "COMPLETED" }), 1);
  });

  it("only completed rides of your own can be paid; payments are private", async () => {
    const { p, d, rideId } = await assignedRide();
    assert.equal((await api("POST", `/api/rides/${rideId}/payment`, p.token, { method: "UPI" })).status, 409);
    assert.equal((await api("POST", `/api/rides/${rideId}/payment`, p.token, { method: "GOLD" })).status, 400);

    const done = await completedRide();
    const other = await makeUser("PASSENGER");
    assert.equal((await api("POST", `/api/rides/${done.rideId}/payment`, other.token, { method: "UPI" })).status, 404);

    const paid = await api("POST", `/api/rides/${done.rideId}/payment`, done.p.token, { method: "UPI" });
    const id = paid.body.data!.id;
    assert.equal((await api("GET", `/api/payments/${id}`, done.p.token)).status, 200);
    assert.equal((await api("GET", `/api/payments/${id}`, done.d.token)).status, 200);
    assert.equal((await api("GET", `/api/payments/${id}`, other.token)).status, 404);
    assert.equal((await api("GET", `/api/payments/${id}`, d.token)).status, 404); // another driver
  });
});

/* ============================ Ratings & reviews ============================ */

/** A completed ride the rider has paid for (UPI). */
async function paidRide() {
  const ride = await completedRide();
  await api("POST", `/api/rides/${ride.rideId}/payment`, ride.p.token, { method: "UPI" });
  return ride;
}

describe("Driver tip and final amount", () => {
  afterEach(() => setPaymentGateway(mockGateway));

  it("adds the tip exactly once to what is charged, shown and recorded", async () => {
    const { p, d, rideId, fare } = await completedRide();
    let charged = 0;
    setPaymentGateway({
      kind: "instant",
      name: "MOCK",
      charge: async ({ amount }) => {
        charged = amount;
        return { status: "SUCCEEDED", providerPaymentId: "mock_tip" };
      },
    });

    const paid = await api("POST", `/api/rides/${rideId}/payment`, p.token, { method: "UPI", tip: 40, amount: 1 });
    assert.equal(paid.status, 201);
    const data = paid.body.data!;
    assert.equal(data.amount, fare + 40);
    assert.equal(charged, fare + 40); // the gateway charged the same total
    assert.deepEqual(data.breakdown, { baseFare: fare, tip: 40, taxes: 0, additionalCharges: 0, discount: 0, total: fare + 40 });
    assert.equal(data.tipPaid, true);

    const stored = (await Payment.findById(data.id))!;
    assert.equal(stored.amount, fare + 40);
    assert.equal(stored.baseFare, fare);
    assert.equal(stored.tipAmount, 40);

    // Ride history / completed ride shows the same total and tip.
    const ride = await api("GET", `/api/rides/${rideId}`, p.token);
    assert.equal(ride.body.data!.payment.amount, fare + 40);
    assert.equal(ride.body.data!.payment.tipAmount, 40);

    // Driver earnings keep the tip apart from the fare.
    const summary = (await api("GET", "/api/payments/history", d.token)).body.data!.summary;
    assert.equal(summary.paidAmount, fare + 40);
    assert.equal(summary.paidFares, fare);
    assert.equal(summary.paidTips, 40);
  });

  it("a tip offered while searching is shown to drivers and carried into the payment", async () => {
    const p = await makeUser("PASSENGER");
    const d = await makeDriver();
    const { rideId } = await book(p.token);

    // Only the ride's passenger, only the offered amounts.
    assert.equal((await api("PATCH", `/api/rides/${rideId}/tip`, p.token, { tip: 30 })).status, 400);
    assert.equal((await api("PATCH", `/api/rides/${rideId}/tip`, d.token, { tip: 20 })).status, 403);
    const stranger = await makeUser("PASSENGER");
    assert.equal((await api("PATCH", `/api/rides/${rideId}/tip`, stranger.token, { tip: 20 })).status, 404);

    const tipped = await api("PATCH", `/api/rides/${rideId}/tip`, p.token, { tip: 50 });
    assert.equal(tipped.status, 200);
    assert.equal(tipped.body.data!.tipAmount, 50);
    assert.equal((await api("PATCH", `/api/rides/${rideId}/tip`, p.token, { tip: 20 })).body.data!.tipAmount, 20); // changed

    const offers = await api("GET", "/api/drivers/rides/requests", d.token);
    const offered = offers.body.data as unknown as { id: string; tipAmount: number }[];
    assert.equal(offered.find((r) => r.id === rideId)?.tipAmount, 20); // drivers see the tip

    // Ride it through: the cash payment opened on completion already includes the tip.
    await api("POST", `/api/rides/${rideId}/accept`, d.token);
    await api("POST", `/api/rides/${rideId}/arrive`, d.token);
    await api("POST", `/api/rides/${rideId}/start`, d.token, { otp: (await Ride.findById(rideId))!.startOtp! });
    await api("POST", `/api/rides/${rideId}/complete`, d.token);
    const fare = (await Ride.findById(rideId))!.finalFare!;
    assert.equal((await Payment.findOne({ rideId }))!.amount, fare + 20);

    // Tip can't change on the ride any more; paying without a tip uses the offered one, once.
    assert.equal((await api("PATCH", `/api/rides/${rideId}/tip`, p.token, { tip: 60 })).status, 409);
    const paid = await api("POST", `/api/rides/${rideId}/payment`, p.token, { method: "UPI" });
    assert.equal(paid.body.data!.amount, fare + 20);
    assert.equal(paid.body.data!.breakdown.tip, 20);
  });

  it("the passenger can still change the offered tip when paying", async () => {
    const p = await makeUser("PASSENGER");
    const d = await makeDriver();
    const { rideId } = await book(p.token);
    await api("PATCH", `/api/rides/${rideId}/tip`, p.token, { tip: 40 });
    await api("POST", `/api/rides/${rideId}/accept`, d.token);
    await api("POST", `/api/rides/${rideId}/arrive`, d.token);
    await api("POST", `/api/rides/${rideId}/start`, d.token, { otp: (await Ride.findById(rideId))!.startOtp! });
    await api("POST", `/api/rides/${rideId}/complete`, d.token);
    const fare = (await Ride.findById(rideId))!.finalFare!;

    const paid = await api("POST", `/api/rides/${rideId}/payment`, p.token, { method: "CARD", tip: 0 });
    assert.equal(paid.body.data!.amount, fare);
    assert.equal(paid.body.data!.tipAmount, 0);
  });

  it("without a tip, the total is just the fare", async () => {
    const { p, rideId, fare } = await completedRide();
    const paid = await api("POST", `/api/rides/${rideId}/payment`, p.token, { method: "CARD" });
    assert.equal(paid.body.data!.amount, fare);
    assert.equal(paid.body.data!.breakdown.tip, 0);
    assert.equal(paid.body.data!.tipPaid, false);
  });

  it("only accepts the offered tip amounts", async () => {
    const { p, rideId } = await completedRide();
    for (const tip of [30, -20, 1000, "40"]) {
      const res = await api("POST", `/api/rides/${rideId}/payment`, p.token, { method: "UPI", tip });
      assert.equal(res.status, 400, `tip ${tip}`);
    }
  });

  it("a cash tip is pending until the driver confirms, then paid", async () => {
    const { p, d, rideId, fare } = await completedRide();
    const autoCash = (await Payment.findOne({ rideId }))!; // created on completion, no tip
    assert.equal(autoCash.amount, fare);

    const cash = await api("POST", `/api/rides/${rideId}/payment`, p.token, { method: "CASH", tip: 20 });
    assert.equal(cash.body.data!.id, autoCash.id); // same pending payment, re-tipped
    assert.equal(cash.body.data!.amount, fare + 20);
    assert.equal(cash.body.data!.status, "PENDING");
    assert.equal(cash.body.data!.tipPaid, false); // never "paid" before confirmation

    const confirmed = await api("POST", `/api/payments/${autoCash.id}/confirm-cash`, d.token);
    assert.equal(confirmed.body.data!.amount, fare + 20);
    assert.equal(confirmed.body.data!.tipPaid, true);
    // Paid: the tip can't be changed any more.
    assert.equal((await api("POST", `/api/rides/${rideId}/payment`, p.token, { method: "CASH", tip: 60 })).status, 409);
  });

  it("a declined charge never shows the tip as paid", async () => {
    const { p, rideId } = await completedRide();
    setPaymentGateway({ kind: "instant", name: "MOCK", charge: async () => ({ status: "FAILED", providerPaymentId: "x", failureReason: "Declined" }) });
    assert.equal((await api("POST", `/api/rides/${rideId}/payment`, p.token, { method: "CARD", tip: 50 })).status, 402);
    const failed = (await Payment.findOne({ rideId, status: "FAILED", method: "CARD" }))!;
    assert.equal(failed.tipAmount, 50);
    const view = await api("GET", `/api/payments/${failed.id}`, p.token);
    assert.equal(view.body.data!.tipPaid, false);
  });

  it("the database rejects a total that doesn't match its parts", async () => {
    const { p, d, rideId } = await completedRide();
    await Payment.deleteMany({ rideId });
    await assert.rejects(
      Payment.create({
        rideId,
        passengerId: p.id,
        driverId: d.profileId,
        baseFare: 100,
        tipAmount: 20,
        amount: 100, // tip missing
        method: "CARD",
        provider: "MOCK",
      }),
      /must equal base fare/,
    );
  });
});

/** Receipt emails are sent in the background; wait until `count` have gone out. */
async function waitForReceipts(count: number) {
  for (let i = 0; i < 50 && sentReceipts.length < count; i += 1) await new Promise((r) => setTimeout(r, 20));
  assert.equal(sentReceipts.length, count);
}

describe("Payment receipts", () => {
  beforeEach(() => {
    sentReceipts.length = 0;
  });

  it("emails the passenger a receipt with a rating link after an online payment", async () => {
    const { p, rideId, fare } = await completedRide();
    const paid = await api("POST", `/api/rides/${rideId}/payment`, p.token, { method: "UPI" });
    assert.equal(paid.status, 201);

    await waitForReceipts(1);
    const [{ to, receipt }] = sentReceipts as [{ to: string; receipt: ReceiptEmail }];
    assert.equal(to, (await User.findById(p.id))!.email);
    assert.equal(receipt.amount, fare);
    assert.equal(receipt.method, "UPI");
    assert.equal(receipt.receiptNumber, (paid.body.data!.id as string).slice(-8).toUpperCase());
    assert.equal(receipt.pickup, BORING_ROAD.address);
    assert.match(receipt.rateUrl ?? "", /\/dashboard\/history$/);

    // The payment view asks the passenger for a rating until they give one.
    const before = await api("GET", `/api/payments/${paid.body.data!.id}`, p.token);
    assert.equal(before.body.data!.canRate, true);
    assert.equal(before.body.data!.myRating, null);
    assert.ok(before.body.data!.driver.name);

    await api("POST", `/api/rides/${rideId}/rating`, p.token, { score: 4, comment: "Nice" });
    const after = await api("GET", `/api/payments/${paid.body.data!.id}`, p.token);
    assert.equal(after.body.data!.canRate, false);
    assert.deepEqual(after.body.data!.myRating, { score: 4, comment: "Nice" });
  });

  it("emails a receipt only once cash is confirmed, not while it is pending", async () => {
    const { p, d, rideId } = await completedRide();
    const cash = await api("POST", `/api/rides/${rideId}/payment`, p.token, { method: "CASH" });
    await new Promise((r) => setTimeout(r, 100));
    assert.equal(sentReceipts.length, 0);

    await api("POST", `/api/payments/${cash.body.data!.id}/confirm-cash`, d.token);
    await waitForReceipts(1);
    assert.equal(sentReceipts[0]!.receipt.method, "CASH");
  });

  it("a mail failure doesn't affect the payment", async () => {
    const failing = mock.method(emailService, "sendPaymentReceiptEmail", async () => {
      throw new Error("SMTP down");
    });
    try {
      const { p, rideId } = await completedRide();
      const paid = await api("POST", `/api/rides/${rideId}/payment`, p.token, { method: "CARD" });
      assert.equal(paid.status, 201);
      assert.equal(paid.body.data!.status, "COMPLETED");
    } finally {
      failing.mock.restore();
    }
  });
});

/* ================================ Razorpay ================================= */

describe("Razorpay (Checkout + webhook)", () => {
  const KEY_SECRET = "test_key_secret_123456";
  const WEBHOOK_SECRET = "test_webhook_secret";
  // Fake Razorpay API: orders we created and payments the "customer" made.
  const orders = new Map<string, { amount: number; currency: string }>();
  const remotePayments = new Map<string, Record<string, unknown>>();
  let captured: string[] = [];
  const fakeApi = {
    async createOrder(body: { amount: number; currency: string }) {
      const id = `order_${orders.size + 1}${Date.now()}`;
      orders.set(id, { amount: body.amount, currency: body.currency });
      return { id };
    },
    async fetchPayment(id: string) {
      const p = remotePayments.get(id);
      if (!p) throw new Error("not found");
      return p;
    },
    async capturePayment(id: string) {
      captured.push(id);
      const p = { ...remotePayments.get(id)!, status: "captured" };
      remotePayments.set(id, p);
      return p;
    },
  };
  const gateway = createRazorpayGateway({ keyId: "rzp_test_abc123", keySecret: KEY_SECRET, webhookSecret: WEBHOOK_SECRET, api: fakeApi });
  const sign = (secret: string, payload: string) => createHmac("sha256", secret).update(payload).digest("hex");

  /** The customer pays the order in Checkout; returns what Checkout hands the browser. */
  function customerPays(orderId: string, opts: { status?: string; amount?: number } = {}) {
    const order = orders.get(orderId)!;
    const paymentId = `pay_${remotePayments.size + 1}${Date.now()}`;
    remotePayments.set(paymentId, {
      id: paymentId,
      order_id: orderId,
      status: opts.status ?? "captured",
      amount: opts.amount ?? order.amount,
      currency: order.currency,
      method: "upi",
    });
    return {
      razorpay_order_id: orderId,
      razorpay_payment_id: paymentId,
      razorpay_signature: sign(KEY_SECRET, `${orderId}|${paymentId}`),
    };
  }

  async function webhook(event: string, paymentId: string, orderId: string, secret = WEBHOOK_SECRET) {
    const body = JSON.stringify({
      event,
      payload: { payment: { entity: { id: paymentId, order_id: orderId, error_description: "Bank declined" } } },
    });
    const res = await fetch(`${baseUrl}/api/payments/razorpay/webhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Razorpay-Signature": sign(secret, body) },
      body,
    });
    return { status: res.status, body: (await res.json()) as { data?: { handled: string } } };
  }

  beforeEach(() => {
    setPaymentGateway(gateway);
    captured = [];
    sentReceipts.length = 0;
  });
  afterEach(() => setPaymentGateway(mockGateway));

  it("creates an order for the exact total and completes it via the Checkout callback", async () => {
    const { p, rideId, fare } = await completedRide();
    const started = await api("POST", `/api/rides/${rideId}/payment`, p.token, { method: "UPI", tip: 20 });
    assert.equal(started.status, 201);
    const payment = started.body.data!;
    assert.equal(payment.status, "PENDING");
    assert.equal(payment.provider, "RAZORPAY");
    assert.equal(payment.checkout.keyId, "rzp_test_abc123");
    assert.equal(payment.checkout.amount, (fare + 20) * 100); // paise, tip included once
    assert.equal(orders.get(payment.checkout.orderId)!.amount, (fare + 20) * 100);

    const result = customerPays(payment.checkout.orderId);
    const forged = await api("POST", `/api/payments/${payment.id}/razorpay/verify`, p.token, {
      ...result,
      razorpay_signature: sign("wrong-secret", `${result.razorpay_order_id}|${result.razorpay_payment_id}`),
    });
    assert.equal(forged.status, 400);
    assert.equal((await Payment.findById(payment.id))!.status, "PENDING");

    const stranger = await makeUser("PASSENGER");
    assert.equal((await api("POST", `/api/payments/${payment.id}/razorpay/verify`, stranger.token, result)).status, 404);

    const verified = await api("POST", `/api/payments/${payment.id}/razorpay/verify`, p.token, result);
    assert.equal(verified.status, 200);
    assert.equal(verified.body.data!.status, "COMPLETED");
    assert.equal(verified.body.data!.providerPaymentId, result.razorpay_payment_id);
    assert.equal(verified.body.data!.tipPaid, true);
    await waitForReceipts(1);

    // Calling again (double click) is harmless; the webhook arriving later changes nothing.
    assert.equal((await api("POST", `/api/payments/${payment.id}/razorpay/verify`, p.token, result)).status, 200);
    assert.equal((await webhook("payment.captured", result.razorpay_payment_id, result.razorpay_order_id)).body.data!.handled, "ignored");
    assert.equal(sentReceipts.length, 1); // one receipt, not two
  });

  it("rejects a payment for the wrong amount, and captures an authorized one", async () => {
    const { p, rideId, fare } = await completedRide();
    const payment = (await api("POST", `/api/rides/${rideId}/payment`, p.token, { method: "CARD" })).body.data!;

    const short = customerPays(payment.checkout.orderId, { amount: 100 });
    assert.equal((await api("POST", `/api/payments/${payment.id}/razorpay/verify`, p.token, short)).status, 400);
    assert.equal((await Payment.findById(payment.id))!.status, "PENDING");

    const authorized = customerPays(payment.checkout.orderId, { status: "authorized", amount: fare * 100 });
    const ok = await api("POST", `/api/payments/${payment.id}/razorpay/verify`, p.token, authorized);
    assert.equal(ok.body.data!.status, "COMPLETED");
    assert.deepEqual(captured, [authorized.razorpay_payment_id]);
  });

  it("the webhook completes a payment even if the browser never called back", async () => {
    const { p, rideId } = await completedRide();
    const payment = (await api("POST", `/api/rides/${rideId}/payment`, p.token, { method: "UPI" })).body.data!;
    const result = customerPays(payment.checkout.orderId);

    assert.equal((await webhook("payment.captured", result.razorpay_payment_id, result.razorpay_order_id, "forged")).status, 400);
    assert.equal((await Payment.findById(payment.id))!.status, "PENDING");

    // A failed attempt is noted but the order stays payable (Checkout allows retries).
    const failed = await webhook("payment.failed", result.razorpay_payment_id, result.razorpay_order_id);
    assert.equal(failed.body.data!.handled, "failed-attempt");
    assert.equal((await Payment.findById(payment.id))!.status, "PENDING");

    const paid = await webhook("payment.captured", result.razorpay_payment_id, result.razorpay_order_id);
    assert.equal(paid.status, 200);
    assert.equal(paid.body.data!.handled, "paid");
    const stored = (await Payment.findById(payment.id))!;
    assert.equal(stored.status, "COMPLETED");
    assert.equal(stored.failureReason, undefined);
    // The browser's callback arriving afterwards is still a success.
    assert.equal((await api("POST", `/api/payments/${payment.id}/razorpay/verify`, p.token, result)).status, 200);
  });

  it("reuses the order when Checkout is reopened; a new tip starts a new order", async () => {
    const { p, rideId, fare } = await completedRide();
    const first = (await api("POST", `/api/rides/${rideId}/payment`, p.token, { method: "UPI" })).body.data!;
    const again = await api("POST", `/api/rides/${rideId}/payment`, p.token, { method: "UPI" });
    assert.equal(again.status, 200);
    assert.equal(again.body.data!.checkout.orderId, first.checkout.orderId);

    const retipped = (await api("POST", `/api/rides/${rideId}/payment`, p.token, { method: "UPI", tip: 50 })).body.data!;
    assert.notEqual(retipped.checkout.orderId, first.checkout.orderId);
    assert.equal(retipped.checkout.amount, (fare + 50) * 100);
    assert.equal((await Payment.findById(first.id))!.status, "FAILED");
  });
});

describe("Ratings (riders rate drivers, after paying)", () => {
  it("the rider rates the driver once, after paying; the driver can't rate", async () => {
    const { p, d, rideId } = await paidRide();

    const res = await api("POST", `/api/rides/${rideId}/rating`, p.token, { score: 5, comment: "  Smooth ride  " });
    assert.equal(res.status, 201);
    assert.equal(res.body.data!.fromRole, "PASSENGER");
    assert.equal(res.body.data!.comment, "Smooth ride"); // trimmed

    assert.equal((await api("POST", `/api/rides/${rideId}/rating`, p.token, { score: 1 })).status, 409); // once
    assert.equal((await api("POST", `/api/rides/${rideId}/rating`, d.token, { score: 4 })).status, 403); // drivers don't rate

    // Participants and admins can read it.
    assert.equal((await api("GET", `/api/rides/${rideId}/rating`, d.token)).body.data!.length, 1);
    const admin = await makeUser("ADMIN");
    assert.equal((await api("GET", `/api/rides/${rideId}/rating`, admin.token)).body.data!.length, 1);

    // Ride view: driver average for everyone, myRating only for the rider.
    const view = (await api("GET", `/api/rides/${rideId}`, p.token)).body.data!;
    assert.equal(view.driver.rating, 5);
    assert.equal(view.driver.ratingCount, 1);
    assert.equal(view.myRating, 5);
    assert.equal((await api("GET", `/api/rides/${rideId}`, d.token)).body.data!.myRating, undefined);
  });

  it("needs a completed payment: unpaid and pending-cash rides can't be rated yet", async () => {
    const { p, d, rideId } = await completedRide();
    const unpaid = await api("POST", `/api/rides/${rideId}/rating`, p.token, { score: 5 });
    assert.equal(unpaid.status, 409);
    assert.match(unpaid.body.message, /Pay for the ride/);

    const cash = await api("POST", `/api/rides/${rideId}/payment`, p.token, { method: "CASH" });
    assert.equal((await api("POST", `/api/rides/${rideId}/rating`, p.token, { score: 5 })).status, 409); // still pending

    await api("POST", `/api/payments/${cash.body.data!.id}/confirm-cash`, d.token);
    assert.equal((await api("POST", `/api/rides/${rideId}/rating`, p.token, { score: 4 })).status, 201);
  });

  it("can rate any time after paying (no deadline)", async () => {
    const { p, rideId } = await paidRide();
    await Ride.updateOne({ _id: rideId }, { completedAt: new Date(Date.now() - 90 * 24 * 3600 * 1000) });
    assert.equal((await api("POST", `/api/rides/${rideId}/rating`, p.token, { score: 5 })).status, 201);
  });

  it("averages across rides, rounded to one decimal", async () => {
    const first = await paidRide();
    await api("POST", `/api/rides/${first.rideId}/rating`, first.p.token, { score: 5 });

    const p2 = await makeUser("PASSENGER");
    const { rideId } = await book(p2.token);
    await api("POST", `/api/rides/${rideId}/accept`, first.d.token);
    await api("POST", `/api/rides/${rideId}/arrive`, first.d.token);
    await api("POST", `/api/rides/${rideId}/start`, first.d.token, { otp: (await Ride.findById(rideId))!.startOtp! });
    await api("POST", `/api/rides/${rideId}/complete`, first.d.token);
    await api("POST", `/api/rides/${rideId}/payment`, p2.token, { method: "CARD" });
    await api("POST", `/api/rides/${rideId}/rating`, p2.token, { score: 4 });

    const view = (await api("GET", `/api/rides/${rideId}`, p2.token)).body.data!;
    assert.equal(view.driver.rating, 4.5);
    assert.equal(view.driver.ratingCount, 2);
  });

  it("only the ride's own rider, only completed rides, valid scores", async () => {
    const { p, rideId } = await assignedRide();
    assert.equal((await api("POST", `/api/rides/${rideId}/rating`, p.token, { score: 5 })).status, 409);

    const done = await paidRide();
    const other = await makeUser("PASSENGER");
    assert.equal((await api("POST", `/api/rides/${done.rideId}/rating`, other.token, { score: 5 })).status, 404);
    assert.equal((await api("GET", `/api/rides/${done.rideId}/rating`, other.token)).status, 404);

    for (const score of [0, 6, 4.5, "5"]) {
      assert.equal((await api("POST", `/api/rides/${done.rideId}/rating`, done.p.token, { score })).status, 400);
    }
    const long = "x".repeat(501);
    assert.equal((await api("POST", `/api/rides/${done.rideId}/rating`, done.p.token, { score: 5, comment: long })).status, 400);
  });

  it("RACE: two ratings at once from the rider, exactly one is saved", async () => {
    const { p, rideId } = await paidRide();
    const [a, b] = await Promise.all([
      api("POST", `/api/rides/${rideId}/rating`, p.token, { score: 5 }),
      api("POST", `/api/rides/${rideId}/rating`, p.token, { score: 3 }),
    ]);
    assert.deepEqual([a.status, b.status].sort(), [201, 409]);
    assert.equal(await Rating.countDocuments({ rideId }), 1);
  });
});

describe("GET /api/ratings/me and admin reviews", () => {
  it("drivers see ratings from riders with a summary; it feeds the admin list", async () => {
    const a = await paidRide();
    await api("POST", `/api/rides/${a.rideId}/rating`, a.p.token, { score: 5, comment: "Great" });

    const driverView = await api("GET", "/api/ratings/me", a.d.token);
    assert.equal(driverView.status, 200);
    const { summary, reviews } = driverView.body.data!;
    assert.equal(summary.average, 5);
    assert.equal(summary.count, 1);
    assert.equal(summary.breakdown["5"], 1);
    assert.equal(reviews[0].comment, "Great");
    assert.ok(reviews[0].from.name);
    assert.ok(reviews[0].ride.pickup);

    // Riders don't receive ratings.
    assert.equal((await api("GET", "/api/ratings/me", a.p.token)).status, 403);

    const admin = await makeUser("ADMIN");
    const adminList = await api("GET", "/api/admin/reviews", admin.token);
    assert.equal(adminList.body.data!.length, 1);
    assert.equal(adminList.body.data![0].rating, 5);
  });
});

/* ============================== Notifications ============================== */

/** createdAt is immutable in Mongoose: age a ride with the raw driver. */
async function ageRide(rideId: string, ms: number) {
  await Ride.collection.updateOne(
    { _id: new (await import("mongoose")).Types.ObjectId(rideId) },
    { $set: { createdAt: new Date(Date.now() - ms) } },
  );
}

/** Notifications are written in the background: poll briefly until they appear. */
async function waitForNotification(userId: string, type: NotificationType, timeoutMs = 3000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const found = await Notification.findOne({ userId, type });
    if (found) return found;
    await new Promise((r) => setTimeout(r, 25));
  }
  throw new Error(`No ${type} notification for ${userId}`);
}

describe("Notifications: created by events", () => {
  it("passenger hears accept / arrive / start / complete; driver hears payment and rating", async () => {
    const { p, d, rideId } = await assignedRide();
    const accepted = await waitForNotification(p.id, "RIDE_ACCEPTED");
    assert.equal(accepted.data.rideId, rideId);
    assert.match(accepted.body, /DRIVER/); // the driver's name

    await api("POST", `/api/rides/${rideId}/arrive`, d.token);
    await waitForNotification(p.id, "DRIVER_ARRIVED");
    await api("POST", `/api/rides/${rideId}/start`, d.token, { otp: (await Ride.findById(rideId))!.startOtp! });
    await waitForNotification(p.id, "RIDE_STARTED");
    await api("POST", `/api/rides/${rideId}/complete`, d.token);
    const completed = await waitForNotification(p.id, "RIDE_COMPLETED");
    assert.match(completed.body, /₹\d+/);

    await api("POST", `/api/rides/${rideId}/payment`, p.token, { method: "UPI" });
    await waitForNotification(d.id, "PAYMENT_RECEIVED");
    await api("POST", `/api/rides/${rideId}/rating`, p.token, { score: 5 });
    await waitForNotification(d.id, "NEW_RATING");

    // Nobody gets notifications meant for the other side.
    assert.equal(await Notification.countDocuments({ userId: d.id, type: "RIDE_ACCEPTED" }), 0);
  });

  it("cash confirmed → passenger; passenger cancels after accept → driver", async () => {
    const done = await completedRide();
    const cash = await api("POST", `/api/rides/${done.rideId}/payment`, done.p.token, { method: "CASH" });
    await api("POST", `/api/payments/${cash.body.data!.id}/confirm-cash`, done.d.token);
    await waitForNotification(done.p.id, "PAYMENT_CONFIRMED");

    const { p, d, rideId } = await assignedRide();
    await api("PATCH", `/api/rides/${rideId}/cancel`, p.token, {});
    const cancelled = await waitForNotification(d.id, "RIDE_CANCELLED");
    assert.equal(cancelled.data.rideId, rideId);
  });

  it("search timeout → passenger; a ride a driver already accepted is never timed out (bug fix)", async () => {
    const p = await makeUser("PASSENGER");
    const { rideId } = await book(p.token);
    await ageRide(rideId, 3_600_000);
    await api("GET", "/api/rides/current", p.token); // lazy timeout runs on read
    await waitForNotification(p.id, "RIDE_NO_DRIVER");

    // RACE: the passenger's read loads the ride while it is still SEARCHING (and
    // old), then a driver accepts before the timeout write runs. The timeout
    // must not cancel the now-accepted ride.
    const p2 = await makeUser("PASSENGER");
    const d2 = await makeDriver({ kmNorth: 2 });
    const { rideId: racedId } = await book(p2.token);
    // The passenger's read: SEARCHING and (as seen at that instant) past the timeout.
    // hydrate() because Mongoose ignores assignments to the immutable createdAt.
    const fresh = (await Ride.findById(racedId))!;
    const stale = Ride.hydrate({ ...fresh.toObject(), createdAt: new Date(Date.now() - 3_600_000) });
    assert.equal(stale.status, "SEARCHING");
    assert.ok(stale.createdAt.getTime() < Date.now() - 3_000_000);
    assert.equal((await api("POST", `/api/rides/${racedId}/accept`, d2.token)).status, 200); // driver wins the gap
    const { refreshSearch } = await import("./services/ride.service.js");
    await refreshSearch(stale);
    assert.equal((await Ride.findById(racedId))!.status, "DRIVER_ASSIGNED");
  });

  it("driver verified / rejected → driver; complete submission → every admin", async () => {
    const admin = await makeUser("ADMIN");
    const admin2 = await makeUser("ADMIN");
    const user = await makeUser("DRIVER");
    const profile = await DriverProfile.create({
      userId: user.id,
      licenseNumber: `BR01DL${String(seq).padStart(6, "0")}`,
      verificationStatus: "PENDING",
    });

    // Vehicle + both documents through the driver API: admins are told once it is complete.
    const vehicle = await api("POST", "/api/drivers/vehicle", user.token, {
      vehicleType: "CAB",
      make: "Tata",
      model: "Tiago",
      year: 2023,
      color: "White",
      registrationNumber: "BR01CD1234",
    });
    assert.equal(vehicle.status, 201);
    await new Promise((r) => setTimeout(r, 100));
    assert.equal(await Notification.countDocuments({ type: "DRIVER_READY_FOR_REVIEW" }), 0); // not complete yet

    const aadhaar = await api("POST", "/api/drivers/documents", user.token, {
      documentType: "AADHAAR",
      documentNumber: "234567890123",
      documentUrl: "https://example.com/a.png",
    });
    assert.equal(aadhaar.status, 201);
    const dl = await api("POST", "/api/drivers/documents", user.token, {
      documentType: "DRIVING_LICENSE",
      documentNumber: "BR0120230012345",
      documentUrl: "https://example.com/dl.png",
    });
    assert.equal(dl.status, 201);

    const ready = await waitForNotification(admin.id, "DRIVER_READY_FOR_REVIEW");
    assert.equal(ready.data.driverId, String(profile._id));
    await waitForNotification(admin2.id, "DRIVER_READY_FOR_REVIEW");

    assert.equal((await api("PATCH", `/api/admin/drivers/${profile.id}/verify`, admin.token)).status, 200);
    await waitForNotification(user.id, "DRIVER_VERIFIED");

    await api("PATCH", `/api/admin/drivers/${profile.id}/reject`, admin.token, { rejectionReason: "Blurry licence photo" });
    const rejected = await waitForNotification(user.id, "DRIVER_REJECTED");
    assert.match(rejected.body, /Blurry licence photo/);
  });
});

describe("Notifications API", () => {
  async function seed(userId: string, n: number) {
    for (let i = 0; i < n; i++) {
      await Notification.create({ userId, type: "RIDE_STARTED", title: `T${i}`, body: `B${i}` });
    }
  }

  it("lists my notifications newest first with an unread count; unreadOnly is parsed strictly", async () => {
    const me = await makeUser("PASSENGER");
    const other = await makeUser("DRIVER");
    await seed(me.id, 3);
    await seed(other.id, 2);

    const list = await api("GET", "/api/notifications?limit=2", me.token);
    assert.equal(list.status, 200);
    assert.equal(list.body.data!.notifications.length, 2);
    assert.equal(list.body.data!.notifications[0].title, "T2"); // newest first
    assert.equal(list.body.data!.notifications[0].isRead, false);
    assert.equal(list.body.data!.unreadCount, 3);
    assert.deepEqual(list.body.data!.pagination, { page: 1, limit: 2, total: 3, pages: 2 });

    // Mark one read; unreadOnly=true hides it, unreadOnly=false (the string) shows everything.
    await api("PATCH", `/api/notifications/${list.body.data!.notifications[0].id}/read`, me.token);
    assert.equal((await api("GET", "/api/notifications?unreadOnly=true", me.token)).body.data!.notifications.length, 2);
    assert.equal((await api("GET", "/api/notifications?unreadOnly=false", me.token)).body.data!.notifications.length, 3);
    assert.equal((await api("GET", "/api/notifications?unreadOnly=yes", me.token)).status, 400);
    assert.equal((await api("GET", "/api/notifications?limit=500", me.token)).status, 400);
    assert.equal((await api("GET", "/api/notifications")).status, 401);
  });

  it("mark one read: owner only, idempotent (keeps the first readAt)", async () => {
    const me = await makeUser("DRIVER");
    const other = await makeUser("PASSENGER");
    await seed(me.id, 1);
    const n = (await Notification.findOne({ userId: me.id }))!;

    assert.equal((await api("PATCH", `/api/notifications/${n.id}/read`, other.token)).status, 404);
    assert.equal((await api("PATCH", "/api/notifications/bad-id/read", me.token)).status, 400);

    const first = await api("PATCH", `/api/notifications/${n.id}/read`, me.token);
    assert.equal(first.status, 200);
    assert.equal(first.body.data!.isRead, true);
    const second = await api("PATCH", `/api/notifications/${n.id}/read`, me.token);
    assert.equal(second.body.data!.readAt, first.body.data!.readAt);
  });

  it("read-all marks only my unread ones and reports how many", async () => {
    const me = await makeUser("ADMIN");
    const other = await makeUser("PASSENGER");
    await seed(me.id, 3);
    await seed(other.id, 2);
    await api("PATCH", `/api/notifications/${(await Notification.findOne({ userId: me.id }))!.id}/read`, me.token);

    const res = await api("PATCH", "/api/notifications/read-all", me.token);
    assert.equal(res.status, 200);
    assert.equal(res.body.data!.updated, 2);
    assert.equal((await api("GET", "/api/notifications", me.token)).body.data!.unreadCount, 0);
    assert.equal((await api("GET", "/api/notifications", other.token)).body.data!.unreadCount, 2); // untouched
  });
});

/* ========================== GET /api/ratings/me (detailed) ========================== */

describe("GET /api/ratings/me in detail", () => {
  /** Ratings stored directly (the endpoint only reads them). */
  async function seedRatings(
    driverUserId: string,
    scores: number[],
    opts: { fromRole?: "PASSENGER" | "DRIVER"; createdAt?: Date; withRide?: boolean } = {},
  ) {
    const { Types } = await import("mongoose");
    const rater = await makeUser("PASSENGER");
    const ids: string[] = [];
    for (const score of scores) {
      const doc = await Rating.create({
        rideId: new Types.ObjectId(), // no such ride: ride info comes back null
        fromRole: opts.fromRole ?? "PASSENGER",
        fromUserId: rater.id,
        toUserId: driverUserId,
        score,
        ...(opts.createdAt ? { createdAt: opts.createdAt } : {}),
      });
      ids.push(doc.id as string);
    }
    return { ids, rater };
  }

  it("a driver with no ratings gets an empty, well-formed response", async () => {
    const d = await makeDriver();
    const res = await api("GET", "/api/ratings/me", d.token);
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.data, {
      summary: { average: null, count: 0, breakdown: { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0 } },
      reviews: [],
      pagination: { page: 1, limit: 20, total: 0, pages: 0 },
    });
  });

  it("summary: average to one decimal, count and 1-5 breakdown", async () => {
    const d = await makeDriver();
    await seedRatings(d.id, [5, 5, 4, 3, 1]); // 18 / 5 = 3.6
    const { summary } = (await api("GET", "/api/ratings/me", d.token)).body.data!;
    assert.equal(summary.average, 3.6);
    assert.equal(summary.count, 5);
    assert.deepEqual(summary.breakdown, { "1": 1, "2": 0, "3": 1, "4": 1, "5": 2 });

    const d2 = await makeDriver({ kmNorth: 2 });
    await seedRatings(d2.id, [5, 4, 4]); // 4.333… → 4.3
    assert.equal((await api("GET", "/api/ratings/me", d2.token)).body.data!.summary.average, 4.3);
  });

  it("score filter narrows the list but never the summary", async () => {
    const d = await makeDriver();
    await seedRatings(d.id, [5, 5, 4, 2]);
    const res = (await api("GET", "/api/ratings/me?score=5", d.token)).body.data!;
    assert.equal(res.reviews.length, 2);
    assert.ok(res.reviews.every((r: Json) => r.score === 5));
    assert.equal(res.pagination.total, 2);
    assert.equal(res.summary.count, 4); // summary covers all ratings
    assert.equal((await api("GET", "/api/ratings/me?score=3", d.token)).body.data!.reviews.length, 0);
  });

  it("pagination: newest first, no overlaps or gaps, even when timestamps tie", async () => {
    const d = await makeDriver();
    const sameMoment = new Date("2026-10-01T10:00:00Z");
    const tied = await seedRatings(d.id, [1, 2, 3, 4, 5], { createdAt: sameMoment }); // all identical createdAt
    await seedRatings(d.id, [5], { createdAt: new Date("2026-10-02T10:00:00Z") }); // the newest

    const pages: Json[][] = [];
    for (let page = 1; page <= 4; page++) {
      pages.push((await api("GET", `/api/ratings/me?limit=2&page=${page}`, d.token)).body.data!.reviews);
    }
    const ids = pages.flat().map((r) => r.id);
    assert.equal(ids.length, 6); // pages 1-3 full, page 4 empty
    assert.equal(new Set(ids).size, 6); // nothing repeated across pages
    assert.equal(pages[3]!.length, 0);
    assert.equal(pages[0]![0]!.createdAt, "2026-10-02T10:00:00.000Z"); // newest first
    // Ties are ordered by _id (newest-created first), so the order is fully defined.
    assert.deepEqual(ids.slice(1), [...tied.ids].reverse());

    const meta = (await api("GET", "/api/ratings/me?limit=2", d.token)).body.data!.pagination;
    assert.deepEqual(meta, { page: 1, limit: 2, total: 6, pages: 3 });
  });

  it("only my own ratings, and only those from riders", async () => {
    const me = await makeDriver();
    const other = await makeDriver({ kmNorth: 2 });
    await seedRatings(me.id, [5]);
    await seedRatings(other.id, [1, 1]);
    await seedRatings(me.id, [1], { fromRole: "DRIVER" }); // not from a rider: ignored

    const { summary, reviews } = (await api("GET", "/api/ratings/me", me.token)).body.data!;
    assert.equal(summary.count, 1);
    assert.equal(summary.average, 5);
    assert.equal(reviews.length, 1);
    assert.equal(reviews[0].fromRole, "PASSENGER");
  });

  it("each review carries the rider's name and the trip; missing data degrades gracefully", async () => {
    const real = await paidRide();
    await api("POST", `/api/rides/${real.rideId}/rating`, real.p.token, { score: 4, comment: "Nice" });
    const [review] = (await api("GET", "/api/ratings/me", real.d.token)).body.data!.reviews;
    assert.equal(review.score, 4);
    assert.equal(review.comment, "Nice");
    assert.equal(review.from.name, (await User.findById(real.p.id))!.name);
    assert.equal(review.ride.pickup, BORING_ROAD.address);
    assert.equal(review.ride.destination, PATNA_JN.address);
    assert.ok(review.ride.completedAt);

    // Rider account deleted + ride gone: placeholder name, ride null, no crash.
    const d = await makeDriver({ kmNorth: 2 });
    const { rater } = await seedRatings(d.id, [3]);
    await User.deleteOne({ _id: rater.id });
    const [orphan] = (await api("GET", "/api/ratings/me", d.token)).body.data!.reviews;
    assert.equal(orphan.from.name, "User");
    assert.equal(orphan.ride, null);
  });

  it("matches the driver rating shown everywhere else", async () => {
    const r = await paidRide();
    await api("POST", `/api/rides/${r.rideId}/rating`, r.p.token, { score: 4 });
    await seedRatings(r.d.id, [5, 5]); // + two more → (4+5+5)/3 = 4.7
    await seedRatings(r.d.id, [1], { fromRole: "DRIVER" }); // ignored everywhere

    const mine = (await api("GET", "/api/ratings/me", r.d.token)).body.data!.summary;
    const rideView = (await api("GET", `/api/rides/${r.rideId}`, r.p.token)).body.data!.driver;
    const admin = await makeUser("ADMIN");
    const adminView = (await api("GET", `/api/admin/drivers/${r.d.profileId}`, admin.token)).body.data!;
    assert.equal(mine.average, 4.7);
    assert.equal(rideView.rating, 4.7);
    assert.equal(rideView.ratingCount, 3);
    assert.equal(adminView.rating, 4.7);
    assert.equal(adminView.ratingCount, 3);
  });

  it("validates the query", async () => {
    const d = await makeDriver();
    for (const q of ["score=0", "score=6", "score=4.5", "score=abc", "limit=0", "limit=101", "page=0", "page=-1"]) {
      assert.equal((await api("GET", `/api/ratings/me?${q}`, d.token)).status, 400, q);
    }
    assert.equal((await api("GET", "/api/ratings/me?limit=100&page=999", d.token)).status, 200); // past the end: empty
  });

  it("drivers only: 401 without a token, 403 for riders and admins", async () => {
    const p = await makeUser("PASSENGER");
    const admin = await makeUser("ADMIN");
    assert.equal((await api("GET", "/api/ratings/me")).status, 401);
    assert.equal((await api("GET", "/api/ratings/me", p.token)).status, 403);
    assert.equal((await api("GET", "/api/ratings/me", admin.token)).status, 403);
  });
});

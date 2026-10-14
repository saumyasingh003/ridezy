import { after, afterEach, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { createServer, type Server as HttpServer } from "node:http";
import type { AddressInfo } from "node:net";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { io as ioClient, type Socket as ClientSocket } from "socket.io-client";
import jwt from "jsonwebtoken";

// Transactions need a replica set; a single-node one is enough.
const replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });

process.env.NODE_ENV = "test";
process.env.PAYMENT_PROVIDER = "mock"; // tests never call real Razorpay
process.env.MONGODB_URI = replSet.getUri("ridezy-communication-test");
process.env.JWT_SECRET = "test-jwt-secret-that-is-at-least-32-characters";
process.env.OTP_SECRET = "test-otp-secret-that-is-at-least-32-characters";
process.env.ROUTING_PROVIDER = "haversine";
process.env.MATCH_ALL_DRIVERS = "true";
// Short call timers so timeout paths can be tested quickly.
process.env.CALL_RING_TIMEOUT_SECONDS = "1";
process.env.CALL_CONNECT_TIMEOUT_SECONDS = "1";
process.env.CALL_RECONNECT_GRACE_SECONDS = "1";

const { createApp } = await import("./app.js");
const { initSocket } = await import("./config/socket.js");
const { connectDB, disconnectDB } = await import("./config/db.js");
const { User } = await import("./models/User.js");
const { DriverProfile } = await import("./models/DriverProfile.js");
const { Vehicle } = await import("./models/Vehicle.js");
const { DriverDocument } = await import("./models/DriverDocument.js");
const { Ride } = await import("./models/Ride.js");
const { RideMessage } = await import("./models/RideMessage.js");
const { Payment } = await import("./models/Payment.js");
const { Notification } = await import("./models/Notification.js");
const { signAccessToken } = await import("./utils/jwt.js");
const { closeRideCommunication } = await import("./services/rideCommunication.service.js");
const { notifications } = await import("./services/notification.service.js");

type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
interface Ack {
  ok: boolean;
  data?: Json;
  error?: { code: string; message: string };
}

const BORING_ROAD = { address: "Boring Road, Patna", latitude: 25.6127, longitude: 85.1589 };
const PATNA_JN = { address: "Patna Junction", latitude: 25.5941, longitude: 85.1376 };

let server: HttpServer;
let socketServer: Awaited<ReturnType<typeof initSocket>>;
let baseUrl: string;
const openSockets: ClientSocket[] = [];

async function api(method: string, path: string, token?: string, body?: unknown) {
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, body: (await res.json()) as { success: boolean; message: string; data?: Json } };
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

/** A verified, AVAILABLE driver who can accept rides. */
async function makeDriver() {
  const user = await makeUser("DRIVER");
  const profile = await DriverProfile.create({
    userId: user.id,
    licenseNumber: `BR01DL${String(seq).padStart(6, "0")}`,
    verificationStatus: "VERIFIED",
    availabilityStatus: "AVAILABLE",
    location: { type: "Point", coordinates: [BORING_ROAD.longitude, BORING_ROAD.latitude + 0.01] },
    lastLocationUpdatedAt: new Date(),
  });
  await Vehicle.create({
    driverId: profile._id,
    vehicleType: "BIKE",
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
      verificationStatus: "VERIFIED" as const,
    })),
  );
  return { ...user, profileId: profile.id as string };
}

/** Passenger books, nobody accepts yet. */
async function bookOnly() {
  const passenger = await makeUser("PASSENGER");
  const res = await api("POST", "/api/rides", passenger.token, { pickup: BORING_ROAD, destination: PATNA_JN, vehicleType: "BIKE" });
  assert.equal(res.status, 201, res.body.message);
  return { passenger, rideId: res.body.data!.id as string };
}

/** Passenger books and a driver accepts: communication is open. */
async function acceptedRide() {
  const driver = await makeDriver();
  const { passenger, rideId } = await bookOnly();
  const accepted = await api("POST", `/api/rides/${rideId}/accept`, driver.token);
  assert.equal(accepted.status, 200, accepted.body.message);
  return { passenger, driver, rideId };
}

async function completeRide(rideId: string, driverToken: string) {
  await api("POST", `/api/rides/${rideId}/arrive`, driverToken);
  const otp = (await Ride.findById(rideId))!.startOtp!;
  assert.equal((await api("POST", `/api/rides/${rideId}/start`, driverToken, { otp })).status, 200);
  return api("POST", `/api/rides/${rideId}/complete`, driverToken);
}

function connect(token?: string): Promise<ClientSocket> {
  const socket = ioClient(baseUrl, {
    auth: token ? { token } : {},
    transports: ["websocket"],
    reconnection: false,
    forceNew: true,
  });
  openSockets.push(socket);
  return new Promise((resolve, reject) => {
    socket.once("connect", () => resolve(socket));
    socket.once("connect_error", reject);
  });
}

function send(socket: ClientSocket, event: string, payload: unknown): Promise<Ack> {
  return socket.timeout(3000).emitWithAck(event, payload) as Promise<Ack>;
}

function nextEvent(socket: ClientSocket, event: string, timeoutMs = 3000): Promise<Json> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timed out waiting for ${event}`)), timeoutMs);
    socket.once(event, (payload: Json) => {
      clearTimeout(timer);
      resolve(payload);
    });
  });
}

/** Resolves true if `event` arrives within `ms`, false otherwise. */
function receives(socket: ClientSocket, event: string, ms = 300): Promise<boolean> {
  return nextEvent(socket, event, ms).then(
    () => true,
    () => false,
  );
}

/** Passenger calls the driver and the driver answers. */
async function answeredCall(rideId: string, caller: ClientSocket, callee: ClientSocket) {
  const incoming = nextEvent(callee, "call:incoming");
  const started = await send(caller, "call:initiate", { rideId });
  assert.equal(started.ok, true, started.error?.message);
  const callId = started.data!.call.callId as string;
  assert.equal((await incoming).callId, callId);
  const accepted = await send(callee, "call:accept", { rideId, callId });
  assert.equal(accepted.ok, true, accepted.error?.message);
  return callId;
}

const SDP_OFFER = { type: "offer", sdp: "v=0\r\no=- 1 2 IN IP4 127.0.0.1\r\n" };
const SDP_ANSWER = { type: "answer", sdp: "v=0\r\no=- 3 4 IN IP4 127.0.0.1\r\n" };

before(async () => {
  await connectDB();
  server = createServer(createApp());
  socketServer = initSocket(server);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterEach(async () => {
  for (const socket of openSockets.splice(0)) socket.disconnect();
  await Promise.all([
    User.deleteMany({}),
    DriverProfile.deleteMany({}),
    Vehicle.deleteMany({}),
    Ride.deleteMany({}),
    DriverDocument.deleteMany({}),
    RideMessage.deleteMany({}),
    Payment.deleteMany({}),
    Notification.deleteMany({}),
  ]);
});

after(async () => {
  await socketServer.close();
  await disconnectDB();
  await replSet.stop();
});

/* ================================ Socket auth ================================ */

describe("Socket authentication", () => {
  it("rejects connections without a valid JWT", async () => {
    await assert.rejects(connect(), /UNAUTHENTICATED/);
    await assert.rejects(connect("not-a-jwt"), /UNAUTHENTICATED/);
    const forged = jwt.sign({ role: "PASSENGER" }, "some-other-secret-that-is-long-enough!!", { subject: "x" });
    await assert.rejects(connect(forged), /UNAUTHENTICATED/);
  });

  it("re-checks the token on every event: an expired token is refused and disconnected", async () => {
    const { passenger, rideId } = await acceptedRide();
    const shortLived = jwt.sign({ role: "PASSENGER" }, process.env.JWT_SECRET!, {
      algorithm: "HS256",
      subject: passenger.id,
      expiresIn: 1,
    });
    const socket = await connect(shortLived);
    await new Promise((resolve) => setTimeout(resolve, 1100));

    const disconnected = nextEvent(socket, "disconnect");
    const res = await send(socket, "chat:send", { rideId, body: "hello" });
    assert.equal(res.error?.code, "UNAUTHENTICATED");
    await disconnected;
  });
});

/* =================================== Chat =================================== */

describe("Ride chat", () => {
  it("is closed until a driver accepts the ride", async () => {
    const { passenger, rideId } = await bookOnly();
    const socket = await connect(passenger.token);

    const res = await send(socket, "chat:send", { rideId, body: "Where are you?" });
    assert.equal(res.error?.code, "COMMUNICATION_NOT_STARTED");

    const status = await api("GET", `/api/rides/${rideId}/communication`, passenger.token);
    assert.equal(status.status, 200);
    assert.equal(status.body.data!.canChat, false);
    assert.equal(status.body.data!.closedReason, "WAITING_FOR_DRIVER");
    assert.equal(status.body.data!.counterpart, null);
  });

  it("delivers messages both ways in real time and persists them", async () => {
    const { passenger, driver, rideId } = await acceptedRide();
    const [p, d] = await Promise.all([connect(passenger.token), connect(driver.token)]);

    const toDriver = nextEvent(d, "chat:message");
    const sent = await send(p, "chat:send", { rideId, body: "  I'm at the gate  " });
    assert.equal(sent.ok, true, sent.error?.message);
    assert.equal(sent.data!.message.body, "I'm at the gate"); // trimmed
    const received = await toDriver;
    assert.equal(received.id, sent.data!.message.id);
    assert.equal(received.senderRole, "PASSENGER");

    const toPassenger = nextEvent(p, "chat:message");
    assert.equal((await send(d, "chat:send", { rideId, body: "2 minutes away" })).ok, true);
    assert.equal((await toPassenger).senderRole, "DRIVER");

    // Survives a refresh: history over REST for both sides, oldest first.
    for (const token of [passenger.token, driver.token]) {
      const history = await api("GET", `/api/rides/${rideId}/messages`, token);
      assert.equal(history.status, 200);
      assert.deepEqual(
        history.body.data!.messages.map((m: Json) => m.body),
        ["I'm at the gate", "2 minutes away"],
      );
    }

    const status = await api("GET", `/api/rides/${rideId}/communication`, passenger.token);
    assert.equal(status.body.data!.canChat, true);
    assert.equal(status.body.data!.canCall, true);
    assert.equal(status.body.data!.counterpart.role, "DRIVER");
    assert.equal(status.body.data!.counterpart.online, true);
    assert.ok(Array.isArray(status.body.data!.rtc.iceServers));
  });

  it("paginates history with a cursor", async () => {
    const { passenger, rideId } = await acceptedRide();
    const p = await connect(passenger.token);
    for (const n of [1, 2, 3, 4, 5]) assert.equal((await send(p, "chat:send", { rideId, body: `m${n}` })).ok, true);

    const first = await api("GET", `/api/rides/${rideId}/messages?limit=2`, passenger.token);
    assert.deepEqual(first.body.data!.messages.map((m: Json) => m.body), ["m4", "m5"]);
    assert.equal(first.body.data!.hasMore, true);

    const second = await api("GET", `/api/rides/${rideId}/messages?limit=2&before=${first.body.data!.nextCursor}`, passenger.token);
    assert.deepEqual(second.body.data!.messages.map((m: Json) => m.body), ["m2", "m3"]);

    const last = await api("GET", `/api/rides/${rideId}/messages?limit=2&before=${second.body.data!.nextCursor}`, passenger.token);
    assert.deepEqual(last.body.data!.messages.map((m: Json) => m.body), ["m1"]);
    assert.equal(last.body.data!.hasMore, false);
    assert.equal(last.body.data!.nextCursor, null);

    assert.equal((await api("GET", `/api/rides/${rideId}/messages?limit=500`, passenger.token)).status, 400);
    assert.equal((await api("GET", `/api/rides/${rideId}/messages?before=nope`, passenger.token)).status, 400);
  });

  it("validates messages", async () => {
    const { passenger, rideId } = await acceptedRide();
    const p = await connect(passenger.token);

    for (const payload of [
      { rideId, body: "   " },
      { rideId, body: "x".repeat(1001) },
      { rideId },
      { rideId: "not-an-id", body: "hi" },
      { rideId, body: "hi", clientMessageId: "has spaces!" },
    ]) {
      const res = await send(p, "chat:send", payload);
      assert.equal(res.error?.code, "VALIDATION_ERROR", JSON.stringify(payload));
    }
    assert.equal((await send(p, "chat:send", { rideId, body: "x".repeat(1000) })).ok, true);
  });

  it("is idempotent per clientMessageId (safe resend after reconnect)", async () => {
    const { passenger, rideId } = await acceptedRide();
    const p = await connect(passenger.token);

    const results = await Promise.all([1, 2, 3].map(() => send(p, "chat:send", { rideId, body: "hello", clientMessageId: "abc-1" })));
    assert.ok(results.every((r) => r.ok));
    assert.equal(new Set(results.map((r) => r.data!.message.id)).size, 1);
    assert.equal(await RideMessage.countDocuments({ rideId }), 1);
  });

  it("refuses unrelated users", async () => {
    const { rideId } = await acceptedRide();
    const strangerPassenger = await makeUser("PASSENGER");
    const strangerDriver = await makeDriver();
    const admin = await makeUser("ADMIN");

    for (const user of [strangerPassenger, strangerDriver]) {
      const socket = await connect(user.token);
      assert.equal((await send(socket, "chat:send", { rideId, body: "hi" })).error?.code, "RIDE_NOT_FOUND");
      assert.equal((await send(socket, "call:initiate", { rideId })).error?.code, "RIDE_NOT_FOUND");
      assert.equal((await api("GET", `/api/rides/${rideId}/messages`, user.token)).status, 404);
      assert.equal((await api("GET", `/api/rides/${rideId}/communication`, user.token)).status, 404);
    }

    const adminSocket = await connect(admin.token);
    assert.equal((await send(adminSocket, "chat:send", { rideId, body: "hi" })).error?.code, "FORBIDDEN");
    assert.equal((await api("GET", `/api/rides/${rideId}/messages`, admin.token)).status, 403);
    assert.equal((await api("GET", `/api/rides/${rideId}/messages`)).status, 401);
  });

  it("does not leak messages to other users' sockets", async () => {
    const { passenger, driver, rideId } = await acceptedRide();
    const other = await acceptedRide();
    const [p, d, otherP, otherD] = await Promise.all([
      connect(passenger.token),
      connect(driver.token),
      connect(other.passenger.token),
      connect(other.driver.token),
    ]);

    const leakP = receives(otherP, "chat:message");
    const leakD = receives(otherD, "chat:message");
    const delivered = nextEvent(d, "chat:message");
    await send(p, "chat:send", { rideId, body: "private" });
    await delivered;
    assert.equal(await leakP, false);
    assert.equal(await leakD, false);
  });
});

/* =============================== Live tracking ============================== */

describe("Live driver tracking", () => {
  it("pushes the driver's new location to the ride's passenger only", async () => {
    const { passenger, driver, rideId } = await acceptedRide();
    const other = await acceptedRide();
    const [p, otherP, d] = await Promise.all([connect(passenger.token), connect(other.passenger.token), connect(driver.token)]);

    const pushed = nextEvent(p, "ride:driver-location");
    const leakOther = receives(otherP, "ride:driver-location");
    const leakDriver = receives(d, "ride:driver-location");
    const res = await api("PATCH", "/api/drivers/location", driver.token, { latitude: 25.62, longitude: 85.16 });
    assert.equal(res.status, 200);

    const event = await pushed;
    assert.equal(event.rideId, rideId);
    assert.equal(event.latitude, 25.62);
    assert.equal(event.longitude, 85.16);
    assert.equal(event.heading, "PICKUP");
    assert.ok(event.etaMinutes >= 1);
    assert.equal(await leakOther, false);
    assert.equal(await leakDriver, false);
  });

  it("stops once the ride is over", async () => {
    const { passenger, driver, rideId } = await acceptedRide();
    const p = await connect(passenger.token);
    assert.equal((await completeRide(rideId, driver.token)).status, 200);

    const pushed = receives(p, "ride:driver-location", 500);
    await api("PATCH", "/api/drivers/location", driver.token, { latitude: 25.62, longitude: 85.16 });
    assert.equal(await pushed, false);
  });
});

/* =============================== Notifications ============================== */

describe("Notifications (real time)", () => {
  it("pushes a new notification to the recipient's room and stores it", async () => {
    const driver = await makeDriver();
    const { passenger, rideId } = await bookOnly();
    const [p, d] = await Promise.all([connect(passenger.token), connect(driver.token)]);

    const pushed = nextEvent(p, "notification:new");
    const leak = receives(d, "notification:new");
    assert.equal((await api("POST", `/api/rides/${rideId}/accept`, driver.token)).status, 200);

    const { notification, unreadCount } = await pushed;
    assert.equal(notification.type, "RIDE_ACCEPTED");
    assert.equal(notification.recipientId, passenger.id);
    assert.equal(notification.rideId, rideId);
    assert.equal(notification.isRead, false);
    assert.match(notification.message, /accepted your ride/);
    assert.equal(unreadCount, 1);
    assert.equal(await leak, false);

    const count = await api("GET", "/api/notifications/unread-count", passenger.token);
    assert.equal(count.status, 200);
    assert.equal(count.body.data!.unreadCount, 1);
    const list = await api("GET", "/api/notifications?page=1&limit=10", passenger.token);
    assert.equal(list.body.data!.notifications[0].id, notification.id);
  });

  it("read state is per user and syncs the badge live", async () => {
    const driver = await makeDriver();
    const { passenger, rideId } = await bookOnly();
    const p = await connect(passenger.token);
    const created = nextEvent(p, "notification:new");
    await api("POST", `/api/rides/${rideId}/accept`, driver.token);
    const { notification } = await created;

    // Someone else can't read or mark it.
    const stranger = await makeUser("PASSENGER");
    assert.equal((await api("PATCH", `/api/notifications/${notification.id}/read`, stranger.token)).status, 404);
    assert.equal((await api("GET", "/api/notifications", stranger.token)).body.data!.notifications.length, 0);
    assert.equal((await api("GET", "/api/notifications/unread-count")).status, 401);

    const synced = nextEvent(p, "notification:unread-count");
    const read = await api("PATCH", `/api/notifications/${notification.id}/read`, passenger.token);
    assert.equal(read.body.data!.isRead, true);
    assert.equal((await synced).unreadCount, 0);
    assert.equal((await api("PATCH", "/api/notifications/read-all", passenger.token)).body.data!.updated, 0);
  });

  it("'driver approaching' fires once, when the driver gets close to the pickup", async () => {
    const { passenger, driver, rideId } = await acceptedRide();
    const p = await connect(passenger.token);

    // Far away (~3 km): nothing yet.
    const early = receives(p, "notification:new", 500);
    await api("PATCH", "/api/drivers/location", driver.token, { latitude: 25.64, longitude: 85.1589 });
    assert.equal(await early, false);
    assert.equal((await Ride.findById(rideId))!.status, "DRIVER_ASSIGNED");

    // ~200 m away: approaching, ride moves to DRIVER_ARRIVING.
    const approaching = nextEvent(p, "notification:new");
    await api("PATCH", "/api/drivers/location", driver.token, { latitude: 25.6145, longitude: 85.1589 });
    assert.equal((await approaching).notification.type, "DRIVER_APPROACHING");
    assert.equal((await Ride.findById(rideId))!.status, "DRIVER_ARRIVING");

    // Closer still: no second notification.
    const again = receives(p, "notification:new", 500);
    await api("PATCH", "/api/drivers/location", driver.token, { latitude: 25.6135, longitude: 85.1589 });
    assert.equal(await again, false);
    assert.equal(await Notification.countDocuments({ rideId, type: "DRIVER_APPROACHING" }), 1);

    // The trip continues normally from DRIVER_ARRIVING.
    assert.equal((await api("POST", `/api/rides/${rideId}/arrive`, driver.token)).status, 200);
  });

  it("tells the driver live when the passenger cancels", async () => {
    const { passenger, driver, rideId } = await acceptedRide();
    const d = await connect(driver.token);
    const pushed = nextEvent(d, "notification:new");
    await api("PATCH", `/api/rides/${rideId}/cancel`, passenger.token, {});
    const { notification } = await pushed;
    assert.equal(notification.type, "RIDE_CANCELLED");
    assert.equal(notification.recipientId, driver.id);
  });

  it("never stores a ride event twice for the same person", async () => {
    const { passenger, rideId } = await acceptedRide();
    await Promise.all([
      notifications.rideStarted(passenger.id, rideId),
      notifications.rideStarted(passenger.id, rideId),
      notifications.rideStarted(passenger.id, rideId),
    ]);
    assert.equal(await Notification.countDocuments({ userId: passenger.id, rideId, type: "RIDE_STARTED" }), 1);
  });
});

/* =============================== Phone numbers ============================== */

describe("Phone numbers", () => {
  it("are shared between passenger and driver only while the ride is active", async () => {
    const { passenger, driver, rideId } = await acceptedRide();
    await User.updateOne({ _id: passenger.id }, { $set: { phone: "+919876500001" } });
    await User.updateOne({ _id: driver.id }, { $set: { phone: "+919876500002" } });

    const forPassenger = await api("GET", `/api/rides/${rideId}/communication`, passenger.token);
    const forDriver = await api("GET", `/api/rides/${rideId}/communication`, driver.token);
    assert.equal(forPassenger.body.data!.counterpart.phone, "+919876500002");
    assert.equal(forDriver.body.data!.counterpart.phone, "+919876500001");

    // Strangers never get it.
    const stranger = await makeUser("PASSENGER");
    assert.equal((await api("GET", `/api/rides/${rideId}/communication`, stranger.token)).status, 404);

    // Hidden once the ride ends.
    assert.equal((await completeRide(rideId, driver.token)).status, 200);
    const after = await api("GET", `/api/rides/${rideId}/communication`, passenger.token);
    assert.equal(after.body.data!.counterpart.phone, null);
  });

  it("is null when the other person has no phone on file", async () => {
    const { passenger, rideId } = await acceptedRide();
    const res = await api("GET", `/api/rides/${rideId}/communication`, passenger.token);
    assert.equal(res.body.data!.counterpart.phone, null);
  });
});

/* ============================== Ride lifecycle ============================== */

describe("Communication closes when the ride ends", () => {
  it("on completion: both are notified, sending is refused, history stays readable", async () => {
    const { passenger, driver, rideId } = await acceptedRide();
    const [p, d] = await Promise.all([connect(passenger.token), connect(driver.token)]);
    assert.equal((await send(p, "chat:send", { rideId, body: "see you" })).ok, true);

    const closedP = nextEvent(p, "communication:closed");
    const closedD = nextEvent(d, "communication:closed");
    assert.equal((await completeRide(rideId, driver.token)).status, 200);
    assert.deepEqual(await closedP, { rideId, reason: "RIDE_COMPLETED" });
    assert.deepEqual(await closedD, { rideId, reason: "RIDE_COMPLETED" });

    assert.equal((await send(p, "chat:send", { rideId, body: "thanks" })).error?.code, "COMMUNICATION_CLOSED");
    assert.equal((await send(d, "chat:send", { rideId, body: "bye" })).error?.code, "COMMUNICATION_CLOSED");
    assert.equal((await send(p, "call:initiate", { rideId })).error?.code, "COMMUNICATION_CLOSED");

    const history = await api("GET", `/api/rides/${rideId}/messages`, driver.token);
    assert.equal(history.status, 200);
    assert.equal(history.body.data!.messages.length, 1);
    const status = await api("GET", `/api/rides/${rideId}/communication`, passenger.token);
    assert.equal(status.body.data!.canChat, false);
    assert.equal(status.body.data!.closedReason, "RIDE_COMPLETED");
  });

  it("on cancellation: an ongoing call is terminated", async () => {
    const { passenger, driver, rideId } = await acceptedRide();
    const [p, d] = await Promise.all([connect(passenger.token), connect(driver.token)]);
    const callId = await answeredCall(rideId, p, d);
    await send(p, "call:connected", { rideId, callId });

    const endedP = nextEvent(p, "call:ended");
    const endedD = nextEvent(d, "call:ended");
    const closedD = nextEvent(d, "communication:closed");
    assert.equal((await api("PATCH", `/api/rides/${rideId}/cancel`, passenger.token, {})).status, 200);

    assert.equal((await endedP).reason, "RIDE_ENDED");
    assert.equal((await endedD).reason, "RIDE_ENDED");
    assert.deepEqual(await closedD, { rideId, reason: "RIDE_CANCELLED" });

    assert.equal((await send(d, "call:offer", { rideId, callId, description: SDP_OFFER })).error?.code, "COMMUNICATION_CLOSED");
    assert.equal((await send(d, "call:initiate", { rideId })).error?.code, "COMMUNICATION_CLOSED");
    assert.equal((await send(d, "chat:send", { rideId, body: "?" })).error?.code, "COMMUNICATION_CLOSED");
  });

  it("RACE: messages sent while the ride completes are either saved before it or refused", async () => {
    const { passenger, driver, rideId } = await acceptedRide();
    const p = await connect(passenger.token);
    await api("POST", `/api/rides/${rideId}/arrive`, driver.token);
    const otp = (await Ride.findById(rideId))!.startOtp!;
    await api("POST", `/api/rides/${rideId}/start`, driver.token, { otp });

    const [completed, ...acks] = await Promise.all([
      api("POST", `/api/rides/${rideId}/complete`, driver.token),
      ...Array.from({ length: 15 }, (_, i) => send(p, "chat:send", { rideId, body: `m${i}` })),
    ]);
    assert.equal(completed.status, 200);

    for (const ack of acks) assert.ok(ack.ok || ack.error?.code === "COMMUNICATION_CLOSED", JSON.stringify(ack));
    // Exactly the acknowledged messages exist: none were saved and then refused.
    assert.equal(await RideMessage.countDocuments({ rideId }), acks.filter((a) => a.ok).length);
    assert.equal((await send(p, "chat:send", { rideId, body: "late" })).error?.code, "COMMUNICATION_CLOSED");
  });
});

/* ============================ Driver reassignment ============================ */

describe("Driver reassignment", () => {
  it("revokes the previous driver's access immediately", async () => {
    const { passenger, driver: oldDriver, rideId } = await acceptedRide();
    const newDriver = await makeDriver();
    const [p, oldD] = await Promise.all([connect(passenger.token), connect(oldDriver.token)]);
    const callId = await answeredCall(rideId, p, oldD);

    // No reassignment flow exists yet; simulate one, then run the hook it must call.
    const ended = nextEvent(oldD, "call:ended");
    const revoked = nextEvent(oldD, "communication:closed");
    await Ride.updateOne({ _id: rideId }, { $set: { assignedDriverId: newDriver.profileId } });
    closeRideCommunication(rideId, "DRIVER_REASSIGNED", [oldDriver.id]);
    assert.equal((await ended).reason, "ACCESS_REVOKED");
    assert.deepEqual(await revoked, { rideId, reason: "DRIVER_REASSIGNED" });

    // The passenger now sees the new driver, never the old one.
    const status = await api("GET", `/api/rides/${rideId}/communication`, passenger.token);
    assert.equal(status.body.data!.counterpart.name, (await User.findById(newDriver.id))!.name);

    // Old driver: no access at all, not even history.
    assert.equal((await send(oldD, "chat:send", { rideId, body: "hello?" })).error?.code, "RIDE_NOT_FOUND");
    assert.equal((await send(oldD, "call:initiate", { rideId })).error?.code, "RIDE_NOT_FOUND");
    assert.equal((await send(oldD, "call:offer", { rideId, callId, description: SDP_OFFER })).error?.code, "RIDE_NOT_FOUND");
    assert.equal((await api("GET", `/api/rides/${rideId}/messages`, oldDriver.token)).status, 404);

    // New driver takes over; the old driver's still-open socket hears nothing.
    const newD = await connect(newDriver.token);
    const leak = receives(oldD, "chat:message");
    const delivered = nextEvent(newD, "chat:message");
    assert.equal((await send(p, "chat:send", { rideId, body: "new driver?" })).ok, true);
    await delivered;
    assert.equal(await leak, false);
  });

  it("is enforced even without the hook (every event re-reads the ride)", async () => {
    const { passenger, driver: oldDriver, rideId } = await acceptedRide();
    const newDriver = await makeDriver();
    const oldD = await connect(oldDriver.token);
    assert.equal((await send(oldD, "chat:send", { rideId, body: "before" })).ok, true);

    await Ride.updateOne({ _id: rideId }, { $set: { assignedDriverId: newDriver.profileId } });
    assert.equal((await send(oldD, "chat:send", { rideId, body: "after" })).error?.code, "RIDE_NOT_FOUND");
    assert.equal((await api("GET", `/api/rides/${rideId}/communication`, passenger.token)).body.data!.canChat, true);
  });
});

/* ================================== Calls =================================== */

describe("Calls", () => {
  it("full flow: ring, accept, WebRTC signaling relay, connected, hang up", async () => {
    const { passenger, driver, rideId } = await acceptedRide();
    const [p, d] = await Promise.all([connect(passenger.token), connect(driver.token)]);

    // Driver calls the passenger (either side may call).
    const incoming = nextEvent(p, "call:incoming");
    const started = await send(d, "call:initiate", { rideId });
    assert.equal(started.ok, true, started.error?.message);
    const callId = started.data!.call.callId;
    assert.equal(started.data!.call.state, "RINGING");
    assert.equal(started.data!.call.direction, "OUTGOING");
    assert.ok(started.data!.rtc.iceServers.length > 0);
    const ring = await incoming;
    assert.equal(ring.direction, "INCOMING");
    assert.equal(ring.caller.role, "DRIVER");

    // Signaling before the call is answered is refused.
    assert.equal((await send(d, "call:offer", { rideId, callId, description: SDP_OFFER })).error?.code, "CALL_NOT_ANSWERED");

    const acceptedD = nextEvent(d, "call:accepted");
    assert.equal((await send(p, "call:accept", { rideId, callId })).ok, true);
    assert.equal((await acceptedD).callId, callId);

    const offer = nextEvent(p, "call:offer");
    assert.equal((await send(d, "call:offer", { rideId, callId, description: SDP_OFFER })).ok, true);
    assert.deepEqual((await offer).description, SDP_OFFER);

    const answer = nextEvent(d, "call:answer");
    assert.equal((await send(p, "call:answer", { rideId, callId, description: SDP_ANSWER })).ok, true);
    assert.deepEqual((await answer).description, SDP_ANSWER);

    const candidate = { candidate: "candidate:1 1 udp 2122260223 192.168.1.2 54321 typ host", sdpMid: "0", sdpMLineIndex: 0 };
    const ice = nextEvent(p, "call:ice-candidate");
    assert.equal((await send(d, "call:ice-candidate", { rideId, callId, candidate })).ok, true);
    assert.deepEqual((await ice).candidate, candidate);

    // Wrong SDP type for the event is refused.
    assert.equal((await send(d, "call:offer", { rideId, callId, description: SDP_ANSWER })).error?.code, "VALIDATION_ERROR");

    // ACTIVE only once a browser reports the peer connection is up.
    const active = nextEvent(p, "call:active");
    const connected = await send(d, "call:connected", { rideId, callId });
    assert.equal(connected.data!.call.state, "ACTIVE");
    assert.equal((await active).callId, callId);

    const status = await api("GET", `/api/rides/${rideId}/communication`, passenger.token);
    assert.equal(status.body.data!.activeCall.state, "ACTIVE");
    assert.equal(status.body.data!.activeCall.direction, "INCOMING");

    const ended = nextEvent(d, "call:ended");
    assert.equal((await send(p, "call:end", { rideId, callId })).ok, true);
    assert.equal((await ended).reason, "ENDED");
    assert.equal((await send(p, "call:end", { rideId, callId })).error?.code, "CALL_NOT_FOUND");
  });

  it("reject, cancel and busy", async () => {
    const { passenger, driver, rideId } = await acceptedRide();
    const [p, d] = await Promise.all([connect(passenger.token), connect(driver.token)]);

    // Callee rejects.
    let started = await send(p, "call:initiate", { rideId });
    let ended = nextEvent(p, "call:ended");
    assert.equal((await send(p, "call:accept", { rideId, callId: started.data!.call.callId })).error?.code, "FORBIDDEN"); // caller can't accept
    assert.equal((await send(d, "call:reject", { rideId, callId: started.data!.call.callId })).ok, true);
    assert.equal((await ended).reason, "REJECTED");

    // Caller cancels while ringing; a second call while one is ringing is busy.
    started = await send(p, "call:initiate", { rideId });
    assert.equal((await send(d, "call:initiate", { rideId })).error?.code, "CALL_BUSY");
    ended = nextEvent(d, "call:ended");
    assert.equal((await send(p, "call:end", { rideId, callId: started.data!.call.callId })).ok, true);
    assert.equal((await ended).reason, "CANCELLED");
  });

  it("can't call someone who isn't connected", async () => {
    const { passenger, rideId } = await acceptedRide();
    const p = await connect(passenger.token);
    assert.equal((await send(p, "call:initiate", { rideId })).error?.code, "PEER_OFFLINE");
  });

  it("times out when nobody answers, and when audio never connects", async () => {
    const { passenger, driver, rideId } = await acceptedRide();
    const [p, d] = await Promise.all([connect(passenger.token), connect(driver.token)]);

    const noAnswer = nextEvent(p, "call:ended");
    await send(p, "call:initiate", { rideId });
    assert.equal((await noAnswer).reason, "NO_ANSWER");

    await answeredCall(rideId, p, d); // accepted, but never reports "connected"
    assert.equal((await nextEvent(p, "call:ended")).reason, "CONNECTION_FAILED");
  });

  it("only the answering tab can signal; other tabs stop ringing", async () => {
    const { passenger, driver, rideId } = await acceptedRide();
    const [p, d1, d2] = await Promise.all([connect(passenger.token), connect(driver.token), connect(driver.token)]);

    const ring1 = nextEvent(d1, "call:incoming");
    const ring2 = nextEvent(d2, "call:incoming");
    const callId = (await send(p, "call:initiate", { rideId })).data!.call.callId;
    await Promise.all([ring1, ring2]);

    const otherTabNotified = nextEvent(d2, "call:accepted");
    assert.equal((await send(d1, "call:accept", { rideId, callId })).ok, true);
    assert.equal((await otherTabNotified).callId, callId);
    assert.equal((await send(d2, "call:accept", { rideId, callId })).error?.code, "CALL_ALREADY_ANSWERED");
    assert.equal((await send(d2, "call:answer", { rideId, callId, description: SDP_ANSWER })).error?.code, "FORBIDDEN");
  });

  it("survives a brief socket drop, but ends if the user doesn't come back", async () => {
    const { passenger, driver, rideId } = await acceptedRide();
    const p = await connect(passenger.token);
    let d = await connect(driver.token);
    const callId = await answeredCall(rideId, p, d);
    await send(d, "call:connected", { rideId, callId });

    // Drop and reconnect within the grace period: the call resumes on the new socket.
    d.disconnect();
    d = ioClient(baseUrl, { auth: { token: driver.token }, transports: ["websocket"], reconnection: false, forceNew: true });
    openSockets.push(d);
    const resumed = await nextEvent(d, "call:resumed");
    assert.equal(resumed.callId, callId);
    assert.equal(resumed.state, "ACTIVE");
    const offer = nextEvent(p, "call:offer");
    assert.equal((await send(d, "call:offer", { rideId, callId, description: SDP_OFFER })).ok, true);
    await offer;

    // Drop for good: the other side is told after the grace period.
    const ended = nextEvent(p, "call:ended", 3000);
    d.disconnect();
    assert.equal((await ended).reason, "PEER_DISCONNECTED");
  });
});

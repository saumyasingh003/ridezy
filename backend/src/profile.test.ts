import { after, afterEach, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { createServer, type Server as HttpServer } from "node:http";
import type { AddressInfo } from "node:net";
import { MongoMemoryServer } from "mongodb-memory-server";

const mongod = await MongoMemoryServer.create();

process.env.NODE_ENV = "test";
process.env.MONGODB_URI = mongod.getUri("ridezy-profile-test");
process.env.JWT_SECRET = "test-jwt-secret-that-is-at-least-32-characters";
process.env.OTP_SECRET = "test-otp-secret-that-is-at-least-32-characters";

const { createApp } = await import("./app.js");
const { connectDB, disconnectDB } = await import("./config/db.js");
const { User } = await import("./models/User.js");
const { PassengerProfile } = await import("./models/PassengerProfile.js");
const { DriverProfile } = await import("./models/DriverProfile.js");
const { Vehicle } = await import("./models/Vehicle.js");
const { DriverDocument } = await import("./models/DriverDocument.js");
const { signAccessToken } = await import("./utils/jwt.js");

type Json = Record<string, unknown> & { [key: string]: any }; // eslint-disable-line @typescript-eslint/no-explicit-any
interface ApiResult {
  status: number;
  body: { success: boolean; message: string; data?: Json; errors?: { field: string; message: string }[] };
}

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
/** A verified user + JWT, created directly (auth has its own tests). */
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

const DOCS = ["AADHAAR", "DRIVING_LICENSE"] as const;
/** A valid-format number for each document type. */
const docNumber = (type: (typeof DOCS)[number], n: number) =>
  type === "AADHAAR" ? `2${String(n).padStart(11, "0")}` : `BR01DL${String(n).padStart(9, "0")}`;

/** Driver with profile + vehicle + all required documents, ready for admin review. */
async function makeCompleteDriver(n: number) {
  const driver = await makeUser("DRIVER");
  const profile = await api("POST", "/api/drivers/profile", driver.token, { licenseNumber: `BR01202300${1000 + n}` });
  assert.equal(profile.status, 201);
  const vehicle = await api("POST", "/api/drivers/vehicle", driver.token, {
    vehicleType: "CAB",
    make: "Maruti",
    model: "Dzire",
    year: 2023,
    color: "White",
    registrationNumber: `BR01CD${1000 + n}`,
  });
  assert.equal(vehicle.status, 201);
  for (const documentType of DOCS) {
    const doc = await api("POST", "/api/drivers/documents", driver.token, {
      documentType,
      documentNumber: docNumber(documentType, n),
      documentUrl: `https://files.example.com/${n}/${documentType}.jpg`,
    });
    assert.equal(doc.status, 201, `${documentType}: ${doc.body.message}`);
  }
  return { ...driver, profileId: profile.body.data!.id as string };
}

before(async () => {
  await connectDB();
  server = createServer(createApp());
  await new Promise<void>((resolve) => server.listen(0, resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterEach(async () => {
  await Promise.all(
    [User, PassengerProfile, DriverProfile, Vehicle, DriverDocument].map((m) => (m as typeof User).deleteMany({})),
  );
});

after(async () => {
  server.closeAllConnections();
  server.close();
  await disconnectDB();
  await mongod.stop();
});

/* ================================ Passenger ================================ */

describe("Passenger profile", () => {
  it("creates a profile (phone normalised, stored on User)", async () => {
    const p = await makeUser("PASSENGER");
    const res = await api("POST", "/api/passengers/profile", p.token, {
      phone: "9876543210",
      gender: "FEMALE",
      dateOfBirth: "2003-04-15",
    });

    assert.equal(res.status, 201);
    assert.equal(res.body.data!.phone, "+919876543210");
    assert.equal(res.body.data!.gender, "FEMALE");
    assert.equal(res.body.data!.userId, undefined, "internal ids are not exposed");
    assert.equal((await User.findById(p.id))!.phone, "+919876543210");
  });

  it("rejects a second profile for the same passenger", async () => {
    const p = await makeUser("PASSENGER");
    await api("POST", "/api/passengers/profile", p.token, {});
    const res = await api("POST", "/api/passengers/profile", p.token, {});

    assert.equal(res.status, 409);
    assert.equal(await PassengerProfile.countDocuments(), 1);
  });

  it("retrieves the profile, or 404 before it exists", async () => {
    const p = await makeUser("PASSENGER");
    assert.equal((await api("GET", "/api/passengers/profile", p.token)).status, 404);

    await api("POST", "/api/passengers/profile", p.token, { gender: "MALE" });
    const res = await api("GET", "/api/passengers/profile", p.token);
    assert.equal(res.status, 200);
    assert.equal(res.body.data!.gender, "MALE");
    assert.equal(res.body.data!.email, "passenger" + seq + "@example.com");
  });

  it("updates the profile, and null clears an optional field", async () => {
    const p = await makeUser("PASSENGER");
    await api("POST", "/api/passengers/profile", p.token, { gender: "MALE" });

    const res = await api("PATCH", "/api/passengers/profile", p.token, {
      profileImage: "https://example.com/profile.jpg",
      gender: null,
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.message, "Profile updated successfully.");
    assert.equal(res.body.data!.profileImage, "https://example.com/profile.jpg");
    assert.equal(res.body.data!.gender, undefined);
  });

  it("ignores a userId in the body: the JWT decides whose profile it is", async () => {
    const victim = await makeUser("PASSENGER");
    const attacker = await makeUser("PASSENGER");

    await api("POST", "/api/passengers/profile", attacker.token, { userId: victim.id });

    assert.equal(await PassengerProfile.countDocuments({ userId: victim.id }), 0);
    assert.equal(await PassengerProfile.countDocuments({ userId: attacker.id }), 1);
  });

  it("validates input", async () => {
    const p = await makeUser("PASSENGER");
    const res = await api("POST", "/api/passengers/profile", p.token, {
      phone: "123",
      dateOfBirth: "2999-01-01",
      gender: "ROBOT",
      profileImage: "javascript:alert(1)",
    });

    assert.equal(res.status, 400);
    const fields = res.body.errors!.map((e) => e.field).sort();
    assert.deepEqual(fields, ["dateOfBirth", "gender", "phone", "profileImage"]);
  });

  it("deletes the profile", async () => {
    const p = await makeUser("PASSENGER");
    await api("POST", "/api/passengers/profile", p.token, {});

    assert.equal((await api("DELETE", "/api/passengers/profile", p.token)).status, 200);
    assert.equal(await PassengerProfile.countDocuments(), 0);
  });
});

describe("Passenger saved places", () => {
  const home = { type: "HOME", address: "12 MG Road, Patna", latitude: 25.61, longitude: 85.14 };

  it("adds a HOME place (label defaults to 'Home') and allows only one HOME", async () => {
    const p = await makeUser("PASSENGER");
    await api("POST", "/api/passengers/profile", p.token, {});

    const res = await api("POST", "/api/passengers/saved-places", p.token, home);
    assert.equal(res.status, 201);
    assert.equal(res.body.data!.savedPlaces.length, 1);
    assert.equal(res.body.data!.savedPlaces[0].label, "Home");
    assert.ok(res.body.data!.savedPlaces[0].id);

    const second = await api("POST", "/api/passengers/saved-places", p.token, home);
    assert.equal(second.status, 409);
  });

  it("updates a saved place", async () => {
    const p = await makeUser("PASSENGER");
    await api("POST", "/api/passengers/profile", p.token, {});
    const placeId = (await api("POST", "/api/passengers/saved-places", p.token, home)).body.data!.savedPlaces[0].id;

    const res = await api("PATCH", `/api/passengers/saved-places/${placeId}`, p.token, { label: "My flat" });
    assert.equal(res.status, 200);
    assert.equal(res.body.data!.savedPlaces[0].label, "My flat");
    assert.equal(res.body.data!.savedPlaces[0].address, home.address);
  });

  it("deletes a saved place, then 404s for it", async () => {
    const p = await makeUser("PASSENGER");
    await api("POST", "/api/passengers/profile", p.token, {});
    const placeId = (await api("POST", "/api/passengers/saved-places", p.token, home)).body.data!.savedPlaces[0].id;

    const res = await api("DELETE", `/api/passengers/saved-places/${placeId}`, p.token);
    assert.equal(res.status, 200);
    assert.equal(res.body.data!.savedPlaces.length, 0);

    assert.equal((await api("DELETE", `/api/passengers/saved-places/${placeId}`, p.token)).status, 404);
    assert.equal((await api("DELETE", "/api/passengers/saved-places/not-an-id", p.token)).status, 400);
  });
});

/* ================================== Driver ================================= */

describe("Driver profile, vehicle and documents", () => {
  it("creates a driver profile as PENDING / OFFLINE", async () => {
    const d = await makeUser("DRIVER");
    const res = await api("POST", "/api/drivers/profile", d.token, {
      licenseNumber: "br01 2023-0001234",
      phone: "+91 91234 56789",
    });

    assert.equal(res.status, 201);
    assert.equal(res.body.data!.licenseNumber, "BR0120230001234");
    assert.equal(res.body.data!.verificationStatus, "PENDING");
    assert.equal(res.body.data!.availabilityStatus, "OFFLINE");
    assert.equal(res.body.data!.phone, "+919123456789");

    const again = await api("POST", "/api/drivers/profile", d.token, { licenseNumber: "BR0120230009999" });
    assert.equal(again.status, 409, "duplicate profile");
  });

  it("adds a vehicle (registration number normalised)", async () => {
    const d = await makeUser("DRIVER");
    await api("POST", "/api/drivers/profile", d.token, { licenseNumber: "BR0120230001234" });

    const res = await api("POST", "/api/drivers/vehicle", d.token, {
      vehicleType: "BIKE",
      make: "Honda",
      model: "Shine",
      year: 2024,
      color: "Black",
      registrationNumber: "br 01 ab-1234",
    });
    assert.equal(res.status, 201);
    assert.equal(res.body.data!.registrationNumber, "BR01AB1234");

    const got = await api("GET", "/api/drivers/vehicle", d.token);
    assert.equal(got.body.data!.model, "Shine");
  });

  it("rejects a duplicate vehicle registration number", async () => {
    const vehicle = { vehicleType: "AUTO", make: "Bajaj", model: "RE", year: 2022, color: "Green" };
    const a = await makeUser("DRIVER");
    const b = await makeUser("DRIVER");
    await api("POST", "/api/drivers/profile", a.token, { licenseNumber: "BR0120230000001" });
    await api("POST", "/api/drivers/profile", b.token, { licenseNumber: "BR0120230000002" });

    await api("POST", "/api/drivers/vehicle", a.token, { ...vehicle, registrationNumber: "BR01AB1234" });
    const res = await api("POST", "/api/drivers/vehicle", b.token, { ...vehicle, registrationNumber: "br-01-ab 1234" });

    assert.equal(res.status, 409);
    assert.equal(res.body.message, "A vehicle with this registration number is already registered.");
  });

  it("submits and lists documents; one per type", async () => {
    const d = await makeUser("DRIVER");
    await api("POST", "/api/drivers/profile", d.token, { licenseNumber: "BR0120230001234" });

    const doc = { documentType: "DRIVING_LICENSE", documentNumber: "BR0120230001234", documentUrl: "https://files.example.com/dl.jpg" };
    const res = await api("POST", "/api/drivers/documents", d.token, doc);
    assert.equal(res.status, 201);
    assert.equal(res.body.data!.verificationStatus, "PENDING");

    const aadhaar = await api("POST", "/api/drivers/documents", d.token, {
      ...doc,
      documentType: "AADHAAR",
      documentNumber: "2341 2341 2341",
    });
    assert.equal(aadhaar.status, 201);
    assert.equal(aadhaar.body.data!.documentNumber, "234123412341", "spaces removed");
    assert.equal((await api("POST", "/api/drivers/documents", d.token, doc)).status, 409, "same type twice");

    const list = await api("GET", "/api/drivers/documents", d.token);
    assert.equal(list.status, 200);
    assert.deepEqual(
      (list.body.data as unknown as { documentType: string }[]).map((x) => x.documentType),
      ["AADHAAR", "DRIVING_LICENSE"],
    );
  });

  it("accepts only AADHAAR and DRIVING_LICENSE, with valid numbers", async () => {
    const d = await makeUser("DRIVER");
    await api("POST", "/api/drivers/profile", d.token, { licenseNumber: "BR0120230001234" });
    const url = "https://files.example.com/doc.jpg";

    const oldType = await api("POST", "/api/drivers/documents", d.token, {
      documentType: "INSURANCE",
      documentNumber: "INS12345",
      documentUrl: url,
    });
    assert.equal(oldType.status, 400);
    assert.equal(oldType.body.errors![0]!.field, "documentType");

    for (const bad of ["12345678901", "123456789012", "0234123412341", "2341ABCD2341"]) {
      const res = await api("POST", "/api/drivers/documents", d.token, {
        documentType: "AADHAAR",
        documentNumber: bad,
        documentUrl: url,
      });
      assert.equal(res.status, 400, `Aadhaar ${bad}`);
      assert.equal(res.body.errors![0]!.field, "documentNumber");
    }

    // PATCH checks the number against the stored document's type.
    const created = await api("POST", "/api/drivers/documents", d.token, {
      documentType: "AADHAAR",
      documentNumber: "234123412341",
      documentUrl: url,
    });
    const patch = await api("PATCH", `/api/drivers/documents/${created.body.data!.id}`, d.token, {
      documentNumber: "BR0120230001234",
    });
    assert.equal(patch.status, 400);
    assert.match(patch.body.message, /Aadhaar number must be 12 digits/);
  });

  it("cannot verify itself (status fields in the body are ignored, admin route is 403)", async () => {
    const d = await makeCompleteDriver(1);

    await api("PATCH", "/api/drivers/profile", d.token, { verificationStatus: "VERIFIED", gender: "MALE" });
    await api("PATCH", `/api/drivers/documents/${(await DriverDocument.findOne())!.id}`, d.token, {
      documentUrl: "https://files.example.com/new.jpg",
      verificationStatus: "VERIFIED",
    });

    assert.equal((await DriverProfile.findById(d.profileId))!.verificationStatus, "PENDING");
    assert.equal(await DriverDocument.countDocuments({ verificationStatus: "VERIFIED" }), 0);
    assert.equal((await api("PATCH", `/api/admin/drivers/${d.profileId}/verify`, d.token)).status, 403);
  });

  it("cannot modify another driver's document (404, not revealed)", async () => {
    const a = await makeCompleteDriver(1);
    const b = await makeCompleteDriver(2);
    const aDoc = (await DriverDocument.findOne({ driverId: a.profileId }))!;

    const res = await api("PATCH", `/api/drivers/documents/${aDoc.id}`, b.token, {
      documentUrl: "https://evil.example.com/fake.jpg",
    });

    assert.equal(res.status, 404);
    assert.equal((await DriverDocument.findById(aDoc.id))!.documentUrl, aDoc.documentUrl);
  });
});

/* =============================== Access control ============================ */

describe("Role-based access", () => {
  it("passenger cannot access driver APIs", async () => {
    const p = await makeUser("PASSENGER");
    assert.equal((await api("GET", "/api/drivers/profile", p.token)).status, 403);
    assert.equal((await api("POST", "/api/drivers/vehicle", p.token, {})).status, 403);
  });

  it("driver cannot access admin or passenger APIs", async () => {
    const d = await makeUser("DRIVER");
    assert.equal((await api("GET", "/api/admin/drivers/pending-verification", d.token)).status, 403);
    assert.equal((await api("GET", "/api/passengers/profile", d.token)).status, 403);
  });

  it("requires a token", async () => {
    assert.equal((await api("GET", "/api/passengers/profile")).status, 401);
    assert.equal((await api("GET", "/api/admin/drivers/pending-verification")).status, 401);
  });
});

/* ============================ Admin verification =========================== */

describe("Admin driver verification", () => {
  it("lists pending drivers with what is still missing", async () => {
    const admin = await makeUser("ADMIN");
    await makeCompleteDriver(1);
    const incomplete = await makeUser("DRIVER");
    await api("POST", "/api/drivers/profile", incomplete.token, { licenseNumber: "BR0120230009999" });

    const res = await api("GET", "/api/admin/drivers/pending-verification", admin.token);
    assert.equal(res.status, 200);
    const drivers = res.body.data!.drivers as Json[];
    assert.equal(drivers.length, 2);
    assert.equal(res.body.data!.pagination.total, 2);
    assert.deepEqual(drivers[0]!.missing, []);
    assert.equal(drivers[0]!.documents.length, DOCS.length);
    assert.ok(drivers[0]!.user.email);
    assert.deepEqual(drivers[1]!.missing, ["VEHICLE", ...DOCS]);
  });

  it("approves a complete driver (profile + documents VERIFIED)", async () => {
    const admin = await makeUser("ADMIN");
    const d = await makeCompleteDriver(1);

    const res = await api("PATCH", `/api/admin/drivers/${d.profileId}/verify`, admin.token);
    assert.equal(res.status, 200);
    assert.equal(res.body.data!.verificationStatus, "VERIFIED");
    assert.ok(res.body.data!.verifiedAt);
    assert.equal(await DriverDocument.countDocuments({ verificationStatus: "VERIFIED" }), DOCS.length);

    const again = await api("PATCH", `/api/admin/drivers/${d.profileId}/verify`, admin.token);
    assert.equal(again.status, 409, "already verified");

    const driverView = await api("GET", "/api/drivers/profile", d.token);
    assert.equal(driverView.body.data!.reviewedBy, undefined, "admin audit field hidden from driver");
  });

  it("refuses to approve an incomplete driver", async () => {
    const admin = await makeUser("ADMIN");
    const d = await makeUser("DRIVER");
    const profileId = (await api("POST", "/api/drivers/profile", d.token, { licenseNumber: "BR0120230001234" })).body
      .data!.id;

    const res = await api("PATCH", `/api/admin/drivers/${profileId}/verify`, admin.token);
    assert.equal(res.status, 400);
    assert.match(res.body.message, /Missing: VEHICLE/);
  });

  it("rejects a driver; re-submitting a document sends them back to PENDING", async () => {
    const admin = await makeUser("ADMIN");
    const d = await makeCompleteDriver(1);

    const res = await api("PATCH", `/api/admin/drivers/${d.profileId}/reject`, admin.token, {
      rejectionReason: "Driving license image is unclear.",
      documentTypes: ["DRIVING_LICENSE"],
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.data!.verificationStatus, "REJECTED");
    assert.equal(res.body.data!.rejectionReason, "Driving license image is unclear.");

    const license = (await DriverDocument.findOne({ documentType: "DRIVING_LICENSE" }))!;
    assert.equal(license.verificationStatus, "REJECTED");
    assert.equal(await DriverDocument.countDocuments({ verificationStatus: "REJECTED" }), 1);

    await api("PATCH", `/api/drivers/documents/${license.id}`, d.token, { documentUrl: "https://files.example.com/clear.jpg" });
    const profile = (await DriverProfile.findById(d.profileId))!;
    assert.equal(profile.verificationStatus, "PENDING");
    assert.equal(profile.rejectionReason, undefined);
  });

  it("requires a rejection reason", async () => {
    const admin = await makeUser("ADMIN");
    const d = await makeCompleteDriver(1);
    const res = await api("PATCH", `/api/admin/drivers/${d.profileId}/reject`, admin.token, {});
    assert.equal(res.status, 400);
  });

  it("changing the vehicle after verification requires re-verification", async () => {
    const admin = await makeUser("ADMIN");
    const d = await makeCompleteDriver(1);
    await api("PATCH", `/api/admin/drivers/${d.profileId}/verify`, admin.token);

    await api("PATCH", "/api/drivers/vehicle", d.token, { registrationNumber: "BR01ZZ9999" });

    const profile = (await DriverProfile.findById(d.profileId))!;
    assert.equal(profile.verificationStatus, "PENDING");
    assert.equal(profile.verifiedAt, undefined);
  });
});

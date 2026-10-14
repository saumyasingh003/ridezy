import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { createServer, type Server as HttpServer } from "node:http";
import type { AddressInfo } from "node:net";
import type { Server as SocketServer } from "socket.io";

// Infrastructure tests: no database connection is opened here.
process.env.NODE_ENV = "test";
process.env.PAYMENT_PROVIDER = "mock"; // tests never call real Razorpay
// ...nor real Supabase Storage (empty = unset; images go to the local folder).
process.env.SUPABASE_URL = "";
process.env.SUPABASE_SERVICE_ROLE_KEY = "";
process.env.MONGODB_URI = "mongodb://127.0.0.1:1/unused";
process.env.JWT_SECRET = "test-jwt-secret-that-is-at-least-32-characters";
process.env.OTP_SECRET = "test-otp-secret-that-is-at-least-32-characters";
process.env.CORS_ORIGIN = "http://localhost:3000";

const { createApp } = await import("./app.js");
const { initSocket } = await import("./config/socket.js");

let httpServer: HttpServer;
let io: SocketServer;
let baseUrl: string;

before(async () => {
  httpServer = createServer(createApp());
  io = initSocket(httpServer);
  await new Promise<void>((resolve) => httpServer.listen(0, resolve));
  const { port } = httpServer.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${port}`;
});

after(async () => {
  await io.close();
});

describe("GET /api/health", () => {
  it("reports the database as down when it is not connected", async () => {
    const res = await fetch(`${baseUrl}/api/health`);
    const body = (await res.json()) as { status: string; uptime: number; services: { database: string } };

    assert.equal(res.status, 503);
    assert.equal(body.status, "degraded");
    assert.equal(body.services.database, "down");
    assert.equal(typeof body.uptime, "number");
  });

  it("sets security and CORS headers", async () => {
    const res = await fetch(`${baseUrl}/api/health`, {
      headers: { Origin: "http://localhost:3000" },
    });

    assert.equal(res.headers.get("access-control-allow-origin"), "http://localhost:3000");
    assert.equal(res.headers.get("x-content-type-options"), "nosniff");
    assert.equal(res.headers.get("x-powered-by"), null);
  });
});

describe("error handling", () => {
  it("returns a JSON 404 for unknown routes", async () => {
    const res = await fetch(`${baseUrl}/api/does-not-exist`);

    assert.equal(res.status, 404);
    assert.deepEqual(await res.json(), {
      success: false,
      message: "Route not found: GET /api/does-not-exist",
    });
  });

  it("returns 400 for malformed JSON bodies", async () => {
    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{not json",
    });
    const body = (await res.json()) as { success: boolean };

    assert.equal(res.status, 400);
    assert.equal(body.success, false);
  });
});

describe("Socket.IO", () => {
  /**
   * Raw WebSocket handshake: Engine.IO "open" ("0{...}"), then the Socket.IO
   * namespace connect with auth ("40{...}"). Resolves with the server's reply:
   * "40{...}" (connected) or "44{...}" (connect error).
   */
  function handshake(auth?: object): Promise<string> {
    const ws = new WebSocket(`${baseUrl.replace("http", "ws")}/socket.io/?EIO=4&transport=websocket`);
    return new Promise<string>((resolve, reject) => {
      ws.addEventListener("error", () => reject(new Error("WebSocket error")));
      ws.addEventListener("message", (event) => {
        const data = String(event.data);
        if (data.startsWith("0")) ws.send(`40${auth ? JSON.stringify(auth) : ""}`);
        if (data.startsWith("40") || data.startsWith("44")) {
          resolve(data);
          ws.close();
        }
      });
    });
  }

  it("accepts WebSocket connections with a valid JWT", async () => {
    const { signAccessToken } = await import("./utils/jwt.js");
    const token = signAccessToken({ userId: "6ac49c10dc4a882c54446f3f", role: "PASSENGER" });

    const reply = await handshake({ token });
    assert.ok(reply.startsWith("40"), reply);
    const { sid } = JSON.parse(reply.slice(2)) as { sid: string };
    assert.ok(sid);
  });

  it("refuses connections without a valid JWT", async () => {
    for (const auth of [undefined, { token: "not-a-jwt" }]) {
      const reply = await handshake(auth);
      assert.ok(reply.startsWith("44"), reply);
      assert.match(reply, /UNAUTHENTICATED/);
    }
  });
});

describe("POST /api/upload", () => {
  // A real 1x1 PNG.
  const PNG =
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

  async function upload(body: object, token?: string) {
    const res = await fetch(`${baseUrl}/api/upload`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(body),
    });
    return { status: res.status, body: (await res.json()) as { data?: { url: string; previewUrl: string } } };
  }

  it("requires a signed-in user", async () => {
    assert.equal((await upload({ file: PNG })).status, 401);
  });

  it("checks the real file type, not just the declared one", async () => {
    const { signAccessToken } = await import("./utils/jwt.js");
    const token = signAccessToken({ userId: "6ac49c10dc4a882c54446f3f", role: "DRIVER" });
    const fake = Buffer.from("<script>alert(1)</script>").toString("base64");
    assert.equal((await upload({ file: `data:image/png;base64,${fake}` }, token)).status, 400);

    const ok = await upload({ file: PNG, category: "vehicle" }, token);
    assert.equal(ok.status, 201);
    assert.match(ok.body.data!.url, /\/uploads\/vehicle_.+\.png$/); // local fallback without Supabase
  });
});

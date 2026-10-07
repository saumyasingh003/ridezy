import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { createServer, type Server as HttpServer } from "node:http";
import type { AddressInfo } from "node:net";
import type { Server as SocketServer } from "socket.io";

// Infrastructure tests: no database connection is opened here.
process.env.NODE_ENV = "test";
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
  it("accepts WebSocket connections", async () => {
    const wsUrl = `${baseUrl.replace("http", "ws")}/socket.io/?EIO=4&transport=websocket`;
    const ws = new WebSocket(wsUrl);

    // Engine.IO "open" packet ("0{...}"), then Socket.IO namespace "connect" ack ("40{...}").
    const connectAck = await new Promise<string>((resolve, reject) => {
      ws.addEventListener("error", () => reject(new Error("WebSocket error")));
      ws.addEventListener("message", (event) => {
        const data = String(event.data);
        if (data.startsWith("0")) ws.send("40");
        if (data.startsWith("40")) resolve(data);
      });
    });

    const { sid } = JSON.parse(connectAck.slice(2)) as { sid: string };
    assert.ok(sid);
    assert.equal(io.of("/").sockets.size, 1);

    ws.close();
  });
});

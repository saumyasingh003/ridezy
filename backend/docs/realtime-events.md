# Ridezy real-time events (Socket.IO)

In-ride **chat** and in-app **voice calls** between a ride's passenger and its assigned driver.
REST endpoints for the same feature (chat history and communication status) are in Swagger
under **Ride Communication**. This file covers the Socket.IO part, which Swagger can't describe.

- Server: same origin and port as the REST API (`http://localhost:5000`), Socket.IO v4.
- Audio: browser-to-browser **WebRTC**. The server never carries audio. It only relays the
  WebRTC handshake (offer, answer, ICE candidates) and tracks the call state.

## 1. Connecting

```js
import { io } from "socket.io-client";
const socket = io("http://localhost:5000", { auth: { token: "<JWT from /api/auth/login>" } });
socket.on("connect_error", (err) => { if (err.message === "UNAUTHENTICATED") /* log in again */ });
```

- The same JWT as the REST API, checked by the same verifier (`utils/jwt.ts`). Non-browser
  clients may send `Authorization: Bearer <JWT>` instead.
- The token is **re-verified on every event**. If it has expired, the event fails with
  `UNAUTHENTICATED` and the server disconnects the socket.
- Each socket joins its user's room. Events reach every tab and device of that user.

## 2. Who can communicate, and when

Checked against the **database on every event**, never cached on the socket:

| Rule | Result if broken |
|---|---|
| Caller is PASSENGER or DRIVER | `FORBIDDEN` |
| Caller is the ride's passenger or its **currently** assigned driver | `RIDE_NOT_FOUND` (also for previously assigned drivers and unrelated users; ride ids can't be probed) |
| Ride is `DRIVER_ASSIGNED`, `DRIVER_ARRIVING`, `DRIVER_ARRIVED` or `RIDE_STARTED` | `COMMUNICATION_NOT_STARTED` (still `SEARCHING`) or `COMMUNICATION_CLOSED` (completed or cancelled) |

When a ride completes or is cancelled, the server ends any call (`call:ended`, reason
`RIDE_ENDED`) and sends `communication:closed` to both participants. Chat history stays
readable over REST.

## 3. Request / response shape

Client → server events take a payload and an **acknowledgement callback**:

```js
const res = await socket.timeout(5000).emitWithAck("chat:send", { rideId, body: "Hi" });
// { ok: true,  data: {...} }
// { ok: false, error: { code: "COMMUNICATION_CLOSED", message: "This ride is completed. Chat and calls are closed." } }
```

If a client emits without an ack callback, failures arrive as
`communication:error` → `{ event, code, message }`.

## 4. Chat

### `chat:send` (client → server)

| Field | Type | Rules |
|---|---|---|
| `rideId` | string | ObjectId |
| `body` | string | Trimmed, 1–1000 characters, plain text |
| `clientMessageId` | string, optional | 1–64 of `A-Z a-z 0-9 _ -`. Resending with the same id returns the already-saved message instead of a duplicate (safe retry after a reconnect). |

Ack data: `{ message: RideMessage }`.
Rate limit: 20 messages per 10 s per socket.

### `chat:message` (server → both participants)

`RideMessage`:
```json
{ "id": "…", "rideId": "…", "senderId": "…", "senderRole": "PASSENGER", "body": "I'm at the gate",
  "clientMessageId": "m-1", "createdAt": "2026-10-14T10:00:00.000Z" }
```
The sender gets it too (other tabs stay in sync). De-duplicate by `id`. Render `body` as
**text**, never as HTML.

History: `GET /api/rides/{rideId}/messages?limit=30&before=<nextCursor>`.

## 5. Calls

```
caller                       server                          callee
  │ call:initiate ─────────────►│ (checks access + callee online)
  │◄──────────── ack {call}     │──── call:incoming ───────────►│ (all callee tabs ring)
  │                             │◄─────────────── call:accept ───│ (one tab answers)
  │◄──── call:accepted ─────────┼──── call:accepted ────────────►│ (other tabs stop ringing)
  │ call:offer ────────────────►│──── call:offer ──────────────►│
  │◄─────────────── call:answer │◄──────────────── call:answer ──│
  │ call:ice-candidate ◄───────►│◄──────► call:ice-candidate ───►│ (both ways, repeatedly)
  │ call:connected ────────────►│ (RTCPeerConnection reached "connected")
  │◄──── call:active ───────────┼──── call:active ──────────────►│
  │ call:end ──────────────────►│──── call:ended ───────────────►│ (to both)
```

The **caller** creates the WebRTC offer after `call:accepted`. A call counts as successful
only after `call:active`, never just because it was accepted.

### Client → server

| Event | Payload | Who | Ack data |
|---|---|---|---|
| `call:initiate` | `{ rideId }` | either participant | `{ call: CallView, rtc: { iceServers } }` |
| `call:accept` | `{ rideId, callId }` | callee, while `RINGING` | `{ call, rtc: { iceServers } }` |
| `call:reject` | `{ rideId, callId }` | callee, while `RINGING` | `null` |
| `call:end` | `{ rideId, callId }` | either, any state (cancel or hang up) | `null` |
| `call:offer` | `{ rideId, callId, description: { type: "offer", sdp } }` | the tab in the call | `null` |
| `call:answer` | `{ rideId, callId, description: { type: "answer", sdp } }` | the tab in the call | `null` |
| `call:ice-candidate` | `{ rideId, callId, candidate: RTCIceCandidateInit }` | the tab in the call | `null` |
| `call:connected` | `{ rideId, callId }` | either, after the peer connection is `connected` | `{ call }` |

Signaling (`offer` / `answer` / `ice-candidate`) is only allowed after the call is answered,
only from the two sockets bound to the call (the caller's tab and the tab that accepted), and
is delivered only to the other one. Limits: SDP ≤ 20 000 chars; 200 signaling events per
10 s; 20 call-control events per 10 s.

`call:reject` and `call:end` skip the ride-status check: leaving a call is always allowed.

### Server → client

| Event | Payload | Sent to |
|---|---|---|
| `call:incoming` | `CallView` (`direction: "INCOMING"`) | callee (all tabs; also re-sent to a tab that connects while it rings) |
| `call:accepted` | `{ callId, rideId, acceptedOnSocketId }` | both users. A callee tab whose `socket.id` ≠ `acceptedOnSocketId` should stop ringing. |
| `call:offer` / `call:answer` | `{ rideId, callId, description }` | the peer socket |
| `call:ice-candidate` | `{ rideId, callId, candidate }` | the peer socket |
| `call:active` | `{ callId, rideId, connectedAt }` | both users |
| `call:ended` | `{ callId, rideId, reason, durationSeconds }` | both users |
| `call:resumed` | `CallView` | a user's new socket after a brief drop (see below) |

`CallView`: `{ callId, rideId, state: "RINGING"|"CONNECTING"|"ACTIVE", direction: "OUTGOING"|"INCOMING", caller: { role, name }, callee: { role, name }, createdAt, connectedAt }`.

### `call:ended` reasons

| Reason | Meaning |
|---|---|
| `REJECTED` | Callee declined |
| `CANCELLED` | Caller hung up before an answer |
| `NO_ANSWER` | Not answered within `CALL_RING_TIMEOUT_SECONDS` (default 30) |
| `ENDED` | Hung up after answering |
| `CONNECTION_FAILED` | Answered, but no `call:connected` within `CALL_CONNECT_TIMEOUT_SECONDS` (default 20). Usually a network that needs TURN. |
| `PEER_DISCONNECTED` | A participant's socket dropped and didn't return within `CALL_RECONNECT_GRACE_SECONDS` (default 15) |
| `RIDE_ENDED` | Ride completed or cancelled |
| `ACCESS_REVOKED` | A participant lost access (driver reassigned) |

### Reconnection

WebRTC audio is peer-to-peer, so it keeps flowing through a short Socket.IO outage. If a
call participant's socket drops, the call is kept for the grace period. When that user
connects again, their new socket is bound to the call and receives `call:resumed`, and
signaling continues on it. After a **page reload** the browser's `RTCPeerConnection` is gone,
so on `call:resumed` without a live peer connection the client should send `call:end`.

On (re)connect, clients should also call `GET /api/rides/{rideId}/communication`: it returns
`activeCall` (for example, to show the incoming-call UI after a refresh) and whether
communication is still open.

## 6. Other server events

| Event | Payload | When |
|---|---|---|
| `communication:closed` | `{ rideId, reason: "RIDE_COMPLETED" \| "RIDE_CANCELLED" \| "DRIVER_REASSIGNED" }` | Ride ended (both participants), or a driver lost the ride (that driver only) |
| `communication:error` | `{ event, code, message }` | An event sent without an ack callback failed |
| `notification:new` | `{ notification: Notification, unreadCount }` | A notification was created for this user (ride accepted, driver approaching, arrived, trip started, completed, cancelled, payments, ratings, ...). Same `Notification` shape as `GET /api/notifications`. Ride lifecycle notifications are never sent twice. |
| `notification:unread-count` | `{ unreadCount }` | The user marked notifications read (any tab): keep the badge in sync |
| `ride:driver-location` | `{ rideId, latitude, longitude, lastLocationUpdatedAt, heading: "PICKUP" \| "DESTINATION", distanceKm, etaMinutes }` | Live tracking: the assigned driver sent a new location (`PATCH /api/drivers/location`) during an active ride. Sent to that ride's **passenger only**; stops when the ride ends. `GET /api/rides/{rideId}/driver` returns the same data for catching up after a reconnect. |

## 7. Error codes

| Code | Typical cause |
|---|---|
| `UNAUTHENTICATED` | Missing, invalid or expired JWT (socket is disconnected) |
| `VALIDATION_ERROR` | Bad payload (empty or long message, bad id, wrong SDP type) |
| `RATE_LIMITED` | Too many events from this socket |
| `FORBIDDEN` | Wrong role, wrong side of the call (e.g. caller accepting), or a tab not bound to the call |
| `RIDE_NOT_FOUND` | Not this user's ride (unrelated user or previous driver) |
| `COMMUNICATION_NOT_STARTED` | No driver has accepted yet |
| `COMMUNICATION_CLOSED` | Ride completed or cancelled |
| `PEER_OFFLINE` | The other participant has no connected socket, so they can't be called |
| `PEER_RECONNECTING` | The other side's socket dropped mid-call; retry shortly |
| `CALL_BUSY` | A call already exists for this ride |
| `CALL_NOT_FOUND` | Unknown or already-ended `callId` |
| `CALL_NOT_ANSWERED` | Signaling or `connected` before the call was accepted |
| `CALL_ALREADY_ANSWERED` | Accept or reject after the call was answered (e.g. on another tab) |
| `INTERNAL_ERROR` | Unexpected server error (logged) |

## 8. WebRTC infrastructure

- **STUN** (default `stun:stun.l.google.com:19302`) lets browsers discover their public
  address. This is enough for development and most home networks.
- **TURN** relays audio when a direct connection is impossible (carrier-grade NAT on mobile
  data, strict corporate firewalls; roughly 10–20% of real users). Without it, those calls
  end with `CONNECTION_FAILED`. Add a self-hosted coturn or a managed TURN service through
  `WEBRTC_ICE_SERVERS` (a JSON array, see `.env.example`). No code change is needed.
  Production should prefer short-lived TURN credentials issued per user.
- **HTTPS**: browsers only allow microphone access in a secure context. `localhost` is exempt.
- **Single instance**: call state and socket rooms live in this process's memory. Running
  several backend instances would need a shared Socket.IO adapter and shared call state.

## 9. Testing

Automated: `npm test`. `src/communication.test.ts` covers socket auth (including token expiry
mid-session), chat delivery, persistence, pagination, idempotency and validation, refusing
outsiders and admins, closing on completion and cancellation (including a live call), the
message vs ride-completion race, driver reassignment, the full call flow and signaling relay,
reject/cancel/busy, ring and connect timeouts, multi-tab answering, and reconnect grace.

Manual, with two browsers (or one normal window plus one private window):
1. Log in as a passenger in one and as a verified driver (online) in the other.
2. Book a ride, then accept it as the driver.
3. In each browser console, connect with `io("http://localhost:5000", { auth: { token } })`
   and try `chat:send`. Both should receive `chat:message`.
4. Complete or cancel the ride. Both should receive `communication:closed`, and
   `chat:send` should fail with `COMMUNICATION_CLOSED`.

The automated tests can't play real audio. Actual audio quality and NAT traversal must be
checked by hand in two browsers (on two different networks to exercise STUN and TURN).

"use client";

// Ride chat state: history over REST, live messages over Socket.IO.
// Backend: services/rideCommunication.service.ts, docs/realtime-events.md.

import { useCallback, useEffect, useRef, useState } from "react";
import { api, type RideStatus } from "./rideApi";
import { getSocket, request } from "./socket";

export type ChatRole = "PASSENGER" | "DRIVER";
export type ClosedReason = "WAITING_FOR_DRIVER" | "RIDE_COMPLETED" | "RIDE_CANCELLED" | "DRIVER_REASSIGNED";

/** GET /api/rides/:rideId/communication → data */
export interface CommunicationStatus {
  rideId: string;
  rideStatus: RideStatus;
  canChat: boolean;
  canCall: boolean;
  closedReason: ClosedReason | null;
  you: { role: ChatRole };
  /** phone: only while the ride is active; null afterwards or if not on file. */
  counterpart: { role: ChatRole; name: string; phone: string | null; online: boolean } | null;
  limits: { maxMessageLength: number };
}

export interface ChatMessage {
  id: string;
  rideId: string;
  senderId: string;
  senderRole: ChatRole;
  body: string;
  clientMessageId: string | null;
  createdAt: string;
  /** Local only: optimistic messages until the server acknowledges them. */
  pending?: "sending" | "failed";
  error?: string;
}

interface MessagePage {
  messages: ChatMessage[];
  hasMore: boolean;
  nextCursor: string | null;
}

const PAGE_SIZE = 30;

export function closedMessage(reason: ClosedReason | null): string {
  switch (reason) {
    case "WAITING_FOR_DRIVER":
      return "Chat opens once a driver accepts the ride.";
    case "RIDE_COMPLETED":
      return "This ride is completed. Chat is closed.";
    case "RIDE_CANCELLED":
      return "This ride was cancelled. Chat is closed.";
    case "DRIVER_REASSIGNED":
      return "You're no longer assigned to this ride.";
    default:
      return "Chat is closed.";
  }
}

function fetchSnapshot(rideId: string) {
  return Promise.all([
    api<CommunicationStatus>(`/rides/${rideId}/communication`),
    api<MessagePage>(`/rides/${rideId}/messages?limit=${PAGE_SIZE}`),
  ]);
}

function newClientId(): string {
  return `c-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Adds/replaces messages by id (or by clientMessageId for optimistic ones), kept in time order. */
function merge(current: ChatMessage[], incoming: ChatMessage[]): ChatMessage[] {
  const next = [...current];
  for (const message of incoming) {
    const index = next.findIndex(
      (m) => m.id === message.id || (message.clientMessageId !== null && m.clientMessageId === message.clientMessageId),
    );
    if (index >= 0) next[index] = message;
    else next.push(message);
  }
  return next.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

/**
 * @param rideId   ride to chat about (null = nothing to show)
 * @param isOpen   whether the chat panel is visible (incoming messages count as unread otherwise)
 * @param rideStatus  the ride's status as the page knows it; a change re-reads
 *                    the communication status
 */
export function useRideChat(rideId: string | null, isOpen: boolean, rideStatus?: RideStatus) {
  const [status, setStatus] = useState<CommunicationStatus | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [connected, setConnected] = useState(() => getSocket()?.connected ?? false);
  const [unread, setUnread] = useState(0);

  const isOpenRef = useRef(isOpen);
  const roleRef = useRef<ChatRole | null>(null);
  useEffect(() => {
    isOpenRef.current = isOpen;
  }, [isOpen]);
  const markRead = useCallback(() => setUnread(0), []);

  const applySnapshot = useCallback((snapshot: Awaited<ReturnType<typeof fetchSnapshot>>) => {
    const [statusRes, pageRes] = snapshot;
    if (!statusRes.ok || !statusRes.data) {
      setLoadError(statusRes.message || "Couldn't load chat.");
      setLoading(false);
      return;
    }
    setLoadError(null);
    setStatus(statusRes.data);
    roleRef.current = statusRes.data.you.role;
    if (pageRes.ok && pageRes.data) {
      const page = pageRes.data;
      setMessages((current) => merge(current, page.messages));
      setCursor((c) => c ?? page.nextCursor);
      setHasMore((h) => h || page.hasMore);
    }
    setLoading(false);
  }, []);

  /** Status + newest page. Also used after a reconnect to fill any gap. */
  const load = useCallback(async () => {
    if (rideId) applySnapshot(await fetchSnapshot(rideId));
  }, [rideId, applySnapshot]);

  // Initial load. State isn't reset when rideId changes: mount the component
  // with key={rideId} so each ride gets a fresh hook.
  useEffect(() => {
    if (rideId) void fetchSnapshot(rideId).then(applySnapshot);
  }, [rideId, applySnapshot]);

  // The page saw the ride move on (e.g. completed): re-read eligibility.
  useEffect(() => {
    if (!rideId || !rideStatus) return;
    void api<CommunicationStatus>(`/rides/${rideId}/communication`).then(({ ok, data }) => {
      if (ok && data) setStatus(data);
    });
  }, [rideId, rideStatus]);

  // Live events.
  useEffect(() => {
    if (!rideId) return;
    const socket = getSocket();
    if (!socket) return;

    const onConnect = () => {
      setConnected(true);
      void load(); // catch up on anything missed while offline
    };
    const onDisconnect = () => setConnected(false);
    const onMessage = (message: ChatMessage) => {
      if (message.rideId !== rideId) return;
      setMessages((current) => merge(current, [message]));
      if (!isOpenRef.current && message.senderRole !== roleRef.current) setUnread((n) => n + 1);
    };
    const onClosed = (event: { rideId: string; reason: ClosedReason }) => {
      if (event.rideId !== rideId) return;
      setStatus((s) => (s ? { ...s, canChat: false, canCall: false, closedReason: event.reason } : s));
    };

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("chat:message", onMessage);
    socket.on("communication:closed", onClosed);
    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("chat:message", onMessage);
      socket.off("communication:closed", onClosed);
    };
  }, [rideId, load]);

  const loadOlder = useCallback(async () => {
    if (!rideId || !cursor || loadingOlder) return;
    setLoadingOlder(true);
    const { ok, data } = await api<MessagePage>(`/rides/${rideId}/messages?limit=${PAGE_SIZE}&before=${cursor}`);
    if (ok && data) {
      setMessages((current) => merge(current, data.messages));
      setCursor(data.nextCursor);
      setHasMore(data.hasMore);
    }
    setLoadingOlder(false);
  }, [rideId, cursor, loadingOlder]);

  /** Sends (or retries, with the same clientMessageId so it's never duplicated). */
  const deliver = useCallback(
    async (body: string, clientMessageId: string) => {
      if (!rideId) return;
      const res = await request<{ message: ChatMessage }>("chat:send", { rideId, body, clientMessageId });
      if (res.ok) {
        setMessages((current) => merge(current, [res.data.message]));
        return;
      }
      setMessages((current) =>
        current.map((m) => (m.clientMessageId === clientMessageId ? { ...m, pending: "failed", error: res.error.message } : m)),
      );
      if (res.error.code === "COMMUNICATION_CLOSED" || res.error.code === "RIDE_NOT_FOUND") {
        setStatus((s) => (s ? { ...s, canChat: false, canCall: false } : s));
        void load();
      }
    },
    [rideId, load],
  );

  const send = useCallback(
    (text: string) => {
      const body = text.trim();
      if (!rideId || !body || !status?.canChat) return;
      const clientMessageId = newClientId();
      setMessages((current) =>
        merge(current, [
          {
            id: clientMessageId,
            rideId,
            senderId: "me",
            senderRole: status.you.role,
            body,
            clientMessageId,
            createdAt: new Date().toISOString(),
            pending: "sending",
          },
        ]),
      );
      void deliver(body, clientMessageId);
    },
    [rideId, status, deliver],
  );

  const retry = useCallback(
    (message: ChatMessage) => {
      if (!message.clientMessageId) return;
      setMessages((current) =>
        current.map((m) => (m.clientMessageId === message.clientMessageId ? { ...m, pending: "sending", error: undefined } : m)),
      );
      void deliver(message.body, message.clientMessageId);
    },
    [deliver],
  );

  return { status, messages, loading, loadError, hasMore, loadingOlder, connected, unread, markRead, send, retry, loadOlder, reload: load };
}

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Ban,
  Bell,
  CheckCheck,
  CheckCircle2,
  CircleAlert,
  CreditCard,
  Flag,
  Loader2,
  MapPin,
  Navigation,
  SearchX,
  ShieldCheck,
  Star,
  UserCheck,
  type LucideIcon,
} from "lucide-react";
import { api } from "@/lib/rideApi";
import { getSocket } from "@/lib/socket";

// GET /api/notifications, PATCH /api/notifications/:id/read, PATCH /api/notifications/read-all.
// New notifications arrive live over Socket.IO; the poll is only a fallback.
const POLL_MS = 60_000;
const LIMIT = 15;

type NotificationType =
  | "RIDE_ACCEPTED"
  | "DRIVER_APPROACHING"
  | "DRIVER_ARRIVED"
  | "RIDE_STARTED"
  | "RIDE_COMPLETED"
  | "RIDE_NO_DRIVER"
  | "PAYMENT_CONFIRMED"
  | "RIDE_CANCELLED"
  | "PAYMENT_RECEIVED"
  | "NEW_RATING"
  | "DRIVER_VERIFIED"
  | "DRIVER_REJECTED"
  | "DRIVER_READY_FOR_REVIEW";

interface NotificationItem {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  data: Record<string, string>;
  isRead: boolean;
  createdAt: string;
}

interface NotificationList {
  notifications: NotificationItem[];
  unreadCount: number;
}

const ICONS: Record<NotificationType, { icon: LucideIcon; className: string }> = {
  RIDE_ACCEPTED: { icon: Navigation, className: "bg-sky-50 text-sky-700" },
  DRIVER_APPROACHING: { icon: Navigation, className: "bg-amber-50 text-amber-700" },
  DRIVER_ARRIVED: { icon: MapPin, className: "bg-emerald-50 text-emerald-700" },
  RIDE_STARTED: { icon: Navigation, className: "bg-stone-100 text-stone-800" },
  RIDE_COMPLETED: { icon: Flag, className: "bg-emerald-50 text-emerald-700" },
  RIDE_NO_DRIVER: { icon: SearchX, className: "bg-rose-50 text-rose-700" },
  PAYMENT_CONFIRMED: { icon: CheckCircle2, className: "bg-emerald-50 text-emerald-700" },
  RIDE_CANCELLED: { icon: Ban, className: "bg-rose-50 text-rose-700" },
  PAYMENT_RECEIVED: { icon: CreditCard, className: "bg-emerald-50 text-emerald-700" },
  NEW_RATING: { icon: Star, className: "bg-amber-50 text-amber-600" },
  DRIVER_VERIFIED: { icon: ShieldCheck, className: "bg-emerald-50 text-emerald-700" },
  DRIVER_REJECTED: { icon: CircleAlert, className: "bg-rose-50 text-rose-700" },
  DRIVER_READY_FOR_REVIEW: { icon: UserCheck, className: "bg-sky-50 text-sky-700" },
};

/** Where tapping a notification takes the user (the type also implies the role). */
function linkFor(n: NotificationItem): string | null {
  switch (n.type) {
    case "RIDE_ACCEPTED":
    case "DRIVER_APPROACHING":
    case "DRIVER_ARRIVED":
    case "RIDE_STARTED":
      return "/dashboard/current-ride";
    case "RIDE_COMPLETED":
    case "PAYMENT_CONFIRMED":
      return "/dashboard/history"; // pay and rate from there
    case "RIDE_NO_DRIVER":
      return "/dashboard";
    case "RIDE_CANCELLED":
      return "/driver/live-rides";
    case "PAYMENT_RECEIVED":
      return "/driver/earnings";
    case "NEW_RATING":
      return "/driver/reviews";
    case "DRIVER_VERIFIED":
    case "DRIVER_REJECTED":
      return "/driver/vehicle-docs";
    case "DRIVER_READY_FOR_REVIEW":
      return n.data.driverId ? `/admin/driver/${n.data.driverId}` : "/admin/driver";
    default:
      return null;
  }
}

function timeAgo(iso: string) {
  const s = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d} d ago`;
  return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
}

/** Bell with unread badge and a dropdown of the latest notifications. Used by all three navbars. */
export default function NotificationBell() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[] | null>(null);
  const [unread, setUnread] = useState(0);
  const [markingAll, setMarkingAll] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const load = useCallback(() => {
    api<NotificationList>(`/notifications?limit=${LIMIT}`).then(({ ok, data }) => {
      if (ok && data) {
        setItems(data.notifications);
        setUnread(data.unreadCount);
      }
    });
  }, []);

  // Badge: poll in the background; also refresh when the tab comes back into view.
  useEffect(() => {
    load();
    const id = setInterval(load, POLL_MS);
    const onVisible = () => document.visibilityState === "visible" && load();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [load]);

  // Live: a new notification goes on top; read state syncs across tabs.
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    const onNew = ({ notification, unreadCount }: { notification: NotificationItem; unreadCount: number }) => {
      setItems((prev) => [notification, ...(prev ?? []).filter((x) => x.id !== notification.id)].slice(0, LIMIT));
      setUnread(unreadCount);
    };
    const onCount = ({ unreadCount }: { unreadCount: number }) => {
      setUnread(unreadCount);
      if (unreadCount === 0) setItems((prev) => prev?.map((x) => ({ ...x, isRead: true })) ?? prev);
    };
    socket.on("notification:new", onNew);
    socket.on("notification:unread-count", onCount);
    socket.on("connect", load); // catch up after a reconnect
    return () => {
      socket.off("notification:new", onNew);
      socket.off("notification:unread-count", onCount);
      socket.off("connect", load);
    };
  }, [load]);

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const openItem = (n: NotificationItem) => {
    if (!n.isRead) {
      // Optimistic: update the UI now, tell the server in the background.
      setItems((prev) => prev?.map((x) => (x.id === n.id ? { ...x, isRead: true } : x)) ?? prev);
      setUnread((u) => Math.max(0, u - 1));
      api(`/notifications/${n.id}/read`, { method: "PATCH" });
    }
    const href = linkFor(n);
    setOpen(false);
    if (href) router.push(href);
  };

  const markAll = async () => {
    setMarkingAll(true);
    const { ok } = await api("/notifications/read-all", { method: "PATCH" });
    setMarkingAll(false);
    if (ok) {
      setItems((prev) => prev?.map((x) => ({ ...x, isRead: true })) ?? prev);
      setUnread(0);
    }
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => {
          setOpen((o) => !o);
          if (!open) load();
        }}
        aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}
        aria-expanded={open}
        className="relative flex h-10 w-10 items-center justify-center rounded-full text-[#3F4537] transition-colors hover:bg-[#F3F4E5] cursor-pointer"
      >
        <Bell size={19} />
        {unread > 0 && (
          <span className="absolute right-1 top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full border-2 border-white bg-[#E5484D] px-1 text-[9px] font-bold leading-none text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-[#EDEDE8] bg-white shadow-[0_18px_40px_-12px_rgba(0,0,0,0.25)]">
          {/* Header */}
          <div className="flex items-center justify-between gap-3 border-b border-[#F0EFEA] px-4 py-3">
            <div>
              <p className="font-caslon text-lg font-bold leading-tight text-[#111111]">Notifications</p>
              <p className="text-[11px] text-stone-500">{unread ? `${unread} unread` : "You're all caught up"}</p>
            </div>
            {unread > 0 && (
              <button
                type="button"
                onClick={markAll}
                disabled={markingAll}
                className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold text-stone-700 transition-colors hover:bg-stone-100 disabled:opacity-50"
              >
                {markingAll ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCheck className="h-3.5 w-3.5" />}
                Mark all as read
              </button>
            )}
          </div>

          {/* List */}
          <ul className="max-h-[min(26rem,70vh)] divide-y divide-[#F4F3EF] overflow-y-auto">
            {items === null && (
              <li className="flex items-center justify-center gap-2 px-4 py-10 text-xs text-stone-400">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading…
              </li>
            )}
            {items?.length === 0 && (
              <li className="px-4 py-10 text-center">
                <Bell className="mx-auto h-6 w-6 text-stone-300" />
                <p className="mt-2 text-xs font-semibold text-stone-500">No notifications yet</p>
                <p className="text-[11px] text-stone-400">Ride, payment and rating updates will appear here.</p>
              </li>
            )}
            {items?.map((n) => {
              const { icon: Icon, className } = ICONS[n.type] ?? { icon: Bell, className: "bg-stone-100 text-stone-700" };
              return (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => openItem(n)}
                    className={`flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-[#FAFAF8] ${
                      n.isRead ? "" : "bg-[#FBFBF6]"
                    }`}
                  >
                    <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${className}`}>
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-start justify-between gap-2">
                        <span className={`text-[13px] leading-snug text-[#111111] ${n.isRead ? "font-medium" : "font-bold"}`}>
                          {n.title}
                        </span>
                        {!n.isRead && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[#E5484D]" aria-label="Unread" />}
                      </span>
                      <span className="mt-0.5 block text-xs leading-snug text-stone-500">{n.body}</span>
                      <span className="mt-1 block text-[10px] font-medium text-stone-400">{timeAgo(n.createdAt)}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

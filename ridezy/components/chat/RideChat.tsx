"use client";

import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type RefObject } from "react";
import { createPortal } from "react-dom";
import {
  AlertCircle,
  CheckCheck,
  ChevronDown,
  Clock,
  Loader2,
  Lock,
  MessageCircle,
  Phone,
  PhoneOff,
  RefreshCw,
  SendHorizontal,
  WifiOff,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { closedMessage, useRideChat, type ChatMessage } from "@/lib/rideChat";
import type { RideStatus } from "@/lib/rideApi";

interface RideChatProps {
  rideId: string;
  /** Lets the chat notice when the page sees the ride move on. */
  rideStatus?: RideStatus;
  /** Button label, e.g. "Chat with driver" (buttons variant). */
  label?: string;
  /** "buttons": full-width labelled buttons. "icons": two round icon buttons, for the side of a name row. */
  variant?: "buttons" | "icons";
  className?: string;
}

/** "+919876543210" → "+91 98765 43210"; other formats are shown as stored. */
function formatPhone(phone: string): string {
  const india = /^\+91(\d{5})(\d{5})$/.exec(phone);
  return india ? `+91 ${india[1]} ${india[2]}` : phone;
}

function timeOf(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

/**
 * Ride chat between the passenger and the assigned driver: a button that opens
 * a small floating chat window. Works on both the passenger and driver screens; who "you" are
 * comes from the backend.
 */
export default function RideChat(props: RideChatProps) {
  // Keyed by ride: switching rides starts with a fresh chat state.
  return <RideChatPanel key={props.rideId} {...props} />;
}

function RideChatPanel({ rideId, rideStatus, label = "Chat", variant = "buttons", className }: RideChatProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const chat = useRideChat(rideId, open, rideStatus);
  const { status } = chat;

  const bottomRef = useRef<HTMLDivElement>(null);
  const lastMessageId = chat.messages.at(-1)?.id;
  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ block: "end" });
  }, [open, lastMessageId]);

  const maxLength = status?.limits.maxMessageLength ?? 1000;
  const canChat = Boolean(status?.canChat);
  const counterpartName = status?.counterpart?.name ?? (status?.you.role === "DRIVER" ? "Passenger" : "Driver");

  function submit() {
    if (!draft.trim() || draft.length > maxLength) return;
    chat.send(draft);
    setDraft("");
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    // Enter sends, Shift+Enter adds a new line.
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      submit();
    }
  }

  const phone = canChat ? (status?.counterpart?.phone ?? null) : null;

  function openChat() {
    setOpen(true);
    chat.markRead();
  }
  const closeChat = useCallback(() => setOpen(false), []);

  const unreadBadge = chat.unread > 0 && (
    <Badge className="absolute -right-1.5 -top-1.5 h-5 min-w-5 rounded-full bg-red-600 px-1.5 text-[10px] text-white">
      {chat.unread > 9 ? "9+" : chat.unread}
    </Badge>
  );

  const icons = (
    <div className={`flex shrink-0 items-center gap-2 ${className ?? ""}`}>
      <Button
        type="button"
        variant="outline"
        onClick={openChat}
        aria-label={`Chat with ${counterpartName}`}
        title={`Chat with ${counterpartName}`}
        className="relative size-11 rounded-full border-[#111111] bg-white text-[#111111] hover:bg-[#F4F4F4]"
      >
        <MessageCircle className="size-5" />
        {unreadBadge}
      </Button>
      {/* Phone: only while the ride is active (the backend hides it afterwards) */}
      {canChat &&
        (phone ? (
          <a
            href={`tel:${phone}`}
            aria-label={`Call ${counterpartName} at ${formatPhone(phone)}`}
            title={`Call ${formatPhone(phone)}`}
            className="flex size-11 items-center justify-center rounded-full bg-[#111111] text-white transition-colors hover:bg-black focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[#111111]/30"
          >
            <Phone className="size-5" />
          </a>
        ) : (
          <span
            title={`${counterpartName} hasn't added a phone number`}
            aria-label="No phone number"
            className="flex size-11 items-center justify-center rounded-full border border-dashed border-[#D8D8D8] text-[#B0B0B0]"
          >
            <PhoneOff className="size-5" />
          </span>
        ))}
    </div>
  );

  return (
    <>
      {variant === "icons" ? (
        icons
      ) : (
        <div className={`grid gap-2 ${canChat ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1"}`}>
          <Button
            type="button"
            variant="outline"
            onClick={openChat}
            className={`relative h-auto w-full gap-2 rounded-md border-[#111111] bg-white py-2.5 text-xs font-semibold text-[#111111] hover:bg-[#F4F4F4] ${className ?? ""}`}
          >
            <MessageCircle className="size-4" />
            {label}
            {unreadBadge}
          </Button>

          {/* Phone: only while the ride is active (the backend hides it afterwards) */}
          {canChat &&
            (phone ? (
              <a
                href={`tel:${phone}`}
                aria-label={`Call ${counterpartName} at ${formatPhone(phone)}`}
                className={buttonVariants({
                  className: `h-auto w-full gap-2 rounded-md bg-[#111111] py-2.5 text-xs font-semibold text-white hover:bg-black ${className ?? ""}`,
                })}
              >
                <Phone className="size-4" />
                {formatPhone(phone)}
              </a>
            ) : (
              <span
                className={`flex w-full items-center justify-center gap-2 rounded-md border border-dashed border-[#D8D8D8] py-2.5 text-xs text-[#8A8A8A] ${className ?? ""}`}
              >
                <PhoneOff className="size-4" />
                No phone number
              </span>
            ))}
        </div>
      )}

      {/* Floating launcher (bottom-right) while chat is available; toggles the window */}
      {(canChat || open) &&
        typeof document !== "undefined" &&
        createPortal(
          <button
            type="button"
            onClick={() => (open ? closeChat() : openChat())}
            aria-label={open ? "Hide chat" : `Chat with ${counterpartName}`}
            aria-expanded={open}
            className="fixed bottom-5 right-5 z-50 flex size-14 items-center justify-center rounded-full bg-[#111111] text-white shadow-[0_10px_30px_-6px_rgba(0,0,0,0.45)] transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#111111]/25 sm:bottom-6 sm:right-6"
          >
            {open ? <ChevronDown className="size-6" /> : <MessageCircle className="size-6" />}
            {!open && chat.unread > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold ring-2 ring-white">
                {chat.unread > 9 ? "9+" : chat.unread}
              </span>
            )}
          </button>,
          document.body,
        )}

      {open &&
        createPortal(
          <ChatWindow
            chat={chat}
            name={counterpartName}
            roleLabel={status?.counterpart?.role === "DRIVER" ? "Your driver" : "Your passenger"}
            phone={phone}
            canChat={canChat}
            draft={draft}
            maxLength={maxLength}
            onDraftChange={setDraft}
            onKeyDown={onKeyDown}
            onSubmit={submit}
            onClose={closeChat}
            bottomRef={bottomRef}
          />,
          document.body,
        )}
    </>
  );
}

/* ------------------------------ Chat window ------------------------------ */

function initialsOf(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "?"
  );
}

function dayLabel(iso: string): string {
  const date = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return "Today";
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

interface ChatWindowProps {
  chat: ReturnType<typeof useRideChat>;
  name: string;
  roleLabel: string;
  phone: string | null;
  canChat: boolean;
  draft: string;
  maxLength: number;
  onDraftChange: (value: string) => void;
  onKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
  onSubmit: () => void;
  onClose: () => void;
  bottomRef: RefObject<HTMLDivElement | null>;
}

/**
 * Compact floating chat window (bottom-right on desktop, a bottom card on
 * phones). Not modal: the ride screen stays usable behind it.
 */
function ChatWindow({
  chat,
  name,
  roleLabel,
  phone,
  canChat,
  draft,
  maxLength,
  onDraftChange,
  onKeyDown,
  onSubmit,
  onClose,
  bottomRef,
}: ChatWindowProps) {
  const { status } = chat;
  const online = canChat && Boolean(status?.counterpart?.online);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Esc closes; focus the message box when the window opens.
  useEffect(() => {
    inputRef.current?.focus();
    const onEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onEscape);
    return () => window.removeEventListener("keydown", onEscape);
  }, [onClose]);

  const subtitle = !canChat ? "Chat closed" : !chat.connected ? "Reconnecting…" : online ? "Online" : roleLabel;

  return (
    <section
      role="dialog"
      aria-label={`Chat with ${name}`}
      className="fixed inset-x-3 bottom-24 z-50 flex h-[min(500px,calc(100dvh-7.5rem))] origin-bottom-right flex-col overflow-hidden rounded-2xl border border-black/10 bg-white text-[#111111] shadow-[0_24px_60px_-12px_rgba(0,0,0,0.35)] animate-in fade-in zoom-in-95 slide-in-from-bottom-2 duration-200 sm:inset-x-auto sm:bottom-24 sm:right-6 sm:w-[360px]"
    >
      {/* Header */}
      <header className="flex items-center gap-3 bg-[#111111] px-4 py-3 text-white">
        <span className="relative flex size-10 shrink-0 items-center justify-center rounded-full bg-white/15 text-sm font-bold">
          {initialsOf(name)}
          <span
            className={`absolute bottom-0 right-0 size-3 rounded-full border-2 border-[#111111] ${online ? "bg-emerald-400" : "bg-[#8A8A8A]"}`}
            aria-hidden="true"
          />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold leading-tight">{name}</p>
          <p className="mt-0.5 truncate text-[11px] text-white/65">{subtitle}</p>
        </div>
        {phone && (
          <a
            href={`tel:${phone}`}
            aria-label={`Call ${name} at ${formatPhone(phone)}`}
            title={`Call ${formatPhone(phone)}`}
            className="flex size-8 items-center justify-center rounded-full text-white/85 transition-colors hover:bg-white/15 hover:text-white"
          >
            <Phone className="size-4" />
          </a>
        )}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close chat"
          title="Close"
          className="flex size-8 items-center justify-center rounded-full text-white/85 transition-colors hover:bg-white/15 hover:text-white"
        >
          <X className="size-4" />
        </button>
      </header>

      {canChat && !chat.connected && (
        <div className="flex items-center gap-2 bg-amber-50 px-4 py-1.5 text-[11px] text-amber-800">
          <WifiOff className="size-3" />
          Offline. Messages will send when you reconnect.
        </div>
      )}

      {/* Messages */}
      <ScrollArea className="min-h-0 flex-1 bg-[#F6F6F4]">
        <div className="flex flex-col gap-1.5 px-4 py-4">
          {chat.loading ? (
            <div className="flex items-center justify-center gap-2 py-20 text-xs text-[#7A7A7A]">
              <Loader2 className="size-4 animate-spin" /> Loading messages…
            </div>
          ) : chat.loadError ? (
            <div className="flex flex-col items-center gap-3 py-20 text-center text-xs text-[#7A7A7A]">
              <AlertCircle className="size-5 text-red-600" />
              {chat.loadError}
              <Button variant="outline" size="sm" onClick={() => void chat.reload()}>
                <RefreshCw /> Try again
              </Button>
            </div>
          ) : (
            <>
              {chat.hasMore && (
                <button
                  type="button"
                  disabled={chat.loadingOlder}
                  onClick={() => void chat.loadOlder()}
                  className="mb-2 flex items-center gap-1.5 self-center rounded-full bg-white px-3 py-1 text-[11px] font-medium text-[#555555] shadow-xs ring-1 ring-black/5 hover:text-[#111111]"
                >
                  {chat.loadingOlder && <Loader2 className="size-3 animate-spin" />}
                  Load earlier messages
                </button>
              )}

              {chat.messages.length === 0 && (
                <div className="flex flex-col items-center gap-2 py-16 text-center">
                  <span className="flex size-12 items-center justify-center rounded-full bg-white shadow-xs ring-1 ring-black/5">
                    <MessageCircle className="size-5 text-[#111111]" />
                  </span>
                  <p className="text-sm font-semibold">{canChat ? `Start a conversation` : "No messages"}</p>
                  {canChat && (
                    <p className="max-w-[220px] text-xs text-[#7A7A7A]">
                      Messages are private between you and {name.split(" ")[0]}.
                    </p>
                  )}
                </div>
              )}

              {chat.messages.map((message, index) => {
                const previous = chat.messages[index - 1];
                const newDay = !previous || dayLabel(previous.createdAt) !== dayLabel(message.createdAt);
                const mine = message.senderRole === status?.you.role;
                // Consecutive messages from the same person sit closer together.
                const grouped = !newDay && previous?.senderRole === message.senderRole;
                return (
                  <div key={message.clientMessageId ?? message.id} className={grouped ? "" : "mt-2"}>
                    {newDay && (
                      <div className="my-2 flex justify-center">
                        <span className="rounded-full bg-white px-2.5 py-0.5 text-[10px] font-medium text-[#7A7A7A] shadow-xs ring-1 ring-black/5">
                          {dayLabel(message.createdAt)}
                        </span>
                      </div>
                    )}
                    <MessageBubble
                      message={message}
                      mine={mine}
                      avatar={mine ? null : grouped ? "" : initialsOf(name)}
                      onRetry={canChat ? () => chat.retry(message) : undefined}
                    />
                  </div>
                );
              })}
              <div ref={bottomRef} />
            </>
          )}
        </div>
      </ScrollArea>

      {/* Composer, or why chat is closed */}
      <footer className="border-t border-[#ECECEC] bg-white px-3 py-3">
        {status && !canChat ? (
          <div className="flex items-center justify-center gap-2 rounded-xl bg-[#F4F4F4] px-3 py-2.5 text-xs font-medium text-[#555555]">
            <Lock className="size-3.5 shrink-0" />
            {closedMessage(status.closedReason)}
          </div>
        ) : (
          <form
            className="flex items-end gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              onSubmit();
            }}
          >
            <Textarea
              ref={inputRef}
              value={draft}
              onChange={(event) => onDraftChange(event.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Write a message…"
              rows={1}
              maxLength={maxLength}
              disabled={!status || chat.loading}
              aria-label="Message"
              className="max-h-28 min-h-10 flex-1 resize-none rounded-2xl border-[#E2E2E2] bg-[#F6F6F4] px-4 py-2.5 text-[13px] focus-visible:border-[#111111] focus-visible:bg-white focus-visible:ring-[#111111]/10"
            />
            <Button
              type="submit"
              size="icon-lg"
              aria-label="Send message"
              disabled={!draft.trim() || !status || chat.loading}
              className="size-10 shrink-0 rounded-full bg-[#111111] text-white hover:bg-black disabled:bg-[#D0D0D0]"
            >
              <SendHorizontal className="size-4" />
            </Button>
          </form>
        )}
        {draft.length > maxLength * 0.8 && (
          <p className="mt-1 pr-14 text-right text-[10px] text-[#8A8A8A]">
            {draft.length}/{maxLength}
          </p>
        )}
      </footer>
    </section>
  );
}

/**
 * avatar: initials to show beside the other person's message, "" to keep the
 * space (later messages in a group), null for my own messages.
 */
function MessageBubble({
  message,
  mine,
  avatar,
  onRetry,
}: {
  message: ChatMessage;
  mine: boolean;
  avatar: string | null;
  onRetry?: () => void;
}) {
  const failed = message.pending === "failed";
  return (
    <div className={`flex items-start gap-2 ${mine ? "justify-end" : "justify-start"}`}>
      {avatar !== null && (
        <span
          aria-hidden="true"
          className={`mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
            avatar ? "bg-[#111111] text-white" : ""
          }`}
        >
          {avatar}
        </span>
      )}
      <div className={`flex min-w-0 max-w-[78%] flex-col ${mine ? "items-end" : "items-start"}`}>
        {/* Plain text rendering: React escapes it, never inject as HTML. */}
        <div
          className={`max-w-full whitespace-pre-wrap break-words rounded-2xl px-3 py-1.5 text-[13px] leading-snug shadow-xs ${
            mine ? "rounded-br-md bg-[#111111] text-white" : "rounded-bl-md bg-white text-[#111111] ring-1 ring-black/5"
          } ${message.pending === "sending" ? "opacity-70" : ""} ${failed ? "ring-1 ring-red-500" : ""}`}
        >
          {message.body}
          <span
            className={`ml-2 inline-flex translate-y-0.5 items-center gap-0.5 align-baseline text-[10px] ${
              mine ? "text-white/60" : "text-[#9A9A9A]"
            }`}
          >
            {timeOf(message.createdAt)}
            {mine &&
              (message.pending === "sending" ? (
                <Clock className="size-3" aria-label="Sending" />
              ) : failed ? null : (
                <CheckCheck className="size-3" aria-label="Sent" />
              ))}
          </span>
        </div>
        {failed && (
          <div className="mt-1 flex items-center gap-1.5 px-1 text-[10px]">
            <span className="text-red-600">{message.error ?? "Not sent"}</span>
            {onRetry && (
              <button
                type="button"
                onClick={onRetry}
                className="font-semibold text-[#111111] underline underline-offset-2"
              >
                Retry
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import Image from "next/image";
import {
  Wallet,
  Plus,
  CreditCard,
  Smartphone,
  Banknote,
  ArrowDownLeft,
  ArrowUpRight,
  type LucideIcon,
} from "lucide-react";

interface Method {
  id: string;
  label: string;
  detail: string;
  icon: LucideIcon;
}

const methods: Method[] = [
  { id: "wallet", label: "Ridezy Wallet", detail: "Balance ₹1,240", icon: Wallet },
  { id: "upi", label: "UPI", detail: "rider@okaxis", icon: Smartphone },
  { id: "card", label: "Visa Card", detail: "•••• 4821", icon: CreditCard },
  { id: "cash", label: "Cash", detail: "Pay the driver directly", icon: Banknote },
];

const transactions = [
  { id: 1, label: "Ride to Electronic City", date: "Today, 9:40 AM", amount: -284 },
  { id: 2, label: "Wallet top-up via UPI", date: "Yesterday, 6:02 PM", amount: 500 },
  { id: 3, label: "Ride to Koramangala", date: "Yesterday, 7:58 PM", amount: -62 },
  { id: 4, label: "Cashback — WELCOME50", date: "Oct 2, 8:30 AM", amount: 50 },
  { id: 5, label: "Ride to Whitefield", date: "Oct 2, 8:44 AM", amount: -148 },
  { id: 6, label: "Ride to Kempegowda Airport", date: "Sep 29, 5:55 AM", amount: -812 },
];

const quickAmounts = [100, 200, 500, 1000];

const eyebrow = "text-[10px] font-bold uppercase tracking-[0.2em] text-[#8A8A8A]";

export default function PaymentsView() {
  const [preferred, setPreferred] = useState("wallet");
  const [amount, setAmount] = useState(500);

  return (
    <>
    {/* Banner — full width, same size as the History banner */}
    <div className="relative h-44 w-full overflow-hidden bg-[#F6EFDD] sm:h-60">
      <Image
        src="/payments-banner.webp"
        alt=""
        fill
        priority
        sizes="100vw"
        className="object-cover object-[center_90%]"
      />
    </div>

    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      {/* Header — same style as the dashboard panels */}
      <p className={eyebrow}>Wallet &amp; billing</p>
      <h1 className="mt-1.5 font-caslon text-3xl font-bold leading-none tracking-tight text-[#111111] sm:text-4xl">
        Payments
      </h1>
      <div className="mt-3 h-[3px] w-10 bg-[#111111]" />

      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-6">
          {/* Wallet */}
          <section className="relative overflow-hidden rounded-md bg-[#111111] p-6 text-white sm:p-7">
            <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full border border-white/10" />
            <div className="pointer-events-none absolute -right-6 -top-6 h-32 w-32 rounded-full border border-white/10" />

            <div className="relative">
              <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-white/60">
                <Wallet size={13} />
                Ridezy Wallet
              </p>
              <p className="mt-3 font-caslon text-5xl font-bold leading-none tracking-tight">₹1,240</p>
              <p className="mt-2 text-xs text-white/60">Available balance</p>

              <p className="mt-6 text-[10px] font-bold uppercase tracking-[0.2em] text-white/60">
                Top up
              </p>
              <div className="mt-2.5 flex flex-wrap gap-2">
                {quickAmounts.map((a) => (
                  <button
                    key={a}
                    type="button"
                    onClick={() => setAmount(a)}
                    aria-pressed={amount === a}
                    className={`rounded-md px-4 py-2 text-sm font-semibold transition-colors ${
                      amount === a
                        ? "bg-white text-[#111111]"
                        : "bg-white/10 text-white hover:bg-white/20"
                    }`}
                  >
                    ₹{a}
                  </button>
                ))}
              </div>

              <button
                type="button"
                className="mt-5 flex items-center gap-2 rounded-md bg-white px-5 py-3 text-sm font-semibold text-[#111111] transition-colors hover:bg-[#F4F4F4]"
              >
                <Plus size={16} strokeWidth={2.5} />
                Add ₹{amount}
              </button>
            </div>
          </section>

          {/* Transactions */}
          <section className="rounded-md border border-[#E8E8E8] bg-white">
            <div className="flex items-end justify-between border-b border-[#E8E8E8] px-5 py-4">
              <div>
                <p className={eyebrow}>Activity</p>
                <h2 className="mt-1 font-caslon text-2xl font-bold leading-none tracking-tight text-[#111111]">
                  Transactions
                </h2>
              </div>
              <p className="text-xs text-[#8A8A8A]">{transactions.length} recent</p>
            </div>
            <ul className="divide-y divide-[#F0F0F0]">
              {transactions.map((t) => {
                const credit = t.amount > 0;
                return (
                  <li
                    key={t.id}
                    className="group flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-[#FAFAFA]"
                  >
                    <span
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-md transition-colors duration-200 ${
                        credit
                          ? "bg-[#111111] text-white"
                          : "border border-[#E0E0E0] bg-white text-[#111111] group-hover:border-[#111111]"
                      }`}
                    >
                      {credit ? <ArrowDownLeft size={16} /> : <ArrowUpRight size={16} />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-[#111111]">{t.label}</p>
                      <p className="text-xs text-[#8A8A8A]">{t.date}</p>
                    </div>
                    <span className={`text-sm font-bold ${credit ? "text-[#15803D]" : "text-[#111111]"}`}>
                      {credit ? "+" : "−"}₹{Math.abs(t.amount)}
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
        </div>

        {/* Methods */}
        <aside className="h-fit rounded-md border border-[#E8E8E8] bg-white p-5 sm:p-6">
          <p className={eyebrow}>Pay with</p>
          <h2 className="mt-1.5 font-caslon text-2xl font-bold leading-none tracking-tight text-[#111111]">
            Payment Methods
          </h2>
          <div className="mt-3 h-[3px] w-10 bg-[#111111]" />

          <div className="mt-6 space-y-2" role="radiogroup" aria-label="Preferred payment method">
            {methods.map((m) => {
              const Icon = m.icon;
              const active = preferred === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setPreferred(m.id)}
                  className={`group flex w-full items-center gap-3 rounded-md border px-3 py-3 text-left transition-all duration-200 ${
                    active
                      ? "border-[#111111] bg-white shadow-[0_6px_16px_-8px_rgba(0,0,0,0.35)]"
                      : "border-transparent bg-[#F4F4F4] hover:bg-[#EDEDED]"
                  }`}
                >
                  <span
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-md transition-colors duration-200 ${
                      active
                        ? "bg-[#111111] text-white"
                        : "bg-white text-[#111111] group-hover:bg-[#111111] group-hover:text-white"
                    }`}
                  >
                    <Icon size={17} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-bold text-[#111111]">{m.label}</span>
                    <span className="block truncate text-xs text-[#7A7A7A]">{m.detail}</span>
                  </span>
                  <span
                    aria-hidden="true"
                    className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-[1.5px] ${
                      active ? "border-[#111111]" : "border-[#C4C4C4]"
                    }`}
                  >
                    {active && <span className="h-2 w-2 rounded-full bg-[#111111]" />}
                  </span>
                </button>
              );
            })}
          </div>

          <button
            type="button"
            className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-[#C4C4C4] py-3 text-sm font-semibold text-[#5A5A5A] transition-colors hover:border-[#111111] hover:bg-[#111111] hover:text-white"
          >
            <Plus size={15} />
            Add new method
          </button>
        </aside>
      </div>
    </div>
    </>
  );
}

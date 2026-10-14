"use client";

import React, { useState, useEffect, useRef } from "react";
import Image from "next/image";
import {
  CreditCard,
  Search,
  ChevronDown,
  RotateCcw,
  IndianRupee,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ArrowUpRight,
  TrendingUp,
  Wallet,
  Smartphone,
  Banknote,
  Receipt,
  User,
  Check,
  Percent,
} from "lucide-react";

const API_BASE = "http://localhost:5000/api";

interface DropdownOption {
  value: string;
  label: string;
}


const METHOD_OPTIONS: DropdownOption[] = [
  { value: "ALL", label: "All Methods" },
  { value: "CASH", label: "Cash" },
  { value: "UPI", label: "UPI" },
  { value: "CARD", label: "Card" },
  { value: "WALLET", label: "Wallet" },
];

function CustomDropdown({
  value,
  onChange,
  options,
  ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  options: DropdownOption[];
  ariaLabel?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const selectedOption = options.find((opt) => opt.value === value) || options[0];
  const isFiltered = value !== "ALL";

  return (
    <div className="relative shrink-0" ref={containerRef}>
      <button
        type="button"
        aria-label={ariaLabel || selectedOption.label}
        onClick={() => setIsOpen((prev) => !prev)}
        className={`group inline-flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-medium transition-colors cursor-pointer select-none bg-white ${
          isFiltered
            ? "border border-stone-400 text-stone-900 bg-stone-50/60"
            : "border border-[#EDEDE8] text-stone-600 hover:text-stone-900 hover:border-stone-300"
        } ${isOpen ? "border-stone-400 ring-1 ring-stone-200" : ""}`}
      >
        <span>{selectedOption.label}</span>
        <ChevronDown
          className={`w-3.5 h-3.5 text-stone-400 transition-transform ${
            isOpen ? "rotate-180 text-stone-600" : ""
          }`}
        />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-1.5 w-48 rounded-xl border border-[#EDEDE8] bg-white p-1.5 shadow-xl shadow-stone-900/10 z-50 animate-in fade-in zoom-in-95">
          {options.map((opt) => {
            const isSelected = opt.value === value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  onChange(opt.value);
                  setIsOpen(false);
                }}
                className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-xs font-medium text-left cursor-pointer transition-colors ${
                  isSelected
                    ? "bg-stone-900 text-white shadow-2xs font-semibold"
                    : "text-stone-700 hover:bg-stone-100 hover:text-stone-900"
                }`}
              >
                <span>{opt.label}</span>
                {isSelected && <Check className="w-3.5 h-3.5 text-white shrink-0" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

interface AdminPayment {
  id: string;
  rideId: string;
  /** Final total charged (fare + tip). */
  amount: number;
  baseFare?: number;
  tipAmount?: number;
  /** Only true once the payment is COMPLETED. */
  tipPaid?: boolean;
  currency: string;
  method: string;
  status: string;
  createdAt: string;
  passenger?: { id: string; name: string; phone: string | null; email: string } | null;
  driver?: { id: string; name: string; phone: string | null; email: string } | null;
}

interface PaymentTotals {
  totalRevenue: number;
  totalAmount: number;
  commission8Percent: number;
  companyProfit: number;
  successfulCount: number;
  pendingCount: number;
  failedCount: number;
  failedAmount: number;
  /** Paid tips (100% the driver's, no commission). */
  paidTips: number;
}

export default function AdminPaymentsPage() {
  const [payments, setPayments] = useState<AdminPayment[]>([]);
  const [totals, setTotals] = useState<PaymentTotals>({
    totalRevenue: 0,
    totalAmount: 0,
    commission8Percent: 0,
    companyProfit: 0,
    successfulCount: 0,
    pendingCount: 0,
    failedCount: 0,
    failedAmount: 0,
    paidTips: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [methodFilter, setMethodFilter] = useState("ALL");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const fetchPayments = async () => {
    setIsLoading(true);
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
      if (!token) return;

      const endpoint = `${API_BASE}/admin/payments?page=${page}&limit=20`;

      const res = await fetch(endpoint, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json.success && json.data) {
        const rawPayments = json.data.payments || [];
        setPayments(rawPayments);
        const rawTotals = json.data.totals || json.data.summary || {};

        // Strictly exclude FAILED payments from total amount, 8% fee, and company profit
        const nonFailedPayments = rawPayments.filter((p: any) => p.status !== "FAILED");
        const failedPayments = rawPayments.filter((p: any) => p.status === "FAILED");
        const fallbackPaidSum = nonFailedPayments.reduce((acc: number, p: any) => acc + (Number(p.amount) || 0), 0);
        const fallbackFailedSum = failedPayments.reduce((acc: number, p: any) => acc + (Number(p.amount) || 0), 0);

        const resolvedTotalAmount =
          rawTotals.paidAmount ??
          rawTotals.totalAmount ??
          fallbackPaidSum;

        // Commission is on ride fares only; tips go 100% to the driver.
        const resolvedCommission =
          rawTotals.commission8Percent ??
          Math.round((rawTotals.paidFares ?? resolvedTotalAmount) * 0.08 * 100) / 100;

        const resolvedFailedCount = rawTotals.failedCount ?? failedPayments.length;
        const resolvedFailedAmount = rawTotals.failedAmount ?? fallbackFailedSum;

        setTotals({
          totalRevenue: resolvedTotalAmount,
          totalAmount: resolvedTotalAmount,
          commission8Percent: resolvedCommission,
          companyProfit: rawTotals.companyProfit ?? resolvedCommission,
          successfulCount: rawTotals.successfulCount ?? rawTotals.paidCount ?? nonFailedPayments.length,
          pendingCount: rawTotals.pendingCount ?? 0,
          failedCount: resolvedFailedCount,
          failedAmount: resolvedFailedAmount,
          paidTips: rawTotals.paidTips ?? 0,
        });

        if (json.data.pagination) {
          setTotalPages(json.data.pagination.pages || 1);
          setTotalCount(json.data.pagination.total || 0);
        }
      }
    } catch {
      // Keep state
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPayments();
  }, [page]);

  const filteredPayments = payments.filter((p) => {
    if (methodFilter !== "ALL" && p.method?.toUpperCase() !== methodFilter) {
      return false;
    }
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    const idMatch = p.id.toLowerCase().includes(q) || p.rideId?.toLowerCase().includes(q);
    const passMatch =
      p.passenger?.name?.toLowerCase().includes(q) ||
      p.passenger?.email?.toLowerCase().includes(q) ||
      p.passenger?.phone?.includes(q);
    const driverMatch =
      p.driver?.name?.toLowerCase().includes(q) ||
      p.driver?.email?.toLowerCase().includes(q) ||
      p.driver?.phone?.includes(q);

    return idMatch || passMatch || driverMatch;
  });

  const getMethodIcon = (method: string) => {
    switch (method?.toUpperCase()) {
      case "UPI":
        return <Smartphone className="w-3.5 h-3.5 text-indigo-600" />;
      case "CARD":
        return <CreditCard className="w-3.5 h-3.5 text-sky-600" />;
      case "WALLET":
        return <Wallet className="w-3.5 h-3.5 text-purple-600" />;
      default:
        return <Banknote className="w-3.5 h-3.5 text-emerald-600" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "COMPLETED":
      case "PAID":
        return (
          <span className="text-xs font-bold uppercase text-emerald-600">
            COMPLETED
          </span>
        );
      case "PENDING":
        return (
          <span className="text-xs font-bold uppercase text-amber-600">
            PENDING
          </span>
        );
      case "FAILED":
        return (
          <span className="text-xs font-bold uppercase text-rose-600">
            FAILED
          </span>
        );
      case "REFUNDED":
        return (
          <span className="text-xs font-bold uppercase text-purple-600">
            REFUNDED
          </span>
        );
      default:
        return (
          <span className="text-xs font-bold uppercase text-stone-600">
            {status.replace(/_/g, " ")}
          </span>
        );
    }
  };

  return (
    <div className="space-y-4 sm:space-y-5 animate-in fade-in duration-300">
      {/* 1. TOP HERO BANNER */}
      <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl bg-white border border-[#EDEDE8] shadow-xs h-[190px] sm:h-[210px] lg:h-[225px] flex items-center w-full shrink-0">
        <div className="absolute inset-0 w-full h-full pointer-events-none select-none">
          <Image
            src="/admin-banner.jpg"
            alt="Payment & Revenue Banner"
            fill
            priority
            className="object-cover"
            style={{ objectPosition: "right 19%" }}
          />
        </div>

        <div className="relative z-10 w-full px-6 py-4 sm:px-8 sm:py-5 flex flex-col justify-center">
          <div className="max-w-xl">
            <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#7A7A74]">
              Finance &amp; Transactions
            </span>
            <h1 className="font-caslon text-2xl sm:text-3xl lg:text-[34px] font-bold text-[#111111] tracking-tight leading-tight mt-1">
              Payments &amp; Platform Revenue
            </h1>
            <p className="text-xs sm:text-sm text-stone-600 mt-1 font-normal leading-relaxed">
              Inspect all rider checkout payments, monitor driver payouts, cash collections, and track real-time platform earnings.
            </p>
          </div>
        </div>
      </div>

      {/* 2. SUMMARY METRICS CARDS (4 KPIs) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* KPI 1: Total Amount (Strictly excluding failed) */}
        <div className="rounded-2xl bg-white border border-[#EDEDE8] p-3.5 sm:p-4 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400">
              Total Amount
            </span>
            <div className="w-6 h-6 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100/60">
              <IndianRupee className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-2">
            <p className="font-caslon text-2xl sm:text-[26px] font-bold text-[#111111] leading-none">
              ₹{totals.totalAmount.toLocaleString()}
            </p>
            <p className="text-[11px] text-stone-500 mt-1 flex items-center gap-1">
              <span className="text-emerald-600 font-semibold inline-flex items-center gap-0.5">
                <TrendingUp className="w-3 h-3" /> Live
              </span>
              <span>completed transactions</span>
            </p>
            {totals.paidTips > 0 && (
              <p className="text-[11px] text-stone-500 mt-0.5">
                incl. ₹{totals.paidTips.toLocaleString()} driver tips
              </p>
            )}
          </div>
        </div>

        {/* KPI 2: Sum of 8% of Amount of Each Transaction */}
        <div className="rounded-2xl bg-white border border-[#EDEDE8] p-3.5 sm:p-4 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400">
              8% Platform Fee
            </span>
            <div className="w-6 h-6 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center border border-sky-100/60">
              <Percent className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-2">
            <p className="font-caslon text-2xl sm:text-[26px] font-bold text-[#111111] leading-none">
              ₹{Math.round(totals.commission8Percent).toLocaleString()}
            </p>
            <p className="text-[11px] text-stone-500 mt-1">
              8% of ride fares (tips excluded)
            </p>
          </div>
        </div>

        {/* KPI 3: Company Profit */}
        <div className="rounded-2xl bg-white border border-[#EDEDE8] p-3.5 sm:p-4 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400">
              Company Profit
            </span>
            <div className="w-6 h-6 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center border border-purple-100/60">
              <TrendingUp className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-2">
            <p className="font-caslon text-2xl sm:text-[26px] font-bold text-[#111111] leading-none">
              ₹{Math.round(totals.companyProfit).toLocaleString()}
            </p>
            <p className="text-[11px] text-emerald-600 font-medium mt-1">
              Net platform profit (8% cut)
            </p>
          </div>
        </div>

        {/* KPI 4: Failed Transactions (Excluded from totals) */}
        <div className="rounded-2xl bg-white border border-[#EDEDE8] p-3.5 sm:p-4 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400">
              Failed Transactions
            </span>
            <div className="w-6 h-6 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center border border-rose-100/60">
              <AlertTriangle className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-2">
            <p className="font-caslon text-2xl sm:text-[26px] font-bold text-[#111111] leading-none">
              {totals.failedCount}
            </p>
            <p className="text-[11px] text-rose-600 font-medium mt-1">
              ₹{totals.failedAmount.toLocaleString()} excluded from total
            </p>
          </div>
        </div>
      </div>

      {/* 3. FILTERS BAR */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Search Input */}
        <div className="relative min-w-[200px] sm:min-w-[280px] flex-1 sm:flex-none">
          <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search payment ID, ride ID, rider, driver..."
            className="w-full pl-9 pr-3 py-2 rounded-xl text-xs sm:text-sm border border-[#EDEDE8] bg-white placeholder:text-stone-400 focus:outline-hidden focus:border-stone-400 transition-colors"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <CustomDropdown
            value={methodFilter}
            onChange={setMethodFilter}
            options={METHOD_OPTIONS}
            ariaLabel="Filter by Method"
          />

          <button
            type="button"
            onClick={fetchPayments}
            title="Refresh payments"
            className="p-2.5 rounded-xl border border-[#EDEDE8] bg-white text-stone-600 hover:text-stone-900 hover:bg-stone-50 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 4. PAYMENTS TABLE */}
      <div className="rounded-2xl sm:rounded-3xl bg-white border border-[#EDEDE8] shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#EDEDE8] bg-[#FBFBFA] text-[11px] font-bold uppercase tracking-wider text-[#7A7A72]">
                <th className="py-4 px-5 sm:px-6">Transaction Ref</th>
                <th className="py-4 px-4 sm:px-5">Rider / Passenger</th>
                <th className="py-4 px-4 sm:px-5">Driver Partner</th>
                <th className="py-4 px-4 sm:px-5">Payment Method</th>
                <th className="py-4 px-4 sm:px-5 text-right">Amount</th>
                <th className="py-4 px-5 sm:px-6 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F0EFEA] text-xs sm:text-sm">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-stone-400 text-xs">
                    Loading platform payment logs...
                  </td>
                </tr>
              ) : filteredPayments.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-stone-400 text-xs">
                    No transactions found matching your criteria.
                  </td>
                </tr>
              ) : (
                filteredPayments.map((p) => {
                  return (
                    <tr key={p.id} className="hover:bg-[#F9F9F6] transition-colors">
                      {/* ID and Ride Ref */}
                      <td className="py-4 px-5 sm:px-6">
                        <div className="space-y-1">
                          <span className="font-mono text-xs font-bold text-stone-900">
                            TXN-{p.id.slice(-6).toUpperCase()}
                          </span>
                          <span className="block text-[11px] text-stone-500 font-mono">
                            Ride #{String(p.rideId).slice(-6).toUpperCase()}
                          </span>
                          <span className="text-[10px] text-stone-400 block">
                            {new Date(p.createdAt).toLocaleDateString()} at{" "}
                            {new Date(p.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </td>

                      {/* Passenger */}
                      <td className="py-4 px-4 sm:px-5">
                        {p.passenger ? (
                          <div className="space-y-0.5">
                            <p className="font-medium text-stone-900 text-xs">
                              {p.passenger.name}
                            </p>
                            {p.passenger.phone && (
                              <p className="text-[11px] text-stone-500 font-mono">
                                {p.passenger.phone}
                              </p>
                            )}
                          </div>
                        ) : (
                          <span className="text-stone-400">—</span>
                        )}
                      </td>

                      {/* Driver */}
                      <td className="py-4 px-4 sm:px-5">
                        {p.driver ? (
                          <div className="space-y-0.5">
                            <p className="font-medium text-stone-900 text-xs">
                              {p.driver.name}
                            </p>
                            {p.driver.phone && (
                              <p className="text-[11px] text-stone-500 font-mono">
                                {p.driver.phone}
                              </p>
                            )}
                          </div>
                        ) : (
                          <span className="text-stone-400">—</span>
                        )}
                      </td>

                      {/* Payment Method */}
                      <td className="py-4 px-4 sm:px-5">
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-stone-50 border border-stone-200/80 text-xs font-semibold text-stone-700">
                          {getMethodIcon(p.method)}
                          <span>{p.method || "CASH"}</span>
                        </div>
                      </td>

                      {/* Amount */}
                      <td className="py-4 px-4 sm:px-5 text-right font-medium text-stone-900">
                        <span className="font-caslon text-base font-bold text-stone-900">
                          ₹{p.amount}
                        </span>
                        {p.status !== "FAILED" && (p.tipAmount ?? 0) > 0 && (
                          <span className="block text-[10px] text-stone-500">
                            incl. ₹{p.tipAmount} tip{p.tipPaid ? "" : " (pending)"}
                          </span>
                        )}
                        <span className="block text-[10px] text-stone-400 uppercase">
                          {p.currency || "INR"}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="py-4 px-5 sm:px-6 text-center">
                        {getStatusBadge(p.status)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* PAGINATION */}
        {!isLoading && totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-[#EDEDE8] bg-[#FBFBFA] text-xs text-stone-600">
            <span>
              Showing {filteredPayments.length} of {totalCount} transactions
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-3 py-1.5 rounded-lg border border-[#EDEDE8] bg-white text-stone-700 disabled:opacity-40 cursor-pointer hover:bg-stone-50"
              >
                Previous
              </button>
              <span className="font-semibold text-stone-900">
                Page {page} of {totalPages}
              </span>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="px-3 py-1.5 rounded-lg border border-[#EDEDE8] bg-white text-stone-700 disabled:opacity-40 cursor-pointer hover:bg-stone-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

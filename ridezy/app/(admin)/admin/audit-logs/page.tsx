"use client";

import React, { useState, useEffect, useRef } from "react";
import Image from "next/image";
import {
  ShieldCheck,
  Search,
  ChevronDown,
  RotateCcw,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Lock,
  User,
  Shield,
  FileText,
  Activity,
  History,
  Check,
} from "lucide-react";
import { API_BASE } from "@/lib/config";


interface DropdownOption {
  value: string;
  label: string;
}

const ACTION_OPTIONS: DropdownOption[] = [
  { value: "ALL", label: "All Audit Actions" },
  { value: "DRIVER_VERIFIED", label: "Driver Verified" },
  { value: "DRIVER_SUSPENDED", label: "Driver Suspended" },
  { value: "DRIVER_ACTIVATED", label: "Driver Activated" },
  { value: "DRIVER_REJECTED", label: "Driver Rejected" },
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
        <div className="absolute right-0 mt-1.5 w-52 rounded-xl border border-[#EDEDE8] bg-white p-1.5 shadow-xl shadow-stone-900/10 z-50 animate-in fade-in zoom-in-95">
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

interface AuditLogEntry {
  id: string;
  _id?: string;
  adminId?: string;
  action: string;
  targetType: string;
  targetId: string;
  details?: Record<string, any>;
  createdAt: string;
  admin?: { id: string; name: string; email: string; role?: string } | null;
}

export default function AdminAuditLogsPage() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("ALL");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const fetchLogs = async () => {
    setIsLoading(true);
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
      if (!token) return;

      const endpoint = `${API_BASE}/admin/audit-logs?page=${page}&limit=20`;

      const res = await fetch(endpoint, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json.success && json.data) {
        const rawLogs = json.data.logs || json.data.auditLogs || [];
        setLogs(Array.isArray(rawLogs) ? rawLogs : []);
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
    fetchLogs();
  }, [page]);

  const normalizeAction = (action: string) => {
    const act = (action || "").toUpperCase();
    if (act === "DRIVER_VERIFIED" || act === "VERIFY_DRIVER") return "DRIVER_VERIFIED";
    if (act === "DRIVER_SUSPENDED" || act === "SUSPEND_DRIVER") return "DRIVER_SUSPENDED";
    if (act === "DRIVER_ACTIVATED" || act === "ACTIVATE_DRIVER") return "DRIVER_ACTIVATED";
    if (act === "DRIVER_REJECTED" || act === "REJECT_DRIVER") return "DRIVER_REJECTED";
    return act;
  };

  const filteredLogs = logs.filter((log) => {
    const norm = normalizeAction(log.action);
    if (actionFilter !== "ALL" && norm !== actionFilter) {
      return false;
    }
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    const actionMatch = log.action.toLowerCase().includes(q) || norm.toLowerCase().includes(q);
    const targetMatch = log.targetId?.toLowerCase().includes(q) || log.targetType?.toLowerCase().includes(q);
    const adminMatch =
      log.admin?.name?.toLowerCase().includes(q) ||
      log.admin?.email?.toLowerCase().includes(q);
    const reasonMatch =
      typeof log.details?.reason === "string" &&
      log.details.reason.toLowerCase().includes(q);

    return actionMatch || targetMatch || adminMatch || reasonMatch;
  });

  const getActionBadge = (action: string) => {
    const normalized = normalizeAction(action);
    switch (normalized) {
      case "DRIVER_VERIFIED":
        return (
          <span className="text-xs font-bold uppercase text-emerald-600">
            DRIVER VERIFIED
          </span>
        );
      case "DRIVER_SUSPENDED":
        return (
          <span className="text-xs font-bold uppercase text-amber-600">
            DRIVER SUSPENDED
          </span>
        );
      case "DRIVER_ACTIVATED":
        return (
          <span className="text-xs font-bold uppercase text-sky-600">
            DRIVER ACTIVATED
          </span>
        );
      case "DRIVER_REJECTED":
        return (
          <span className="text-xs font-bold uppercase text-rose-600">
            DRIVER REJECTED
          </span>
        );
      default:
        return (
          <span className="text-xs font-bold uppercase text-stone-600">
            {action.replace(/_/g, " ")}
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
            alt="Security & Audit Logs Banner"
            fill
            priority
            className="object-cover"
            style={{ objectPosition: "right 19%" }}
          />
        </div>

        <div className="relative z-10 w-full px-6 py-4 sm:px-8 sm:py-5 flex flex-col justify-center">
          <div className="max-w-xl">
            <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#7A7A74]">
              Security &amp; Compliance Trail
            </span>
            <h1 className="font-caslon text-2xl sm:text-3xl lg:text-[34px] font-bold text-[#111111] tracking-tight leading-tight mt-1">
              Admin Action Audit Logs
            </h1>
            <p className="text-xs sm:text-sm text-stone-600 mt-1 font-normal leading-relaxed">
              Tamper-evident record of all administrative actions, driver verifications, account suspensions, and security overrides.
            </p>
          </div>
        </div>
      </div>

      {/* 2. FILTERS BAR */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Search Input */}
        <div className="relative min-w-[200px] sm:min-w-[280px] flex-1 sm:flex-none">
          <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by action, target ID, admin, or reason..."
            className="w-full pl-9 pr-3 py-2 rounded-xl text-xs sm:text-sm border border-[#EDEDE8] bg-white placeholder:text-stone-400 focus:outline-hidden focus:border-stone-400 transition-colors"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <CustomDropdown
            value={actionFilter}
            onChange={(v) => {
              setActionFilter(v);
              setPage(1);
            }}
            options={ACTION_OPTIONS}
            ariaLabel="Filter by Action"
          />

          <button
            type="button"
            onClick={fetchLogs}
            title="Refresh audit logs"
            className="p-2.5 rounded-xl border border-[#EDEDE8] bg-white text-stone-600 hover:text-stone-900 hover:bg-stone-50 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 3. AUDIT LOGS TABLE */}
      <div className="rounded-2xl sm:rounded-3xl bg-white border border-[#EDEDE8] shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#EDEDE8] bg-[#FBFBFA] text-[11px] font-bold uppercase tracking-wider text-[#7A7A72]">
                <th className="py-4 px-5 sm:px-6">Timestamp</th>
                <th className="py-4 px-4 sm:px-5">Action Performed</th>
                <th className="py-4 px-4 sm:px-5">Admin Operator</th>
                <th className="py-4 px-4 sm:px-5">Target Entity</th>
                <th className="py-4 px-5 sm:px-6">Details / Rationale</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F0EFEA] text-xs sm:text-sm">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-stone-400 text-xs">
                    Loading security audit logs...
                  </td>
                </tr>
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-stone-400 text-xs">
                    No audit records found matching your filter criteria.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => {
                  const reason =
                    log.details?.reason ||
                    log.details?.rejectionReason ||
                    (log.details ? JSON.stringify(log.details) : "Standard admin action");

                  return (
                    <tr key={log.id} className="hover:bg-[#F9F9F6] transition-colors">
                      {/* Timestamp */}
                      <td className="py-4 px-5 sm:px-6">
                        <div className="space-y-0.5">
                          <span className="font-mono text-xs font-semibold text-stone-800">
                            {new Date(log.createdAt).toLocaleDateString()}
                          </span>
                          <span className="block text-[11px] text-stone-400 font-mono">
                            {new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                          </span>
                        </div>
                      </td>

                      {/* Action */}
                      <td className="py-4 px-4 sm:px-5">
                        {getActionBadge(log.action)}
                      </td>

                      {/* Admin User */}
                      <td className="py-4 px-4 sm:px-5">
                        <div className="space-y-0.5">
                          <p className="font-medium text-stone-900 text-xs">
                            {log.admin?.name || "Administrator"}
                          </p>
                          <p className="text-[11px] text-stone-500 font-mono">
                            {log.admin?.email || String(log.adminId).slice(-6).toUpperCase()}
                          </p>
                        </div>
                      </td>

                      {/* Target */}
                      <td className="py-4 px-4 sm:px-5">
                        <div className="space-y-0.5">
                          <span className="inline-block px-2 py-0.5 rounded-md bg-stone-100 text-[11px] font-semibold text-stone-700">
                            {log.targetType}
                          </span>
                          <span className="block font-mono text-[11px] text-stone-500">
                            #{String(log.targetId).slice(-6).toUpperCase()}
                          </span>
                        </div>
                      </td>

                      {/* Details / Reason */}
                      <td className="py-4 px-5 sm:px-6">
                        <p className="text-xs text-stone-700 max-w-md line-clamp-2">
                          {reason}
                        </p>
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
              Showing {filteredLogs.length} of {totalCount} audit entries
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

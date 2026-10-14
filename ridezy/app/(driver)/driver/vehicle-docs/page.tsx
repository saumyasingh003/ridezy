"use client";

import React, { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {Car,ShieldCheck,FileText,FileCheck2,Heart,CheckCircle2,AlertCircle,Building,Upload,Calendar,CreditCard,Check,X,Sparkles,RefreshCw,
} from "lucide-react";

interface ToastItem {
  id: string;
  type: "success" | "error" | "info";
  message: string;
}

export default function DriverVehicleDocsPage() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [selectedDoc, setSelectedDoc] = useState<string | null>(null);

  const showToast = (message: string, type: "success" | "error" | "info" = "info") => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const handleDocumentUpload = (docName: string) => {
    showToast(`Uploading new document copy for ${docName}...`, "info");
    setTimeout(() => {
      showToast(`${docName} submitted successfully for safety review.`, "success");
      setSelectedDoc(null);
    }, 1500);
  };

  return (
    <div className="min-h-screen bg-[#FBFBFA] pb-24 text-black">
      {/* Toast Notification Container (Bottom-Right) */}
      <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className="pointer-events-auto flex items-center justify-between gap-3 px-4 py-2.5 rounded-lg bg-black text-white shadow-xl border border-neutral-800 text-xs animate-in slide-in-from-bottom-3 duration-200"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              {toast.type === "success" && <Check className="w-4 h-4 text-emerald-400 shrink-0" />}
              {toast.type === "error" && <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />}
              {toast.type === "info" && <ShieldCheck className="w-4 h-4 text-sky-400 shrink-0" />}
              <span className="truncate">{toast.message}</span>
            </div>
            <button
              onClick={() => removeToast(toast.id)}
              className="text-white/60 hover:text-white p-0.5 cursor-pointer shrink-0"
              aria-label="Dismiss toast"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>

      <div className="w-full px-4 sm:px-6 lg:px-8 pt-3 sm:pt-4 space-y-6">

        {/* 1. VEHICLE & DOCS BANNER */}
        <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl bg-white border border-[#EDEDE8] shadow-xs p-6 sm:p-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#7A7A74]">
                Fleet &bull; Safety Compliance
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-bold uppercase tracking-wider">
                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                100% Verified
              </span>
            </div>
            <h1 className="font-caslon text-3xl sm:text-4xl font-bold text-[#111111] tracking-tight">
              Vehicle &amp; Documents
            </h1>
            <p className="text-xs sm:text-sm text-stone-600 font-normal">
              Manage your commercial taxi fleet specs, registration certificates, and regulatory credentials.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => showToast("Opening renewal upload portal...", "info")}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-black text-white text-xs sm:text-sm font-semibold hover:bg-neutral-800 transition-all cursor-pointer shadow-xs"
            >
              <Upload className="w-4 h-4" />
              <span>Submit Document</span>
            </button>
          </div>
        </div>

        {/* 2. 2-COLUMN SECTION: VEHICLE FLEET & REGULATORY CREDENTIALS */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-stretch">
          {/* VEHICLE & FLEET CARD */}
          <section className="rounded-2xl sm:rounded-3xl border border-zinc-200 bg-white p-6 sm:p-8 shadow-xs flex flex-col justify-between space-y-6">
            <div className="space-y-6">
              <div className="flex items-center justify-between pb-3 border-b border-zinc-200">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-black text-white">
                    <Car className="w-4 h-4" />
                  </span>
                  <div>
                    <h2 className="font-caslon text-xl font-bold text-black">Registered Fleet Vehicle</h2>
                    <p className="text-[11px] text-zinc-500">Authorized sedan assigned to your captain account.</p>
                  </div>
                </div>
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-bold uppercase tracking-wider">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                  Active RC
                </span>
              </div>

              {/* Vehicle Photo Banner */}
              <div className="relative h-48 w-full rounded-2xl overflow-hidden border border-zinc-200 bg-zinc-100 shadow-2xs">
                <Image
                  src=""
                  alt="Registered Taxi Sedan"
                  fill
                  className="object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent flex items-end p-5">
                  <div className="text-white">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-white/80">Vehicle Model</p>
                    <p className="text-lg font-bold font-caslon">Hyundai Aura S &bull; White Clean Sedan</p>
                  </div>
                </div>
              </div>

              {/* Vehicle Spec Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                <div className="rounded-xl border border-zinc-200 bg-[#FAFAFA] p-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">License Plate</p>
                  <p className="font-mono text-xs font-bold text-black mt-1">BR 01 CA 4589</p>
                </div>
                <div className="rounded-xl border border-zinc-200 bg-[#FAFAFA] p-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Ride Class</p>
                  <p className="text-xs font-bold text-black mt-1">Sedan / Comfort</p>
                </div>
                <div className="rounded-xl border border-zinc-200 bg-[#FAFAFA] p-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Seating</p>
                  <p className="text-xs font-bold text-black mt-1">4 Passengers</p>
                </div>
                <div className="rounded-xl border border-zinc-200 bg-[#FAFAFA] p-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">AC System</p>
                  <p className="text-xs font-bold text-black mt-1">Climate Control</p>
                </div>
              </div>
            </div>

            {/* Maintenance & Compliance Table */}
            <div className="space-y-2 text-xs border-t border-zinc-100 pt-4">
              <div className="flex items-center justify-between py-2 border-b border-zinc-100">
                <span className="text-zinc-600">Commercial Fitness Certificate</span>
                <span className="font-medium text-black">Valid till 18 Nov 2026</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-zinc-100">
                <span className="text-zinc-600">Commercial Comprehensive Insurance</span>
                <span className="font-medium text-black">Valid (Policy #HDFC-ERGO-8921)</span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-zinc-600">Pollution Under Control (PUC)</span>
                <span className="font-medium text-black">Valid till 22 Dec 2026</span>
              </div>
            </div>
          </section>

          {/* CREDENTIALS & COMPLIANCE LOCKER */}
          <section className="rounded-2xl sm:rounded-3xl border border-zinc-200 bg-white p-6 sm:p-8 shadow-xs flex flex-col justify-between space-y-6">
            <div className="space-y-6">
              <div className="flex items-center justify-between pb-3 border-b border-zinc-200">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-black text-white">
                    <ShieldCheck className="w-4 h-4" />
                  </span>
                  <div>
                    <h2 className="font-caslon text-xl font-bold text-black">Compliance &amp; Credentials</h2>
                    <p className="text-[11px] text-zinc-500">Official documents verified by Ridezy Trust &amp; Safety.</p>
                  </div>
                </div>
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-black text-white text-[10px] font-bold uppercase tracking-wider">
                  Verified
                </span>
              </div>

              {/* Document Cards */}
              <div className="space-y-3">
                {/* Driving License */}
                <div className="flex items-center justify-between p-3.5 rounded-xl border border-zinc-200 bg-[#FAFAFA] hover:border-black transition-colors">
                  <div className="flex items-center gap-3">
                    <FileText className="w-5 h-5 text-zinc-700" />
                    <div>
                      <p className="text-xs font-bold text-black">Commercial Driving License (DL)</p>
                      <p className="text-[11px] font-mono text-zinc-500 mt-0.5">BR097826H8HMK03N3303</p>
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-black">
                    <CheckCircle2 className="w-3.5 h-3.5 text-black" />
                    Verified
                  </span>
                </div>

                {/* Police Background Verification */}
                <div className="flex items-center justify-between p-3.5 rounded-xl border border-zinc-200 bg-[#FAFAFA] hover:border-black transition-colors">
                  <div className="flex items-center gap-3">
                    <FileCheck2 className="w-5 h-5 text-zinc-700" />
                    <div>
                      <p className="text-xs font-bold text-black">Police Background Verification</p>
                      <p className="text-[11px] text-zinc-500 mt-0.5">Patna Central Police HQ &bull; Clean Record</p>
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-black">
                    <CheckCircle2 className="w-3.5 h-3.5 text-black" />
                    Approved
                  </span>
                </div>

                {/* Vehicle Registration Certificate (RC) */}
                <div className="flex items-center justify-between p-3.5 rounded-xl border border-zinc-200 bg-[#FAFAFA] hover:border-black transition-colors">
                  <div className="flex items-center gap-3">
                    <Car className="w-5 h-5 text-zinc-700" />
                    <div>
                      <p className="text-xs font-bold text-black">Registration Certificate (RC)</p>
                      <p className="text-[11px] text-zinc-500 mt-0.5">BR01-2023-4589 &bull; Commercial Tourist Taxi</p>
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-black">
                    <CheckCircle2 className="w-3.5 h-3.5 text-black" />
                    Verified
                  </span>
                </div>

                {/* Medical & Eye Checkup */}
                <div className="flex items-center justify-between p-3.5 rounded-xl border border-zinc-200 bg-[#FAFAFA] hover:border-black transition-colors">
                  <div className="flex items-center gap-3">
                    <Heart className="w-5 h-5 text-zinc-700" />
                    <div>
                      <p className="text-xs font-bold text-black">Medical &amp; Visual Fitness</p>
                      <p className="text-[11px] text-zinc-500 mt-0.5">Authorized Civil Hospital Certificate</p>
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-black">
                    <CheckCircle2 className="w-3.5 h-3.5 text-black" />
                    Passed
                  </span>
                </div>
              </div>
            </div>

            {/* Payout Bank Info */}
            <div className="p-4 rounded-xl border border-zinc-200 bg-zinc-50 space-y-2 mt-4">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">
                  Bank Settlement Account
                </span>
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-md">
                  Auto-Payout Active
                </span>
              </div>
              <p className="text-xs font-bold text-black">HDFC Bank Limited &bull; A/C •••• 4091</p>
              <p className="text-[11px] text-zinc-500 font-mono">UPI: vikram.ridezy@okhdfcbank</p>
            </div>
          </section>
        </div>

      </div>
    </div>
  );
}

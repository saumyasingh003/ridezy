"use client";

import React, { useState, useEffect } from "react";
import {
  User,
  Mail,
  Phone,
  Calendar,
  ShieldCheck,
  Edit2,
  Check,
  X,
  AlertCircle,
  MapPin,
  Save,
} from "lucide-react";

const API_BASE = "http://localhost:5000/api";

interface ToastItem {
  id: string;
  type: "success" | "error" | "info";
  message: string;
}

interface PassengerProfileData {
  name: string;
  email: string;
  phone?: string | null;
  dateOfBirth?: string | null;
  gender?: "MALE" | "FEMALE" | "OTHER" | null;
  profileImage?: string | null;
  savedPlaces?: any[];
}

export default function PassengerProfileView() {
  const [profile, setProfile] = useState<PassengerProfileData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  // Editable fields
  const [phone, setPhone] = useState("");
  const [gender, setGender] = useState<"MALE" | "FEMALE" | "OTHER">("FEMALE");
  const [dob, setDob] = useState("");

  const showToast = (message: string, type: "success" | "error" | "info" = "info") => {
    if (!message) return;
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // 1. GET /api/passengers/profile
  const fetchProfile = async () => {
    setIsLoading(true);
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
      if (!token) return;

      const res = await fetch(`${API_BASE}/passengers/profile`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const json = await res.json().catch(() => ({}));

      if (res.ok && json.success && json.data) {
        setProfile(json.data);
        if (json.data.phone) {
          setPhone(json.data.phone.replace(/^\+91/, ""));
        }
        if (json.data.gender) {
          setGender(json.data.gender);
        }
        if (json.data.dateOfBirth) {
          // Format ISO date to YYYY-MM-DD
          setDob(json.data.dateOfBirth.slice(0, 10));
        }
      } else if (res.status === 404) {
        // Fallback to localStorage data
        const localName = localStorage.getItem("userName") || "User";
        const localEmail = localStorage.getItem("userEmail") || "user@example.com";
        const localPhone = localStorage.getItem("userPhone") || "";
        setProfile({
          name: localName,
          email: localEmail,
          phone: localPhone,
          dateOfBirth: null,
          gender: "FEMALE",
        });
      }
    } catch {
      showToast("Cannot connect to server. Please try again later.", "error");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  // 2. PATCH /api/passengers/profile (or POST if initial creation)
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
      if (!token) return;

      const cleanPhone = phone ? "+91" + phone.replace(/\D/g, "").slice(-10) : undefined;
      const payload: Record<string, any> = {
        gender,
      };
      if (cleanPhone) payload.phone = cleanPhone;
      if (dob) payload.dateOfBirth = dob;

      // Try PATCH first
      let res = await fetch(`${API_BASE}/passengers/profile`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      // If profile does not exist yet (404), call POST /api/passengers/profile
      if (res.status === 404) {
        res = await fetch(`${API_BASE}/passengers/profile`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        });
      }

      const json = await res.json().catch(() => ({}));

      if (res.ok && json.success) {
        showToast(json.message || "Profile updated successfully.", "success");
        if (json.data) {
          setProfile(json.data);
          if (json.data.phone) {
            localStorage.setItem("userPhone", json.data.phone.replace(/^\+91/, ""));
          }
        }
        setIsEditing(false);
      } else {
        const errorMsg =
          json.errors?.[0]?.message || json.message || "Failed to update profile.";
        showToast(errorMsg, "error");
      }
    } catch {
      showToast("Failed to connect to backend server.", "error");
    } finally {
      setIsSaving(false);
    }
  };

  const initial = profile?.name ? profile.name.trim().charAt(0).toUpperCase() : "U";

  return (
    <div className="flex-1 w-full max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Toast Notification Container (Bottom-Right in Rich Colors) */}
      <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2.5 max-w-sm pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-start gap-3 p-4 rounded-xl border shadow-xl backdrop-blur-md transition-all duration-300 animate-in slide-in-from-bottom-3 ${
              toast.type === "success"
                ? "bg-gradient-to-r from-emerald-950/95 to-emerald-900/95 border-emerald-500/30 text-white"
                : toast.type === "error"
                ? "bg-gradient-to-r from-red-950/95 to-rose-900/95 border-red-500/30 text-white"
                : "bg-gradient-to-r from-zinc-950/95 to-zinc-900/95 border-zinc-700/50 text-white"
            }`}
          >
            {toast.type === "success" && (
              <Check className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            )}
            {toast.type === "error" && (
              <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            )}
            <div className="flex-1 text-xs sm:text-sm font-medium leading-snug">
              {toast.message}
            </div>
            <button
              type="button"
              onClick={() => removeToast(toast.id)}
              className="text-white/60 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#EDEDE8]">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#8A8A8A]">
            Account &amp; Security
          </span>
          <h1 className="font-caslon text-3xl sm:text-4xl font-bold text-[#111111] tracking-tight mt-1">
            Passenger Profile
          </h1>
          <p className="text-sm text-stone-500 mt-1">
            Manage your personal contact info and ride preferences.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsEditing(!isEditing)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-stone-300 text-stone-800 text-sm font-semibold hover:bg-stone-50 transition-colors self-start sm:self-auto cursor-pointer"
        >
          {isEditing ? (
            <>
              <X className="w-4 h-4" />
              <span>Cancel</span>
            </>
          ) : (
            <>
              <Edit2 className="w-4 h-4" />
              <span>Edit Profile</span>
            </>
          )}
        </button>
      </div>

      {isLoading ? (
        <div className="p-12 text-center text-stone-500 flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-stone-300 border-t-black animate-spin" />
          <p className="text-sm font-medium">Loading profile from server...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Avatar & Summary */}
          <div className="p-6 rounded-2xl bg-white border border-[#EDEDE8] shadow-xs flex flex-col items-center text-center">
            <div className="w-24 h-24 rounded-full bg-[#E5E9CA] text-[#214D2A] font-caslon text-3xl font-bold flex items-center justify-center border-4 border-white shadow-md mb-4 uppercase">
              {initial}
            </div>
            <h2 className="font-caslon text-2xl font-bold text-[#111111]">
              {profile?.name || "Passenger"}
            </h2>
            <p className="text-xs text-stone-500 mt-0.5">{profile?.email}</p>

            <div className="mt-4 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 text-xs font-semibold border border-emerald-200">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>Verified Passenger</span>
            </div>

            <div className="w-full mt-6 pt-6 border-t border-stone-100 space-y-3 text-left text-xs">
              <div className="flex items-center justify-between text-stone-600">
                <span>Account Role</span>
                <span className="font-semibold text-stone-900">PASSENGER</span>
              </div>
              <div className="flex items-center justify-between text-stone-600">
                <span>Saved Places</span>
                <span className="font-semibold text-stone-900">
                  {profile?.savedPlaces?.length || 0} Places
                </span>
              </div>
            </div>
          </div>

          {/* Right Column: Profile Details or Edit Form */}
          <div className="lg:col-span-2 p-6 rounded-2xl bg-white border border-[#EDEDE8] shadow-xs">
            {isEditing ? (
              <form onSubmit={handleSaveProfile} className="space-y-5">
                <h3 className="font-caslon text-xl font-bold text-[#111111] pb-2 border-b border-stone-100">
                  Edit Personal Details
                </h3>

                {/* Name (Read-only on profile update) */}
                <div>
                  <label className="block text-[11px] font-semibold text-stone-600 uppercase tracking-wider mb-1.5">
                    Full Name
                  </label>
                  <input
                    type="text"
                    disabled
                    value={profile?.name || ""}
                    className="block w-full rounded-xl border border-stone-200 bg-stone-100 px-3.5 py-2.5 text-sm text-stone-500 cursor-not-allowed"
                  />
                  <p className="text-[11px] text-stone-400 mt-1">Name is linked to your account.</p>
                </div>

                {/* Email (Read-only) */}
                <div>
                  <label className="block text-[11px] font-semibold text-stone-600 uppercase tracking-wider mb-1.5">
                    Email Address
                  </label>
                  <input
                    type="email"
                    disabled
                    value={profile?.email || ""}
                    className="block w-full rounded-xl border border-stone-200 bg-stone-100 px-3.5 py-2.5 text-sm text-stone-500 cursor-not-allowed"
                  />
                </div>

                {/* Phone */}
                <div>
                  <label
                    htmlFor="edit-phone"
                    className="block text-[11px] font-semibold text-stone-700 uppercase tracking-wider mb-1.5"
                  >
                    Phone Number
                  </label>
                  <div className="relative rounded-xl">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-xs font-semibold text-stone-500">
                      +91
                    </span>
                    <input
                      id="edit-phone"
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                      placeholder="9876543210"
                      className="block w-full rounded-xl border border-stone-200 bg-[#FAFAFA] pl-12 pr-3.5 py-2.5 text-sm text-black focus:border-black focus:bg-white focus:outline-none"
                    />
                  </div>
                </div>

                {/* Date of Birth */}
                <div>
                  <label
                    htmlFor="edit-dob"
                    className="block text-[11px] font-semibold text-stone-700 uppercase tracking-wider mb-1.5"
                  >
                    Date of Birth
                  </label>
                  <input
                    id="edit-dob"
                    type="date"
                    value={dob}
                    onChange={(e) => setDob(e.target.value)}
                    className="block w-full rounded-xl border border-stone-200 bg-[#FAFAFA] px-3.5 py-2.5 text-sm text-black focus:border-black focus:bg-white focus:outline-none"
                  />
                </div>

                {/* Gender */}
                <div>
                  <label className="block text-[11px] font-semibold text-stone-700 uppercase tracking-wider mb-1.5">
                    Gender
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {(["MALE", "FEMALE", "OTHER"] as const).map((g) => (
                      <button
                        key={g}
                        type="button"
                        onClick={() => setGender(g)}
                        className={`py-2 px-3 rounded-xl text-xs font-semibold border transition-all cursor-pointer capitalize ${
                          gender === g
                            ? "bg-black text-white border-black"
                            : "bg-white text-stone-700 border-stone-200 hover:bg-stone-50"
                        }`}
                      >
                        {g.toLowerCase()}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-stone-100">
                  <button
                    type="button"
                    onClick={() => setIsEditing(false)}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-stone-600 hover:bg-stone-100 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-black text-white text-xs sm:text-sm font-semibold hover:bg-neutral-800 transition-colors shadow-sm cursor-pointer disabled:opacity-50"
                  >
                    <Save className="w-4 h-4" />
                    <span>{isSaving ? "Saving..." : "Save Changes"}</span>
                  </button>
                </div>
              </form>
            ) : (
              <div className="space-y-6">
                <h3 className="font-caslon text-xl font-bold text-[#111111] pb-2 border-b border-stone-100">
                  Contact &amp; Details
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl bg-[#FAFAFA] border border-stone-200/70">
                    <div className="flex items-center gap-2 text-stone-400 mb-1">
                      <Phone className="w-3.5 h-3.5" />
                      <span className="text-[11px] font-semibold uppercase tracking-wider">Phone</span>
                    </div>
                    <p className="text-sm font-semibold text-stone-900">
                      {profile?.phone || "Not provided"}
                    </p>
                  </div>

                  <div className="p-4 rounded-xl bg-[#FAFAFA] border border-stone-200/70">
                    <div className="flex items-center gap-2 text-stone-400 mb-1">
                      <Mail className="w-3.5 h-3.5" />
                      <span className="text-[11px] font-semibold uppercase tracking-wider">Email</span>
                    </div>
                    <p className="text-sm font-semibold text-stone-900 truncate">
                      {profile?.email}
                    </p>
                  </div>

                  <div className="p-4 rounded-xl bg-[#FAFAFA] border border-stone-200/70">
                    <div className="flex items-center gap-2 text-stone-400 mb-1">
                      <Calendar className="w-3.5 h-3.5" />
                      <span className="text-[11px] font-semibold uppercase tracking-wider">Date of Birth</span>
                    </div>
                    <p className="text-sm font-semibold text-stone-900">
                      {profile?.dateOfBirth ? profile.dateOfBirth.slice(0, 10) : "Not set"}
                    </p>
                  </div>

                  <div className="p-4 rounded-xl bg-[#FAFAFA] border border-stone-200/70">
                    <div className="flex items-center gap-2 text-stone-400 mb-1">
                      <User className="w-3.5 h-3.5" />
                      <span className="text-[11px] font-semibold uppercase tracking-wider">Gender</span>
                    </div>
                    <p className="text-sm font-semibold text-stone-900 capitalize">
                      {profile?.gender ? profile.gender.toLowerCase() : "Not set"}
                    </p>
                  </div>
                </div>

                <div className="pt-4 border-t border-stone-100 flex items-center justify-between text-xs text-stone-500">
                  <span>Backend Profile Endpoint: <code>/api/passengers/profile</code></span>
                  <button
                    type="button"
                    onClick={() => setIsEditing(true)}
                    className="font-semibold text-black underline underline-offset-4 hover:text-stone-700 cursor-pointer"
                  >
                    Edit Information &rarr;
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

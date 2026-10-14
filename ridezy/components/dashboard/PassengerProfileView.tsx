"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
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
  Camera,
  Save,
  Plus,
  Trash2,
  Pencil,
  CheckCircle2,
  Info,
} from "lucide-react";

const API_BASE = "http://localhost:5000/api";

interface ToastItem {
  id: string;
  type: "success" | "error" | "info";
  message: string;
}

interface SavedPlaceItem {
  id?: string;
  _id?: string;
  type: "HOME" | "WORK" | "OTHER";
  label: string;
  address: string;
  latitude?: number;
  longitude?: number;
  isDefault?: boolean;
}

const DEFAULT_SAVED_PLACES: SavedPlaceItem[] = [
  {
    id: "sp-1",
    type: "HOME",
    label: "Home",
    address: "Boring Road, Patna",
    latitude: 25.612,
    longitude: 85.115,
    isDefault: true,
  },
  {
    id: "sp-2",
    type: "WORK",
    label: "Work",
    address: "Fraser Road, Patna",
    latitude: 25.608,
    longitude: 85.138,
  },
  {
    id: "sp-3",
    type: "OTHER",
    label: "College",
    address: "Amity University, Patna",
    latitude: 25.594,
    longitude: 85.122,
  },
  {
    id: "sp-4",
    type: "OTHER",
    label: "Gym",
    address: "Kankarbagh, Patna",
    latitude: 25.589,
    longitude: 85.155,
  },
  {
    id: "sp-5",
    type: "OTHER",
    label: "Cafe",
    address: "Rajendra Nagar, Patna",
    latitude: 25.602,
    longitude: 85.161,
  },
];

/* Beautiful Rich Emoji Place Icons with Clean Black & White Badges */
function PlaceIconHome() {
  return (
    <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-neutral-100 border border-neutral-200 flex items-center justify-center shrink-0 shadow-2xs select-none">
      <span role="img" aria-label="Home" className="text-xl sm:text-2xl leading-none transition-transform hover:scale-110">
        🏡
      </span>
    </div>
  );
}

function PlaceIconWork() {
  return (
    <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-neutral-100 border border-neutral-200 flex items-center justify-center shrink-0 shadow-2xs select-none">
      <span role="img" aria-label="Work" className="text-xl sm:text-2xl leading-none transition-transform hover:scale-110">
        🏢
      </span>
    </div>
  );
}

function PlaceIconCollege() {
  return (
    <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-neutral-100 border border-neutral-200 flex items-center justify-center shrink-0 shadow-2xs select-none">
      <span role="img" aria-label="College" className="text-xl sm:text-2xl leading-none transition-transform hover:scale-110">
        🎓
      </span>
    </div>
  );
}

function PlaceIconGym() {
  return (
    <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-neutral-100 border border-neutral-200 flex items-center justify-center shrink-0 shadow-2xs select-none">
      <span role="img" aria-label="Gym" className="text-xl sm:text-2xl leading-none transition-transform hover:scale-110">
        🏋️
      </span>
    </div>
  );
}

function PlaceIconCafe() {
  return (
    <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-neutral-100 border border-neutral-200 flex items-center justify-center shrink-0 shadow-2xs select-none">
      <span role="img" aria-label="Cafe" className="text-xl sm:text-2xl leading-none transition-transform hover:scale-110">
        ☕
      </span>
    </div>
  );
}

function PlaceIconOther() {
  return (
    <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-neutral-100 border border-neutral-200 flex items-center justify-center shrink-0 shadow-2xs select-none">
      <span role="img" aria-label="Location" className="text-xl sm:text-2xl leading-none transition-transform hover:scale-110">
        📍
      </span>
    </div>
  );
}

function getPlaceIcon(label: string, type: string) {
  // If label starts with a custom emoji, honor that emoji directly
  const emojiMatch = (label || "").trim().match(/^(\p{Extended_Pictographic})/u);
  if (emojiMatch) {
    return (
      <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-neutral-100 border border-neutral-200 flex items-center justify-center shrink-0 shadow-2xs select-none">
        <span role="img" className="text-xl sm:text-2xl leading-none">{emojiMatch[0]}</span>
      </div>
    );
  }

  const norm = (label || type || "").toLowerCase();
  if (norm.includes("home") || type === "HOME") return <PlaceIconHome />;
  if (norm.includes("work") || norm.includes("office") || type === "WORK") return <PlaceIconWork />;
  if (norm.includes("college") || norm.includes("school") || norm.includes("univ") || norm.includes("campus") || norm.includes("class")) return <PlaceIconCollege />;
  if (norm.includes("gym") || norm.includes("fitness") || norm.includes("workout")) return <PlaceIconGym />;
  if (norm.includes("cafe") || norm.includes("coffee") || norm.includes("tea") || norm.includes("bakery")) return <PlaceIconCafe />;
  if (norm.includes("hospital") || norm.includes("clinic") || norm.includes("doctor") || norm.includes("health")) {
    return (
      <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-neutral-100 border border-neutral-200 flex items-center justify-center shrink-0 shadow-2xs select-none">
        <span role="img" aria-label="Hospital" className="text-xl sm:text-2xl leading-none">🏥</span>
      </div>
    );
  }
  if (norm.includes("airport") || norm.includes("flight")) {
    return (
      <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-neutral-100 border border-neutral-200 flex items-center justify-center shrink-0 shadow-2xs select-none">
        <span role="img" aria-label="Airport" className="text-xl sm:text-2xl leading-none">✈️</span>
      </div>
    );
  }
  if (norm.includes("metro") || norm.includes("station") || norm.includes("train")) {
    return (
      <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-neutral-100 border border-neutral-200 flex items-center justify-center shrink-0 shadow-2xs select-none">
        <span role="img" aria-label="Station" className="text-xl sm:text-2xl leading-none">🚆</span>
      </div>
    );
  }
  if (norm.includes("mall") || norm.includes("shop") || norm.includes("market") || norm.includes("store")) {
    return (
      <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-neutral-100 border border-neutral-200 flex items-center justify-center shrink-0 shadow-2xs select-none">
        <span role="img" aria-label="Shopping" className="text-xl sm:text-2xl leading-none">🛍️</span>
      </div>
    );
  }
  if (norm.includes("library") || norm.includes("book")) {
    return (
      <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-neutral-100 border border-neutral-200 flex items-center justify-center shrink-0 shadow-2xs select-none">
        <span role="img" aria-label="Library" className="text-xl sm:text-2xl leading-none">📚</span>
      </div>
    );
  }
  return <PlaceIconOther />;
}

interface PassengerProfileData {
  name: string;
  email: string;
  phone?: string | null;
  dateOfBirth?: string | null;
  gender?: "MALE" | "FEMALE" | "OTHER" | null;
  profileImage?: string | null;
  savedPlaces?: any[];
  createdAt?: string;
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
  const [city, setCity] = useState("Patna, Bihar");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  // Saved Places State & Modal
  const [savedPlaces, setSavedPlaces] = useState<SavedPlaceItem[]>([]);
  const [isPlaceModalOpen, setIsPlaceModalOpen] = useState(false);
  const [editingPlace, setEditingPlace] = useState<SavedPlaceItem | null>(null);
  const [placeLabel, setPlaceLabel] = useState("");
  const [placeAddress, setPlaceAddress] = useState("");
  const [placeType, setPlaceType] = useState<"HOME" | "WORK" | "OTHER">("OTHER");
  const [placeLatitude, setPlaceLatitude] = useState<number | string>(25.6093);
  const [placeLongitude, setPlaceLongitude] = useState<number | string>(85.1376);
  const [placeIsSaving, setPlaceIsSaving] = useState(false);
  const [deletingPlaceId, setDeletingPlaceId] = useState<string | null>(null);

  // Delete Profile Modal State
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
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

  const isMockPlace = (p: any) => {
    const addr = (p.address || "").toLowerCase();
    const id = String(p.id || p._id || "");
    return (
      addr.includes("boring road") ||
      addr.includes("fraser road") ||
      addr.includes("amity university") ||
      addr.includes("kankarbagh") ||
      addr.includes("rajendra nagar") ||
      addr.includes("electronic city") ||
      (addr.includes("mg road") && addr.includes("bangalore")) ||
      id.startsWith("sp-")
    );
  };

  const persistSavedPlaces = (places: SavedPlaceItem[]) => {
    if (typeof window !== "undefined") {
      try {
        const real = places.filter((p) => !isMockPlace(p));
        if (real.length > 0) {
          localStorage.setItem("ridezySavedPlaces", JSON.stringify(real));
        } else {
          localStorage.removeItem("ridezySavedPlaces");
        }
        window.dispatchEvent(new Event("storage"));
        window.dispatchEvent(new CustomEvent("ridezy_saved_places_updated"));
      } catch {}
    }
  };

  // 1. GET /api/passengers/profile
  const fetchProfile = async () => {
    setIsLoading(true);
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
      const storedCity = typeof window !== "undefined" ? localStorage.getItem("userCity") : null;
      if (storedCity) setCity(storedCity);

      if (!token) return;

      const res = await fetch(`${API_BASE}/passengers/profile`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (res.status === 401) {
        // User data has been deleted -> clear and redirect to landing page
        if (typeof window !== "undefined") {
          localStorage.clear();
          window.location.href = "/";
        }
        return;
      }

      const json = await res.json().catch(() => ({}));

      if (res.ok && json.success && json.data) {
        setProfile(json.data);
        if (json.data.savedPlaces && Array.isArray(json.data.savedPlaces)) {
          const realPlaces = json.data.savedPlaces
            .filter((p: any) => !isMockPlace(p))
            .map((p: any, idx: number) => ({
              ...p,
              id: p.id || p._id || `sp-${idx}`,
              isDefault: p.type === "HOME" || idx === 0,
            }));
          setSavedPlaces(realPlaces);
          persistSavedPlaces(realPlaces);
        } else {
          const localStored = localStorage.getItem("ridezySavedPlaces");
          if (localStored) {
            try {
              const parsed = JSON.parse(localStored);
              const realPlaces = Array.isArray(parsed) ? parsed.filter((p: any) => !isMockPlace(p)) : [];
              setSavedPlaces(realPlaces);
              persistSavedPlaces(realPlaces);
            } catch {
              setSavedPlaces([]);
            }
          } else {
            setSavedPlaces([]);
          }
        }
        if (json.data.phone) {
          setPhone(json.data.phone.replace(/^\+91/, ""));
        }
        if (json.data.gender) {
          setGender(json.data.gender);
        }
        if (json.data.dateOfBirth) {
          setDob(json.data.dateOfBirth.slice(0, 10));
        }
        if (json.data.profileImage) {
          setAvatarUrl(json.data.profileImage);
        }
      } else if (res.status === 404) {
        // Fallback to localStorage data
        const localName = localStorage.getItem("userName") || "Jiya";
        const localEmail = localStorage.getItem("userEmail") || "samsingh8102@gmail.com";
        const localPhone = localStorage.getItem("userPhone") || "7895674566";
        setProfile({
          name: localName,
          email: localEmail,
          phone: localPhone,
          dateOfBirth: "2003-06-06",
          gender: "FEMALE",
        });
        setPhone(localPhone.replace(/^\+91/, ""));
        setDob("2003-06-06");
        const localStored = localStorage.getItem("ridezySavedPlaces");
        if (localStored) {
          try {
            const parsed = JSON.parse(localStored);
            const realPlaces = Array.isArray(parsed) ? parsed.filter((p: any) => !isMockPlace(p)) : [];
            setSavedPlaces(realPlaces);
            persistSavedPlaces(realPlaces);
          } catch {
            setSavedPlaces([]);
          }
        } else {
          setSavedPlaces([]);
        }
      }
    } catch {
      showToast("Cannot connect to server. Please try again later.", "error");
    } finally {
      setIsLoading(false);
    }
  };

  // Saved Places CRUD Handlers (Swagger: POST, PATCH, DELETE /api/passengers/saved-places)
  const handleOpenAddPlace = () => {
    setEditingPlace(null);
    setPlaceLabel("");
    setPlaceAddress("");
    // Pick first unused standard type if available
    const hasHome = savedPlaces.some((p) => p.type === "HOME");
    const hasWork = savedPlaces.some((p) => p.type === "WORK");
    const defaultType = !hasHome ? "HOME" : !hasWork ? "WORK" : "OTHER";
    setPlaceType(defaultType);
    setPlaceLatitude(25.6093);
    setPlaceLongitude(85.1376);
    setIsPlaceModalOpen(true);
  };

  const handleOpenEditPlace = (place: SavedPlaceItem) => {
    setEditingPlace(place);
    setPlaceLabel(place.label);
    setPlaceAddress(place.address);
    setPlaceType(place.type);
    setPlaceLatitude(typeof place.latitude === "number" ? place.latitude : 25.6093);
    setPlaceLongitude(typeof place.longitude === "number" ? place.longitude : 85.1376);
    setIsPlaceModalOpen(true);
  };

  const handleDeletePlace = async (placeId: string) => {
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    const isMongoId = /^[0-9a-fA-F]{24}$/.test(placeId);
    setDeletingPlaceId(placeId);

    try {
      if (token && isMongoId) {
        const res = await fetch(`${API_BASE}/passengers/saved-places/${placeId}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        });
        const json = await res.json().catch(() => ({}));
        if (res.ok && json.success) {
          if (json.data?.savedPlaces) {
            const mapped = json.data.savedPlaces.map((p: any, idx: number) => ({
              ...p,
              id: p.id || p._id || `sp-${idx}`,
              isDefault: p.type === "HOME" || idx === 0,
            }));
            setSavedPlaces(mapped);
            setProfile(json.data);
            persistSavedPlaces(mapped);
          } else {
            const updated = savedPlaces.filter((p) => (p.id || p._id) !== placeId);
            setSavedPlaces(updated);
            persistSavedPlaces(updated);
          }
          showToast(json.message || "Saved place deleted successfully.", "success");
          return;
        } else {
          showToast(json.message || "Failed to delete saved place.", "error");
          return;
        }
      }

      // Local mock removal if not persisted on server
      const updated = savedPlaces.filter((p) => (p.id || p._id) !== placeId);
      setSavedPlaces(updated);
      persistSavedPlaces(updated);
      showToast("Place removed from saved locations", "info");
    } catch {
      showToast("Network error while deleting place.", "error");
    } finally {
      setDeletingPlaceId(null);
    }
  };

  const handleSavePlaceModal = async (e: React.FormEvent) => {
    e.preventDefault();

    const cleanAddress = placeAddress.trim();
    if (!cleanAddress) {
      showToast("Please enter an address for this place.", "error");
      return;
    }
    if (cleanAddress.length < 5) {
      showToast("Address must be at least 5 characters long.", "error");
      return;
    }
    if (cleanAddress.length > 300) {
      showToast("Address cannot exceed 300 characters.", "error");
      return;
    }

    const cleanLabel =
      placeLabel.trim() ||
      (placeType === "HOME" ? "Home" : placeType === "WORK" ? "Work" : "Other");

    if (cleanLabel.length > 50) {
      showToast("Place label cannot exceed 50 characters.", "error");
      return;
    }

    const lat = Number(placeLatitude);
    const lng = Number(placeLongitude);
    if (isNaN(lat) || lat < -90 || lat > 90) {
      showToast("Latitude must be a valid number between -90 and 90.", "error");
      return;
    }
    if (isNaN(lng) || lng < -180 || lng > 180) {
      showToast("Longitude must be a valid number between -180 and 180.", "error");
      return;
    }

    // Constraint: Max 20 places
    if (!editingPlace && savedPlaces.length >= 20) {
      showToast("You can save at most 20 places.", "error");
      return;
    }

    // Constraint: At most one HOME and one WORK
    const currentId = editingPlace ? editingPlace.id || editingPlace._id : null;
    if (placeType !== "OTHER") {
      const duplicate = savedPlaces.find(
        (p) => p.type === placeType && (p.id || p._id) !== currentId
      );
      if (duplicate) {
        showToast(
          `You already have a ${placeType} place (${duplicate.label}). Only one ${placeType} place is allowed.`,
          "error"
        );
        return;
      }
    }

    setPlaceIsSaving(true);
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;

    const payload = {
      type: placeType,
      label: cleanLabel,
      address: cleanAddress,
      latitude: lat,
      longitude: lng,
    };

    try {
      if (editingPlace) {
        const placeId = editingPlace.id || editingPlace._id;
        const isMongoId = placeId ? /^[0-9a-fA-F]{24}$/.test(placeId) : false;

        if (token && isMongoId) {
          // 2. PATCH /api/passengers/saved-places/{placeId}
          const res = await fetch(`${API_BASE}/passengers/saved-places/${placeId}`, {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(payload),
          });
          const json = await res.json().catch(() => ({}));
          if (res.ok && json.success) {
            if (json.data?.savedPlaces) {
              const mapped = json.data.savedPlaces.map((p: any, idx: number) => ({
                ...p,
                id: p.id || p._id || `sp-${idx}`,
                isDefault: p.type === "HOME" || idx === 0,
              }));
              setSavedPlaces(mapped);
              setProfile(json.data);
              persistSavedPlaces(mapped);
            }
            showToast(json.message || "Saved place updated successfully.", "success");
            setIsPlaceModalOpen(false);
            return;
          } else {
            const err =
              json.errors?.[0]?.message ||
              json.message ||
              "Failed to update saved place.";
            showToast(err, "error");
            return;
          }
        } else if (token && !isMongoId) {
          // Seed mock place directly onto the backend
          let res = await fetch(`${API_BASE}/passengers/saved-places`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(payload),
          });

          if (res.status === 404) {
            // Auto initialize profile if not created yet
            await fetch(`${API_BASE}/passengers/profile`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({
                phone: profile?.phone || "+917895674566",
                gender: profile?.gender || "FEMALE",
              }),
            });
            res = await fetch(`${API_BASE}/passengers/saved-places`, {
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
            if (json.data?.savedPlaces) {
              const mapped = json.data.savedPlaces.map((p: any, idx: number) => ({
                ...p,
                id: p.id || p._id || `sp-${idx}`,
                isDefault: p.type === "HOME" || idx === 0,
              }));
              setSavedPlaces(mapped);
              setProfile(json.data);
              persistSavedPlaces(mapped);
            }
            showToast(json.message || "Place saved successfully.", "success");
            setIsPlaceModalOpen(false);
            return;
          }
        }

        // Local state fallback update
        const updated = savedPlaces.map((p) =>
          (p.id || p._id) === placeId
            ? { ...p, ...payload, isDefault: p.isDefault || payload.type === "HOME" }
            : p
        );
        setSavedPlaces(updated);
        persistSavedPlaces(updated);
        showToast("Place updated locally.", "success");
        setIsPlaceModalOpen(false);
      } else {
        // 1. POST /api/passengers/saved-places
        if (token) {
          let res = await fetch(`${API_BASE}/passengers/saved-places`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(payload),
          });

          // Auto create profile if not found
          if (res.status === 404) {
            await fetch(`${API_BASE}/passengers/profile`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({
                phone: profile?.phone || "+917895674566",
                gender: profile?.gender || "FEMALE",
              }),
            });
            res = await fetch(`${API_BASE}/passengers/saved-places`, {
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
            if (json.data?.savedPlaces) {
              const mapped = json.data.savedPlaces.map((p: any, idx: number) => ({
                ...p,
                id: p.id || p._id || `sp-${idx}`,
                isDefault: p.type === "HOME" || idx === 0,
              }));
              setSavedPlaces(mapped);
              setProfile(json.data);
              persistSavedPlaces(mapped);
            }
            showToast(json.message || "Saved place added successfully.", "success");
            setIsPlaceModalOpen(false);
            return;
          } else {
            const err =
              json.errors?.[0]?.message ||
              json.message ||
              "Failed to add saved place.";
            showToast(err, "error");
            return;
          }
        }

        // Local creation fallback
        const createdItem: SavedPlaceItem = {
          id: `sp-${Date.now()}`,
          ...payload,
          isDefault: savedPlaces.length === 0 || payload.type === "HOME",
        };
        const updated = [...savedPlaces, createdItem];
        setSavedPlaces(updated);
        persistSavedPlaces(updated);
        showToast("New place added locally.", "success");
        setIsPlaceModalOpen(false);
      }
    } catch {
      showToast("Cannot connect to server. Please try again.", "error");
    } finally {
      setPlaceIsSaving(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  // 2. PATCH /api/passengers/profile
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

      // Save city in localStorage
      if (typeof window !== "undefined") {
        localStorage.setItem("userCity", city);
      }

      let res = await fetch(`${API_BASE}/passengers/profile`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

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

  // 3. DELETE /api/passengers/profile (Delete User Profile -> Redirect to Landing Page)
  const handleDeleteAccount = async () => {
    setIsDeletingAccount(true);
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
      if (token) {
        await fetch(`${API_BASE}/passengers/profile`, {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
      }
    } catch {}
    if (typeof window !== "undefined") {
      localStorage.clear();
      window.location.href = "/";
    }
  };

  // Image Upload Handler
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === "string") {
          setAvatarUrl(reader.result);
          showToast("Profile image updated.", "success");
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // Format Date of Birth: "06 Jun 2003"
  const formattedDob = (() => {
    if (dob) {
      try {
        const d = new Date(dob);
        if (!isNaN(d.getTime())) {
          return d.toLocaleDateString("en-GB", {
            day: "2-digit",
            month: "short",
            year: "numeric",
          });
        }
      } catch {}
    }
    return "06 Jun 2003";
  })();

  const displayPhone = phone
    ? `+91 ${phone.replace(/^\+91/, "").trim()}`
    : profile?.phone
    ? profile.phone.startsWith("+91")
      ? profile.phone
      : `+91 ${profile.phone}`
    : "+91 7895674566";

  const formattedGender =
    gender === "MALE"
      ? "Male"
      : gender === "FEMALE"
      ? "Female"
      : "Other";

  // Determine avatar dynamically according to gender
  const effectiveGender = isEditing ? gender : (profile?.gender || gender);
  const genderAvatar =
    effectiveGender === "MALE"
      ? "/passenger-male-avatar.jpg"
      : "/passenger-avatar.jpg";
  const displayAvatar =
    avatarUrl && avatarUrl.startsWith("data:")
      ? avatarUrl
      : profile?.profileImage || avatarUrl || genderAvatar;

  // Full Date of Joining (e.g., "07 October 2026")
  const fullDateOfJoining = (() => {
    let dateVal: string | null | undefined = profile?.createdAt;
    if (!dateVal && typeof window !== "undefined") {
      const storedUser = localStorage.getItem("user");
      if (storedUser) {
        try {
          const parsed = JSON.parse(storedUser);
          if (parsed.createdAt) dateVal = parsed.createdAt;
        } catch {}
      }
      if (!dateVal) {
        dateVal = localStorage.getItem("userCreatedAt");
      }
    }

    if (dateVal) {
      try {
        const d = new Date(dateVal);
        if (!isNaN(d.getTime())) {
          return d.toLocaleDateString("en-GB", {
            day: "2-digit",
            month: "long",
            year: "numeric",
          });
        }
      } catch {}
    }
    const now = new Date();
    return now.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  })();

  return (
    <div className="flex-1 w-full h-full min-h-0 overflow-y-auto bg-white flex flex-col">
      {/* Toast Notification Container (Bottom-Right, Compact Black with White Text) */}
      <div
        aria-live="polite"
        className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 max-w-sm sm:max-w-md w-full px-4 pointer-events-none"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className="pointer-events-auto flex items-center gap-3 px-3.5 py-2.5 sm:px-4 sm:py-2.5 rounded-xl bg-black/95 text-white border border-neutral-800 shadow-xl shadow-black/40 backdrop-blur-md transition-all duration-200 animate-in slide-in-from-bottom-3 fade-in"
          >
            {/* Symbol / Icon */}
            <div className="shrink-0 flex items-center justify-center">
              {toast.type === "success" && (
                <div className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                  <Check className="w-3 h-3 stroke-[2.5]" />
                </div>
              )}
              {toast.type === "error" && (
                <div className="w-5 h-5 rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center">
                  <AlertCircle className="w-3 h-3 stroke-[2.5]" />
                </div>
              )}
              {toast.type === "info" && (
                <div className="w-5 h-5 rounded-full bg-sky-500/20 text-sky-400 flex items-center justify-center">
                  <Info className="w-3 h-3 stroke-[2.5]" />
                </div>
              )}
            </div>

            {/* Toast Message */}
            <div className="flex-1 text-xs sm:text-[13px] font-medium leading-snug break-words text-white">
              {toast.message}
            </div>

            {/* Dismiss Button */}
            <button
              type="button"
              onClick={() => removeToast(toast.id)}
              aria-label="Dismiss notification"
              className="shrink-0 p-1 rounded-md text-white/50 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>

      <div className="w-full flex-1 flex flex-col px-4 sm:px-6 lg:px-8 pt-2 sm:pt-3 pb-8 gap-3 sm:gap-4">
        {/* ========================================================================= */}
        {/* 1. TOP HERO BANNER (Account & Security / Passenger Profile / Banner Image) */}
        {/* ========================================================================= */}
        <div className="relative overflow-hidden  rounded-2xl sm:rounded-3xl bg-white border border-[#EDEDE8] shadow-xs h-[170px] sm:h-[190px] lg:h-[205px] flex items-center w-full shrink-0">
          {/* Exact Banner Background */}
          <div className="absolute inset-0 w-full h-full pointer-events-none select-none">
            <Image
              src="/customer-banner2.webp"
              alt="Passenger Profile Banner"
              fill
              priority
              className="object-cover object-right sm:object-center"
            />
          </div>

          {/* Banner Content (Left Side Text + Edit Button) */}
          <div className="relative z-10 w-full px-6 py-4 sm:px-8 sm:py-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="max-w-xl">
              <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#7A7A74]">
                Account &amp; Security
              </span>
              <h1 className="font-caslon text-3xl sm:text-4xl lg:text-[40px] font-bold text-[#111111] tracking-tight leading-tight mt-1">
                Passenger Profile
              </h1>
              <p className="text-xs sm:text-sm text-stone-600 mt-1 font-normal leading-relaxed">
                Manage your personal information and ride preferences.
              </p>
            </div>

            <div className="shrink-0 self-start sm:self-center">
              <button
                type="button"
                onClick={() => setIsEditing(!isEditing)}
                className="inline-flex items-center gap-2 px-4 py-2 sm:px-5 sm:py-2.5 rounded-xl bg-white border border-[#E0DED7] text-[#111111] text-xs sm:text-sm font-semibold shadow-xs hover:bg-[#F5F3EC] active:scale-[0.98] transition-all cursor-pointer"
              >
                {isEditing ? (
                  <>
                    <X className="w-4 h-4 text-stone-600" />
                    <span>Cancel Edit</span>
                  </>
                ) : (
                  <>
                    <Edit2 className="w-4 h-4 text-stone-600" />
                    <span>Edit Profile</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Loading Spinner */}
        {isLoading ? (
          <div className="p-16 text-center text-stone-500 flex flex-col items-center gap-3 flex-1 justify-center">
            <div className="w-8 h-8 rounded-full border-2 border-stone-300 border-t-black animate-spin" />
            <p className="text-sm font-medium">Loading profile from server...</p>
          </div>
        ) : (
          <>
            {/* ========================================================================= */}
            {/* 2. MAIN 2-COLUMN SECTION: Left Profile Summary + Right Contact & Details   */}
            {/* ========================================================================= */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 sm:gap-4 w-full items-stretch">
            {/* --------------------------------------------------------------------- */}
            {/* LEFT COLUMN (4 cols): Avatar, Name, Email, Verified Badge, Metadata   */}
            {/* --------------------------------------------------------------------- */}
            <div className="lg:col-span-4 xl:col-span-4 rounded-2xl sm:rounded-3xl bg-white border border-[#EDEDE8] p-4 sm:p-5 shadow-xs flex flex-col justify-between items-center text-center">
              {/* Circular Avatar with Camera Button */}
              <div className="flex flex-col items-center">
                <div className="relative w-22 h-22 sm:w-26 sm:h-26 mb-2">
                  <div className="relative w-22 h-22 sm:w-26 sm:h-26 rounded-full overflow-hidden border-3 border-white shadow-md ring-1 ring-black/5 bg-[#E5E9CA]">
                    <Image
                      src={displayAvatar}
                      alt={profile?.name || "Passenger"}
                      fill
                      className="object-cover"
                    />
                  </div>
                  <label
                    htmlFor="passenger-avatar-upload"
                    title="Change profile picture"
                    className="absolute bottom-0 right-0 w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-white border border-[#E0DED7] shadow-xs flex items-center justify-center text-stone-700 hover:text-black hover:bg-stone-50 cursor-pointer transition-colors"
                  >
                    <Camera className="w-3.5 h-3.5" />
                    <input
                      id="passenger-avatar-upload"
                      type="file"
                      accept="image/*"
                      className="sr-only"
                      onChange={handleImageUpload}
                    />
                  </label>
                </div>

                {/* Passenger Name & Email */}
                <h2 className="font-caslon text-xl sm:text-2xl font-bold text-[#111111] leading-tight">
                  {profile?.name || "Jiya"}
                </h2>
                <p className="text-xs text-[#7A7A72] mt-0.5 truncate max-w-full">
                  {profile?.email || "samsingh8102@gmail.com"}
                </p>

                {/* Verified Passenger Pill Badge */}
                <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-semibold border border-emerald-200 shadow-2xs">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Verified Passenger</span>
                </div>
              </div>

              {/* Metadata rows */}
              <div className="w-full mt-4 pt-3 border-t border-[#F0EFEA] space-y-2.5 text-left">
                <div className="flex items-center justify-between text-xs sm:text-sm">
                  <div className="flex items-center gap-2 text-stone-500">
                    <User className="w-3.5 h-3.5 text-stone-400" />
                    <span>Account Type</span>
                  </div>
                  <span className="font-caslon font-bold text-[#111111] tracking-wider text-sm sm:text-base">
                    PASSENGER
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs sm:text-sm">
                  <div className="flex items-center gap-2 text-stone-500">
                    <Calendar className="w-3.5 h-3.5 text-stone-400" />
                    <span>Date of Joining</span>
                  </div>
                  <span className="font-caslon font-bold text-[#111111] text-sm sm:text-base">
                    {fullDateOfJoining}
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs sm:text-sm">
                  <div className="flex items-center gap-2 text-stone-500">
                    <MapPin className="w-3.5 h-3.5 text-stone-400" />
                    <span>Saved Places</span>
                  </div>
                  <span className="font-caslon font-bold text-[#111111] text-sm sm:text-base">
                    {savedPlaces.length} Places
                  </span>
                </div>
              </div>
            </div>

            {/* --------------------------------------------------------------------- */}
            {/* RIGHT COLUMN (8 cols): Contact & Details Grid or Edit Form            */}
            {/* --------------------------------------------------------------------- */}
            <div className="lg:col-span-8 xl:col-span-8 rounded-2xl sm:rounded-3xl bg-white border border-[#EDEDE8] p-4 sm:p-5 shadow-xs flex flex-col justify-between">
              {isEditing ? (
                /* Edit Profile Form */
                <form onSubmit={handleSaveProfile} className="flex-1 flex flex-col justify-between h-full space-y-4">
                  <div className="space-y-4">
                    <div className="pb-3 border-b border-[#F0EFEA]">
                      <h3 className="font-caslon text-xl sm:text-2xl font-bold text-[#111111]">
                        Edit Personal Details
                      </h3>
                      <p className="text-xs text-stone-500 mt-1">
                        Update your contact information and demographic details.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Phone Number */}
                    <div>
                      <label
                        htmlFor="edit-phone"
                        className="block text-[10px] font-bold uppercase tracking-wider text-stone-600 mb-1.5"
                      >
                        Phone Number
                      </label>
                      <div className="relative rounded-xl shadow-2xs">
                        <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-xs font-semibold text-stone-500">
                          +91
                        </span>
                        <input
                          id="edit-phone"
                          type="tel"
                          value={phone}
                          onChange={(e) =>
                            setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))
                          }
                          placeholder="7895674566"
                          className="block w-full rounded-xl border border-stone-200 bg-[#FAFAFA] pl-12 pr-3.5 py-2.5 text-sm text-black focus:border-black focus:bg-white focus:outline-none transition-colors"
                        />
                      </div>
                    </div>

                    {/* Email (Read-Only) */}
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-stone-600 mb-1.5">
                        Email Address
                      </label>
                      <input
                        type="email"
                        disabled
                        value={profile?.email || "samsingh8102@gmail.com"}
                        className="block w-full rounded-xl border border-stone-200 bg-stone-100 px-3.5 py-2.5 text-sm text-stone-500 cursor-not-allowed"
                      />
                    </div>

                    {/* Date of Birth */}
                    <div>
                      <label
                        htmlFor="edit-dob"
                        className="block text-[10px] font-bold uppercase tracking-wider text-stone-600 mb-1.5"
                      >
                        Date of Birth
                      </label>
                      <input
                        id="edit-dob"
                        type="date"
                        value={dob}
                        onChange={(e) => setDob(e.target.value)}
                        className="block w-full rounded-xl border border-stone-200 bg-[#FAFAFA] px-3.5 py-2.5 text-sm text-black focus:border-black focus:bg-white focus:outline-none transition-colors"
                      />
                    </div>

                    {/* Gender */}
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-stone-600 mb-1.5">
                        Gender
                      </label>
                      <div className="grid grid-cols-3 gap-2">
                        {(["FEMALE", "MALE", "OTHER"] as const).map((g) => (
                          <button
                            key={g}
                            type="button"
                            onClick={() => {
                              setGender(g);
                              if (!avatarUrl?.startsWith("data:")) {
                                setAvatarUrl(g === "MALE" ? "/passenger-male-avatar.jpg" : "/passenger-avatar.jpg");
                              }
                            }}
                            className={`py-2.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                              gender === g
                                ? "bg-black text-white border-black shadow-xs"
                                : "bg-[#FAFAFA] text-stone-700 border-stone-200 hover:bg-stone-100"
                            }`}
                          >
                            {g === "FEMALE" ? "Female" : g === "MALE" ? "Male" : "Other"}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* City */}
                    <div className="sm:col-span-2">
                      <label
                        htmlFor="edit-city"
                        className="block text-[10px] font-bold uppercase tracking-wider text-stone-600 mb-1.5"
                      >
                        City
                      </label>
                      <input
                        id="edit-city"
                        type="text"
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                        placeholder="Patna, Bihar"
                        className="block w-full rounded-xl border border-stone-200 bg-[#FAFAFA] px-3.5 py-2.5 text-sm text-black focus:border-black focus:bg-white focus:outline-none transition-colors"
                      />
                    </div>
                  </div>
                  </div>

                  {/* Buttons */}
                  <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#F0EFEA]">
                    <button
                      type="button"
                      onClick={() => setIsEditing(false)}
                      className="px-4 py-2.5 rounded-xl border border-stone-200 text-stone-700 text-xs sm:text-sm font-semibold hover:bg-stone-50 transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSaving}
                      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-black text-white text-xs sm:text-sm font-semibold hover:bg-neutral-800 disabled:opacity-50 transition-all cursor-pointer"
                    >
                      {isSaving ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          <span>Saving...</span>
                        </>
                      ) : (
                        <>
                          <Save className="w-4 h-4" />
                          <span>Save Changes</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              ) : (
                /* Exact Normal View matching Mockup */
                <div className="flex flex-col justify-between h-full flex-1">
                  <div className="mb-2 shrink-0">
                    <h3 className="font-caslon text-xl sm:text-2xl font-bold text-[#111111] leading-tight">
                      Contact &amp; Details
                    </h3>
                    <p className="text-xs text-[#7A7A72] mt-0.5">
                      Your personal information is kept secure.
                    </p>
                  </div>

                  {/* 5-Card Details Grid - Compact and snug */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3 w-full my-auto">
                    {/* Card 1: PHONE */}
                    <div className="rounded-xl sm:rounded-2xl border border-[#EDEDE8] bg-[#FAFAF8] p-3 sm:p-3.5 flex items-center gap-3 hover:border-[#DCDCD4] transition-colors">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white border border-[#EDEDE8] text-[#4A4A45] shadow-2xs">
                        <Phone className="w-4 h-4 text-stone-700" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-[#8A8A82]">
                          PHONE
                        </p>
                        <p className="font-caslon text-base sm:text-lg font-bold text-[#111111] mt-0.5 truncate tracking-wide">
                          {displayPhone}
                        </p>
                      </div>
                    </div>

                    {/* Card 2: EMAIL */}
                    <div className="rounded-xl sm:rounded-2xl border border-[#EDEDE8] bg-[#FAFAF8] p-3 sm:p-3.5 flex items-center gap-3 hover:border-[#DCDCD4] transition-colors">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white border border-[#EDEDE8] text-[#4A4A45] shadow-2xs">
                        <Mail className="w-4 h-4 text-stone-700" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-[#8A8A82]">
                          EMAIL
                        </p>
                        <p className="font-caslon text-base sm:text-lg font-bold text-[#111111] mt-0.5 truncate tracking-tight">
                          {profile?.email || "samsingh8102@gmail.com"}
                        </p>
                      </div>
                    </div>

                    {/* Card 3: DATE OF BIRTH */}
                    <div className="rounded-xl sm:rounded-2xl border border-[#EDEDE8] bg-[#FAFAF8] p-3 sm:p-3.5 flex items-center gap-3 hover:border-[#DCDCD4] transition-colors">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white border border-[#EDEDE8] text-[#4A4A45] shadow-2xs">
                        <Calendar className="w-4 h-4 text-stone-700" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-[#8A8A82]">
                          DATE OF BIRTH
                        </p>
                        <p className="font-caslon text-base sm:text-lg font-bold text-[#111111] mt-0.5 truncate">
                          {formattedDob}
                        </p>
                      </div>
                    </div>

                    {/* Card 4: GENDER */}
                    <div className="rounded-xl sm:rounded-2xl border border-[#EDEDE8] bg-[#FAFAF8] p-3 sm:p-3.5 flex items-center gap-3 hover:border-[#DCDCD4] transition-colors">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white border border-[#EDEDE8] text-[#4A4A45] shadow-2xs">
                        <User className="w-4 h-4 text-stone-700" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-[#8A8A82]">
                          GENDER
                        </p>
                        <p className="font-caslon text-base sm:text-lg font-bold text-[#111111] mt-0.5 capitalize">
                          {formattedGender}
                        </p>
                      </div>
                    </div>

                    {/* Card 5: CITY (Span 2 columns) */}
                    <div className="sm:col-span-2 rounded-xl sm:rounded-2xl border border-[#EDEDE8] bg-[#FAFAF8] p-3 sm:p-3.5 flex items-center gap-3 hover:border-[#DCDCD4] transition-colors">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white border border-[#EDEDE8] text-[#4A4A45] shadow-2xs">
                        <MapPin className="w-4 h-4 text-stone-700" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-[#8A8A82]">
                          CITY
                        </p>
                        <p className="font-caslon text-base sm:text-lg font-bold text-[#111111] mt-0.5 truncate">
                          {city}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ========================================================================= */}
          {/* 3. SAVED PLACES SECTION (Matching reference design mockup)                */}
          {/* ========================================================================= */}
          <div className="rounded-2xl sm:rounded-3xl bg-white border border-[#EDEDE8] p-4 sm:p-5 shadow-xs">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start sm:items-center gap-3">
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-neutral-100 flex items-center justify-center text-black shrink-0 border border-neutral-200">
                  <MapPin className="w-4.5 h-4.5 text-black" />
                </div>
                <div>
                  <h3 className="font-caslon text-xl sm:text-2xl font-bold text-[#111111] leading-tight">
                    Saved Places
                  </h3>
                  <p className="text-xs text-[#7A7A72] mt-0.5">
                    Quickly access your favourite locations for a faster booking experience.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleOpenAddPlace}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 sm:px-4 sm:py-2 rounded-xl bg-black hover:bg-neutral-800 text-white text-xs font-semibold shadow-xs hover:shadow-sm active:scale-[0.98] transition-all cursor-pointer shrink-0 self-start sm:self-center"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add New Place</span>
              </button>
            </div>

            {/* Grid of 6 Saved Places Tiles */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-3.5 mt-4">
              {savedPlaces.map((place, index) => {
                const placeId = place.id || place._id || `sp-${index}`;
                const isDefault = place.isDefault ?? (index === 0 || place.type === "HOME");

                return (
                  <div
                    key={placeId}
                    className={`rounded-2xl p-4 sm:p-4.5 flex items-center justify-between gap-3 transition-all ${
                      isDefault
                        ? "bg-white border-2 border-black shadow-xs"
                        : "bg-white border border-[#EDEDE8] hover:border-black/40 shadow-2xs"
                    }`}
                  >
                    {/* Left: Icon */}
                    <div className="shrink-0">
                      {getPlaceIcon(place.label, place.type)}
                    </div>

                    {/* Middle: Title, Badge, Address */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-caslon font-bold text-base sm:text-lg text-[#111111] truncate">
                          {place.label}
                        </h4>
                        {isDefault && (
                          <span className="shrink-0 bg-black text-white text-[10px] sm:text-[11px] font-bold px-2 py-0.5 rounded-md">
                            Default
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-stone-500 mt-1">
                        <MapPin className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                        <span className="font-caslon text-xs sm:text-sm text-stone-600 truncate">{place.address}</span>
                      </div>
                    </div>

                    {/* Right: Actions */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleOpenEditPlace(place)}
                        title="Edit Place"
                        className="w-8 h-8 rounded-xl bg-white border border-[#EDEDE8] flex items-center justify-center text-stone-600 hover:text-black hover:border-black hover:bg-stone-50 transition-colors cursor-pointer shadow-2xs"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={deletingPlaceId === placeId}
                        onClick={() => handleDeletePlace(placeId)}
                        title="Delete Place"
                        className="w-8 h-8 rounded-xl bg-white border border-[#EDEDE8] flex items-center justify-center text-stone-400 hover:text-black hover:border-black hover:bg-stone-50 transition-colors cursor-pointer shadow-2xs disabled:opacity-50"
                      >
                        {deletingPlaceId === placeId ? (
                          <div className="w-3.5 h-3.5 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                        ) : (
                          <Trash2 className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}

              {/* Tile 6: Add Another Place Tile */}
              <div
                onClick={handleOpenAddPlace}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") handleOpenAddPlace();
                }}
                className="rounded-2xl border-2 border-dashed border-[#DCDCD4] hover:border-black bg-white hover:bg-neutral-50 p-4 sm:p-4.5 flex items-center gap-3.5 cursor-pointer transition-all group"
              >
                <div className="w-11 h-11 rounded-full bg-neutral-100 flex items-center justify-center text-black shrink-0 border border-neutral-200 group-hover:bg-black group-hover:text-white transition-all">
                  <Plus className="w-5 h-5 transition-colors" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-caslon font-bold text-base sm:text-lg text-[#111111]">
                    Add Another Place
                  </p>
                  <p className="font-caslon text-xs sm:text-sm text-stone-500 mt-0.5">
                    Save locations you visit frequently.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Danger Zone: Delete Account & Profile (Outside Saved Places) */}
          <div className="rounded-2xl sm:rounded-3xl border border-red-200 bg-red-50/30 p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-2xs">
            <div>
              <p className="text-sm font-bold text-red-900">Delete Account &amp; Profile</p>
              <p className="text-xs text-red-600/80 mt-0.5">
                Permanently delete your user profile and all saved data. You will be automatically redirected to the landing page.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsDeleteModalOpen(true)}
              className="shrink-0 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-semibold shadow-xs hover:shadow-sm active:scale-[0.98] transition-all cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete Profile</span>
            </button>
          </div>
        </>
      )}
      </div>

      {/* ========================================================================= */}
      {/* 4. ADD / EDIT PLACE MODAL DIALOG (Swagger API Integration)               */}
      {/* ========================================================================= */}
      {isPlaceModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="w-full max-w-md rounded-3xl bg-white border border-[#EDEDE8] p-6 sm:p-7 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-[#F0EFEA]">
              <div>
                <h3 className="font-caslon text-xl sm:text-2xl font-bold text-[#111111]">
                  {editingPlace ? "Edit Saved Place" : "Add New Place"}
                </h3>
                <p className="text-xs text-stone-500 mt-0.5">
                  {editingPlace ? "Update place details and coordinates" : "Save a place for faster ride booking"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsPlaceModalOpen(false)}
                className="text-stone-400 hover:text-black p-1 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSavePlaceModal} className="mt-5 space-y-4">
              {/* Category Selection */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-stone-600 mb-1.5">
                  Category
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(["HOME", "WORK", "OTHER"] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => {
                        setPlaceType(t);
                        if (!placeLabel || placeLabel === "Home" || placeLabel === "Work" || placeLabel === "Other") {
                          setPlaceLabel(t === "HOME" ? "Home" : t === "WORK" ? "Work" : "");
                        }
                      }}
                      className={`py-2 px-3 rounded-xl text-xs font-bold border transition-colors cursor-pointer flex items-center justify-center gap-1.5 ${
                        placeType === t
                          ? "bg-black text-white border-black"
                          : "bg-[#FAFAFA] text-stone-700 border-stone-200 hover:border-black"
                      }`}
                    >
                      <span className="text-base select-none">{t === "HOME" ? "🏡" : t === "WORK" ? "🏢" : "📍"}</span>
                      <span>{t === "HOME" ? "Home" : t === "WORK" ? "Work" : "Other"}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Duplicate category warning */}
              {placeType !== "OTHER" &&
                savedPlaces.some(
                  (p) =>
                    p.type === placeType &&
                    (editingPlace ? (p.id || p._id) !== (editingPlace.id || editingPlace._id) : true)
                ) && (
                  <div className="flex items-center gap-2 p-2.5 rounded-xl bg-neutral-100 border border-neutral-300 text-neutral-800 text-xs">
                    <AlertCircle className="w-4 h-4 shrink-0 text-neutral-700" />
                    <span>
                      A <strong>{placeType === "HOME" ? "Home" : "Work"}</strong> place already exists. At most one {placeType === "HOME" ? "Home" : "Work"} place is allowed.
                    </span>
                  </div>
                )}

              {/* Label */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-stone-600 mb-1.5">
                  Place Name / Label <span className="text-stone-400 font-normal lowercase">(optional)</span>
                </label>
                <input
                  type="text"
                  value={placeLabel}
                  onChange={(e) => setPlaceLabel(e.target.value)}
                  placeholder={
                    placeType === "HOME"
                      ? "Home (default)"
                      : placeType === "WORK"
                      ? "Work (default)"
                      : "e.g. Gym, Library, Cafe"
                  }
                  maxLength={50}
                  className="block w-full rounded-xl border border-stone-200 bg-[#FAFAFA] px-3.5 py-2.5 text-sm text-black focus:border-black focus:bg-white focus:outline-none transition-colors"
                />
              </div>

              {/* Address */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-stone-600 mb-1.5">
                  Full Address <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={placeAddress}
                  onChange={(e) => setPlaceAddress(e.target.value)}
                  placeholder="e.g. 12 MG Road, Patna, Bihar"
                  minLength={5}
                  maxLength={300}
                  className="block w-full rounded-xl border border-stone-200 bg-[#FAFAFA] px-3.5 py-2.5 text-sm text-black focus:border-black focus:bg-white focus:outline-none transition-colors"
                />
                <p className="text-[11px] text-stone-400 mt-1">Minimum 5 characters required.</p>
              </div>

              {/* Coordinates: Latitude & Longitude */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-stone-600">
                    Coordinates <span className="text-stone-400 font-normal lowercase">(lat, lng)</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setPlaceLatitude(25.6093);
                      setPlaceLongitude(85.1376);
                    }}
                    className="text-[10px] font-semibold text-black hover:underline cursor-pointer"
                  >
                    Reset Patna coords
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <input
                      type="number"
                      step="any"
                      min="-90"
                      max="90"
                      required
                      value={placeLatitude}
                      onChange={(e) => setPlaceLatitude(e.target.value)}
                      placeholder="25.6093"
                      className="block w-full rounded-xl border border-stone-200 bg-[#FAFAFA] px-3 py-2 text-xs font-mono text-black focus:border-black focus:bg-white focus:outline-none transition-colors"
                    />
                    <span className="text-[10px] text-stone-400 block mt-0.5">Latitude (-90 to 90)</span>
                  </div>
                  <div>
                    <input
                      type="number"
                      step="any"
                      min="-180"
                      max="180"
                      required
                      value={placeLongitude}
                      onChange={(e) => setPlaceLongitude(e.target.value)}
                      placeholder="85.1376"
                      className="block w-full rounded-xl border border-stone-200 bg-[#FAFAFA] px-3 py-2 text-xs font-mono text-black focus:border-black focus:bg-white focus:outline-none transition-colors"
                    />
                    <span className="text-[10px] text-stone-400 block mt-0.5">Longitude (-180 to 180)</span>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#F0EFEA]">
                <button
                  type="button"
                  onClick={() => setIsPlaceModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-stone-200 text-stone-700 text-xs sm:text-sm font-semibold hover:bg-stone-50 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={placeIsSaving}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-black hover:bg-neutral-800 text-white text-xs sm:text-sm font-semibold disabled:opacity-50 transition-all cursor-pointer shadow-xs"
                >
                  {placeIsSaving ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <span>{editingPlace ? "Save Changes" : "Add Place"}</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 5. CONFIRM DELETE PROFILE MODAL                                          */}
      {/* ========================================================================= */}
      {isDeleteModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in"
          onClick={() => {
            if (!isDeletingAccount) setIsDeleteModalOpen(false);
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm sm:max-w-md rounded-3xl bg-white border border-[#EDEDE8] p-6 sm:p-7 shadow-2xl animate-in zoom-in-95 relative"
          >
            <div className="flex items-start justify-between pb-3 border-b border-[#F0EFEA]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-red-100/70 border border-red-200 flex items-center justify-center text-red-600 shrink-0">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-caslon text-xl sm:text-2xl font-bold text-[#111111]">
                    Delete Profile?
                  </h3>
                  <p className="text-xs text-stone-500 mt-0.5">
                    This action is permanent and irreversible
                  </p>
                </div>
              </div>
              <button
                type="button"
                disabled={isDeletingAccount}
                onClick={() => setIsDeleteModalOpen(false)}
                className="text-stone-400 hover:text-black p-1 transition-colors cursor-pointer rounded-lg hover:bg-stone-100 disabled:opacity-50"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-4">
              <p className="text-xs sm:text-sm text-stone-600 leading-relaxed">
                Are you sure you want to permanently delete your account and profile? All your saved places, ride history, and personal details will be permanently removed. You will be automatically redirected to the landing page.
              </p>
            </div>

            <div className="flex items-center gap-3 mt-6 pt-2">
              <button
                type="button"
                disabled={isDeletingAccount}
                onClick={() => setIsDeleteModalOpen(false)}
                className="flex-1 py-2.5 px-4 rounded-xl border border-stone-200 hover:border-black bg-white hover:bg-stone-50 text-stone-700 text-xs sm:text-sm font-semibold transition-all cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeletingAccount}
                onClick={handleDeleteAccount}
                className="flex-1 inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs sm:text-sm font-semibold shadow-xs hover:shadow-sm active:scale-[0.98] transition-all cursor-pointer disabled:opacity-50"
              >
                {isDeletingAccount ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    <span>Delete Profile</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

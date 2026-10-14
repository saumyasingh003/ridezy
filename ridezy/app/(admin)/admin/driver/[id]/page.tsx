"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {ArrowLeft,Mail,Phone,Calendar,CalendarDays,FileBadge,Car,CheckCircle2,Clock,AlertTriangle,ShieldCheck,Check,X,User,Star,ExternalLink,Shield,FileText,RotateCcw,Trash2,Pencil,Sparkles,BadgeCheck,Route,MapPin,Navigation,IndianRupee,ChevronDown,Camera,Link2,Eye,Upload,Copy,CheckCheck,FileCheck,} from "lucide-react";

const API_BASE = "http://localhost:5000/api";

export interface DriverDetailsRide {
  id: string;
  pickup?: { address: string; latitude?: number; longitude?: number } | null;
  destination?: { address: string; latitude?: number; longitude?: number } | null;
  fare?: number;
  distanceKm?: number;
  durationMinutes?: number;
  vehicleType?: string;
  status: string;
  passenger?: {
    id?: string;
    name: string;
    phone?: string | null;
    email?: string | null;
  } | null;
  createdAt?: string;
  updatedAt?: string;
}

interface DriverDetailsData {
  id: string;
  driverProfileId: string;
  userId?: string;
  name: string;
  email: string;
  phone: string | null;
  licenseNumber: string;
  verificationStatus: "PENDING" | "VERIFIED" | "REJECTED" | "SUSPENDED" | string;
  availabilityStatus?: string;
  gender?: string | null;
  dateOfBirth?: string | null;
  profileImage?: string | null;
  verifiedAt?: string | null;
  rejectionReason?: string | null;
  suspensionReason?: string | null;
  suspendedAt?: string | null;
  createdAt?: string;
  totalTrips?: number;
  totalAllRides?: number;
  rides?: DriverDetailsRide[];
  rating?: number;
  user?: {
    id: string;
    name: string;
    email: string;
    phone: string | null;
    createdAt?: string;
    isEmailVerified?: boolean;
  } | null;
  vehicle?: {
    make: string;
    model: string;
    registrationNumber: string;
    vehicleType: string;
    color?: string;
    year?: number;
    vehicleImage?: string | null;
  } | null;
  documents?: Array<{
    _id?: string;
    id?: string;
    documentType: string;
    documentNumber: string;
    documentUrl: string;
    verificationStatus: string;
    rejectionReason?: string;
  }>;
}

export default function DriverDetailPage() {
  const params = useParams();
  const router = useRouter();
  const driverId = params?.id as string;

  const [driver, setDriver] = useState<DriverDetailsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionInProgress, setActionInProgress] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectionReasonInput, setRejectionReasonInput] = useState("");
  const [suspendModalOpen, setSuspendModalOpen] = useState(false);
  const [suspensionReasonInput, setSuspensionReasonInput] = useState("");
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editNameInput, setEditNameInput] = useState("");
  const [editPhoneInput, setEditPhoneInput] = useState("");
  const [editLicenseInput, setEditLicenseInput] = useState("");
  const [editGenderInput, setEditGenderInput] = useState<"MALE" | "FEMALE" | "OTHER">("MALE");
  const [editDobInput, setEditDobInput] = useState("");
  const [editProfileImageInput, setEditProfileImageInput] = useState("");
  const [editVehicleImageInput, setEditVehicleImageInput] = useState("");
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [isUploadingVehiclePhoto, setIsUploadingVehiclePhoto] = useState(false);
  const [showDriverUrlInput, setShowDriverUrlInput] = useState(false);
  const [showVehicleUrlInput, setShowVehicleUrlInput] = useState(false);
  const [genderDropdownOpen, setGenderDropdownOpen] = useState(false);
  const genderDropdownRef = useRef<HTMLDivElement>(null);
  const [rideFilter, setRideFilter] = useState<"ALL" | "COMPLETED" | "CANCELLED">("ALL");

  // Document Review & Lightbox Preview State
  // KYC documents section: open/closed (heading always visible)
  const [kycOpen, setKycOpen] = useState(false);
  const [docPreviewModal, setDocPreviewModal] = useState<{
    open: boolean;
    title: string;
    subtitle: string;
    number: string;
    url: string;
    status: string;
    type: string;
    id?: string;
  } | null>(null);
  const [copiedDoc, setCopiedDoc] = useState<string | null>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        genderDropdownRef.current &&
        !genderDropdownRef.current.contains(event.target as Node)
      ) {
        setGenderDropdownOpen(false);
      }
    };
    if (genderDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [genderDropdownOpen]);

  const isValidImageUrl = (url?: string | null): boolean => {
    if (!url) return false;
    const trimmed = String(url).trim();
    if (!trimmed || trimmed === "null" || trimmed === "undefined") return false;
    if (trimmed.includes("files.example.com") || trimmed.includes("example.com/")) return false;
    return true;
  };

  const showToast = (msg: string, _type?: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleAdminPhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      showToast("Photo must be less than 10MB.", "error");
      return;
    }
    setIsUploadingPhoto(true);
    const reader = new FileReader();
    reader.onload = async () => {
      if (typeof reader.result !== "string") {
        setIsUploadingPhoto(false);
        return;
      }
      try {
        const uploadRes = await fetch(`${API_BASE}/upload`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("token") ?? ""}`,
          },
          body: JSON.stringify({ file: reader.result, fileName: file.name, category: "profile" }),
        });
        const uploadJson = await uploadRes.json().catch(() => ({}));
        if (uploadRes.ok && uploadJson.success && uploadJson.data?.url) {
          setEditProfileImageInput(uploadJson.data.url);
          showToast("Photo uploaded. Save to persist link in database.");
        } else {
          showToast(uploadJson.message || "Failed to upload image.");
        }
      } catch {
        showToast("Error uploading image.");
      } finally {
        setIsUploadingPhoto(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleAdminVehiclePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      showToast("Vehicle photo must be less than 10MB.", "error");
      return;
    }
    setIsUploadingVehiclePhoto(true);
    const reader = new FileReader();
    reader.onload = async () => {
      if (typeof reader.result !== "string") {
        setIsUploadingVehiclePhoto(false);
        return;
      }
      try {
        const uploadRes = await fetch(`${API_BASE}/upload`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("token") ?? ""}`,
          },
          body: JSON.stringify({ file: reader.result, fileName: file.name, category: "vehicle" }),
        });
        const uploadJson = await uploadRes.json().catch(() => ({}));
        if (uploadRes.ok && uploadJson.success && uploadJson.data?.url) {
          setEditVehicleImageInput(uploadJson.data.url);
          showToast("Vehicle photo uploaded. Save to persist link in database.");
        } else {
          showToast(uploadJson.message || "Failed to upload vehicle photo.");
        }
      } catch {
        showToast("Error uploading vehicle photo.");
      } finally {
        setIsUploadingVehiclePhoto(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const VEHICLE_PRESETS = [
    {
      name: "Honda Shine / Motorcycle",
      type: "BIKE",
      badge: "🏍️ Motorcycle",
      url: "https://images.unsplash.com/photo-1558981403-c5f9899a28bc?auto=format&fit=crop&w=800&q=80",
    },
    {
      name: "City Auto Rickshaw",
      type: "AUTO",
      badge: "🛺 Auto",
      url: "https://images.unsplash.com/photo-1596484552834-6a58f850e0a1?auto=format&fit=crop&w=800&q=80",
    },
    {
      name: "Sedan Cab / Taxi",
      type: "CAB",
      badge: "🚗 Sedan",
      url: "https://images.unsplash.com/photo-1549399542-7e3f8b79c341?auto=format&fit=crop&w=800&q=80",
    },
  ];

  const saveVehicleImageLocally = (imgUrl: string, targetDriver?: DriverDetailsData | null) => {
    if (typeof window === "undefined") return;
    const d = targetDriver || driver;
    if (d?.id) localStorage.setItem(`vehicle_image_${d.id}`, imgUrl);
    if (d?.driverProfileId) localStorage.setItem(`vehicle_image_${d.driverProfileId}`, imgUrl);
    if (d?.vehicle?.registrationNumber) {
      localStorage.setItem(`vehicle_image_${d.vehicle.registrationNumber}`, imgUrl);
    }
    localStorage.setItem("driver_vehicle_image", imgUrl);
  };

  const syncVehicleImageToBackend = (imgUrl: string | null) => {
    if (!driver) return;
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    const idToUse = driver.driverProfileId || driver.id || driver.userId;
    if (idToUse && token) {
      fetch(`${API_BASE}/admin/drivers/${idToUse}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ vehicleImage: imgUrl }),
      }).catch(() => {});
    }
    if (token) {
      fetch(`${API_BASE}/drivers/vehicle`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ vehicleImage: imgUrl }),
      }).catch(() => {});
    }
  };

  const enrichDriverWithLocalImages = (d: DriverDetailsData): DriverDetailsData => {
    if (!d || typeof window === "undefined") return d;
    const vReg = d.vehicle?.registrationNumber;
    const localVeh =
      localStorage.getItem(`vehicle_image_${d.id}`) ||
      (d.driverProfileId ? localStorage.getItem(`vehicle_image_${d.driverProfileId}`) : null) ||
      (vReg ? localStorage.getItem(`vehicle_image_${vReg}`) : null) ||
      localStorage.getItem("driver_vehicle_image");

    const localProf =
      localStorage.getItem(`profile_image_${d.id}`) ||
      (d.driverProfileId ? localStorage.getItem(`profile_image_${d.driverProfileId}`) : null) ||
      localStorage.getItem("driver_profile_image") ||
      localStorage.getItem("userProfileImage");

    const resolvedVeh = d.vehicle
      ? {
          ...d.vehicle,
          vehicleImage: d.vehicle.vehicleImage || localVeh || null,
        }
      : null;

    if (d.vehicle?.vehicleImage) {
      saveVehicleImageLocally(d.vehicle.vehicleImage, d);
    } else if (localVeh && d.vehicle) {
      const token = localStorage.getItem("token");
      const idToUse = d.driverProfileId || d.id || d.userId;
      if (token && idToUse) {
        fetch(`${API_BASE}/admin/drivers/${idToUse}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ vehicleImage: localVeh }),
        }).catch(() => {});
      }
    }

    if (d.profileImage) {
      if (d.id) localStorage.setItem(`profile_image_${d.id}`, d.profileImage);
      if (d.driverProfileId) localStorage.setItem(`profile_image_${d.driverProfileId}`, d.profileImage);
      localStorage.setItem("driver_profile_image", d.profileImage);
    }

    return {
      ...d,
      profileImage: d.profileImage || localProf || null,
      vehicle: resolvedVeh,
    };
  };

  const handleDirectVehiclePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !driver) return;
    if (file.size > 15 * 1024 * 1024) {
      showToast("Vehicle photo must be less than 15MB.", "error");
      return;
    }
    setIsUploadingVehiclePhoto(true);
    const reader = new FileReader();
    reader.onload = async () => {
      if (typeof reader.result !== "string") {
        setIsUploadingVehiclePhoto(false);
        return;
      }
      const localDataUrl = reader.result;

      // 1. Immediately save locally into browser storage
      saveVehicleImageLocally(localDataUrl, driver);

      // 2. Immediately update display on website (0ms latency)
      setDriver((prev) =>
        prev
          ? {
              ...prev,
              vehicle: prev.vehicle
                ? { ...prev.vehicle, vehicleImage: localDataUrl }
                : null,
            }
          : null
      );
      setEditVehicleImageInput(localDataUrl);
      showToast("Vehicle photo saved locally! Uploading to server...", "success");

      // 3. Persist file on server disk & Mongo database
      try {
        const uploadRes = await fetch(`${API_BASE}/upload`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("token") ?? ""}`,
          },
          body: JSON.stringify({ file: localDataUrl, fileName: file.name, category: "vehicle" }),
        });
        const uploadJson = await uploadRes.json().catch(() => ({}));
        const finalUrl =
          uploadRes.ok && uploadJson.success && uploadJson.data?.url
            ? uploadJson.data.url
            : localDataUrl;

        saveVehicleImageLocally(finalUrl, driver);
        syncVehicleImageToBackend(finalUrl);

        setDriver((prev) =>
          prev
            ? {
                ...prev,
                vehicle: prev.vehicle
                  ? { ...prev.vehicle, vehicleImage: finalUrl }
                  : null,
              }
            : null
        );
        setEditVehicleImageInput(finalUrl);
        showToast("Vehicle photo saved locally and synced to server!", "success");
      } catch {
        showToast("Saved in local browser storage.", "info");
      } finally {
        setIsUploadingVehiclePhoto(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSelectVehiclePreset = (presetUrl: string, presetName: string) => {
    if (!driver) return;
    saveVehicleImageLocally(presetUrl, driver);
    syncVehicleImageToBackend(presetUrl);
    setDriver((prev) =>
      prev
        ? {
            ...prev,
            vehicle: prev.vehicle
              ? { ...prev.vehicle, vehicleImage: presetUrl }
              : null,
          }
        : null
    );
    setEditVehicleImageInput(presetUrl);
    showToast(`${presetName} applied and saved!`, "success");
  };

  const handleRemoveVehiclePhoto = () => {
    if (!driver) return;
    if (typeof window !== "undefined") {
      if (driver.id) localStorage.removeItem(`vehicle_image_${driver.id}`);
      if (driver.driverProfileId) localStorage.removeItem(`vehicle_image_${driver.driverProfileId}`);
      if (driver.vehicle?.registrationNumber) {
        localStorage.removeItem(`vehicle_image_${driver.vehicle.registrationNumber}`);
      }
      localStorage.removeItem("driver_vehicle_image");
    }
    syncVehicleImageToBackend(null);
    setDriver((prev) =>
      prev
        ? {
            ...prev,
            vehicle: prev.vehicle
              ? { ...prev.vehicle, vehicleImage: null }
              : null,
          }
        : null
    );
    setEditVehicleImageInput("");
    showToast("Vehicle photo removed.", "info");
  };

  const openEditModal = () => {
    if (!driver) return;
    setEditNameInput(driver.name || "");
    setEditPhoneInput(driver.phone ? driver.phone.replace("+91", "") : "");
    setEditLicenseInput(driver.licenseNumber || "");
    setEditProfileImageInput(driver.profileImage || "");
    setEditVehicleImageInput(driver.vehicle?.vehicleImage || "");
    setEditGenderInput(
      driver.gender === "FEMALE" || driver.gender === "OTHER" ? driver.gender : "MALE"
    );
    setEditDobInput(driver.dateOfBirth ? driver.dateOfBirth.slice(0, 10) : "");
    setShowDriverUrlInput(false);
    setShowVehicleUrlInput(false);
    setEditModalOpen(true);
  };

  const copyToClipboard = (text: string, label: string) => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedDoc(label);
      showToast(`${label} copied to clipboard!`, "info");
      setTimeout(() => setCopiedDoc(null), 2000);
    }
  };



  const handleUpdateDocStatus = async (
    docId: string,
    newStatus: "VERIFIED" | "REJECTED" | "PENDING"
  ) => {
    if (!driver || !docId) return;
    setActionInProgress(true);
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
      const idToUse = driver.driverProfileId || driver.id;
      const res = await fetch(
        `${API_BASE}/admin/drivers/${idToUse}/documents/${docId}/status`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            verificationStatus: newStatus,
            rejectionReason:
              newStatus === "REJECTED" ? "Document scan unclear or invalid" : undefined,
          }),
        }
      );
      const json = await res.json().catch(() => ({}));
      if (res.ok && json.success) {
        showToast(`Document marked as ${newStatus}.`, "success");
        setDriver((prev) => {
          if (!prev || !prev.documents) return prev;
          return {
            ...prev,
            documents: prev.documents.map((d) =>
              d._id === docId || d.id === docId
                ? { ...d, verificationStatus: newStatus }
                : d
            ),
          };
        });
      } else {
        showToast(json.message || "Failed to update status.");
      }
    } catch {
      showToast("Error updating document status.");
    } finally {
      setActionInProgress(false);
    }
  };

  const handleDeleteDoc = async (docId: string, docType: string) => {
    if (!driver || !docId) return;
    if (
      !confirm(
        `Are you sure you want to delete this ${docType.replace("_", " ")} document?`
      )
    ) {
      return;
    }
    setActionInProgress(true);
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
      const idToUse = driver.driverProfileId || driver.id;
      const res = await fetch(
        `${API_BASE}/admin/drivers/${idToUse}/documents/${docId}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      const json = await res.json().catch(() => ({}));
      if (res.ok && json.success) {
        showToast("Document deleted successfully.", "info");
        setDriver((prev) => {
          if (!prev || !prev.documents) return prev;
          return {
            ...prev,
            documents: prev.documents.filter((d) => d._id !== docId && d.id !== docId),
          };
        });
        if (docPreviewModal?.id === docId) {
          setDocPreviewModal(null);
        }
      } else {
        showToast(json.message || "Failed to delete document.");
      }
    } catch {
      showToast("Error deleting document.");
    } finally {
      setActionInProgress(false);
    }
  };

  const fetchDriverDetails = async () => {
    if (!driverId) return;
    setIsLoading(true);
    setError(null);
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
      if (!token) {
        setError("Admin session not found. Please log in.");
        setIsLoading(false);
        return;
      }

      // Try specific driver detail endpoint first
      const res = await fetch(`${API_BASE}/admin/drivers/${driverId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json().catch(() => ({}));

      if (res.ok && json.success && json.data) {
        setDriver(enrichDriverWithLocalImages(json.data));
        return;
      }

      // Try GET /api/drivers/profile (the active driver profile API)
      try {
        const profRes = await fetch(`${API_BASE}/drivers/profile`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const profJson = await profRes.json().catch(() => ({}));
        if (profRes.ok && profJson.success && profJson.data) {
          const p = profJson.data;

          // Also fetch vehicle & documents
          let vehicleData = null;
          let docList: any[] = [];
          try {
            const vRes = await fetch(`${API_BASE}/drivers/vehicle`, {
              headers: { Authorization: `Bearer ${token}` },
            });
            const vJson = await vRes.json().catch(() => ({}));
            if (vRes.ok && vJson.success && vJson.data) vehicleData = vJson.data;
          } catch {}

          try {
            const dRes = await fetch(`${API_BASE}/drivers/documents`, {
              headers: { Authorization: `Bearer ${token}` },
            });
            const dJson = await dRes.json().catch(() => ({}));
            if (dRes.ok && dJson.success && Array.isArray(dJson.data)) docList = dJson.data;
          } catch {}

          const driverObj: DriverDetailsData = {
            id: p.id || driverId,
            driverProfileId: p.id || driverId,
            userId: p.userId,
            name:
              p.name ||
              (typeof window !== "undefined" ? localStorage.getItem("userName") : null) ||
              "Driver Partner",
            email:
              p.email ||
              (typeof window !== "undefined" ? localStorage.getItem("userEmail") : null) ||
              "",
            phone:
              p.phone ||
              (typeof window !== "undefined" ? localStorage.getItem("userPhone") : null) ||
              null,
            licenseNumber: p.licenseNumber || "BR097826H8HMK03N3303",
            verificationStatus: p.verificationStatus || "VERIFIED",
            availabilityStatus: p.availabilityStatus || "AVAILABLE",
            gender: p.gender || "MALE",
            dateOfBirth: p.dateOfBirth || null,
            profileImage: p.profileImage || null,
            verifiedAt: p.verifiedAt || null,
            totalTrips: p.totalTrips || 0,
            rating: p.rating || 5.0,
            vehicle: vehicleData,
            documents: docList,
          };
          setDriver(enrichDriverWithLocalImages(driverObj));
          return;
        }
      } catch {}

      // Fallback: fetch from drivers list and find matching driver
      const listRes = await fetch(`${API_BASE}/admin/drivers`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const listJson = await listRes.json().catch(() => ({}));
      if (listRes.ok && listJson.success && Array.isArray(listJson.data?.drivers)) {
        const matched = listJson.data.drivers.find(
          (d: any) => d.id === driverId || d.driverProfileId === driverId
        );
        if (matched) {
          setDriver(enrichDriverWithLocalImages(matched));
        } else {
          setError("Driver partner profile not found.");
        }
      } else {
        setError("Failed to load driver profile.");
      }
    } catch {
      setError("Unable to connect to server. Please check your connection.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDriverDetails();
  }, [driverId]);

  const handleVerify = async () => {
    if (!driver) return;
    setActionInProgress(true);
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
      if (token) {
        const idToUse = driver.driverProfileId || driver.id;
        const res = await fetch(`${API_BASE}/admin/drivers/${idToUse}/verify`, {
          method: "PATCH",
          headers: { Authorization: `Bearer ${token}` },
        });
        const json = await res.json().catch(() => ({}));
        if (res.ok) {
          showToast(json.message || "Driver profile verified successfully.");
          setDriver((prev) => (prev ? { ...prev, verificationStatus: "VERIFIED" } : null));
        } else {
          showToast(json.message || "Verification failed.");
        }
      }
    } catch {
      showToast("Error approving driver.");
    } finally {
      setActionInProgress(false);
    }
  };

  const handleReject = async () => {
    if (!driver) return;
    const reason = rejectionReasonInput.trim() || "Documents or vehicle require re-submission.";
    setActionInProgress(true);
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
      if (token) {
        const idToUse = driver.driverProfileId || driver.id;
        const res = await fetch(`${API_BASE}/admin/drivers/${idToUse}/reject`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ rejectionReason: reason }),
        });
        const json = await res.json().catch(() => ({}));
        if (res.ok) {
          showToast(json.message || "Driver verification rejected.");
          setDriver((prev) =>
            prev
              ? {
                  ...prev,
                  verificationStatus: "REJECTED",
                  rejectionReason: reason,
                }
              : null
          );
          setRejectModalOpen(false);
        } else {
          showToast(json.message || "Action failed.");
        }
      }
    } catch {
      showToast("Error updating driver status.");
    } finally {
      setActionInProgress(false);
    }
  };

  const handleSuspend = async () => {
    if (!driver) return;
    const reason = suspensionReasonInput.trim() || "Driver suspended by platform administrator.";
    setActionInProgress(true);
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
      if (token) {
        const idToUse = driver.driverProfileId || driver.id;
        const res = await fetch(`${API_BASE}/admin/drivers/${idToUse}/suspend`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ reason }),
        });
        const json = await res.json().catch(() => ({}));
        if (res.ok && json.success) {
          showToast(json.message || "Driver profile suspended.");
          setDriver((prev) =>
            prev
              ? {
                  ...prev,
                  verificationStatus: "SUSPENDED",
                  availabilityStatus: "OFFLINE",
                  suspensionReason: reason,
                  suspendedAt: new Date().toISOString(),
                }
              : null
          );
          setSuspendModalOpen(false);
          setSuspensionReasonInput("");
        } else {
          showToast(json.message || "Failed to suspend driver.");
        }
      }
    } catch {
      showToast("Error suspending driver.");
    } finally {
      setActionInProgress(false);
    }
  };

  const handleActivate = async () => {
    if (!driver) return;
    setActionInProgress(true);
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
      if (token) {
        const idToUse = driver.driverProfileId || driver.id;
        const res = await fetch(`${API_BASE}/admin/drivers/${idToUse}/activate`, {
          method: "PATCH",
          headers: { Authorization: `Bearer ${token}` },
        });
        const json = await res.json().catch(() => ({}));
        if (res.ok && json.success) {
          showToast(json.message || "Driver profile activated.");
          setDriver((prev) =>
            prev
              ? {
                  ...prev,
                  verificationStatus: "VERIFIED",
                  suspensionReason: null,
                  suspendedAt: null,
                }
              : null
          );
        } else {
          showToast(json.message || "Failed to activate driver.");
        }
      }
    } catch {
      showToast("Error activating driver.");
    } finally {
      setActionInProgress(false);
    }
  };

  const handleDeleteProfile = async () => {
    if (!driver) return;
    setActionInProgress(true);
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
      if (token) {
        const idToUse = driver.driverProfileId || driver.id || driver.userId;

        // 1. Try DELETE /api/drivers/profile
        let deleteRes = await fetch(`${API_BASE}/drivers/profile`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        });

        // 2. If using admin credentials or not deleted yet, call /admin/drivers/${idToUse}
        if (!deleteRes.ok && idToUse) {
          deleteRes = await fetch(`${API_BASE}/admin/drivers/${idToUse}`, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${token}` },
          });
        }

        const json = await deleteRes.json().catch(() => ({}));
        if (deleteRes.ok) {
          showToast(json.message || "Driver profile deleted successfully.");
          setDeleteModalOpen(false);

          // Clear all user data from network/storage and redirect to home page
          if (typeof window !== "undefined") {
            localStorage.clear();
            sessionStorage.clear();
            setTimeout(() => {
              window.location.href = "/";
            }, 800);
          }
          return;
        } else {
          showToast(json.message || "Failed to delete driver profile.");
          setActionInProgress(false);
          return;
        }
      }
    } catch {
      showToast("Driver profile deleted.");
      if (typeof window !== "undefined") {
        localStorage.clear();
        sessionStorage.clear();
        window.location.href = "/";
      }
    } finally {
      setActionInProgress(false);
    }
  };

  const handleSaveDriverProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!driver) return;
    setActionInProgress(true);
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
      const idToUse = driver.driverProfileId || driver.id || driver.userId;

      const cleanPhone = editPhoneInput.trim().replace(/\D/g, "");
      const cleanLicense = editLicenseInput.trim().replace(/[^a-zA-Z0-9]/g, "").toUpperCase();

      const payload: Record<string, any> = {
        name: editNameInput.trim(),
        gender: editGenderInput,
      };

      if (editProfileImageInput.trim()) {
        payload.profileImage = editProfileImageInput.trim();
      }
      if (cleanPhone) {
        payload.phone = "+91" + cleanPhone;
      }
      if (cleanLicense && cleanLicense.length >= 8) {
        payload.licenseNumber = cleanLicense;
      }
      if (editDobInput) {
        payload.dateOfBirth = editDobInput;
      }
      if (driver.vehicle) {
        payload.vehicleImage = editVehicleImageInput.trim() || null;
        try {
          await fetch(`${API_BASE}/drivers/vehicle`, {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ vehicleImage: editVehicleImageInput.trim() || null }),
          });
        } catch {
          // ignore
        }
      }

      // 1. Try PATCH /api/drivers/profile first (role: DRIVER)
      let patchRes = await fetch(`${API_BASE}/drivers/profile`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      // 2. If using admin session or not yet patched, call /api/admin/drivers/${idToUse}
      if (!patchRes.ok && idToUse) {
        patchRes = await fetch(`${API_BASE}/admin/drivers/${idToUse}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        });
      }

      const json = await patchRes.json().catch(() => ({}));
      if (patchRes.ok) {
        showToast("Driver profile updated successfully.", "success");
        setEditModalOpen(false);
        fetchDriverDetails();
        return;
      } else {
        showToast(json.message || "Failed to update driver profile.", "error");
      }
    } catch {
      showToast("Error updating driver profile.", "error");
    } finally {
      setActionInProgress(false);
    }
  };

  const formatDate = (dateString?: string | null) => {
    if (!dateString) return "Not specified";
    try {
      return new Date(dateString).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
    } catch {
      return dateString;
    }
  };

  if (isLoading) {
    return (
      <div className="w-full space-y-6 animate-pulse">
        <div className="h-6 w-40 bg-stone-200 rounded-lg" />
        <div className="h-44 bg-stone-200 rounded-3xl" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="h-80 bg-stone-200 rounded-3xl" />
          <div className="h-80 bg-stone-200 rounded-3xl" />
        </div>
      </div>
    );
  }

  if (error || !driver) {
    return (
      <div className="w-full max-w-md mx-auto py-20 text-center space-y-4 px-4">
        <div className="w-14 h-14 rounded-2xl bg-stone-100 border border-stone-200 text-stone-500 mx-auto flex items-center justify-center shadow-2xs">
          <AlertTriangle className="w-6 h-6 text-amber-600" />
        </div>
        <h2 className="font-caslon text-2xl font-bold text-stone-900">
          Driver Not Found
        </h2>
        <p className="text-xs sm:text-sm text-stone-500 leading-relaxed">
          {error || "The driver profile you are looking for does not exist or has been removed."}
        </p>
        <div className="pt-2">
          <Link
            href="/admin/driver"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-black text-white text-xs font-semibold hover:bg-neutral-800 transition-colors shadow-2xs"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Return to Driver Management</span>
          </Link>
        </div>
      </div>
    );
  }

  const initial = (driver.name || "D").charAt(0).toUpperCase();
  const isVerified = driver.verificationStatus === "VERIFIED";
  const isPending = driver.verificationStatus === "PENDING";
  const isRejected = driver.verificationStatus === "REJECTED";
  const isSuspended = driver.verificationStatus === "SUSPENDED";

  return (
    <div className="w-full space-y-5 sm:space-y-6 animate-in fade-in duration-300">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 rounded-xl bg-black px-4 py-2.5 text-xs text-white shadow-xl animate-in fade-in">
          {toastMessage}
        </div>
      )}

      {/* Reject Reason Modal */}
      {rejectModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="w-full max-w-md bg-white rounded-2xl border border-stone-200 shadow-xl p-5 space-y-4 animate-in zoom-in-95">
            <div className="flex items-center justify-between">
              <h3 className="font-caslon text-lg font-bold text-stone-900">
                Reject Driver Verification
              </h3>
              <button
                type="button"
                onClick={() => setRejectModalOpen(false)}
                className="text-stone-400 hover:text-black p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-stone-600 leading-relaxed">
              Please provide a specific reason for rejecting this driver partner. The reason will be stored for audit and shown to the driver.
            </p>
            <div>
              <textarea
                value={rejectionReasonInput}
                onChange={(e) => setRejectionReasonInput(e.target.value)}
                placeholder="e.g. Driving license image is blurry or expired. Please re-upload a clear copy."
                rows={3}
                className="w-full p-3 rounded-xl border border-stone-300 text-xs text-stone-900 placeholder:text-stone-400 focus:outline-hidden focus:border-stone-500 transition-colors"
              />
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setRejectModalOpen(false)}
                className="px-3.5 py-2 rounded-xl text-xs font-medium text-stone-600 hover:bg-stone-100 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={actionInProgress}
                onClick={handleReject}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-medium transition-colors cursor-pointer shadow-2xs disabled:opacity-50"
              >
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Suspend Driver Modal */}
      {suspendModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="w-full max-w-md bg-white rounded-2xl border border-stone-200 shadow-2xl p-6 space-y-4 animate-in zoom-in-95">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-stone-100 flex items-center justify-center border border-stone-200">
                  <AlertTriangle className="w-4 h-4 text-stone-900" />
                </div>
                <h3 className="font-caslon text-lg font-bold text-stone-900 tracking-tight">
                  Suspend Driver Partner
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSuspendModalOpen(false)}
                className="text-stone-400 hover:text-black p-1.5 rounded-lg hover:bg-stone-100 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-stone-600 leading-relaxed">
              Suspending this driver blocks them from accepting rides, going online, or receiving trip requests. This action will be logged in the admin audit history.
            </p>
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-stone-700 mb-1.5">
                Reason for Suspension *
              </label>
              <textarea
                value={suspensionReasonInput}
                onChange={(e) => setSuspensionReasonInput(e.target.value)}
                placeholder="e.g. Multiple passenger safety complaints or suspicious trip cancellations."
                rows={3}
                className="w-full p-3.5 rounded-xl border border-stone-300 text-xs text-stone-900 placeholder:text-stone-400 focus:outline-hidden focus:border-stone-900 focus:ring-1 focus:ring-stone-900 transition-colors bg-white resize-y"
              />
            </div>
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setSuspendModalOpen(false)}
                className="px-4 py-2.5 rounded-xl text-xs font-semibold text-stone-700 hover:text-black hover:bg-stone-100 border border-stone-200 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={actionInProgress || !suspensionReasonInput.trim()}
                onClick={handleSuspend}
                className="px-5 py-2.5 rounded-xl bg-stone-900 hover:bg-black text-white text-xs font-bold transition-colors cursor-pointer shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {actionInProgress ? "Suspending..." : "Confirm Suspension"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="w-full max-w-md bg-white rounded-2xl border border-stone-200 shadow-xl p-5 space-y-4 animate-in zoom-in-95">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5 text-rose-600">
                <div className="w-8 h-8 rounded-full bg-rose-50 border border-rose-200 flex items-center justify-center">
                  <Trash2 className="w-4 h-4 text-rose-600" />
                </div>
                <h3 className="font-caslon text-lg font-bold text-stone-900">
                  Delete Driver Profile
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setDeleteModalOpen(false)}
                className="text-stone-400 hover:text-black p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-stone-600 leading-relaxed">
              Are you sure you want to permanently delete the driver profile for{" "}
              <strong className="text-stone-900 font-semibold">{driver.name}</strong>?
              This will permanently delete the driver record, their registered vehicle, and verification documents. This action cannot be undone.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                disabled={actionInProgress}
                onClick={() => setDeleteModalOpen(false)}
                className="px-3.5 py-2 rounded-xl text-xs font-medium text-stone-600 hover:bg-stone-100 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={actionInProgress}
                onClick={handleDeleteProfile}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-medium transition-colors cursor-pointer shadow-2xs disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{actionInProgress ? "Deleting..." : "Delete Permanently"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Driver Profile Modal */}
      {editModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-xl bg-white rounded-[28px] border border-stone-200/90 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.2)] overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-6 py-4.5 border-b border-stone-100 flex items-center justify-between shrink-0 bg-white">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-caslon text-xl sm:text-2xl font-bold text-stone-900 tracking-tight">
                    Edit Driver Profile
                  </h3>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-stone-500 bg-stone-100 px-2 py-0.5 rounded-md">
                    Admin
                  </span>
                </div>
                <p className="text-xs text-stone-500 mt-0.5">
                  Update personal details, license information, and media
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditModalOpen(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-stone-400 hover:text-stone-900 hover:bg-stone-100 transition-colors cursor-pointer"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Scrollable Form Body */}
            <form onSubmit={handleSaveDriverProfile} className="flex flex-col flex-1 min-h-0">
              <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
                {/* 1. Media Cards (Side-by-Side Grid) */}
                <div className="space-y-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400 block">
                    Profile &amp; Vehicle Media
                  </span>

                  <div className={`grid grid-cols-1 ${driver.vehicle ? "sm:grid-cols-2" : ""} gap-3`}>
                    {/* Driver Avatar Card */}
                    <div className="p-3.5 rounded-2xl border border-stone-200/80 bg-[#FAFAF8] space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-stone-800">Driver Photo</span>
                        {editProfileImageInput && (
                          <button
                            type="button"
                            onClick={() => setEditProfileImageInput("")}
                            className="text-[11px] text-rose-600 hover:underline cursor-pointer"
                          >
                            Remove
                          </button>
                        )}
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="w-14 h-14 rounded-xl bg-stone-900 text-white flex items-center justify-center font-caslon font-bold text-xl overflow-hidden shrink-0 border border-stone-200/90 shadow-2xs">
                          {editProfileImageInput ? (
                            <img
                              src={editProfileImageInput}
                              alt="Driver Preview"
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            driver.name.charAt(0).toUpperCase()
                          )}
                        </div>
                        <div className="min-w-0 flex-1 space-y-1.5">
                          <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-stone-200 bg-white hover:bg-stone-50 text-stone-800 text-xs font-semibold cursor-pointer transition-colors shadow-2xs w-full justify-center">
                            <Camera className="w-3.5 h-3.5 text-stone-600" />
                            <span>{isUploadingPhoto ? "Uploading..." : "Upload Photo"}</span>
                            <input
                              type="file"
                              accept="image/*"
                              className="sr-only"
                              disabled={isUploadingPhoto}
                              onChange={handleAdminPhotoUpload}
                            />
                          </label>
                          <button
                            type="button"
                            onClick={() => setShowDriverUrlInput((prev) => !prev)}
                            className="text-[11px] text-stone-500 hover:text-stone-900 flex items-center gap-1 justify-center w-full transition-colors cursor-pointer"
                          >
                            <Link2 className="w-3 h-3 text-stone-400" />
                            <span>{showDriverUrlInput ? "Hide Link" : "Paste URL Link"}</span>
                          </button>
                        </div>
                      </div>

                      {showDriverUrlInput && (
                        <div className="pt-2 border-t border-stone-200/60 animate-in fade-in duration-100">
                          <input
                            type="url"
                            value={editProfileImageInput}
                            onChange={(e) => setEditProfileImageInput(e.target.value)}
                            placeholder="https://... or /uploads/..."
                            className="w-full h-9 px-2.5 rounded-lg bg-white border border-stone-200 text-xs text-stone-900 font-mono placeholder:text-stone-400 outline-none focus:border-stone-800 transition-colors"
                          />
                        </div>
                      )}
                    </div>

                    {/* Vehicle Photo Card */}
                    {driver.vehicle && (
                      <div className="p-3.5 rounded-2xl border border-stone-200/80 bg-[#FAFAF8] space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="text-xs font-semibold text-stone-800 truncate">
                              Vehicle Photo
                            </span>
                            <span className="text-[10px] text-stone-400 truncate font-mono">
                              ({driver.vehicle.make})
                            </span>
                          </div>
                          {editVehicleImageInput && (
                            <button
                              type="button"
                              onClick={() => setEditVehicleImageInput("")}
                              className="text-[11px] text-rose-600 hover:underline cursor-pointer shrink-0"
                            >
                              Remove
                            </button>
                          )}
                        </div>

                        <div className="flex items-center gap-3">
                          <div className="w-14 h-14 rounded-xl bg-stone-900 text-white flex items-center justify-center font-caslon font-bold text-xl overflow-hidden shrink-0 border border-stone-200/90 shadow-2xs">
                            {editVehicleImageInput ? (
                              <img
                                src={editVehicleImageInput}
                                alt="Vehicle Preview"
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <Car className="w-5 h-5 text-stone-400" />
                            )}
                          </div>
                          <div className="min-w-0 flex-1 space-y-1.5">
                            <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-stone-200 bg-white hover:bg-stone-50 text-stone-800 text-xs font-semibold cursor-pointer transition-colors shadow-2xs w-full justify-center">
                              <Camera className="w-3.5 h-3.5 text-stone-600" />
                              <span>{isUploadingVehiclePhoto ? "Uploading..." : "Upload Photo"}</span>
                              <input
                                type="file"
                                accept="image/*"
                                className="sr-only"
                                disabled={isUploadingVehiclePhoto}
                                onChange={handleAdminVehiclePhotoUpload}
                              />
                            </label>
                            <button
                              type="button"
                              onClick={() => setShowVehicleUrlInput((prev) => !prev)}
                              className="text-[11px] text-stone-500 hover:text-stone-900 flex items-center gap-1 justify-center w-full transition-colors cursor-pointer"
                            >
                              <Link2 className="w-3 h-3 text-stone-400" />
                              <span>{showVehicleUrlInput ? "Hide Link" : "Paste URL Link"}</span>
                            </button>
                          </div>
                        </div>

                        {showVehicleUrlInput && (
                          <div className="pt-2 border-t border-stone-200/60 animate-in fade-in duration-100">
                            <input
                              type="url"
                              value={editVehicleImageInput}
                              onChange={(e) => setEditVehicleImageInput(e.target.value)}
                              placeholder="https://... or /uploads/..."
                              className="w-full h-9 px-2.5 rounded-lg bg-white border border-stone-200 text-xs text-stone-900 font-mono placeholder:text-stone-400 outline-none focus:border-stone-800 transition-colors"
                            />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* 2. Personal & Driver Details */}
                <div className="space-y-3.5 pt-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400 block">
                    Personal &amp; License Information
                  </span>

                  {/* Full Name */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-stone-700">
                      Full Name
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-stone-400">
                        <User className="w-4 h-4" />
                      </div>
                      <input
                        type="text"
                        required
                        value={editNameInput}
                        onChange={(e) => setEditNameInput(e.target.value)}
                        placeholder="Driver Full Name"
                        className="w-full h-11 pl-10 pr-3.5 rounded-xl bg-stone-50/70 hover:bg-stone-50 focus:bg-white border border-stone-200 focus:border-stone-900 text-sm text-stone-900 placeholder:text-stone-400 outline-none transition-all"
                      />
                    </div>
                  </div>

                  {/* Phone & License Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="block text-xs font-semibold text-stone-700">
                        Phone Number
                      </label>
                      <div className="flex h-11 rounded-xl border border-stone-200 bg-stone-50/70 hover:bg-stone-50 focus-within:bg-white focus-within:border-stone-900 transition-all overflow-hidden">
                        <span className="flex items-center px-3 text-xs font-semibold text-stone-500 border-r border-stone-200/80 bg-stone-100/60 select-none">
                          +91
                        </span>
                        <input
                          type="tel"
                          maxLength={10}
                          value={editPhoneInput}
                          onChange={(e) => setEditPhoneInput(e.target.value.replace(/\D/g, ""))}
                          placeholder="9876543210"
                          className="w-full px-3 text-sm text-stone-900 font-mono placeholder:text-stone-400 bg-transparent outline-none"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="block text-xs font-semibold text-stone-700">
                        Driving License No.
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-stone-400">
                          <FileBadge className="w-4 h-4" />
                        </div>
                        <input
                          type="text"
                          value={editLicenseInput}
                          onChange={(e) => setEditLicenseInput(e.target.value.toUpperCase())}
                          placeholder="DL-0420110012345"
                          className="w-full h-11 pl-10 pr-3.5 rounded-xl bg-stone-50/70 hover:bg-stone-50 focus:bg-white border border-stone-200 focus:border-stone-900 text-sm text-stone-900 font-mono uppercase placeholder:text-stone-400 outline-none transition-all"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Gender & DOB Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5" ref={genderDropdownRef}>
                      <label className="block text-xs font-semibold text-stone-700">
                        Gender
                      </label>
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => setGenderDropdownOpen((prev) => !prev)}
                          className={`w-full h-11 px-3.5 rounded-xl border text-sm text-stone-900 transition-all flex items-center justify-between cursor-pointer outline-none ${
                            genderDropdownOpen
                              ? "bg-white border-stone-900 ring-1 ring-stone-900/10 shadow-xs"
                              : "bg-stone-50/70 hover:bg-stone-50 border-stone-200"
                          }`}
                        >
                          <span>
                            {editGenderInput === "MALE"
                              ? "Male"
                              : editGenderInput === "FEMALE"
                              ? "Female"
                              : "Other"}
                          </span>
                          <ChevronDown
                            className={`w-4 h-4 text-stone-500 transition-transform duration-150 ${
                              genderDropdownOpen ? "rotate-180" : ""
                            }`}
                          />
                        </button>

                        {genderDropdownOpen && (
                          <div className="absolute z-50 top-full mt-1.5 left-0 w-full bg-white rounded-2xl border border-stone-200/90 shadow-xl p-1.5 space-y-0.5 animate-in fade-in zoom-in-95 duration-100">
                            {(
                              [
                                { value: "MALE", label: "Male" },
                                { value: "FEMALE", label: "Female" },
                                { value: "OTHER", label: "Other" },
                              ] as const
                            ).map((opt) => {
                              const isSelected = editGenderInput === opt.value;
                              return (
                                <button
                                  key={opt.value}
                                  type="button"
                                  onClick={() => {
                                    setEditGenderInput(opt.value);
                                    setGenderDropdownOpen(false);
                                  }}
                                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-sm font-medium transition-colors cursor-pointer text-left ${
                                    isSelected
                                      ? "bg-stone-100 text-stone-900 font-semibold"
                                      : "text-stone-700 hover:bg-stone-50 hover:text-black"
                                  }`}
                                >
                                  <span>{opt.label}</span>
                                  {isSelected && (
                                    <Check className="w-3.5 h-3.5 text-stone-900 shrink-0" />
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="block text-xs font-semibold text-stone-700">
                        Date of Birth
                      </label>
                      <div className="relative">
                        <input
                          type="date"
                          value={editDobInput}
                          onChange={(e) => setEditDobInput(e.target.value)}
                          className="w-full h-11 px-3.5 rounded-xl bg-stone-50/70 hover:bg-stone-50 focus:bg-white border border-stone-200 focus:border-stone-900 text-sm text-stone-900 outline-none transition-all"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Modal Footer (Sticky) */}
              <div className="px-6 py-4 border-t border-stone-100 bg-[#FAFAF8] flex items-center justify-end gap-2.5 shrink-0">
                <button
                  type="button"
                  disabled={actionInProgress}
                  onClick={() => setEditModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-stone-600 hover:text-stone-900 hover:bg-stone-200/60 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionInProgress}
                  className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-stone-900 hover:bg-black text-white text-xs font-semibold transition-all shadow-xs hover:shadow-sm active:scale-[0.99] cursor-pointer disabled:opacity-50"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>{actionInProgress ? "Saving Changes..." : "Save Changes"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DOCUMENT PREVIEW LIGHTBOX MODAL */}
      {docPreviewModal && docPreviewModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 sm:p-6 animate-in fade-in duration-200">
          <div className="relative w-full max-w-4xl bg-[#141414] text-white rounded-3xl border border-white/10 shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-200">
            {/* Lightbox Header */}
            <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between shrink-0 bg-[#1A1A1A]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-white/10 border border-white/10 flex items-center justify-center text-white shrink-0">
                  <FileText className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <h3 className="font-caslon text-lg sm:text-xl font-bold text-white tracking-tight">
                      {docPreviewModal.title}
                    </h3>
                    <span
                      className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                        docPreviewModal.status === "VERIFIED"
                          ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                          : docPreviewModal.status === "PENDING"
                          ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                          : "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                      }`}
                    >
                      {docPreviewModal.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-white/60 font-mono mt-0.5">
                    <span>No: {docPreviewModal.number}</span>
                    <span>·</span>
                    <span className="text-white/40">{driver.name}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <a
                  href={docPreviewModal.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-semibold text-white transition-colors"
                  title="Open full image in new tab"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Original</span>
                </a>
                <button
                  type="button"
                  onClick={() => setDocPreviewModal(null)}
                  className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/80 hover:text-white transition-colors cursor-pointer"
                  title="Close preview"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Document Image Viewer Area */}
            <div className="flex-1 overflow-auto p-4 sm:p-6 flex items-center justify-center bg-[#0C0C0C]">
              <div className="relative max-w-full max-h-[65vh] rounded-2xl overflow-hidden border border-white/10 shadow-2xl bg-black/50">
                <img
                  src={docPreviewModal.url}
                  alt={docPreviewModal.title}
                  className="max-h-[65vh] w-auto max-w-full object-contain mx-auto"
                />
              </div>
            </div>

            {/* Lightbox Footer Actions */}
            <div className="px-6 py-3.5 border-t border-white/10 bg-[#1A1A1A] flex items-center justify-between flex-wrap gap-3 shrink-0">
              <span className="text-xs text-white/50 font-mono">
                {docPreviewModal.subtitle}
              </span>
              <div className="flex items-center gap-2">
                {docPreviewModal.id && docPreviewModal.status !== "VERIFIED" && (
                  <button
                    type="button"
                    disabled={actionInProgress}
                    onClick={() => {
                      if (docPreviewModal.id) {
                        handleUpdateDocStatus(docPreviewModal.id, "VERIFIED");
                        setDocPreviewModal((prev) =>
                          prev ? { ...prev, status: "VERIFIED" } : null
                        );
                      }
                    }}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-stone-950 text-xs font-semibold transition-colors cursor-pointer"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Approve Document</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}



      {/* 1. TOP HERO PROFILE HEADER */}
      <div className="rounded-3xl bg-[#F4ECE1] border border-[#E6DDD2] shadow-xs p-5 sm:p-6 lg:p-7 transition-all">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div className="flex items-center gap-4 sm:gap-5">
            {/* Back Arrow Button */}
            <Link
              href="/admin/driver"
              className="w-10 h-10 rounded-full bg-white/80 hover:bg-white border border-[#E0D7CC] flex items-center justify-center text-stone-700 hover:text-black transition-all shadow-2xs hover:shadow-xs group cursor-pointer shrink-0"
              title="Back to Driver Management"
              aria-label="Back to Driver Management"
            >
              <ArrowLeft className="w-4 h-4 sm:w-4.5 sm:h-4.5 group-hover:-translate-x-0.5 transition-transform" />
            </Link>

            {/* Avatar with Status Dot */}
            <div className="relative shrink-0">
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-[#111111] text-white flex items-center justify-center font-caslon font-bold text-2xl sm:text-3xl shadow-xs border-2 border-white overflow-hidden">
                {driver.profileImage ? (
                  <img
                    src={driver.profileImage}
                    alt={driver.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  initial
                )}
              </div>
              <span
                className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-white shadow-xs ${
                  driver.availabilityStatus === "AVAILABLE" ? "bg-emerald-500" : "bg-stone-400"
                }`}
                title={`Status: ${driver.availabilityStatus || "OFFLINE"}`}
              />
            </div>

            {/* Basic Info */}
            <div className="space-y-1.5">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="font-caslon text-2xl sm:text-3xl lg:text-[32px] font-bold text-[#111111] tracking-tight">
                  {driver.name}
                </h1>
                {/* Availability Text (bold and uppercase without bg) */}
                {driver.availabilityStatus && (
                  <span
                    className={`text-xs sm:text-sm font-bold uppercase tracking-wider ${
                      driver.availabilityStatus === "AVAILABLE"
                        ? "text-emerald-600"
                        : driver.availabilityStatus === "BUSY"
                        ? "text-sky-600"
                        : "text-stone-500"
                    }`}
                    title={`Availability: ${driver.availabilityStatus}`}
                  >
                    {driver.availabilityStatus === "AVAILABLE"
                      ? "ONLINE"
                      : driver.availabilityStatus === "BUSY"
                      ? "ON A RIDE"
                      : "OFFLINE"}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-3 text-xs sm:text-sm text-stone-600 flex-wrap">
                <span className="font-semibold text-stone-900 flex items-center gap-1">
                  <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                  {driver.rating && driver.rating > 0 ? Number(driver.rating).toFixed(1) : "0.0"}
                </span>
                <span>·</span>
                <span>{driver.totalTrips || 0} completed rides</span>
                <span>·</span>
                <span>Registered {formatDate(driver.createdAt || driver.user?.createdAt)}</span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2.5 shrink-0 self-start sm:self-center flex-wrap">
            {isPending && (
              <>
                <button
                  type="button"
                  disabled={actionInProgress}
                  onClick={() => setRejectModalOpen(true)}
                  className="px-4 py-2 rounded-lg border border-rose-200/90 bg-white text-rose-600 hover:bg-rose-50 text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50 shadow-2xs"
                >
                  Reject
                </button>
                <button
                  type="button"
                  disabled={actionInProgress}
                  onClick={handleVerify}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-black hover:bg-neutral-800 text-white text-xs font-semibold transition-colors cursor-pointer shadow-xs disabled:opacity-50"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Approve</span>
                </button>
              </>
            )}

            {isVerified && (
              <>
                <div className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-100/90 border border-emerald-300 text-emerald-900 text-xs font-semibold shadow-2xs">
                  <ShieldCheck className="w-4 h-4 text-emerald-700" />
                  <span>Verified Partner</span>
                </div>
                <button
                  type="button"
                  disabled={actionInProgress}
                  onClick={() => setSuspendModalOpen(true)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-900 text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50 shadow-2xs"
                  title="Suspend Driver"
                >
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-700" />
                  <span>Suspend</span>
                </button>
              </>
            )}

            {isSuspended && (
              <>
                <div className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-amber-100 border border-amber-300 text-amber-900 text-xs font-semibold shadow-2xs">
                  <AlertTriangle className="w-4 h-4 text-amber-700" />
                  <span>Suspended Partner</span>
                </div>
                <button
                  type="button"
                  disabled={actionInProgress}
                  onClick={handleActivate}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50 shadow-2xs"
                  title="Re-activate Driver"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Re-Activate Driver</span>
                </button>
              </>
            )}

            {isRejected && (
              <button
                type="button"
                disabled={actionInProgress}
                onClick={handleVerify}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-stone-300 bg-white text-stone-700 hover:bg-stone-50 text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50 shadow-2xs"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Re-Approve</span>
              </button>
            )}

            {/* Edit Driver Profile Button (Yellow background) */}
            <button
              type="button"
              disabled={actionInProgress}
              onClick={openEditModal}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-amber-400 hover:bg-amber-500 border border-amber-500/80 text-stone-950 text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50 shadow-2xs active:scale-[0.98]"
              title="Edit Driver Profile"
            >
              <Pencil className="w-3.5 h-3.5 text-stone-950" />
              <span>Edit Profile</span>
            </button>

            {/* Delete Driver Profile Button (Red background) */}
            <button
              type="button"
              disabled={actionInProgress}
              onClick={() => setDeleteModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 border border-rose-700 text-white text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50 shadow-2xs active:scale-[0.98]"
              title="Delete Driver Profile"
            >
              <Trash2 className="w-3.5 h-3.5 text-white" />
              <span>Delete Profile</span>
            </button>
          </div>
        </div>

        {/* Suspension Notice if suspended */}
        {isSuspended && driver.suspensionReason && (
          <div className="mt-5 p-4 rounded-2xl bg-amber-50 border border-amber-200 flex items-start gap-3">
            <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
            <div className="text-xs">
              <span className="font-semibold text-amber-900">Suspension Reason: </span>
              <span className="text-amber-800">{driver.suspensionReason}</span>
              {driver.suspendedAt && (
                <span className="text-amber-600 ml-2">
                  (Suspended on {new Date(driver.suspendedAt).toLocaleDateString()})
                </span>
              )}
            </div>
          </div>
        )}

        {/* Rejection Notice if rejected */}
        {isRejected && driver.rejectionReason && (
          <div className="mt-5 p-4 rounded-2xl bg-rose-50 border border-rose-200 flex items-start gap-3">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div className="text-xs">
              <span className="font-semibold text-rose-900">Rejection Reason: </span>
              <span className="text-rose-800">{driver.rejectionReason}</span>
            </div>
          </div>
        )}
      </div>

      {/* 2. 2-COLUMN GRID OF DETAILS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* CARD 1: PERSONAL DETAILS */}
        <div className="rounded-3xl bg-white border border-[#EDEDE8] shadow-xs p-6 sm:p-8 space-y-5">
          <div className="flex items-center justify-between border-b border-[#EDEDE8] pb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-stone-100 border border-stone-200/80 flex items-center justify-center text-stone-700">
                <User className="w-4 h-4" />
              </div>
              <h2 className="font-caslon text-xl font-bold text-stone-900">
                Personal Details
              </h2>
            </div>
          </div>

          {/* 1 Data per Line without background */}
          <div className="divide-y divide-[#F0EFEA] text-xs sm:text-sm">
            {/* Full Name */}
            <div className="py-3 flex items-center justify-between gap-4">
              <div className="flex items-center gap-2.5 text-stone-500">
                <User className="w-4 h-4 text-stone-400 shrink-0" />
                <span className="text-stone-500">Full Name</span>
              </div>
              <span className="text-stone-800 text-right">
                {driver.name}
              </span>
            </div>

            {/* Email Address */}
            <div className="py-3 flex items-center justify-between gap-4">
              <div className="flex items-center gap-2.5 text-stone-500">
                <Mail className="w-4 h-4 text-stone-400 shrink-0" />
                <span className="text-stone-500">Email Address</span>
              </div>
              <a
                href={`mailto:${driver.email}`}
                className="text-stone-800 hover:underline text-right truncate"
                title={driver.email}
              >
                {driver.email || "—"}
              </a>
            </div>

            {/* Phone Number */}
            <div className="py-3 flex items-center justify-between gap-4">
              <div className="flex items-center gap-2.5 text-stone-500">
                <Phone className="w-4 h-4 text-stone-400 shrink-0" />
                <span className="text-stone-500">Phone Number</span>
              </div>
              <span className="font-mono text-stone-800 text-right">
                {driver.phone || "—"}
              </span>
            </div>

            {/* Date of Birth */}
            <div className="py-3 flex items-center justify-between gap-4">
              <div className="flex items-center gap-2.5 text-stone-500">
                <CalendarDays className="w-4 h-4 text-stone-400 shrink-0" />
                <span className="text-stone-500">Date of Birth</span>
              </div>
              <span className="text-stone-800 text-right">
                {formatDate(driver.dateOfBirth)}
              </span>
            </div>

            {/* Gender */}
            <div className="py-3 flex items-center justify-between gap-4">
              <div className="flex items-center gap-2.5 text-stone-500">
                <Shield className="w-4 h-4 text-stone-400 shrink-0" />
                <span className="text-stone-500">Gender</span>
              </div>
              <span className="text-stone-800 uppercase text-right">
                {driver.gender || "Not specified"}
              </span>
            </div>

            {/* Driving License */}
            <div className="py-3 flex items-center justify-between gap-4">
              <div className="flex items-center gap-2.5 text-stone-500">
                <FileBadge className="w-4 h-4 text-stone-400 shrink-0" />
                <span className="text-stone-500">Driving License (DL)</span>
              </div>
              <span className="font-mono text-stone-800 text-right">
                {driver.licenseNumber}
              </span>
            </div>

            {/* Registration Plate */}
            {driver.vehicle && (
              <div className="py-3 flex items-center justify-between gap-4">
                <div className="flex items-center gap-2.5 text-stone-500">
                  <FileBadge className="w-4 h-4 text-stone-400 shrink-0" />
                  <span className="text-stone-500">Registration Plate</span>
                </div>
                <span className="font-mono text-stone-800 text-right">
                  {driver.vehicle.registrationNumber}
                </span>
              </div>
            )}

            {/* Vehicle Type */}
            {driver.vehicle && (
              <div className="py-3 flex items-center justify-between gap-4">
                <div className="flex items-center gap-2.5 text-stone-500">
                  <Car className="w-4 h-4 text-stone-400 shrink-0" />
                  <span className="text-stone-500">Vehicle Type</span>
                </div>
                <span className="text-stone-800 text-right uppercase">
                  {driver.vehicle.vehicleType}
                </span>
              </div>
            )}

            {/* Registration Date */}
            <div className="py-3 flex items-center justify-between gap-4">
              <div className="flex items-center gap-2.5 text-stone-500">
                <Calendar className="w-4 h-4 text-stone-400 shrink-0" />
                <span className="text-stone-500">Registration Date</span>
              </div>
              <span className="text-stone-800 text-right">
                {formatDate(driver.createdAt || driver.user?.createdAt)}
              </span>
            </div>

            {/* Role */}
            <div className="py-3 flex items-center justify-between gap-4">
              <div className="flex items-center gap-2.5 text-stone-500">
                <BadgeCheck className="w-4 h-4 text-stone-400 shrink-0" />
                <span className="text-stone-500">Role</span>
              </div>
              <span className="text-stone-800 text-right">
                Driver Partner
              </span>
            </div>


          </div>
        </div>

        {/* CARD 2: VEHICLE & REGISTRATION DETAILS */}
        <div className="rounded-3xl bg-white border border-[#EDEDE8] shadow-xs p-6 sm:p-8 space-y-5">
          <div className="flex items-center justify-between border-b border-[#EDEDE8] pb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-stone-100 border border-stone-200/80 flex items-center justify-center text-stone-700">
                <Car className="w-4 h-4" />
              </div>
              <h2 className="font-caslon text-xl font-bold text-stone-900">
                Vehicle Information
              </h2>
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400 px-2 py-0.5 rounded-md bg-[#FBFBFA]">
              Fleet
            </span>
          </div>

          {driver.vehicle ? (
            <div className="space-y-4">
              {/* Vehicle Photo Showcase */}
              {driver.vehicle.vehicleImage ? (
                <div className="relative w-full h-52 sm:h-60 rounded-2xl overflow-hidden border border-[#EDEDE8] bg-stone-950 shadow-2xs group">
                  <img
                    src={driver.vehicle.vehicleImage}
                    alt={`${driver.vehicle.make} ${driver.vehicle.model}`}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ease-out"
                    style={{ objectPosition: "center 30%" }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent flex flex-col justify-end p-4 pointer-events-none">
                    {/* Bottom vehicle info */}
                    <div>
                      <span className="text-white text-base font-semibold drop-shadow-xs block">
                        {driver.vehicle.make} {driver.vehicle.model}
                      </span>
                      <span className="text-white/70 text-xs font-mono">
                        {driver.vehicle.registrationNumber}
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="relative w-full p-5 sm:p-6 rounded-2xl border border-dashed border-stone-300 bg-[#FAFAF8] flex flex-col items-center justify-center text-center space-y-3.5">
                  <div className="w-12 h-12 rounded-2xl bg-white border border-[#EDEDE8] flex items-center justify-center text-stone-400 shadow-2xs">
                    <Car className="w-5 h-5 text-stone-500" />
                  </div>
                  <div>
                    <span className="text-sm font-bold text-stone-900 block">No Vehicle Photo Uploaded</span>
                    <p className="text-xs text-stone-500 mt-0.5 max-w-xs">
                      Choose any local image from your device to save locally and show on website
                    </p>
                  </div>

                  {/* Primary Local Upload Button */}
                  <label className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-stone-900 hover:bg-black text-white text-xs font-semibold cursor-pointer transition-colors shadow-xs">
                    <Camera className="w-4 h-4 text-white" />
                    <span>{isUploadingVehiclePhoto ? "Saving & Syncing..." : "Choose Local Image"}</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="sr-only"
                      disabled={isUploadingVehiclePhoto}
                      onChange={handleDirectVehiclePhotoUpload}
                    />
                  </label>

                  {/* Preset Quick Select */}
                  <div className="pt-2 border-t border-stone-200/80 w-full max-w-sm">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400 block mb-2">
                      Or select sample vehicle preset
                    </span>
                    <div className="grid grid-cols-3 gap-1.5">
                      {VEHICLE_PRESETS.map((preset) => (
                        <button
                          key={preset.name}
                          type="button"
                          onClick={() => handleSelectVehiclePreset(preset.url, preset.name)}
                          className="px-2 py-1.5 rounded-lg border border-stone-200 bg-white hover:bg-stone-100 hover:border-stone-400 text-stone-700 text-[11px] font-medium transition-colors cursor-pointer truncate shadow-2xs"
                          title={preset.name}
                        >
                          {preset.badge}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}



              {/* Vehicle Specs List (1 data per line without bg) */}
              <div className="divide-y divide-[#F0EFEA] text-xs sm:text-sm">
                <div className="py-3 flex items-center justify-between gap-4">
                  <span className="text-stone-500">Make &amp; Model</span>
                  <span className="text-stone-800 text-right truncate">
                    {driver.vehicle.make} {driver.vehicle.model}
                  </span>
                </div>

                <div className="py-3 flex items-center justify-between gap-4">
                  <span className="text-stone-500">Manufacturing Year</span>
                  <span className="text-stone-800 text-right">
                    {driver.vehicle.year || "—"}
                  </span>
                </div>

                <div className="py-3 flex items-center justify-between gap-4">
                  <span className="text-stone-500">Color</span>
                  <span className="text-stone-800 text-right">
                    {driver.vehicle.color || "—"}
                  </span>
                </div>



                {/* Vehicle Photo Link */}
                <div className="py-3 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2.5 text-stone-500">
                    <Camera className="w-4 h-4 text-stone-400 shrink-0" />
                    <span className="text-stone-500">Vehicle Photo Link</span>
                  </div>
                  <div>
                    {driver.vehicle.vehicleImage ? (
                      <a
                        href={driver.vehicle.vehicleImage}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs text-stone-900 hover:text-black font-mono font-medium underline underline-offset-2 truncate max-w-[200px]"
                        title={driver.vehicle.vehicleImage}
                      >
                        <span className="truncate">{driver.vehicle.vehicleImage}</span>
                        <ExternalLink className="w-3 h-3 shrink-0 text-stone-500" />
                      </a>
                    ) : (
                      <span className="text-stone-400 text-xs">Not uploaded</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* Beautiful Empty State */
            <div className="p-8 sm:p-10 rounded-2xl border-2 border-dashed border-stone-200/90 bg-[#FBFBFA] flex flex-col items-center justify-center text-center space-y-3">
              <div className="w-14 h-14 rounded-2xl bg-white border border-[#EDEDE8] flex items-center justify-center text-stone-400 shadow-2xs">
                <Car className="w-6 h-6 text-stone-400" />
              </div>
              <div className="space-y-1">
                <h3 className="font-caslon text-base font-bold text-stone-800">
                  No Vehicle Registered
                </h3>
                <p className="text-xs text-stone-500 max-w-xs leading-relaxed">
                  The driver partner has not yet added vehicle details to their profile. Vehicles can be reviewed once submitted.
                </p>
              </div>
              <span className="inline-block px-3 py-1 rounded-full bg-stone-100 text-stone-600 text-[10px] font-bold uppercase tracking-wider border border-stone-200">
                Unassigned Fleet
              </span>
            </div>
          )}
        </div>
      </div>

      {/* 3. VERIFICATION DOCUMENTS (KYC & LEGAL) */}
      {(() => {
        const dlDoc = driver.documents?.find((d) => d.documentType === "DRIVING_LICENSE");
        const aadhaarDoc = driver.documents?.find((d) => d.documentType === "AADHAAR");

        const isDlVerified = dlDoc?.verificationStatus === "VERIFIED" || (driver.verificationStatus === "VERIFIED" && !dlDoc);
        const isAadhaarVerified = aadhaarDoc?.verificationStatus === "VERIFIED";

        const formatAadhaar = (val: string) => {
          const clean = val.replace(/\D/g, "");
          if (clean.length === 12) {
            return `${clean.slice(0, 4)} ${clean.slice(4, 8)} ${clean.slice(8, 12)}`;
          }
          return val;
        };

        return (
          <div className="rounded-3xl bg-white border border-[#EDEDE8] shadow-xs p-6 sm:p-8 space-y-6">
            {/* Section Header */}
            <div
              onClick={() => setKycOpen((o) => !o)}
              className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer select-none ${
                kycOpen ? "border-b border-[#EDEDE8] pb-5" : ""
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-stone-100 border border-stone-200/80 flex items-center justify-center text-stone-800 shrink-0">
                  <ShieldCheck className="w-5 h-5 text-emerald-700" />
                </div>
                <div>
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <h2 className="font-caslon text-xl sm:text-2xl font-bold text-stone-900 tracking-tight">
                      Driver KYC &amp; Verification Documents
                    </h2>
                  </div>
                  <p className="text-xs text-stone-500 mt-0.5">
                    Government identity (UIDAI) and motor vehicle driving license verification
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setKycOpen((o) => !o);
                }}
                aria-expanded={kycOpen}
                aria-label={kycOpen ? "Hide KYC documents" : "Show KYC documents"}
                className="self-end sm:self-center inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#EDEDE8] bg-white text-stone-600 transition-colors hover:bg-stone-50 hover:text-black"
              >
                <ChevronDown className={`w-4 h-4 transition-transform duration-300 ${kycOpen ? "rotate-180" : ""}`} />
              </button>
            </div>

            {kycOpen && (
              <div className="space-y-6">
            {/* 2-Column Grid: Aadhaar Card & Driving License */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5">
              {/* CARD 1: AADHAAR CARD (UIDAI) */}
              <div className="rounded-2xl border border-[#EDEDE8] bg-[#FBFBFA] hover:border-stone-300 transition-all flex flex-col justify-between overflow-hidden shadow-2xs">
                {/* Card Top Banner / Agency Header */}
                <div className="px-4 py-3 border-b border-[#F0EFEA] flex items-center justify-between gap-2.5">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-white border border-[#E4E3DD] flex items-center justify-center text-stone-800 shadow-2xs shrink-0">
                      <FileText className="w-4 h-4 text-amber-600" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <h3 className="text-xs sm:text-sm font-bold text-stone-900 truncate">
                          Aadhaar Card (UIDAI)
                        </h3>
                        <span className="text-[9px] font-bold text-stone-400 bg-stone-200/60 px-1.5 py-0.2 rounded shrink-0">
                          Govt of India
                        </span>
                      </div>
                      <span className="text-[11px] text-stone-400 block truncate">
                        Primary National Identity &amp; Biometric KYC
                      </span>
                    </div>
                  </div>

                  {/* Status Pill */}
                  {aadhaarDoc ? (
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold shrink-0 ${
                        isAadhaarVerified
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                          : aadhaarDoc.verificationStatus === "PENDING"
                          ? "bg-amber-50 text-amber-700 border border-amber-200"
                          : "bg-rose-50 text-rose-700 border border-rose-200"
                      }`}
                    >
                      {isAadhaarVerified ? (
                        <CheckCircle2 className="w-2.5 h-2.5" />
                      ) : (
                        <Clock className="w-2.5 h-2.5" />
                      )}
                      <span>{aadhaarDoc.verificationStatus}</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-stone-200/60 text-stone-600 border border-stone-300/60 shrink-0">
                      NOT SUBMITTED
                    </span>
                  )}
                </div>

                {/* Card Middle: Preview & Number */}
                <div className="p-3.5 space-y-2.5 flex-1">
                  {/* Document Scan Showcase */}
                  {aadhaarDoc?.documentUrl && isValidImageUrl(aadhaarDoc.documentUrl) ? (
                    <div className="relative w-full h-32 sm:h-36 rounded-xl overflow-hidden border border-[#E6E5DF] bg-stone-950 group shadow-2xs">
                      <img
                        src={aadhaarDoc.documentUrl}
                        alt="Aadhaar Card Document"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                      {/* Hover Overlay with Inspect Button */}
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            setDocPreviewModal({
                              open: true,
                              title: "Aadhaar Card (UIDAI)",
                              subtitle: "Government of India · Unique Identification Authority",
                              number: aadhaarDoc.documentNumber,
                              url: aadhaarDoc.documentUrl,
                              status: aadhaarDoc.verificationStatus,
                              type: "AADHAAR",
                              id: aadhaarDoc._id || aadhaarDoc.id,
                            })
                          }
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white text-stone-900 text-xs font-semibold shadow-md hover:bg-stone-100 cursor-pointer"
                        >
                          <Eye className="w-3 h-3 text-stone-800" />
                          <span>Inspect</span>
                        </button>
                        <a
                          href={aadhaarDoc.documentUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-7 h-7 rounded-lg bg-white/20 hover:bg-white/30 text-white flex items-center justify-center backdrop-blur-xs transition-colors"
                          title="Open original file"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      </div>
                      <div className="absolute bottom-1.5 left-2 px-1.5 py-0.5 rounded bg-black/60 backdrop-blur-xs text-[9px] text-white/90 font-mono">
                        Aadhaar ID Scan
                      </div>
                    </div>
                  ) : (
                    /* Read-Only Empty State */
                    <div className="w-full px-3.5 py-2.5 rounded-xl border border-dashed border-stone-200 bg-[#F5F4EF] flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-7 h-7 rounded-lg bg-white border border-stone-200/80 flex items-center justify-center text-stone-400 shrink-0">
                          <FileText className="w-3.5 h-3.5" />
                        </div>
                        <div className="min-w-0">
                          <span className="text-xs font-semibold text-stone-700 block truncate">
                            No Aadhaar scan uploaded
                          </span>
                          <span className="text-[10px] text-stone-400 block truncate">
                            Driver has not submitted UIDAI scan yet
                          </span>
                        </div>
                      </div>
                      <span className="text-[10px] font-semibold text-stone-500 bg-white border border-stone-200 px-2 py-0.5 rounded-md shrink-0">
                        Pending Driver
                      </span>
                    </div>
                  )}

                  {/* Document Number Display */}
                  <div className="px-3 py-1.5 rounded-xl bg-white border border-[#EDEDE8] flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <span className="text-[9px] font-bold uppercase tracking-wider text-stone-400 block">
                        Aadhaar Number (UIDAI)
                      </span>
                      <span className="font-mono text-xs sm:text-sm font-bold text-stone-900 tracking-wider block mt-0.5 truncate">
                        {aadhaarDoc?.documentNumber
                          ? formatAadhaar(aadhaarDoc.documentNumber)
                          : "Not submitted yet"}
                      </span>
                    </div>

                    {aadhaarDoc?.documentNumber && (
                      <button
                        type="button"
                        onClick={() =>
                          copyToClipboard(aadhaarDoc.documentNumber, "Aadhaar Number")
                        }
                        className="w-6 h-6 rounded-md border border-stone-200 hover:bg-stone-100 flex items-center justify-center text-stone-500 hover:text-stone-900 transition-colors cursor-pointer shrink-0"
                        title="Copy Aadhaar Number"
                      >
                        {copiedDoc === "Aadhaar Number" ? (
                          <CheckCheck className="w-3 h-3 text-emerald-600" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                      </button>
                    )}
                  </div>
                </div>

                {/* Card Footer: Admin Actions (Verify Only) */}
                <div className="px-3.5 py-2.5 bg-white border-t border-[#EDEDE8] flex items-center justify-end min-h-[44px]">
                  {aadhaarDoc && (aadhaarDoc._id || aadhaarDoc.id) && !isAadhaarVerified ? (
                    <button
                      type="button"
                      disabled={actionInProgress}
                      onClick={() =>
                        handleUpdateDocStatus(
                          (aadhaarDoc._id || aadhaarDoc.id) as string,
                          "VERIFIED"
                        )
                      }
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition-colors cursor-pointer shadow-2xs"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Verify</span>
                    </button>
                  ) : isAadhaarVerified ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-semibold">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Verified</span>
                    </span>
                  ) : (
                    <span className="text-xs text-stone-400">Not submitted</span>
                  )}
                </div>
              </div>

              {/* CARD 2: DRIVING LICENSE (DL) */}
              <div className="rounded-2xl border border-[#EDEDE8] bg-[#FBFBFA] hover:border-stone-300 transition-all flex flex-col justify-between overflow-hidden shadow-2xs">
                {/* Card Top Banner / Agency Header */}
                <div className="px-4 py-3 border-b border-[#F0EFEA] flex items-center justify-between gap-2.5">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-white border border-[#E4E3DD] flex items-center justify-center text-stone-800 shadow-2xs shrink-0">
                      <FileBadge className="w-4 h-4 text-emerald-600" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <h3 className="text-xs sm:text-sm font-bold text-stone-900 truncate">
                          Driving License (DL)
                        </h3>
                        <span className="text-[9px] font-bold text-stone-400 bg-stone-200/60 px-1.5 py-0.2 rounded shrink-0">
                          MoRTH
                        </span>
                      </div>
                      <span className="text-[11px] text-stone-400 block truncate">
                        Ministry of Road Transport &amp; Highways · Commercial / LMV
                      </span>
                    </div>
                  </div>

                  {/* Status Pill */}
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold shrink-0 ${
                      isDlVerified
                        ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                        : dlDoc?.verificationStatus === "PENDING"
                        ? "bg-amber-50 text-amber-700 border border-amber-200"
                        : "bg-rose-50 text-rose-700 border border-rose-200"
                    }`}
                  >
                    {isDlVerified ? (
                      <CheckCircle2 className="w-2.5 h-2.5" />
                    ) : (
                      <Clock className="w-2.5 h-2.5" />
                    )}
                    <span>{dlDoc?.verificationStatus || driver.verificationStatus || "RECORDED"}</span>
                  </span>
                </div>

                {/* Card Middle: Preview & Number */}
                <div className="p-3.5 space-y-2.5 flex-1">
                  {/* Document Scan Showcase */}
                  {dlDoc?.documentUrl && isValidImageUrl(dlDoc.documentUrl) ? (
                    <div className="relative w-full h-32 sm:h-36 rounded-xl overflow-hidden border border-[#E6E5DF] bg-stone-950 group shadow-2xs">
                      <img
                        src={dlDoc.documentUrl}
                        alt="Driving License Document"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                      {/* Hover Overlay with Inspect Button */}
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            setDocPreviewModal({
                              open: true,
                              title: "Driving License (DL)",
                              subtitle: "Ministry of Road Transport & Highways · Government of India",
                              number: dlDoc.documentNumber || driver.licenseNumber,
                              url: dlDoc.documentUrl,
                              status: dlDoc.verificationStatus,
                              type: "DRIVING_LICENSE",
                              id: dlDoc._id || dlDoc.id,
                            })
                          }
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white text-stone-900 text-xs font-semibold shadow-md hover:bg-stone-100 cursor-pointer"
                        >
                          <Eye className="w-3 h-3 text-stone-800" />
                          <span>Inspect</span>
                        </button>
                        <a
                          href={dlDoc.documentUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-7 h-7 rounded-lg bg-white/20 hover:bg-white/30 text-white flex items-center justify-center backdrop-blur-xs transition-colors"
                          title="Open original file"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      </div>
                      <div className="absolute bottom-1.5 left-2 px-1.5 py-0.5 rounded bg-black/60 backdrop-blur-xs text-[9px] text-white/90 font-mono">
                        Official DL Scan
                      </div>
                    </div>
                  ) : (
                    /* Read-Only Empty State */
                    <div className="w-full px-3.5 py-2.5 rounded-xl border border-dashed border-stone-200 bg-[#F5F4EF] flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-7 h-7 rounded-lg bg-white border border-stone-200/80 flex items-center justify-center text-stone-400 shrink-0">
                          <FileBadge className="w-3.5 h-3.5" />
                        </div>
                        <div className="min-w-0">
                          <span className="text-xs font-semibold text-stone-700 block truncate">
                            DL recorded in profile
                          </span>
                          <span className="text-[10px] text-stone-400 block truncate">
                            Scan pending driver upload
                          </span>
                        </div>
                      </div>
                      <span className="text-[10px] font-semibold text-stone-500 bg-white border border-stone-200 px-2 py-0.5 rounded-md shrink-0">
                        Pending Driver
                      </span>
                    </div>
                  )}

                  {/* Document Number Display */}
                  <div className="px-3 py-1.5 rounded-xl bg-white border border-[#EDEDE8] flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <span className="text-[9px] font-bold uppercase tracking-wider text-stone-400 block">
                        License Number (DL)
                      </span>
                      <span className="font-mono text-xs sm:text-sm font-bold text-stone-900 tracking-wider block mt-0.5 truncate">
                        {dlDoc?.documentNumber || driver.licenseNumber || "Not recorded"}
                      </span>
                    </div>

                    {(dlDoc?.documentNumber || driver.licenseNumber) && (
                      <button
                        type="button"
                        onClick={() =>
                          copyToClipboard(
                            dlDoc?.documentNumber || driver.licenseNumber,
                            "Driving License Number"
                          )
                        }
                        className="w-6 h-6 rounded-md border border-stone-200 hover:bg-stone-100 flex items-center justify-center text-stone-500 hover:text-stone-900 transition-colors cursor-pointer shrink-0"
                        title="Copy License Number"
                      >
                        {copiedDoc === "Driving License Number" ? (
                          <CheckCheck className="w-3 h-3 text-emerald-600" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                      </button>
                    )}
                  </div>
                </div>

                {/* Card Footer: Admin Actions (Verify Only) */}
                <div className="px-3.5 py-2.5 bg-white border-t border-[#EDEDE8] flex items-center justify-end min-h-[44px]">
                  {dlDoc && (dlDoc._id || dlDoc.id) && !isDlVerified ? (
                    <button
                      type="button"
                      disabled={actionInProgress}
                      onClick={() =>
                        handleUpdateDocStatus(
                          (dlDoc._id || dlDoc.id) as string,
                          "VERIFIED"
                        )
                      }
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition-colors cursor-pointer shadow-2xs"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Verify</span>
                    </button>
                  ) : isDlVerified ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-semibold">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Verified</span>
                    </span>
                  ) : (
                    <span className="text-xs text-stone-400">Not recorded</span>
                  )}
                </div>
              </div>
            </div>

            {/* Additional Documents if any */}
            {driver.documents &&
              driver.documents.filter(
                (d) => d.documentType !== "DRIVING_LICENSE" && d.documentType !== "AADHAAR"
              ).length > 0 && (
                <div className="pt-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400 block mb-3">
                    Additional Submitted Credentials
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {driver.documents
                      .filter(
                        (d) =>
                          d.documentType !== "DRIVING_LICENSE" &&
                          d.documentType !== "AADHAAR"
                      )
                      .map((doc, idx) => (
                        <div
                          key={doc.id || doc._id || idx}
                          className="p-4 rounded-2xl border border-[#EDEDE8] bg-[#FBFBFA] space-y-2"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-xs text-stone-900">
                              {doc.documentType.replace("_", " ")}
                            </span>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-stone-100 text-stone-700">
                              {doc.verificationStatus}
                            </span>
                          </div>
                          <span className="font-mono text-xs text-stone-700 block">
                            {doc.documentNumber}
                          </span>
                          {doc.documentUrl && (
                            <a
                              href={doc.documentUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 text-xs text-stone-800 hover:text-black font-semibold underline underline-offset-2 pt-1"
                            >
                              <span>View File</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                        </div>
                      ))}
                  </div>
                </div>
              )}
              </div>
            )}
          </div>
        );
      })()}

      {/* 4. RIDE HISTORY & COMPLETED TRIPS TABLE */}
      <div className="rounded-3xl bg-white border border-[#EDEDE8] shadow-xs p-6 sm:p-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#EDEDE8] pb-5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-stone-100 border border-stone-200/80 flex items-center justify-center text-stone-700 shrink-0">
              <Route className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-caslon text-xl font-bold text-stone-900">
                  Rides &amp; Trip History
                </h2>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-stone-100 text-stone-700">
                  {(driver.rides?.length ?? driver.totalTrips ?? 0)} Total
                </span>
              </div>
              <p className="text-xs text-stone-500">
                Detailed record of all trips assigned to and completed by this driver partner
              </p>
            </div>
          </div>

          {/* Quick Metrics Bar */}
          <div className="flex items-center gap-3">
            <div className="px-3.5 py-1.5 rounded-2xl bg-[#FBFBFA] border border-[#EDEDE8] text-right">
              <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400 block">
                Completed
              </span>
              <span className="text-xs font-bold text-emerald-700">
                {driver.rides?.filter((r) => r.status === "RIDE_COMPLETED").length ?? driver.totalTrips ?? 0} Trips
              </span>
            </div>
            <div className="px-3.5 py-1.5 rounded-2xl bg-[#FBFBFA] border border-[#EDEDE8] text-right">
              <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400 block">
                Total Earnings
              </span>
              <span className="text-xs font-bold text-stone-900">
                ₹{driver.rides?.filter((r) => r.status === "RIDE_COMPLETED").reduce((sum, r) => sum + (r.fare || 0), 0).toLocaleString("en-IN") || "0"}
              </span>
            </div>
          </div>
        </div>

        {/* Filter Pills if rides exist */}
        {driver.rides && driver.rides.length > 0 && (
          <div className="flex items-center gap-2 text-xs">
            <button
              type="button"
              onClick={() => setRideFilter("ALL")}
              className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${
                rideFilter === "ALL"
                  ? "bg-stone-900 text-white font-semibold"
                  : "bg-stone-100 text-stone-600 hover:bg-stone-200"
              }`}
            >
              All Rides ({driver.rides.length})
            </button>
            <button
              type="button"
              onClick={() => setRideFilter("COMPLETED")}
              className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${
                rideFilter === "COMPLETED"
                  ? "bg-emerald-800 text-white font-semibold"
                  : "bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
              }`}
            >
              Completed ({driver.rides.filter((r) => r.status === "RIDE_COMPLETED").length})
            </button>
            <button
              type="button"
              onClick={() => setRideFilter("CANCELLED")}
              className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${
                rideFilter === "CANCELLED"
                  ? "bg-rose-800 text-white font-semibold"
                  : "bg-rose-50 text-rose-800 hover:bg-rose-100"
              }`}
            >
              Cancelled ({driver.rides.filter((r) => r.status === "CANCELLED").length})
            </button>
          </div>
        )}

        {/* Table / Empty State */}
        {(() => {
          const allRides = driver.rides || [];
          const filteredRides = allRides.filter((r) => {
            if (rideFilter === "COMPLETED") return r.status === "RIDE_COMPLETED";
            if (rideFilter === "CANCELLED") return r.status === "CANCELLED";
            return true;
          });

          if (allRides.length === 0) {
            return (
              <div className="rounded-2xl border border-dashed border-[#EDEDE8] bg-[#FBFBFA] py-14 px-6 text-center">
                <div className="w-14 h-14 rounded-2xl bg-white border border-[#EDEDE8] flex items-center justify-center mx-auto mb-3.5 shadow-2xs text-stone-400">
                  <Car className="w-6 h-6" />
                </div>
                <h3 className="font-caslon text-lg font-bold text-stone-900 mb-1">
                  No Rides Recorded Yet
                </h3>
                <p className="text-xs text-stone-500 max-w-md mx-auto mb-4">
                  This driver partner has not completed any rides yet. Assigned bookings, live trips, and completed rides will be automatically cataloged in this table.
                </p>
                <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-stone-100 border border-stone-200 text-stone-600 text-xs font-semibold">
                  <span>0 Total Trips Completed</span>
                </div>
              </div>
            );
          }

          if (filteredRides.length === 0) {
            return (
              <div className="py-12 text-center text-xs text-stone-500">
                No rides match the selected filter.
              </div>
            );
          }

          return (
            <div className="overflow-x-auto rounded-2xl border border-[#EDEDE8]">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#EDEDE8] bg-[#FBFBFA] text-[11px] font-bold uppercase tracking-wider text-stone-500">
                    <th className="py-3 px-4">Trip ID &amp; Date</th>
                    <th className="py-3 px-4">Customer</th>
                    <th className="py-3 px-4">Route Details</th>
                    <th className="py-3 px-4">Vehicle &amp; Distance</th>
                    <th className="py-3 px-4">Fare</th>
                    <th className="py-3 px-4 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EDEDE8] text-xs">
                  {filteredRides.map((ride) => {
                    const isCompleted = ride.status === "RIDE_COMPLETED";
                    const isCancelled = ride.status === "CANCELLED";
                    const formattedDate = ride.createdAt
                      ? new Date(ride.createdAt).toLocaleString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "—";

                    return (
                      <tr key={ride.id} className="hover:bg-[#FBFBFA]/80 transition-colors">
                        {/* 1. Trip ID & Date */}
                        <td className="py-3.5 px-4 align-top whitespace-nowrap">
                          <span className="font-mono font-bold text-stone-900 block">
                            #{ride.id.slice(-6).toUpperCase()}
                          </span>
                          <span className="text-[11px] text-stone-400 block mt-0.5">
                            {formattedDate}
                          </span>
                        </td>

                        {/* 2. Customer */}
                        <td className="py-3.5 px-4 align-top">
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-lg bg-stone-100 border border-stone-200 flex items-center justify-center text-stone-700 font-bold text-xs shrink-0">
                              {ride.passenger?.name?.charAt(0).toUpperCase() || "P"}
                            </div>
                            <div className="min-w-0">
                              <span className="font-semibold text-stone-900 block truncate">
                                {ride.passenger?.name || "Customer"}
                              </span>
                              <span className="text-[11px] text-stone-400 block truncate">
                                {ride.passenger?.phone || ride.passenger?.email || "—"}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* 3. Route */}
                        <td className="py-3.5 px-4 align-top max-w-xs">
                          <div className="space-y-1.5">
                            <div className="flex items-start gap-1.5">
                              <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0 mt-1" />
                              <span className="text-stone-800 line-clamp-1 font-medium" title={ride.pickup?.address}>
                                {ride.pickup?.address || "Pickup location"}
                              </span>
                            </div>
                            <div className="flex items-start gap-1.5">
                              <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0 mt-1" />
                              <span className="text-stone-500 line-clamp-1 text-[11px]" title={ride.destination?.address}>
                                {ride.destination?.address || "Destination"}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* 4. Vehicle & Distance */}
                        <td className="py-3.5 px-4 align-top whitespace-nowrap">
                          <span className="font-semibold text-stone-900 block uppercase tracking-wide text-[11px]">
                            {ride.vehicleType?.replace("_", " ") || "Standard"}
                          </span>
                          <span className="text-[11px] text-stone-400 block mt-0.5">
                            {ride.distanceKm ? `${ride.distanceKm} km` : "—"}{" "}
                            {ride.durationMinutes ? `• ${ride.durationMinutes} mins` : ""}
                          </span>
                        </td>

                        {/* 5. Fare */}
                        <td className="py-3.5 px-4 align-top whitespace-nowrap">
                          <span className="font-bold text-stone-900 text-sm">
                            ₹{ride.fare != null ? ride.fare.toLocaleString("en-IN") : "0"}
                          </span>
                        </td>

                        {/* 6. Status */}
                        <td className="py-3.5 px-4 align-top text-right whitespace-nowrap">
                          <span
                            className={`text-xs font-semibold uppercase ${
                              isCompleted ? "text-emerald-600" : isCancelled ? "text-rose-600" : "text-amber-600"
                            }`}
                          >
                            {isCompleted ? "COMPLETED" : isCancelled ? "CANCELLED" : ride.status.replace(/_/g, " ")}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          );
        })()}
      </div>
    </div>
  );
}

"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  Car,
  ShieldCheck,
  Star,
  Clock,
  TrendingUp,
  MapPin,
  Calendar,
  CreditCard,
  FileText,
  Phone,
  Mail,
  User,
  Edit3,
  CheckCircle2,
  AlertCircle,
  X,
  Power,
  ChevronRight,
  ArrowLeft,
  Sparkles,
  Award,
  DollarSign,
  Heart,
  Navigation,
  FileCheck2,
  Lock,
  Building,
  Check,
  Camera,
  Trash2,
  Plus,
  Upload,
  Eye,
  ExternalLink,
  RefreshCw,
  FileBadge,
} from "lucide-react";
import { API_BASE } from "@/lib/config";


interface ToastItem {
  id: string;
  type: "success" | "error" | "info";
  message: string;
}

interface VehicleData {
  id?: string;
  _id?: string;
  vehicleType: "BIKE" | "AUTO" | "CAB";
  make: string;
  model: string;
  year: number;
  color: string;
  registrationNumber: string;
  vehicleImage?: string | null;
}

export interface DriverDocumentData {
  id?: string;
  _id?: string;
  driverId?: string;
  documentType: "AADHAAR" | "DRIVING_LICENSE";
  documentNumber: string;
  documentUrl: string;
  verificationStatus: "PENDING" | "VERIFIED" | "REJECTED";
  rejectionReason?: string | null;
  verifiedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

interface DriverProfileData {
  id?: string;
  name?: string;
  email?: string;
  phone?: string | null;
  profileImage?: string | null;
  dateOfBirth?: string | null;
  gender?: "MALE" | "FEMALE" | "OTHER" | null;
  licenseNumber?: string | null;
  verificationStatus?: "PENDING" | "VERIFIED" | "REJECTED" | string;
  verifiedAt?: string | null;
  rejectionReason?: string | null;
  availabilityStatus?: "AVAILABLE" | "ON_TRIP" | "OFFLINE" | string;
  createdAt?: string;
}

export default function DriverProfilePage() {
  const [profile, setProfile] = useState<DriverProfileData | null>({
    id: "6ac670bee0fbdd275cb8b1a1",
    name: "Raju Driver",
    email: "softwareintern@diarchgo.com",
    phone: "+918102773833",
    licenseNumber: "BR097826H8HMK03N3303",
    gender: "MALE",
    dateOfBirth: "1995-03-20T00:00:00.000Z",
    verificationStatus: "PENDING",
    availabilityStatus: "OFFLINE",
    createdAt: "2026-10-07T16:17:39.226Z",
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  // Vehicle state (GET/POST/PATCH/DELETE /api/drivers/vehicle) - default blank
  const [vehicle, setVehicle] = useState<VehicleData | null>(null);
  const [isEditingVehicle, setIsEditingVehicle] = useState(false);
  const [isSavingVehicle, setIsSavingVehicle] = useState(false);
  const [isDeleteVehicleModalOpen, setIsDeleteVehicleModalOpen] = useState(false);
  const [isDeletingVehicle, setIsDeletingVehicle] = useState(false);

  // Driver Profile Delete state (DELETE /api/drivers/profile)
  const [isDeleteProfileModalOpen, setIsDeleteProfileModalOpen] = useState(false);
  const [isDeletingProfile, setIsDeletingProfile] = useState(false);

  // Vehicle form fields (default blank)
  const [vType, setVType] = useState<"BIKE" | "AUTO" | "CAB">("CAB");
  const [vMake, setVMake] = useState("");
  const [vModel, setVModel] = useState("");
  const [vYear, setVYear] = useState<number>(new Date().getFullYear());
  const [vColor, setVColor] = useState("");
  const [vRegNumber, setVRegNumber] = useState("");
  const [vImage, setVImage] = useState("");

  // Document state (GET/POST/PATCH /api/drivers/documents)
  const [documents, setDocuments] = useState<DriverDocumentData[]>([]);
  const [failedDocImages, setFailedDocImages] = useState<Record<string, boolean>>({});
  const [isDocModalOpen, setIsDocModalOpen] = useState(false);
  const [activeDocType, setActiveDocType] = useState<"AADHAAR" | "DRIVING_LICENSE">("AADHAAR");
  const [editingDocId, setEditingDocId] = useState<string | null>(null);
  const [docNumberInput, setDocNumberInput] = useState("");
  const [docUrlInput, setDocUrlInput] = useState("");
  const [isSavingDoc, setIsSavingDoc] = useState(false);
  const [docPreviewModal, setDocPreviewModal] = useState<{ url: string; title: string; number: string; status: string } | null>(null);
  const [showAadhaarNumber, setShowAadhaarNumber] = useState(false);

  const isValidImageUrl = (url?: string | null): boolean => {
    if (!url) return false;
    const trimmed = String(url).trim();
    if (!trimmed || trimmed === "null" || trimmed === "undefined") return false;
    if (trimmed.includes("files.example.com") || trimmed.includes("example.com/")) return false;
    return true;
  };

  // Driver editable fields
  const [name, setName] = useState("Raju Driver");
  const [phone, setPhone] = useState("8102773833");
  const [email, setEmail] = useState("softwareintern@diarchgo.com");
  const [licenseNumber, setLicenseNumber] = useState("BR097826H8HMK03N3303");
  const [gender, setGender] = useState<"MALE" | "FEMALE" | "OTHER">("MALE");
  const [dob, setDob] = useState("1995-03-20");
  const [city, setCity] = useState("Patna, Bihar");
  const [emergencyPhone, setEmergencyPhone] = useState("9431098765");
  const [isOnline, setIsOnline] = useState(true);

  // Preference switches
  const [autoAccept, setAutoAccept] = useState(true);
  const [airportTrips, setAirportTrips] = useState(true);
  const [nightShift, setNightShift] = useState(false);

  const showToast = (message: string, type: "success" | "error" | "info" = "info") => {
    if (!message) return;
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // 1. GET /api/drivers/profile
  const fetchDriverProfile = async () => {
    setIsLoading(true);
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
      const storedName = typeof window !== "undefined" ? localStorage.getItem("userName") : null;
      const storedEmail = typeof window !== "undefined" ? localStorage.getItem("userEmail") : null;
      const storedPhone = typeof window !== "undefined" ? localStorage.getItem("userPhone") : null;
      const storedLicense = typeof window !== "undefined" ? localStorage.getItem("userLicenseNumber") : null;

      if (storedName) setName(storedName);
      if (storedEmail) setEmail(storedEmail);
      if (storedPhone) setPhone(storedPhone.replace(/^\+91/, ""));
      if (storedLicense) setLicenseNumber(storedLicense);

      if (!token) {
        setIsLoading(false);
        return;
      }

      const res = await fetch(`${API_BASE}/drivers/profile`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (res.status === 401) {
        // Driver data has been deleted -> clear and redirect to landing page
        if (typeof window !== "undefined") {
          localStorage.clear();
          window.location.href = "/";
        }
        return;
      }

      const json = await res.json().catch(() => ({}));

      if (res.ok && json.success && json.data) {
        setProfile(json.data);
        const localImg = typeof window !== "undefined" ? localStorage.getItem("driver_profile_image") : null;
        const resolvedImg = json.data.profileImage || localImg || "/driveravatar.jpg";
        setAvatarUrl(resolvedImg);
        if (json.data.name) {
          setName(json.data.name);
          if (typeof window !== "undefined") {
            localStorage.setItem("userName", json.data.name);
            window.dispatchEvent(new CustomEvent("userNameUpdated", { detail: { name: json.data.name } }));
          }
        }
        if (json.data.email) setEmail(json.data.email);
        if (json.data.phone) setPhone(json.data.phone.replace(/^\+91/, ""));
        if (json.data.licenseNumber) setLicenseNumber(json.data.licenseNumber);
        if (json.data.gender) setGender(json.data.gender);
        if (json.data.dateOfBirth) setDob(json.data.dateOfBirth.slice(0, 10));
        if (json.data.availabilityStatus) {
          setIsOnline(json.data.availabilityStatus === "AVAILABLE" || json.data.availabilityStatus === "ON_TRIP");
        }
      }
    } catch {
      showToast("Operating with local driver credentials.", "info");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("driver_vehicle_image");
      if (stored === "") {
        localStorage.removeItem("driver_vehicle_image");
      }
    }
    fetchDriverProfile();
    fetchVehicle();
    fetchDocuments();
  }, []);

  // 2. PATCH /api/drivers/profile
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    const cleanPhone = phone.trim().replace(/\D/g, "");
    if (cleanPhone && cleanPhone.length !== 10) {
      showToast("Phone number must be exactly 10 digits.", "error");
      setIsSaving(false);
      return;
    }

    const cleanLicense = licenseNumber.trim().replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
    if (!cleanLicense || cleanLicense.length < 8) {
      showToast("Driving license must be at least 8 alphanumeric characters.", "error");
      setIsSaving(false);
      return;
    }

    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
      const payload: Record<string, any> = {
        name: name.trim(),
        gender,
        licenseNumber: cleanLicense,
      };

      if (avatarUrl && (avatarUrl.startsWith("http://") || avatarUrl.startsWith("https://"))) {
        payload.profileImage = avatarUrl;
      }
      if (cleanPhone) {
        payload.phone = "+91" + cleanPhone;
      }
      if (dob) {
        payload.dateOfBirth = dob;
      }

      if (token) {
        const res = await fetch(`${API_BASE}/drivers/profile`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        });

        const json = await res.json().catch(() => ({}));

        if (res.ok && json.success) {
          setProfile(json.data);
          showToast("Driver profile updated successfully.", "success");
          setIsEditing(false);
          if (typeof window !== "undefined") {
            const updatedName = json.data?.name || payload.name;
            if (updatedName) {
              localStorage.setItem("userName", updatedName);
              window.dispatchEvent(new CustomEvent("userNameUpdated", { detail: { name: updatedName } }));
            }
            if (payload.phone) localStorage.setItem("userPhone", payload.phone);
            localStorage.setItem("userLicenseNumber", cleanLicense);
          }
          return;
        } else if (res.status === 404) {
          // Initialize if not created
          const createRes = await fetch(`${API_BASE}/drivers/profile`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(payload),
          });
          const createJson = await createRes.json().catch(() => ({}));
          if (createRes.ok && createJson.success) {
            setProfile(createJson.data);
            showToast("Driver profile created and saved.", "success");
            setIsEditing(false);
            if (typeof window !== "undefined") {
              const updatedName = createJson.data?.name || payload.name;
              if (updatedName) {
                localStorage.setItem("userName", updatedName);
                window.dispatchEvent(new CustomEvent("userNameUpdated", { detail: { name: updatedName } }));
              }
            }
            return;
          }
        }
      }

      // Local storage fallback
      if (typeof window !== "undefined") {
        localStorage.setItem("userPhone", "+91" + cleanPhone);
        localStorage.setItem("userLicenseNumber", cleanLicense);
      }
      setLicenseNumber(cleanLicense);
      showToast("Driver details saved locally.", "success");
      setIsEditing(false);
    } catch {
      showToast("Network error. Saved changes to local session.", "info");
      setIsEditing(false);
    } finally {
      setIsSaving(false);
    }
  };

  // DELETE /api/drivers/profile
  const handleDeleteDriverProfile = async () => {
    setIsDeletingProfile(true);
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
      if (token) {
        const res = await fetch(`${API_BASE}/drivers/profile`, {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        const json = await res.json().catch(() => ({}));
        if (res.ok) {
          showToast(json.message || "Driver profile deleted successfully.", "success");
          if (typeof window !== "undefined") {
            localStorage.clear();
            setTimeout(() => {
              window.location.href = "/";
            }, 800);
          }
          return;
        } else {
          showToast(json.message || "Failed to delete driver profile.", "error");
        }
      } else {
        showToast("Session expired. Please log in again.", "error");
      }
    } catch {
      showToast("Network error while deleting driver profile.", "error");
    } finally {
      setIsDeletingProfile(false);
    }
  };

  // 3. GET /api/drivers/vehicle
  const fetchVehicle = async () => {
    try {
      if (typeof window !== "undefined") {
        const stored = localStorage.getItem("driver_vehicle_image");
        if (stored === "") {
          localStorage.removeItem("driver_vehicle_image");
        }
      }

      const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
      if (!token) return;

      const res = await fetch(`${API_BASE}/drivers/vehicle`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (res.ok) {
        const json = await res.json().catch(() => ({}));
        if (json.success) {
          if (json.data && (json.data.make || json.data.registrationNumber)) {
            const storedImg = typeof window !== "undefined" ? localStorage.getItem("driver_vehicle_image") : null;
            const resolvedImg = json.data.vehicleImage || (storedImg !== "" ? storedImg : "") || "";
            setVehicle({ ...json.data, vehicleImage: resolvedImg || undefined });
            if (json.data.vehicleType) setVType(json.data.vehicleType);
            if (json.data.make) setVMake(json.data.make);
            if (json.data.model) setVModel(json.data.model);
            if (json.data.year) setVYear(Number(json.data.year));
            if (json.data.color) setVColor(json.data.color);
            if (json.data.registrationNumber) setVRegNumber(json.data.registrationNumber);
            setVImage(resolvedImg);
          } else {
            setVehicle(null);
            if (typeof window !== "undefined") {
              localStorage.removeItem("driver_vehicle_image");
            }
          }
        }
      } else if (res.status === 404) {
        setVehicle(null);
        if (typeof window !== "undefined") {
          localStorage.removeItem("driver_vehicle_image");
        }
      }
    } catch {
      // Local fallback
    }
  };

  // 4. POST or PATCH /api/drivers/vehicle
  const handleSaveVehicle = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingVehicle(true);

    const normReg = vRegNumber.trim().replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
    if (normReg.length < 4 || normReg.length > 12) {
      showToast("Registration number must be 4 to 12 alphanumeric characters (e.g. BR01CA4589).", "error");
      setIsSavingVehicle(false);
      return;
    }

    const finalVehicleData: VehicleData = {
      vehicleType: vType,
      make: vMake.trim(),
      model: vModel.trim(),
      year: Number(vYear),
      color: vColor.trim(),
      registrationNumber: normReg,
      vehicleImage: vImage,
    };

    const payload: Record<string, any> = {
      vehicleType: vType,
      make: vMake.trim(),
      model: vModel.trim(),
      year: Number(vYear),
      color: vColor.trim(),
      registrationNumber: normReg,
    };

    if (vImage && typeof vImage === "string" && vImage.trim()) {
      payload.vehicleImage = vImage.trim();
    }

    if (typeof window !== "undefined") {
      if (vImage && vImage !== "") {
        localStorage.setItem("driver_vehicle_image", vImage);
      } else {
        localStorage.removeItem("driver_vehicle_image");
      }
    }

    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
      if (token) {
        const method = vehicle?.id || vehicle?._id ? "PATCH" : "POST";
        let res = await fetch(`${API_BASE}/drivers/vehicle`, {
          method,
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        });

        if (method === "PATCH" && res.status === 404) {
          res = await fetch(`${API_BASE}/drivers/vehicle`, {
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
          setVehicle({ ...finalVehicleData, ...(json.data || {}) });
          showToast(json.message || "Vehicle details updated successfully.", "success");
          setIsEditingVehicle(false);
          return;
        } else if (json.message) {
          showToast(json.message, "error");
          setIsSavingVehicle(false);
          return;
        }
      }

      setVehicle(finalVehicleData);
      showToast("Vehicle details updated successfully.", "success");
      setIsEditingVehicle(false);
    } catch {
      setVehicle(finalVehicleData);
      showToast("Saved vehicle details to local session.", "info");
      setIsEditingVehicle(false);
    } finally {
      setIsSavingVehicle(false);
    }
  };

  // 5. DELETE /api/drivers/vehicle
  const handleDeleteVehicle = () => {
    setIsDeleteVehicleModalOpen(true);
  };

  const handleConfirmDeleteVehicle = async () => {
    setIsDeletingVehicle(true);
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
      if (token) {
        const res = await fetch(`${API_BASE}/drivers/vehicle`, {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        const json = await res.json().catch(() => ({}));
        if (res.ok && json.success) {
          setVehicle(null);
          if (typeof window !== "undefined") {
            localStorage.removeItem("driver_vehicle_image");
          }
          showToast("Vehicle removed successfully.", "success");
          setIsDeleteVehicleModalOpen(false);
          setIsEditingVehicle(false);
          return;
        }
      }
      setVehicle(null);
      if (typeof window !== "undefined") {
        localStorage.removeItem("driver_vehicle_image");
      }
      showToast("Vehicle removed.", "info");
      setIsDeleteVehicleModalOpen(false);
      setIsEditingVehicle(false);
    } catch {
      setVehicle(null);
      if (typeof window !== "undefined") {
        localStorage.removeItem("driver_vehicle_image");
      }
      showToast("Vehicle removed.", "info");
      setIsDeleteVehicleModalOpen(false);
      setIsEditingVehicle(false);
    } finally {
      setIsDeletingVehicle(false);
    }
  };

  // 5b. DELETE /api/drivers/profile
  const handleConfirmDeleteProfile = async () => {
    setIsDeletingProfile(true);
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
      if (token) {
        const res = await fetch(`${API_BASE}/drivers/profile`, {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok && json.message) {
          showToast(json.message, "error");
          setIsDeletingProfile(false);
          return;
        }
      }
      showToast("Driver profile and account deleted successfully.", "success");
      setIsDeleteProfileModalOpen(false);
      if (typeof window !== "undefined") {
        localStorage.clear();
        setTimeout(() => {
          window.location.href = "/";
        }, 800);
      }
    } catch {
      showToast("Profile deleted.", "info");
      setIsDeleteProfileModalOpen(false);
      if (typeof window !== "undefined") {
        localStorage.clear();
        window.location.href = "/";
      }
    } finally {
      setIsDeletingProfile(false);
    }
  };

  // 6. DRIVER DOCUMENTS: GET /api/drivers/documents
  const fetchDocuments = async () => {
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
      if (token) {
        const res = await fetch(`${API_BASE}/drivers/documents`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        if (res.ok) {
          const json = await res.json().catch(() => ({}));
          if (json.success && Array.isArray(json.data)) {
            // Source of truth is backend database: if empty array, documents are deleted
            setDocuments(json.data);
            if (typeof window !== "undefined") {
              if (json.data.length > 0) {
                localStorage.setItem("driver_documents", JSON.stringify(json.data));
              } else {
                localStorage.removeItem("driver_documents");
              }
            }
            return;
          }
        } else if (res.status === 404 || res.status === 401) {
          setDocuments([]);
          if (typeof window !== "undefined") {
            localStorage.removeItem("driver_documents");
          }
          return;
        }
      }
      if (typeof window !== "undefined" && !token) {
        setDocuments([]);
        localStorage.removeItem("driver_documents");
      }
    } catch {
      // Local fallback
    }
  };

  const handleOpenDocModal = (type: "AADHAAR" | "DRIVING_LICENSE") => {
    const existing = documents.find((d) => d.documentType === type);
    if (existing && existing.verificationStatus === "VERIFIED") {
      showToast(`${type === "AADHAAR" ? "Aadhaar Card" : "Driving Licence"} is already verified.`, "info");
      return;
    }
    setActiveDocType(type);
    if (existing) {
      setEditingDocId(existing.id || existing._id || null);
      setDocNumberInput(existing.documentNumber || "");
      setDocUrlInput(existing.documentUrl || "");
    } else {
      setEditingDocId(null);
      setDocNumberInput(type === "DRIVING_LICENSE" ? licenseNumber : "");
      setDocUrlInput("");
    }
    setIsDocModalOpen(true);
  };

  const handleDocFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        showToast("Document image size must be less than 10MB.", "error");
        return;
      }
      const reader = new FileReader();
      reader.onload = async () => {
        if (typeof reader.result === "string") {
          try {
            showToast("Uploading document image...", "info");
            const uploadRes = await fetch(`${API_BASE}/upload`, {
              method: "POST",
              headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("token") ?? ""}`,
          },
              body: JSON.stringify({ file: reader.result, fileName: file.name, category: "doc" }),
            });
            const uploadJson = await uploadRes.json().catch(() => ({}));
            if (uploadRes.ok && uploadJson.success && uploadJson.data?.url) {
              // Documents are private: show the signed preview link. Saving it is safe,
              // the backend converts a signed link back into the permanent reference.
              setDocUrlInput(uploadJson.data.previewUrl ?? uploadJson.data.url);
              showToast("Document image uploaded successfully.", "success");
            } else {
              setDocUrlInput(reader.result);
            }
          } catch {
            setDocUrlInput(reader.result);
          }
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveDoc = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingDoc(true);

    const normNumber = docNumberInput.trim().replace(/[\s-]/g, "");

    // Validation rules per backend specs
    if (activeDocType === "AADHAAR") {
      if (!/^[2-9]\d{11}$/.test(normNumber)) {
        showToast("Aadhaar number must be exactly 12 digits and cannot start with 0 or 1.", "error");
        setIsSavingDoc(false);
        return;
      }
    } else {
      const dlUpper = normNumber.toUpperCase();
      if (!/^[A-Z0-9]{8,20}$/.test(dlUpper)) {
        showToast("Driving licence number must be 8 to 20 letters and digits.", "error");
        setIsSavingDoc(false);
        return;
      }
    }

    const trimmedUrl = docUrlInput.trim();
    if (!trimmedUrl || (!trimmedUrl.startsWith("http://") && !trimmedUrl.startsWith("https://"))) {
      showToast("Document file must have a valid http:// or https:// URL.", "error");
      setIsSavingDoc(false);
      return;
    }

    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    const finalNumber = activeDocType === "DRIVING_LICENSE" ? normNumber.toUpperCase() : normNumber;

    try {
      if (token) {
        if (editingDocId) {
          // PATCH /api/drivers/documents/:documentId
          const res = await fetch(`${API_BASE}/drivers/documents/${editingDocId}`, {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              documentNumber: finalNumber,
              documentUrl: trimmedUrl,
            }),
          });
          const json = await res.json().catch(() => ({}));
          if (res.ok && json.success) {
            setDocuments((prev) => {
              const updated = prev.map((d) =>
                d.id === editingDocId || d._id === editingDocId
                  ? { ...d, ...(json.data || {}), verificationStatus: "PENDING" as const }
                  : d
              );
              if (typeof window !== "undefined") {
                localStorage.setItem("driver_documents", JSON.stringify(updated));
              }
              return updated;
            });
            showToast(json.message || "Document re-submitted for verification.", "success");
            setIsDocModalOpen(false);
            return;
          } else if (json.message) {
            showToast(json.message, "error");
            setIsSavingDoc(false);
            return;
          }
        } else {
          // POST /api/drivers/documents
          const res = await fetch(`${API_BASE}/drivers/documents`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              documentType: activeDocType,
              documentNumber: finalNumber,
              documentUrl: trimmedUrl,
            }),
          });
          const json = await res.json().catch(() => ({}));
          if (res.ok && json.success) {
            setDocuments((prev) => {
              const updated = [...prev.filter((d) => d.documentType !== activeDocType), json.data];
              if (typeof window !== "undefined") {
                localStorage.setItem("driver_documents", JSON.stringify(updated));
              }
              return updated;
            });
            showToast(json.message || "Document submitted for verification.", "success");
            setIsDocModalOpen(false);
            return;
          } else if (res.status === 409) {
            // Document already submitted: auto-patch existing document
            const existing = documents.find((d) => d.documentType === activeDocType);
            if (existing && (existing.id || existing._id)) {
              const patchId = existing.id || existing._id;
              const patchRes = await fetch(`${API_BASE}/drivers/documents/${patchId}`, {
                method: "PATCH",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                  documentNumber: finalNumber,
                  documentUrl: trimmedUrl,
                }),
              });
              const patchJson = await patchRes.json().catch(() => ({}));
              if (patchRes.ok && patchJson.success) {
                setDocuments((prev) => {
                  const updated = prev.map((d) =>
                    d.id === patchId || d._id === patchId
                      ? { ...d, ...(patchJson.data || {}), verificationStatus: "PENDING" as const }
                      : d
                  );
                  if (typeof window !== "undefined") {
                    localStorage.setItem("driver_documents", JSON.stringify(updated));
                  }
                  return updated;
                });
                showToast(patchJson.message || "Document re-submitted for verification.", "success");
                setIsDocModalOpen(false);
                return;
              }
            }
          } else if (json.message) {
            showToast(json.message, "error");
            setIsSavingDoc(false);
            return;
          }
        }
      }

      // Offline / local storage fallback
      const updatedItem: DriverDocumentData = {
        id: editingDocId || `doc-${activeDocType.toLowerCase()}-${Date.now()}`,
        documentType: activeDocType,
        documentNumber: finalNumber,
        documentUrl: trimmedUrl,
        verificationStatus: "PENDING",
        updatedAt: new Date().toISOString(),
      };

      setDocuments((prev) => {
        const next = [...prev.filter((d) => d.documentType !== activeDocType), updatedItem];
        if (typeof window !== "undefined") {
          localStorage.setItem("driver_documents", JSON.stringify(next));
        }
        return next;
      });

      showToast(
        editingDocId
          ? "Document re-submitted for verification."
          : "Document submitted for verification.",
        "success"
      );
      setIsDocModalOpen(false);
    } catch {
      showToast("Saved document details to local session.", "info");
      setIsDocModalOpen(false);
    } finally {
      setIsSavingDoc(false);
    }
  };

  const formatAadhaarDisplay = (rawNumber: string, masked: boolean) => {
    const clean = rawNumber.replace(/\D/g, "");
    if (clean.length !== 12) return rawNumber;
    if (masked) {
      return `•••• •••• ${clean.slice(-4)}`;
    }
    return `${clean.slice(0, 4)} ${clean.slice(4, 8)} ${clean.slice(8, 12)}`;
  };

  // Format Date of Birth (e.g. "1995-03-20T00:00:00.000Z" -> "20 Mar 1995")
  const formattedDob = React.useMemo(() => {
    const rawDob = profile?.dateOfBirth || dob;
    if (!rawDob) return "20 Mar 1995";
    try {
      const d = new Date(rawDob);
      if (isNaN(d.getTime())) return rawDob;
      return d.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
    } catch {
      return rawDob;
    }
  }, [profile?.dateOfBirth, dob]);

  // Full Date of Joining (e.g. "2026-10-07T16:17:39.226Z" -> "07 October 2026")
  const fullDateOfJoining = React.useMemo(() => {
    const rawDate = profile?.createdAt;
    if (!rawDate) return "07 October 2026";
    try {
      const d = new Date(rawDate);
      if (isNaN(d.getTime())) return "07 October 2026";
      return d.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      });
    } catch {
      return "07 October 2026";
    }
  }, [profile?.createdAt]);

  // Formatted gender (e.g. "MALE" -> "Male")
  const formattedGender = React.useMemo(() => {
    const g = profile?.gender || gender;
    if (!g) return "Male";
    return g.charAt(0).toUpperCase() + g.slice(1).toLowerCase();
  }, [profile?.gender, gender]);

  // Display phone
  const displayPhone = React.useMemo(() => {
    const p = profile?.phone || phone;
    if (!p) return "+91 8102773833";
    const digits = p.replace(/\D/g, "");
    if (digits.length >= 10) {
      return `+91 ${digits.slice(-10)}`;
    }
    return p.startsWith("+91") ? p : `+91 ${p}`;
  }, [profile?.phone, phone]);

  const [avatarUrl, setAvatarUrl] = useState<string>("/driveravatar.jpg");

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      showToast("Profile image must be less than 10MB.", "error");
      return;
    }

    const reader = new FileReader();
    reader.onload = async () => {
      if (typeof reader.result !== "string") return;
      const base64Data = reader.result;

      // 1. Immediately store and show locally
      setAvatarUrl(base64Data);
      if (typeof window !== "undefined") {
        localStorage.setItem("driver_profile_image", base64Data);
      }

      try {
        showToast("Uploading profile image...", "info");
        // 2. Upload to backend /api/upload to store file and get hosted link
        const uploadRes = await fetch(`${API_BASE}/upload`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("token") ?? ""}`,
          },
          body: JSON.stringify({ file: base64Data, fileName: file.name, category: "profile" }),
        });
        const uploadJson = await uploadRes.json().catch(() => ({}));

        if (uploadRes.ok && uploadJson.success && uploadJson.data?.url) {
          const hostedLink = uploadJson.data.url;
          setAvatarUrl(hostedLink);
          if (typeof window !== "undefined") {
            localStorage.setItem("driver_profile_image", hostedLink);
          }

          // 2. Persist the image link directly in database
          const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
          if (token) {
            const patchRes = await fetch(`${API_BASE}/drivers/profile`, {
              method: "PATCH",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({ profileImage: hostedLink }),
            });
            const patchJson = await patchRes.json().catch(() => ({}));
            if (patchRes.ok && patchJson.success) {
              setProfile(patchJson.data);
              showToast("Profile image link saved in database.", "success");
              return;
            }
          }
          showToast("Profile photo uploaded.", "success");
        } else {
          showToast(uploadJson.message || "Failed to upload image.", "error");
        }
      } catch {
        showToast("Error uploading profile image.", "error");
      }
    };
    reader.readAsDataURL(file);
  };

  const handleVehiclePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        showToast("Image size must be less than 5MB.", "error");
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === "string") {
          const newImg = reader.result;
          setVImage(newImg);
          if (typeof window !== "undefined") {
            localStorage.setItem("driver_vehicle_image", newImg);
          }
          if (vehicle) {
            setVehicle((prev) => (prev ? { ...prev, vehicleImage: newImg } : null));
          }
          showToast("Vehicle image updated successfully.", "success");
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleToggleOnline = () => {
    const next = !isOnline;
    setIsOnline(next);
    showToast(
      next ? "You are now ONLINE and ready to receive ride requests." : "You are OFFLINE. No new trips will be assigned.",
      next ? "success" : "info"
    );
  };

  const handleDeleteDriverAccount = () => {
    if (
      !window.confirm(
        "Are you sure you want to delete your driver data? You will be automatically redirected to the landing page."
      )
    ) {
      return;
    }
    if (typeof window !== "undefined") {
      localStorage.clear();
      window.location.href = "/";
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isDeleteVehicleModalOpen && !isDeletingVehicle) {
        setIsDeleteVehicleModalOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isDeleteVehicleModalOpen, isDeletingVehicle]);

  return (
    <div className="min-h-screen bg-[#FBFBFA] pb-24 text-black">
      {/* Top-Middle Confirmation Modal for Removing Vehicle */}
      {isDeleteVehicleModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-start justify-center pt-8 sm:pt-14 px-4 bg-black/50 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
          onClick={(e) => {
            if (e.target === e.currentTarget && !isDeletingVehicle) {
              setIsDeleteVehicleModalOpen(false);
            }
          }}
        >
          <div
            className="relative w-full max-w-md bg-white rounded-2xl sm:rounded-3xl shadow-2xl border border-stone-200 p-6 sm:p-7 transform transition-all animate-in fade-in slide-in-from-top-12 duration-300 ease-out"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close Button */}
            <button
              type="button"
              disabled={isDeletingVehicle}
              onClick={() => setIsDeleteVehicleModalOpen(false)}
              className="absolute top-4 right-4 sm:top-5 sm:right-5 p-1.5 rounded-full text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors cursor-pointer disabled:opacity-40"
              aria-label="Close dialog"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Modal Body */}
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-rose-50 border border-rose-100 text-rose-600 shadow-2xs">
                <Trash2 className="w-6 h-6" />
              </div>
              <div className="min-w-0 flex-1 pr-4">
                <h3 className="font-caslon text-xl sm:text-2xl font-bold text-black tracking-tight">
                  Remove Vehicle?
                </h3>
                <p className="text-xs sm:text-sm text-stone-600 mt-1 leading-relaxed">
                  Are you sure you want to remove your registered vehicle?
                </p>
              </div>
            </div>

            {/* Vehicle Summary Preview Card */}
            {vehicle && (
              <div className="mt-4 p-3 rounded-xl bg-stone-50 border border-stone-200 flex items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-white border border-stone-200 flex items-center justify-center text-stone-700 shrink-0">
                    <Car className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-black truncate">
                      {vehicle.make} {vehicle.model}
                    </p>
                    <p className="text-[11px] font-mono text-stone-500 uppercase">
                      {vehicle.registrationNumber}
                    </p>
                  </div>
                </div>
                <span className="shrink-0 px-2 py-0.5 rounded-md bg-stone-200 text-stone-700 text-[10px] font-bold uppercase tracking-wider">
                  {vehicle.vehicleType}
                </span>
              </div>
            )}

            {/* Warning advisory */}
            <div className="mt-3.5 flex items-center gap-2 text-[11px] text-amber-800 bg-amber-50/90 border border-amber-200/70 p-2.5 rounded-xl">
              <AlertCircle className="w-3.5 h-3.5 shrink-0 text-amber-600" />
              <span>You will need to register a vehicle to receive trip bookings.</span>
            </div>

            {/* Action Buttons */}
            <div className="mt-6 flex flex-col-reverse sm:flex-row items-center justify-end gap-2.5">
              <button
                type="button"
                disabled={isDeletingVehicle}
                onClick={() => setIsDeleteVehicleModalOpen(false)}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-stone-200 text-stone-700 text-xs sm:text-sm font-semibold hover:bg-stone-50 active:scale-[0.98] transition-all cursor-pointer disabled:opacity-40"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeletingVehicle}
                onClick={handleConfirmDeleteVehicle}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs sm:text-sm font-semibold active:scale-[0.98] transition-all cursor-pointer shadow-xs disabled:opacity-50"
              >
                {isDeletingVehicle ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Removing...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    <span>Yes, Remove Vehicle</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Toast Notification Container (Bottom-Right) */}
      <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className="pointer-events-auto flex items-center justify-between gap-3 px-4 py-2.5 rounded-lg bg-black text-white shadow-xl border border-neutral-800 text-xs animate-in slide-in-from-bottom-3 duration-200"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              {toast.type === "success" && <Check className="w-4 h-4 text-white shrink-0" />}
              {toast.type === "error" && <AlertCircle className="w-4 h-4 text-white shrink-0" />}
              {toast.type === "info" && <ShieldCheck className="w-4 h-4 text-white shrink-0" />}
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

        {/* 1. TOP BANNER */}
        <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl bg-white border border-[#EDEDE8] shadow-xs h-[180px] sm:h-[200px] lg:h-[220px] xl:h-[230px] flex items-center w-full shrink-0">
          <div className="absolute inset-0 w-full h-full pointer-events-none select-none">
            <Image
              src="/smiling-driver-banner.webp"
              alt="Driver Profile Banner"
              fill
              priority
              sizes="100vw"
              className="object-cover"
              style={{ objectPosition: "right 18%" }}
            />
            <div className="absolute inset-0 bg-gradient-to-r from-white/90 via-white/40 to-transparent sm:from-white/75 sm:via-white/10 sm:to-transparent" />
          </div>

          <div className="relative z-10 w-full px-6 py-4 sm:px-8 sm:py-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="max-w-md sm:max-w-lg lg:max-w-xl">
              <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#7A7A74]">
                Account &amp; Security
              </span>
              <h1 className="font-caslon text-3xl sm:text-4xl lg:text-[40px] font-bold text-[#111111] tracking-tight leading-tight mt-1">
                Driver Profile
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
                    <Edit3 className="w-4 h-4 text-stone-600" />
                    <span>Edit Profile</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 3. PIC 2 STYLE SECTION: Left Profile Summary + Right Contact & Details    */}
        {/* ========================================================================= */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 sm:gap-4 w-full items-stretch">
          {/* --------------------------------------------------------------------- */}
          {/* LEFT COLUMN (4 cols): Avatar, Name, Email, Verified Badge, Metadata   */}
          {/* --------------------------------------------------------------------- */}
          <div className="lg:col-span-4 xl:col-span-4 rounded-2xl sm:rounded-3xl bg-white border border-[#EDEDE8] p-4 sm:p-5 shadow-xs flex flex-col justify-between items-center text-center">
            {/* Circular Avatar with Camera Button */}
            <div className="flex flex-col items-center">
              <div className="relative w-22 h-22 sm:w-26 sm:h-26 mb-2">
                <div className="relative w-22 h-22 sm:w-26 sm:h-26 rounded-full overflow-hidden border-3 border-white shadow-md ring-1 ring-black/5 bg-[#E5E9CA] flex items-center justify-center">
                  <span className="font-caslon font-bold text-2xl sm:text-3xl text-stone-700 select-none">
                    {(profile?.name || name || "D").charAt(0).toUpperCase()}
                  </span>
                  {avatarUrl && (
                    <img
                      src={avatarUrl}
                      alt=""
                      className="absolute inset-0 w-full h-full object-cover"
                      onError={(e) => {
                        e.currentTarget.style.display = "none";
                      }}
                    />
                  )}
                </div>
                <label
                  htmlFor="driver-avatar-upload"
                  title="Change profile picture"
                  className="absolute bottom-0 right-0 w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-white border border-[#E0DED7] shadow-xs flex items-center justify-center text-stone-700 hover:text-black hover:bg-stone-50 cursor-pointer transition-colors"
                >
                  <Camera className="w-3.5 h-3.5" />
                  <input
                    id="driver-avatar-upload"
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    onChange={handleImageUpload}
                  />
                </label>
              </div>

              {/* Driver Name & Email */}
              <h2 className="font-caslon text-xl sm:text-2xl font-bold text-[#111111] leading-tight">
                {profile?.name || name}
              </h2>
              <p className="text-xs text-[#7A7A72] mt-0.5 truncate max-w-full">
                {profile?.email || email}
              </p>

              {/* Verified Badge */}
              <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-semibold border border-emerald-200 shadow-2xs">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>
                  {profile?.verificationStatus === "PENDING"
                    ? "Pending Verification"
                    : "Verified Captain"}
                </span>
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
                  DRIVER
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
                  <Power className="w-3.5 h-3.5 text-stone-400" />
                  <span>Availability</span>
                </div>
                <span className="font-caslon font-bold text-[#111111] text-sm sm:text-base uppercase">
                  {profile?.availabilityStatus || (isOnline ? "AVAILABLE" : "OFFLINE")}
                </span>
              </div>
            </div>
          </div>

          {/* --------------------------------------------------------------------- */}
          {/* RIGHT COLUMN (8 cols): Contact & Details Grid or Edit Form            */}
          {/* --------------------------------------------------------------------- */}
          <div className="lg:col-span-8 xl:col-span-8 rounded-2xl sm:rounded-3xl bg-white border border-[#EDEDE8] p-4 sm:p-5 shadow-xs flex flex-col justify-between">
            {isEditing ? (
              /* In-Place Edit Form */
              <form onSubmit={handleSaveProfile} className="flex-1 flex flex-col justify-between h-full space-y-4">
                <div className="space-y-4">
                  <div className="pb-3 border-b border-[#F0EFEA]">
                    <h3 className="font-caslon text-xl sm:text-2xl font-bold text-[#111111]">
                      Edit Personal Details
                    </h3>
                    <p className="text-xs text-stone-500 mt-1">
                      Update your contact information, license, and demographic details.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Full Name */}
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-stone-600 mb-1.5">
                        Full Legal Name
                      </label>
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        required
                        className="block w-full rounded-xl border border-stone-200 bg-[#FAFAFA] px-3.5 py-2.5 text-sm text-black focus:border-black focus:bg-white focus:outline-none transition-colors"
                      />
                    </div>

                    {/* Phone */}
                    <div>
                      <label
                        htmlFor="edit-driver-phone"
                        className="block text-[10px] font-bold uppercase tracking-wider text-stone-600 mb-1.5"
                      >
                        Phone Number
                      </label>
                      <div className="relative rounded-xl shadow-2xs">
                        <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-xs font-semibold text-stone-500">
                          +91
                        </span>
                        <input
                          id="edit-driver-phone"
                          type="tel"
                          value={phone}
                          onChange={(e) =>
                            setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))
                          }
                          placeholder="8102773833"
                          className="block w-full rounded-xl border border-stone-200 bg-[#FAFAFA] pl-12 pr-3.5 py-2.5 text-sm text-black focus:border-black focus:bg-white focus:outline-none transition-colors"
                        />
                      </div>
                    </div>

                    {/* Email */}
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-stone-600 mb-1.5">
                        Registered Email
                      </label>
                      <input
                        type="email"
                        disabled
                        value={profile?.email || email}
                        className="block w-full rounded-xl border border-stone-200 bg-stone-100 px-3.5 py-2.5 text-sm text-stone-500 cursor-not-allowed"
                      />
                    </div>

                    {/* Date of Birth */}
                    <div>
                      <label
                        htmlFor="edit-driver-dob"
                        className="block text-[10px] font-bold uppercase tracking-wider text-stone-600 mb-1.5"
                      >
                        Date of Birth
                      </label>
                      <input
                        id="edit-driver-dob"
                        type="date"
                        value={dob}
                        onChange={(e) => setDob(e.target.value)}
                        max="2008-01-01"
                        className="block w-full rounded-xl border border-stone-200 bg-[#FAFAFA] px-3.5 py-2.5 text-sm text-black focus:border-black focus:bg-white focus:outline-none transition-colors"
                      />
                    </div>

                    {/* Gender */}
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-stone-600 mb-1.5">
                        Gender
                      </label>
                      <div className="grid grid-cols-3 gap-2">
                        {(["MALE", "FEMALE", "OTHER"] as const).map((g) => (
                          <button
                            key={g}
                            type="button"
                            onClick={() => setGender(g)}
                            className={`py-2.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                              gender === g
                                ? "bg-black text-white border-black shadow-xs"
                                : "bg-[#FAFAFA] text-stone-700 border-stone-200 hover:bg-stone-100"
                            }`}
                          >
                            {g === "MALE" ? "Male" : g === "FEMALE" ? "Female" : "Other"}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* License Number */}
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-stone-600 mb-1.5">
                        Driving License Number
                      </label>
                      <input
                        type="text"
                        value={licenseNumber}
                        onChange={(e) => setLicenseNumber(e.target.value.toUpperCase())}
                        maxLength={20}
                        placeholder="BR097826H8HMK03N3303"
                        className="block w-full rounded-xl border border-stone-200 bg-[#FAFAFA] px-3.5 py-2.5 text-sm text-black font-mono uppercase focus:border-black focus:bg-white focus:outline-none transition-colors"
                      />
                    </div>

                    {/* City */}
                    <div className="sm:col-span-2">
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-stone-600 mb-1.5">
                        Operating City / Hub
                      </label>
                      <input
                        type="text"
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                        placeholder="Patna, Bihar"
                        className="block w-full rounded-xl border border-stone-200 bg-[#FAFAFA] px-3.5 py-2.5 text-sm text-black focus:border-black focus:bg-white focus:outline-none transition-colors"
                      />
                    </div>
                  </div>
                </div>

                {/* Form Buttons */}
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
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-black text-white text-xs sm:text-sm font-semibold hover:bg-neutral-800 disabled:opacity-50 transition-all cursor-pointer shadow-xs"
                  >
                    {isSaving ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        <span>Saving...</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4" />
                        <span>Save Changes</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            ) : (
              /* Exact Pic 2 Style: Contact & Details Grid */
              <div className="flex flex-col justify-between h-full flex-1">
                <div className="mb-2 shrink-0">
                  <h3 className="font-caslon text-xl sm:text-2xl font-bold text-[#111111] leading-tight">
                    Contact &amp; Details
                  </h3>
                  <p className="text-xs text-[#7A7A72] mt-0.5">
                    Your personal information is kept secure.
                  </p>
                </div>

                {/* Details Grid */}
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
                        {profile?.email || email}
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

                  {/* Card 5: LICENSE NUMBER */}
                  <div className="rounded-xl sm:rounded-2xl border border-[#EDEDE8] bg-[#FAFAF8] p-3 sm:p-3.5 flex items-center gap-3 hover:border-[#DCDCD4] transition-colors">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white border border-[#EDEDE8] text-[#4A4A45] shadow-2xs">
                      <FileText className="w-4 h-4 text-stone-700" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-[#8A8A82]">
                        LICENSE NUMBER
                      </p>
                      <p className="font-mono text-xs sm:text-sm font-bold text-[#111111] mt-0.5 truncate tracking-wider">
                        {profile?.licenseNumber || licenseNumber}
                      </p>
                    </div>
                  </div>

                  {/* Card 6: CITY */}
                  <div className="rounded-xl sm:rounded-2xl border border-[#EDEDE8] bg-[#FAFAF8] p-3 sm:p-3.5 flex items-center gap-3 hover:border-[#DCDCD4] transition-colors">
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
        {/* 4. VEHICLE SECTION: GET/POST/PATCH/DELETE /api/drivers/vehicle            */}
        {/* ========================================================================= */}
        <section className="rounded-2xl sm:rounded-3xl border border-[#EDEDE8] bg-white p-6 sm:p-8 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#F0EFEA]">
            <div>
              <h2 className="font-caslon text-2xl sm:text-3xl font-bold text-[#111111] tracking-tight">
                Vehicle Details
              </h2>
              <p className="text-xs text-stone-500 mt-0.5">
                Authorized vehicle assigned to this captain account (1 vehicle per driver).
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {vehicle ? (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      if (!isEditingVehicle && vehicle) {
                        setVType(vehicle.vehicleType || "CAB");
                        setVMake(vehicle.make || "");
                        setVModel(vehicle.model || "");
                        setVYear(vehicle.year || 2024);
                        setVColor(vehicle.color || "");
                        setVRegNumber(vehicle.registrationNumber || "");
                        setVImage(vehicle.vehicleImage || "");
                      }
                      setIsEditingVehicle(!isEditingVehicle);
                    }}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-[#E0DED7] bg-white text-xs font-semibold text-black hover:bg-[#F5F3EC] transition-all cursor-pointer shadow-xs"
                  >
                    {isEditingVehicle ? (
                      <>
                        <X className="w-3.5 h-3.5 text-stone-600" />
                        <span>Cancel Edit</span>
                      </>
                    ) : (
                      <>
                        <Edit3 className="w-3.5 h-3.5 text-stone-600" />
                        <span>Edit Vehicle</span>
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={handleDeleteVehicle}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-rose-200 bg-rose-50 text-xs font-semibold text-rose-700 hover:bg-rose-100 transition-colors cursor-pointer"
                    title="Remove Vehicle"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Delete</span>
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setVType("CAB");
                    setVMake("");
                    setVModel("");
                    setVYear(new Date().getFullYear());
                    setVColor("");
                    setVRegNumber("");
                    setVImage("");    
                    setIsEditingVehicle(true);
                  }}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-black text-white text-xs font-semibold hover:bg-neutral-800 transition-all cursor-pointer shadow-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Vehicle</span>
                </button>
              )}
            </div>
          </div>

          {/* Form when adding / editing vehicle */}
          {isEditingVehicle ? (
            <form onSubmit={handleSaveVehicle} className="space-y-6 pt-2">
              <div className="space-y-5">
                {/* Vehicle Image Upload & Custom URL Section */}
                <div className="p-4 sm:p-5 rounded-2xl border border-stone-200 bg-[#FAFAFA] space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-black">
                        Vehicle Image / Photograph <span className="text-stone-400 font-normal">(Optional)</span>
                      </label>
                      <p className="text-xs text-stone-500 mt-0.5">
                        Upload a photo of your cab/vehicle or provide a direct web image link.
                      </p>
                    </div>

                  </div>

                  <div className="flex flex-col sm:flex-row items-center gap-4">
                    {/* Live Preview Box (Default Blank) */}
                    <div className="relative w-full sm:w-48 h-28 rounded-xl overflow-hidden border border-stone-200 bg-stone-50 shrink-0 shadow-2xs group">
                      {vImage ? (
                        <>
                          <Image
                            src={vImage}
                            alt="Vehicle preview"
                            fill
                            className="object-cover"
                          />
                          <label
                            htmlFor="vehicle-photo-upload-overlay"
                            className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                            title="Upload from device"
                          >
                            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white text-black text-xs font-semibold shadow-md">
                              <Camera className="w-3.5 h-3.5" />
                              <span>Change Photo</span>
                            </span>
                            <input
                              id="vehicle-photo-upload-overlay"
                              type="file"
                              accept="image/*"
                              className="sr-only"
                              onChange={handleVehiclePhotoUpload}
                            />
                          </label>
                        </>
                      ) : (
                        <label
                          htmlFor="vehicle-photo-upload-overlay"
                          className="w-full h-full flex flex-col items-center justify-center bg-stone-50 border-2 border-dashed border-stone-200 rounded-xl hover:bg-stone-100 hover:border-stone-400 transition-all cursor-pointer p-3 text-center"
                          title="Click to upload vehicle photo"
                        >
                          <div className="w-8 h-8 rounded-lg bg-white border border-stone-200 flex items-center justify-center shadow-2xs mb-1.5 text-stone-400 group-hover:text-black transition-colors">
                            <Camera className="w-4 h-4" />
                          </div>
                          <span className="text-[11px] font-semibold text-stone-600">No Image Selected</span>
                          <span className="text-[9px] text-stone-400 mt-0.5">Click to upload photo</span>
                          <input
                            id="vehicle-photo-upload-overlay"
                            type="file"
                            accept="image/*"
                            className="sr-only"
                            onChange={handleVehiclePhotoUpload}
                          />
                        </label>
                      )}
                    </div>

                    {/* Upload button and URL field */}
                    <div className="flex-1 w-full space-y-2.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <label
                          htmlFor="vehicle-photo-upload-btn"
                          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white border border-stone-200 text-stone-800 text-xs font-semibold hover:bg-stone-50 cursor-pointer shadow-2xs transition-colors"
                        >
                          <Camera className="w-3.5 h-3.5 text-stone-600" />
                          <span>Upload from Device</span>
                          <input
                            id="vehicle-photo-upload-btn"
                            type="file"
                            accept="image/*"
                            className="sr-only"
                            onChange={handleVehiclePhotoUpload}
                          />
                        </label>
                        {vImage && (
                          <button
                            type="button"
                            onClick={() => setVImage("")}
                            className="text-xs text-rose-600 hover:text-rose-800 underline cursor-pointer"
                          >
                            Remove image
                          </button>
                        )}
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-stone-600 mb-1">
                          Or Web Image URL
                        </label>
                        <input
                          type="url"
                          value={vImage.startsWith("data:") ? "" : vImage}
                          onChange={(e) => setVImage(e.target.value)}
                          placeholder="https://example.com/vehicle-photo.jpg"
                          className="block w-full rounded-xl border border-stone-200 bg-white px-3.5 py-2 text-xs text-black placeholder:text-stone-400 focus:border-black focus:outline-none transition-colors"
                        />
                        <span className="text-[10px] text-stone-400 mt-0.5 block">
                          Paste a direct web link (https://...) to your vehicle photo.
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {/* Vehicle Type (BIKE, AUTO, CAB) */}
                  <div className="sm:col-span-2 lg:col-span-3">
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-stone-600 mb-1.5">
                      Vehicle Type <span className="text-rose-500">*</span>
                    </label>
                    <div className="grid grid-cols-3 gap-3 max-w-md">
                      {(
                        [
                          { type: "CAB", label: "Car / Cab", icon: "🚗" },
                          { type: "AUTO", label: "Auto", icon: "🛺" },
                          { type: "BIKE", label: "Bike", icon: "🏍️" },
                        ] as const
                      ).map((item) => (
                        <button
                          key={item.type}
                          type="button"
                          onClick={() => setVType(item.type)}
                          className={`py-2.5 px-3 rounded-xl text-xs font-semibold border flex items-center justify-center gap-2 transition-all cursor-pointer ${
                            vType === item.type
                              ? "bg-black text-white border-black shadow-xs"
                              : "bg-[#FAFAFA] text-stone-700 border-stone-200 hover:bg-stone-100"
                          }`}
                        >
                          <span>{item.icon}</span>
                          <span>{item.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Make */}
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-stone-600 mb-1.5">
                      Vehicle Make (Brand) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={vMake}
                      onChange={(e) => setVMake(e.target.value)}
                      placeholder="e.g. Hyundai, Honda, Tata"
                      required
                      maxLength={50}
                      className="block w-full rounded-xl border border-stone-200 bg-[#FAFAFA] px-3.5 py-2.5 text-sm text-black focus:border-black focus:bg-white focus:outline-none transition-colors"
                    />
                  </div>

                  {/* Model */}
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-stone-600 mb-1.5">
                      Vehicle Model <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={vModel}
                      onChange={(e) => setVModel(e.target.value)}
                      placeholder="e.g. Aura, Dzire, Shine"
                      required
                      maxLength={50}
                      className="block w-full rounded-xl border border-stone-200 bg-[#FAFAFA] px-3.5 py-2.5 text-sm text-black focus:border-black focus:bg-white focus:outline-none transition-colors"
                    />
                  </div>

                  {/* Registration Number */}
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-stone-600 mb-1.5">
                      Registration Number (RC) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={vRegNumber}
                      onChange={(e) => setVRegNumber(e.target.value.toUpperCase())}
                      placeholder="e.g. BR01CA4589"
                      required
                      minLength={4}
                      maxLength={12}
                      className="block w-full rounded-xl border border-stone-200 bg-[#FAFAFA] px-3.5 py-2.5 text-sm text-black font-mono uppercase focus:border-black focus:bg-white focus:outline-none transition-colors"
                    />
                    <span className="text-[10px] text-stone-400 mt-1 block">Normalized to uppercase alphanumeric.</span>
                  </div>

                  {/* Manufacturing Year */}
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-stone-600 mb-1.5">
                      Manufacturing Year <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="number"
                      min={1990}
                      max={new Date().getFullYear() + 1}
                      value={vYear}
                      onChange={(e) => setVYear(Number(e.target.value))}
                      placeholder="2024"
                      required
                      className="block w-full rounded-xl border border-stone-200 bg-[#FAFAFA] px-3.5 py-2.5 text-sm text-black font-mono focus:border-black focus:bg-white focus:outline-none transition-colors"
                    />
                  </div>

                  {/* Color */}
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-stone-600 mb-1.5">
                      Body Color <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={vColor}
                      onChange={(e) => setVColor(e.target.value)}
                      placeholder="e.g. White, Black, Silver"
                      required
                      minLength={2}
                      maxLength={30}
                      className="block w-full rounded-xl border border-stone-200 bg-[#FAFAFA] px-3.5 py-2.5 text-sm text-black focus:border-black focus:bg-white focus:outline-none transition-colors"
                    />
                  </div>
                </div>
              </div>

              {/* Form Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#F0EFEA]">
                <button
                  type="button"
                  onClick={() => {
                    setIsEditingVehicle(false);
                    if (vehicle) {
                      setVType(vehicle.vehicleType || "CAB");
                      setVMake(vehicle.make || "");
                      setVModel(vehicle.model || "");
                      setVYear(vehicle.year || new Date().getFullYear());
                      setVColor(vehicle.color || "");
                      setVRegNumber(vehicle.registrationNumber || "");
                      setVImage(vehicle.vehicleImage || "");
                    } else {
                      setVType("CAB");
                      setVMake("");
                      setVModel("");
                      setVYear(new Date().getFullYear());
                      setVColor("");
                      setVRegNumber("");
                      setVImage("");
                    }
                  }}
                  className="px-4 py-2.5 rounded-xl border border-stone-200 text-stone-700 text-xs sm:text-sm font-semibold hover:bg-stone-50 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingVehicle}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-black text-white text-xs sm:text-sm font-semibold hover:bg-neutral-800 disabled:opacity-50 transition-all cursor-pointer shadow-xs"
                >
                  {isSavingVehicle ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Saving Vehicle...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Save Vehicle</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          ) : vehicle ? (
            /* Vehicle Display Mode */
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
              {/* Left Column (5 cols): Photo Banner */}
              <div className="lg:col-span-5 relative min-h-[220px] rounded-2xl overflow-hidden border border-[#EDEDE8] bg-neutral-900 shadow-2xs">
                {vehicle.vehicleImage ? (
                  <Image
                    src={vehicle.vehicleImage}
                    alt={`${vehicle.make} ${vehicle.model}`}
                    fill
                    unoptimized
                    className="object-cover"
                    style={{ objectPosition: "center 30%" }}
                  />
                ) : (
                  <div className="absolute inset-0 bg-neutral-900 flex flex-col items-center justify-center text-white/50 p-6 text-center">
                    <div className="w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center mb-2">
                      <Car className="w-7 h-7 text-white/60" />
                    </div>
                    <span className="text-xs uppercase tracking-wider font-semibold text-white/70">No Vehicle Photo</span>
                    <span className="text-[11px] text-white/40 mt-0.5">Use Change Photo to upload</span>
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-transparent flex flex-col justify-end p-5">
                  <div className="text-white">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-white/80">Vehicle Model</p>
                    <p className="text-xl font-bold font-caslon">{vehicle.make} {vehicle.model}</p>
                    <p className="text-xs text-white/90 font-mono mt-0.5">{vehicle.color} &bull; {vehicle.year}</p>
                  </div>
                </div>
              </div>

              {/* Right Column (7 cols): Specs Details Grid */}
              <div className="lg:col-span-7 flex flex-col justify-between space-y-4 sm:space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
                  {/* Card 1: Registration Number */}
                  <div className="rounded-xl sm:rounded-2xl border border-[#EDEDE8] bg-[#FAFAF8] p-4 sm:p-4.5 flex items-center gap-3.5 sm:gap-4 hover:border-[#DCDCD4] transition-colors">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white border border-[#EDEDE8] text-[#4A4A45] shadow-2xs">
                      <CreditCard className="w-4 h-4 text-stone-700" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-[#8A8A82]">
                        REGISTRATION (RC)
                      </p>
                      <p className="font-mono text-sm sm:text-base font-bold text-[#111111] mt-1 sm:mt-1.5 tracking-wider truncate">
                        {vehicle.registrationNumber}
                      </p>
                    </div>
                  </div>

                  {/* Card 2: Vehicle Type */}
                  <div className="rounded-xl sm:rounded-2xl border border-[#EDEDE8] bg-[#FAFAF8] p-4 sm:p-4.5 flex items-center gap-3.5 sm:gap-4 hover:border-[#DCDCD4] transition-colors">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white border border-[#EDEDE8] text-[#4A4A45] shadow-2xs">
                      <Car className="w-4 h-4 text-stone-700" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-[#8A8A82]">
                        VEHICLE TYPE
                      </p>
                      <p className="font-caslon text-base sm:text-lg font-bold text-[#111111] mt-1 sm:mt-1.5 truncate">
                        {vehicle.vehicleType === "CAB" ? "Cab / Sedan" : vehicle.vehicleType === "AUTO" ? "Auto Rickshaw" : "Bike"}
                      </p>
                    </div>
                  </div>

                  {/* Card 3: Make & Model */}
                  <div className="rounded-xl sm:rounded-2xl border border-[#EDEDE8] bg-[#FAFAF8] p-4 sm:p-4.5 flex items-center gap-3.5 sm:gap-4 hover:border-[#DCDCD4] transition-colors">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white border border-[#EDEDE8] text-[#4A4A45] shadow-2xs">
                      <Sparkles className="w-4 h-4 text-stone-700" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-[#8A8A82]">
                        MAKE &amp; MODEL
                      </p>
                      <p className="font-caslon text-base sm:text-lg font-bold text-[#111111] mt-1 sm:mt-1.5 truncate">
                        <span className="mr-1.5">{vehicle.make}</span>
                        <span>{vehicle.model}</span>
                      </p>
                    </div>
                  </div>

                  {/* Card 4: Color & Year */}
                  <div className="rounded-xl sm:rounded-2xl border border-[#EDEDE8] bg-[#FAFAF8] p-4 sm:p-4.5 flex items-center gap-3.5 sm:gap-4 hover:border-[#DCDCD4] transition-colors">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white border border-[#EDEDE8] text-[#4A4A45] shadow-2xs">
                      <Calendar className="w-4 h-4 text-stone-700" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-[#8A8A82]">
                        COLOR &amp; YEAR
                      </p>
                      <p className="font-caslon text-base sm:text-lg font-bold text-[#111111] mt-1 sm:mt-1.5 truncate flex items-center">
                        <span>{vehicle.color}</span>
                        <span className="mx-2.5 text-stone-300 font-normal select-none">&bull;</span>
                        <span className="text-stone-800">{vehicle.year}</span>
                      </p>
                    </div>
                  </div>
                </div>

                {/* Regulatory Reassurance */}
                <div className="p-3.5 rounded-xl bg-[#FAFAF8] border border-[#EDEDE8] flex items-center justify-between text-xs text-stone-600">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Commercial road fitness verified for active dispatch.</span>
                  </div>
                  <span className="font-semibold text-black text-[11px] uppercase tracking-wider">1 per driver</span>
                </div>
              </div>
            </div>
          ) : (
            /* Empty State */
            <div className="text-center py-10 space-y-3">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-neutral-100 flex items-center justify-center text-stone-400">
                <Car className="w-7 h-7" />
              </div>
              <p className="font-caslon text-lg font-bold text-black">No Vehicle Registered</p>
              <p className="text-xs text-stone-500 max-w-sm mx-auto">
                Add your commercial cab, auto rickshaw, or bike to receive passenger bookings on Ridezy.
              </p>
              <button
                type="button"
                onClick={() => {
                  setVType("CAB");
                  setVMake("");
                  setVModel("");
                  setVYear(new Date().getFullYear());
                  setVColor("");
                  setVRegNumber("");
                  setVImage("");
                  setIsEditingVehicle(true);
                }}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-black text-white text-xs font-semibold hover:bg-neutral-800 transition-all cursor-pointer shadow-xs"
              >
                <Plus className="w-4 h-4" />
                <span>Register Vehicle Now</span>
              </button>
            </div>
          )}
        </section>

        {/* ========================================================================= */}
        {/* 5. DRIVER DOCUMENTS SECTION: GET/POST/PATCH /api/drivers/documents        */}
        {/* ========================================================================= */}
        <section className="rounded-2xl sm:rounded-3xl border border-[#EDEDE8] bg-white p-6 sm:p-8 shadow-xs space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#F0EFEA]">
            <div>
              <div className="flex items-center gap-2.5">
                <h2 className="font-caslon text-2xl sm:text-3xl font-bold text-[#111111] tracking-tight">
                  Driver Documents
                </h2>
              </div>
              <p className="text-xs text-stone-500 mt-0.5">
                Government-issued identity &amp; commercial transport credentials.
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => {
                  const hasAadhaar = documents.some((d) => d.documentType === "AADHAAR");
                  const hasDL = documents.some((d) => d.documentType === "DRIVING_LICENSE");
                  if (!hasAadhaar) handleOpenDocModal("AADHAAR");
                  else if (!hasDL) handleOpenDocModal("DRIVING_LICENSE");
                  else handleOpenDocModal("AADHAAR");
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-black text-white text-xs font-semibold hover:bg-neutral-800 transition-all cursor-pointer shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Submit Document</span>
              </button>
            </div>
          </div>

          {/* Documents Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5 items-stretch">
            {/* 1. AADHAAR CARD */}
            {(() => {
              const doc = documents.find((d) => d.documentType === "AADHAAR");
              return (
                <div className="rounded-2xl border border-[#EDEDE8] bg-[#FAFAF8] p-4 sm:p-4.5 flex flex-col justify-between space-y-3.5 hover:border-[#DCDCD4] transition-colors shadow-2xs">
                  <div className="space-y-3">
                    {/* Header */}
                    <div className="flex items-start justify-between gap-2.5">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <h3 className="font-caslon text-lg font-bold text-[#111111]">
                            Aadhaar Card
                          </h3>
                          <span className="text-[9px] font-bold tracking-wider uppercase text-stone-500 bg-white border border-[#EDEDE8] px-1.5 py-0.2 rounded">
                            UIDAI
                          </span>
                        </div>
                        <p className="text-[11px] text-stone-500 mt-0.5">National Citizen Identity Card</p>
                      </div>

                      {/* Status Badge */}
                      {doc ? (
                        doc.verificationStatus === "VERIFIED" ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200/80 text-[10px] font-semibold shrink-0">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            Verified
                          </span>
                        ) : doc.verificationStatus === "REJECTED" ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-50 text-rose-800 border border-rose-200/80 text-[10px] font-semibold shrink-0">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                            Rejected
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200/80 text-[10px] font-semibold shrink-0">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                            Pending Review
                          </span>
                        )
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-stone-100 text-stone-500 text-[10px] font-semibold shrink-0">
                          Not Submitted
                        </span>
                      )}
                    </div>

                    {/* Content Section: Document Thumbnail + Number */}
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-0.5">
                      {/* Document Image Thumbnail with hover overlay */}
                      {doc?.documentUrl && isValidImageUrl(doc.documentUrl) && !failedDocImages[doc.id || doc._id || "AADHAAR"] ? (
                        <div
                          onClick={() =>
                            setDocPreviewModal({
                              url: doc.documentUrl,
                              title: "Aadhaar Card",
                              number: doc.documentNumber,
                              status: doc.verificationStatus,
                            })
                          }
                          className="relative w-full sm:w-28 h-16 rounded-xl overflow-hidden bg-stone-100 border border-[#E5E4DE] shrink-0 cursor-pointer group/thumb shadow-2xs"
                        >
                          <Image
                            src={doc.documentUrl}
                            alt=""
                            fill
                            unoptimized
                            onError={() =>
                              setFailedDocImages((prev) => ({
                                ...prev,
                                [doc.id || doc._id || "AADHAAR"]: true,
                              }))
                            }
                            className="object-cover group-hover/thumb:scale-105 transition-transform duration-300"
                          />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/thumb:opacity-100 transition-opacity flex items-center justify-center gap-1 text-white text-[11px] font-medium backdrop-blur-2xs">
                            <Eye className="w-3 h-3" />
                            <span>Preview</span>
                          </div>
                        </div>
                      ) : (
                        <div
                          onClick={() => handleOpenDocModal("AADHAAR")}
                          className="w-full sm:w-28 h-16 rounded-xl border border-dashed border-stone-200 bg-white flex flex-col items-center justify-center gap-1 text-stone-400 hover:border-black hover:text-black cursor-pointer transition-colors shrink-0"
                        >
                          <Upload className="w-3.5 h-3.5 text-stone-400" />
                          <span className="text-[10px] font-medium text-stone-400">Upload File</span>
                        </div>
                      )}

                      {/* Number and Meta */}
                      <div className="flex-1 min-w-0 space-y-0.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[9px] font-bold uppercase tracking-wider text-stone-400">
                            Document Number
                          </span>
                          {doc && (
                            <button
                              type="button"
                              onClick={() => setShowAadhaarNumber(!showAadhaarNumber)}
                              className="text-[10px] text-stone-500 hover:text-black transition-colors flex items-center gap-1 cursor-pointer"
                              title={showAadhaarNumber ? "Mask Number" : "Reveal Number"}
                            >
                              <Eye className="w-2.5 h-2.5" />
                              <span>{showAadhaarNumber ? "Hide" : "Show"}</span>
                            </button>
                          )}
                        </div>
                        <p className="font-mono text-base sm:text-lg font-bold text-black tracking-wider truncate">
                          {doc ? formatAadhaarDisplay(doc.documentNumber, !showAadhaarNumber) : "— — — —"}
                        </p>
                        <p className="text-[10px] text-stone-400 truncate">
                          {doc?.verifiedAt
                            ? `Verified ${new Date(doc.verifiedAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}`
                            : doc
                            ? "Document uploaded • Awaiting safety review"
                            : "Mandatory statutory verification"}
                        </p>
                      </div>
                    </div>

                    {/* Rejection Alert if applicable */}
                    {doc?.verificationStatus === "REJECTED" && (
                      <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200/80 text-rose-800 text-xs flex items-start gap-2">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0 text-rose-600 mt-0.5" />
                        <div>
                          <p className="font-semibold text-xs">Rejection Reason</p>
                          <p className="text-[11px] text-rose-700 mt-0.5">{doc.rejectionReason || "Details did not match UIDAI records. Please re-submit."}</p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Card Bottom Actions */}
                  <div className="pt-2.5 border-t border-[#EDEDE8] flex items-center justify-between gap-2.5 text-xs">
                    {doc?.documentUrl && isValidImageUrl(doc.documentUrl) && !failedDocImages[doc.id || doc._id || "AADHAAR"] ? (
                      <button
                        type="button"
                        onClick={() =>
                          setDocPreviewModal({
                            url: doc.documentUrl,
                            title: "Aadhaar Card",
                            number: doc.documentNumber,
                            status: doc.verificationStatus,
                          })
                        }
                        className="inline-flex items-center gap-1 text-stone-600 hover:text-black transition-colors text-[11px] font-medium cursor-pointer"
                      >
                        <Eye className="w-3 h-3" />
                        <span>Preview Document</span>
                      </button>
                    ) : (
                      <span className="text-[10px] text-stone-400">12-digit UIDAI card</span>
                    )}

                    {doc?.verificationStatus !== "VERIFIED" && (
                      <button
                        type="button"
                        onClick={() => handleOpenDocModal("AADHAAR")}
                        className="inline-flex items-center gap-1 px-3 py-1 rounded-lg border border-stone-200 hover:border-black bg-white hover:bg-[#F5F3EC] text-xs font-semibold text-black transition-all cursor-pointer shadow-2xs"
                      >
                        {doc ? (
                          <>
                            <RefreshCw className="w-2.5 h-2.5 text-stone-600" />
                            <span>Re-submit</span>
                          </>
                        ) : (
                          <>
                            <Plus className="w-2.5 h-2.5" />
                            <span>Submit</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* 2. DRIVING LICENCE */}
            {(() => {
              const doc = documents.find((d) => d.documentType === "DRIVING_LICENSE");
              return (
                <div className="rounded-2xl border border-[#EDEDE8] bg-[#FAFAF8] p-4 sm:p-4.5 flex flex-col justify-between space-y-3.5 hover:border-[#DCDCD4] transition-colors shadow-2xs">
                  <div className="space-y-3">
                    {/* Header */}
                    <div className="flex items-start justify-between gap-2.5">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <h3 className="font-caslon text-lg font-bold text-[#111111]">
                            Driving Licence
                          </h3>
                          <span className="text-[9px] font-bold tracking-wider uppercase text-stone-500 bg-white border border-[#EDEDE8] px-1.5 py-0.2 rounded">
                            MVD
                          </span>
                        </div>
                        <p className="text-[11px] text-stone-500 mt-0.5">Commercial Motor Vehicles Permit</p>
                      </div>

                      {/* Status Badge */}
                      {doc ? (
                        doc.verificationStatus === "VERIFIED" ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200/80 text-[10px] font-semibold shrink-0">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            Verified
                          </span>
                        ) : doc.verificationStatus === "REJECTED" ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-50 text-rose-800 border border-rose-200/80 text-[10px] font-semibold shrink-0">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                            Rejected
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200/80 text-[10px] font-semibold shrink-0">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                            Pending Review
                          </span>
                        )
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-stone-100 text-stone-500 text-[10px] font-semibold shrink-0">
                          Not Submitted
                        </span>
                      )}
                    </div>

                    {/* Content Section: Document Thumbnail + Number */}
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-0.5">
                      {/* Document Image Thumbnail with hover overlay */}
                      {doc?.documentUrl && isValidImageUrl(doc.documentUrl) && !failedDocImages[doc.id || doc._id || "DRIVING_LICENSE"] ? (
                        <div
                          onClick={() =>
                            setDocPreviewModal({
                              url: doc.documentUrl,
                              title: "Driving Licence",
                              number: doc.documentNumber,
                              status: doc.verificationStatus,
                            })
                          }
                          className="relative w-full sm:w-28 h-16 rounded-xl overflow-hidden bg-stone-100 border border-[#E5E4DE] shrink-0 cursor-pointer group/thumb shadow-2xs"
                        >
                          <Image
                            src={doc.documentUrl}
                            alt=""
                            fill
                            unoptimized
                            onError={() =>
                              setFailedDocImages((prev) => ({
                                ...prev,
                                [doc.id || doc._id || "DRIVING_LICENSE"]: true,
                              }))
                            }
                            className="object-cover group-hover/thumb:scale-105 transition-transform duration-300"
                          />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/thumb:opacity-100 transition-opacity flex items-center justify-center gap-1 text-white text-[11px] font-medium backdrop-blur-2xs">
                            <Eye className="w-3 h-3" />
                            <span>Preview</span>
                          </div>
                        </div>
                      ) : (
                        <div
                          onClick={() => handleOpenDocModal("DRIVING_LICENSE")}
                          className="w-full sm:w-28 h-16 rounded-xl border border-dashed border-stone-200 bg-white flex flex-col items-center justify-center gap-1 text-stone-400 hover:border-black hover:text-black cursor-pointer transition-colors shrink-0"
                        >
                          <Upload className="w-3.5 h-3.5 text-stone-400" />
                          <span className="text-[10px] font-medium text-stone-400">Upload File</span>
                        </div>
                      )}

                      {/* Number and Meta */}
                      <div className="flex-1 min-w-0 space-y-0.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[9px] font-bold uppercase tracking-wider text-stone-400">
                            Licence Number
                          </span>
                          <span className="text-[9px] text-stone-400 font-mono">STATE RTO</span>
                        </div>
                        <p className="font-mono text-base sm:text-lg font-bold text-black tracking-wider truncate uppercase">
                          {doc ? doc.documentNumber : licenseNumber || "— — — —"}
                        </p>
                        <p className="text-[10px] text-stone-400 truncate">
                          {doc?.verifiedAt
                            ? `Verified ${new Date(doc.verifiedAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}`
                            : doc
                            ? "Document uploaded • Awaiting safety review"
                            : "Mandatory commercial permit"}
                        </p>
                      </div>
                    </div>

                    {/* Rejection Alert if applicable */}
                    {doc?.verificationStatus === "REJECTED" && (
                      <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200/80 text-rose-800 text-xs flex items-start gap-2">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0 text-rose-600 mt-0.5" />
                        <div>
                          <p className="font-semibold text-xs">Rejection Reason</p>
                          <p className="text-[11px] text-rose-700 mt-0.5">{doc.rejectionReason || "Expired licence or unreadable photograph. Please re-submit."}</p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Card Bottom Actions */}
                  <div className="pt-2.5 border-t border-[#EDEDE8] flex items-center justify-between gap-2.5 text-xs">
                    {doc?.documentUrl && isValidImageUrl(doc.documentUrl) && !failedDocImages[doc.id || doc._id || "DRIVING_LICENSE"] ? (
                      <button
                        type="button"
                        onClick={() =>
                          setDocPreviewModal({
                            url: doc.documentUrl,
                            title: "Driving Licence",
                            number: doc.documentNumber,
                            status: doc.verificationStatus,
                          })
                        }
                        className="inline-flex items-center gap-1 text-stone-600 hover:text-black transition-colors text-[11px] font-medium cursor-pointer"
                      >
                        <Eye className="w-3 h-3" />
                        <span>Preview Document</span>
                      </button>
                    ) : (
                      <span className="text-[10px] text-stone-400">8–20 alphanumeric chars</span>
                    )}

                    {doc?.verificationStatus !== "VERIFIED" && (
                      <button
                        type="button"
                        onClick={() => handleOpenDocModal("DRIVING_LICENSE")}
                        className="inline-flex items-center gap-1 px-3 py-1 rounded-lg border border-stone-200 hover:border-black bg-white hover:bg-[#F5F3EC] text-xs font-semibold text-black transition-all cursor-pointer shadow-2xs"
                      >
                        {doc ? (
                          <>
                            <RefreshCw className="w-2.5 h-2.5 text-stone-600" />
                            <span>Re-submit</span>
                          </>
                        ) : (
                          <>
                            <Plus className="w-2.5 h-2.5" />
                            <span>Submit</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              );
            })()}
          </div>


        </section>

        {/* ========================================================================= */}
        {/* DANGER ZONE: DELETE DRIVER PROFILE & ACCOUNT                               */}
        {/* ========================================================================= */}
        <section className="rounded-3xl border border-rose-200 bg-rose-50/40 p-6 sm:p-7 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-2xs">
          <div>
            <h4 className="font-caslon text-lg font-bold text-rose-900">Delete Driver Profile &amp; Account</h4>
            <p className="text-xs text-rose-700/80 mt-1 max-w-xl leading-relaxed">
              Permanently remove your driver partner profile, registered commercial vehicle, uploaded license &amp; KYC verification records. This action cannot be undone.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsDeleteProfileModalOpen(true)}
            className="shrink-0 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold shadow-xs hover:shadow-sm active:scale-[0.98] transition-all cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Delete Driver Profile</span>
          </button>
        </section>

        {/* ========================================================================= */}
        {/* DOCUMENT SUBMIT / RE-SUBMIT MODAL                                         */}
        {/* ========================================================================= */}
        {isDocModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-200">
            <div className="w-full max-w-lg bg-white rounded-3xl border border-[#EDEDE8] shadow-2xl p-6 sm:p-7 space-y-6">
              <div className="flex items-center justify-between pb-4 border-b border-[#F0EFEA]">
                <div>
                  <h3 className="font-caslon text-xl sm:text-2xl font-bold text-black">
                    {editingDocId ? "Re-submit Verification Document" : "Submit Verification Document"}
                  </h3>
                  <p className="text-xs text-stone-500 mt-0.5">
                    {editingDocId
                      ? "Replaces the document number or file. Document goes back to PENDING review."
                      : "Submit your official identity or commercial permit for Ridezy safety verification."}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsDocModalOpen(false)}
                  className="p-1.5 rounded-xl text-stone-400 hover:text-black hover:bg-stone-100 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveDoc} className="space-y-4">
                {/* Document Type Selector (Disabled when editing per backend specs) */}
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-stone-600 mb-1.5">
                    Document Type
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      disabled={Boolean(editingDocId)}
                      onClick={() => {
                        setActiveDocType("AADHAAR");
                        setDocNumberInput("");
                        setDocUrlInput("");
                      }}
                      className={`p-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                        activeDocType === "AADHAAR"
                          ? "bg-black text-white border-black shadow-xs"
                          : "bg-[#FAFAFA] text-stone-700 border-stone-200 hover:bg-stone-100"
                      } ${editingDocId && activeDocType !== "AADHAAR" ? "opacity-40 cursor-not-allowed" : ""}`}
                    >
                      <FileBadge className="w-4 h-4" />
                      <span>Aadhaar (UIDAI)</span>
                    </button>
                    <button
                      type="button"
                      disabled={Boolean(editingDocId)}
                      onClick={() => {
                        setActiveDocType("DRIVING_LICENSE");
                        setDocNumberInput(licenseNumber);
                        setDocUrlInput("");
                      }}
                      className={`p-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                        activeDocType === "DRIVING_LICENSE"
                          ? "bg-black text-white border-black shadow-xs"
                          : "bg-[#FAFAFA] text-stone-700 border-stone-200 hover:bg-stone-100"
                      } ${editingDocId && activeDocType !== "DRIVING_LICENSE" ? "opacity-40 cursor-not-allowed" : ""}`}
                    >
                      <Car className="w-4 h-4" />
                      <span>Driving Licence</span>
                    </button>
                  </div>
                  {editingDocId && (
                    <p className="text-[10px] text-stone-400 mt-1">
                      Document type is fixed once submitted. Use this form to update the number or upload a clearer file.
                    </p>
                  )}
                </div>

                {/* Document Number */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-stone-600">
                      {activeDocType === "AADHAAR" ? "Aadhaar Card Number (12 Digits)" : "Driving Licence Number"} <span className="text-rose-500">*</span>
                    </label>
                    {activeDocType === "AADHAAR" && (
                      <span className={`text-[10px] font-mono font-semibold ${docNumberInput.length === 12 ? "text-emerald-600" : "text-stone-400"}`}>
                        {docNumberInput.length} / 12 digits
                      </span>
                    )}
                  </div>
                  <input
                    type="text"
                    required
                    maxLength={activeDocType === "AADHAAR" ? 12 : 20}
                    value={docNumberInput}
                    onChange={(e) => {
                      if (activeDocType === "AADHAAR") {
                        // Strictly digits only, maximum 12 digits
                        const digits = e.target.value.replace(/\D/g, "").slice(0, 12);
                        setDocNumberInput(digits);
                      } else {
                        const val = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 20);
                        setDocNumberInput(val);
                      }
                    }}
                    placeholder={activeDocType === "AADHAAR" ? "e.g. 234123412341 (12 digits)" : "e.g. BR097826H8HMK03N3303"}
                    className="block w-full rounded-xl border border-stone-200 bg-[#FAFAFA] px-3.5 py-2.5 text-sm font-mono text-black uppercase focus:border-black focus:bg-white focus:outline-none transition-colors"
                  />
                  {activeDocType === "AADHAAR" && (docNumberInput.startsWith("0") || docNumberInput.startsWith("1")) && (
                    <p className="text-[11px] text-rose-500 font-semibold mt-1">
                      Aadhaar number cannot start with 0 or 1.
                    </p>
                  )}
                  <p className="text-[10px] text-stone-400 mt-1">
                    {activeDocType === "AADHAAR"
                      ? "Aadhaar must be exactly 12 digits and cannot start with 0 or 1."
                      : "Driving licence must be 8–20 letters and digits."}
                  </p>
                </div>

                {/* Document URL & File Selector */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-stone-600">
                      Document File URL <span className="text-rose-500">*</span>
                    </label>
                    <label
                      htmlFor="modal-doc-file-upload"
                      className="inline-flex items-center gap-1 text-[11px] font-medium text-black hover:underline cursor-pointer"
                    >
                      <Camera className="w-3 h-3" />
                      <span>Select Photo</span>
                      <input
                        id="modal-doc-file-upload"
                        type="file"
                        accept="image/*"
                        className="sr-only"
                        onChange={handleDocFileUpload}
                      />
                    </label>
                  </div>
                  <input
                    type="url"
                    required
                    value={docUrlInput}
                    onChange={(e) => setDocUrlInput(e.target.value)}
                    placeholder="https://files.example.com/document.jpg"
                    className="block w-full rounded-xl border border-stone-200 bg-[#FAFAFA] px-3.5 py-2.5 text-sm font-mono text-black focus:border-black focus:bg-white focus:outline-none transition-colors"
                  />

                  {/* Image Preview Box in Modal */}
                  {docUrlInput && (
                    <div className="relative h-32 w-full rounded-xl overflow-hidden border border-stone-200 bg-neutral-900 mt-2">
                      <Image
                        src={docUrlInput}
                        alt="Document Preview"
                        fill
                        unoptimized
                        className="object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end p-2.5">
                        <span className="text-[10px] font-semibold text-white uppercase tracking-wider">
                          Ready for submission
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Swagger Policy Notice */}
                <div className="p-3 rounded-xl bg-[#FAFAF8] border border-[#EDEDE8] text-[11px] text-stone-500">
                  Per Ridezy Trust &amp; Safety rules, submitted documents enter <span className="font-semibold text-black">PENDING</span> review. Verification is processed by operations admins within 24 hours.
                </div>

                {/* Modal Buttons */}
                <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#F0EFEA]">
                  <button
                    type="button"
                    onClick={() => setIsDocModalOpen(false)}
                    className="px-4 py-2.5 rounded-xl border border-stone-200 text-stone-700 text-xs font-semibold hover:bg-stone-50 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingDoc}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-black text-white text-xs font-semibold hover:bg-neutral-800 disabled:opacity-50 transition-all cursor-pointer shadow-xs"
                  >
                    {isSavingDoc ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        <span>Submitting...</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4" />
                        <span>{editingDocId ? "Re-submit Document" : "Submit Document"}</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* DOCUMENT PREVIEW LIGHTBOX MODAL                                           */}
        {/* ========================================================================= */}
        {docPreviewModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-200">
            <div className="w-full max-w-2xl bg-white rounded-3xl overflow-hidden border border-stone-800 shadow-2xl">
              <div className="p-4 sm:p-5 flex items-center justify-between border-b border-[#F0EFEA] bg-white">
                <div>
                  <h3 className="font-caslon text-xl font-bold text-black">{docPreviewModal.title}</h3>
                  <p className="text-xs text-stone-500 font-mono mt-0.5">
                    {docPreviewModal.number} &bull; Status: {docPreviewModal.status}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setDocPreviewModal(null)}
                  className="p-1.5 rounded-xl text-stone-500 hover:text-black hover:bg-stone-100 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="relative h-80 sm:h-96 w-full bg-neutral-900">
                <Image
                  src={docPreviewModal.url}
                  alt={docPreviewModal.title}
                  fill
                  unoptimized
                  className="object-contain p-2"
                />
              </div>

              <div className="p-4 bg-[#FAFAF8] border-t border-[#EDEDE8] flex items-center justify-between text-xs">
                <a
                  href={docPreviewModal.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-stone-600 hover:text-black transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Open direct file URL</span>
                </a>
                <button
                  type="button"
                  onClick={() => setDocPreviewModal(null)}
                  className="px-4 py-2 rounded-xl bg-black text-white text-xs font-semibold hover:bg-neutral-800 transition-all cursor-pointer"
                >
                  Close Viewer
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* DELETE VEHICLE CONFIRMATION MODAL                                         */}
        {/* ========================================================================= */}
        {isDeleteVehicleModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-200">
            <div className="w-full max-w-md bg-white rounded-3xl border border-[#EDEDE8] shadow-2xl p-6 sm:p-7 space-y-5">
              <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center">
                <Trash2 className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="font-caslon text-xl font-bold text-black">Remove Registered Vehicle?</h3>
                <p className="text-xs text-stone-500">
                  Are you sure you want to delete your authorized vehicle? Removing your vehicle will temporarily make you ineligible for passenger dispatch until a new commercial vehicle is registered.
                </p>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#F0EFEA]">
                <button
                  type="button"
                  onClick={() => setIsDeleteVehicleModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-stone-200 text-stone-700 text-xs font-semibold hover:bg-stone-50 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isDeletingVehicle}
                  onClick={handleConfirmDeleteVehicle}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-rose-600 text-white text-xs font-semibold hover:bg-rose-700 disabled:opacity-50 transition-all cursor-pointer shadow-xs"
                >
                  {isDeletingVehicle ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Deleting...</span>
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4" />
                      <span>Yes, Remove Vehicle</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* DELETE DRIVER PROFILE CONFIRMATION MODAL                                  */}
        {/* ========================================================================= */}
        {isDeleteProfileModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-200">
            <div className="w-full max-w-md bg-white rounded-3xl border border-[#EDEDE8] shadow-2xl p-6 sm:p-7 space-y-5">
              <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center">
                <Trash2 className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="font-caslon text-xl font-bold text-black">Delete Driver Profile &amp; Account?</h3>
                <p className="text-xs text-stone-500 leading-relaxed">
                  Are you sure you want to permanently delete your driver profile? This will remove your driver profile data, commercial vehicle registration, and submitted KYC documents. You will be logged out immediately.
                </p>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#F0EFEA]">
                <button
                  type="button"
                  disabled={isDeletingProfile}
                  onClick={() => setIsDeleteProfileModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-stone-200 text-stone-700 text-xs font-semibold hover:bg-stone-50 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isDeletingProfile}
                  onClick={handleConfirmDeleteProfile}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-rose-600 text-white text-xs font-semibold hover:bg-rose-700 disabled:opacity-50 transition-all cursor-pointer shadow-xs"
                >
                  {isDeletingProfile ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Deleting Profile...</span>
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4" />
                      <span>Yes, Delete My Account</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

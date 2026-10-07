"use client";

import React, { useState, useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Mail,
  User,
  Lock,
  Eye,
  EyeOff,
  Check,
  CheckCircle2,
  ShieldCheck,
  UserCheck,
  Car,
  ArrowLeft,
  ChevronDown,
  AlertCircle,
  Info,
  X,
  CreditCard,
} from "lucide-react";

const API_BASE = "http://localhost:5000/api";

interface ToastItem {
  id: string;
  type: "success" | "error" | "info";
  message: string;
}

type RoleEnum = "PASSENGER" | "DRIVER";
type GenderEnum = "male" | "female" | "other";

const MONTHS = [
  { value: "01", label: "January" },
  { value: "02", label: "February" },
  { value: "03", label: "March" },
  { value: "04", label: "April" },
  { value: "05", label: "May" },
  { value: "06", label: "June" },
  { value: "07", label: "July" },
  { value: "08", label: "August" },
  { value: "09", label: "September" },
  { value: "10", label: "October" },
  { value: "11", label: "November" },
  { value: "12", label: "December" },
];

const DAYS = Array.from({ length: 31 }, (_, i) => {
  const d = String(i + 1).padStart(2, "0");
  return { value: d, label: d };
});

const YEARS = Array.from({ length: 80 }, (_, i) => {
  const y = String(2012 - i);
  return { value: y, label: y };
});

/* ========================================================================= */
/* Custom Downward-Only Dropdown Component                                   */
/* ========================================================================= */
interface CustomSelectProps {
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
  ariaLabel?: string;
}

function CustomSelect({ value, options, onChange, ariaLabel }: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const selectedOption = options.find((o) => o.value === value);

  return (
    <div ref={containerRef} className="relative w-full">
      <button
        type="button"
        aria-label={ariaLabel}
        onClick={() => setIsOpen((prev) => !prev)}
        className="w-full flex items-center justify-between rounded-xl border border-zinc-200 bg-[#FAFAFA] py-2.5 sm:py-3 px-3 text-xs sm:text-sm text-black font-medium focus:border-black focus:bg-white focus:outline-none focus:ring-1 focus:ring-black transition-colors cursor-pointer text-left"
      >
        <span className="truncate">{selectedOption ? selectedOption.label : value}</span>
        <ChevronDown
          className={`h-4 w-4 text-zinc-400 shrink-0 ml-1.5 transition-transform duration-200 ${
            isOpen ? "rotate-180 text-black" : ""
          }`}
        />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1.5 z-50 max-h-52 sm:max-h-56 overflow-y-auto rounded-xl border border-zinc-200 bg-white p-1 shadow-[0_12px_28px_rgba(0,0,0,0.12)]">
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
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs sm:text-sm transition-colors text-left cursor-pointer ${
                  isSelected
                    ? "bg-black text-white font-semibold"
                    : "text-zinc-800 hover:bg-zinc-100"
                }`}
              >
                <span>{opt.label}</span>
                {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-white shrink-0 ml-1" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ========================================================================= */
/* Stepper Configuration: Swapped Login (03) and Personal Info (04)          */
/* ========================================================================= */
const STEP_ITEMS = [
  { id: 1, key: "REGISTER" as const, label: "01" },
  { id: 2, key: "OTP" as const, label: "02" },
  { id: 3, key: "LOGIN" as const, label: "03" },
  { id: 4, key: "PERSONAL_INFO" as const, label: "04" },
  { id: 5, key: "DONE" as const, label: "05" },
];

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState<"REGISTER" | "OTP" | "LOGIN" | "PERSONAL_INFO" | "DONE">("REGISTER");

  // Track max step reached for back/forth navigation
  const [maxStepReached, setMaxStepReached] = useState<number>(1);

  // Directly redirect to dashboard if user is already logged in
  useEffect(() => {
    if (typeof window !== "undefined") {
      const token = localStorage.getItem("token");
      const savedRole = localStorage.getItem("userRole");
      if (token) {
        router.replace(savedRole === "DRIVER" ? "/driver" : "/dashboard");
      }
    }
  }, [router]);

  // Form State
  const [role, setRole] = useState<RoleEnum>("PASSENGER");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // OTP State (6 digits)
  const [otp, setOtp] = useState<string[]>(["", "", "", "", "", ""]);
  const [resendSeconds, setResendSeconds] = useState(19);
  const otpInputs = useRef<(HTMLInputElement | null)[]>([]);

  // Personal Info State
  const [birthMonth, setBirthMonth] = useState("01");
  const [birthDay, setBirthDay] = useState("15");
  const [birthYear, setBirthYear] = useState("2000");
  const [gender, setGender] = useState<GenderEnum>("female");
  const [licenseNumber, setLicenseNumber] = useState("");

  const [isLoading, setIsLoading] = useState(false);
  const [toasts, setToasts] = useState<ToastItem[]>([]);

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

  // Derive Current Step Number (1 to 5) with swapped order
  const currentStepId =
    step === "REGISTER"
      ? 1
      : step === "OTP"
      ? 2
      : step === "LOGIN"
      ? 3
      : step === "PERSONAL_INFO"
      ? 4
      : 5; // DONE is 5

  // Keep maxStepReached updated
  useEffect(() => {
    if (currentStepId > maxStepReached) {
      setMaxStepReached(currentStepId);
    }
  }, [currentStepId, maxStepReached]);

  // Resend Countdown Timer
  useEffect(() => {
    if (step !== "OTP" || resendSeconds <= 0) return;
    const timer = setInterval(() => {
      setResendSeconds((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [step, resendSeconds]);

  // Step 5: Smooth automatic redirect to Dashboard based on selected role
  useEffect(() => {
    if (step !== "DONE") return;

    // Persist role & profile details in localStorage
    if (typeof window !== "undefined") {
      localStorage.setItem("userRole", role);
      localStorage.setItem("userName", name);
      localStorage.setItem("userEmail", email);
      localStorage.setItem("userPhone", phone);
      if (licenseNumber) {
        localStorage.setItem("userLicenseNumber", licenseNumber.trim().toUpperCase());
      }
    }

    const storedRole = typeof window !== "undefined" ? localStorage.getItem("userRole") : null;
    const destination = (storedRole || role) === "DRIVER" ? "/driver" : "/dashboard";

    const timer = setTimeout(() => {
      router.push(destination);
    }, 2200);

    return () => clearTimeout(timer);
  }, [step, role, router, name, email, phone, licenseNumber]);

  // Step 1: Register Submit -> Connects to POST /api/auth/register
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || !name || !phone) return;

    setIsLoading(true);
    try {
      const cleanPhone = "+91" + phone.replace(/\D/g, "").slice(-10);
      const res = await fetch(`${API_BASE}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim().toLowerCase(),
          phone: cleanPhone,
          password,
          role,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok && data.success) {
        showToast(data.message, "success");
        if (typeof window !== "undefined") {
          localStorage.setItem("userRole", role);
        }
        if (data.otp && typeof data.otp === "string") {
          const otpDigits = data.otp.split("").slice(0, 6);
          setOtp(otpDigits);
        }
        setStep("OTP");
        setResendSeconds(60);
      } else {
        const errorMsg =
          data.errors?.[0]?.message || data.message || "Registration failed.";
        showToast(errorMsg, "error");
      }
    } catch {
      showToast("Cannot connect to server. Please ensure backend is running.", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const [lastAttemptedOtp, setLastAttemptedOtp] = useState<string>("");

  // OTP Input Handlers
  const handleOtpChange = (index: number, value: string) => {
    const digit = value.replace(/\D/g, "").slice(-1);
    const newOtp = [...otp];
    newOtp[index] = digit;
    setOtp(newOtp);
    setLastAttemptedOtp("");

    if (digit && index < 5) {
      otpInputs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (
    index: number,
    e: React.KeyboardEvent<HTMLInputElement>
  ) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      otpInputs.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!pasted) return;
    const newOtp = [...otp];
    for (let i = 0; i < 6; i++) {
      newOtp[i] = pasted[i] || "";
    }
    setOtp(newOtp);
    setLastAttemptedOtp("");
    const lastFilled = Math.min(pasted.length, 5);
    otpInputs.current[lastFilled]?.focus();
  };

  // Central executeVerify function for both button click and auto-submit
  const executeVerify = async (otpCode: string) => {
    if (!otpCode || otpCode.length < 6 || isLoading || otpCode === lastAttemptedOtp) return;
    setLastAttemptedOtp(otpCode);
    setIsLoading(true);

    try {
      const res = await fetch(`${API_BASE}/auth/verify-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          otp: otpCode,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok && data.success) {
        showToast(data.message, "success");
        setStep("LOGIN");
      } else {
        const errorMsg =
          data.errors?.[0]?.message || data.message || "Invalid or expired OTP.";
        showToast(errorMsg, "error");
      }
    } catch {
      showToast("Cannot connect to server. Please try again.", "error");
    } finally {
      setIsLoading(false);
    }
  };

  // Step 2: Verify OTP
  const handleVerifySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const otpCode = otp.join("");
    if (otpCode.length === 6) {
      executeVerify(otpCode);
    }
  };

  // Automatically submit OTP when all 6 digits are populated
  useEffect(() => {
    if (step !== "OTP") return;
    const otpCode = otp.join("");
    if (otpCode.length === 6 && otpCode !== lastAttemptedOtp && !isLoading) {
      const timer = setTimeout(() => {
        executeVerify(otpCode);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [step, otp, lastAttemptedOtp, isLoading]);

  // Resend OTP -> Connects to POST /api/auth/resend-otp
  const handleResend = async () => {
    if (resendSeconds > 0) return;

    try {
      const res = await fetch(`${API_BASE}/auth/resend-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok && data.success) {
        showToast(data.message, "success");
        if (data.otp && typeof data.otp === "string") {
          const otpDigits = data.otp.split("").slice(0, 6);
          setOtp(otpDigits);
          setLastAttemptedOtp("");
        }
        setResendSeconds(60);
      } else {
        const errorMsg =
          data.errors?.[0]?.message || data.message || "Could not resend OTP.";
        showToast(errorMsg, "error");
      }
    } catch {
      showToast("Failed to request new code. Please try again.", "error");
    }
  };

  // Step 3: Login Submit -> Connects to POST /api/auth/login
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;

    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          password,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok && data.success) {
        showToast(data.message, "success");
        const resolvedRole = data.data?.user?.role || localStorage.getItem("userRole") || role;
        if (data.data?.token) {
          localStorage.setItem("token", data.data.token);
        }
        if (data.data?.user) {
          localStorage.setItem("user", JSON.stringify(data.data.user));
          if (data.data.user.role) {
            setRole(data.data.user.role);
            localStorage.setItem("userRole", data.data.user.role);
          }
          if (data.data.user.name) {
            setName(data.data.user.name);
            localStorage.setItem("userName", data.data.user.name);
          }
          if (data.data.user.email) {
            localStorage.setItem("userEmail", data.data.user.email);
          }
          if (data.data.user.phone) {
            localStorage.setItem("userPhone", data.data.user.phone);
          }
        }

        const destination = resolvedRole === "DRIVER" ? "/driver" : "/dashboard";
        router.push(destination);
        setTimeout(() => {
          if (typeof window !== "undefined" && window.location.pathname !== destination) {
            window.location.href = destination;
          }
        }, 300);
      } else {
        const errorMsg =
          data.errors?.[0]?.message || data.message || "Invalid email or password.";
        showToast(errorMsg, "error");
      }
    } catch {
      showToast("Cannot connect to server. Please try again.", "error");
    } finally {
      setIsLoading(false);
    }
  };

  // Step 4: Personal Info Submit -> Updates profile & transitions to DONE
  const handlePersonalInfoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!birthDay || !birthMonth || !birthYear || !gender) return;

    const storedRole =
      typeof window !== "undefined" ? (localStorage.getItem("userRole") as RoleEnum) : null;
    const effectiveRole = storedRole || role;

    const finalLicense = licenseNumber.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
    if (effectiveRole === "DRIVER") {
      if (!finalLicense) {
        showToast("Driver licence no is required.", "error");
        return;
      }
      if (finalLicense.length < 15 || finalLicense.length > 16) {
        showToast("Driver licence no must be 15 to 16 alphanumeric characters.", "error");
        return;
      }
    }

    setIsLoading(true);
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
      const formattedDob = `${birthYear}-${birthMonth}-${birthDay}`;
      const backendGender = gender.toUpperCase();

      if (token) {
        const profileEndpoint =
          effectiveRole === "DRIVER"
            ? `${API_BASE}/drivers/profile`
            : `${API_BASE}/passengers/profile`;

        const profilePayload =
          effectiveRole === "DRIVER"
            ? {
                dateOfBirth: formattedDob,
                gender: backendGender,
                licenseNumber: finalLicense,
              }
            : {
                dateOfBirth: formattedDob,
                gender: backendGender,
              };

        let res = await fetch(profileEndpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(profilePayload),
        });

        let data = await res.json().catch(() => ({}));

        if (res.status === 409) {
          // Profile already exists -> update via PATCH
          res = await fetch(profileEndpoint, {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(profilePayload),
          });
          data = await res.json().catch(() => ({}));
        }

        if (res.ok && data.success) {
          showToast(data.message, "success");
        } else if (data.message) {
          showToast(data.errors?.[0]?.message || data.message, res.ok ? "success" : "info");
        }
      }

      setStep("DONE");
    } catch {
      setStep("DONE");
    } finally {
      setIsLoading(false);
    }
  };

  const handleStepClick = (item: (typeof STEP_ITEMS)[number]) => {
    if (item.id <= maxStepReached) {
      setStep(item.key);
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col lg:flex-row bg-white text-black selection:bg-black selection:text-white">
      {/* LEFT SIDE: Dynamic Content Column */}
      <div className="w-full lg:w-1/2 xl:w-[48%] min-h-screen flex flex-col justify-between px-6 sm:px-12 md:px-14 lg:px-14 xl:px-20 py-8 lg:py-10 bg-white z-10 overflow-y-auto">
        {/* Top Header: Logo + Back Navigation */}
        <div className="flex items-center justify-between w-full shrink-0">
          <Link
            href="/"
            className="flex items-center gap-2.5 group transition-transform active:scale-95"
            aria-label="Ridezy Home"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-black text-white shadow-[0_4px_14px_rgba(0,0,0,0.18)] transition-colors group-hover:bg-neutral-800">
              <svg
                viewBox="0 0 24 24"
                className="h-4 w-4"
                fill="currentColor"
                aria-hidden="true"
              >
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5z" />
              </svg>
            </span>
            <span className="text-xl font-bold tracking-tight text-black">
              Ridezy
            </span>
          </Link>

          {step !== "REGISTER" && step !== "DONE" && (
            <button
              type="button"
              onClick={() => {
                if (step === "OTP") setStep("REGISTER");
                else if (step === "LOGIN") setStep("OTP");
                else if (step === "PERSONAL_INFO") setStep("LOGIN");
              }}
              className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-zinc-600 hover:text-black transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back</span>
            </button>
          )}
        </div>

        {/* ========================================================= */}
        {/* WORKABLE PROGRESS STEPPER (Compact & refined, less bold)  */}
        {/* ========================================================= */}
        <div className="w-full max-w-[420px] mx-auto pt-5 sm:pt-6 pb-6 sm:pb-7 shrink-0">
          <div className="flex items-center justify-between relative">
            {STEP_ITEMS.map((item, index) => {
              const isCompleted = item.id < currentStepId;
              const isCurrent = item.id === currentStepId;
              const isClickable = item.id <= maxStepReached;

              return (
                <React.Fragment key={item.id}>
                  {/* Circle Node: Compact, refined & less bold */}
                  <button
                    type="button"
                    disabled={!isClickable}
                    onClick={() => handleStepClick(item)}
                    aria-label={`Step ${item.label}`}
                    className={`relative z-10 w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center shrink-0 transition-colors duration-200 select-none ${
                      isCompleted || isCurrent
                        ? "bg-black text-white border border-black shadow-xs"
                        : "bg-white text-zinc-400 border border-zinc-200"
                    } ${
                      isClickable ? "cursor-pointer" : "cursor-default"
                    }`}
                  >
                    {isCompleted || isCurrent ? (
                      <Check className="w-3.5 h-3.5 stroke-[2] text-white" />
                    ) : (
                      <span className="text-[11px] sm:text-xs font-normal tracking-tight">
                        {item.label}
                      </span>
                    )}
                  </button>

                  {/* Connecting Line between steps: Refined 1.5px line */}
                  {index < STEP_ITEMS.length - 1 && (
                    <div className="flex-1 h-[1.5px] mx-1.5 sm:mx-2 relative overflow-hidden bg-zinc-200 rounded-full">
                      <div
                        className={`h-full bg-black transition-all duration-300 ${
                          isCompleted ? "w-full" : isCurrent ? "w-1/2" : "w-0"
                        }`}
                      />
                    </div>
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>

        {/* Center Content: Anchored below the fixed stepper */}
        <div className="w-full max-w-[420px] mx-auto flex-1 flex flex-col justify-start pb-6">
          {/* Form Content per Step */}
          {step === "DONE" ? (
            /* ========================================================= */
            /* STEP 5: ONBOARDING COMPLETED VIEW                         */
            /* ========================================================= */
            <div className="flex flex-col items-center justify-center text-center py-6 sm:py-8 my-auto animate-in fade-in duration-500">
              {/* Verified Starburst Badge from user reference */}
              <div className="relative w-28 h-28 sm:w-32 sm:h-32 mb-6 drop-shadow-[0_12px_28px_rgba(0,0,0,0.15)] transition-transform duration-500 hover:scale-105">
                <Image
                  src="/completed-badge.png"
                  alt="Onboarding completed badge"
                  fill
                  priority
                  className="object-contain select-none"
                />
              </div>

              {/* Title & Subtitle */}
              <h1 className="font-caslon text-3xl sm:text-4xl lg:text-[42px] font-bold text-black tracking-tight leading-[1.1] mb-2.5">
                Onboarding completed!
              </h1>
              <p className="text-base sm:text-lg text-zinc-600 font-medium tracking-tight">
                Enjoy the journey
              </p>
            </div>
          ) : step === "LOGIN" ? (
            /* ========================================================= */
            /* STEP 3: LOGIN CONTENT (Just Email & Password)             */
            /* ========================================================= */
            <div>
              <div className="mb-6">
                <h1 className="font-caslon text-3xl sm:text-4xl lg:text-[40px] font-bold text-black tracking-tight leading-[1.08]">
                  Log in
                </h1>
                <p className="text-sm text-zinc-500 font-normal mt-2 leading-relaxed">
                  Enter your email and password to access your account.
                </p>
              </div>

              <form onSubmit={handleLoginSubmit} className="space-y-4">
                {/* Email Address */}
                <div>
                  <label
                    htmlFor="login-email"
                    className="block text-[11px] font-semibold text-zinc-700 uppercase tracking-wider mb-1.5"
                  >
                    Email address
                  </label>
                  <div className="relative rounded-xl shadow-2xs">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-zinc-400">
                      <Mail className="h-4 w-4" />
                    </div>
                    <input
                      id="login-email"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="name@example.com"
                      className="block w-full rounded-xl border border-zinc-200 bg-[#FAFAFA] pl-10 pr-3.5 py-2.5 sm:py-3 text-sm text-black placeholder-zinc-400 focus:border-black focus:bg-white focus:outline-none focus:ring-1 focus:ring-black transition-colors"
                    />
                  </div>
                </div>

                {/* Password */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label
                      htmlFor="login-password"
                      className="block text-[11px] font-semibold text-zinc-700 uppercase tracking-wider"
                    >
                      Password
                    </label>
                    <button
                      type="button"
                      className="text-xs text-zinc-500 hover:text-black underline cursor-pointer"
                    >
                      Forgot password?
                    </button>
                  </div>
                  <div className="relative rounded-xl shadow-2xs">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-zinc-400">
                      <Lock className="h-4 w-4" />
                    </div>
                    <input
                      id="login-password"
                      type={showPassword ? "text" : "password"}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter your password"
                      className="block w-full rounded-xl border border-zinc-200 bg-[#FAFAFA] pl-10 pr-10 py-2.5 sm:py-3 text-sm text-black placeholder-zinc-400 focus:border-black focus:bg-white focus:outline-none focus:ring-1 focus:ring-black transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-zinc-400 hover:text-black cursor-pointer"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Log in Button */}
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-black hover:bg-neutral-800 active:scale-[0.99] px-6 py-3 sm:py-3.5 text-sm sm:text-base font-semibold text-white shadow-md hover:shadow-xl transition-all duration-200 cursor-pointer disabled:opacity-75 disabled:cursor-not-allowed mt-4"
                >
                  {isLoading ? (
                    <>
                      <svg
                        className="animate-spin h-4 w-4 text-white"
                        viewBox="0 0 24 24"
                        fill="none"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        ></circle>
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8v8H4z"
                        ></path>
                      </svg>
                      <span>Continuing...</span>
                    </>
                  ) : (
                    <span>Log in</span>
                  )}
                </button>
              </form>

              <div className="mt-5 text-center text-xs sm:text-sm text-zinc-600">
                Don&apos;t have an account?{" "}
                <button
                  type="button"
                  onClick={() => setStep("REGISTER")}
                  className="font-bold text-black underline underline-offset-4 hover:text-neutral-700 cursor-pointer"
                >
                  Sign up
                </button>
              </div>
            </div>
          ) : step === "PERSONAL_INFO" ? (
            /* ========================================================= */
            /* STEP 4: PERSONAL INFORMATION (DOB Dropdowns & Gender)     */
            /* ========================================================= */
            <div>
              <div className="mb-6">
                <h1 className="font-caslon text-3xl sm:text-4xl lg:text-[40px] font-bold text-black tracking-tight leading-[1.08]">
                  Personal Info
                </h1>
                <p className="text-sm text-zinc-500 font-normal mt-2 leading-relaxed">
                  Tell us a bit about yourself to complete your profile.
                </p>
              </div>

              <form onSubmit={handlePersonalInfoSubmit} className="space-y-5">
                {/* Date of Birth Dropdowns */}
                <div>
                  <label className="block text-[11px] font-semibold text-zinc-700 uppercase tracking-wider mb-2">
                    Date of Birth
                  </label>
                  <div className="grid grid-cols-3 gap-2 sm:gap-2.5">
                    <CustomSelect
                      value={birthMonth}
                      options={MONTHS}
                      onChange={setBirthMonth}
                      ariaLabel="Birth Month"
                    />
                    <CustomSelect
                      value={birthDay}
                      options={DAYS}
                      onChange={setBirthDay}
                      ariaLabel="Birth Day"
                    />
                    <CustomSelect
                      value={birthYear}
                      options={YEARS}
                      onChange={setBirthYear}
                      ariaLabel="Birth Year"
                    />
                  </div>
                </div>

                {/* Gender Selection */}
                <div>
                  <label className="block text-[11px] font-semibold text-zinc-700 uppercase tracking-wider mb-2">
                    Gender
                  </label>
                  <div className="grid grid-cols-3 gap-2.5">
                    {(
                      [
                        { key: "male", label: "Male" },
                        { key: "female", label: "Female" },
                        { key: "other", label: "Other" },
                      ] as const
                    ).map((g) => {
                      const isSelected = gender === g.key;
                      return (
                        <button
                          key={g.key}
                          type="button"
                          onClick={() => setGender(g.key)}
                          className={`flex items-center justify-center py-2.5 px-3 rounded-xl text-xs sm:text-sm font-semibold transition-all border cursor-pointer ${
                            isSelected
                              ? "bg-black text-white border-black shadow-xs"
                              : "bg-white text-zinc-700 border-zinc-200 hover:border-black hover:bg-zinc-50"
                          }`}
                        >
                          <span>{g.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Driver licence no (Required for Driver) */}
                {role === "DRIVER" && (
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label
                        htmlFor="driver-license"
                        className="block text-[11px] font-semibold text-zinc-700 uppercase tracking-wider"
                      >
                        Driver licence no
                      </label>
                      <span className="text-[10px] text-zinc-500 font-medium tracking-tight">
                        {licenseNumber ? `${licenseNumber.length}/16 chars` : "15–16 alphanumeric characters"}
                      </span>
                    </div>
                    <div className="relative rounded-xl shadow-2xs">
                      <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-zinc-400">
                        <CreditCard className="h-4 w-4" />
                      </div>
                      <input
                        id="driver-license"
                        type="text"
                        required
                        maxLength={16}
                        value={licenseNumber}
                        onChange={(e) => {
                          const cleaned = e.target.value
                            .replace(/[^a-zA-Z0-9]/g, "")
                            .toUpperCase()
                            .slice(0, 16);
                          setLicenseNumber(cleaned);
                        }}
                        placeholder="DL1420110012345"
                        className="block w-full rounded-xl border border-zinc-200 bg-[#FAFAFA] pl-10 pr-3.5 py-2.5 sm:py-3 text-sm text-black placeholder-zinc-400 focus:border-black focus:bg-white focus:outline-none focus:ring-1 focus:ring-black transition-colors font-mono tracking-wider uppercase"
                      />
                    </div>
                    <p className="mt-1 text-[11px] text-zinc-500">
                      Must be 15 to 16 alphanumeric characters.
                    </p>
                  </div>
                )}

                {/* Complete Profile Button */}
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-black hover:bg-neutral-800 active:scale-[0.99] px-6 py-3 sm:py-3.5 text-sm sm:text-base font-semibold text-white shadow-md hover:shadow-xl transition-all duration-200 cursor-pointer disabled:opacity-75 disabled:cursor-not-allowed mt-4"
                >
                  {isLoading ? (
                    <>
                      <svg
                        className="animate-spin h-4 w-4 text-white"
                        viewBox="0 0 24 24"
                        fill="none"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        ></circle>
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8v8H4z"
                        ></path>
                      </svg>
                      <span>Completing Profile...</span>
                    </>
                  ) : (
                    <span>Complete Profile</span>
                  )}
                </button>
              </form>
            </div>
          ) : step === "OTP" ? (
            /* ========================================================= */
            /* STEP 2: OTP VERIFICATION VIEW                             */
            /* ========================================================= */
            <div>
              <div className="mb-6">
                <h1 className="font-caslon text-3xl sm:text-4xl lg:text-[40px] font-bold text-black tracking-tight leading-[1.08]">
                  Verify your email
                </h1>
                <p className="text-sm text-zinc-500 font-normal mt-2 leading-relaxed">
                  We&apos;ve sent a 6-digit code to{" "}
                  <span className="font-semibold text-black">
                    {email || "your email"}
                  </span>
                </p>
              </div>

              <form onSubmit={handleVerifySubmit} className="space-y-6">
                {otp.every((d) => d && /\d/.test(d)) && (
                  <div className="flex justify-center -mt-2 mb-1">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 text-xs font-medium border border-emerald-200">
                      <Check className="w-3.5 h-3.5 text-emerald-600 stroke-[2.5]" />
                      Code auto-filled &amp; verifying...
                    </span>
                  </div>
                )}
                {/* 6 Digit Input Boxes */}
                <div
                  className="flex items-center justify-between gap-2 sm:gap-2.5"
                  onPaste={handleOtpPaste}
                >
                  {otp.map((digit, index) => (
                    <input
                      key={index}
                      ref={(el) => {
                        otpInputs.current[index] = el;
                      }}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleOtpChange(index, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(index, e)}
                      className="w-11 sm:w-13 h-13 sm:h-14 text-center text-lg sm:text-2xl font-normal rounded-xl border border-zinc-200 bg-[#FAFAFA] text-black focus:border-black focus:bg-white focus:outline-none focus:ring-1 focus:ring-black transition-all shadow-2xs"
                    />
                  ))}
                </div>

                {/* Resend in countdown */}
                <div className="text-center text-xs sm:text-sm text-zinc-500">
                  Didn&apos;t receive the code?{" "}
                  {resendSeconds > 0 ? (
                    <span className="font-semibold text-black">
                      Resend in 00:{String(resendSeconds).padStart(2, "0")}
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={handleResend}
                      className="font-bold text-black underline underline-offset-4 hover:text-neutral-700 cursor-pointer"
                    >
                      Resend code
                    </button>
                  )}
                </div>

                {/* Verify Button in Black & White */}
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-black hover:bg-neutral-800 active:scale-[0.99] px-6 py-3 sm:py-3.5 text-sm sm:text-base font-semibold text-white shadow-md hover:shadow-xl transition-all duration-200 cursor-pointer disabled:opacity-75 disabled:cursor-not-allowed"
                >
                  {isLoading ? (
                    <>
                      <svg
                        className="animate-spin h-4 w-4 text-white"
                        viewBox="0 0 24 24"
                        fill="none"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        ></circle>
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8v8H4z"
                        ></path>
                      </svg>
                      <span>Verifying...</span>
                    </>
                  ) : (
                    <span>Verify</span>
                  )}
                </button>
              </form>
            </div>
          ) : (
            /* ========================================================= */
            /* STEP 1: INITIAL REGISTRATION FORM VIEW                    */
            /* ========================================================= */
            <div>
              <div className="mb-5 sm:mb-6">
                <h1 className="font-caslon text-3xl sm:text-4xl lg:text-[40px] font-bold text-black tracking-tight leading-[1.08]">
                  Create your account
                </h1>
              </div>

              <form onSubmit={handleRegisterSubmit} className="space-y-3.5 sm:space-y-4">
                {/* User Name */}
                <div>
                  <label
                    htmlFor="user-name"
                    className="block text-[11px] font-semibold text-zinc-700 uppercase tracking-wider mb-1.5"
                  >
                    User Name
                  </label>
                  <div className="relative rounded-xl shadow-2xs">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-zinc-400">
                      <User className="h-4 w-4" />
                    </div>
                    <input
                      id="user-name"
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Enter your name"
                      className="block w-full rounded-xl border border-zinc-200 bg-[#FAFAFA] pl-10 pr-3.5 py-2.5 sm:py-3 text-sm text-black placeholder-zinc-400 focus:border-black focus:bg-white focus:outline-none focus:ring-1 focus:ring-black transition-colors"
                    />
                  </div>
                </div>

                {/* Phone Number with permanent Indian Flag and +91 */}
                <div>
                  <label
                    htmlFor="user-phone"
                    className="block text-[11px] font-semibold text-zinc-700 uppercase tracking-wider mb-1.5"
                  >
                    Phone No
                  </label>
                  <div className="relative rounded-xl shadow-2xs">
                    <div className="absolute inset-y-0 left-0 flex items-center pl-3 pr-2.5 gap-2 border-r border-zinc-200 select-none bg-zinc-50/50 rounded-l-xl">
                      <span className="inline-flex w-5 h-3.5 rounded-[2px] overflow-hidden shadow-[0_0_1px_rgba(0,0,0,0.3)] shrink-0">
                        <svg
                          viewBox="0 0 24 16"
                          className="w-full h-full"
                          aria-label="India flag"
                        >
                          <rect width="24" height="5.33" fill="#FF9933" />
                          <rect y="5.33" width="24" height="5.34" fill="#FFFFFF" />
                          <rect y="10.67" width="24" height="5.33" fill="#138808" />
                          <circle
                            cx="12"
                            cy="8"
                            r="2.1"
                            fill="none"
                            stroke="#000088"
                            strokeWidth="0.7"
                          />
                          <circle cx="12" cy="8" r="0.5" fill="#000088" />
                        </svg>
                      </span>
                      <span className="text-xs sm:text-sm font-semibold text-zinc-900 tracking-tight">
                        +91
                      </span>
                    </div>
                    <input
                      id="user-phone"
                      type="tel"
                      required
                      value={phone}
                      onChange={(e) => {
                        const cleaned = e.target.value.replace(/\D/g, "").slice(0, 10);
                        setPhone(cleaned);
                      }}
                      placeholder="Enter 10-digit number"
                      className="block w-full rounded-xl border border-zinc-200 bg-[#FAFAFA] pl-[86px] pr-3.5 py-2.5 sm:py-3 text-sm text-black placeholder-zinc-400 focus:border-black focus:bg-white focus:outline-none focus:ring-1 focus:ring-black transition-colors tracking-wide"
                    />
                  </div>
                </div>

                {/* Email Address */}
                <div>
                  <label
                    htmlFor="email-address"
                    className="block text-[11px] font-semibold text-zinc-700 uppercase tracking-wider mb-1.5"
                  >
                    Email
                  </label>
                  <div className="relative rounded-xl shadow-2xs">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-zinc-400">
                      <Mail className="h-4 w-4" />
                    </div>
                    <input
                      id="email-address"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="name@example.com"
                      className="block w-full rounded-xl border border-zinc-200 bg-[#FAFAFA] pl-10 pr-3.5 py-2.5 sm:py-3 text-sm text-black placeholder-zinc-400 focus:border-black focus:bg-white focus:outline-none focus:ring-1 focus:ring-black transition-colors"
                    />
                  </div>
                </div>

                {/* Password */}
                <div>
                  <label
                    htmlFor="password"
                    className="block text-[11px] font-semibold text-zinc-700 uppercase tracking-wider mb-1.5"
                  >
                    Password
                  </label>
                  <div className="relative rounded-xl shadow-2xs">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-zinc-400">
                      <Lock className="h-4 w-4" />
                    </div>
                    <input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter your password"
                      className="block w-full rounded-xl border border-zinc-200 bg-[#FAFAFA] pl-10 pr-10 py-2.5 sm:py-3 text-sm text-black placeholder-zinc-400 focus:border-black focus:bg-white focus:outline-none focus:ring-1 focus:ring-black transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-zinc-400 hover:text-black cursor-pointer"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Select Role */}
                <div>
                  <label className="block text-[11px] font-semibold text-zinc-700 uppercase tracking-wider mb-1.5">
                    Select Role
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    {(
                      [
                        { key: "PASSENGER", label: "Passenger", icon: UserCheck },
                        { key: "DRIVER", label: "Driver", icon: Car },
                      ] as const
                    ).map((r) => {
                      const Icon = r.icon;
                      const isSelected = role === r.key;
                      return (
                        <button
                          key={r.key}
                          type="button"
                          onClick={() => setRole(r.key)}
                          className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs sm:text-sm font-semibold transition-all border cursor-pointer ${
                            isSelected
                              ? "bg-black text-white border-black shadow-xs"
                              : "bg-white text-zinc-700 border-zinc-200 hover:border-black hover:bg-zinc-50"
                          }`}
                        >
                          <Icon className="w-4 h-4 shrink-0" />
                          <span>{r.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Continue Button */}
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-black hover:bg-neutral-800 active:scale-[0.99] px-6 py-3 sm:py-3.5 text-sm sm:text-base font-semibold text-white shadow-md hover:shadow-xl transition-all duration-200 cursor-pointer disabled:opacity-75 disabled:cursor-not-allowed mt-3"
                >
                  {isLoading ? (
                    <>
                      <svg
                        className="animate-spin h-4 w-4 text-white"
                        viewBox="0 0 24 24"
                        fill="none"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        ></circle>
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8v8H4z"
                        ></path>
                      </svg>
                      <span>Processing...</span>
                    </>
                  ) : (
                    <span>Continue</span>
                  )}
                </button>
              </form>

              <div className="mt-5 text-center text-xs sm:text-sm text-zinc-600">
                Already have an account?{" "}
                <button
                  type="button"
                  onClick={() => setStep("LOGIN")}
                  className="font-bold text-black underline underline-offset-4 hover:text-neutral-700 cursor-pointer"
                >
                  Login
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Bottom footer bar */}
        <div className="pt-4 border-t border-zinc-100 flex flex-col sm:flex-row items-center justify-between gap-2.5 text-xs text-zinc-500 shrink-0 mt-auto">
          <div className="flex items-center gap-1.5 text-zinc-700 font-medium">
            <ShieldCheck className="w-4 h-4 text-black" />
            <span>Verified Ridezy Guarantee</span>
          </div>
          <div>
            &copy; {new Date().getFullYear()} Ridezy Inc. All rights reserved.
          </div>
        </div>
      </div>

      {/* RIGHT SIDE: Full-height, edge-to-edge Illustration */}
      <div className="w-full lg:w-1/2 xl:w-[52%] min-h-[380px] lg:min-h-screen relative bg-white overflow-hidden">
        <Image
          src="/onboarding.jpg"
          alt="Ridezy Simple. Safe. Reliable. Journey onboarding"
          fill
          priority
          sizes="(min-width: 1024px) 52vw, 100vw"
          className="object-cover object-center w-full h-full select-none"
        />
      </div>

      {/* RICH COLOR TOAST NOTIFICATIONS (Bottom Right) */}
      <div
        aria-live="polite"
        className="fixed bottom-5 right-5 z-50 flex flex-col gap-2.5 max-w-sm sm:max-w-md w-full px-4 pointer-events-none"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto flex items-start gap-3 p-4 rounded-xl shadow-[0_16px_36px_rgba(0,0,0,0.28)] border transition-all duration-300 animate-in slide-in-from-bottom-5 fade-in ${
              t.type === "success"
                ? "bg-gradient-to-r from-emerald-800 via-emerald-700 to-teal-700 text-white border-emerald-400/40"
                : t.type === "error"
                ? "bg-gradient-to-r from-rose-900 via-rose-700 to-red-700 text-white border-rose-400/40"
                : "bg-gradient-to-r from-sky-900 via-blue-700 to-indigo-700 text-white border-blue-400/40"
            }`}
          >
            <div className="shrink-0 mt-0.5">
              {t.type === "success" && (
                <CheckCircle2 className="w-5 h-5 text-emerald-200" />
              )}
              {t.type === "error" && (
                <AlertCircle className="w-5 h-5 text-rose-200" />
              )}
              {t.type === "info" && (
                <Info className="w-5 h-5 text-sky-200" />
              )}
            </div>

            <div className="flex-1 text-xs sm:text-sm font-medium leading-relaxed break-words">
              {t.message}
            </div>

            <button
              type="button"
              onClick={() => removeToast(t.id)}
              aria-label="Dismiss notification"
              className="shrink-0 p-1 rounded-md text-white/70 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

import { Router } from "express";
import { register, verifyEmail, resendOTP, login, getMe } from "../controllers/auth.js";
import { requireAuth } from "../middlewares/auth.js";
import { authLimiter, loginLimiter, otpResendLimiter } from "../middlewares/rateLimit.js";

export const authRouter = Router();

authRouter.post("/register", authLimiter, register);
authRouter.post("/verify-email", authLimiter, verifyEmail);
authRouter.post("/resend-otp", otpResendLimiter, resendOTP);
authRouter.post("/login", loginLimiter, login);
authRouter.get("/me", requireAuth, getMe);

import express, { type Express } from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import path from "node:path";
import fs from "node:fs";
import { env } from "./config/env.js";
import { errorHandler } from "./middlewares/error.js";
import { apiRouter } from "./routes/index.js";
import { razorpayWebhook } from "./controllers/payment.controller.js";
import { AppError } from "./utils/AppError.js";
import { PRIVATE_FILE_PREFIX, signPrivateFileUrls } from "./utils/imageStorage.js";

const uploadsDir = path.resolve(process.cwd(), "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

export function createApp(): Express {
  const app = express();

  app.disable("x-powered-by");
  app.set("trust proxy", 1);

  app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
  app.use(cors({ origin: env.corsOrigins, credentials: true }));
  // Razorpay webhook: before express.json(), because its signature is
  // computed over the exact raw bytes. Authenticated by that signature, not a JWT.
  app.post("/api/payments/razorpay/webhook", express.raw({ type: "*/*", limit: "1mb" }), razorpayWebhook);

  app.use(express.json({ limit: "25mb" }));
  app.use(express.urlencoded({ extended: true, limit: "25mb" }));
  // Request logging (method, URL, status, time). Bodies are never logged.
  app.use(morgan(env.isProduction ? "combined" : "dev", { skip: () => env.isTest }));

  // Serve uploaded images statically
  app.use("/uploads", express.static(uploadsDir));

  // Private files (driver documents) are stored as references; turn them into
  // short-lived signed URLs in every API response, wherever they appear.
  app.use("/api", (_req, res, next) => {
    const send = res.json.bind(res);
    res.json = ((body: unknown) => {
      const text = JSON.stringify(body);
      if (res.locals.keepPrivateRefs || !text || !text.includes(PRIVATE_FILE_PREFIX)) return send(body);
      void signPrivateFileUrls(JSON.parse(text) as unknown).then(send, () => send(body));
      return res;
    }) as typeof res.json;
    next();
  });

  app.use("/api", apiRouter);

  // 404 for anything no route matched
  app.use((req, _res, next) => {
    next(new AppError(404, `Route not found: ${req.method} ${req.originalUrl}`));
  });
  app.use(errorHandler);

  return app;
}

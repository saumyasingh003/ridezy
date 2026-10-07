import express, { type Express } from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { env } from "./config/env.js";
import { errorHandler } from "./middlewares/error.js";
import { apiRouter } from "./routes/index.js";
import { AppError } from "./utils/AppError.js";

export function createApp(): Express {
  const app = express();

  app.disable("x-powered-by");
  app.set("trust proxy", 1);

  app.use(helmet());
  app.use(cors({ origin: env.corsOrigins, credentials: true }));
  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: true, limit: "1mb" }));
  // Request logging (method, URL, status, time). Bodies are never logged.
  app.use(morgan(env.isProduction ? "combined" : "dev", { skip: () => env.isTest }));

  app.use("/api", apiRouter);

  // 404 for anything no route matched
  app.use((req, _res, next) => {
    next(new AppError(404, `Route not found: ${req.method} ${req.originalUrl}`));
  });
  app.use(errorHandler);

  return app;
}

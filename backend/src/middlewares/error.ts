import type { NextFunction, Request, Response } from "express";
import mongoose from "mongoose";
import { ZodError } from "zod";
import { duplicateKeyField } from "../utils/mongo.js";
import { AppError } from "../utils/AppError.js";
import { env } from "../config/env.js";
import { logger } from "../utils/logger.js";

// Errors raised by Express internals (e.g. invalid JSON body) carry a numeric `status`.
function isHttpError(err: unknown): err is Error & { status: number; expose?: boolean } {
  return err instanceof Error && typeof (err as { status?: unknown }).status === "number";
}

export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof ZodError) {
    res.status(400).json({
      success: false,
      message: "Validation failed.",
      errors: err.issues.map((issue) => ({ field: issue.path.join("."), message: issue.message })),
    });
    return;
  }

  // Safety net for Mongoose/MongoDB errors a service didn't translate itself.
  // Never forward their raw messages: they reveal collection and index names.
  if (err instanceof mongoose.Error.ValidationError) {
    res.status(400).json({
      success: false,
      message: "Validation failed.",
      errors: Object.values(err.errors).map((e) => ({ field: e.path, message: `Invalid value for ${e.path}` })),
    });
    return;
  }

  let statusCode = 500;
  let message = "Internal server error.";

  if (err instanceof mongoose.Error.CastError) {
    statusCode = 400;
    message = `Invalid value for ${err.path}.`;
  } else if (duplicateKeyField(err)) {
    statusCode = 409;
    message = "A record with these details already exists.";
  } else if (err instanceof AppError) {
    statusCode = err.statusCode;
    message = err.message;
  } else if (isHttpError(err) && err.status >= 400 && err.status < 500) {
    statusCode = err.status;
    message = err.expose === false ? "Bad request." : err.message;
  }

  if (statusCode >= 500) {
    // Request bodies are never logged, so passwords and OTPs can't end up here.
    logger.error(`${req.method} ${req.originalUrl} failed`, err);
  }

  const includeStack = !env.isProduction && statusCode >= 500 && err instanceof Error;

  res.status(statusCode).json({
    success: false,
    message,
    ...(includeStack ? { stack: err.stack } : {}),
  });
}

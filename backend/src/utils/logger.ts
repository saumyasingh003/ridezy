type Level = "debug" | "info" | "warn" | "error";

const isTest = process.env.NODE_ENV === "test";

function log(level: Level, message: string, meta?: unknown): void {
  if (isTest && level !== "error") return;

  const line = `[${new Date().toISOString()}] ${level.toUpperCase()}: ${message}`;
  const output = level === "error" || level === "warn" ? console.error : console.log;

  if (meta === undefined) {
    output(line);
  } else {
    output(line, meta);
  }
}

export const logger = {
  debug: (message: string, meta?: unknown) => log("debug", message, meta),
  info: (message: string, meta?: unknown) => log("info", message, meta),
  warn: (message: string, meta?: unknown) => log("warn", message, meta),
  error: (message: string, meta?: unknown) => log("error", message, meta),
};

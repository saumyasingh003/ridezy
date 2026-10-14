import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import type { Request } from "express";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env } from "../config/env.js";
import { AppError } from "./AppError.js";
import { logger } from "./logger.js";

/*
 * Image storage.
 *
 * - Supabase Storage when SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY are set:
 *     profile / vehicle photos → public bucket, stored as their public URL;
 *     driver documents (Aadhaar, licence) → PRIVATE bucket, stored as a
 *     reference "supabase-private://<bucket>/<path>" and only ever handed out
 *     as a short-lived signed URL (see signPrivateFileUrls).
 * - Otherwise (development) the local uploads/ folder served at /uploads.
 *
 * Uploads use the service role key, so they happen only on the server, after
 * the request was authenticated and validated. The browser never gets the key.
 */

export type ImageCategory = "profile" | "vehicle" | "doc" | "img";

const MAX_BYTES = 5 * 1024 * 1024;
const IMAGE_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};
// Documents may also be PDFs (scanned licence etc.).
const DOCUMENT_TYPES: Record<string, string> = { ...IMAGE_TYPES, "application/pdf": "pdf" };

export const PRIVATE_FILE_PREFIX = "supabase-private://";
const SIGNED_URL_SECONDS = 60 * 60;

const uploadsDir = path.resolve(process.cwd(), "uploads");

let client: SupabaseClient | null = null;
function supabase(): SupabaseClient | null {
  if (!env.storage.supabase) return null;
  client ??= createClient(env.storage.supabase.url, env.storage.supabase.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}

/** Magic bytes: the declared type must match what the file really is. */
function sniff(buffer: Buffer): string | null {
  if (buffer.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))) return "image/jpeg";
  if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP") return "image/webp";
  if (buffer.subarray(0, 4).toString("ascii") === "GIF8") return "image/gif";
  if (buffer.subarray(0, 5).toString("ascii") === "%PDF-") return "application/pdf";
  return null;
}

/** Decodes a data URL / raw base64 string and checks size and real file type. */
function decode(fileData: string, category: ImageCategory): { buffer: Buffer; mimeType: string; ext: string } {
  const match = fileData.match(/^data:([A-Za-z0-9.+/-]+);base64,(.+)$/s);
  const base64 = (match?.[2] ?? fileData).replace(/\s/g, "");
  const buffer = Buffer.from(base64, "base64");
  if (buffer.length === 0) throw new AppError(400, "The file is empty or not valid base64.");
  if (buffer.length > MAX_BYTES) throw new AppError(400, "File is too large. The limit is 5 MB.");

  const allowed = category === "doc" ? DOCUMENT_TYPES : IMAGE_TYPES;
  const mimeType = sniff(buffer);
  if (!mimeType || !allowed[mimeType]) {
    throw new AppError(
      400,
      category === "doc" ? "Upload a JPG, PNG, WEBP or PDF file." : "Upload a JPG, PNG, WEBP or GIF image.",
    );
  }
  return { buffer, mimeType, ext: allowed[mimeType]! };
}

/**
 * Stores an image (base64 data URL or raw base64) and returns the value to
 * save in the database. An http(s) URL is accepted as-is (already hosted).
 * Returns null for empty input.
 */
export async function saveImageAndGetLink(
  fileData?: string | null,
  req?: Request,
  category: ImageCategory = "img",
): Promise<string | null> {
  if (!fileData || typeof fileData !== "string") return null;
  const trimmed = fileData.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith(PRIVATE_FILE_PREFIX)) return trimmed;
  if (/^https?:\/\//i.test(trimmed)) return toPrivateRef(trimmed) ?? trimmed;

  const { buffer, mimeType, ext } = decode(trimmed, category);
  const now = new Date();
  const objectPath = `${category}/${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, "0")}/${crypto.randomUUID()}.${ext}`;

  const storage = supabase();
  if (storage) {
    const isPrivate = category === "doc";
    const bucket = isPrivate ? env.storage.privateBucket : env.storage.publicBucket;
    const { error } = await storage.storage.from(bucket).upload(objectPath, buffer, { contentType: mimeType, upsert: false });
    if (error) {
      logger.error(`Supabase upload to ${bucket} failed`, error);
      throw new AppError(502, "Couldn't store the file right now. Please try again.");
    }
    return isPrivate
      ? `${PRIVATE_FILE_PREFIX}${bucket}/${objectPath}`
      : storage.storage.from(bucket).getPublicUrl(objectPath).data.publicUrl;
  }

  // Development fallback: local disk, served by app.ts at /uploads.
  const fileName = objectPath.replaceAll("/", "_");
  await fs.promises.mkdir(uploadsDir, { recursive: true });
  await fs.promises.writeFile(path.join(uploadsDir, fileName), buffer);
  const protocol = req?.protocol || "http";
  const host = req?.get("host") || `localhost:${env.port}`;
  return `${protocol}://${host}/uploads/${fileName}`;
}

/* ------------------------- Private files (documents) ------------------------ */

/**
 * A signed URL a client sends back (e.g. re-saving a document it fetched) is
 * turned back into the permanent reference, so an expiring link is never stored.
 */
function toPrivateRef(url: string): string | null {
  if (!env.storage.supabase) return null;
  const base = env.storage.supabase.url.replace(/\/+$/, "");
  const prefix = `${base}/storage/v1/object/sign/${env.storage.privateBucket}/`;
  if (!url.startsWith(prefix)) return null;
  const objectPath = decodeURIComponent(url.slice(prefix.length).split("?")[0] ?? "");
  return objectPath ? `${PRIVATE_FILE_PREFIX}${env.storage.privateBucket}/${objectPath}` : null;
}

function parsePrivateRef(ref: string): { bucket: string; objectPath: string } | null {
  if (!ref.startsWith(PRIVATE_FILE_PREFIX)) return null;
  const rest = ref.slice(PRIVATE_FILE_PREFIX.length);
  const slash = rest.indexOf("/");
  return slash > 0 ? { bucket: rest.slice(0, slash), objectPath: rest.slice(slash + 1) } : null;
}

function collectRefs(value: unknown, found: Set<string>): void {
  if (typeof value === "string") {
    if (value.startsWith(PRIVATE_FILE_PREFIX)) found.add(value);
  } else if (Array.isArray(value)) {
    for (const item of value) collectRefs(item, found);
  } else if (value && typeof value === "object") {
    for (const item of Object.values(value)) collectRefs(item, found);
  }
}

function replaceRefs(value: unknown, urls: Map<string, string>): unknown {
  if (typeof value === "string") return urls.get(value) ?? value;
  if (Array.isArray(value)) return value.map((item) => replaceRefs(item, urls));
  if (value && typeof value === "object" && !(value instanceof Date)) {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, replaceRefs(item, urls)]));
  }
  return value;
}

/**
 * Replaces every private file reference inside a (JSON-ready) response body
 * with a signed URL valid for 1 hour. The API response layer runs this, so
 * every endpoint that returns a document gets a working, expiring link and
 * the bucket itself stays private.
 */
export async function signPrivateFileUrls<T>(body: T): Promise<T> {
  const refs = new Set<string>();
  collectRefs(body, refs);
  const storage = supabase();
  if (refs.size === 0 || !storage) return body;

  const byBucket = new Map<string, string[]>();
  for (const ref of refs) {
    const parsed = parsePrivateRef(ref);
    if (parsed) byBucket.set(parsed.bucket, [...(byBucket.get(parsed.bucket) ?? []), parsed.objectPath]);
  }

  const urls = new Map<string, string>();
  await Promise.all(
    [...byBucket].map(async ([bucket, paths]) => {
      const { data, error } = await storage.storage.from(bucket).createSignedUrls(paths, SIGNED_URL_SECONDS);
      if (error) {
        logger.error(`Signing ${paths.length} file URL(s) in ${bucket} failed`, error);
        return;
      }
      for (const item of data ?? []) {
        if (item.path && item.signedUrl) urls.set(`${PRIVATE_FILE_PREFIX}${bucket}/${item.path}`, item.signedUrl);
      }
    }),
  );
  return replaceRefs(body, urls) as T;
}

import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { requireAuth } from "../middlewares/auth.js";
import { saveImageAndGetLink, signPrivateFileUrls } from "../utils/imageStorage.js";

// POST /api/upload: store an image (base64 / data URL) and get the link to save.
// Signed-in users only. Driver documents ("doc") go to the private bucket: `url`
// is the reference to save, `previewUrl` a short-lived signed URL to show now.
export const uploadRouter = Router();

uploadRouter.use(requireAuth);

const uploadSchema = z.object({
  file: z.string({ error: "No file data provided. Expected a base64 string or data URL." }).min(1),
  fileName: z.string().max(200).optional(),
  category: z.enum(["profile", "vehicle", "doc", "img"]).default("img"),
});

uploadRouter.post("/", async (req: Request, res: Response) => {
  const { file, category } = uploadSchema.parse(req.body ?? {});
  const stored = await saveImageAndGetLink(file, req, category);
  const { previewUrl } = await signPrivateFileUrls({ previewUrl: stored });
  res.locals.keepPrivateRefs = true; // `url` is the permanent reference to save, not a signed link
  res.status(201).json({
    success: true,
    message: "File stored successfully.",
    data: { url: stored, previewUrl, category },
  });
});

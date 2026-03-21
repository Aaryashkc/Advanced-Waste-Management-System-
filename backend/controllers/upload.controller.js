import cloudinary, { ensureCloudinaryConfig } from "../config/cloudinary.js";
import WasteUpload from "../models/WasteUpload.model.js";
import streamifier from "streamifier";

const UPLOAD_FOLDER_PREFIX = "waste_uploads";
const RESOURCE_TYPE = "image";
const CONTEXT_WASTE = "waste_upload";

/**
 * Upload waste image to Cloudinary and save metadata to DB.
 * Folder: waste_uploads/<userId>/ for predictable structure.
 * Returns: secure_url, public_id, resource_type, created_at (and id, category, level).
 */
export const uploadWasteImage = async (req, res) => {
  try {
    ensureCloudinaryConfig();
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ message: "No image file provided" });
    }

    const { category = "non-recyclable", level = "easy" } = req.body;
    const userId = req.user._id;
    const folder = `${UPLOAD_FOLDER_PREFIX}/${userId}`;

    const result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder,
          resource_type: RESOURCE_TYPE,
        },
        (error, result) => {
          if (result) resolve(result);
          else reject(error);
        }
      );
      streamifier.createReadStream(req.file.buffer).pipe(stream);
    });

    const record = new WasteUpload({
      publicId: result.public_id,
      url: result.secure_url,
      uploadedBy: userId,
      category,
      level,
      context: CONTEXT_WASTE,
    });
    await record.save();

    res.status(201).json({
      message: "Waste image uploaded successfully",
      data: {
        id: record._id,
        secure_url: record.url,
        url: record.url,
        public_id: result.public_id,
        publicId: record.publicId,
        resource_type: RESOURCE_TYPE,
        created_at: record.uploadedAt,
        uploadedAt: record.uploadedAt,
        category: record.category,
        level: record.level,
        expiresAt: record.expiresAt,
      },
    });
  } catch (error) {
    console.error("Upload error:", error);
    const status = error.http_code || (error.message && error.message.includes("Cloudinary") ? 502 : 500);
    res.status(status).json({
      message: "Failed to upload waste image",
      error: error.message || "Upload failed",
    });
  }
};

/**
 * Delete from Cloudinary and DB all uploads where expiresAt <= now.
 * - If Cloudinary delete fails, do not delete DB record; log error.
 * - Idempotent: safe to rerun (already-deleted Cloudinary assets may 404; we still remove DB if we have the record).
 */
export const cleanupExpiredUploads = async () => {
  const now = new Date();
  const expired = await WasteUpload.find({ expiresAt: { $lte: now } });
  let deletedFromCloud = 0;
  let deletedFromDb = 0;
  let errors = 0;

  for (const doc of expired) {
    try {
      ensureCloudinaryConfig();
      await cloudinary.uploader.destroy(doc.publicId, { resource_type: RESOURCE_TYPE });
      deletedFromCloud++;
    } catch (err) {
      console.error(`Cleanup: Cloudinary delete failed for ${doc.publicId}:`, err.message);
      errors++;
      continue;
    }
    try {
      await WasteUpload.findByIdAndDelete(doc._id);
      deletedFromDb++;
    } catch (err) {
      console.error(`Cleanup: DB delete failed for ${doc._id}:`, err.message);
      errors++;
    }
  }

  if (expired.length > 0) {
    console.log(
      `Cleanup: expired=${expired.length} cloudDeleted=${deletedFromCloud} dbDeleted=${deletedFromDb} errors=${errors}`
    );
  }
  return { deleted: deletedFromDb, errors, total: expired.length };
};

/**
 * HTTP endpoint for cron/external scheduler. Protect with CRON_SECRET in production.
 */
export const runCleanup = async (req, res) => {
  try {
    const result = await cleanupExpiredUploads();
    res.status(200).json({
      message: "Cleanup completed",
      ...result,
    });
  } catch (error) {
    console.error("Cleanup error:", error);
    res.status(500).json({
      message: "Cleanup failed",
      error: error.message,
    });
  }
};

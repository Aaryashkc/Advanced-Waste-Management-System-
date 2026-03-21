import { v2 as cloudinary } from "cloudinary";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Load .env from project root so it works regardless of cwd
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

function getCloudinaryEnv() {
  return {
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  };
}

function applyConfig() {
  const { cloud_name, api_key, api_secret } = getCloudinaryEnv();
  if (cloud_name && api_key && api_secret) {
    cloudinary.config({ cloud_name, api_key, api_secret });
  }
}
applyConfig();

/**
 * Validate that Cloudinary is configured (e.g. before upload/delete).
 * Re-reads env so it works even if dotenv/dotenvx loaded after this module.
 * Throws if any required env var is missing.
 */
export function ensureCloudinaryConfig() {
  const { cloud_name, api_key, api_secret } = getCloudinaryEnv();
  if (!cloud_name || !api_key || !api_secret) {
    throw new Error(
      "Cloudinary env vars required: CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET. Add them to your .env (project root)."
    );
  }
  cloudinary.config({ cloud_name, api_key, api_secret });
}

export default cloudinary;
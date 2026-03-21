import multer from "multer";

const MAX_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_MIMES = ["image/jpeg", "image/png", "image/webp"];

const storage = multer.memoryStorage();

export const uploadSingleImage = multer({
  storage,
  limits: { fileSize: MAX_SIZE },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_MIMES.includes(file.mimetype)) {
      return cb(
        new Error("Only JPEG, PNG and WebP images are allowed"),
        false
      );
    }
    cb(null, true);
  },
}).single("image");

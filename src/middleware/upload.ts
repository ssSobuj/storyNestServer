// src/middleware/upload.ts

import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import { CloudinaryStorage } from "multer-storage-cloudinary";

// Configure Cloudinary using the URL from .env
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Note: If you use the CLOUDINARY_URL, you can just call:
// cloudinary.config();
// It will automatically pick it up from process.env

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: "storynest_covers", // The folder name in your Cloudinary account
    allowedFormats: ["jpeg", "png", "jpg"],
    // You can apply transformations here if you want
    // transformation: [{ width: 800, height: 600, crop: 'limit' }],
  } as any, // 'as any' is sometimes needed due to type mismatches between libraries
});

const upload = multer({ storage: storage });

export { upload, cloudinary };

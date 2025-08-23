// src/middleware/upload.ts

import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import { CloudinaryStorage } from "multer-storage-cloudinary";

// ==> FIX: This is the only line needed when CLOUDINARY_URL is set in .env
cloudinary.config();

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: "storynest_covers",
    allowedFormats: ["jpeg", "png", "jpg"],
    // You can apply transformations here if you want
    // transformation: [{ width: 800, height: 600, crop: 'limit' }],
  } as any,
});

const avatarStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: "storynest_avatars", // <-- Use a different folder
    allowedFormats: ["jpeg", "png", "jpg"],
    transformation: [{ width: 200, height: 200, crop: "fill" }], // <-- Resize avatars to be square
  } as any,
});

const upload = multer({ storage: storage });
const avatarUpload = multer({ storage: avatarStorage });

export { upload, avatarUpload, cloudinary };

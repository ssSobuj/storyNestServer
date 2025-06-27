// src/routes/storyRoutes.ts

import { Router } from "express";
import {
  getStories,
  getStory,
  createStory,
  updateStory,
  deleteStory,
  getMyStories,
  updateStoryStatus,
} from "../controllers/storyController";
import { protect, authorize } from "../middleware/auth";
import { upload } from "../middleware/upload"; // ==> IMPORT UPLOAD MIDDLEWARE
import { check } from "express-validator";

const router = Router();

router.route("/me").get(protect, getMyStories);

router.route("/:id/status").put(protect, authorize("admin"), updateStoryStatus);

router.route("/").get(getStories);

router
  .route("/")
  .post(
    protect,
    authorize("user"),
    upload.single("coverImage"),
    [
      check("title", "Title is required").not().isEmpty(),
      check("content", "Content is required").not().isEmpty(),
      check("category", "Category is required").not().isEmpty(),
    ],
    createStory
  );

router
  .route("/:id")
  .get(getStory)
  .put(protect, upload.single("coverImage"), updateStory)
  .delete(protect, deleteStory);

export default router;

// src/routes/commentRoutes.ts
import express from "express";
import {
  addComment,
  getCommentsForStory,
} from "../controllers/commentController";
import { protect } from "../middleware/auth";

const router = express.Router({ mergeParams: true }); // mergeParams is crucial

// GET /api/v1/stories/:storyId/comments
router.route("/").get(getCommentsForStory).post(protect, addComment);

export default router;

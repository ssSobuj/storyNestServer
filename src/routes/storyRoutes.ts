// src/routes/storyRoutes.ts
import { NextFunction, Request, Response, Router } from "express";
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
import { upload } from "../middleware/upload";
import { check } from "express-validator";
import redis from "../config/redis";

const router = Router();

// Redis cache middleware
const cacheMiddleware =
  (keyGenerator: (req: Request) => string) =>
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const key = keyGenerator(req);
    try {
      const cached = await redis.get(key);
      if (cached) {
        console.log("Cache hit ✅ for key:", key);
        res.json(JSON.parse(cached));
        return;
      }
      res.locals.cacheKey = key;
      next();
    } catch (err) {
      console.error("Redis error:", err);
      next();
    }
  };

// Routes
router.route("/me").get(protect, getMyStories);

router.route("/:id/status").put(protect, authorize("admin"), updateStoryStatus);

// GET all stories with cache
router
  .route("/")
  .get(
    cacheMiddleware(() => "stories:all"),
    getStories
  )
  .post(
    protect,
    authorize("user", "admin"),
    upload.single("coverImage"),
    [
      check("title", "Title is required").not().isEmpty(),
      check("content", "Content is required").not().isEmpty(),
      check("category", "Category is required").not().isEmpty(),
    ],
    async (req: Request, res: Response, next: NextFunction) => {
      // Invalidate cache before creating new story
      try {
        await redis.del("stories:all");
      } catch (err) {
        console.error("Redis error:", err);
      }
      next();
    },
    createStory
  );

// GET, UPDATE, DELETE story by ID with cache
router
  .route("/:id")
  .get(
    cacheMiddleware((req) => `story:${req.params.id}`),
    getStory
  )
  .put(
    protect,
    upload.single("coverImage"),
    async (req: Request, res: Response, next: NextFunction) => {
      // Invalidate cache before updating
      try {
        await redis.del(`story:${req.params.id}`);
        await redis.del("stories:all");
      } catch (err) {
        console.error("Redis error:", err);
      }
      next();
    },
    updateStory
  )
  .delete(
    protect,
    async (req: Request, res: Response, next: NextFunction) => {
      // Invalidate cache before deleting
      try {
        await redis.del(`story:${req.params.id}`);
        await redis.del("stories:all");
      } catch (err) {
        console.error("Redis error:", err);
      }
      next();
    },
    deleteStory
  );

export default router;

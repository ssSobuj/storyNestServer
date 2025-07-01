// src/controllers/commentController.ts

// ==> FIX: Import specific types from express <==
import { Request, Response, NextFunction } from "express";
import Comment from "../models/Comment";
import Story from "../models/Story";

// ==> FIX: Make the AuthRequest interface more specific and robust <==
interface AuthRequest extends Request {
  user?: {
    id: string; // Assuming user.id is a string
    role: string;
  };
  // Tell TypeScript what to expect in the body
  body: {
    text: string;
    rating: number;
    story?: string; // These will be added by our controller
    author?: string; // These will be added by our controller
  };
  // Tell TypeScript what to expect in the params
  params: {
    storyId: string;
  };
}

// @desc    Get all comments for a story
// @route   GET /api/v1/stories/:storyId/comments
export const getCommentsForStory = async (
  req: Request, // Standard Request is fine here as it's a public route
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const comments = await Comment.find({ story: req.params.storyId })
      .populate({ path: "author", select: "username profilePicture" })
      .sort("-createdAt");

    res
      .status(200)
      .json({ success: true, count: comments.length, data: comments });
  } catch (err) {
    next(err);
  }
};

// @desc    Add a comment to a story
// @route   POST /api/v1/stories/:storyId/comments
export const addComment = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Now TypeScript knows these properties exist and are strings
    req.body.story = req.params.storyId;
    req.body.author = req.user!.id; // Use '!' to assert that user is not undefined here (protected route)

    const story = await Story.findById(req.params.storyId);
    if (!story) {
      res.status(404).json({ success: false, error: "Story not found" });
      return;
    }

    const comment = await Comment.create(req.body);

    res.status(201).json({ success: true, data: comment });
  } catch (err) {
    next(err);
  }
};

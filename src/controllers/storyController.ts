import { Request, Response, NextFunction } from "express";
import Story, { StoryStatus } from "../models/Story";
import { validationResult } from "express-validator";
import { cloudinary } from "../middleware/upload";
import slugify from "slugify";
import crypto from "crypto";
import "../models/Comment";

// Define the interface for requests that have a user and potentially a file
interface AuthRequest extends Request {
  user?: any;
  file?: any;
}

// @desc    Get all APPROVED stories
// @route   GET /api/v1/stories
// @access  Public
export const getStories = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // 1. Build the filter object
    const filter: { [key: string]: any } = {};

    if (req.user?.role !== "admin") {
      filter.status = StoryStatus.APPROVED;
    }
    // ==> NEW: Add search functionality
    if (
      typeof req.query.search === "string" &&
      req.query.search.trim() !== ""
    ) {
      const regex = new RegExp(req.query.search, "i"); // 'i' for case-insensitive
      filter.$or = [
        // Search in title or content
        { title: regex },
        { content: regex },
        // If you want to search by author name, you'd need a more complex aggregation pipeline
      ];
    }
    const queryObj = { ...req.query };
    if (req.user?.role === "admin" && queryObj.status) {
      filter.status = queryObj.status; // Allow admin to filter by any status
    }

    const excludedFields = ["page", "sort", "limit", "fields", "search"];
    excludedFields.forEach((el) => delete queryObj[el]);

    let queryStr = JSON.stringify(queryObj);
    queryStr = queryStr.replace(/\b(gte|gt|lte|lt)\b/g, (match) => `$${match}`);
    Object.assign(filter, JSON.parse(queryStr));

    // 2. Build the options object
    // 2. Build the options object
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    // ==> THIS IS THE ONLY PART THAT CHANGES <==
    let sort: string;
    const sortQuery = req.query.sort as string;

    if (sortQuery === "top-rated") {
      // If the client asks for 'top-rated', we sort by avgRating in descending order.
      sort = "-avgRating";
    } else if (sortQuery) {
      // For any other sort query (e.g., 'createdAt', '-views'), we use it directly.
      sort = sortQuery.split(",").join(" ");
    } else {
      // Default sort is by the newest created.
      sort = "-createdAt";
    }
    // ==> END OF THE CHANGE <==

    const projection =
      typeof req.query.fields === "string"
        ? req.query.fields.split(",").join(" ")
        : "-__v";

    // 3. Execute the query with all parts
    const stories = await Story.find(filter)
      .populate({ path: "author", select: "username" })
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .select(projection) // Apply projection last
      .lean(); // Use .lean() for faster, plain JS object results

    const total = await Story.countDocuments(filter);

    res.status(200).json({
      success: true,
      count: stories.length,
      pagination: {
        totalPages: Math.ceil(total / limit),
        currentPage: page,
      },
      data: stories,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get stories created by the logged-in user
// @route   GET /api/v1/stories/me
// @access  Private
export const getMyStories = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const stories = await Story.find({ author: req.user.id }).sort(
      "-createdAt"
    );
    res
      .status(200)
      .json({ success: true, count: stories.length, data: stories });
  } catch (err) {
    next(err);
  }
};

// @desc    Get single story by its ID
// @route   GET /api/v1/stories/:id
// @access  Public
export const getStory = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const storyId = req.params.id;
    const story = await Story.findById(storyId)
      .populate({ path: "author", select: "username" })
      .populate("comments");

    const canView =
      story &&
      (story.status === StoryStatus.APPROVED ||
        (req.user && story.author.toString() === req.user.id) ||
        (req.user && req.user.role === "admin"));

    if (!canView) {
      res.status(404).json({ success: false, error: "Story not found" });
      return;
    }

    Story.updateOne({ _id: storyId }, { $inc: { views: 1 } }).exec();

    res.status(200).json({ success: true, data: story });
  } catch (err) {
    next(err);
  }
};

// ==> THE FIX: THIS IS THE NEW, ENHANCED FUNCTION <==
// @desc    Get single story by its SLUG
// @route   GET /api/v1/stories/slug/:slug
// @access  Public
export const getStoryBySlug = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { slug } = req.params;

    // Find the story by its unique slug
    const story = await Story.findOne({ slug: slug })
      .populate({ path: "author", select: "username" })
      .populate("comments"); // Also populate comments for consistency

    // Check if the story exists and if the user has permission to view it
    const canView =
      story &&
      (story.status === StoryStatus.APPROVED ||
        (req.user && story.author.toString() === req.user.id) ||
        (req.user && req.user.role === "admin"));

    if (!canView) {
      res.status(404).json({ success: false, message: "Story not found" });
      return;
    }

    // Increment the view count (using the story's _id)
    Story.updateOne({ _id: story._id }, { $inc: { views: 1 } }).exec();

    res.status(200).json({ success: true, data: story });
  } catch (err) {
    next(err);
  }
};

// @desc    Create a story
// @route   POST /api/v1/stories
// @access  Private
export const createStory = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }
    const { title } = req.body;

    let slug = slugify(title, {
      lower: true,
      trim: true,
      remove: /[*+~.()'"!:@–]/g,
    });
    if (!slug) {
      slug = crypto.randomBytes(6).toString("hex");
    }
    const existingStory = await Story.findOne({ slug: slug });

    if (existingStory) {
      const randomSuffix = crypto.randomBytes(4).toString("hex");
      slug = `${slug}-${randomSuffix}`;
    }

    const storyData = { ...req.body, author: req.user.id, slug: slug };

    if (req.body.tags) {
      try {
        storyData.tags = JSON.parse(req.body.tags);
      } catch (e) {
        storyData.tags = [];
      }
    }

    if (req.file) {
      storyData.coverImage = req.file.path;
      storyData.coverImagePublicId = req.file.filename;
    }
    const story = await Story.create(storyData);
    res.status(201).json({ success: true, data: story });
  } catch (err) {
    next(err);
  }
};

// @desc    Update a story
// @route   PUT /api/v1/stories/:id
// @access  Private (Author only)
export const updateStory = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const story = await Story.findById(req.params.id);
    if (!story) {
      res.status(404).json({ success: false, error: "Story not found" });
      return;
    }
    if (story.author.toString() !== req.user.id) {
      res.status(403).json({ success: false, error: "User not authorized" });
      return;
    }
    const updateData = { ...req.body, status: StoryStatus.PENDING };

    // ==> THE FIX: Prevent the slug from being changed on update <==
    delete updateData.slug;

    if (req.file) {
      if (story.coverImagePublicId) {
        await cloudinary.uploader.destroy(story.coverImagePublicId);
      }
      updateData.coverImage = req.file.path;
      updateData.coverImagePublicId = req.file.filename;
    }
    const updatedStory = await Story.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    );
    res.status(200).json({ success: true, data: updatedStory });
  } catch (err) {
    next(err);
  }
};

// @desc    Delete a story
// @route   DELETE /api/v1/stories/:id
// @access  Private (Author or Admin)
export const deleteStory = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const story = await Story.findById(req.params.id);
    if (!story) {
      res.status(404).json({ success: false, error: "Story not found" });
      return;
    }
    if (story.author.toString() !== req.user.id && req.user.role !== "admin") {
      res.status(403).json({ success: false, error: "Not authorized" });
      return;
    }
    if (story.coverImagePublicId) {
      await cloudinary.uploader.destroy(story.coverImagePublicId);
    }
    await story.deleteOne();
    res.status(200).json({ success: true, data: {} });
  } catch (err) {
    next(err);
  }
};

// @desc    Admin updates a story's status
// @route   PUT /api/v1/stories/:id/status
// @access  Private (Admin only)
export const updateStoryStatus = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { status } = req.body;
    if (!Object.values(StoryStatus).includes(status as StoryStatus)) {
      res.status(400).json({ success: false, error: "Invalid status value" });
      return;
    }
    const story = await Story.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true, runValidators: true }
    );
    if (!story) {
      res.status(404).json({ success: false, error: "Story not found" });
      return;
    }
    res.status(200).json({ success: true, data: story });
  } catch (err) {
    next(err);
  }
};

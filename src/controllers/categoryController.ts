// controllers/categoryController.ts
import { Request, Response, NextFunction } from 'express';
import Category, { ICategory } from '../models/Category';
import { validationResult } from 'express-validator';
import slugify from 'slugify';
import crypto from 'crypto';

interface AuthRequest extends Request {
  user?: {
    id: string;
    role: string;
  };
}

// @desc    Get all categories
// @route   GET /api/v1/categories
// @access  Public
export const getCategories = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const categories = await Category.find().sort('name');
    res.status(200).json({ success: true, count: categories.length, data: categories });
  } catch (err) {
    next(err);
  }
};

// @desc    Get single category
// @route   GET /api/v1/categories/:id
// @access  Public
export const getCategory = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const category = await Category.findById(req.params.id);

    if (!category) {
      res.status(404).json({ success: false, error: 'Category not found' });
      return;
    }
    res.status(200).json({ success: true, data: category });
  } catch (err) {
    next(err);
  }
};


// @desc    Create a new category
// @route   POST /api/v1/categories
// @access  Private (Super Admin only)
export const createCategory = async (
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

    // --- SUPER ADMIN CHECK ---
    if (!req.user || req.user.role !== 'super-admin') {
      res.status(403).json({ success: false, error: 'Not authorized to create categories.' });
      return;
    }

    const { name } = req.body;
    let slug = slugify(name, {
      lower: true,
      trim: true,
      remove: /[*+~.()'"!:@–]/g,
    });
    if (!slug) {
      slug = crypto.randomBytes(6).toString('hex');
    }

    const existingCategory = await Category.findOne({ slug: slug });
    if (existingCategory) {
      const randomSuffix = crypto.randomBytes(4).toString('hex');
      slug = `${slug}-${randomSuffix}`;
    }

    const category = await Category.create({ name, slug });
    res.status(201).json({ success: true, data: category });
  } catch (err) {
    next(err);
  }
};

// @desc    Update a category
// @route   PUT /api/v1/categories/:id
// @access  Private (Super Admin only)
export const updateCategory = async (
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

    // --- SUPER ADMIN CHECK ---
    if (!req.user || req.user.role !== 'super-admin') {
      res.status(403).json({ success: false, error: 'Not authorized to update categories.' });
      return;
    }

    let category = await Category.findById(req.params.id);

    if (!category) {
      res.status(404).json({ success: false, error: 'Category not found' });
      return;
    }

    const { name } = req.body;
    const updateData: Partial<ICategory> = { name };

    // Update slug only if name is changed and it's a valid string
    if (name && typeof name === 'string') {
        let newSlug = slugify(name, {
            lower: true,
            trim: true,
            remove: /[*+~.()'"!:@–]/g,
        });
        if (!newSlug) {
            newSlug = crypto.randomBytes(6).toString('hex'); // Fallback for empty names
        }
        // Check for slug uniqueness, append suffix if necessary (less likely for updates, but good to have)
        const existingCategoryWithNewSlug = await Category.findOne({ slug: newSlug, _id: { $ne: req.params.id } });
        if (existingCategoryWithNewSlug) {
            newSlug = `${newSlug}-${crypto.randomBytes(4).toString('hex')}`;
        }
        updateData.slug = newSlug;
    }

    category = await Category.findByIdAndUpdate(req.params.id, updateData, {
      new: true,
      runValidators: true,
    });

    res.status(200).json({ success: true, data: category });
  } catch (err) {
    next(err);
  }
};

// @desc    Delete a category
// @route   DELETE /api/v1/categories/:id
// @access  Private (Super Admin only)
export const deleteCategory = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // --- SUPER ADMIN CHECK ---
    if (!req.user || req.user.role !== 'super-admin') {
      res.status(403).json({ success: false, error: 'Not authorized to delete categories.' });
      return;
    }

    const category = await Category.findById(req.params.id);

    if (!category) {
      res.status(404).json({ success: false, error: 'Category not found' });
      return;
    }

    // IMPORTANT: Before deleting a category, consider how to handle stories
    // that are currently associated with this category.
    // Options:
    // 1. Prevent deletion if stories are linked.
    // 2. Set linked stories' category to null/default.
    // 3. Delete linked stories (USE WITH EXTREME CAUTION).
    // For simplicity, we'll just delete the category here, but in a real app,
    // you'd likely implement option 1 or 2.

    await category.deleteOne();

    res.status(200).json({ success: true, data: {} });
  } catch (err) {
    next(err);
  }
};
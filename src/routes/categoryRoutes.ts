// routes/categoryRoutes.ts
import { Router } from 'express';
import {
  getCategories,
  getCategory,
  createCategory,
  updateCategory,
  deleteCategory,
} from '../controllers/categoryController';
import { protect } from '../middleware/auth'; // Assuming you have an auth middleware
import { check } from 'express-validator';

const router = Router();

router.route('/')
  .get(getCategories)
  .post(
    protect, // Protect this route
    [
      check('name', 'Category name is required').notEmpty(),
      check('name', 'Category name must be between 2 and 50 characters').isLength({ min: 2, max: 50 }),
    ],
    createCategory
  );

router.route('/:id')
  .get(getCategory)
  .put(
    protect, // Protect this route
    [
      check('name', 'Category name is required').notEmpty(),
      check('name', 'Category name must be between 2 and 50 characters').isLength({ min: 2, max: 50 }),
    ],
    updateCategory
  )
  .delete(protect, deleteCategory);

export default router;
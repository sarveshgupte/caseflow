const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth.middleware');
const { requireAdmin } = require('../middleware/permission.middleware');
const {
  getCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  toggleCategoryStatus,
  deleteCategory,
  addSubcategory,
  updateSubcategory,
  toggleSubcategoryStatus,
  deleteSubcategory,
} = require('../controllers/category.controller');

/**
 * Category Routes for Admin-Managed Categories
 * 
 * Public endpoints:
 * - GET /api/categories (for case creation dropdowns)
 * 
 * Admin-only endpoints:
 * - All other operations require authentication and admin role
 */

// Public endpoint - Get active categories (for case creation)
router.get('/', getCategories);

// Get category by ID
router.get('/:id', authenticate, getCategoryById);

// Admin-only endpoints - require authentication and admin role
router.post('/', authenticate, requireAdmin, createCategory);
router.put('/:id', authenticate, requireAdmin, updateCategory);
router.patch('/:id/status', authenticate, requireAdmin, toggleCategoryStatus);
router.delete('/:id', authenticate, requireAdmin, deleteCategory);

// Subcategory management (Admin only)
router.post('/:id/subcategories', authenticate, requireAdmin, addSubcategory);
router.put('/:id/subcategories/:subcategoryId', authenticate, requireAdmin, updateSubcategory);
router.patch('/:id/subcategories/:subcategoryId/status', authenticate, requireAdmin, toggleSubcategoryStatus);
router.delete('/:id/subcategories/:subcategoryId', authenticate, requireAdmin, deleteSubcategory);

module.exports = router;

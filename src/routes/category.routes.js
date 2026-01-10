const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth.middleware');
const { requireAdmin, blockSuperadmin } = require('../middleware/permission.middleware');
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
 * - SuperAdmin is blocked from accessing firm-specific categories
 */

// Public endpoint - Get active categories (for case creation)
router.get('/', getCategories);

// Get category by ID - require auth and block SuperAdmin
router.get('/:id', authenticate, blockSuperadmin, getCategoryById);

// Admin-only endpoints - require authentication, block SuperAdmin, and require admin role
router.post('/', authenticate, blockSuperadmin, requireAdmin, createCategory);
router.put('/:id', authenticate, blockSuperadmin, requireAdmin, updateCategory);
router.patch('/:id/status', authenticate, blockSuperadmin, requireAdmin, toggleCategoryStatus);
router.delete('/:id', authenticate, blockSuperadmin, requireAdmin, deleteCategory);

// Subcategory management (Admin only)
router.post('/:id/subcategories', authenticate, blockSuperadmin, requireAdmin, addSubcategory);
router.put('/:id/subcategories/:subcategoryId', authenticate, blockSuperadmin, requireAdmin, updateSubcategory);
router.patch('/:id/subcategories/:subcategoryId/status', authenticate, blockSuperadmin, requireAdmin, toggleSubcategoryStatus);
router.delete('/:id/subcategories/:subcategoryId', authenticate, blockSuperadmin, requireAdmin, deleteSubcategory);

module.exports = router;

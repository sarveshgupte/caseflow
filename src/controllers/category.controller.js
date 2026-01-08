const Category = require('../models/Category.model');
const Case = require('../models/Case.model');
const mongoose = require('mongoose');

/**
 * Category Controller for Admin-Managed Categories
 * 
 * Admin-only operations for managing case categories and subcategories.
 * Enforces unique names and soft delete rules.
 */

/**
 * Get all categories (including inactive for admin)
 * GET /api/categories
 * Query param: activeOnly=true for only active categories
 */
const getCategories = async (req, res) => {
  try {
    const { activeOnly } = req.query;
    
    // Filter based on activeOnly query parameter
    const filter = activeOnly === 'true' ? { isActive: true } : {};
    
    const categories = await Category.find(filter).sort({ name: 1 });
    
    res.json({
      success: true,
      data: categories,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching categories',
      error: error.message,
    });
  }
};

/**
 * Get category by ID
 * GET /api/categories/:id
 */
const getCategoryById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const category = await Category.findById(id);
    
    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found',
      });
    }
    
    res.json({
      success: true,
      data: category,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching category',
      error: error.message,
    });
  }
};

/**
 * Create a new category (Admin only)
 * POST /api/categories
 */
const createCategory = async (req, res) => {
  try {
    const { name } = req.body;
    
    if (!name) {
      return res.status(400).json({
        success: false,
        message: 'Category name is required',
      });
    }
    
    // Check for duplicate name (case-insensitive)
    const existing = await Category.findOne({ 
      name: { $regex: new RegExp(`^${name.trim()}$`, 'i') } 
    });
    
    if (existing) {
      return res.status(409).json({
        success: false,
        message: 'Category with this name already exists',
      });
    }
    
    const category = new Category({
      name: name.trim(),
      subcategories: [],
      isActive: true,
    });
    
    await category.save();
    
    res.status(201).json({
      success: true,
      data: category,
      message: 'Category created successfully',
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: 'Error creating category',
      error: error.message,
    });
  }
};

/**
 * Update category name (Admin only)
 * PUT /api/categories/:id
 */
const updateCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;
    
    if (!name) {
      return res.status(400).json({
        success: false,
        message: 'Category name is required',
      });
    }
    
    const category = await Category.findById(id);
    
    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found',
      });
    }
    
    // Check for duplicate name (case-insensitive), excluding current category
    const existing = await Category.findOne({ 
      _id: { $ne: id },
      name: { $regex: new RegExp(`^${name.trim()}$`, 'i') } 
    });
    
    if (existing) {
      return res.status(409).json({
        success: false,
        message: 'Category with this name already exists',
      });
    }
    
    category.name = name.trim();
    await category.save();
    
    res.json({
      success: true,
      data: category,
      message: 'Category updated successfully',
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: 'Error updating category',
      error: error.message,
    });
  }
};

/**
 * Enable/disable category (Admin only)
 * PATCH /api/categories/:id/status
 */
const toggleCategoryStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;
    
    if (typeof isActive !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: 'isActive field is required (boolean)',
      });
    }
    
    const category = await Category.findById(id);
    
    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found',
      });
    }
    
    // Check if category is in use by any cases when trying to disable
    if (!isActive) {
      const casesCount = await Case.countDocuments({ 
        $or: [
          { category: category.name },
          { caseCategory: category.name },
          { categoryId: category._id }
        ]
      });
      
      if (casesCount > 0) {
        return res.status(400).json({
          success: false,
          message: `Cannot disable category. It is currently used by ${casesCount} case(s)`,
        });
      }
    }
    
    category.isActive = isActive;
    await category.save();
    
    res.json({
      success: true,
      data: category,
      message: `Category ${isActive ? 'enabled' : 'disabled'} successfully`,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: 'Error updating category status',
      error: error.message,
    });
  }
};

/**
 * Add subcategory to category (Admin only)
 * POST /api/categories/:id/subcategories
 */
const addSubcategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;
    
    if (!name) {
      return res.status(400).json({
        success: false,
        message: 'Subcategory name is required',
      });
    }
    
    const category = await Category.findById(id);
    
    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found',
      });
    }
    
    // Check for duplicate subcategory name within this category (case-insensitive)
    const duplicate = category.subcategories.find(
      sub => sub.name.toLowerCase() === name.trim().toLowerCase()
    );
    
    if (duplicate) {
      return res.status(409).json({
        success: false,
        message: 'Subcategory with this name already exists in this category',
      });
    }
    
    // Generate unique subcategory ID
    const subcategoryId = new mongoose.Types.ObjectId().toString();
    
    category.subcategories.push({
      id: subcategoryId,
      name: name.trim(),
      isActive: true,
    });
    
    await category.save();
    
    res.status(201).json({
      success: true,
      data: category,
      message: 'Subcategory added successfully',
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: 'Error adding subcategory',
      error: error.message,
    });
  }
};

/**
 * Update subcategory name (Admin only)
 * PUT /api/categories/:id/subcategories/:subcategoryId
 */
const updateSubcategory = async (req, res) => {
  try {
    const { id, subcategoryId } = req.params;
    const { name } = req.body;
    
    if (!name) {
      return res.status(400).json({
        success: false,
        message: 'Subcategory name is required',
      });
    }
    
    const category = await Category.findById(id);
    
    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found',
      });
    }
    
    const subcategory = category.subcategories.find(sub => sub.id === subcategoryId);
    
    if (!subcategory) {
      return res.status(404).json({
        success: false,
        message: 'Subcategory not found',
      });
    }
    
    // Check for duplicate subcategory name within this category (case-insensitive), excluding current
    const duplicate = category.subcategories.find(
      sub => sub.id !== subcategoryId && sub.name.toLowerCase() === name.trim().toLowerCase()
    );
    
    if (duplicate) {
      return res.status(409).json({
        success: false,
        message: 'Subcategory with this name already exists in this category',
      });
    }
    
    subcategory.name = name.trim();
    await category.save();
    
    res.json({
      success: true,
      data: category,
      message: 'Subcategory updated successfully',
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: 'Error updating subcategory',
      error: error.message,
    });
  }
};

/**
 * Enable/disable subcategory (Admin only)
 * PATCH /api/categories/:id/subcategories/:subcategoryId/status
 */
const toggleSubcategoryStatus = async (req, res) => {
  try {
    const { id, subcategoryId } = req.params;
    const { isActive } = req.body;
    
    if (typeof isActive !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: 'isActive field is required (boolean)',
      });
    }
    
    const category = await Category.findById(id);
    
    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found',
      });
    }
    
    const subcategory = category.subcategories.find(sub => sub.id === subcategoryId);
    
    if (!subcategory) {
      return res.status(404).json({
        success: false,
        message: 'Subcategory not found',
      });
    }
    
    subcategory.isActive = isActive;
    await category.save();
    
    res.json({
      success: true,
      data: category,
      message: `Subcategory ${isActive ? 'enabled' : 'disabled'} successfully`,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: 'Error updating subcategory status',
      error: error.message,
    });
  }
};

module.exports = {
  getCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  toggleCategoryStatus,
  addSubcategory,
  updateSubcategory,
  toggleSubcategoryStatus,
};

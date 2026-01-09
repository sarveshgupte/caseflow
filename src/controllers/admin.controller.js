const User = require('../models/User.model');
const Client = require('../models/Client.model');
const Category = require('../models/Category.model');
const Case = require('../models/Case.model');
const { CASE_STATUS } = require('../config/constants');

/**
 * Admin Controller for Admin Panel Operations
 * PR #41 - Admin panel statistics and management
 */

/**
 * Get admin dashboard statistics
 * GET /api/admin/stats
 * 
 * Returns all counts needed for admin panel header badges:
 * - Total users
 * - Total clients (active + inactive)
 * - Total categories (including soft-deleted)
 * - Pending approvals
 */
const getAdminStats = async (req, res) => {
  try {
    // Fetch all counts in parallel for performance
    const [
      totalUsers,
      totalClients,
      totalCategories,
      pendingApprovals,
    ] = await Promise.all([
      // Total users (all, regardless of status)
      User.countDocuments({}),
      
      // Total clients (active + inactive)
      Client.countDocuments({}),
      
      // Total categories (including soft-deleted via isActive: false)
      Category.countDocuments({}),
      
      // Pending approvals - cases with status 'Reviewed' or 'UNDER_REVIEW'
      Case.countDocuments({
        status: { $in: [CASE_STATUS.REVIEWED, CASE_STATUS.UNDER_REVIEW] }
      }),
    ]);
    
    res.json({
      success: true,
      data: {
        totalUsers,
        totalClients,
        totalCategories,
        pendingApprovals,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching admin statistics',
      error: error.message,
    });
  }
};

module.exports = {
  getAdminStats,
};

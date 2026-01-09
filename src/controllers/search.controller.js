const Case = require('../models/Case.model');
const Comment = require('../models/Comment.model');
const Attachment = require('../models/Attachment.model');
const User = require('../models/User.model');

/**
 * Search Controller for Global Search and Worklists
 * PART A - READ-ONLY operations for finding cases and viewing worklists
 */

/**
 * Global Search
 * GET /api/search?q=term
 * 
 * Search across all cases accessible to the user
 * Search fields: caseId, clientId, clientName, category, comment text, attachment fileName
 * 
 * Visibility Rules:
 * - Admin: Can see ALL cases
 * - Employee: Can see only cases where:
 *   - They are assigned (assignedTo matches their xID), OR
 *   - The case category is in their allowedCategories
 * 
 * PR #42: Updated to use xID for assignment matching
 */
const globalSearch = async (req, res) => {
  try {
    const { q } = req.query;
    const userEmail = req.body.email || req.query.email || req.headers['x-user-email'];
    
    if (!q || q.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Search query parameter "q" is required',
      });
    }
    
    if (!userEmail) {
      return res.status(401).json({
        success: false,
        message: 'User email is required for authentication',
      });
    }
    
    // Get user to check role and permissions
    const user = await User.findOne({ email: userEmail.toLowerCase() });
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User not found',
      });
    }
    
    const searchTerm = q.trim();
    const isAdmin = user.role === 'Admin';
    
    // Build search query
    let caseQuery = {};
    
    // Search in case fields (caseId, clientName, category)
    const caseSearchConditions = [
      { caseId: { $regex: searchTerm, $options: 'i' } },
      { clientName: { $regex: searchTerm, $options: 'i' } },
      { category: { $regex: searchTerm, $options: 'i' } },
    ];
    
    // Include clientId if it exists on the model
    if (searchTerm) {
      caseSearchConditions.push({ clientId: { $regex: searchTerm, $options: 'i' } });
    }
    
    // Find cases matching direct fields
    if (isAdmin) {
      caseQuery = { $or: caseSearchConditions };
    } else {
      // Employee: Only see assigned or allowed category cases
      // PR #42: Use xID for assignment matching
      // PR: xID Canonicalization - Use assignedToXID field
      caseQuery = {
        $and: [
          { $or: caseSearchConditions },
          {
            $or: [
              { assignedToXID: user.xID }, // CANONICAL: Match by xID in assignedToXID field
              { category: { $in: user.allowedCategories } },
            ],
          },
        ],
      };
    }
    
    const casesFromDirectSearch = await Case.find(caseQuery)
      .select('caseId title status category clientId clientName createdAt createdBy')
      .lean();
    
    // Search in comments using text index
    let commentsWithMatches = [];
    try {
      commentsWithMatches = await Comment.find(
        { $text: { $search: searchTerm } },
        { score: { $meta: 'textScore' } }
      )
        .select('caseId')
        .lean();
    } catch (error) {
      // Text index might not be ready yet, fallback to regex
      commentsWithMatches = await Comment.find(
        { text: { $regex: searchTerm, $options: 'i' } }
      )
        .select('caseId')
        .lean();
    }
    
    // Search in attachments using text index
    let attachmentsWithMatches = [];
    try {
      attachmentsWithMatches = await Attachment.find(
        { $text: { $search: searchTerm } },
        { score: { $meta: 'textScore' } }
      )
        .select('caseId')
        .lean();
    } catch (error) {
      // Text index might not be ready yet, fallback to regex
      attachmentsWithMatches = await Attachment.find(
        { fileName: { $regex: searchTerm, $options: 'i' } }
      )
        .select('caseId')
        .lean();
    }
    
    // Collect unique caseIds from comments and attachments
    const caseIdsFromComments = [...new Set(commentsWithMatches.map(c => c.caseId))];
    const caseIdsFromAttachments = [...new Set(attachmentsWithMatches.map(a => a.caseId))];
    const caseIdsFromRelated = [...new Set([...caseIdsFromComments, ...caseIdsFromAttachments])];
    
    // Find cases by these caseIds with visibility rules
    let casesFromRelated = [];
    if (caseIdsFromRelated.length > 0) {
      let relatedQuery = { caseId: { $in: caseIdsFromRelated } };
      
      if (!isAdmin) {
        // Apply employee visibility rules
        // PR #42: Use xID for assignment matching
        // PR: xID Canonicalization - Use assignedToXID field
        relatedQuery = {
          $and: [
            { caseId: { $in: caseIdsFromRelated } },
            {
              $or: [
                { assignedToXID: user.xID }, // CANONICAL: Match by xID in assignedToXID field
                { category: { $in: user.allowedCategories } },
              ],
            },
          ],
        };
      }
      
      casesFromRelated = await Case.find(relatedQuery)
        .select('caseId title status category clientId clientName createdAt createdBy')
        .lean();
    }
    
    // Merge results and remove duplicates
    const allCases = [...casesFromDirectSearch, ...casesFromRelated];
    const uniqueCases = [];
    const seenCaseIds = new Set();
    
    for (const c of allCases) {
      if (!seenCaseIds.has(c.caseId)) {
        seenCaseIds.add(c.caseId);
        uniqueCases.push(c);
      }
    }
    
    // Sort by createdAt descending
    uniqueCases.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    res.json({
      success: true,
      data: uniqueCases.map(c => ({
        caseId: c.caseId,
        title: c.title,
        status: c.status,
        category: c.category,
        clientId: c.clientId || null,
        clientName: c.clientName,
        createdAt: c.createdAt,
        createdBy: c.createdBy,
      })),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error performing search',
      error: error.message,
    });
  }
};

/**
 * Category Worklist
 * GET /api/worklists/category/:categoryId
 * 
 * Shows all cases in a specific category
 * Excludes Pending cases
 * Apply visibility rules (Admin sees all, Employee sees only allowed categories)
 */
const categoryWorklist = async (req, res) => {
  try {
    const { categoryId } = req.params;
    const userEmail = req.body.email || req.query.email || req.headers['x-user-email'];
    
    if (!categoryId) {
      return res.status(400).json({
        success: false,
        message: 'Category ID is required',
      });
    }
    
    if (!userEmail) {
      return res.status(401).json({
        success: false,
        message: 'User email is required for authentication',
      });
    }
    
    // Get user to check role and permissions
    const user = await User.findOne({ email: userEmail.toLowerCase() });
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User not found',
      });
    }
    
    const isAdmin = user.role === 'Admin';
    
    // Check if employee has access to this category
    if (!isAdmin && !user.allowedCategories.includes(categoryId)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: You do not have permission to view this category',
      });
    }
    
    // Build query: category matches and status is NOT Pending
    const query = {
      category: categoryId,
      status: { $ne: 'Pending' },
    };
    
    const cases = await Case.find(query)
      .select('caseId createdAt createdBy status clientId clientName')
      .sort({ createdAt: -1 })
      .lean();
    
    res.json({
      success: true,
      data: cases.map(c => ({
        caseId: c.caseId,
        createdAt: c.createdAt,
        createdBy: c.createdBy,
        status: c.status,
        clientId: c.clientId || null,
        clientName: c.clientName,
      })),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching category worklist',
      error: error.message,
    });
  }
};

/**
 * Employee Worklist
 * GET /api/worklists/employee/me
 * 
 * Shows all OPEN cases assigned to the current user.
 * This is the CANONICAL "My Worklist" query.
 * 
 * Query: assignedTo = user.xID AND status = OPEN
 * 
 * Cases shown:
 * - Assigned to this user's xID
 * - Status is OPEN (not PENDED, not FILED, not anything else)
 * 
 * Cases NOT shown:
 * - PENDED cases (these appear only in "My Pending Cases" dashboard)
 * - FILED cases (these are hidden from employees)
 * - UNASSIGNED cases (these are in global worklist)
 * 
 * Dashboard "My Open Cases" count MUST use the exact same query.
 * 
 * PR #42: Updated to query by xID instead of email
 * PR: Case Lifecycle - Fixed to use status = OPEN (not != Pending)
 */
const employeeWorklist = async (req, res) => {
  try {
    const userEmail = req.body.email || req.query.email || req.headers['x-user-email'];
    
    if (!userEmail) {
      return res.status(401).json({
        success: false,
        message: 'User email is required for authentication',
      });
    }
    
    // Get user to verify they exist
    const user = await User.findOne({ email: userEmail.toLowerCase() });
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User not found',
      });
    }
    
    // CANONICAL QUERY: assignedToXID = xID AND status = OPEN
    // This is the ONLY correct query for "My Worklist"
    // Dashboard counts MUST use the same query
    const query = {
      assignedToXID: user.xID, // CANONICAL: Query by xID in assignedToXID field
      status: CASE_STATUS.OPEN, // Only OPEN cases, not PENDED, not legacy 'Open'
    };
    
    const cases = await Case.find(query)
      .select('caseId caseName category createdAt createdBy updatedAt status clientId clientName')
      .sort({ createdAt: -1 })
      .lean();
    
    res.json({
      success: true,
      data: cases.map(c => ({
        _id: c._id, // Include _id for UI compatibility
        caseId: c.caseId,
        caseName: c.caseName,
        category: c.category,
        createdAt: c.createdAt,
        createdBy: c.createdBy,
        updatedAt: c.updatedAt,
        status: c.status,
        clientId: c.clientId || null,
        clientName: c.clientName,
      })),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching employee worklist',
      error: error.message,
    });
  }
};

/**
 * Global Worklist (Unassigned Cases Queue)
 * GET /api/worklists/global
 * 
 * Returns all cases with status UNASSIGNED
 * Supports server-side filtering and sorting
 * 
 * Query Parameters:
 * - clientId: Filter by client ID
 * - category: Filter by case category
 * - createdAtFrom: Filter by creation date (start)
 * - createdAtTo: Filter by creation date (end)
 * - slaStatus: Filter by SLA status (overdue, due_soon, on_track)
 * - sortBy: Field to sort by (clientId, category, slaDueDate, createdAt)
 * - sortOrder: Sort order (asc, desc)
 * - page: Page number for pagination
 * - limit: Results per page
 * 
 * Default sort: slaDueDate ASC
 */
const globalWorklist = async (req, res) => {
  try {
    const {
      clientId,
      category,
      createdAtFrom,
      createdAtTo,
      slaStatus,
      sortBy = 'slaDueDate',
      sortOrder = 'asc',
      page = 1,
      limit = 20,
    } = req.query;
    
    // Build query for UNASSIGNED cases only
    const query = { status: 'UNASSIGNED' };
    
    // Apply filters
    if (clientId) {
      query.clientId = clientId;
    }
    
    if (category) {
      query.category = category;
    }
    
    // Date range filter
    if (createdAtFrom || createdAtTo) {
      query.createdAt = {};
      if (createdAtFrom) {
        query.createdAt.$gte = new Date(createdAtFrom);
      }
      if (createdAtTo) {
        query.createdAt.$lte = new Date(createdAtTo);
      }
    }
    
    // SLA status filter (computed based on slaDueDate)
    if (slaStatus) {
      const now = new Date();
      const twoDaysFromNow = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);
      
      if (slaStatus === 'overdue') {
        // Cases where slaDueDate < now
        query.slaDueDate = { $lt: now };
      } else if (slaStatus === 'due_soon') {
        // Cases where slaDueDate is between now and 2 days from now
        query.slaDueDate = { $gte: now, $lte: twoDaysFromNow };
      } else if (slaStatus === 'on_track') {
        // Cases where slaDueDate > 2 days from now OR no slaDueDate
        query.$or = [
          { slaDueDate: { $gt: twoDaysFromNow } },
          { slaDueDate: null },
        ];
      }
    }
    
    // Build sort object
    const sortFields = {
      clientId: 'clientId',
      category: 'category',
      slaDueDate: 'slaDueDate',
      createdAt: 'createdAt',
    };
    
    const sortField = sortFields[sortBy] || 'slaDueDate';
    const sortDirection = sortOrder === 'desc' ? -1 : 1;
    const sort = { [sortField]: sortDirection };
    
    // Build the base query without slaDueDate modifications for separation
    const baseQuery = { ...query };
    
    // Handle null slaDueDate - put them at the end
    let casesWithSLA = [];
    let casesWithoutSLA = [];
    
    if (sortBy === 'slaDueDate') {
      // Query for cases WITH slaDueDate (not null)
      const queryWithSLA = { ...baseQuery };
      // Don't modify if slaStatus filter is already applied
      if (!slaStatus) {
        queryWithSLA.slaDueDate = { $ne: null };
      }
      
      casesWithSLA = await Case.find(queryWithSLA)
        .select('caseId caseName clientId category slaDueDate createdAt createdBy')
        .sort(sort)
        .limit(parseInt(limit))
        .skip((parseInt(page) - 1) * parseInt(limit))
        .lean();
      
      // Query for cases WITHOUT slaDueDate (null) - only if no slaStatus filter
      if (!slaStatus && casesWithSLA.length < parseInt(limit)) {
        const queryWithoutSLA = { ...baseQuery, slaDueDate: null };
        
        casesWithoutSLA = await Case.find(queryWithoutSLA)
          .select('caseId caseName clientId category slaDueDate createdAt createdBy')
          .sort({ createdAt: sortDirection })
          .limit(parseInt(limit) - casesWithSLA.length)
          .skip(Math.max(0, (parseInt(page) - 1) * parseInt(limit) - casesWithSLA.length))
          .lean();
      }
    } else {
      // For other sort fields, just execute the query normally
      casesWithSLA = await Case.find(baseQuery)
        .select('caseId caseName clientId category slaDueDate createdAt createdBy')
        .sort(sort)
        .limit(parseInt(limit))
        .skip((parseInt(page) - 1) * parseInt(limit))
        .lean();
    }
    
    // Merge results
    const allCases = [...casesWithSLA, ...casesWithoutSLA];
    
    // Calculate SLA days remaining for each case
    const now = new Date();
    const casesWithSLAInfo = allCases.map(c => {
      let slaDaysRemaining = null;
      if (c.slaDueDate) {
        const dueDate = new Date(c.slaDueDate);
        const diffTime = dueDate - now;
        slaDaysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      }
      
      return {
        caseId: c.caseId,
        caseName: c.caseName,
        clientId: c.clientId,
        category: c.category,
        slaDueDate: c.slaDueDate,
        slaDaysRemaining,
        createdAt: c.createdAt,
        createdBy: c.createdBy,
      };
    });
    
    // Count total for pagination
    const totalQuery = { ...baseQuery };
    // Don't exclude null slaDueDate from count unless slaStatus filter is applied
    const total = await Case.countDocuments(totalQuery);
    
    res.json({
      success: true,
      data: casesWithSLAInfo,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching global worklist',
      error: error.message,
    });
  }
};

module.exports = {
  globalSearch,
  categoryWorklist,
  employeeWorklist,
  globalWorklist,
};

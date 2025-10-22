const FeeCategory = require('../models/FeeCategory');
const asyncHandler = require('../middleware/asyncHandler');

// @desc    Get all fee categories
// @route   GET /api/fee-categories
// @access  Private
exports.getFeeCategories = asyncHandler(async (req, res) => {
  const { schoolId, status, search, page = 1, limit = 100 } = req.query;
  
  // Build query
  let query = {};
  
  // If user is not admin, filter by their school
  if (req.user.role !== 'admin') {
    query.school = req.user.schoolId;
  } else if (schoolId) {
    query.school = schoolId;
  }
  
  if (status) {
    query.status = status;
  }
  
  if (search) {
    query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { description: { $regex: search, $options: 'i' } }
    ];
  }

  // Calculate pagination
  const skip = (parseInt(page) - 1) * parseInt(limit);
  
  // Get categories with pagination
  const categories = await FeeCategory.find(query)
    .sort({ name: 1 })
    .skip(skip)
    .limit(parseInt(limit))
    .populate('createdBy', 'name email');

  // Get total count for pagination
  const total = await FeeCategory.countDocuments(query);

  res.status(200).json({
    success: true,
    count: categories.length,
    total,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      pages: Math.ceil(total / parseInt(limit))
    },
    data: categories
  });
});

// @desc    Get single fee category
// @route   GET /api/fee-categories/:id
// @access  Private
exports.getFeeCategory = asyncHandler(async (req, res) => {
  const category = await FeeCategory.findById(req.params.id)
    .populate('createdBy', 'name email');

  if (!category) {
    return res.status(404).json({
      success: false,
      error: 'Fee category not found'
    });
  }

  // Check if user has access to this category
  if (req.user.role !== 'admin' && category.school.toString() !== req.user.schoolId.toString()) {
    return res.status(403).json({
      success: false,
      error: 'Not authorized to access this category'
    });
  }

  res.status(200).json({
    success: true,
    data: category
  });
});

// @desc    Create new fee category
// @route   POST /api/fee-categories
// @access  Private
exports.createFeeCategory = asyncHandler(async (req, res) => {
  const { name, description, status } = req.body;

  // Validate required fields
  if (!name) {
    return res.status(400).json({
      success: false,
      error: 'Category name is required'
    });
  }

  // Get school from user or request
  const school = req.user.role === 'admin' && req.body.school ? req.body.school : req.user.schoolId;

  // Check if category with same name already exists for this school
  const existingCategory = await FeeCategory.findOne({ 
    name: name.trim(),
    school 
  });

  if (existingCategory) {
    return res.status(400).json({
      success: false,
      error: 'A category with this name already exists'
    });
  }

  // Create category
  const category = await FeeCategory.create({
    school,
    name: name.trim(),
    description,
    status: status || 'active',
    createdBy: req.user._id
  });

  // Populate created by
  await category.populate('createdBy', 'name email');

  res.status(201).json({
    success: true,
    message: 'Fee category created successfully',
    data: category
  });
});

// @desc    Update fee category
// @route   PUT /api/fee-categories/:id
// @access  Private
exports.updateFeeCategory = asyncHandler(async (req, res) => {
  const category = await FeeCategory.findById(req.params.id);
  
  if (!category) {
    return res.status(404).json({
      success: false,
      error: 'Fee category not found'
    });
  }

  // Check if user has access to this category
  if (req.user.role !== 'admin' && category.school.toString() !== req.user.schoolId.toString()) {
    return res.status(403).json({
      success: false,
      error: 'Not authorized to update this category'
    });
  }

  const { name, description, status } = req.body;

  // If name is being changed, check for duplicates
  if (name && name.trim() !== category.name) {
    const existingCategory = await FeeCategory.findOne({
      name: name.trim(),
      school: category.school,
      _id: { $ne: category._id }
    });

    if (existingCategory) {
      return res.status(400).json({
        success: false,
        error: 'A category with this name already exists'
      });
    }
    category.name = name.trim();
  }

  // Update fields
  if (description !== undefined) category.description = description;
  if (status) category.status = status;

  await category.save();

  // Populate created by
  await category.populate('createdBy', 'name email');

  res.status(200).json({
    success: true,
    message: 'Fee category updated successfully',
    data: category
  });
});

// @desc    Delete fee category
// @route   DELETE /api/fee-categories/:id
// @access  Private
exports.deleteFeeCategory = asyncHandler(async (req, res) => {
  const category = await FeeCategory.findById(req.params.id);
  
  if (!category) {
    return res.status(404).json({
      success: false,
      error: 'Fee category not found'
    });
  }

  // Check if user has access to this category
  if (req.user.role !== 'admin' && category.school.toString() !== req.user.schoolId.toString()) {
    return res.status(403).json({
      success: false,
      error: 'Not authorized to delete this category'
    });
  }

  // Check if category is being used in any fee structures
  const FeeStructure = require('../models/FeeStructure');
  const feeStructuresCount = await FeeStructure.countDocuments({ category: category._id });

  if (feeStructuresCount > 0) {
    return res.status(400).json({
      success: false,
      error: `Cannot delete category. It is being used in ${feeStructuresCount} fee structure(s). Please delete or update those fee structures first.`
    });
  }

  await category.deleteOne();

  res.status(200).json({
    success: true,
    message: 'Fee category deleted successfully',
    data: {}
  });
});

// @desc    Get active fee categories for dropdown
// @route   GET /api/fee-categories/active/list
// @access  Private
exports.getActiveFeeCategories = asyncHandler(async (req, res) => {
  const school = req.user.role === 'admin' && req.query.schoolId ? req.query.schoolId : req.user.schoolId;

  const categories = await FeeCategory.find({ 
    school,
    status: 'active' 
  })
  .select('name description')
  .sort({ name: 1 });

  res.status(200).json({
    success: true,
    count: categories.length,
    data: categories
  });
});


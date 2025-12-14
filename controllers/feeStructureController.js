const FeeStructure = require('../models/FeeStructure');
const FeeCategory = require('../models/FeeCategory');
const Class = require('../models/Class');
const asyncHandler = require('../middleware/asyncHandler');

// @desc    Get all fee structures
// @route   GET /api/fee-structures
// @access  Private
exports.getFeeStructures = asyncHandler(async (req, res) => {
  const { schoolId, classId, categoryId, status, academicYear, search, page = 1, limit = 50 } = req.query;
  
  // Build query
  let query = {};
  
  // If user is not admin, filter by their school
  if (req.user.role !== 'admin') {
    query.school = req.user.schoolId;
  } else if (schoolId) {
    query.school = schoolId;
  }
  
  if (classId) {
    query.class = classId;
  }
  
  if (categoryId) {
    query.category = categoryId;
  }
  
  if (status) {
    query.status = status;
  }
  
  if (academicYear) {
    query.academicYear = academicYear;
  }
  
  if (search) {
    query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { description: { $regex: search, $options: 'i' } }
    ];
  }

  // Calculate pagination
  const skip = (parseInt(page) - 1) * parseInt(limit);
  
  // Get fee structures with pagination
  const feeStructures = await FeeStructure.find(query)
    .sort({ name: 1 })
    .skip(skip)
    .limit(parseInt(limit))
    .populate('category', 'name description')
    .populate('class', 'name section')
    .populate('createdBy', 'name email');

  // Get total count for pagination
  const total = await FeeStructure.countDocuments(query);

  res.status(200).json({
    success: true,
    count: feeStructures.length,
    total,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      pages: Math.ceil(total / parseInt(limit))
    },
    data: feeStructures
  });
});

// @desc    Get single fee structure
// @route   GET /api/fee-structures/:id
// @access  Private
exports.getFeeStructure = asyncHandler(async (req, res) => {
  const feeStructure = await FeeStructure.findById(req.params.id)
    .populate('category', 'name description')
    .populate('class', 'name section')
    .populate('createdBy', 'name email');

  if (!feeStructure) {
    return res.status(404).json({
      success: false,
      error: 'Fee structure not found'
    });
  }

  // Check if user has access to this fee structure
  if (req.user.role !== 'admin' && feeStructure.school.toString() !== req.user.schoolId.toString()) {
    return res.status(403).json({
      success: false,
      error: 'Not authorized to access this fee structure'
    });
  }

  res.status(200).json({
    success: true,
    data: feeStructure
  });
});

// @desc    Create new fee structure
// @route   POST /api/fee-structures
// @access  Private
exports.createFeeStructure = asyncHandler(async (req, res) => {
  const {
    name,
    category,
    class: classId,
    amount,
    components,
    totalAmount,
    frequency,
    dueDay,
    lateFee,
    discount,
    status,
    academicYear,
    description,
    type
  } = req.body;

  // Validate required fields - support both old and new format
  const hasComponents = components && components.length > 0;
  const hasOldFormat = amount && category;
  
  if (!name || !academicYear) {
    return res.status(400).json({
      success: false,
      error: 'Please provide name and academic year'
    });
  }

  if (!hasComponents && !hasOldFormat) {
    return res.status(400).json({
      success: false,
      error: 'Please provide either components or category and amount'
    });
  }

  // Get school from user or request
  const school = req.user.role === 'admin' && req.body.school ? req.body.school : req.user.schoolId;

  console.log('Creating fee structure:', {
    school,
    name,
    hasComponents,
    hasOldFormat,
    classId,
    userSchoolId: req.user.schoolId,
    userRole: req.user.role
  });

  // Verify category exists if using old format
  if (hasOldFormat && category) {
    const feeCategory = await FeeCategory.findOne({ _id: category, school });
    if (!feeCategory) {
      return res.status(400).json({
        success: false,
        error: 'Fee category not found or does not belong to this school'
      });
    }
  }

  // Verify class exists if provided (skip if null or empty string)
  if (classId && classId.trim() !== '') {
    const classData = await Class.findOne({ _id: classId, schoolId: school });
    if (!classData) {
      return res.status(400).json({
        success: false,
        error: `Class not found or does not belong to this school. ClassID: ${classId}, SchoolID: ${school}`
      });
    }
  }

  // Check if fee structure with same name already exists for this school, class, and academic year
  const existingFeeStructure = await FeeStructure.findOne({
    name: name.trim(),
    school,
    class: classId || null,
    academicYear
  });

  if (existingFeeStructure) {
    return res.status(400).json({
      success: false,
      error: 'A fee structure with this name already exists for this class and academic year'
    });
  }

  // Calculate total from components if provided
  let finalAmount = amount || 0;
  let finalTotalAmount = totalAmount || 0;
  
  if (hasComponents) {
    const validComponents = components.filter(c => c.category && c.amount > 0);
    finalTotalAmount = validComponents.reduce((sum, c) => sum + (c.amount || 0), 0);
    finalAmount = finalTotalAmount;
  }

  // Create fee structure
  const feeStructure = await FeeStructure.create({
    school,
    name: name.trim(),
    category: category || null,
    class: classId || null,
    amount: finalAmount,
    components: hasComponents ? components : [],
    totalAmount: finalTotalAmount,
    frequency: frequency || 'monthly',
    dueDay: dueDay || 1,
    type: type || 'monthly',
    lateFee: lateFee || { enabled: false, type: 'fixed', value: 0, gracePeriod: 0 },
    discount: discount || { enabled: false, type: 'percentage', value: 0 },
    status: status || 'active',
    academicYear,
    description,
    createdBy: req.user._id
  });

  // Populate related data
  await feeStructure.populate('category', 'name description');
  await feeStructure.populate('class', 'name section');
  await feeStructure.populate('createdBy', 'name email');

  res.status(201).json({
    success: true,
    message: 'Fee structure created successfully',
    data: feeStructure
  });
});

// @desc    Update fee structure
// @route   PUT /api/fee-structures/:id
// @access  Private
exports.updateFeeStructure = asyncHandler(async (req, res) => {
  const feeStructure = await FeeStructure.findById(req.params.id);
  
  if (!feeStructure) {
    return res.status(404).json({
      success: false,
      error: 'Fee structure not found'
    });
  }

  // Check if user has access to this fee structure
  if (req.user.role !== 'admin' && feeStructure.school.toString() !== req.user.schoolId.toString()) {
    return res.status(403).json({
      success: false,
      error: 'Not authorized to update this fee structure'
    });
  }

  const {
    name,
    category,
    class: classId,
    amount,
    components,
    totalAmount,
    frequency,
    dueDay,
    lateFee,
    discount,
    status,
    academicYear,
    description,
    type
  } = req.body;

  // Verify category exists if being updated
  if (category && category !== feeStructure.category?.toString()) {
    const feeCategory = await FeeCategory.findOne({ _id: category, school: feeStructure.school });
    if (!feeCategory) {
      return res.status(400).json({
        success: false,
        error: 'Fee category not found or does not belong to this school'
      });
    }
    feeStructure.category = category;
  }

  // Verify class exists if being updated
  if (classId !== undefined) {
    if (classId && classId.trim() !== '') {
      const classData = await Class.findOne({ _id: classId, schoolId: feeStructure.school });
      if (!classData) {
        return res.status(400).json({
          success: false,
          error: `Class not found or does not belong to this school. ClassID: ${classId}, SchoolID: ${feeStructure.school}`
        });
      }
      feeStructure.class = classId;
    } else {
      feeStructure.class = null;
    }
  }

  // Check for duplicate name if name is being changed
  if (name && name.trim() !== feeStructure.name) {
    const existingFeeStructure = await FeeStructure.findOne({
      name: name.trim(),
      school: feeStructure.school,
      class: classId !== undefined ? (classId || null) : feeStructure.class,
      academicYear: academicYear || feeStructure.academicYear,
      _id: { $ne: feeStructure._id }
    });

    if (existingFeeStructure) {
      return res.status(400).json({
        success: false,
        error: 'A fee structure with this name already exists for this class and academic year'
      });
    }
    feeStructure.name = name.trim();
  }

  // Update fields
  if (amount !== undefined) feeStructure.amount = amount;
  
  // Handle components update
  if (components && Array.isArray(components)) {
    const validComponents = components.filter(c => c.category && c.amount > 0);
    feeStructure.components = validComponents;
    const calculatedTotal = validComponents.reduce((sum, c) => sum + (c.amount || 0), 0);
    feeStructure.totalAmount = calculatedTotal;
    feeStructure.amount = calculatedTotal; // Sync with amount field
  } else if (totalAmount !== undefined) {
    feeStructure.totalAmount = totalAmount;
  }
  
  if (frequency) feeStructure.frequency = frequency;
  if (dueDay !== undefined) feeStructure.dueDay = dueDay;
  if (lateFee) feeStructure.lateFee = lateFee;
  if (discount) feeStructure.discount = discount;
  if (status) feeStructure.status = status;
  if (academicYear) feeStructure.academicYear = academicYear;
  if (description !== undefined) feeStructure.description = description;
  if (type) feeStructure.type = type;

  await feeStructure.save();

  // Populate related data
  await feeStructure.populate('category', 'name description');
  await feeStructure.populate('class', 'name section');
  await feeStructure.populate('createdBy', 'name email');

  res.status(200).json({
    success: true,
    message: 'Fee structure updated successfully',
    data: feeStructure
  });
});

// @desc    Delete fee structure
// @route   DELETE /api/fee-structures/:id
// @access  Private
exports.deleteFeeStructure = asyncHandler(async (req, res) => {
  const feeStructure = await FeeStructure.findById(req.params.id);
  
  if (!feeStructure) {
    return res.status(404).json({
      success: false,
      error: 'Fee structure not found'
    });
  }

  // Check if user has access to this fee structure
  if (req.user.role !== 'admin' && feeStructure.school.toString() !== req.user.schoolId.toString()) {
    return res.status(403).json({
      success: false,
      error: 'Not authorized to delete this fee structure'
    });
  }

  // Check if fee structure is being used in any fee collections
  const FeeCollection = require('../models/FeeCollection');
  const feeCollectionsCount = await FeeCollection.countDocuments({ feeStructure: feeStructure._id });

  if (feeCollectionsCount > 0) {
    return res.status(400).json({
      success: false,
      error: `Cannot delete fee structure. It is being used in ${feeCollectionsCount} fee collection(s). You can deactivate it instead.`
    });
  }

  await feeStructure.deleteOne();

  res.status(200).json({
    success: true,
    message: 'Fee structure deleted successfully',
    data: {}
  });
});

// @desc    Get active fee structures for dropdown
// @route   GET /api/fee-structures/active/list
// @access  Private
exports.getActiveFeeStructures = asyncHandler(async (req, res) => {
  const { classId, academicYear } = req.query;
  const school = req.user.role === 'admin' && req.query.schoolId ? req.query.schoolId : req.user.schoolId;

  const query = {
    school,
    status: 'active'
  };

  if (academicYear) {
    query.academicYear = academicYear;
  }

  if (classId) {
    query.$or = [
      { class: classId },
      { class: null }
    ];
  }

  const feeStructures = await FeeStructure.find(query)
    .select('name amount frequency category class')
    .populate('category', 'name')
    .populate('class', 'name section')
    .sort({ name: 1 });

  res.status(200).json({
    success: true,
    count: feeStructures.length,
    data: feeStructures
  });
});


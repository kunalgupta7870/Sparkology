const FeeReceipt = require('../models/FeeReceipt');
const FeeCollection = require('../models/FeeCollection');
const Student = require('../models/Student');
const asyncHandler = require('../middleware/asyncHandler');

// @desc    Get all fee receipts
// @route   GET /api/fee-receipts
// @access  Private
exports.getFeeReceipts = asyncHandler(async (req, res) => {
  const { schoolId, studentId, academicYear, status, paymentMethod, search, page = 1, limit = 50 } = req.query;
  
  // Build query
  let query = {};
  
  // If user is not admin, filter by their school
  if (req.user.role !== 'admin') {
    query.school = req.user.schoolId;
  } else if (schoolId) {
    query.school = schoolId;
  }
  
  if (studentId) {
    query.student = studentId;
  }
  
  if (academicYear) {
    query.academicYear = academicYear;
  }
  
  if (status) {
    query.status = status;
  } else {
    query.status = 'active'; // Default to active receipts
  }
  
  if (paymentMethod) {
    query.paymentMethod = paymentMethod;
  }
  
  if (search) {
    query.$or = [
      { receiptNumber: { $regex: search, $options: 'i' } },
      { transactionId: { $regex: search, $options: 'i' } },
      { remarks: { $regex: search, $options: 'i' } }
    ];
  }

  // Calculate pagination
  const skip = (parseInt(page) - 1) * parseInt(limit);
  
  // Get fee receipts with pagination
  const feeReceipts = await FeeReceipt.find(query)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit))
    .populate({
      path: 'student',
      select: 'name admissionNumber classId email phone',
      populate: {
        path: 'classId',
        select: 'name section'
      }
    })
    .populate({
      path: 'feeStructure',
      select: 'name amount category',
      populate: {
        path: 'category',
        select: 'name'
      }
    })
    .populate('feeCollection', 'totalAmount paidAmount dueAmount status')
    .populate('createdBy', 'name email')
    .populate('cancelledBy', 'name email');

  // Get total count for pagination
  const total = await FeeReceipt.countDocuments(query);

  res.status(200).json({
    success: true,
    count: feeReceipts.length,
    total,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      pages: Math.ceil(total / parseInt(limit))
    },
    data: feeReceipts
  });
});

// @desc    Get single fee receipt
// @route   GET /api/fee-receipts/:id
// @access  Private
exports.getFeeReceipt = asyncHandler(async (req, res) => {
  const feeReceipt = await FeeReceipt.findById(req.params.id)
    .populate({
      path: 'student',
      select: 'name admissionNumber classId email phone parentPhone parentEmail',
      populate: {
        path: 'classId',
        select: 'name section'
      }
    })
    .populate('school', 'name code address contact')
    .populate({
      path: 'feeStructure',
      select: 'name amount category frequency',
      populate: {
        path: 'category',
        select: 'name description'
      }
    })
    .populate('feeCollection', 'totalAmount discountAmount lateFeeAmount paidAmount dueAmount status')
    .populate('createdBy', 'name email')
    .populate('cancelledBy', 'name email');

  if (!feeReceipt) {
    return res.status(404).json({
      success: false,
      error: 'Fee receipt not found'
    });
  }

  // Check if user has access to this fee receipt
  if (req.user.role !== 'admin' && feeReceipt.school._id.toString() !== req.user.schoolId.toString()) {
    return res.status(403).json({
      success: false,
      error: 'Not authorized to access this fee receipt'
    });
  }

  res.status(200).json({
    success: true,
    data: feeReceipt
  });
});

// @desc    Get receipt by receipt number
// @route   GET /api/fee-receipts/number/:receiptNumber
// @access  Private
exports.getFeeReceiptByNumber = asyncHandler(async (req, res) => {
  const feeReceipt = await FeeReceipt.findOne({ receiptNumber: req.params.receiptNumber.toUpperCase() })
    .populate({
      path: 'student',
      select: 'name admissionNumber classId email phone parentPhone parentEmail',
      populate: {
        path: 'classId',
        select: 'name section'
      }
    })
    .populate('school', 'name code address contact')
    .populate({
      path: 'feeStructure',
      select: 'name amount category frequency',
      populate: {
        path: 'category',
        select: 'name description'
      }
    })
    .populate('feeCollection', 'totalAmount discountAmount lateFeeAmount paidAmount dueAmount status')
    .populate('createdBy', 'name email')
    .populate('cancelledBy', 'name email');

  if (!feeReceipt) {
    return res.status(404).json({
      success: false,
      error: 'Fee receipt not found'
    });
  }

  // Check if user has access to this fee receipt
  if (req.user.role !== 'admin' && feeReceipt.school._id.toString() !== req.user.schoolId.toString()) {
    return res.status(403).json({
      success: false,
      error: 'Not authorized to access this fee receipt'
    });
  }

  res.status(200).json({
    success: true,
    data: feeReceipt
  });
});

// @desc    Create new fee receipt (generate receipt)
// @route   POST /api/fee-receipts
// @access  Private
exports.createFeeReceipt = asyncHandler(async (req, res) => {
  const {
    student: studentId,
    feeCollection: feeCollectionId,
    amount,
    paymentDate,
    paymentMethod,
    transactionId,
    chequeNumber,
    chequeDate,
    bankName,
    remarks
  } = req.body;

  console.log('Creating fee receipt - received data:', {
    student: studentId,
    feeCollection: feeCollectionId,
    amount,
    paymentDate,
    paymentMethod,
    transactionId,
    remarks
  });

  // Validate required fields
  if (!studentId || !feeCollectionId || !amount || !paymentDate || !paymentMethod) {
    console.log('Validation failed - missing fields:', {
      hasStudent: !!studentId,
      hasFeeCollection: !!feeCollectionId,
      hasAmount: !!amount,
      hasPaymentDate: !!paymentDate,
      hasPaymentMethod: !!paymentMethod
    });
    return res.status(400).json({
      success: false,
      error: 'Please provide student, fee collection, amount, payment date, and payment method'
    });
  }

  // Get school from user or request
  const school = req.user.role === 'admin' && req.body.school ? req.body.school : req.user.schoolId;

  // Verify student exists and belongs to school
  const student = await Student.findOne({ _id: studentId, schoolId: school });
  if (!student) {
    return res.status(400).json({
      success: false,
      error: 'Student not found or does not belong to this school'
    });
  }

  // Verify fee collection exists and belongs to school
  const feeCollection = await FeeCollection.findOne({ _id: feeCollectionId, school })
    .populate('feeStructure');
  if (!feeCollection) {
    return res.status(400).json({
      success: false,
      error: 'Fee collection not found or does not belong to this school'
    });
  }

  // Validate amount
  if (amount <= 0) {
    return res.status(400).json({
      success: false,
      error: 'Amount must be greater than 0'
    });
  }

  if (amount > feeCollection.dueAmount) {
    return res.status(400).json({
      success: false,
      error: `Amount cannot exceed due amount of ${feeCollection.dueAmount}`
    });
  }

  // Create fee receipt
  const feeReceipt = await FeeReceipt.create({
    school,
    student: studentId,
    feeCollection: feeCollectionId,
    feeStructure: feeCollection.feeStructure._id,
    academicYear: feeCollection.academicYear,
    amount,
    paymentDate: new Date(paymentDate),
    paymentMethod,
    transactionId,
    chequeNumber,
    chequeDate: chequeDate ? new Date(chequeDate) : undefined,
    bankName,
    remarks,
    createdBy: req.user._id
  });

  // Add payment to fee collection
  await feeCollection.addPayment({
    amount,
    paymentDate: new Date(paymentDate),
    paymentMethod,
    transactionId,
    remarks,
    collectedBy: req.user._id
  });

  // Populate related data
  await feeReceipt.populate({
    path: 'student',
    select: 'name admissionNumber classId email phone',
    populate: {
      path: 'classId',
      select: 'name section'
    }
  });
  await feeReceipt.populate({
    path: 'feeStructure',
    select: 'name amount category',
    populate: {
      path: 'category',
      select: 'name'
    }
  });
  await feeReceipt.populate('feeCollection', 'totalAmount paidAmount dueAmount status');
  await feeReceipt.populate('createdBy', 'name email');

  res.status(201).json({
    success: true,
    message: 'Fee receipt generated successfully',
    data: feeReceipt
  });
});

// @desc    Cancel fee receipt
// @route   PUT /api/fee-receipts/:id/cancel
// @access  Private
exports.cancelFeeReceipt = asyncHandler(async (req, res) => {
  const { reason } = req.body;
  const feeReceipt = await FeeReceipt.findById(req.params.id);
  
  if (!feeReceipt) {
    return res.status(404).json({
      success: false,
      error: 'Fee receipt not found'
    });
  }

  // Check if user has access to this fee receipt
  if (req.user.role !== 'admin' && feeReceipt.school.toString() !== req.user.schoolId.toString()) {
    return res.status(403).json({
      success: false,
      error: 'Not authorized to cancel this fee receipt'
    });
  }

  if (feeReceipt.status === 'cancelled') {
    return res.status(400).json({
      success: false,
      error: 'Fee receipt is already cancelled'
    });
  }

  // Cancel the receipt
  await feeReceipt.cancelReceipt(reason || 'Cancelled by user', req.user._id);

  // Update fee collection to deduct the payment
  const feeCollection = await FeeCollection.findById(feeReceipt.feeCollection);
  if (feeCollection) {
    feeCollection.paidAmount -= feeReceipt.amount;
    await feeCollection.save();
  }

  // Populate related data
  await feeReceipt.populate({
    path: 'student',
    select: 'name admissionNumber classId email phone',
    populate: {
      path: 'classId',
      select: 'name section'
    }
  });
  await feeReceipt.populate({
    path: 'feeStructure',
    select: 'name amount category',
    populate: {
      path: 'category',
      select: 'name'
    }
  });
  await feeReceipt.populate('cancelledBy', 'name email');

  res.status(200).json({
    success: true,
    message: 'Fee receipt cancelled successfully',
    data: feeReceipt
  });
});

// @desc    Get receipt statistics
// @route   GET /api/fee-receipts/stats
// @access  Private
exports.getReceiptStats = asyncHandler(async (req, res) => {
  const { academicYear, startDate, endDate } = req.query;
  const school = req.user.role === 'admin' && req.query.schoolId ? req.query.schoolId : req.user.schoolId;

  const stats = await FeeReceipt.getReceiptStats(school, academicYear, startDate, endDate);
  const paymentMethodStats = await FeeReceipt.getReceiptsByPaymentMethod(school, academicYear);

  // Get counts by status
  const statusCounts = await FeeReceipt.aggregate([
    { 
      $match: { 
        school: school,
        ...(academicYear && { academicYear })
      } 
    },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 }
      }
    }
  ]);

  res.status(200).json({
    success: true,
    data: {
      summary: stats[0] || {
        totalReceipts: 0,
        totalAmount: 0,
        averageAmount: 0
      },
      statusCounts,
      paymentMethodStats
    }
  });
});

// @desc    Get receipts by date range
// @route   GET /api/fee-receipts/date-range
// @access  Private
exports.getReceiptsByDateRange = asyncHandler(async (req, res) => {
  const { startDate, endDate } = req.query;
  const school = req.user.role === 'admin' && req.query.schoolId ? req.query.schoolId : req.user.schoolId;

  if (!startDate || !endDate) {
    return res.status(400).json({
      success: false,
      error: 'Start date and end date are required'
    });
  }

  const receipts = await FeeReceipt.getReceiptsByDateRange(school, startDate, endDate);

  res.status(200).json({
    success: true,
    count: receipts.length,
    data: receipts
  });
});

// @desc    Get receipts by student
// @route   GET /api/fee-receipts/student/:studentId
// @access  Private
exports.getReceiptsByStudent = asyncHandler(async (req, res) => {
  const { studentId } = req.params;
  const { academicYear } = req.query;

  // Verify student exists
  const student = await Student.findById(studentId);
  if (!student) {
    return res.status(404).json({
      success: false,
      error: 'Student not found'
    });
  }

  // Check if user has access to this student
  if (req.user.role !== 'admin' && student.school.toString() !== req.user.schoolId.toString()) {
    return res.status(403).json({
      success: false,
      error: 'Not authorized to access this student\'s receipts'
    });
  }

  const receipts = await FeeReceipt.getReceiptsByStudent(studentId, academicYear);

  res.status(200).json({
    success: true,
    count: receipts.length,
    data: receipts
  });
});


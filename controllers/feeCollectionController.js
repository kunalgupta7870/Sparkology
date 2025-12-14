const FeeCollection = require('../models/FeeCollection');
const FeeStructure = require('../models/FeeStructure');
const Student = require('../models/Student');
const asyncHandler = require('../middleware/asyncHandler');

// @desc    Get all fee collections
// @route   GET /api/fee-collections
// @access  Private
exports.getFeeCollections = asyncHandler(async (req, res) => {
  const { schoolId, studentId, status, academicYear, month, search, classId, page = 1, limit = 50 } = req.query;
  
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
  
  if (status) {
    // Support 'unpaid' status which includes pending, partial, and overdue
    if (status === 'unpaid') {
      query.status = { $in: ['pending', 'partial', 'overdue'] };
    } else {
      query.status = status;
    }
  }
  
  if (academicYear) {
    query.academicYear = academicYear;
  }
  
  if (month) {
    query.month = month;
  }

  // If search is provided, find matching students first
  let studentIds = null;
  if (search) {
    const school = req.user.role !== 'admin' ? req.user.schoolId : (schoolId || req.user.schoolId);
    const studentQuery = {
      schoolId: school,
      $or: [
        { name: { $regex: search, $options: 'i' } },
        { admissionNumber: { $regex: search, $options: 'i' } },
        { rollNumber: { $regex: search, $options: 'i' } }
      ]
    };
    
    // If classId is also provided, add it to student query
    if (classId) {
      studentQuery.classId = classId;
    }
    
    const matchingStudents = await Student.find(studentQuery).select('_id');
    studentIds = matchingStudents.map(s => s._id);
    
    if (studentIds.length === 0) {
      // No matching students, return empty result
      return res.status(200).json({
        success: true,
        count: 0,
        total: 0,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          pages: 0
        },
        data: []
      });
    }
    
    query.student = { $in: studentIds };
  } else if (classId) {
    // If only classId is provided (no search), find students in that class
    const school = req.user.role !== 'admin' ? req.user.schoolId : (schoolId || req.user.schoolId);
    const studentsInClass = await Student.find({ 
      schoolId: school,
      classId: classId 
    }).select('_id');
    const studentIdsInClass = studentsInClass.map(s => s._id);
    
    if (studentIdsInClass.length === 0) {
      return res.status(200).json({
        success: true,
        count: 0,
        total: 0,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          pages: 0
        },
        data: []
      });
    }
    
    query.student = { $in: studentIdsInClass };
  }

  // Calculate pagination
  const skip = (parseInt(page) - 1) * parseInt(limit);
  
  // Get fee collections with pagination
  const feeCollections = await FeeCollection.find(query)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit))
    .populate({
      path: 'student',
      select: 'name admissionNumber rollNumber classId email phone',
      populate: {
        path: 'classId',
        select: 'name section'
      }
    })
    .populate({
      path: 'feeStructure',
      select: 'name amount category frequency',
      populate: {
        path: 'category',
        select: 'name'
      }
    })
    .populate('createdBy', 'name email')
    .populate('payments.collectedBy', 'name');

  // Get total count for pagination
  const total = await FeeCollection.countDocuments(query);

  res.status(200).json({
    success: true,
    count: feeCollections.length,
    total,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      pages: Math.ceil(total / parseInt(limit))
    },
    data: feeCollections
  });
});

// @desc    Get single fee collection
// @route   GET /api/fee-collections/:id
// @access  Private
exports.getFeeCollection = asyncHandler(async (req, res) => {
  const feeCollection = await FeeCollection.findById(req.params.id)
    .populate({
      path: 'student',
      select: 'name admissionNumber classId email phone parentPhone parentEmail',
      populate: {
        path: 'classId',
        select: 'name section'
      }
    })
    .populate({
      path: 'feeStructure',
      select: 'name amount category frequency lateFee discount',
      populate: {
        path: 'category',
        select: 'name description'
      }
    })
    .populate('createdBy', 'name email')
    .populate('payments.collectedBy', 'name email');

  if (!feeCollection) {
    return res.status(404).json({
      success: false,
      error: 'Fee collection not found'
    });
  }

  // Check if user has access to this fee collection
  if (req.user.role !== 'admin' && feeCollection.school.toString() !== req.user.schoolId.toString()) {
    return res.status(403).json({
      success: false,
      error: 'Not authorized to access this fee collection'
    });
  }

  res.status(200).json({
    success: true,
    data: feeCollection
  });
});

// @desc    Create new fee collection
// @route   POST /api/fee-collections
// @access  Private
exports.createFeeCollection = asyncHandler(async (req, res) => {
  const {
    student: studentId,
    feeStructure: feeStructureId,
    academicYear,
    month,
    dueDate,
    remarks
  } = req.body;

  // Validate required fields
  if (!studentId || !feeStructureId || !academicYear || !dueDate) {
    return res.status(400).json({
      success: false,
      error: 'Please provide student, fee structure, academic year, and due date'
    });
  }

  // Get school from user or request
  const school = req.user.role === 'admin' && req.body.school ? req.body.school : req.user.schoolId;

  console.log('Creating fee collection:', {
    school,
    studentId,
    feeStructureId,
    academicYear,
    dueDate,
    userSchoolId: req.user.schoolId,
    userRole: req.user.role
  });

  // Verify student exists and belongs to school
  const student = await Student.findOne({ _id: studentId, schoolId: school });
  if (!student) {
    return res.status(400).json({
      success: false,
      error: 'Student not found or does not belong to this school'
    });
  }

  // Verify fee structure exists and belongs to school
  const feeStructure = await FeeStructure.findOne({ _id: feeStructureId, school });
  if (!feeStructure) {
    return res.status(400).json({
      success: false,
      error: 'Fee structure not found or does not belong to this school'
    });
  }

  // Check if fee structure applies to student's class
  if (feeStructure.class && feeStructure.class.toString() !== student.classId.toString()) {
    return res.status(400).json({
      success: false,
      error: 'This fee structure does not apply to the student\'s class'
    });
  }

  // Check for duplicate fee collection
  const existingCollection = await FeeCollection.findOne({
    school,
    student: studentId,
    feeStructure: feeStructureId,
    academicYear,
    month: month || null,
    status: { $nin: ['cancelled'] }
  });

  if (existingCollection) {
    return res.status(400).json({
      success: false,
      error: 'A fee collection already exists for this student, fee structure, and period'
    });
  }

  // Calculate amounts
  const totalAmount = feeStructure.amount;
  const discountAmount = feeStructure.calculateDiscount();

  // Create fee collection
  const feeCollection = await FeeCollection.create({
    school,
    student: studentId,
    feeStructure: feeStructureId,
    academicYear,
    month,
    totalAmount,
    discountAmount,
    lateFeeAmount: 0,
    paidAmount: 0,
    dueAmount: totalAmount - discountAmount,
    dueDate: new Date(dueDate),
    status: 'pending',
    remarks,
    createdBy: req.user._id
  });

  // Populate related data
  await feeCollection.populate({
    path: 'student',
    select: 'name admissionNumber classId email phone',
    populate: {
      path: 'classId',
      select: 'name section'
    }
  });
  await feeCollection.populate({
    path: 'feeStructure',
    select: 'name amount category frequency',
    populate: {
      path: 'category',
      select: 'name'
    }
  });
  await feeCollection.populate('createdBy', 'name email');

  res.status(201).json({
    success: true,
    message: 'Fee collection created successfully',
    data: feeCollection
  });
});

// @desc    Update fee collection
// @route   PUT /api/fee-collections/:id
// @access  Private
exports.updateFeeCollection = asyncHandler(async (req, res) => {
  const feeCollection = await FeeCollection.findById(req.params.id);
  
  if (!feeCollection) {
    return res.status(404).json({
      success: false,
      error: 'Fee collection not found'
    });
  }

  // Check if user has access to this fee collection
  if (req.user.role !== 'admin' && feeCollection.school.toString() !== req.user.schoolId.toString()) {
    return res.status(403).json({
      success: false,
      error: 'Not authorized to update this fee collection'
    });
  }

  const {
    totalAmount,
    discountAmount,
    lateFeeAmount,
    dueDate,
    status,
    remarks
  } = req.body;

  // Update fields
  if (totalAmount !== undefined) feeCollection.totalAmount = totalAmount;
  if (discountAmount !== undefined) feeCollection.discountAmount = discountAmount;
  if (lateFeeAmount !== undefined) feeCollection.lateFeeAmount = lateFeeAmount;
  if (dueDate) feeCollection.dueDate = new Date(dueDate);
  if (status) feeCollection.status = status;
  if (remarks !== undefined) feeCollection.remarks = remarks;

  await feeCollection.save();

  // Populate related data
  await feeCollection.populate({
    path: 'student',
    select: 'name admissionNumber classId email phone',
    populate: {
      path: 'classId',
      select: 'name section'
    }
  });
  await feeCollection.populate({
    path: 'feeStructure',
    select: 'name amount category frequency',
    populate: {
      path: 'category',
      select: 'name'
    }
  });
  await feeCollection.populate('createdBy', 'name email');

  res.status(200).json({
    success: true,
    message: 'Fee collection updated successfully',
    data: feeCollection
  });
});

// @desc    Add payment to fee collection
// @route   POST /api/fee-collections/:id/payment
// @access  Private
exports.addPayment = asyncHandler(async (req, res) => {
  const feeCollection = await FeeCollection.findById(req.params.id);
  
  if (!feeCollection) {
    return res.status(404).json({
      success: false,
      error: 'Fee collection not found'
    });
  }

  // Check if user has access to this fee collection
  if (req.user.role !== 'admin' && feeCollection.school.toString() !== req.user.schoolId.toString()) {
    return res.status(403).json({
      success: false,
      error: 'Not authorized to add payment to this fee collection'
    });
  }

  const {
    amount,
    paymentDate,
    paymentMethod,
    transactionId,
    remarks
  } = req.body;

  // Validate required fields
  if (!amount || !paymentDate || !paymentMethod) {
    return res.status(400).json({
      success: false,
      error: 'Please provide amount, payment date, and payment method'
    });
  }

  // Validate amount
  if (amount <= 0) {
    return res.status(400).json({
      success: false,
      error: 'Payment amount must be greater than 0'
    });
  }

  if (amount > feeCollection.dueAmount) {
    return res.status(400).json({
      success: false,
      error: `Payment amount cannot exceed due amount of ${feeCollection.dueAmount}`
    });
  }

  // Add payment
  const paymentData = {
    amount,
    paymentDate: new Date(paymentDate),
    paymentMethod,
    transactionId,
    remarks,
    collectedBy: req.user._id
  };

  await feeCollection.addPayment(paymentData);

  // Populate related data
  await feeCollection.populate({
    path: 'student',
    select: 'name admissionNumber classId email phone',
    populate: {
      path: 'classId',
      select: 'name section'
    }
  });
  await feeCollection.populate({
    path: 'feeStructure',
    select: 'name amount category frequency',
    populate: {
      path: 'category',
      select: 'name'
    }
  });
  await feeCollection.populate('payments.collectedBy', 'name email');

  res.status(200).json({
    success: true,
    message: 'Payment added successfully',
    data: feeCollection
  });
});

// @desc    Delete fee collection
// @route   DELETE /api/fee-collections/:id
// @access  Private
exports.deleteFeeCollection = asyncHandler(async (req, res) => {
  const feeCollection = await FeeCollection.findById(req.params.id);
  
  if (!feeCollection) {
    return res.status(404).json({
      success: false,
      error: 'Fee collection not found'
    });
  }

  // Check if user has access to this fee collection
  if (req.user.role !== 'admin' && feeCollection.school.toString() !== req.user.schoolId.toString()) {
    return res.status(403).json({
      success: false,
      error: 'Not authorized to delete this fee collection'
    });
  }

  // Check if any payments have been made
  if (feeCollection.paidAmount > 0) {
    return res.status(400).json({
      success: false,
      error: 'Cannot delete fee collection with payments. Cancel it instead.'
    });
  }

  await feeCollection.deleteOne();

  res.status(200).json({
    success: true,
    message: 'Fee collection deleted successfully',
    data: {}
  });
});

// @desc    Cancel fee collection
// @route   PUT /api/fee-collections/:id/cancel
// @access  Private
exports.cancelFeeCollection = asyncHandler(async (req, res) => {
  const { reason } = req.body;
  const feeCollection = await FeeCollection.findById(req.params.id);
  
  if (!feeCollection) {
    return res.status(404).json({
      success: false,
      error: 'Fee collection not found'
    });
  }

  // Check if user has access to this fee collection
  if (req.user.role !== 'admin' && feeCollection.school.toString() !== req.user.schoolId.toString()) {
    return res.status(403).json({
      success: false,
      error: 'Not authorized to cancel this fee collection'
    });
  }

  if (feeCollection.status === 'cancelled') {
    return res.status(400).json({
      success: false,
      error: 'Fee collection is already cancelled'
    });
  }

  await feeCollection.cancelCollection(reason || 'Cancelled by user');

  res.status(200).json({
    success: true,
    message: 'Fee collection cancelled successfully',
    data: feeCollection
  });
});

// @desc    Get due fee collections
// @route   GET /api/fee-collections/due/list
// @access  Private
exports.getDueCollections = asyncHandler(async (req, res) => {
  const { academicYear, search, classId } = req.query;
  const school = req.user.role === 'admin' && req.query.schoolId ? req.query.schoolId : req.user.schoolId;

  if (!academicYear) {
    return res.status(400).json({
      success: false,
      error: 'Academic year is required'
    });
  }

  // Build query for due collections
  let query = {
    school: school,
    academicYear,
    status: { $in: ['pending', 'partial', 'overdue'] },
    dueAmount: { $gt: 0 }
  };

  // If search is provided, find matching students first
  let studentIds = null;
  if (search) {
    const studentQuery = {
      schoolId: school,
      $or: [
        { name: { $regex: search, $options: 'i' } },
        { admissionNumber: { $regex: search, $options: 'i' } },
        { rollNumber: { $regex: search, $options: 'i' } }
      ]
    };
    
    // If classId is also provided, add it to student query
    if (classId) {
      studentQuery.classId = classId;
    }
    
    const matchingStudents = await Student.find(studentQuery).select('_id');
    studentIds = matchingStudents.map(s => s._id);
    
    if (studentIds.length === 0) {
      // No matching students, return empty result
      return res.status(200).json({
        success: true,
        count: 0,
        data: []
      });
    }
    
    query.student = { $in: studentIds };
  } else if (classId) {
    // If only classId is provided (no search), find students in that class
    const studentsInClass = await Student.find({ 
      schoolId: school,
      classId: classId 
    }).select('_id');
    const studentIdsInClass = studentsInClass.map(s => s._id);
    
    if (studentIdsInClass.length === 0) {
      return res.status(200).json({
        success: true,
        count: 0,
        data: []
      });
    }
    
    query.student = { $in: studentIdsInClass };
  }

  const dueCollections = await FeeCollection.find(query)
    .populate({
      path: 'student',
      select: 'name admissionNumber rollNumber classId email phone parentPhone parentEmail',
      populate: {
        path: 'classId',
        select: 'name section'
      }
    })
    .populate('feeStructure', 'name amount category frequency type')
    .sort({ dueDate: 1 });

  // Group dues by student and calculate month periods
  const now = new Date();
  const studentDuesMap = new Map();

  dueCollections.forEach(collection => {
    const studentId = collection.student._id.toString();
    const dueDate = new Date(collection.dueDate);
    const monthsOverdue = Math.floor((now - dueDate) / (1000 * 60 * 60 * 24 * 30));
    
    if (!studentDuesMap.has(studentId)) {
      studentDuesMap.set(studentId, {
        studentId: studentId,
        studentName: collection.student.name,
        admissionNumber: collection.student.admissionNumber || collection.student.rollNumber || 'N/A',
        className: collection.student.classId ? `${collection.student.classId.name}${collection.student.classId.section ? ' - ' + collection.student.classId.section : ''}` : 'N/A',
        email: collection.student.email,
        phone: collection.student.phone || collection.student.parentPhone,
        oneMonthDue: 0,
        twoMonthDue: 0,
        threeMonthDue: 0,
        otherChargesDue: 0,
        totalDue: 0,
        lastPaymentDate: collection.payments && collection.payments.length > 0 
          ? collection.payments[collection.payments.length - 1].paymentDate 
          : null,
        paymentHistory: collection.payments ? collection.payments.map(p => ({
          month: collection.month || 'N/A',
          amount: p.amount,
          date: p.paymentDate
        })) : [],
        collections: []
      });
    }

    const studentDue = studentDuesMap.get(studentId);
    const dueAmount = collection.dueAmount || 0;
    
    // Check if this is an "other charge" (not monthly fee structure)
    const isOtherCharge = collection.feeStructure && 
      (collection.feeStructure.type === 'custom' || 
       collection.feeStructure.frequency === 'one-time' ||
       !collection.month);

    if (isOtherCharge) {
      studentDue.otherChargesDue += dueAmount;
    } else {
      // Categorize by months overdue
      if (monthsOverdue >= 3) {
        studentDue.threeMonthDue += dueAmount;
      } else if (monthsOverdue === 2) {
        studentDue.twoMonthDue += dueAmount;
      } else if (monthsOverdue === 1) {
        studentDue.oneMonthDue += dueAmount;
      } else {
        // Less than 1 month, add to oneMonthDue for visibility
        studentDue.oneMonthDue += dueAmount;
      }
    }

    studentDue.totalDue += dueAmount;
    studentDue.collections.push({
      _id: collection._id,
      month: collection.month,
      dueAmount: dueAmount,
      dueDate: collection.dueDate,
      feeStructure: collection.feeStructure?.name
    });
  });

  // Convert map to array
  const studentDuesList = Array.from(studentDuesMap.values());

  res.status(200).json({
    success: true,
    count: studentDuesList.length,
    data: studentDuesList
  });
});

// @desc    Get overdue fee collections
// @route   GET /api/fee-collections/overdue/list
// @access  Private
exports.getOverdueCollections = asyncHandler(async (req, res) => {
  const { academicYear } = req.query;
  const school = req.user.role === 'admin' && req.query.schoolId ? req.query.schoolId : req.user.schoolId;

  if (!academicYear) {
    return res.status(400).json({
      success: false,
      error: 'Academic year is required'
    });
  }

  const overdueCollections = await FeeCollection.getOverdueCollections(school, academicYear);

  res.status(200).json({
    success: true,
    count: overdueCollections.length,
    data: overdueCollections
  });
});

// @desc    Get fee collection statistics
// @route   GET /api/fee-collections/stats
// @access  Private
exports.getCollectionStats = asyncHandler(async (req, res) => {
  const { academicYear, startDate, endDate } = req.query;
  const school = req.user.role === 'admin' && req.query.schoolId ? req.query.schoolId : req.user.schoolId;

  const stats = await FeeCollection.getCollectionStats(school, academicYear, startDate, endDate);

  // Get counts by status
  const statusCounts = await FeeCollection.aggregate([
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
        totalCollections: 0,
        totalAmount: 0,
        totalPaid: 0,
        totalDue: 0,
        averageCollection: 0
      },
      statusCounts
    }
  });
});

// @desc    Send reminder for due fees
// @route   POST /api/fee-collections/:id/reminder
// @access  Private
exports.sendReminder = asyncHandler(async (req, res) => {
  const { type } = req.body;
  const feeCollection = await FeeCollection.findById(req.params.id)
    .populate('student', 'name admissionNumber email phone parentPhone parentEmail');
  
  if (!feeCollection) {
    return res.status(404).json({
      success: false,
      error: 'Fee collection not found'
    });
  }

  // Check if user has access to this fee collection
  if (req.user.role !== 'admin' && feeCollection.school.toString() !== req.user.schoolId.toString()) {
    return res.status(403).json({
      success: false,
      error: 'Not authorized to send reminder for this fee collection'
    });
  }

  if (feeCollection.status === 'paid' || feeCollection.status === 'cancelled') {
    return res.status(400).json({
      success: false,
      error: 'Cannot send reminder for paid or cancelled fee collection'
    });
  }

  // Send reminder (actual implementation would involve email/SMS service)
  await feeCollection.sendReminder(type || 'notification');

  res.status(200).json({
    success: true,
    message: 'Reminder sent successfully',
    data: feeCollection
  });
});


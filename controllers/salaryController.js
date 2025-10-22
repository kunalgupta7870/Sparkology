const Salary = require('../models/Salary');
const User = require('../models/User');
const asyncHandler = require('../middleware/asyncHandler');

// @desc    Get all salaries
// @route   GET /api/salaries
// @access  Private
exports.getSalaries = asyncHandler(async (req, res) => {
  const { 
    schoolId, 
    employeeId, 
    designation, 
    status, 
    month, 
    year, 
    search, 
    page = 1, 
    limit = 50 
  } = req.query;
  
  // Build query
  let query = { isActive: true };
  
  // If user is not admin, filter by their school
  if (req.user.role !== 'admin') {
    query.schoolId = req.user.schoolId;
  } else if (schoolId) {
    query.schoolId = schoolId;
  }
  
  if (employeeId) {
    query.employee = employeeId;
  }
  
  if (designation) {
    query.designation = { $regex: designation, $options: 'i' };
  }
  
  if (status) {
    query.status = status;
  }
  
  if (month) {
    query.month = parseInt(month);
  }
  
  if (year) {
    query.year = parseInt(year);
  }
  
  if (search) {
    query.$or = [
      { designation: { $regex: search, $options: 'i' } },
      { notes: { $regex: search, $options: 'i' } }
    ];
  }

  // Calculate pagination
  const skip = (parseInt(page) - 1) * parseInt(limit);
  
  // Get salaries with pagination
  const salaries = await Salary.find(query)
    .sort({ year: -1, month: -1, createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit))
    .populate('employee', 'name email phone role')
    .populate('schoolId', 'name');

  // Get total count for pagination
  const total = await Salary.countDocuments(query);

  res.status(200).json({
    success: true,
    count: salaries.length,
    total,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      pages: Math.ceil(total / parseInt(limit))
    },
    data: salaries
  });
});

// @desc    Get single salary
// @route   GET /api/salaries/:id
// @access  Private
exports.getSalary = asyncHandler(async (req, res) => {
  const salary = await Salary.findById(req.params.id)
    .populate('employee', 'name email phone role')
    .populate('schoolId', 'name');

  if (!salary) {
    return res.status(404).json({
      success: false,
      error: 'Salary record not found'
    });
  }

  // Check if user has access to this salary record
  if (req.user.role !== 'admin' && salary.schoolId.toString() !== req.user.schoolId.toString()) {
    return res.status(403).json({
      success: false,
      error: 'Not authorized to access this salary record'
    });
  }

  res.status(200).json({
    success: true,
    data: salary
  });
});

// @desc    Create new salary
// @route   POST /api/salaries
// @access  Private
exports.createSalary = asyncHandler(async (req, res) => {
  const {
    employee,
    designation,
    basicSalary,
    allowances,
    deductions,
    month,
    year,
    status,
    paymentMethod,
    notes
  } = req.body;

  // Get schoolId from user if not admin
  const schoolId = req.user.role === 'admin' && req.body.schoolId 
    ? req.body.schoolId 
    : req.user.schoolId;

  if (!schoolId) {
    return res.status(400).json({
      success: false,
      error: 'School ID is required'
    });
  }

  // Check if employee exists
  const employeeUser = await User.findById(employee);
  if (!employeeUser) {
    return res.status(404).json({
      success: false,
      error: 'Employee not found'
    });
  }

  // Check if salary already exists for this employee, month, and year
  const existingSalary = await Salary.findOne({
    employee,
    month,
    year,
    schoolId,
    isActive: true
  });

  if (existingSalary) {
    return res.status(400).json({
      success: false,
      error: `Salary record already exists for this employee for ${month}/${year}`
    });
  }

  // Create salary
  const salary = await Salary.create({
    employee,
    schoolId,
    designation,
    basicSalary,
    allowances: allowances || {},
    deductions: deductions || {},
    month,
    year,
    status: status || 'pending',
    paymentMethod: status === 'paid' ? paymentMethod : null,
    notes
  });

  // Populate employee and school details
  await salary.populate('employee', 'name email phone role');
  await salary.populate('schoolId', 'name');

  res.status(201).json({
    success: true,
    data: salary
  });
});

// @desc    Update salary
// @route   PUT /api/salaries/:id
// @access  Private
exports.updateSalary = asyncHandler(async (req, res) => {
  let salary = await Salary.findById(req.params.id);

  if (!salary) {
    return res.status(404).json({
      success: false,
      error: 'Salary record not found'
    });
  }

  // Check if user has access to this salary record
  if (req.user.role !== 'admin' && salary.schoolId.toString() !== req.user.schoolId.toString()) {
    return res.status(403).json({
      success: false,
      error: 'Not authorized to update this salary record'
    });
  }

  // If changing employee, month, or year, check for duplicates
  if (req.body.employee || req.body.month || req.body.year) {
    const employee = req.body.employee || salary.employee;
    const month = req.body.month || salary.month;
    const year = req.body.year || salary.year;

    const existingSalary = await Salary.findOne({
      _id: { $ne: req.params.id },
      employee,
      month,
      year,
      schoolId: salary.schoolId,
      isActive: true
    });

    if (existingSalary) {
      return res.status(400).json({
        success: false,
        error: `Salary record already exists for this employee for ${month}/${year}`
      });
    }
  }

  // Update salary
  salary = await Salary.findByIdAndUpdate(
    req.params.id,
    req.body,
    {
      new: true,
      runValidators: true
    }
  )
    .populate('employee', 'name email phone role')
    .populate('schoolId', 'name');

  res.status(200).json({
    success: true,
    data: salary
  });
});

// @desc    Delete salary
// @route   DELETE /api/salaries/:id
// @access  Private
exports.deleteSalary = asyncHandler(async (req, res) => {
  const salary = await Salary.findById(req.params.id);

  if (!salary) {
    return res.status(404).json({
      success: false,
      error: 'Salary record not found'
    });
  }

  // Check if user has access to this salary record
  if (req.user.role !== 'admin' && salary.schoolId.toString() !== req.user.schoolId.toString()) {
    return res.status(403).json({
      success: false,
      error: 'Not authorized to delete this salary record'
    });
  }

  // Soft delete - mark as inactive
  salary.isActive = false;
  await salary.save();

  res.status(200).json({
    success: true,
    data: {},
    message: 'Salary record deleted successfully'
  });
});

// @desc    Mark salary as paid
// @route   PUT /api/salaries/:id/pay
// @access  Private
exports.markSalaryAsPaid = asyncHandler(async (req, res) => {
  const { paymentMethod = 'bank_transfer' } = req.body;
  
  const salary = await Salary.findById(req.params.id);

  if (!salary) {
    return res.status(404).json({
      success: false,
      error: 'Salary record not found'
    });
  }

  // Check if user has access to this salary record
  if (req.user.role !== 'admin' && salary.schoolId.toString() !== req.user.schoolId.toString()) {
    return res.status(403).json({
      success: false,
      error: 'Not authorized to update this salary record'
    });
  }

  if (salary.status === 'paid') {
    return res.status(400).json({
      success: false,
      error: 'Salary is already marked as paid'
    });
  }

  // Mark as paid
  await salary.markAsPaid(paymentMethod);
  await salary.populate('employee', 'name email phone role');
  await salary.populate('schoolId', 'name');

  res.status(200).json({
    success: true,
    data: salary,
    message: 'Salary marked as paid successfully'
  });
});

// @desc    Get salary statistics
// @route   GET /api/salaries/stats/overview
// @access  Private
exports.getSalaryStats = asyncHandler(async (req, res) => {
  const { schoolId, month, year } = req.query;
  
  // Determine which school to get stats for
  const targetSchoolId = req.user.role === 'admin' && schoolId 
    ? schoolId 
    : req.user.schoolId;

  if (!targetSchoolId) {
    return res.status(400).json({
      success: false,
      error: 'School ID is required'
    });
  }

  // Get current month and year if not provided
  const currentDate = new Date();
  const targetMonth = month ? parseInt(month) : currentDate.getMonth() + 1;
  const targetYear = year ? parseInt(year) : currentDate.getFullYear();

  // Get statistics
  const stats = await Salary.getSchoolStats(targetSchoolId, targetMonth, targetYear);

  // Get monthly trend (last 6 months)
  const monthlyTrend = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(targetYear, targetMonth - 1 - i, 1);
    const m = d.getMonth() + 1;
    const y = d.getFullYear();
    
    const monthStats = await Salary.getSchoolStats(targetSchoolId, m, y);
    monthlyTrend.push({
      month: m,
      year: y,
      totalNetSalary: monthStats.totalNetSalary,
      totalEmployees: monthStats.totalEmployees
    });
  }

  // Get department-wise salary distribution
  const departmentStats = await Salary.aggregate([
    {
      $match: {
        schoolId: targetSchoolId,
        month: targetMonth,
        year: targetYear,
        isActive: true
      }
    },
    {
      $group: {
        _id: '$designation',
        count: { $sum: 1 },
        totalSalary: { $sum: '$basicSalary' },
        totalAllowances: {
          $sum: {
            $add: [
              { $ifNull: ['$allowances.houseRent', 0] },
              { $ifNull: ['$allowances.medical', 0] },
              { $ifNull: ['$allowances.transport', 0] },
              { $ifNull: ['$allowances.other', 0] }
            ]
          }
        }
      }
    },
    {
      $project: {
        designation: '$_id',
        count: 1,
        totalGrossSalary: { $add: ['$totalSalary', '$totalAllowances'] }
      }
    },
    { $sort: { totalGrossSalary: -1 } }
  ]);

  res.status(200).json({
    success: true,
    data: {
      current: {
        month: targetMonth,
        year: targetYear,
        ...stats
      },
      monthlyTrend,
      departmentStats
    }
  });
});

// @desc    Get salary structures (unique designations with their salary info)
// @route   GET /api/salaries/structures
// @access  Private
exports.getSalaryStructures = asyncHandler(async (req, res) => {
  const { schoolId } = req.query;
  
  // Determine which school to get structures for
  const targetSchoolId = req.user.role === 'admin' && schoolId 
    ? schoolId 
    : req.user.schoolId;

  if (!targetSchoolId) {
    return res.status(400).json({
      success: false,
      error: 'School ID is required'
    });
  }

  // Get the latest salary record for each designation
  const structures = await Salary.aggregate([
    {
      $match: {
        schoolId: targetSchoolId,
        isActive: true
      }
    },
    { $sort: { year: -1, month: -1 } },
    {
      $group: {
        _id: '$designation',
        basicSalary: { $first: '$basicSalary' },
        allowances: { $first: '$allowances' },
        deductions: { $first: '$deductions' },
        count: { $sum: 1 }
      }
    },
    {
      $project: {
        _id: 0,
        designation: '$_id',
        basicSalary: 1,
        allowances: 1,
        deductions: 1,
        totalAllowances: {
          $add: [
            { $ifNull: ['$allowances.houseRent', 0] },
            { $ifNull: ['$allowances.medical', 0] },
            { $ifNull: ['$allowances.transport', 0] },
            { $ifNull: ['$allowances.other', 0] }
          ]
        },
        totalDeductions: {
          $add: [
            { $ifNull: ['$deductions.tax', 0] },
            { $ifNull: ['$deductions.insurance', 0] },
            { $ifNull: ['$deductions.loan', 0] },
            { $ifNull: ['$deductions.other', 0] }
          ]
        },
        employeeCount: '$count'
      }
    },
    {
      $addFields: {
        grossSalary: { $add: ['$basicSalary', '$totalAllowances'] },
        netSalary: {
          $subtract: [
            { $add: ['$basicSalary', '$totalAllowances'] },
            '$totalDeductions'
          ]
        }
      }
    },
    { $sort: { designation: 1 } }
  ]);

  res.status(200).json({
    success: true,
    count: structures.length,
    data: structures
  });
});

// @desc    Generate payroll for a month
// @route   POST /api/salaries/generate-payroll
// @access  Private
exports.generatePayroll = asyncHandler(async (req, res) => {
  const { month, year, employees } = req.body;

  const schoolId = req.user.role === 'admin' && req.body.schoolId 
    ? req.body.schoolId 
    : req.user.schoolId;

  if (!schoolId) {
    return res.status(400).json({
      success: false,
      error: 'School ID is required'
    });
  }

  if (!month || !year || !employees || !Array.isArray(employees) || employees.length === 0) {
    return res.status(400).json({
      success: false,
      error: 'Month, year, and employees array are required'
    });
  }

  const created = [];
  const errors = [];

  for (const empData of employees) {
    try {
      // Check if salary already exists
      const existing = await Salary.findOne({
        employee: empData.employee,
        month,
        year,
        schoolId,
        isActive: true
      });

      if (existing) {
        errors.push({
          employee: empData.employee,
          error: 'Salary already exists for this month'
        });
        continue;
      }

      // Create salary
      const salary = await Salary.create({
        employee: empData.employee,
        schoolId,
        designation: empData.designation,
        basicSalary: empData.basicSalary,
        allowances: empData.allowances || {},
        deductions: empData.deductions || {},
        month,
        year,
        status: 'pending'
      });

      await salary.populate('employee', 'name email phone role');
      created.push(salary);
    } catch (error) {
      errors.push({
        employee: empData.employee,
        error: error.message
      });
    }
  }

  res.status(201).json({
    success: true,
    data: {
      created: created.length,
      errors: errors.length,
      salaries: created,
      errorDetails: errors
    },
    message: `Payroll generated successfully. Created: ${created.length}, Errors: ${errors.length}`
  });
});

module.exports = exports;


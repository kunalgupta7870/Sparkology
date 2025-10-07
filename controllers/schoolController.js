const School = require('../models/School');
const User = require('../models/User');
const { validationResult } = require('express-validator');

// @desc    Get all schools
// @route   GET /api/schools
// @access  Private (Admin only)
const getSchools = async (req, res) => {
  try {
    const { status, search, page = 1, limit = 10 } = req.query;
    
    // Build query
    let query = {};
    
    if (status) {
      query.status = status;
    }
    
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { code: { $regex: search, $options: 'i' } },
        { address: { $regex: search, $options: 'i' } }
      ];
    }

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Get schools with pagination
    const schools = await School.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('createdBy', 'name email')
      .populate('approvedBy', 'name email');

    // Get total count for pagination
    const total = await School.countDocuments(query);

    res.status(200).json({
      success: true,
      count: schools.length,
      total,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit))
      },
      data: schools
    });
  } catch (error) {
    console.error('Get schools error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
};

// @desc    Get single school
// @route   GET /api/schools/:id
// @access  Private (Admin only)
const getSchool = async (req, res) => {
  try {
    const school = await School.findById(req.params.id)
      .populate('createdBy', 'name email')
      .populate('approvedBy', 'name email');

    if (!school) {
      return res.status(404).json({
        success: false,
        error: 'School not found'
      });
    }

    res.status(200).json({
      success: true,
      data: school
    });
  } catch (error) {
    console.error('Get school error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
};

// @desc    Create new school
// @route   POST /api/schools
// @access  Private (Admin only)
const createSchool = async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const {
      name,
      code,
      address,
      contact,
      logo,
      status = 'active',
      plan = 'basic',
      website,
      email,
      phone,
      principal
    } = req.body;

    // Check if school code already exists
    const existingSchool = await School.findOne({ code: code.toUpperCase() });
    if (existingSchool) {
      return res.status(400).json({
        success: false,
        error: 'School code already exists'
      });
    }

    // Create school
    const school = await School.create({
      name,
      code: code.toUpperCase(),
      address,
      contact,
      logo,
      status,
      plan,
      website,
      email,
      phone,
      principal,
      createdBy: req.user._id
    });

    res.status(201).json({
      success: true,
      message: 'School created successfully',
      data: school
    });
  } catch (error) {
    console.error('Create school error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
};

// @desc    Update school
// @route   PUT /api/schools/:id
// @access  Private (Admin only)
const updateSchool = async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const school = await School.findById(req.params.id);
    if (!school) {
      return res.status(404).json({
        success: false,
        error: 'School not found'
      });
    }

    const {
      name,
      code,
      address,
      contact,
      logo,
      status,
      plan,
      website,
      email,
      phone,
      principal
    } = req.body;

    // Check if school code already exists (excluding current school)
    if (code && code.toUpperCase() !== school.code) {
      const existingSchool = await School.findOne({ 
        code: code.toUpperCase(),
        _id: { $ne: req.params.id }
      });
      if (existingSchool) {
        return res.status(400).json({
          success: false,
          error: 'School code already exists'
        });
      }
    }

    // Update fields
    if (name) school.name = name;
    if (code) school.code = code.toUpperCase();
    if (address) school.address = address;
    if (contact) school.contact = contact;
    if (logo !== undefined) school.logo = logo;
    if (status) school.status = status;
    if (plan) school.plan = plan;
    if (website !== undefined) school.website = website;
    if (email !== undefined) school.email = email;
    if (phone !== undefined) school.phone = phone;
    if (principal) school.principal = principal;

    await school.save();

    res.status(200).json({
      success: true,
      message: 'School updated successfully',
      data: school
    });
  } catch (error) {
    console.error('Update school error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
};

// @desc    Delete school
// @route   DELETE /api/schools/:id
// @access  Private (Admin only)
const deleteSchool = async (req, res) => {
  try {
    const school = await School.findById(req.params.id);
    if (!school) {
      return res.status(404).json({
        success: false,
        error: 'School not found'
      });
    }

    // Check if school has users
    const schoolUsers = await User.find({ schoolId: req.params.id });
    if (schoolUsers.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Cannot delete school with existing users. Please remove all users first.'
      });
    }

    await School.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: 'School deleted successfully'
    });
  } catch (error) {
    console.error('Delete school error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
};

// @desc    Create school admin credentials
// @route   POST /api/schools/:id/admin
// @access  Private (Admin only)
const createSchoolAdmin = async (req, res) => {
  try {
    const { name, email, password } = req.body;
    const schoolId = req.params.id;

    // Check if school exists
    const school = await School.findById(schoolId);
    if (!school) {
      return res.status(404).json({
        success: false,
        error: 'School not found'
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        error: 'User already exists with this email'
      });
    }

    // Create school admin user
    const schoolAdmin = await User.create({
      name,
      email: email.toLowerCase(),
      password,
      role: 'school_admin',
      schoolId: schoolId
    });

    res.status(201).json({
      success: true,
      message: 'School admin created successfully',
      data: {
        user: {
          id: schoolAdmin._id,
          name: schoolAdmin.name,
          email: schoolAdmin.email,
          role: schoolAdmin.role,
          schoolId: schoolAdmin.schoolId,
          school: {
            id: school._id,
            name: school.name,
            code: school.code
          }
        }
      }
    });
  } catch (error) {
    console.error('Create school admin error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
};

// @desc    Get school statistics
// @route   GET /api/schools/stats
// @access  Private (Admin only)
const getSchoolStats = async (req, res) => {
  try {
    const totalSchools = await School.countDocuments();
    const activeSchools = await School.countDocuments({ status: 'active' });
    const inactiveSchools = await School.countDocuments({ status: 'inactive' });
    const suspendedSchools = await School.countDocuments({ status: 'suspended' });

    const totalStudents = await School.aggregate([
      { $group: { _id: null, total: { $sum: '$students' } } }
    ]);

    const totalTeachers = await School.aggregate([
      { $group: { _id: null, total: { $sum: '$teachers' } } }
    ]);

    const schoolsByPlan = await School.aggregate([
      { $group: { _id: '$plan', count: { $sum: 1 } } }
    ]);

    const recentSchools = await School.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .select('name code status createdAt');

    res.status(200).json({
      success: true,
      data: {
        totalSchools,
        activeSchools,
        inactiveSchools,
        suspendedSchools,
        totalStudents: totalStudents[0]?.total || 0,
        totalTeachers: totalTeachers[0]?.total || 0,
        schoolsByPlan,
        recentSchools
      }
    });
  } catch (error) {
    console.error('Get school stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
};

// @desc    Get teachers for a school
// @route   GET /api/schools/:id/teachers
// @access  Private (School Admin only)
const getSchoolTeachers = async (req, res) => {
  try {
    const schoolId = req.params.id;
    
    // Check if the requesting user is a school admin for this school
    if (req.user.role !== 'school_admin' || req.user.schoolId.toString() !== schoolId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied. You can only view teachers from your own school.'
      });
    }

    const teachers = await User.find({ 
      schoolId: schoolId, 
      role: 'teacher',
      isActive: true 
    }).select('-password -loginAttempts -lockUntil');

    res.status(200).json({
      success: true,
      count: teachers.length,
      data: teachers
    });
  } catch (error) {
    console.error('Get school teachers error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
};

module.exports = {
  getSchools,
  getSchool,
  createSchool,
  updateSchool,
  deleteSchool,
  createSchoolAdmin,
  getSchoolStats,
  getSchoolTeachers
};

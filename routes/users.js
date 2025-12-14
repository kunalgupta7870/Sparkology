const express = require('express');
const { body } = require('express-validator');
const User = require('../models/User');
const School = require('../models/School');
const { protect, isAdmin, isOwnerOrAdmin, authorize } = require('../middleware/auth');
const { validationResult } = require('express-validator');

const router = express.Router();

// Validation rules
const userValidation = [
  body('name')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be between 2 and 100 characters'),
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email'),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long'),
  body('role')
    .isIn(['admin', 'school_admin', 'teacher', 'student'])
    .withMessage('Role must be admin, school_admin, teacher, or student')
];

const loginValidation = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email'),
  body('password')
    .notEmpty()
    .withMessage('Password is required')
];

// @desc    Get all school admins
// @route   GET /api/users/school-admins
// @access  Private (Admin only)
const getSchoolAdmins = async (req, res) => {
  try {
    const { schoolId, search, page = 1, limit = 10 } = req.query;
    
    // Build query - only school admins
    let query = { role: 'school_admin' };
    
    if (schoolId) {
      query.schoolId = schoolId;
    }
    
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Get school admins with pagination
    const users = await User.find(query)
      .select('-password')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('schoolId', 'name code');

    // Get total count for pagination
    const total = await User.countDocuments(query);

    res.status(200).json({
      success: true,
      count: users.length,
      total,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit))
      },
      data: users
    });
  } catch (error) {
    console.error('Get school admins error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
};

// @desc    Get all users
// @route   GET /api/users
// @access  Private (Admin or School Admin)
const getUsers = async (req, res) => {
  try {
    const { role, schoolId, search, page = 1, limit = 10 } = req.query;
    
    // Build query
    let query = {};
    
    // If user is school_admin, restrict to their school only
    if (req.user.role === 'school_admin') {
      if (!req.user.schoolId) {
        return res.status(400).json({
          success: false,
          error: 'School admin has no school assigned'
        });
      }
      // Always restrict school_admin to their own school
      query.schoolId = req.user.schoolId;
      
      // If schoolId is provided in query, verify it matches their school
      if (schoolId && schoolId !== req.user.schoolId.toString() && schoolId !== req.user.schoolId._id?.toString()) {
        return res.status(403).json({
          success: false,
          error: 'Access denied. You can only view users from your school.'
        });
      }
    } else if (req.user.role === 'admin' && schoolId) {
      // Admin can query any school
      query.schoolId = schoolId;
    }
    
    if (role) {
      query.role = role;
    }
    
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Get users with pagination
    const users = await User.find(query)
      .select('-password')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('schoolId', 'name code');

    // Get total count for pagination
    const total = await User.countDocuments(query);

    res.status(200).json({
      success: true,
      count: users.length,
      total,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit))
      },
      data: users
    });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
};

// @desc    Get single user
// @route   GET /api/users/:id
// @access  Private (Admin or Owner)
const getUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .select('-password')
      .populate('schoolId', 'name code address');

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    res.status(200).json({
      success: true,
      data: user
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
};

// @desc    Create new user
// @route   POST /api/users/register
// @access  Private (Admin only)
const createUser = async (req, res) => {
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

    const { name, email, password, role, schoolId } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        error: 'User already exists with this email'
      });
    }

    // If schoolId is provided, verify school exists
    if (schoolId) {
      const school = await School.findById(schoolId);
      if (!school) {
        return res.status(400).json({
          success: false,
          error: 'School not found'
        });
      }
    }

    // Create user
    const user = await User.create({
      name,
      email: email.toLowerCase(),
      password,
      role,
      schoolId: schoolId || null
    });

    // Populate school info
    await user.populate('schoolId', 'name code');

    res.status(201).json({
      success: true,
      message: 'User created successfully',
      data: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        schoolId: user.schoolId,
        school: user.schoolId,
        isActive: user.isActive,
        createdAt: user.createdAt
      }
    });
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
};

// @desc    Update user
// @route   PUT /api/users/:id
// @access  Private (Admin or Owner)
const updateUser = async (req, res) => {
  try {
    // Check for validation errors (excluding password validation for updates)
    const errors = validationResult(req);
    const filteredErrors = errors.array().filter(err => {
      // Skip password validation errors if password is not provided (optional for updates)
      if (err.param === 'password' && !req.body.password) {
        return false;
      }
      return true;
    });
    
    if (filteredErrors.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: filteredErrors
      });
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    const { name, email, role, schoolId, isActive, password } = req.body;

    // Check if email already exists (excluding current user)
    if (email && email.toLowerCase() !== user.email) {
      const existingUser = await User.findOne({ 
        email: email.toLowerCase(),
        _id: { $ne: req.params.id }
      });
      if (existingUser) {
        return res.status(400).json({
          success: false,
          error: 'User already exists with this email'
        });
      }
    }

    // If schoolId is provided, verify school exists
    if (schoolId) {
      const school = await School.findById(schoolId);
      if (!school) {
        return res.status(400).json({
          success: false,
          error: 'School not found'
        });
      }
    }

    // Validate password if provided
    if (password && password.length < 6) {
      return res.status(400).json({
        success: false,
        error: 'Password must be at least 6 characters long'
      });
    }

    // Update fields
    if (name) user.name = name;
    if (email) user.email = email.toLowerCase();
    if (role) user.role = role;
    if (schoolId !== undefined) user.schoolId = schoolId;
    if (isActive !== undefined) user.isActive = isActive;
    
    // Update password if provided (will be hashed by pre-save middleware)
    if (password) {
      user.password = password;
    }

    await user.save();

    // Populate school info
    await user.populate('schoolId', 'name code');

    res.status(200).json({
      success: true,
      message: 'User updated successfully',
      data: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        schoolId: user.schoolId,
        school: user.schoolId,
        isActive: user.isActive,
        updatedAt: user.updatedAt
      }
    });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
};

// @desc    Delete user
// @route   DELETE /api/users/:id
// @access  Private (Admin only)
const deleteUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Prevent deletion of admin users
    if (user.role === 'admin') {
      return res.status(400).json({
        success: false,
        error: 'Cannot delete admin users'
      });
    }

    await User.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: 'User deleted successfully'
    });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
};

// @desc    Get user statistics
// @route   GET /api/users/stats
// @access  Private (Admin only)
const getUserStats = async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const adminUsers = await User.countDocuments({ role: 'admin' });
    const schoolAdminUsers = await User.countDocuments({ role: 'school_admin' });
    const teacherUsers = await User.countDocuments({ role: 'teacher' });
    const studentUsers = await User.countDocuments({ role: 'student' });
    const activeUsers = await User.countDocuments({ isActive: true });
    const inactiveUsers = await User.countDocuments({ isActive: false });

    const usersBySchool = await User.aggregate([
      { $match: { schoolId: { $ne: null } } },
      { $group: { _id: '$schoolId', count: { $sum: 1 } } },
      { $lookup: { from: 'schools', localField: '_id', foreignField: '_id', as: 'school' } },
      { $unwind: '$school' },
      { $project: { schoolName: '$school.name', schoolCode: '$school.code', count: 1 } }
    ]);

    const recentUsers = await User.find()
      .select('name email role createdAt')
      .sort({ createdAt: -1 })
      .limit(5);

    res.status(200).json({
      success: true,
      data: {
        totalUsers,
        adminUsers,
        schoolAdminUsers,
        teacherUsers,
        studentUsers,
        activeUsers,
        inactiveUsers,
        usersBySchool,
        recentUsers
      }
    });
  } catch (error) {
    console.error('Get user stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
};

// @desc    Login user (for school portal)
// @route   POST /api/users/login
// @access  Public
const loginUser = async (req, res) => {
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

    const { email, password } = req.body;

    // Find user and include password
    const user = await User.findByEmail(email);
    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials'
      });
    }

    // Check if user is locked
    if (user.isLocked) {
      return res.status(401).json({
        success: false,
        error: 'Account locked due to multiple failed login attempts. Please try again later.'
      });
    }

    // Check password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      // Increment login attempts
      await user.incLoginAttempts();
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials'
      });
    }

    // Reset login attempts on successful login
    if (user.loginAttempts > 0) {
      await user.resetLoginAttempts();
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    // Generate token
    const { generateToken } = require('../middleware/auth');
    const token = generateToken(user);

    // Get school info if user is school admin
    let schoolInfo = null;
    if (user.role === 'school_admin' && user.schoolId) {
      schoolInfo = await School.findById(user.schoolId).select('name address status');
    }

    res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          schoolId: user.schoolId,
          avatar: user.avatar,
          isActive: user.isActive,
          lastLogin: user.lastLogin,
          school: schoolInfo
        },
        token
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error during login'
    });
  }
};

// @desc    Verify user token (for school portal)
// @route   GET /api/users/verify
// @access  Private
const verifyUser = async (req, res) => {
  try {
    // Get school info if user has schoolId (school_admin, teacher, librarian, accountant)
    let schoolInfo = null;
    if (req.user.schoolId) {
      schoolInfo = await School.findById(req.user.schoolId).select('name address status');
    }

    res.status(200).json({
      success: true,
      data: {
        user: {
          id: req.user._id,
          name: req.user.name,
          email: req.user.email,
          role: req.user.role,
          schoolId: req.user.schoolId,
          avatar: req.user.avatar,
          isActive: req.user.isActive,
          lastLogin: req.user.lastLogin,
          school: schoolInfo
        }
      }
    });

  } catch (error) {
    console.error('Verify user error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error during verification'
    });
  }
};

// Routes
router.get('/', protect, authorize('admin', 'school_admin'), getUsers);
router.get('/school-admins', protect, isAdmin, getSchoolAdmins);
router.get('/stats', protect, isAdmin, getUserStats);
router.get('/verify', protect, verifyUser);
router.get('/:id', protect, isOwnerOrAdmin, getUser);
router.post('/login', loginValidation, loginUser);
router.post('/register', protect, isAdmin, userValidation, createUser);
router.put('/:id', protect, isOwnerOrAdmin, userValidation, updateUser);
router.delete('/:id', protect, isAdmin, deleteUser);

module.exports = router;

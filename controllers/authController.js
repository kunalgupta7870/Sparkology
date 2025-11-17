const User = require('../models/User');
const School = require('../models/School');
const { generateToken } = require('../middleware/auth');
const { validationResult } = require('express-validator');

// Admin Registration Secret Code
const ADMIN_SECRET_CODE = 'SPARK2024_ADMIN_SECRET';

// @desc    Register new admin (Master Portal)
// @route   POST /api/auth/register
// @access  Public (requires secret code)
const register = async (req, res) => {
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

    const { name, email, password, secretCode } = req.body;

    // Verify secret code
    if (!secretCode || secretCode !== ADMIN_SECRET_CODE) {
      return res.status(403).json({
        success: false,
        error: 'Invalid secret code. Only authorized personnel can register as admin.'
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

    // Create admin user (no schoolId, only admin role)
    const user = await User.create({
      name,
      email: email.toLowerCase(),
      password,
      role: 'admin', // Always admin for master portal registration
      schoolId: null // Admin users don't belong to any specific school
    });

    // Generate token
    const token = generateToken(user);

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          isActive: user.isActive,
          createdAt: user.createdAt
        },
        token
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error during registration'
    });
  }
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
const login = async (req, res) => {
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
    const token = generateToken(user);

    // Get school info if user has schoolId (school_admin or teacher)
    let schoolInfo = null;
    if (user.schoolId) {
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

// @desc    Get current user
// @route   GET /api/auth/me
// @access  Private
const getMe = async (req, res) => {
  try {
    // The req.user is already set by the auth middleware
    // and it has the correct user data from either User or Student model
    const user = req.user;
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Get school info if user has schoolId (school_admin or teacher)
    let schoolInfo = null;
    if (user.schoolId) {
      schoolInfo = await School.findById(user.schoolId).select('name address status');
    }

    res.status(200).json({
      success: true,
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
        }
      }
    });
  } catch (error) {
    console.error('Get me error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
};

// @desc    Update user profile
// @route   PUT /api/auth/profile
// @access  Private
const updateProfile = async (req, res) => {
  try {
    const { name, avatar } = req.body;
    const userId = req.user._id;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Update fields
    if (name) user.name = name;
    if (avatar) user.avatar = avatar;

    await user.save();

    // Get school info if user has schoolId
    let schoolInfo = null;
    if (user.schoolId) {
      schoolInfo = await School.findById(user.schoolId).select('name address status');
    }

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          schoolId: user.schoolId,
          avatar: user.avatar,
          isActive: user.isActive,
          school: schoolInfo
        }
      }
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
};

// @desc    Change password
// @route   PUT /api/auth/change-password
// @access  Private
const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user._id;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        error: 'Current password and new password are required'
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        error: 'New password must be at least 6 characters long'
      });
    }

    const user = await User.findById(userId).select('+password');
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Check current password
    const isCurrentPasswordValid = await user.comparePassword(currentPassword);
    if (!isCurrentPasswordValid) {
      return res.status(400).json({
        success: false,
        error: 'Current password is incorrect'
      });
    }

    // Update password
    user.password = newPassword;
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Password changed successfully'
    });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
};

// @desc    Logout user (client-side token removal)
// @route   POST /api/auth/logout
// @access  Private
const logout = async (req, res) => {
  try {
    // Since we're using JWT, logout is handled client-side
    // But we can log the logout event or perform cleanup if needed
    res.status(200).json({
      success: true,
      message: 'Logout successful'
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
};

// @desc    Create teacher
// @route   POST /api/auth/create-teacher
// @access  Private (School Admin only)
const createTeacher = async (req, res) => {
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

    const { name, email, password, phone } = req.body;
    const schoolId = req.user.schoolId; // Get schoolId from authenticated user

    // Check if email already exists globally (across all schools)
    const existingEmail = await User.findOne({ email: email.toLowerCase() });
    if (existingEmail) {
      return res.status(400).json({
        success: false,
        error: 'A user with this email already exists. Please use a different email address.'
      });
    }

    // Check if phone already exists globally (if provided)
    if (phone) {
      const existingPhone = await User.findOne({ phone });
      if (existingPhone) {
        return res.status(400).json({
          success: false,
          error: 'A user with this phone number already exists. Please use a different phone number.'
        });
      }
    }

    // Create teacher
    const teacher = await User.create({
      name,
      email: email.toLowerCase(),
      password,
      phone,
      role: 'teacher',
      schoolId
    });

    res.status(201).json({
      success: true,
      message: 'Teacher created successfully',
      data: {
        teacher: {
          id: teacher._id,
          name: teacher.name,
          email: teacher.email,
          phone: teacher.phone,
          role: teacher.role,
          schoolId: teacher.schoolId,
          isActive: teacher.isActive,
          createdAt: teacher.createdAt
        }
      }
    });
  } catch (error) {
    console.error('Create teacher error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error during teacher creation'
    });
  }
};

// @desc    Create librarian
// @route   POST /api/auth/create-librarian
// @access  Private (School Admin only)
const createLibrarian = async (req, res) => {
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

    const { name, email, password, phone } = req.body;
    const schoolId = req.user.schoolId; // Get schoolId from authenticated user

    // Check if email already exists globally (across all schools)
    const existingEmail = await User.findOne({ email: email.toLowerCase() });
    if (existingEmail) {
      return res.status(400).json({
        success: false,
        error: 'A user with this email already exists. Please use a different email address.'
      });
    }

    // Check if phone already exists globally (if provided)
    if (phone) {
      const existingPhone = await User.findOne({ phone });
      if (existingPhone) {
        return res.status(400).json({
          success: false,
          error: 'A user with this phone number already exists. Please use a different phone number.'
        });
      }
    }

    // Create librarian
    const librarian = await User.create({
      name,
      email: email.toLowerCase(),
      password,
      phone,
      role: 'librarian',
      schoolId
    });

    res.status(201).json({
      success: true,
      message: 'Librarian created successfully',
      data: {
        librarian: {
          id: librarian._id,
          name: librarian.name,
          email: librarian.email,
          phone: librarian.phone,
          role: librarian.role,
          schoolId: librarian.schoolId,
          isActive: librarian.isActive,
          createdAt: librarian.createdAt
        }
      }
    });
  } catch (error) {
    console.error('Create librarian error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error during librarian creation'
    });
  }
};

// @desc    Create accountant
// @route   POST /api/auth/create-accountant
// @access  Private (School Admin only)
const createAccountant = async (req, res) => {
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

    const { name, email, password, phone } = req.body;
    const schoolId = req.user.schoolId; // Get schoolId from authenticated user

    // Check if email already exists globally (across all schools)
    const existingEmail = await User.findOne({ email: email.toLowerCase() });
    if (existingEmail) {
      return res.status(400).json({
        success: false,
        error: 'A user with this email already exists. Please use a different email address.'
      });
    }

    // Check if phone already exists globally (if provided)
    if (phone) {
      const existingPhone = await User.findOne({ phone });
      if (existingPhone) {
        return res.status(400).json({
          success: false,
          error: 'A user with this phone number already exists. Please use a different phone number.'
        });
      }
    }

    // Create accountant
    const accountant = await User.create({
      name,
      email: email.toLowerCase(),
      password,
      phone,
      role: 'accountant',
      schoolId
    });

    res.status(201).json({
      success: true,
      message: 'Accountant created successfully',
      data: {
        accountant: {
          id: accountant._id,
          name: accountant.name,
          email: accountant.email,
          phone: accountant.phone,
          role: accountant.role,
          schoolId: accountant.schoolId,
          isActive: accountant.isActive,
          createdAt: accountant.createdAt
        }
      }
    });
  } catch (error) {
    console.error('Create accountant error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error during accountant creation'
    });
  }
};

module.exports = {
  register,
  login,
  getMe,
  updateProfile,
  changePassword,
  logout,
  createTeacher,
  createLibrarian,
  createAccountant
};

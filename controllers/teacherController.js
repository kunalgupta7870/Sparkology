const User = require('../models/User');
const { validationResult } = require('express-validator');

// @desc    Get all teachers
// @route   GET /api/teachers
// @access  Private
const getTeachers = async (req, res) => {
  try {
    const schoolId = req.user.schoolId;
    
    // Build query based on user role
    const query = { 
      role: 'teacher',
      isActive: true 
    };
    
    // If user is school admin, only show teachers from their school
    if (req.user.role === 'school_admin' && schoolId) {
      query.schoolId = schoolId;
      console.log(`🔍 School Admin ${req.user.name} (${req.user.email}) requesting teachers for school: ${schoolId}`);
    } else if (req.user.role === 'school_admin' && !schoolId) {
      console.log(`⚠️  School Admin ${req.user.name} has no schoolId assigned`);
      return res.status(400).json({
        success: false,
        error: 'School admin has no school assigned'
      });
    }

    console.log(`📋 Query for teachers:`, query);

    const teachers = await User.find(query)
      .select('-password -loginAttempts -lockUntil')
      .sort({ name: 1 });

    console.log(`✅ Found ${teachers.length} teachers for school ${schoolId}`);

    res.status(200).json({
      success: true,
      count: teachers.length,
      data: teachers
    });
  } catch (error) {
    console.error('Get teachers error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
};

// @desc    Get single teacher
// @route   GET /api/teachers/:id
// @access  Private
const getTeacherById = async (req, res) => {
  try {
    const schoolId = req.user.schoolId;
    
    // Build query based on user role
    const query = { 
      _id: req.params.id,
      role: 'teacher' 
    };
    
    // If user is school admin, only show teachers from their school
    if (req.user.role === 'school_admin' && schoolId) {
      query.schoolId = schoolId;
    }

    const teacher = await User.findOne(query).select('-password -loginAttempts -lockUntil');

    if (!teacher) {
      return res.status(404).json({
        success: false,
        error: 'Teacher not found'
      });
    }

    res.status(200).json({
      success: true,
      data: teacher
    });
  } catch (error) {
    console.error('Get teacher error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
};

// @desc    Create teacher
// @route   POST /api/teachers
// @access  Private
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

// @desc    Update teacher
// @route   PUT /api/teachers/:id
// @access  Private
const updateTeacher = async (req, res) => {
  try {
    const schoolId = req.user.schoolId;
    
    // Build query based on user role
    const query = { 
      _id: req.params.id,
      role: 'teacher' 
    };
    
    // If user is school admin, only allow updating teachers from their school
    if (req.user.role === 'school_admin' && schoolId) {
      query.schoolId = schoolId;
    }

    const teacher = await User.findOne(query);

    if (!teacher) {
      return res.status(404).json({
        success: false,
        error: 'Teacher not found'
      });
    }

    const { name, email, phone } = req.body;

    // Check for uniqueness if email is being updated (globally unique)
    if (email) {
      const existingEmail = await User.findOne({
        email: email.toLowerCase(),
        _id: { $ne: req.params.id } // Exclude current teacher
      });
      if (existingEmail) {
        return res.status(400).json({
          success: false,
          error: 'Another user with this email already exists in the system'
        });
      }
    }

    // Check for uniqueness if phone is being updated (globally unique)
    if (phone) {
      const existingPhone = await User.findOne({
        phone: phone,
        _id: { $ne: req.params.id } // Exclude current teacher
      });
      if (existingPhone) {
        return res.status(400).json({
          success: false,
          error: 'Another user with this phone number already exists in the system'
        });
      }
    }

    // Update fields
    if (name) teacher.name = name;
    if (email) teacher.email = email.toLowerCase();
    if (phone) teacher.phone = phone;

    await teacher.save();

    res.status(200).json({
      success: true,
      message: 'Teacher updated successfully',
      data: {
        teacher: {
          id: teacher._id,
          name: teacher.name,
          email: teacher.email,
          phone: teacher.phone,
          role: teacher.role,
          schoolId: teacher.schoolId,
          isActive: teacher.isActive,
          updatedAt: teacher.updatedAt
        }
      }
    });
  } catch (error) {
    console.error('Update teacher error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
};

// @desc    Delete teacher
// @route   DELETE /api/teachers/:id
// @access  Private
const deleteTeacher = async (req, res) => {
  try {
    const schoolId = req.user.schoolId;
    
    // Build query based on user role
    const query = { 
      _id: req.params.id,
      role: 'teacher' 
    };
    
    // If user is school admin, only allow deleting teachers from their school
    if (req.user.role === 'school_admin' && schoolId) {
      query.schoolId = schoolId;
    }

    const teacher = await User.findOne(query);

    if (!teacher) {
      return res.status(404).json({
        success: false,
        error: 'Teacher not found'
      });
    }

    // Delete teacher from database
    await User.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: 'Teacher deleted successfully'
    });
  } catch (error) {
    console.error('Delete teacher error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
};

// @desc    Get teacher profile (current teacher's own profile)
// @route   GET /api/teachers/profile
// @access  Private (Teacher)
const getTeacherProfile = async (req, res) => {
  try {
    const teacher = await User.findById(req.user._id).select('-password -loginAttempts -lockUntil');
    
    if (!teacher) {
      return res.status(404).json({
        success: false,
        error: 'Teacher profile not found'
      });
    }

    // Get school info
    const School = require('../models/School');
    let schoolInfo = null;
    if (teacher.schoolId) {
      schoolInfo = await School.findById(teacher.schoolId).select('name address status');
    }

    res.status(200).json({
      success: true,
      data: {
        teacher: {
          id: teacher._id,
          name: teacher.name,
          email: teacher.email,
          phone: teacher.phone,
          role: teacher.role,
          schoolId: teacher.schoolId,
          avatar: teacher.avatar,
          isActive: teacher.isActive,
          lastLogin: teacher.lastLogin,
          createdAt: teacher.createdAt,
          school: schoolInfo
        }
      }
    });
  } catch (error) {
    console.error('Get teacher profile error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while fetching teacher profile'
    });
  }
};

// @desc    Get teacher statistics for a school
// @route   GET /api/teachers/stats
// @access  Private (School Admin)
const getTeacherStats = async (req, res) => {
  try {
    const schoolId = req.user.schoolId;

    const stats = await User.aggregate([
      { $match: { schoolId: schoolId, role: 'teacher' } },
      {
        $group: {
          _id: null,
          totalTeachers: { $sum: 1 },
          activeTeachers: {
            $sum: { $cond: [{ $eq: ['$isActive', true] }, 1, 0] }
          },
          inactiveTeachers: {
            $sum: { $cond: [{ $eq: ['$isActive', false] }, 1, 0] }
          }
        }
      }
    ]);

    res.status(200).json({
      success: true,
      data: {
        overview: stats[0] || {
          totalTeachers: 0,
          activeTeachers: 0,
          inactiveTeachers: 0
        }
      }
    });
  } catch (error) {
    console.error('Get teacher stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while fetching teacher statistics'
    });
  }
};

module.exports = {
  getTeachers,
  getTeacherById,
  createTeacher,
  updateTeacher,
  deleteTeacher,
  getTeacherProfile,
  getTeacherStats
};

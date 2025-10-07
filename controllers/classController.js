const Class = require('../models/Class');
const Student = require('../models/Student');
const User = require('../models/User');
const { validationResult } = require('express-validator');

// @desc    Get all classes
// @route   GET /api/classes
// @access  Private (School Admin)
const getClasses = async (req, res) => {
  try {
    const { page = 1, limit = 10, teacherId, status } = req.query;
    const schoolId = req.user.schoolId;

    // Build query
    const query = { schoolId };
    if (teacherId) query.teacherId = teacherId;
    if (status) query.status = status;

    const classes = await Class.find(query)
      .populate('teacherId', 'name email')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    // Add student count to each class
    const classesWithStudentCount = await Promise.all(
      classes.map(async (classData) => {
        const studentCount = await Student.countDocuments({ 
          classId: classData._id, 
          status: 'active' 
        });
        
        return {
          ...classData.toObject(),
          studentCount
        };
      })
    );

    const total = await Class.countDocuments(query);

    res.status(200).json({
      success: true,
      count: classesWithStudentCount.length,
      total,
      data: classesWithStudentCount
    });
  } catch (error) {
    console.error('Get classes error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while fetching classes'
    });
  }
};

// @desc    Get class by ID
// @route   GET /api/classes/:id
// @access  Private (School Admin, Teacher)
const getClass = async (req, res) => {
  try {
    const classData = await Class.findById(req.params.id)
      .populate('teacherId', 'name email phone')
      .populate('schoolId', 'name code address');

    if (!classData) {
      return res.status(404).json({
        success: false,
        error: 'Class not found'
      });
    }

    // Check if user has access to this class
    if (req.user.role === 'school_admin' && classData.schoolId._id.toString() !== req.user.schoolId.toString()) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    if (req.user.role === 'teacher' && classData.teacherId._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    // Get student count for this class
    const studentCount = await Student.countDocuments({ classId: req.params.id, status: 'active' });

    res.status(200).json({
      success: true,
      data: {
        ...classData.toObject(),
        studentCount
      }
    });
  } catch (error) {
    console.error('Get class error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while fetching class'
    });
  }
};

// @desc    Create new class
// @route   POST /api/classes
// @access  Private (School Admin)
const createClass = async (req, res) => {
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
      section,
      teacherId,
      capacity,
      room,
      academicYear,
      subjects
    } = req.body;

    const schoolId = req.user.schoolId;

    // Check if class already exists
    const existingClass = await Class.findOne({
      name,
      section,
      schoolId,
      academicYear: academicYear || new Date().getFullYear().toString()
    });

    if (existingClass) {
      return res.status(400).json({
        success: false,
        error: 'Class already exists with this name and section'
      });
    }

    // Verify teacher exists and belongs to the school
    if (teacherId) {
      const teacher = await User.findOne({ _id: teacherId, schoolId, role: 'teacher' });
      if (!teacher) {
        return res.status(400).json({
          success: false,
          error: 'Teacher not found or does not belong to your school'
        });
      }
    }

    // Create class
    const classData = await Class.create({
      name,
      section,
      teacherId: teacherId || null,
      schoolId,
      capacity,
      room,
      academicYear: academicYear || new Date().getFullYear().toString(),
      subjects: subjects || [],
      createdBy: req.user._id
    });

    // Populate the created class
    await classData.populate('teacherId', 'name email');

    res.status(201).json({
      success: true,
      message: 'Class created successfully',
      data: classData
    });
  } catch (error) {
    console.error('Create class error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error during class creation'
    });
  }
};

// @desc    Update class
// @route   PUT /api/classes/:id
// @access  Private (School Admin)
const updateClass = async (req, res) => {
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

    const classData = await Class.findById(req.params.id);

    if (!classData) {
      return res.status(404).json({
        success: false,
        error: 'Class not found'
      });
    }

    // Check if class belongs to the school
    if (classData.schoolId.toString() !== req.user.schoolId.toString()) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    // Update class
    const updatedClass = await Class.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    )
      .populate('teacherId', 'name email');

    res.status(200).json({
      success: true,
      message: 'Class updated successfully',
      data: updatedClass
    });
  } catch (error) {
    console.error('Update class error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error during class update'
    });
  }
};

// @desc    Delete class
// @route   DELETE /api/classes/:id
// @access  Private (School Admin)
const deleteClass = async (req, res) => {
  try {
    const classData = await Class.findById(req.params.id);

    if (!classData) {
      return res.status(404).json({
        success: false,
        error: 'Class not found'
      });
    }

    // Check if class belongs to the school
    if (classData.schoolId.toString() !== req.user.schoolId.toString()) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    // Check if class has students
    const studentCount = await Student.countDocuments({ classId: req.params.id });
    if (studentCount > 0) {
      return res.status(400).json({
        success: false,
        error: 'Cannot delete class with existing students. Please transfer students first.'
      });
    }

    // Delete class
    await Class.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: 'Class deleted successfully'
    });
  } catch (error) {
    console.error('Delete class error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error during class deletion'
    });
  }
};

// @desc    Get class statistics
// @route   GET /api/classes/stats
// @access  Private (School Admin)
const getClassStats = async (req, res) => {
  try {
    const schoolId = req.user.schoolId;

    const stats = await Class.aggregate([
      { $match: { schoolId: schoolId } },
      {
        $group: {
          _id: null,
          totalClasses: { $sum: 1 },
          activeClasses: {
            $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] }
          },
          inactiveClasses: {
            $sum: { $cond: [{ $eq: ['$status', 'inactive'] }, 1, 0] }
          },
          totalCapacity: { $sum: '$capacity' }
        }
      }
    ]);

    const classDistribution = await Class.aggregate([
      { $match: { schoolId: schoolId, status: 'active' } },
      {
        $group: {
          _id: '$name',
          sections: { $addToSet: '$section' },
          count: { $sum: 1 },
          totalCapacity: { $sum: '$capacity' }
        }
      },
      {
        $project: {
          className: '$_id',
          sections: 1,
          count: 1,
          totalCapacity: 1,
          _id: 0
        }
      }
    ]);

    // Get student distribution by class
    const studentDistribution = await Student.aggregate([
      { $match: { schoolId: schoolId, status: 'active' } },
      {
        $group: {
          _id: '$classId',
          count: { $sum: 1 }
        }
      },
      {
        $lookup: {
          from: 'classes',
          localField: '_id',
          foreignField: '_id',
          as: 'classInfo'
        }
      },
      {
        $unwind: '$classInfo'
      },
      {
        $project: {
          className: '$classInfo.name',
          section: '$classInfo.section',
          studentCount: '$count',
          capacity: '$classInfo.capacity',
          _id: 0
        }
      }
    ]);

    res.status(200).json({
      success: true,
      data: {
        overview: stats[0] || {
          totalClasses: 0,
          activeClasses: 0,
          inactiveClasses: 0,
          totalCapacity: 0
        },
        classDistribution,
        studentDistribution
      }
    });
  } catch (error) {
    console.error('Get class stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while fetching class statistics'
    });
  }
};

module.exports = {
  getClasses,
  getClass,
  createClass,
  updateClass,
  deleteClass,
  getClassStats
};

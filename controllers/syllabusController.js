const Syllabus = require('../models/Syllabus');
const Class = require('../models/Class');
const Subject = require('../models/Subject');
const User = require('../models/User');
const { validationResult } = require('express-validator');

// @desc    Get all syllabus
// @route   GET /api/syllabus
// @access  Private (School Admin)
const getSyllabus = async (req, res) => {
  try {
    const schoolId = req.user.schoolId;
    const { classId, subjectId, teacherId, academicYear } = req.query;
    
    let query = { schoolId, status: 'active' };
    
    if (classId) query.classId = classId;
    if (subjectId) query.subjectId = subjectId;
    if (teacherId) query.teacherId = teacherId;
    if (academicYear) query.academicYear = academicYear;
    
    const syllabus = await Syllabus.find(query)
      .populate('classId', 'name section')
      .populate('subjectId', 'name code')
      .populate('teacherId', 'name email')
      .populate('createdBy', 'name email')
      .populate('updatedBy', 'name email')
      .sort({ academicYear: -1, 'classId.name': 1, 'subjectId.name': 1 });

    res.status(200).json({
      success: true,
      count: syllabus.length,
      data: syllabus
    });
  } catch (error) {
    console.error('Get syllabus error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while fetching syllabus'
    });
  }
};

// @desc    Get syllabus by ID
// @route   GET /api/syllabus/:id
// @access  Private (School Admin or Teacher - for their own syllabus)
const getSyllabusById = async (req, res) => {
  try {
    const schoolId = req.user.schoolId;
    const userId = req.user._id;
    const userRole = req.user.role;
    
    let query = { _id: req.params.id };
    
    // If teacher, only allow access to their own syllabus
    if (userRole === 'teacher') {
      query.teacherId = userId;
      query.status = 'active';
    } else {
      // Admin can access any syllabus in their school
      query.schoolId = schoolId;
    }
    
    const syllabus = await Syllabus.findOne(query)
      .populate('classId', 'name section')
      .populate('subjectId', 'name code')
      .populate('teacherId', 'name email')
      .populate('createdBy', 'name email')
      .populate('updatedBy', 'name email');

    if (!syllabus) {
      return res.status(404).json({
        success: false,
        error: 'Syllabus not found'
      });
    }

    res.status(200).json({
      success: true,
      data: syllabus
    });
  } catch (error) {
    console.error('Get syllabus error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while fetching syllabus'
    });
  }
};

// @desc    Create new syllabus
// @route   POST /api/syllabus
// @access  Private (School Admin)
const createSyllabus = async (req, res) => {
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

    const { classId, subjectId, teacherId, academicYear, syllabusContent, topics, learningObjectives, assessmentCriteria, resources } = req.body;
    const schoolId = req.user.schoolId;

    // Verify class exists and belongs to the school
    const classExists = await Class.findOne({ _id: classId, schoolId });
    if (!classExists) {
      return res.status(400).json({
        success: false,
        error: 'Class not found or does not belong to your school'
      });
    }

    // Verify subject exists and belongs to the school
    const subjectExists = await Subject.findOne({ _id: subjectId, schoolId });
    if (!subjectExists) {
      return res.status(400).json({
        success: false,
        error: 'Subject not found or does not belong to your school'
      });
    }

    // Verify teacher exists and belongs to the school (if provided)
    if (teacherId) {
      const teacherExists = await User.findOne({ _id: teacherId, schoolId, role: 'teacher' });
      if (!teacherExists) {
        return res.status(400).json({
          success: false,
          error: 'Teacher not found or does not belong to your school'
        });
      }
    }

    // Check if syllabus already exists for this class-subject-teacher-academic year combination
    const existingSyllabusQuery = {
      classId,
      subjectId,
      academicYear,
      schoolId
    };
    
    // Include teacherId in query if provided, otherwise check for null
    if (teacherId) {
      existingSyllabusQuery.teacherId = teacherId;
    } else {
      existingSyllabusQuery.teacherId = null;
    }

    const existingSyllabus = await Syllabus.findOne(existingSyllabusQuery);

    if (existingSyllabus) {
      return res.status(400).json({
        success: false,
        error: 'Syllabus already exists for this class, subject, teacher, and academic year combination'
      });
    }

    // Create syllabus
    const syllabus = await Syllabus.create({
      classId,
      subjectId,
      teacherId: teacherId || null,
      schoolId,
      academicYear,
      syllabusContent,
      topics: topics || [],
      learningObjectives: learningObjectives || [],
      assessmentCriteria: assessmentCriteria || '',
      resources: resources || [],
      createdBy: req.user._id
    });

    // Populate the created syllabus
    await syllabus.populate('classId', 'name section');
    await syllabus.populate('subjectId', 'name code');
    await syllabus.populate('teacherId', 'name email');
    await syllabus.populate('createdBy', 'name email');

    res.status(201).json({
      success: true,
      message: 'Syllabus created successfully',
      data: syllabus
    });
  } catch (error) {
    console.error('Create syllabus error:', error);
    
    // Handle duplicate key error
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        error: 'Syllabus already exists for this class, subject, and academic year combination'
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Server error during syllabus creation'
    });
  }
};

// @desc    Update syllabus
// @route   PUT /api/syllabus/:id
// @access  Private (School Admin)
const updateSyllabus = async (req, res) => {
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

    const schoolId = req.user.schoolId;
    
    const syllabus = await Syllabus.findOne({ 
      _id: req.params.id,
      schoolId 
    });

    if (!syllabus) {
      return res.status(404).json({
        success: false,
        error: 'Syllabus not found'
      });
    }

    // Update syllabus
    const updateData = {
      ...req.body,
      updatedBy: req.user._id
    };

    // Verify teacher exists if being updated
    if (updateData.teacherId) {
      const teacherExists = await User.findOne({ 
        _id: updateData.teacherId, 
        schoolId, 
        role: 'teacher' 
      });
      if (!teacherExists) {
        return res.status(400).json({
          success: false,
          error: 'Teacher not found or does not belong to your school'
        });
      }
    }

    const updatedSyllabus = await Syllabus.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    )
      .populate('classId', 'name section')
      .populate('subjectId', 'name code')
      .populate('teacherId', 'name email')
      .populate('createdBy', 'name email')
      .populate('updatedBy', 'name email');

    res.status(200).json({
      success: true,
      message: 'Syllabus updated successfully',
      data: updatedSyllabus
    });
  } catch (error) {
    console.error('Update syllabus error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error during syllabus update'
    });
  }
};

// @desc    Delete syllabus
// @route   DELETE /api/syllabus/:id
// @access  Private (School Admin)
const deleteSyllabus = async (req, res) => {
  try {
    const schoolId = req.user.schoolId;
    
    const syllabus = await Syllabus.findOne({ 
      _id: req.params.id,
      schoolId 
    });

    if (!syllabus) {
      return res.status(404).json({
        success: false,
        error: 'Syllabus not found'
      });
    }

    // Soft delete by setting status to inactive
    syllabus.status = 'inactive';
    await syllabus.save();

    res.status(200).json({
      success: true,
      message: 'Syllabus deleted successfully'
    });
  } catch (error) {
    console.error('Delete syllabus error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error during syllabus deletion'
    });
  }
};

// @desc    Get syllabus by class and subject
// @route   GET /api/syllabus/class/:classId/subject/:subjectId
// @access  Private (School Admin)
const getSyllabusByClassAndSubject = async (req, res) => {
  try {
    const { classId, subjectId } = req.params;
    const { academicYear } = req.query;
    const schoolId = req.user.schoolId;

    let query = { classId, subjectId, schoolId, status: 'active' };
    if (academicYear) {
      query.academicYear = academicYear;
    }

    const syllabus = await Syllabus.find(query)
      .populate('classId', 'name section')
      .populate('subjectId', 'name code')
      .populate('teacherId', 'name email')
      .populate('createdBy', 'name email')
      .populate('updatedBy', 'name email')
      .sort({ academicYear: -1 });

    res.status(200).json({
      success: true,
      count: syllabus.length,
      data: syllabus
    });
  } catch (error) {
    console.error('Get syllabus by class and subject error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while fetching syllabus'
    });
  }
};

// @desc    Get syllabus for teacher
// @route   GET /api/syllabus/teacher
// @access  Private (Teacher)
const getTeacherSyllabus = async (req, res) => {
  try {
    const teacherId = req.user._id;
    const { academicYear } = req.query;
    
    let query = { teacherId, status: 'active' };
    if (academicYear) query.academicYear = academicYear;
    
    const syllabus = await Syllabus.find(query)
      .populate('classId', 'name section')
      .populate('subjectId', 'name code')
      .populate('teacherId', 'name email')
      .sort({ academicYear: -1, 'classId.name': 1, 'subjectId.name': 1 });

    res.status(200).json({
      success: true,
      count: syllabus.length,
      data: syllabus
    });
  } catch (error) {
    console.error('Get teacher syllabus error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while fetching syllabus'
    });
  }
};

module.exports = {
  getSyllabus,
  getSyllabusById,
  createSyllabus,
  updateSyllabus,
  deleteSyllabus,
  getSyllabusByClassAndSubject,
  getTeacherSyllabus
};


const Subject = require('../models/Subject');
const User = require('../models/User');
const { validationResult } = require('express-validator');

/* ================================
   GET ALL SUBJECTS
================================ */
const getSubjects = async (req, res) => {
  try {
    const schoolId = req.user.schoolId;

    const subjects = await Subject.find({ schoolId })
      .populate('teacherId', 'name email')
      .populate('classId', 'name section')
      .sort({ name: 1 });

    res.status(200).json({
      success: true,
      count: subjects.length,
      data: subjects
    });
  } catch (error) {
    console.error('Get subjects error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while fetching subjects'
    });
  }
};

/* ================================
   GET SINGLE SUBJECT
================================ */
const getSubject = async (req, res) => {
  try {
    const schoolId = req.user.schoolId;

    const subject = await Subject.findOne({
      _id: req.params.id,
      schoolId
    })
      .populate('teacherId', 'name email')
      .populate('classId', 'name section');

    if (!subject) {
      return res.status(404).json({
        success: false,
        error: 'Subject not found'
      });
    }

    res.status(200).json({
      success: true,
      data: subject
    });
  } catch (error) {
    console.error('Get subject error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while fetching subject'
    });
  }
};

/* ================================
   CREATE SUBJECT (MULTI-CLASS)
================================ */
const createSubject = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { name, code, teacherId, classIds, type } = req.body;
    const schoolId = req.user.schoolId;

    if (!name || !Array.isArray(classIds) || classIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Subject name and at least one class are required'
      });
    }

    // Validate teacher
    if (teacherId) {
      const teacher = await User.findOne({
        _id: teacherId,
        schoolId,
        role: 'teacher'
      });

      if (!teacher) {
        return res.status(400).json({
          success: false,
          error: 'Teacher not found or does not belong to your school'
        });
      }
    }

    const createdSubjects = [];

    for (const clsId of classIds) {
      // Prevent exact duplicate
      const exists = await Subject.findOne({
        name,
        classId: clsId,
        teacherId: teacherId || null,
        schoolId
      });

      if (exists) continue;

      const subject = await Subject.create({
        name,
        code: code
          ? code.toUpperCase()
          : name.substring(0, 3).toUpperCase(),
        teacherId: teacherId || null,
        classId: clsId,
        schoolId,
        type: type || 'core',
        createdBy: req.user._id
      });

      createdSubjects.push(subject);
    }

    res.status(201).json({
      success: true,
      message: 'Subjects created successfully',
      count: createdSubjects.length,
      data: createdSubjects
    });
  } catch (error) {
    console.error('Create subject error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/* ================================
   UPDATE SUBJECT (SINGLE CLASS)
================================ */
const updateSubject = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const schoolId = req.user.schoolId;

    const subject = await Subject.findOne({
      _id: req.params.id,
      schoolId
    });

    if (!subject) {
      return res.status(404).json({
        success: false,
        error: 'Subject not found'
      });
    }

    const updatedSubject = await Subject.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    )
      .populate('teacherId', 'name email')
      .populate('classId', 'name section');

    res.status(200).json({
      success: true,
      message: 'Subject updated successfully',
      data: updatedSubject
    });
  } catch (error) {
    console.error('Update subject error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/* ================================
   DELETE SUBJECT
================================ */
const deleteSubject = async (req, res) => {
  try {
    const schoolId = req.user.schoolId;

    const subject = await Subject.findOne({
      _id: req.params.id,
      schoolId
    });

    if (!subject) {
      return res.status(404).json({
        success: false,
        error: 'Subject not found'
      });
    }

    await Subject.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: 'Subject deleted successfully'
    });
  } catch (error) {
    console.error('Delete subject error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error during subject deletion'
    });
  }
};

/* ================================
   ASSIGN TEACHER TO SUBJECT
================================ */
const assignSubjectTeacher = async (req, res) => {
  try {
    const { teacherId } = req.body;
    const schoolId = req.user.schoolId;

    const subject = await Subject.findOne({
      _id: req.params.id,
      schoolId
    });

    if (!subject) {
      return res.status(404).json({
        success: false,
        error: 'Subject not found'
      });
    }

    if (teacherId) {
      const teacher = await User.findOne({
        _id: teacherId,
        schoolId,
        role: 'teacher'
      });

      if (!teacher) {
        return res.status(400).json({
          success: false,
          error: 'Teacher not found or does not belong to your school'
        });
      }
    }

    const updatedSubject = await Subject.findByIdAndUpdate(
      req.params.id,
      { teacherId: teacherId || null },
      { new: true, runValidators: true }
    )
      .populate('teacherId', 'name email')
      .populate('classId', 'name section');

    res.status(200).json({
      success: true,
      message: 'Teacher assigned successfully',
      data: updatedSubject
    });
  } catch (error) {
    console.error('Assign subject teacher error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

module.exports = {
  getSubjects,
  getSubject,
  createSubject,
  updateSubject,
  deleteSubject,
  assignSubjectTeacher
};

const Parent = require('../models/Parent');
const Student = require('../models/Student');
const Schedule = require('../models/Schedule');
const Assignment = require('../models/Assignment');
const Attendance = require('../models/Attendance');
const asyncHandler = require('../middleware/asyncHandler');

// @desc    Get parent profile
// @route   GET /api/parents/profile
// @access  Private (Parent)
const getParentProfile = async (req, res) => {
  try {
    // Get parent record (req.user is now the parent record)
    const parent = await Parent.findById(req.user._id);

    if (!parent) {
      return res.status(404).json({
        success: false,
        error: 'Parent not found'
      });
    }

    // Get associated student
    const student = await Student.findById(parent.studentId)
      .populate('schoolId', 'name code address')
      .populate('classId', 'name section');

    if (!student) {
      return res.status(404).json({
        success: false,
        error: 'Associated student not found'
      });
    }

    res.status(200).json({
      success: true,
      data: {
        parent: {
          id: parent._id, // Parent's own _id
          name: parent.name,
          email: parent.email,
          role: 'parent',
          parentType: parent.parentType,
          studentId: parent.studentId, // Link to ward
          schoolId: parent.schoolId,
          phone: parent.phone,
          occupation: parent.occupation,
          lastLogin: parent.lastLogin,
          createdAt: parent.createdAt
        },
        student: {
          id: student._id,
          name: student.name,
          rollNumber: student.rollNumber,
          classId: student.classId,
          schoolId: student.schoolId
        }
      }
    });
  } catch (error) {
    console.error('Get parent profile error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while fetching parent profile'
    });
  }
};

// @desc    Get parent's children
// @route   GET /api/parents/children
// @access  Private (Parent)
const getParentChildren = async (req, res) => {
  try {
    // Get parent record (req.user is now the parent record)
    const parent = await Parent.findById(req.user._id);

    if (!parent) {
      return res.status(404).json({
        success: false,
        error: 'Parent not found'
      });
    }

    // Get all student IDs (support both old and new schema)
    let studentIds = [];
    if (parent.studentIds && parent.studentIds.length > 0) {
      studentIds = parent.studentIds;
    } else if (parent.studentId) {
      studentIds = [parent.studentId];
    }

    if (studentIds.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'No children found for this parent'
      });
    }

    // Get all associated students
    const children = await Student.find({ _id: { $in: studentIds } })
      .populate('classId', 'name section displayName')
      .populate('schoolId', 'name code');

    if (!children || children.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'No children found for this parent'
      });
    }

    res.status(200).json({
      success: true,
      data: children // Return as array of all children
    });
  } catch (error) {
    console.error('Get parent children error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while fetching children'
    });
  }
};

// @desc    Get child profile
// @route   GET /api/parents/children/:childId
// @access  Private (Parent)
const getChildProfile = async (req, res) => {
  try {
    const { childId } = req.params;
    
    // Get parent record (req.user is now the parent record)
    const parent = await Parent.findById(req.user._id);

    if (!parent) {
      return res.status(404).json({
        success: false,
        error: 'Parent not found'
      });
    }

    // Get all student IDs (support both old and new schema)
    let studentIds = [];
    if (parent.studentIds && parent.studentIds.length > 0) {
      studentIds = parent.studentIds.map(id => id.toString());
    } else if (parent.studentId) {
      studentIds = [parent.studentId.toString()];
    }

    // Check if the requested child ID is one of the parent's children
    if (!studentIds.includes(childId)) {
      return res.status(403).json({
        success: false,
        error: 'Access denied. You can only view your own child\'s profile.'
      });
    }

    const child = await Student.findById(childId)
      .populate('classId', 'name section')
      .populate('schoolId', 'name code address');

    if (!child) {
      return res.status(404).json({
        success: false,
        error: 'Child not found'
      });
    }

    res.status(200).json({
      success: true,
      data: {
        child: {
          id: child._id,
          name: child.name,
          email: child.email,
          rollNumber: child.rollNumber,
          admissionNumber: child.admissionNumber,
          dateOfBirth: child.dateOfBirth,
          gender: child.gender,
          classId: child.classId,
          schoolId: child.schoolId,
          address: child.address,
          phone: child.phone,
          bloodGroup: child.bloodGroup,
          medicalInfo: child.medicalInfo,
          status: child.status,
          lastLogin: child.lastLogin,
          createdAt: child.createdAt
        }
      }
    });
  } catch (error) {
    console.error('Get child profile error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while fetching child profile'
    });
  }
};

// @desc    Get child schedule
// @route   GET /api/parents/children/:childId/schedule
// @access  Private (Parent)
const getChildSchedule = async (req, res) => {
  try {
    const { childId } = req.params;
    const { date, week } = req.query;
    
    // Get parent record (req.user is now the parent record)
    const parent = await Parent.findById(req.user._id);

    if (!parent) {
      return res.status(404).json({
        success: false,
        error: 'Parent not found'
      });
    }

    // Get all student IDs (support both old and new schema)
    let studentIds = [];
    if (parent.studentIds && parent.studentIds.length > 0) {
      studentIds = parent.studentIds.map(id => id.toString());
    } else if (parent.studentId) {
      studentIds = [parent.studentId.toString()];
    }

    // Check if the requested child ID is one of the parent's children
    if (!studentIds.includes(childId)) {
      return res.status(403).json({
        success: false,
        error: 'Access denied. You can only view your own child\'s schedule.'
      });
    }

    const child = await Student.findById(childId);
    
    if (!child || !child.classId) {
      return res.status(404).json({
        success: false,
        error: 'Child not found or not assigned to any class'
      });
    }

    let query = { 
      classId: child.classId,
      schoolId: child.schoolId,
      isActive: true
    };

    if (date) {
      const startDate = new Date(date);
      const endDate = new Date(date);
      endDate.setDate(endDate.getDate() + 1);
      query.date = { $gte: startDate, $lt: endDate };
    } else if (week) {
      const weekStart = new Date(week);
      const weekEnd = new Date(week);
      weekEnd.setDate(weekEnd.getDate() + 7);
      query.date = { $gte: weekStart, $lt: weekEnd };
    }

    const schedules = await Schedule.find(query)
      .populate('subjectId', 'name code')
      .populate('teacherId', 'name email')
      .sort({ date: 1, startTime: 1 });

    res.status(200).json({
      success: true,
      data: schedules
    });
  } catch (error) {
    console.error('Get child schedule error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while fetching child schedule'
    });
  }
};

// @desc    Get child attendance
// @route   GET /api/parents/children/:childId/attendance
// @access  Private (Parent)
const getChildAttendance = async (req, res) => {
  try {
    const { childId } = req.params;
    const { date, month, year, subjectId } = req.query;
    
    // Get parent record (req.user is now the parent record)
    const parent = await Parent.findById(req.user._id);

    if (!parent) {
      return res.status(404).json({
        success: false,
        error: 'Parent not found'
      });
    }

    // Get all student IDs (support both old and new schema)
    let studentIds = [];
    if (parent.studentIds && parent.studentIds.length > 0) {
      studentIds = parent.studentIds.map(id => id.toString());
    } else if (parent.studentId) {
      studentIds = [parent.studentId.toString()];
    }

    // Check if the requested child ID is one of the parent's children
    if (!studentIds.includes(childId)) {
      return res.status(403).json({
        success: false,
        error: 'Access denied. You can only view your own child\'s attendance.'
      });
    }

    const child = await Student.findById(childId);
    
    if (!child) {
      return res.status(404).json({
        success: false,
        error: 'Child not found'
      });
    }

    let query = { 
      studentId: child._id,
      schoolId: child.schoolId
    };

    if (date) {
      const startDate = new Date(date);
      const endDate = new Date(date);
      endDate.setDate(endDate.getDate() + 1);
      query.date = { $gte: startDate, $lt: endDate };
    } else if (month && year) {
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 1);
      query.date = { $gte: startDate, $lt: endDate };
    }

    if (subjectId) query.subjectId = subjectId;

    const attendance = await Attendance.find(query)
      .populate('subjectId', 'name code')
      .populate('teacherId', 'name email')
      .sort({ date: -1 });

    res.status(200).json({
      success: true,
      data: attendance
    });
  } catch (error) {
    console.error('Get child attendance error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while fetching child attendance'
    });
  }
};

// @desc    Get child assignments
// @route   GET /api/parents/children/:childId/assignments
// @access  Private (Parent)
const getChildAssignments = async (req, res) => {
  try {
    const { childId } = req.params;
    const { status, subjectId, dueDate } = req.query;
    
    // Get parent record (req.user is now the parent record)
    const parent = await Parent.findById(req.user._id);

    if (!parent) {
      return res.status(404).json({
        success: false,
        error: 'Parent not found'
      });
    }

    // Get all student IDs (support both old and new schema)
    let studentIds = [];
    if (parent.studentIds && parent.studentIds.length > 0) {
      studentIds = parent.studentIds.map(id => id.toString());
    } else if (parent.studentId) {
      studentIds = [parent.studentId.toString()];
    }

    // Check if the requested child ID is one of the parent's children
    if (!studentIds.includes(childId)) {
      return res.status(403).json({
        success: false,
        error: 'Access denied. You can only view your own child\'s assignments.'
      });
    }

    const child = await Student.findById(childId);
    
    if (!child || !child.classId) {
      return res.status(404).json({
        success: false,
        error: 'Child not found or not assigned to any class'
      });
    }

    let query = { 
      classId: child.classId,
      schoolId: child.schoolId,
      status: 'active'
    };

    if (status) query.status = status;
    if (subjectId) query.subjectId = subjectId;
    if (dueDate) {
      const date = new Date(dueDate);
      const nextDay = new Date(date);
      nextDay.setDate(nextDay.getDate() + 1);
      query.dueDate = { $gte: date, $lt: nextDay };
    }

    console.log('🔍 Parent Controller: Query for child assignments:', JSON.stringify(query, null, 2));
    console.log('🔍 Parent Controller: Child info:', {
      childId: child._id,
      childName: child.name,
      classId: child.classId,
      schoolId: child.schoolId
    });

    const assignments = await Assignment.find(query)
      .populate('subjectId', 'name code')
      .populate('teacherId', 'name email')
      .sort({ dueDate: 1 });

    console.log('🔍 Parent Controller: Found assignments:', assignments.length);
    console.log('🔍 Parent Controller: Assignment details:', assignments.map(a => ({
      id: a._id,
      title: a.title,
      classId: a.classId,
      status: a.status,
      dueDate: a.dueDate
    })));

    res.status(200).json({
      success: true,
      data: assignments
    });
  } catch (error) {
    console.error('Get child assignments error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while fetching child assignments'
    });
  }
};

// @desc    Get child teachers
// @route   GET /api/parents/children/:childId/teachers
// @access  Private (Parent)
const getChildTeachers = async (req, res) => {
  try {
    const { childId } = req.params;
    
    // Get parent record (req.user is now the parent record)
    const parent = await Parent.findById(req.user._id);

    if (!parent) {
      return res.status(404).json({
        success: false,
        error: 'Parent not found'
      });
    }

    // Get all student IDs (support both old and new schema)
    let studentIds = [];
    if (parent.studentIds && parent.studentIds.length > 0) {
      studentIds = parent.studentIds.map(id => id.toString());
    } else if (parent.studentId) {
      studentIds = [parent.studentId.toString()];
    }

    // Check if the requested child ID is one of the parent's children
    if (!studentIds.includes(childId)) {
      return res.status(403).json({
        success: false,
        error: 'Access denied. You can only view your own child\'s teachers.'
      });
    }

    const child = await Student.findById(childId);
    
    if (!child || !child.classId) {
      return res.status(404).json({
        success: false,
        error: 'Child not found or not assigned to any class'
      });
    }

    const Subject = require('../models/Subject');
    const teachers = await Subject.find({
      classId: child.classId,
      teacherId: { $ne: null }
    })
    .populate('teacherId', 'name email phone')
    .select('teacherId name');

    // Remove duplicates and format response
    const uniqueTeachers = teachers.reduce((acc, subject) => {
      const teacherId = subject.teacherId._id.toString();
      if (!acc.find(t => t.id.toString() === teacherId)) {
        acc.push({
          id: subject.teacherId._id,
          name: subject.teacherId.name,
          email: subject.teacherId.email,
          phone: subject.teacherId.phone,
          subjects: [subject.name]
        });
      } else {
        const existingTeacher = acc.find(t => t.id.toString() === teacherId);
        if (!existingTeacher.subjects.includes(subject.name)) {
          existingTeacher.subjects.push(subject.name);
        }
      }
      return acc;
    }, []);

    res.status(200).json({
      success: true,
      data: uniqueTeachers
    });
  } catch (error) {
    console.error('Get child teachers error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while fetching child teachers'
    });
  }
};

// @desc    Get all parents by school
// @route   GET /api/parents
// @access  Private (School Admin)
const getAllParents = asyncHandler(async (req, res) => {
  const { schoolId } = req.query;
  
  if (!schoolId) {
    return res.status(400).json({
      success: false,
      error: 'School ID is required'
    });
  }

  const parents = await Parent.find({ schoolId, isActive: true })
    .populate({
      path: 'studentIds',
      select: 'name rollNumber classId address',
      populate: {
        path: 'classId',
        select: 'name section'
      }
    })
    .populate({
      path: 'studentId',
      select: 'name rollNumber classId address',
      populate: {
        path: 'classId',
        select: 'name section'
      }
    })
    .sort({ name: 1 });

  res.status(200).json({
    success: true,
    count: parents.length,
    data: parents
  });
});

module.exports = {
  getParentProfile,
  getParentChildren,
  getChildProfile,
  getChildSchedule,
  getChildAttendance,
  getChildAssignments,
  getChildTeachers,
  getAllParents
};

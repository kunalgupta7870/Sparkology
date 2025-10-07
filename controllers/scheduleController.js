const Schedule = require('../models/Schedule');
const Class = require('../models/Class');
const User = require('../models/User');
const Subject = require('../models/Subject');
const { validationResult } = require('express-validator');

// @desc    Get all schedules for a school
// @route   GET /api/schedules
// @access  Private (School Admin, Teacher)
const getSchedules = async (req, res) => {
  try {
    const { academicYear = '2024-2025', teacherId, classId, dayOfWeek, date } = req.query;
    const schoolId = req.user.schoolId;

    // Build query
    const query = { schoolId, academicYear, status: 'active' };
    
    // If teacher is requesting, only show their schedules
    if (req.user.role === 'teacher') {
      query.teacherId = req.user._id;
    } else if (teacherId) {
      query.teacherId = teacherId;
    }
    
    if (classId) query.classId = classId;
    if (dayOfWeek) query.dayOfWeek = dayOfWeek;
    
    // Handle date-based queries for specific days
    if (date) {
      // Parse the date and get the day of the week
      const targetDate = new Date(date);
      const dayName = targetDate.toLocaleDateString('en-US', { weekday: 'long' });
      query.dayOfWeek = dayName;
    }

    const schedules = await Schedule.find(query)
      .populate('teacherId', 'name email')
      .populate('classId', 'name section room')
      .populate('subjectId', 'name code')
      .sort({ date: 1, startTime: 1 });

    res.status(200).json({
      success: true,
      count: schedules.length,
      data: schedules
    });
  } catch (error) {
    console.error('Get schedules error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while fetching schedules'
    });
  }
};

// @desc    Get weekly schedule view
// @route   GET /api/schedules/weekly
// @access  Private (School Admin, Teacher)
const getWeeklySchedule = async (req, res) => {
  try {
    const { academicYear = '2024-2025' } = req.query;
    const schoolId = req.user.schoolId;

    // Build query - teachers only see their own schedules
    const query = {
      schoolId,
      academicYear,
      status: 'active'
    };
    
    if (req.user.role === 'teacher') {
      query.teacherId = req.user._id;
    }

    const schedules = await Schedule.find(query)
    .populate('teacherId', 'name email')
    .populate('classId', 'name section room')
    .populate('subjectId', 'name code')
    .sort({ dayOfWeek: 1, startTime: 1 });

    // Organize schedules by day
    const weeklySchedule = {
      Monday: [],
      Tuesday: [],
      Wednesday: [],
      Thursday: [],
      Friday: [],
      Saturday: [],
      Sunday: []
    };

    schedules.forEach(schedule => {
      weeklySchedule[schedule.dayOfWeek].push(schedule);
    });

    res.status(200).json({
      success: true,
      data: weeklySchedule
    });
  } catch (error) {
    console.error('Get weekly schedule error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while fetching weekly schedule'
    });
  }
};

// @desc    Get schedule by teacher
// @route   GET /api/schedules/teacher/:teacherId
// @access  Private (School Admin, Teacher)
const getScheduleByTeacher = async (req, res) => {
  try {
    const { teacherId } = req.params;
    const { academicYear = '2024-2025' } = req.query;

    const schedules = await Schedule.getScheduleByTeacher(teacherId, academicYear);

    res.status(200).json({
      success: true,
      count: schedules.length,
      data: schedules
    });
  } catch (error) {
    console.error('Get teacher schedule error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while fetching teacher schedule'
    });
  }
};

// @desc    Get schedule by class
// @route   GET /api/schedules/class/:classId
// @access  Private (School Admin, Teacher)
const getScheduleByClass = async (req, res) => {
  try {
    const { classId } = req.params;
    const { academicYear = '2024-2025' } = req.query;

    const schedules = await Schedule.getScheduleByClass(classId, academicYear);

    res.status(200).json({
      success: true,
      count: schedules.length,
      data: schedules
    });
  } catch (error) {
    console.error('Get class schedule error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while fetching class schedule'
    });
  }
};

// @desc    Get available teachers and classes for schedule
// @route   GET /api/schedules/available
// @access  Private (School Admin)
const getAvailableData = async (req, res) => {
  try {
    const schoolId = req.user.schoolId;

    // Get teachers who have subjects assigned
    const teachersWithSubjects = await Subject.find({ schoolId, status: 'active' })
      .populate('teacherId', 'name email')
      .distinct('teacherId');

    const teachers = await User.find({
      _id: { $in: teachersWithSubjects },
      schoolId,
      role: 'teacher',
      isActive: true
    }).select('name email');

    // Get classes
    const classes = await Class.find({ schoolId, status: 'active' })
      .populate('teacherId', 'name')
      .select('name section room capacity');

    // Get subjects with their teacher-class relationships
    const subjects = await Subject.find({ schoolId, status: 'active' })
      .populate('teacherId', 'name email')
      .populate('classId', 'name section')
      .select('name code teacherId classId');

    res.status(200).json({
      success: true,
      data: {
        teachers,
        classes,
        subjects
      }
    });
  } catch (error) {
    console.error('Get available data error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while fetching available data'
    });
  }
};

// @desc    Create new schedule
// @route   POST /api/schedules
// @access  Private (School Admin)
const createSchedule = async (req, res) => {
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
      teacherId,
      classId,
      subjectId,
      dayOfWeek,
      startTime,
      endTime,
      room,
      academicYear,
      semester,
      notes
    } = req.body;

    const schoolId = req.user.schoolId;

    // Validate that teacher, class, and subject belong to the same school
    const [teacher, classData, subject] = await Promise.all([
      User.findOne({ _id: teacherId, schoolId, role: 'teacher' }),
      Class.findOne({ _id: classId, schoolId }),
      Subject.findOne({ _id: subjectId, schoolId })
    ]);

    if (!teacher) {
      return res.status(400).json({
        success: false,
        error: 'Teacher not found or does not belong to this school'
      });
    }

    if (!classData) {
      return res.status(400).json({
        success: false,
        error: 'Class not found or does not belong to this school'
      });
    }

    if (!subject) {
      return res.status(400).json({
        success: false,
        error: 'Subject not found or does not belong to this school'
      });
    }

    // Validate that the subject is taught by this teacher to this class
    if (subject.teacherId.toString() !== teacherId || subject.classId.toString() !== classId) {
      return res.status(400).json({
        success: false,
        error: 'This teacher does not teach this subject to this class'
      });
    }

    // Create schedule
    const schedule = await Schedule.create({
      schoolId,
      teacherId,
      classId,
      subjectId,
      dayOfWeek,
      startTime,
      endTime,
      room: room || classData.room,
      academicYear: academicYear || '2024-2025',
      semester: semester || 'Annual',
      notes,
      createdBy: req.user._id
    });

    // Populate the created schedule
    await schedule.populate([
      { path: 'teacherId', select: 'name email' },
      { path: 'classId', select: 'name section room' },
      { path: 'subjectId', select: 'name code' }
    ]);

    res.status(201).json({
      success: true,
      data: schedule
    });
  } catch (error) {
    console.error('Create schedule error:', error);
    
    if (error.message.includes('conflicting schedule')) {
      return res.status(400).json({
        success: false,
        error: error.message
      });
    }

    res.status(500).json({
      success: false,
      error: 'Server error while creating schedule'
    });
  }
};

// @desc    Update schedule
// @route   PUT /api/schedules/:id
// @access  Private (School Admin)
const updateSchedule = async (req, res) => {
  try {
    const { id } = req.params;
    const schoolId = req.user.schoolId;

    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const schedule = await Schedule.findOne({ _id: id, schoolId });
    if (!schedule) {
      return res.status(404).json({
        success: false,
        error: 'Schedule not found'
      });
    }

    const {
      teacherId,
      classId,
      subjectId,
      dayOfWeek,
      startTime,
      endTime,
      room,
      academicYear,
      semester,
      notes
    } = req.body;

    // Update schedule fields
    if (teacherId) schedule.teacherId = teacherId;
    if (classId) schedule.classId = classId;
    if (subjectId) schedule.subjectId = subjectId;
    if (dayOfWeek) schedule.dayOfWeek = dayOfWeek;
    if (startTime) schedule.startTime = startTime;
    if (endTime) schedule.endTime = endTime;
    if (room !== undefined) schedule.room = room;
    if (academicYear) schedule.academicYear = academicYear;
    if (semester) schedule.semester = semester;
    if (notes !== undefined) schedule.notes = notes;
    
    schedule.updatedBy = req.user._id;

    await schedule.save();

    // Populate the updated schedule
    await schedule.populate([
      { path: 'teacherId', select: 'name email' },
      { path: 'classId', select: 'name section room' },
      { path: 'subjectId', select: 'name code' }
    ]);

    res.status(200).json({
      success: true,
      data: schedule
    });
  } catch (error) {
    console.error('Update schedule error:', error);
    
    if (error.message.includes('conflicting schedule')) {
      return res.status(400).json({
        success: false,
        error: error.message
      });
    }

    res.status(500).json({
      success: false,
      error: 'Server error while updating schedule'
    });
  }
};

// @desc    Delete schedule
// @route   DELETE /api/schedules/:id
// @access  Private (School Admin)
const deleteSchedule = async (req, res) => {
  try {
    const { id } = req.params;
    const schoolId = req.user.schoolId;

    const schedule = await Schedule.findOne({ _id: id, schoolId });
    if (!schedule) {
      return res.status(404).json({
        success: false,
        error: 'Schedule not found'
      });
    }

    await Schedule.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: 'Schedule deleted successfully'
    });
  } catch (error) {
    console.error('Delete schedule error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while deleting schedule'
    });
  }
};

// @desc    Get schedule by ID
// @route   GET /api/schedules/:id
// @access  Private (School Admin, Teacher)
const getSchedule = async (req, res) => {
  try {
    const { id } = req.params;
    const schoolId = req.user.schoolId;

    const schedule = await Schedule.findOne({ _id: id, schoolId })
      .populate('teacherId', 'name email')
      .populate('classId', 'name section room')
      .populate('subjectId', 'name code');

    if (!schedule) {
      return res.status(404).json({
        success: false,
        error: 'Schedule not found'
      });
    }

    res.status(200).json({
      success: true,
      data: schedule
    });
  } catch (error) {
    console.error('Get schedule error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while fetching schedule'
    });
  }
};

module.exports = {
  getSchedules,
  getWeeklySchedule,
  getScheduleByTeacher,
  getScheduleByClass,
  getAvailableData,
  createSchedule,
  updateSchedule,
  deleteSchedule,
  getSchedule
};

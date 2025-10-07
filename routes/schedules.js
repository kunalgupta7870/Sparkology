const express = require('express');
const router = express.Router();
const {
  getSchedules,
  getWeeklySchedule,
  getScheduleByTeacher,
  getScheduleByClass,
  getAvailableData,
  createSchedule,
  updateSchedule,
  deleteSchedule,
  getSchedule
} = require('../controllers/scheduleController');
const { protect, authorize } = require('../middleware/auth');
const { body } = require('express-validator');

// Apply authentication to all routes
router.use(protect);

// @route   GET /api/schedules
// @desc    Get all schedules for a school (teachers see only their schedules)
// @access  Private (School Admin, Teacher)
router.get('/', authorize(['school_admin', 'teacher']), getSchedules);

// @route   GET /api/schedules/weekly
// @desc    Get weekly schedule view
// @access  Private (School Admin, Teacher)
router.get('/weekly', authorize(['school_admin', 'teacher']), getWeeklySchedule);

// @route   GET /api/schedules/available
// @desc    Get available teachers, classes, and subjects
// @access  Private (School Admin)
router.get('/available', authorize(['school_admin']), getAvailableData);

// @route   GET /api/schedules/teacher/:teacherId
// @desc    Get schedule by teacher
// @access  Private (School Admin, Teacher)
router.get('/teacher/:teacherId', authorize(['school_admin', 'teacher']), getScheduleByTeacher);

// @route   GET /api/schedules/class/:classId
// @desc    Get schedule by class
// @access  Private (School Admin, Teacher)
router.get('/class/:classId', authorize(['school_admin', 'teacher']), getScheduleByClass);

// @route   GET /api/schedules/:id
// @desc    Get schedule by ID
// @access  Private (School Admin, Teacher)
router.get('/:id', authorize(['school_admin', 'teacher']), getSchedule);

// @route   POST /api/schedules
// @desc    Create new schedule
// @access  Private (School Admin)
router.post('/', 
  authorize(['school_admin']),
  [
    body('teacherId')
      .notEmpty()
      .withMessage('Teacher ID is required')
      .isMongoId()
      .withMessage('Invalid teacher ID'),
    body('classId')
      .notEmpty()
      .withMessage('Class ID is required')
      .isMongoId()
      .withMessage('Invalid class ID'),
    body('subjectId')
      .notEmpty()
      .withMessage('Subject ID is required')
      .isMongoId()
      .withMessage('Invalid subject ID'),
    body('dayOfWeek')
      .notEmpty()
      .withMessage('Day of week is required')
      .isIn(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'])
      .withMessage('Invalid day of week'),
    body('startTime')
      .notEmpty()
      .withMessage('Start time is required')
      .matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
      .withMessage('Start time must be in HH:MM format'),
    body('endTime')
      .notEmpty()
      .withMessage('End time is required')
      .matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
      .withMessage('End time must be in HH:MM format'),
    body('academicYear')
      .optional()
      .isString()
      .withMessage('Academic year must be a string'),
    body('semester')
      .optional()
      .isIn(['1', '2', 'Annual'])
      .withMessage('Invalid semester'),
    body('room')
      .optional()
      .isString()
      .withMessage('Room must be a string'),
    body('notes')
      .optional()
      .isString()
      .withMessage('Notes must be a string')
  ],
  createSchedule
);

// @route   PUT /api/schedules/:id
// @desc    Update schedule
// @access  Private (School Admin)
router.put('/:id',
  authorize(['school_admin']),
  [
    body('teacherId')
      .optional()
      .isMongoId()
      .withMessage('Invalid teacher ID'),
    body('classId')
      .optional()
      .isMongoId()
      .withMessage('Invalid class ID'),
    body('subjectId')
      .optional()
      .isMongoId()
      .withMessage('Invalid subject ID'),
    body('dayOfWeek')
      .optional()
      .isIn(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'])
      .withMessage('Invalid day of week'),
    body('startTime')
      .optional()
      .matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
      .withMessage('Start time must be in HH:MM format'),
    body('endTime')
      .optional()
      .matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
      .withMessage('End time must be in HH:MM format'),
    body('academicYear')
      .optional()
      .isString()
      .withMessage('Academic year must be a string'),
    body('semester')
      .optional()
      .isIn(['1', '2', 'Annual'])
      .withMessage('Invalid semester'),
    body('room')
      .optional()
      .isString()
      .withMessage('Room must be a string'),
    body('notes')
      .optional()
      .isString()
      .withMessage('Notes must be a string')
  ],
  updateSchedule
);

// @route   DELETE /api/schedules/:id
// @desc    Delete schedule
// @access  Private (School Admin)
router.delete('/:id', authorize(['school_admin']), deleteSchedule);

module.exports = router;

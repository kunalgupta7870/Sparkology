const express = require('express');
const { protect, authorize } = require('../middleware/auth');
const {
  markAttendance,
  markBulkAttendance,
  getAttendance,
  getClassDateAttendance,
  getStudentAttendanceStats,
  getClassAttendanceStats,
  updateAttendance,
  deleteAttendance
} = require('../controllers/attendanceController');
const { body } = require('express-validator');

const router = express.Router();

// Apply authentication to all routes
router.use(protect);

// Validation middleware
const attendanceValidation = [
  body('studentId').isMongoId().withMessage('Valid student ID is required'),
  body('classId').isMongoId().withMessage('Valid class ID is required'),
  body('subjectId').isMongoId().withMessage('Valid subject ID is required'),
  body('date').isISO8601().withMessage('Valid date is required'),
  body('status').isIn(['present', 'absent', 'late', 'excused']).withMessage('Valid status is required'),
  body('remarks').optional().isLength({ max: 500 }).withMessage('Remarks must be less than 500 characters')
];

const bulkAttendanceValidation = [
  body('attendanceRecords').isArray().withMessage('Attendance records array is required'),
  body('attendanceRecords.*.studentId').isMongoId().withMessage('Valid student ID is required'),
  body('attendanceRecords.*.classId').isMongoId().withMessage('Valid class ID is required'),
  body('attendanceRecords.*.subjectId').isMongoId().withMessage('Valid subject ID is required'),
  body('attendanceRecords.*.date').isISO8601().withMessage('Valid date is required'),
  body('attendanceRecords.*.status').isIn(['present', 'absent', 'late', 'excused']).withMessage('Valid status is required'),
  body('attendanceRecords.*.remarks').optional().isLength({ max: 500 }).withMessage('Remarks must be less than 500 characters')
];

// @route   POST /api/attendance
// @desc    Mark attendance for a single student
// @access  Private (Teacher, School Admin)
router.post('/', authorize('teacher', 'school_admin'), attendanceValidation, markAttendance);

// @route   POST /api/attendance/bulk
// @desc    Mark attendance for multiple students
// @access  Private (Teacher, School Admin)
router.post('/bulk', authorize('teacher', 'school_admin'), bulkAttendanceValidation, markBulkAttendance);

// @route   GET /api/attendance
// @desc    Get attendance for a class and date
// @access  Private (Teacher, School Admin)
router.get('/', authorize('teacher', 'school_admin'), getAttendance);

// @route   GET /api/attendance/class-date
// @desc    Get attendance for a class and date (all subjects)
// @access  Private (Teacher, School Admin)
router.get('/class-date', authorize('teacher', 'school_admin'), getClassDateAttendance);

// @route   GET /api/attendance/student/:studentId
// @desc    Get attendance statistics for a student
// @access  Private (Teacher, School Admin, Parent)
router.get('/student/:studentId', authorize('teacher', 'school_admin', 'parent'), getStudentAttendanceStats);

// @route   GET /api/attendance/class/:classId
// @desc    Get attendance statistics for a class
// @access  Private (Teacher, School Admin)
router.get('/class/:classId', authorize('teacher', 'school_admin'), getClassAttendanceStats);

// @route   PUT /api/attendance/:id
// @desc    Update attendance record
// @access  Private (Teacher, School Admin)
router.put('/:id', authorize('teacher', 'school_admin'), updateAttendance);

// @route   DELETE /api/attendance/:id
// @desc    Delete attendance record
// @access  Private (School Admin)
router.delete('/:id', authorize('school_admin'), deleteAttendance);

module.exports = router;

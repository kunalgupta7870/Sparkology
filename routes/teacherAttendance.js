const express = require('express');
const { protect, authorize } = require('../middleware/auth');
const {
  markTeacherAttendance,
  markBulkTeacherAttendance,
  getTeacherAttendance,
  getTeacherAttendanceStats,
  getTeacherAttendanceByRange,
  updateTeacherAttendance,
  deleteTeacherAttendance
} = require('../controllers/teacherAttendanceController');
const { body } = require('express-validator');

const router = express.Router();

// Apply authentication to all routes
router.use(protect);

// Validation middleware
const teacherAttendanceValidation = [
  body('teacherId').isMongoId().withMessage('Valid teacher ID is required'),
  body('date').isISO8601().withMessage('Valid date is required'),
  body('status').isIn(['present', 'absent', 'late', 'half-day', 'excused']).withMessage('Valid status is required'),
  body('checkInTime').optional().isISO8601().withMessage('Valid check-in time is required'),
  body('checkOutTime').optional().isISO8601().withMessage('Valid check-out time is required'),
  body('remarks').optional().isLength({ max: 500 }).withMessage('Remarks must be less than 500 characters')
];

const bulkTeacherAttendanceValidation = [
  body('attendanceRecords').isArray().withMessage('Attendance records array is required'),
  body('attendanceRecords.*.teacherId').isMongoId().withMessage('Valid teacher ID is required'),
  body('attendanceRecords.*.date').isISO8601().withMessage('Valid date is required'),
  body('attendanceRecords.*.status').isIn(['present', 'absent', 'late', 'half-day', 'excused']).withMessage('Valid status is required'),
  body('attendanceRecords.*.checkInTime').optional().isISO8601().withMessage('Valid check-in time is required'),
  body('attendanceRecords.*.checkOutTime').optional().isISO8601().withMessage('Valid check-out time is required'),
  body('attendanceRecords.*.remarks').optional().isLength({ max: 500 }).withMessage('Remarks must be less than 500 characters')
];

// @route   POST /api/teacher-attendance
// @desc    Mark attendance for a single teacher
// @access  Private (School Admin)
router.post('/', authorize('school_admin'), teacherAttendanceValidation, markTeacherAttendance);

// @route   POST /api/teacher-attendance/bulk
// @desc    Mark attendance for multiple teachers
// @access  Private (School Admin)
router.post('/bulk', authorize('school_admin'), bulkTeacherAttendanceValidation, markBulkTeacherAttendance);

// @route   GET /api/teacher-attendance
// @desc    Get teacher attendance for a specific date
// @access  Private (School Admin)
router.get('/', authorize('school_admin'), getTeacherAttendance);

// @route   GET /api/teacher-attendance/stats
// @desc    Get teacher attendance statistics
// @access  Private (School Admin)
router.get('/stats', authorize('school_admin'), getTeacherAttendanceStats);

// @route   GET /api/teacher-attendance/range
// @desc    Get teacher attendance by date range
// @access  Private (School Admin)
router.get('/range', authorize('school_admin'), getTeacherAttendanceByRange);

// @route   PUT /api/teacher-attendance/:id
// @desc    Update teacher attendance record
// @access  Private (School Admin)
router.put('/:id', authorize('school_admin'), updateTeacherAttendance);

// @route   DELETE /api/teacher-attendance/:id
// @desc    Delete teacher attendance record
// @access  Private (School Admin)
router.delete('/:id', authorize('school_admin'), deleteTeacherAttendance);

module.exports = router;

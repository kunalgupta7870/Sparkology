const express = require('express');
const { protect, authorize } = require('../middleware/auth');
const {
  getStudents,
  getStudent,
  createStudent,
  updateStudent,
  deleteStudent,
  studentLogin,
  parentLogin,
  getClassContacts,
  getStudentStats,
  assignStudentToClass,
  removeStudentFromClass,
  getStudentProfile,
  getStudentClasses,
  getStudentSchedule,
  getStudentAssignments,
  getStudentNotes,
  getStudentAttendance,
  getStudentPerformance,
  getStudentPerformanceReport,
  getStudentExamMarks
} = require('../controllers/studentController');
const {
  studentValidation,
  studentUpdateValidation,
  loginValidation
} = require('../middleware/studentValidation');

const router = express.Router();

// Public routes (no authentication required)
router.post('/login', loginValidation, studentLogin);
router.post('/parents/login', loginValidation, parentLogin);

// Protected routes (authentication required)
router.use(protect);

// Student-specific routes (for students themselves)
router.get('/profile', authorize('student'), getStudentProfile);
router.get('/classes', authorize('student'), getStudentClasses);
router.get('/schedule', authorize('student'), getStudentSchedule);
router.get('/assignments', authorize('student'), getStudentAssignments);
router.get('/notes', authorize('student'), getStudentNotes);
router.get('/attendance', authorize('student'), getStudentAttendance);
router.get('/exam-marks', authorize('student'), getStudentExamMarks);
router.get('/class-contacts', authorize('student'), getClassContacts);

// Student management routes (School Admin, Teachers, and Librarians for library operations)
router.get('/', authorize('school_admin', 'teacher', 'librarian'), getStudents);
router.get('/stats', authorize('school_admin'), getStudentStats);
router.get('/performance-report', authorize('school_admin', 'teacher'), getStudentPerformanceReport);
router.get('/:id', authorize('school_admin', 'teacher', 'parent'), getStudent);
router.get('/:id/performance', authorize('school_admin', 'teacher', 'parent'), getStudentPerformance);
router.post('/', authorize('school_admin'), studentValidation, createStudent);
router.put('/:id', authorize('school_admin'), studentUpdateValidation, updateStudent);
router.put('/:id/assign-class', authorize('school_admin'), assignStudentToClass);
router.put('/:id/remove-class', authorize('school_admin'), removeStudentFromClass);
router.delete('/:id', authorize('school_admin'), deleteStudent);

module.exports = router;

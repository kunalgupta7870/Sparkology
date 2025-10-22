const express = require('express');
const router = express.Router();
const {
  getMeetings,
  getMeeting,
  createMeeting,
  updateMeeting,
  deleteMeeting,
  getTeacherClasses,
  getUpcomingMeetings,
  getPastMeetings,
  getStudentMeetings,
  getStudentMeeting,
  getStudentTodayMeetings
} = require('../controllers/meetingController');
const { protect, authorize } = require('../middleware/auth');

// Protect all routes
router.use(protect);

// Student-specific routes
router.get('/student/today', authorize('student', 'parent', 'admin'), getStudentTodayMeetings);
router.get('/student/:id', authorize('student', 'parent', 'admin'), getStudentMeeting);
router.get('/student', authorize('student', 'parent', 'admin'), getStudentMeetings);

// Teacher-specific routes
router.get('/teacher/classes', authorize('teacher', 'admin'), getTeacherClasses);
router.get('/upcoming', authorize('teacher', 'admin', 'school_admin'), getUpcomingMeetings);
router.get('/past', authorize('teacher', 'admin', 'school_admin'), getPastMeetings);

// Main CRUD routes (Teachers and School Admins)
router.route('/')
  .get(authorize('teacher', 'admin', 'school_admin'), getMeetings)
  .post(authorize('teacher', 'admin'), createMeeting);

router.route('/:id')
  .get(authorize('teacher', 'admin', 'school_admin'), getMeeting)
  .put(authorize('teacher', 'admin'), updateMeeting)
  .delete(authorize('teacher', 'admin'), deleteMeeting);

module.exports = router;


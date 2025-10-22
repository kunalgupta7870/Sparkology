const express = require('express');
const { protect, authorize } = require('../middleware/auth');
const {
  getParentProfile,
  getParentChildren,
  getChildProfile,
  getChildSchedule,
  getChildAttendance,
  getChildAssignments,
  getChildTeachers,
  getAllParents
} = require('../controllers/parentController');

const router = express.Router();

// All routes are protected
router.use(protect);

// School admin routes
router.get('/', authorize('school_admin'), getAllParents);

// Parent-specific routes
router.get('/profile', authorize('parent'), getParentProfile);
router.get('/children', authorize('parent'), getParentChildren);
router.get('/children/:childId', authorize('parent'), getChildProfile);
router.get('/children/:childId/schedule', authorize('parent'), getChildSchedule);
router.get('/children/:childId/attendance', authorize('parent'), getChildAttendance);
router.get('/children/:childId/assignments', authorize('parent'), getChildAssignments);
router.get('/children/:childId/teachers', authorize('parent'), getChildTeachers);

module.exports = router;

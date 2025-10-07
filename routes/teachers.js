const express = require('express');
const { body } = require('express-validator');
const {
  getTeachers,
  getTeacherById,
  createTeacher,
  updateTeacher,
  deleteTeacher,
  getTeacherProfile,
  getTeacherStats
} = require('../controllers/teacherController');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

// All routes are protected
router.use(protect);

// Routes - Teachers can access their own profile (must come before /:id route)
router.get('/profile', authorize('teacher'), getTeacherProfile);

// Routes - School Admin only
router.get('/', authorize('school_admin'), getTeachers);
router.get('/stats', authorize('school_admin'), getTeacherStats);
router.get('/:id', authorize('school_admin'), getTeacherById);
router.post('/', authorize('school_admin'), createTeacher);
router.put('/:id', authorize('school_admin'), updateTeacher);
router.delete('/:id', authorize('school_admin'), deleteTeacher);

module.exports = router;

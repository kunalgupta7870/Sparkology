const express = require('express');
const { protect, authorize } = require('../middleware/auth');
const {
  getSubjects,
  getSubject,
  createSubject,
  updateSubject,
  deleteSubject,
  assignSubjectTeacher
} = require('../controllers/subjectController');

const router = express.Router();

// All routes are protected
router.use(protect);

// Routes - School Admin only
router.get('/', authorize('school_admin'), getSubjects);
router.get('/:id', authorize('school_admin'), getSubject);
router.post('/', authorize('school_admin'), createSubject);
router.put('/:id', authorize('school_admin'), updateSubject);
router.put('/:id/assign-teacher', authorize('school_admin'), assignSubjectTeacher);
router.delete('/:id', authorize('school_admin'), deleteSubject);

module.exports = router;
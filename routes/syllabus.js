const express = require('express');
const { protect, authorize } = require('../middleware/auth');
const {
  getSyllabus,
  getSyllabusById,
  createSyllabus,
  updateSyllabus,
  deleteSyllabus,
  getSyllabusByClassAndSubject,
  getTeacherSyllabus
} = require('../controllers/syllabusController');

const router = express.Router();

// All routes are protected
router.use(protect);

// Routes - Teachers can access their own syllabus
router.get('/teacher', authorize('teacher'), getTeacherSyllabus);

// Routes - School Admin only
router.get('/', authorize('school_admin'), getSyllabus);
router.get('/class/:classId/subject/:subjectId', authorize('school_admin'), getSyllabusByClassAndSubject);
router.get('/:id', authorize('school_admin', 'teacher'), getSyllabusById);
router.post('/', authorize('school_admin'), createSyllabus);
router.put('/:id', authorize('school_admin'), updateSyllabus);
router.delete('/:id', authorize('school_admin'), deleteSyllabus);

module.exports = router;


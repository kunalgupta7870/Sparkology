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
const { uploadSyllabusFiles, handleUploadError } = require('../utils/cloudinary');

const router = express.Router();

// All routes are protected
router.use(protect);

// Routes - Teachers can access their own syllabus
router.get('/teacher', authorize('teacher'), getTeacherSyllabus);

// Routes - School Admin only
router.get('/', authorize('school_admin'), getSyllabus);
router.get('/class/:classId/subject/:subjectId', authorize('school_admin'), getSyllabusByClassAndSubject);
router.get('/:id', authorize('school_admin', 'teacher'), getSyllabusById);

// Create syllabus - supports both JSON and FormData with file uploads
router.post('/', 
  authorize('school_admin'), 
  uploadSyllabusFiles.array('files', 10), 
  handleUploadError, 
  createSyllabus
);

// Update syllabus - supports both JSON and FormData with file uploads
router.put('/:id', 
  authorize('school_admin'), 
  uploadSyllabusFiles.array('files', 10), 
  handleUploadError, 
  updateSyllabus
);

router.delete('/:id', authorize('school_admin'), deleteSyllabus);

module.exports = router;


const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const {
  getDoubts,
  getDoubt,
  createDoubt,
  createAdminDoubt,
  answerDoubt,
  toggleBookmark,
  markHelpful,
  getMyDoubts,
  getSavedDoubts,
  deleteDoubt,
  getSubjectCoursesForDoubt
} = require('../controllers/doubtController');
const { protect } = require('../middleware/auth');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/documents/');
  },
  filename: function (req, file, cb) {
    cb(null, `doubt-${Date.now()}${path.extname(file.originalname)}`);
  }
});

const fileFilter = (req, file, cb) => {
  // Accept documents only
  const allowedTypes = /pdf|doc|docx|txt|jpg|jpeg|png/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);
  
  if (mimetype && extname) {
    return cb(null, true);
  } else {
    cb(new Error('Only document files (PDF, DOC, DOCX, TXT) and images (JPG, PNG) are allowed'));
  }
};

const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: fileFilter
});

// Public routes (with authentication)
router.get('/subject-courses', protect, getSubjectCoursesForDoubt);
router.get('/my-doubts', protect, getMyDoubts);
router.get('/saved', protect, getSavedDoubts);
router.get('/', protect, getDoubts);
router.get('/:id', protect, getDoubt);
router.post('/', protect, upload.single('document'), createDoubt);
router.post('/admin-create', protect, upload.single('document'), createAdminDoubt);
router.put('/:id/answer', protect, answerDoubt);
router.put('/:id/bookmark', protect, toggleBookmark);
router.put('/:id/helpful', protect, markHelpful);
router.delete('/:id', protect, deleteDoubt);

module.exports = router;


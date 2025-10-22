const express = require('express');
const router = express.Router();
const {
  getSubjectCourses,
  getStudentSubjectCourses,
  getSubjectCourse,
  createSubjectCourse,
  updateSubjectCourse,
  deleteSubjectCourse,
  uploadVideoToSubjectCourse,
  deleteVideoFromSubjectCourse,
  updateVideoOrder,
  getSubjectCourseVideos,
  uploadNoteToSubjectCourse,
  deleteNoteFromSubjectCourse,
  addQuizQuestion,
  updateQuizQuestion,
  deleteQuizQuestion,
  uploadSubjectCourseThumbnail,
  updateQuizMetadata,
  addBulkQuizQuestions,
  getQuizMetadata,
  submitQuizAttempt,
  checkQuizCompletion,
  addQuizToCourse,
  getCourseQuizzes,
  getQuizDetails
} = require('../controllers/subjectCourseController');
const {
  getSubjectCourseProgress,
  markVideoComplete,
  saveVideoPosition,
  getVideoPosition,
  getCompletedSubjectCourses
} = require('../controllers/subjectCourseProgressController');
const { protect, authorize } = require('../middleware/auth');
const { uploadVideo: uploadVideoMiddleware, uploadDocument, uploadPhoto, handleUploadError } = require('../utils/cloudinary');
const { body, param } = require('express-validator');

// Validation middleware
const validateSubjectCourse = [
  body('title')
    .trim()
    .notEmpty()
    .withMessage('Course title is required')
    .isLength({ max: 200 })
    .withMessage('Course title cannot exceed 200 characters'),
  body('description')
    .trim()
    .notEmpty()
    .withMessage('Course description is required')
    .isLength({ max: 1000 })
    .withMessage('Description cannot exceed 1000 characters'),
  body('subjectName')
    .notEmpty()
    .withMessage('Subject name is required')
    .trim()
    .isLength({ max: 100 })
    .withMessage('Subject name cannot exceed 100 characters'),
  body('className')
    .notEmpty()
    .withMessage('Class name is required')
    .trim()
    .isLength({ max: 100 })
    .withMessage('Class name cannot exceed 100 characters')
];

const validateSubjectCourseUpdate = [
  body('title')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('Course title cannot exceed 200 characters'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Description cannot exceed 1000 characters'),
  body('subjectName')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Subject name cannot exceed 100 characters'),
  body('className')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Class name cannot exceed 100 characters')
];

const validateVideoUpload = [
  body('title')
    .trim()
    .notEmpty()
    .withMessage('Video title is required')
    .isLength({ max: 200 })
    .withMessage('Video title cannot exceed 200 characters'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Video description cannot exceed 1000 characters'),
  body('order')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Order must be a positive integer')
];

const validateVideoOrder = [
  body('order')
    .isInt({ min: 1 })
    .withMessage('Order must be a positive integer')
];

const validateCourseId = [
  param('id')
    .isMongoId()
    .withMessage('Invalid course ID')
];

const validateVideoId = [
  param('videoId')
    .isMongoId()
    .withMessage('Invalid video ID')
];

// All routes require authentication
router.use(protect);

// @route   GET /api/subject-courses/student/my-courses
// @desc    Get subject courses for logged-in student (filtered by their class)
// @access  Private (Student)
router.get('/student/my-courses', authorize(['student']), getStudentSubjectCourses);

// @route   GET /api/subject-courses
// @desc    Get all subject courses
// @access  Private (Admin)
router.get('/', authorize(['admin']), getSubjectCourses);

// @route   GET /api/subject-courses/:id
// @desc    Get subject course by ID
// @access  Private (Admin, Student)
router.get('/:id',
  authorize(['admin', 'student']),
  validateCourseId,
  getSubjectCourse
);

// @route   POST /api/subject-courses
// @desc    Create subject course
// @access  Private (Admin)
router.post('/',
  authorize(['admin']),
  validateSubjectCourse,
  createSubjectCourse
);

// @route   PUT /api/subject-courses/:id
// @desc    Update subject course
// @access  Private (Admin)
router.put('/:id',
  authorize(['admin']),
  validateCourseId,
  validateSubjectCourseUpdate,
  updateSubjectCourse
);

// @route   DELETE /api/subject-courses/:id
// @desc    Delete subject course
// @access  Private (Admin)
router.delete('/:id',
  authorize(['admin']),
  validateCourseId,
  deleteSubjectCourse
);

// Video upload routes
// @route   POST /api/subject-courses/:id/videos/upload
// @desc    Upload video to subject course
// @access  Private (Admin)
router.post('/:id/videos/upload',
  authorize(['admin']),
  validateCourseId,
  uploadVideoMiddleware.single('file'),
  handleUploadError,
  uploadVideoToSubjectCourse
);

// @route   DELETE /api/subject-courses/:courseId/videos/:videoId
// @desc    Delete video from subject course
// @access  Private (Admin)
router.delete('/:courseId/videos/:videoId',
  authorize(['admin']),
  validateCourseId,
  validateVideoId,
  deleteVideoFromSubjectCourse
);

// @route   PUT /api/subject-courses/:courseId/videos/:videoId/order
// @desc    Update video order
// @access  Private (Admin)
router.put('/:courseId/videos/:videoId/order',
  authorize(['admin']),
  validateCourseId,
  validateVideoId,
  validateVideoOrder,
  updateVideoOrder
);

// @route   GET /api/subject-courses/:id/videos
// @desc    Get all subject course videos
// @access  Private
router.get('/:id/videos',
  authorize(['admin', 'student', 'teacher', 'school_admin']),
  validateCourseId,
  getSubjectCourseVideos
);

// @route   POST /api/subject-courses/:id/notes/upload
// @desc    Upload note (PDF) to subject course
// @access  Private (Admin)
router.post('/:id/notes/upload',
  authorize(['admin']),
  validateCourseId,
  uploadDocument.single('file'),
  handleUploadError,
  uploadNoteToSubjectCourse
);

// @route   DELETE /api/subject-courses/:courseId/notes/:noteId
// @desc    Delete note from subject course
// @access  Private (Admin)
router.delete('/:courseId/notes/:noteId',
  authorize(['admin']),
  deleteNoteFromSubjectCourse
);

// @route   POST /api/subject-courses/:id/quiz
// @desc    Add quiz question to subject course
// @access  Private (Admin)
router.post('/:id/quiz',
  authorize(['admin']),
  validateCourseId,
  addQuizQuestion
);

// @route   POST /api/subject-courses/:id/quiz/bulk
// @desc    Add multiple quiz questions at once
// @access  Private (Admin)
router.post('/:id/quiz/bulk',
  authorize(['admin']),
  validateCourseId,
  addBulkQuizQuestions
);

// @route   PUT /api/subject-courses/:id/quiz/metadata
// @desc    Update quiz metadata (title, time limit, etc.)
// @access  Private (Admin)
router.put('/:id/quiz/metadata',
  authorize(['admin']),
  validateCourseId,
  updateQuizMetadata
);

// @route   GET /api/subject-courses/:id/quiz/metadata
// @desc    Get quiz metadata
// @access  Private
router.get('/:id/quiz/metadata',
  authorize(['admin', 'student', 'teacher']),
  validateCourseId,
  getQuizMetadata
);

// @route   POST /api/subject-courses/:id/quiz/submit
// @desc    Submit quiz attempt
// @access  Private (Student)
router.post('/:id/quiz/submit',
  authorize(['student']),
  validateCourseId,
  submitQuizAttempt
);

// @route   GET /api/subject-courses/:id/quiz/check-completion
// @desc    Check if student has completed quiz
// @access  Private (Student)
router.get('/:id/quiz/check-completion',
  authorize(['student']),
  validateCourseId,
  checkQuizCompletion
);

// @route   PUT /api/subject-courses/:courseId/quiz/:questionId
// @desc    Update quiz question
// @access  Private (Admin)
router.put('/:courseId/quiz/:questionId',
  authorize(['admin']),
  updateQuizQuestion
);

// @route   DELETE /api/subject-courses/:courseId/quiz/:questionId
// @desc    Delete quiz question
// @access  Private (Admin)
router.delete('/:courseId/quiz/:questionId',
  authorize(['admin']),
  deleteQuizQuestion
);

// @route   POST /api/subject-courses/:id/thumbnail
// @desc    Upload thumbnail to subject course
// @access  Private (Admin)
router.post('/:id/thumbnail',
  authorize(['admin']),
  validateCourseId,
  uploadPhoto.single('file'),
  handleUploadError,
  uploadSubjectCourseThumbnail
);

// New Quiz Routes
// @route   POST /api/subject-courses/:id/quizzes
// @desc    Add a complete quiz to subject course
// @access  Private (Admin)
router.post('/:id/quizzes',
  authorize(['admin']),
  validateCourseId,
  addQuizToCourse
);

// @route   GET /api/subject-courses/:id/quizzes
// @desc    Get all quizzes for a course
// @access  Private
router.get('/:id/quizzes',
  authorize(['admin', 'student', 'teacher']),
  validateCourseId,
  getCourseQuizzes
);

// @route   GET /api/subject-courses/:courseId/quizzes/:quizId
// @desc    Get specific quiz details
// @access  Private
router.get('/:courseId/quizzes/:quizId',
  authorize(['admin', 'student', 'teacher']),
  getQuizDetails
);

// @route   POST /api/subject-courses/:courseId/quizzes/:quizId/submit
// @desc    Submit quiz attempt
// @access  Private (Student)
router.post('/:courseId/quizzes/:quizId/submit',
  authorize(['student']),
  submitQuizAttempt
);

// ============================================
// SUBJECT COURSE PROGRESS ROUTES
// ============================================

// @route   GET /api/subject-courses/:subjectCourseId/progress
// @desc    Get subject course progress for current user
// @access  Private
router.get('/:subjectCourseId/progress',
  authorize(['student', 'parent', 'teacher']),
  getSubjectCourseProgress
);

// @route   POST /api/subject-courses/:subjectCourseId/progress/video/:videoId
// @desc    Mark video as completed
// @access  Private
router.post('/:subjectCourseId/progress/video/:videoId',
  authorize(['student', 'parent', 'teacher']),
  markVideoComplete
);

// @route   POST /api/subject-courses/:subjectCourseId/progress/video/:videoId/position
// @desc    Save video position
// @access  Private
router.post('/:subjectCourseId/progress/video/:videoId/position',
  authorize(['student', 'parent', 'teacher']),
  saveVideoPosition
);

// @route   GET /api/subject-courses/:subjectCourseId/progress/video/:videoId/position
// @desc    Get video position
// @access  Private
router.get('/:subjectCourseId/progress/video/:videoId/position',
  authorize(['student', 'parent', 'teacher']),
  getVideoPosition
);

// @route   GET /api/subject-courses/progress/completed
// @desc    Get all completed subject courses for current user
// @access  Private
router.get('/progress/completed',
  authorize(['student', 'parent', 'teacher']),
  getCompletedSubjectCourses
);

module.exports = router;


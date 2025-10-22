const express = require('express');
const router = express.Router();
const {
  getCourses,
  getCourse,
  createCourse,
  updateCourse,
  deleteCourse,
  uploadVideoToCourse,
  deleteVideoFromCourse,
  updateVideoOrder,
  getCoursePreview,
  getCourseVideos,
  uploadNoteToCourse,
  deleteNoteFromCourse,
  addQuizQuestion,
  updateQuizQuestion,
  deleteQuizQuestion,
  uploadCourseThumbnail,
  addQuizToCourse,
  getCourseQuizzes,
  getCourseQuizDetails,
  updateCourseQuiz,
  deleteCourseQuiz
} = require('../controllers/courseController');
const {
  getCourseProgress,
  markVideoComplete,
  saveVideoPosition,
  getVideoPosition,
  getCompletedCourses
} = require('../controllers/courseProgressController');
const {
  getCourseReviews,
  createCourseReview,
  updateCourseReview,
  deleteCourseReview,
  markReviewHelpful
} = require('../controllers/courseReviewController');
const {
  hasPurchasedCourse,
  getMyPurchasedCourses
} = require('../controllers/coursePurchaseController');
const { protect, authorize } = require('../middleware/auth');
const { uploadVideo: uploadVideoMiddleware, uploadDocument, uploadPhoto, handleUploadError } = require('../utils/cloudinary');
const { body, param } = require('express-validator');

// Validation middleware
const validateCourse = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Course name is required')
    .isLength({ max: 200 })
    .withMessage('Course name cannot exceed 200 characters'),
  body('description')
    .trim()
    .notEmpty()
    .withMessage('Course description is required')
    .isLength({ max: 1000 })
    .withMessage('Description cannot exceed 1000 characters'),
  body('instructor')
    .trim()
    .notEmpty()
    .withMessage('Instructor name is required')
    .isLength({ max: 100 })
    .withMessage('Instructor name cannot exceed 100 characters'),
  body('duration')
    .trim()
    .notEmpty()
    .withMessage('Course duration is required')
    .isLength({ max: 50 })
    .withMessage('Duration cannot exceed 50 characters'),
  body('status')
    .optional()
    .isIn(['active', 'draft', 'completed', 'cancelled'])
    .withMessage('Invalid status'),
  body('students')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Student count must be a non-negative integer'),
  body('category')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Category cannot exceed 100 characters'),
  body('level')
    .optional()
    .isIn(['beginner', 'intermediate', 'advanced'])
    .withMessage('Invalid level'),
  body('price')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Price must be a non-negative number'),
  body('maxStudents')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Maximum students must be at least 1')
];

const validateCourseUpdate = [
  body('name')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('Course name cannot exceed 200 characters'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Description cannot exceed 1000 characters'),
  body('instructor')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Instructor name cannot exceed 100 characters'),
  body('duration')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('Duration cannot exceed 50 characters'),
  body('status')
    .optional()
    .isIn(['active', 'draft', 'completed', 'cancelled'])
    .withMessage('Invalid status'),
  body('students')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Student count must be a non-negative integer'),
  body('category')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Category cannot exceed 100 characters'),
  body('level')
    .optional()
    .isIn(['beginner', 'intermediate', 'advanced'])
    .withMessage('Invalid level'),
  body('price')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Price must be a non-negative number'),
  body('maxStudents')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Maximum students must be at least 1')
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

// @route   GET /api/courses
// @desc    Get all courses
// @access  Private (Admin, Students, Teachers, Parents)
router.get('/', authorize(['admin', 'student', 'teacher', 'parent', 'school_admin']), getCourses);

// @route   GET /api/courses/:id
// @desc    Get course by ID
// @access  Private (Admin, Students, Teachers, Parents)
router.get('/:id',
  authorize(['admin', 'student', 'teacher', 'parent', 'school_admin']),
  validateCourseId,
  getCourse
);

// @route   POST /api/courses
// @desc    Create course
// @access  Private (Admin)
router.post('/',
  authorize(['admin']),
  validateCourse,
  createCourse
);

// @route   PUT /api/courses/:id
// @desc    Update course
// @access  Private (Admin)
router.put('/:id',
  authorize(['admin']),
  validateCourseId,
  validateCourseUpdate,
  updateCourse
);

// @route   DELETE /api/courses/:id
// @desc    Delete course
// @access  Private (Admin)
router.delete('/:id',
  authorize(['admin']),
  validateCourseId,
  deleteCourse
);

// Video upload routes
// @route   POST /api/courses/:id/videos/upload
// @desc    Upload video to course
// @access  Private (Admin)
router.post('/:id/videos/upload',
  authorize(['admin']),
  validateCourseId,
  uploadVideoMiddleware.single('file'),
  // validateVideoUpload, // Temporarily disabled
  handleUploadError,
  uploadVideoToCourse
);

// @route   DELETE /api/courses/:courseId/videos/:videoId
// @desc    Delete video from course
// @access  Private (Admin)
router.delete('/:courseId/videos/:videoId',
  authorize(['admin']),
  validateCourseId,
  validateVideoId,
  deleteVideoFromCourse
);

// @route   PUT /api/courses/:courseId/videos/:videoId/order
// @desc    Update video order
// @access  Private (Admin)
router.put('/:courseId/videos/:videoId/order',
  authorize(['admin']),
  validateCourseId,
  validateVideoId,
  validateVideoOrder,
  updateVideoOrder
);

// @route   GET /api/courses/:id/preview
// @desc    Get course preview (course info + preview video only)
// @access  Public/Private
router.get('/:id/preview',
  validateCourseId,
  getCoursePreview
);

// @route   GET /api/courses/:id/videos
// @desc    Get all course videos (requires purchase for paid courses)
// @access  Private
router.get('/:id/videos',
  authorize(['admin', 'student', 'teacher', 'school_admin']),
  validateCourseId,
  getCourseVideos
);

// @route   POST /api/courses/:id/notes/upload
// @desc    Upload note (PDF) to course
// @access  Private (Admin)
router.post('/:id/notes/upload',
  authorize(['admin']),
  validateCourseId,
  uploadDocument.single('file'),
  handleUploadError,
  uploadNoteToCourse
);

// @route   DELETE /api/courses/:courseId/notes/:noteId
// @desc    Delete note from course
// @access  Private (Admin)
router.delete('/:courseId/notes/:noteId',
  authorize(['admin']),
  deleteNoteFromCourse
);

// @route   POST /api/courses/:id/quiz
// @desc    Add quiz question to course
// @access  Private (Admin)
router.post('/:id/quiz',
  authorize(['admin']),
  validateCourseId,
  addQuizQuestion
);

// @route   PUT /api/courses/:courseId/quiz/:questionId
// @desc    Update quiz question
// @access  Private (Admin)
router.put('/:courseId/quiz/:questionId',
  authorize(['admin']),
  updateQuizQuestion
);

// @route   DELETE /api/courses/:courseId/quiz/:questionId
// @desc    Delete quiz question
// @access  Private (Admin)
router.delete('/:courseId/quiz/:questionId',
  authorize(['admin']),
  deleteQuizQuestion
);

// @route   POST /api/courses/:id/thumbnail
// @desc    Upload thumbnail to course
// @access  Private (Admin)
router.post('/:id/thumbnail',
  authorize(['admin']),
  validateCourseId,
  uploadPhoto.single('file'),
  handleUploadError,
  uploadCourseThumbnail
);

// ============================================
// NAMED QUIZZES ROUTES (NEW STRUCTURE)
// ============================================

// @route   POST /api/courses/:id/quizzes
// @desc    Add a complete quiz with multiple questions
// @access  Private (Admin)
router.post('/:id/quizzes',
  authorize(['admin']),
  validateCourseId,
  addQuizToCourse
);

// @route   GET /api/courses/:id/quizzes
// @desc    Get all quizzes for a course
// @access  Private
router.get('/:id/quizzes',
  authorize(['admin', 'student', 'teacher', 'parent', 'school_admin']),
  validateCourseId,
  getCourseQuizzes
);

// @route   GET /api/courses/:courseId/quizzes/:quizId
// @desc    Get specific quiz details
// @access  Private
router.get('/:courseId/quizzes/:quizId',
  authorize(['admin', 'student', 'teacher', 'parent', 'school_admin']),
  getCourseQuizDetails
);

// @route   PUT /api/courses/:courseId/quizzes/:quizId
// @desc    Update a quiz
// @access  Private (Admin)
router.put('/:courseId/quizzes/:quizId',
  authorize(['admin']),
  updateCourseQuiz
);

// @route   DELETE /api/courses/:courseId/quizzes/:quizId
// @desc    Delete a quiz
// @access  Private (Admin)
router.delete('/:courseId/quizzes/:quizId',
  authorize(['admin']),
  deleteCourseQuiz
);

// ============================================
// COURSE PURCHASE ROUTES
// ============================================

// @route   GET /api/courses/purchases/my-courses
// @desc    Get all purchased courses for current user
// @access  Private
router.get('/purchases/my-courses',
  authorize(['student', 'parent', 'teacher']),
  getMyPurchasedCourses
);

// ============================================
// COURSE PROGRESS ROUTES
// ============================================

// @route   GET /api/courses/progress/completed
// @desc    Get all completed courses for current user
// @access  Private
router.get('/progress/completed',
  authorize(['student', 'parent', 'teacher']),
  getCompletedCourses
);

// @route   GET /api/courses/:courseId/purchased
// @desc    Check if user has purchased a course
// @access  Private
router.get('/:courseId/purchased',
  authorize(['student', 'parent', 'teacher']),
  hasPurchasedCourse
);

// @route   GET /api/courses/:courseId/progress
// @desc    Get course progress for current user
// @access  Private
router.get('/:courseId/progress',
  authorize(['student', 'parent', 'teacher']),
  getCourseProgress
);

// @route   POST /api/courses/:courseId/progress/video/:videoId
// @desc    Mark video as completed
// @access  Private
router.post('/:courseId/progress/video/:videoId',
  authorize(['student', 'parent', 'teacher']),
  markVideoComplete
);

// @route   POST /api/courses/:courseId/progress/video/:videoId/position
// @desc    Save video position
// @access  Private
router.post('/:courseId/progress/video/:videoId/position',
  authorize(['student', 'parent', 'teacher']),
  saveVideoPosition
);

// @route   GET /api/courses/:courseId/progress/video/:videoId/position
// @desc    Get video position
// @access  Private
router.get('/:courseId/progress/video/:videoId/position',
  authorize(['student', 'parent', 'teacher']),
  getVideoPosition
);

// ============================================
// COURSE REVIEW ROUTES
// ============================================

// @route   GET /api/courses/:courseId/reviews
// @desc    Get reviews for a course
// @access  Public
router.get('/:courseId/reviews',
  getCourseReviews
);

// @route   POST /api/courses/:courseId/reviews
// @desc    Create a review for a course (must complete course first)
// @access  Private
router.post('/:courseId/reviews',
  authorize(['student', 'parent', 'teacher']),
  createCourseReview
);

// @route   PUT /api/courses/:courseId/reviews/:reviewId
// @desc    Update a review
// @access  Private (Own review only)
router.put('/:courseId/reviews/:reviewId',
  authorize(['student', 'parent', 'teacher']),
  updateCourseReview
);

// @route   DELETE /api/courses/:courseId/reviews/:reviewId
// @desc    Delete a review
// @access  Private (Own review or Admin)
router.delete('/:courseId/reviews/:reviewId',
  authorize(['student', 'parent', 'teacher', 'admin']),
  deleteCourseReview
);

// @route   POST /api/courses/:courseId/reviews/:reviewId/helpful
// @desc    Mark review as helpful
// @access  Private
router.post('/:courseId/reviews/:reviewId/helpful',
  authorize(['student', 'parent', 'teacher']),
  markReviewHelpful
);

module.exports = router;
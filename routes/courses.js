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
  updateVideoOrder
} = require('../controllers/courseController');
const { protect, authorize } = require('../middleware/auth');
const { uploadVideo: uploadVideoMiddleware, handleUploadError } = require('../utils/cloudinary');
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

module.exports = router;
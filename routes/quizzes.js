const express = require('express');
const { body } = require('express-validator');
const {
  getQuizzes,
  getQuiz,
  createQuiz,
  updateQuiz,
  deleteQuiz,
  startQuiz,
  submitQuiz,
  getMySubmissions,
  getQuizResults
} = require('../controllers/quizController');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

// Apply authentication to all routes
router.use(protect);

// Validation rules for quiz creation
const quizValidation = [
  body('name')
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage('Quiz name must be between 1 and 200 characters'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Description cannot exceed 1000 characters'),
  body('classId')
    .isMongoId()
    .withMessage('Valid class ID is required'),
  body('subjectId')
    .isMongoId()
    .withMessage('Valid subject ID is required'),
  body('questions')
    .isArray({ min: 1 })
    .withMessage('At least one question is required'),
  body('questions.*.questionText')
    .trim()
    .isLength({ min: 1 })
    .withMessage('Question text is required'),
  body('questions.*.questionType')
    .isIn(['multiple-choice', 'true-false', 'short-answer'])
    .withMessage('Invalid question type'),
  body('questions.*.marks')
    .isInt({ min: 0 })
    .withMessage('Marks must be a positive number'),
  body('duration')
    .isInt({ min: 1 })
    .withMessage('Duration must be at least 1 minute'),
  body('startDate')
    .isISO8601()
    .withMessage('Valid start date is required'),
  body('endDate')
    .isISO8601()
    .withMessage('Valid end date is required'),
  body('passingMarks')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Passing marks must be a positive number'),
  body('status')
    .optional()
    .isIn(['draft', 'active', 'completed', 'cancelled'])
    .withMessage('Invalid status')
];

// Validation rules for quiz update
const quizUpdateValidation = [
  body('name')
    .optional()
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage('Quiz name must be between 1 and 200 characters'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Description cannot exceed 1000 characters'),
  body('questions')
    .optional()
    .isArray({ min: 1 })
    .withMessage('At least one question is required'),
  body('duration')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Duration must be at least 1 minute'),
  body('startDate')
    .optional()
    .isISO8601()
    .withMessage('Valid start date is required'),
  body('endDate')
    .optional()
    .isISO8601()
    .withMessage('Valid end date is required'),
  body('passingMarks')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Passing marks must be a positive number'),
  body('status')
    .optional()
    .isIn(['draft', 'active', 'completed', 'cancelled'])
    .withMessage('Invalid status')
];

// Validation rules for quiz submission
const quizSubmissionValidation = [
  body('answers')
    .isArray({ min: 1 })
    .withMessage('Answers are required and must be an array'),
  body('answers.*.questionId')
    .isMongoId()
    .withMessage('Valid question ID is required'),
  body('answers.*.selectedAnswer')
    .trim()
    .notEmpty()
    .withMessage('Answer is required')
];

// Routes
// @route   GET /api/quizzes/my-submissions
// @desc    Get student's quiz submissions (MUST be before /:id route)
// @access  Private (Student)
router.get('/my-submissions', authorize(['student']), getMySubmissions);

// @route   GET /api/quizzes
// @desc    Get all quizzes for a teacher or class
// @access  Private (Teacher, School Admin)
router.get('/', authorize(['teacher', 'school_admin']), getQuizzes);

// @route   GET /api/quizzes/:id
// @desc    Get single quiz
// @access  Private (Teacher, School Admin, Student, Parent)
router.get('/:id', authorize(['teacher', 'school_admin', 'student', 'parent']), getQuiz);

// @route   GET /api/quizzes/:id/results
// @desc    Get quiz results and statistics
// @access  Private (Teacher, School Admin)
router.get('/:id/results', authorize(['teacher', 'school_admin']), getQuizResults);

// @route   POST /api/quizzes
// @desc    Create new quiz
// @access  Private (Teacher, School Admin)
router.post('/', 
  authorize(['teacher', 'school_admin']), 
  quizValidation,
  createQuiz
);

// @route   POST /api/quizzes/:id/start
// @desc    Start quiz (Student)
// @access  Private (Student)
router.post('/:id/start', authorize(['student']), startQuiz);

// @route   POST /api/quizzes/:id/submit
// @desc    Submit quiz with answers
// @access  Private (Student)
router.post('/:id/submit', 
  authorize(['student']), 
  quizSubmissionValidation,
  submitQuiz
);

// @route   PUT /api/quizzes/:id
// @desc    Update quiz
// @access  Private (Teacher, School Admin)
router.put('/:id', 
  authorize(['teacher', 'school_admin']), 
  quizUpdateValidation,
  updateQuiz
);

// @route   DELETE /api/quizzes/:id
// @desc    Delete quiz
// @access  Private (Teacher, School Admin)
router.delete('/:id', authorize(['teacher', 'school_admin']), deleteQuiz);

module.exports = router;







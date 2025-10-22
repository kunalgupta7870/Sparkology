const express = require('express');
const { body } = require('express-validator');
const {
  getAssignments,
  getAssignment,
  createAssignment,
  updateAssignment,
  deleteAssignment,
  getTeacherClasses,
  submitAssignment,
  getMySubmissions,
  getChildAssignments,
  getChildAssignmentSubmissions,
  uploadDocument,
  setSocketIO
} = require('../controllers/assignmentController');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

// Apply authentication to all routes
router.use(protect);

// Validation rules
const assignmentValidation = [
  body('title')
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage('Title must be between 1 and 200 characters'),
  body('description')
    .trim()
    .isLength({ min: 1, max: 2000 })
    .withMessage('Description must be between 1 and 2000 characters'),
  body('classId')
    .isMongoId()
    .withMessage('Valid class ID is required'),
  body('subjectId')
    .isMongoId()
    .withMessage('Valid subject ID is required'),
  body('dueDate')
    .isISO8601()
    .withMessage('Valid due date is required'),
  body('dueTime')
    .optional()
    .matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .withMessage('Due time must be in HH:MM format'),
  body('totalMarks')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Total marks must be a positive number'),
  body('attachments')
    .optional()
    .isArray()
    .withMessage('Attachments must be an array')
];

const assignmentUpdateValidation = [
  body('title')
    .optional()
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage('Title must be between 1 and 200 characters'),
  body('description')
    .optional()
    .trim()
    .isLength({ min: 1, max: 2000 })
    .withMessage('Description must be between 1 and 2000 characters'),
  body('dueDate')
    .optional()
    .isISO8601()
    .withMessage('Valid due date is required'),
  body('dueTime')
    .optional()
    .matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .withMessage('Due time must be in HH:MM format'),
  body('totalMarks')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Total marks must be a positive number'),
  body('points')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Points must be a positive number'),
  body('status')
    .optional()
    .isIn(['active', 'completed', 'cancelled'])
    .withMessage('Invalid status'),
  body('attachments')
    .optional()
    .isArray()
    .withMessage('Attachments must be an array')
];

// Routes
// @route   GET /api/assignments/teacher/classes
// @desc    Get all classes with subjects that teacher teaches
// @access  Private (Teacher)
router.get('/teacher/classes', authorize(['teacher']), getTeacherClasses);

// @route   GET /api/assignments
// @desc    Get all assignments for a teacher
// @access  Private (Teacher, School Admin)
router.get('/', authorize(['teacher', 'school_admin']), getAssignments);

// @route   GET /api/assignments/my-submissions
// @desc    Get student's assignment submissions (MUST be before /:id route)
// @access  Private (Student)
router.get('/my-submissions', authorize(['student']), getMySubmissions);

// @route   GET /api/assignments/child/:childId
// @desc    Get assignments for a specific child (Parent access)
// @access  Private (Parent)
router.get('/child/:childId', authorize(['parent']), getChildAssignments);

// @route   GET /api/assignments/child/:childId/submissions
// @desc    Get assignment submissions for a specific child (Parent access)
// @access  Private (Parent)
router.get('/child/:childId/submissions', authorize(['parent']), getChildAssignmentSubmissions);

// @route   GET /api/assignments/:id
// @desc    Get single assignment
// @access  Private (Teacher, School Admin, Student, Parent)
router.get('/:id', authorize(['teacher', 'school_admin', 'student', 'parent']), getAssignment);

// @route   POST /api/assignments
// @desc    Create new assignment (with optional file uploads)
// @access  Private (Teacher, School Admin)
router.post('/', 
  authorize(['teacher', 'school_admin']), 
  uploadDocument.array('files', 5),
  createAssignment
);

// @route   PUT /api/assignments/:id
// @desc    Update assignment
// @access  Private (Teacher, School Admin)
router.put('/:id', authorize(['teacher', 'school_admin']), assignmentUpdateValidation, updateAssignment);

// @route   DELETE /api/assignments/:id
// @desc    Delete assignment
// @access  Private (Teacher, School Admin)
router.delete('/:id', authorize(['teacher', 'school_admin']), deleteAssignment);

// @route   POST /api/assignments/:id/submit
// @desc    Submit assignment with PDF files
// @access  Private (Student)
router.post('/:id/submit', authorize(['student']), uploadDocument.array('files', 5), submitAssignment);

module.exports = router;


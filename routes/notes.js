const express = require('express');
const router = express.Router();
const {
  createNote,
  getNotesForClassSubject,
  getNotesForTeacher,
  getNoteById,
  updateNote,
  deleteNote
} = require('../controllers/noteController');
const { protect, authorize } = require('../middleware/auth');
const { body } = require('express-validator');

// Validation middleware
const validateNote = [
  body('title')
    .trim()
    .notEmpty()
    .withMessage('Title is required')
    .isLength({ max: 200 })
    .withMessage('Title cannot exceed 200 characters'),
  body('content')
    .trim()
    .notEmpty()
    .withMessage('Content is required'),
  body('classId')
    .notEmpty()
    .withMessage('Class ID is required')
    .isMongoId()
    .withMessage('Invalid class ID'),
  body('subjectId')
    .notEmpty()
    .withMessage('Subject ID is required')
    .isMongoId()
    .withMessage('Invalid subject ID'),
  body('attachments')
    .optional()
    .isArray()
    .withMessage('Attachments must be an array'),
  body('attachments.*.fileName')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('File name is required for attachments'),
  body('attachments.*.fileUrl')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('File URL is required for attachments'),
  body('attachments.*.fileType')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('File type is required for attachments'),
  body('attachments.*.fileSize')
    .optional()
    .isNumeric()
    .withMessage('File size must be a number'),
];

const validateNoteUpdate = [
  body('title')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('Title cannot exceed 200 characters'),
  body('content')
    .optional()
    .trim(),
  body('attachments')
    .optional()
    .isArray()
    .withMessage('Attachments must be an array'),
];

// All routes require authentication
router.use(protect);

// @route   POST /api/notes
// @desc    Create a new note
// @access  Private (Teacher)
router.post('/', authorize(['teacher']), validateNote, createNote);

// @route   GET /api/notes/teacher
// @desc    Get notes for a teacher
// @access  Private (Teacher)
router.get('/teacher', authorize(['teacher']), getNotesForTeacher);

// @route   GET /api/notes/class/:classId/subject/:subjectId
// @desc    Get notes for a specific class and subject
// @access  Private (Student, Teacher, Parent)
router.get('/class/:classId/subject/:subjectId', authorize(['student', 'teacher', 'parent']), getNotesForClassSubject);

// @route   GET /api/notes/:id
// @desc    Get note by ID
// @access  Private (Student, Teacher, Parent)
router.get('/:id', authorize(['student', 'teacher', 'parent']), getNoteById);

// @route   PUT /api/notes/:id
// @desc    Update note
// @access  Private (Teacher - Note Creator)
router.put('/:id', authorize(['teacher']), validateNoteUpdate, updateNote);

// @route   DELETE /api/notes/:id
// @desc    Delete note
// @access  Private (Teacher - Note Creator)
router.delete('/:id', authorize(['teacher']), deleteNote);

module.exports = router;

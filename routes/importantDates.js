const express = require('express');
const router = express.Router();
const {
  createImportantDate,
  getImportantDates,
  getImportantDateById,
  updateImportantDate,
  deleteImportantDate,
  getCalendarImportantDates
} = require('../controllers/importantDateController');
const { protect } = require('../middleware/auth');
const { validateImportantDate, validateImportantDateUpdate } = require('../middleware/importantDateValidation');

// All routes require authentication
router.use(protect);

// @route   POST /api/important-dates
// @desc    Create a new important date
// @access  Private (School Admin only)
router.post('/', validateImportantDate, createImportantDate);

// @route   GET /api/important-dates
// @desc    Get all important dates for a school
// @access  Private (School Admin, Teacher, Parent)
router.get('/', getImportantDates);

// @route   GET /api/important-dates/calendar
// @desc    Get important dates for calendar view (monthly)
// @access  Private (School Admin, Teacher, Parent)
router.get('/calendar', getCalendarImportantDates);

// @route   GET /api/important-dates/:id
// @desc    Get important date by ID
// @access  Private (School Admin, Teacher, Parent)
router.get('/:id', getImportantDateById);

// @route   PUT /api/important-dates/:id
// @desc    Update important date
// @access  Private (School Admin only)
router.put('/:id', validateImportantDateUpdate, updateImportantDate);

// @route   DELETE /api/important-dates/:id
// @desc    Delete important date
// @access  Private (School Admin only)
router.delete('/:id', deleteImportantDate);

module.exports = router;

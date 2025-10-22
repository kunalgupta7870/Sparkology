const express = require('express');
const router = express.Router();
const {
  getExams,
  getExam,
  createExam,
  updateExam,
  deleteExam,
  getExamStats,
  getExamMarks,
  addExamMarks,
  getAllExamMarks,
  updateExamMark,
  deleteExamMark,
  getExamSchedule,
  getDateSheet,
  bulkCreateExams
} = require('../controllers/examController');
const { protect } = require('../middleware/auth');

// Stats and overview routes (before :id routes)
router.get('/stats/overview', protect, getExamStats);
router.get('/schedule', protect, getExamSchedule);
router.get('/date-sheet', protect, getDateSheet);

// Bulk operations
router.post('/bulk', protect, bulkCreateExams);

// Exam marks routes
router.route('/marks')
  .get(protect, getAllExamMarks);

router.route('/marks/:id')
  .put(protect, updateExamMark)
  .delete(protect, deleteExamMark);

// Individual exam marks routes
router.route('/:id/marks')
  .get(protect, getExamMarks)
  .post(protect, addExamMarks);

// Main exam CRUD routes
router.route('/')
  .get(protect, getExams)
  .post(protect, createExam);

router.route('/:id')
  .get(protect, getExam)
  .put(protect, updateExam)
  .delete(protect, deleteExam);

module.exports = router;


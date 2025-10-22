const express = require('express');
const {
  getAdminQuizzes,
  getAdminQuiz,
  createAdminQuiz,
  updateAdminQuiz,
  deleteAdminQuiz
} = require('../controllers/adminQuizController');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

// Apply authentication and admin authorization to all routes
router.use(protect);
router.use(authorize(['admin']));

// Routes
// @route   GET /api/admin-quizzes
// @desc    Get all admin quizzes
// @access  Private (Admin only)
router.get('/', getAdminQuizzes);

// @route   GET /api/admin-quizzes/:id
// @desc    Get single admin quiz
// @access  Private (Admin only)
router.get('/:id', getAdminQuiz);

// @route   POST /api/admin-quizzes
// @desc    Create new admin quiz
// @access  Private (Admin only)
router.post('/', createAdminQuiz);

// @route   PUT /api/admin-quizzes/:id
// @desc    Update admin quiz
// @access  Private (Admin only)
router.put('/:id', updateAdminQuiz);

// @route   DELETE /api/admin-quizzes/:id
// @desc    Delete admin quiz
// @access  Private (Admin only)
router.delete('/:id', deleteAdminQuiz);

module.exports = router;


const express = require('express');
const {
  getAvailableQuizzes,
  getQuizById,
  submitQuizAttempt,
  getMyAttempts,
  getMyStats
} = require('../controllers/studentQuizBattleController');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

// Apply authentication and student authorization
router.use(protect);
router.use(authorize(['student']));

// @route   GET /api/student-quiz-battle/quizzes
// @desc    Get all available quiz battles
// @access  Private (Student only)
router.get('/quizzes', getAvailableQuizzes);

// @route   GET /api/student-quiz-battle/quizzes/:id
// @desc    Get single quiz battle
// @access  Private (Student only)
router.get('/quizzes/:id', getQuizById);

// @route   POST /api/student-quiz-battle/quizzes/:id/submit
// @desc    Submit quiz battle attempt
// @access  Private (Student only)
router.post('/quizzes/:id/submit', submitQuizAttempt);

// @route   GET /api/student-quiz-battle/my-attempts
// @desc    Get my quiz attempts
// @access  Private (Student only)
router.get('/my-attempts', getMyAttempts);

// @route   GET /api/student-quiz-battle/my-stats
// @desc    Get my quiz battle statistics
// @access  Private (Student only)
router.get('/my-stats', getMyStats);

// @route   GET /api/student-quiz-battle/leaderboard
// @desc    Get class leaderboard
// @access  Private (Student only)
router.get('/leaderboard', require('../controllers/studentQuizBattleController').getClassLeaderboard);

module.exports = router;


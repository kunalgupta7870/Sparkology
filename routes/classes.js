const express = require('express');
const { protect, authorize } = require('../middleware/auth');
const {
  getClasses,
  getClass,
  createClass,
  updateClass,
  deleteClass,
  getClassStats
} = require('../controllers/classController');
const {
  classValidation,
  classUpdateValidation
} = require('../middleware/classValidation');

const router = express.Router();

// All routes are protected
router.use(protect);

// Class management routes (School Admin only)
router.get('/', authorize('school_admin'), getClasses);
router.get('/stats', authorize('school_admin'), getClassStats);
router.get('/:id', authorize('school_admin', 'teacher'), getClass);
router.post('/', authorize('school_admin'), classValidation, createClass);
router.put('/:id', authorize('school_admin'), classUpdateValidation, updateClass);
router.delete('/:id', authorize('school_admin'), deleteClass);

module.exports = router;
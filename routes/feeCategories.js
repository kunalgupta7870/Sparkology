const express = require('express');
const {
  getFeeCategories,
  getFeeCategory,
  createFeeCategory,
  updateFeeCategory,
  deleteFeeCategory,
  getActiveFeeCategories
} = require('../controllers/feeCategoryController');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

// All routes are protected
router.use(protect);

// Routes - allow school_admin and accountant
router.get('/active/list', authorize('school_admin', 'accountant'), getActiveFeeCategories);
router.get('/', authorize('school_admin', 'accountant'), getFeeCategories);
router.get('/:id', authorize('school_admin', 'accountant'), getFeeCategory);
router.post('/', authorize('school_admin', 'accountant'), createFeeCategory);
router.put('/:id', authorize('school_admin', 'accountant'), updateFeeCategory);
router.delete('/:id', authorize('school_admin', 'accountant'), deleteFeeCategory);

module.exports = router;


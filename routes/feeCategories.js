const express = require('express');
const {
  getFeeCategories,
  getFeeCategory,
  createFeeCategory,
  updateFeeCategory,
  deleteFeeCategory,
  getActiveFeeCategories
} = require('../controllers/feeCategoryController');
const { protect } = require('../middleware/auth');

const router = express.Router();

// All routes are protected
router.use(protect);

// Routes
router.get('/active/list', getActiveFeeCategories);
router.get('/', getFeeCategories);
router.get('/:id', getFeeCategory);
router.post('/', createFeeCategory);
router.put('/:id', updateFeeCategory);
router.delete('/:id', deleteFeeCategory);

module.exports = router;


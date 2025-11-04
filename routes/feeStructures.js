const express = require('express');
const {
  getFeeStructures,
  getFeeStructure,
  createFeeStructure,
  updateFeeStructure,
  deleteFeeStructure,
  getActiveFeeStructures
} = require('../controllers/feeStructureController');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

// All routes are protected
router.use(protect);

// Routes - allow school_admin and accountant
router.get('/active/list', authorize('school_admin', 'accountant'), getActiveFeeStructures);
router.get('/', authorize('school_admin', 'accountant'), getFeeStructures);
router.get('/:id', authorize('school_admin', 'accountant'), getFeeStructure);
router.post('/', authorize('school_admin', 'accountant'), createFeeStructure);
router.put('/:id', authorize('school_admin', 'accountant'), updateFeeStructure);
router.delete('/:id', authorize('school_admin', 'accountant'), deleteFeeStructure);

module.exports = router;


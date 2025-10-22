const express = require('express');
const {
  getFeeStructures,
  getFeeStructure,
  createFeeStructure,
  updateFeeStructure,
  deleteFeeStructure,
  getActiveFeeStructures
} = require('../controllers/feeStructureController');
const { protect } = require('../middleware/auth');

const router = express.Router();

// All routes are protected
router.use(protect);

// Routes
router.get('/active/list', getActiveFeeStructures);
router.get('/', getFeeStructures);
router.get('/:id', getFeeStructure);
router.post('/', createFeeStructure);
router.put('/:id', updateFeeStructure);
router.delete('/:id', deleteFeeStructure);

module.exports = router;


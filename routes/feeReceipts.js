const express = require('express');
const {
  getFeeReceipts,
  getFeeReceipt,
  getFeeReceiptByNumber,
  createFeeReceipt,
  cancelFeeReceipt,
  getReceiptStats,
  getReceiptsByDateRange,
  getReceiptsByStudent
} = require('../controllers/feeReceiptController');
const { protect } = require('../middleware/auth');

const router = express.Router();

// All routes are protected
router.use(protect);

// Special routes
router.get('/stats', getReceiptStats);
router.get('/date-range', getReceiptsByDateRange);
router.get('/student/:studentId', getReceiptsByStudent);
router.get('/number/:receiptNumber', getFeeReceiptByNumber);

// Standard routes
router.get('/', getFeeReceipts);
router.get('/:id', getFeeReceipt);
router.post('/', createFeeReceipt);
router.put('/:id/cancel', cancelFeeReceipt);

module.exports = router;


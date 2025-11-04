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
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

// All routes are protected
router.use(protect);

// Special routes - allow school_admin and accountant
router.get('/stats', authorize('school_admin', 'accountant'), getReceiptStats);
router.get('/date-range', authorize('school_admin', 'accountant'), getReceiptsByDateRange);
router.get('/student/:studentId', authorize('school_admin', 'accountant'), getReceiptsByStudent);
router.get('/number/:receiptNumber', authorize('school_admin', 'accountant'), getFeeReceiptByNumber);

// Standard routes - allow school_admin and accountant
router.get('/', authorize('school_admin', 'accountant'), getFeeReceipts);
router.get('/:id', authorize('school_admin', 'accountant'), getFeeReceipt);
router.post('/', authorize('school_admin', 'accountant'), createFeeReceipt);
router.put('/:id/cancel', authorize('school_admin', 'accountant'), cancelFeeReceipt);

module.exports = router;


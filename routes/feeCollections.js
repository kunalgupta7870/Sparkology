const express = require('express');
const {
  getFeeCollections,
  getFeeCollection,
  createFeeCollection,
  updateFeeCollection,
  addPayment,
  deleteFeeCollection,
  cancelFeeCollection,
  getDueCollections,
  getOverdueCollections,
  getCollectionStats,
  sendReminder
} = require('../controllers/feeCollectionController');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

// All routes are protected
router.use(protect);

// Special routes - allow school_admin and accountant
router.get('/due/list', authorize('school_admin', 'accountant'), getDueCollections);
router.get('/overdue/list', authorize('school_admin', 'accountant'), getOverdueCollections);
router.get('/stats', authorize('school_admin', 'accountant'), getCollectionStats);

// Standard routes - allow school_admin and accountant
router.get('/', authorize('school_admin', 'accountant'), getFeeCollections);
router.get('/:id', authorize('school_admin', 'accountant'), getFeeCollection);
router.post('/', authorize('school_admin', 'accountant'), createFeeCollection);
router.put('/:id', authorize('school_admin', 'accountant'), updateFeeCollection);
router.post('/:id/payment', authorize('school_admin', 'accountant'), addPayment);
router.put('/:id/cancel', authorize('school_admin', 'accountant'), cancelFeeCollection);
router.post('/:id/reminder', authorize('school_admin', 'accountant'), sendReminder);
router.delete('/:id', authorize('school_admin', 'accountant'), deleteFeeCollection);

module.exports = router;


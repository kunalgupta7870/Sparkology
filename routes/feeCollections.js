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
const { protect } = require('../middleware/auth');

const router = express.Router();

// All routes are protected
router.use(protect);

// Special routes
router.get('/due/list', getDueCollections);
router.get('/overdue/list', getOverdueCollections);
router.get('/stats', getCollectionStats);

// Standard routes
router.get('/', getFeeCollections);
router.get('/:id', getFeeCollection);
router.post('/', createFeeCollection);
router.put('/:id', updateFeeCollection);
router.post('/:id/payment', addPayment);
router.put('/:id/cancel', cancelFeeCollection);
router.post('/:id/reminder', sendReminder);
router.delete('/:id', deleteFeeCollection);

module.exports = router;


const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { verifyPaymentAndComplete } = require('../controllers/paymentController');

// All routes are protected
router.use(protect);

/**
 * @route   POST /api/payments/verify
 * @desc    Verify Razorpay payment and complete purchase
 * @access  Private
 */
router.post('/verify', verifyPaymentAndComplete);

module.exports = router;


const express = require('express');
const router = express.Router();
const {
  createOrder,
  getOrders,
  getOrder,
  getOrderByNumber,
  cancelOrder,
  getAllOrders
} = require('../controllers/orderController');
const { protect, isAdmin } = require('../middleware/auth');

// All routes require authentication
router.use(protect);

// @route   POST /api/orders
// @desc    Create new order (Purchase)
// @access  Private
router.post('/', createOrder);

// @route   GET /api/orders/all
// @desc    Get all orders (Admin only)
// @access  Private (Admin)
router.get('/all', isAdmin, getAllOrders);

// @route   GET /api/orders
// @desc    Get user's orders
// @access  Private
router.get('/', getOrders);

// @route   GET /api/orders/number/:orderNumber
// @desc    Get order by order number
// @access  Private
router.get('/number/:orderNumber', getOrderByNumber);

// @route   GET /api/orders/:id
// @desc    Get order by ID
// @access  Private
router.get('/:id', getOrder);

// @route   PUT /api/orders/:id/cancel
// @desc    Cancel order
// @access  Private
router.put('/:id/cancel', cancelOrder);

module.exports = router;


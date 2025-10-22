const express = require('express');
const router = express.Router();
const {
  getCart,
  addToCart,
  updateQuantity,
  removeFromCart,
  toggleItemSelection,
  clearCart,
  clearSelectedItems,
  getCartSummary
} = require('../controllers/cartController');
const { protect } = require('../middleware/auth');

// All routes require authentication
router.use(protect);

// @route   GET /api/cart
// @desc    Get user's cart
// @access  Private
router.get('/', getCart);

// @route   GET /api/cart/summary
// @desc    Get cart summary
// @access  Private
router.get('/summary', getCartSummary);

// @route   POST /api/cart/add
// @desc    Add item to cart
// @access  Private
router.post('/add', addToCart);

// @route   PUT /api/cart/update-quantity/:itemId
// @desc    Update item quantity
// @access  Private
router.put('/update-quantity/:itemId', updateQuantity);

// @route   PUT /api/cart/toggle-selection/:itemId
// @desc    Toggle item selection
// @access  Private
router.put('/toggle-selection/:itemId', toggleItemSelection);

// @route   DELETE /api/cart/remove/:itemId
// @desc    Remove item from cart
// @access  Private
router.delete('/remove/:itemId', removeFromCart);

// @route   DELETE /api/cart/clear
// @desc    Clear cart (all items)
// @access  Private
router.delete('/clear', clearCart);

// @route   DELETE /api/cart/clear-selected
// @desc    Clear selected items from cart
// @access  Private
router.delete('/clear-selected', clearSelectedItems);

module.exports = router;


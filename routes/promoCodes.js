const express = require('express');
const router = express.Router();
const {
  createPromoCode,
  getPromoCodes,
  getPromoCode,
  updatePromoCode,
  deletePromoCode,
  validatePromoCode,
  validatePromoCodeByCode,
  getPromoCodeStats
} = require('../controllers/promoCodeController');
const { protect, authorize } = require('../middleware/auth');
const { body, param, query } = require('express-validator');

// Validation middleware
const validatePromoCodeCreation = [
  body('code')
    .trim()
    .isLength({ min: 3, max: 20 })
    .withMessage('Promo code must be between 3 and 20 characters')
    .matches(/^[A-Z0-9_-]+$/i)
    .withMessage('Promo code can only contain letters, numbers, underscores, and hyphens'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Description cannot exceed 500 characters'),
  body('discountType')
    .isIn(['percentage', 'fixed'])
    .withMessage('Discount type must be either percentage or fixed'),
  body('discountValue')
    .isFloat({ min: 0 })
    .withMessage('Discount value must be a positive number'),
  body('maxDiscountAmount')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Max discount amount must be a positive number'),
  body('minimumOrderAmount')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Minimum order amount must be a positive number'),
  body('targetType')
    .isIn(['all', 'specific', 'category'])
    .withMessage('Target type must be all, specific, or category'),
  body('targetProducts')
    .optional()
    .isArray()
    .withMessage('Target products must be an array'),
  body('targetCategories')
    .optional()
    .isArray()
    .withMessage('Target categories must be an array'),
  body('usageLimit')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Usage limit must be a positive integer'),
  body('validFrom')
    .optional()
    .isISO8601()
    .toDate()
    .withMessage('Valid from must be a valid date'),
  body('validUntil')
    .isISO8601()
    .toDate()
    .withMessage('Valid until must be a valid date'),
  body('isActive')
    .optional()
    .isBoolean()
    .withMessage('isActive must be a boolean')
];

const validatePromoCodeUpdate = [
  body('code')
    .optional()
    .trim()
    .isLength({ min: 3, max: 20 })
    .withMessage('Promo code must be between 3 and 20 characters')
    .matches(/^[A-Z0-9_-]+$/i)
    .withMessage('Promo code can only contain letters, numbers, underscores, and hyphens'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Description cannot exceed 500 characters'),
  body('discountType')
    .optional()
    .isIn(['percentage', 'fixed'])
    .withMessage('Discount type must be either percentage or fixed'),
  body('discountValue')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Discount value must be a positive number'),
  body('maxDiscountAmount')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Max discount amount must be a positive number'),
  body('minimumOrderAmount')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Minimum order amount must be a positive number'),
  body('targetType')
    .optional()
    .isIn(['all', 'specific', 'category'])
    .withMessage('Target type must be all, specific, or category'),
  body('targetProducts')
    .optional()
    .isArray()
    .withMessage('Target products must be an array'),
  body('targetCategories')
    .optional()
    .isArray()
    .withMessage('Target categories must be an array'),
  body('usageLimit')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Usage limit must be a positive integer'),
  body('validFrom')
    .optional()
    .isISO8601()
    .toDate()
    .withMessage('Valid from must be a valid date'),
  body('validUntil')
    .optional()
    .isISO8601()
    .toDate()
    .withMessage('Valid until must be a valid date'),
  body('isActive')
    .optional()
    .isBoolean()
    .withMessage('isActive must be a boolean')
];

const validatePromoCodeValidation = [
  body('code')
    .trim()
    .notEmpty()
    .withMessage('Promo code is required'),
  body('productId')
    .isMongoId()
    .withMessage('Valid product ID is required'),
  body('orderAmount')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Order amount must be a positive number')
];

const validatePromoCodeId = [
  param('id')
    .isMongoId()
    .withMessage('Invalid promo code ID')
];

// All routes require authentication
router.use(protect);

// @route   POST /api/promo-codes
// @desc    Create a new promo code
// @access  Private (Admin)
router.post('/',
  authorize(['admin']),
  validatePromoCodeCreation,
  createPromoCode
);

// @route   GET /api/promo-codes
// @desc    Get all promo codes
// @access  Private (Admin)
router.get('/',
  authorize(['admin']),
  getPromoCodes
);

// @route   GET /api/promo-codes/stats
// @desc    Get promo code statistics
// @access  Private (Admin)
router.get('/stats',
  authorize(['admin']),
  getPromoCodeStats
);

// @route   POST /api/promo-codes/validate
// @desc    Validate promo code for a product
// @access  Private
router.post('/validate',
  validatePromoCodeValidation,
  validatePromoCode
);

// @route   GET /api/promo-codes/validate/:code
// @desc    Validate promo code by code (simple)
// @access  Private
router.get('/validate/:code',
  validatePromoCodeByCode
);

// @route   GET /api/promo-codes/:id
// @desc    Get promo code by ID
// @access  Private (Admin)
router.get('/:id',
  authorize(['admin']),
  validatePromoCodeId,
  getPromoCode
);

// @route   PUT /api/promo-codes/:id
// @desc    Update promo code
// @access  Private (Admin)
router.put('/:id',
  authorize(['admin']),
  validatePromoCodeId,
  validatePromoCodeUpdate,
  updatePromoCode
);

// @route   DELETE /api/promo-codes/:id
// @desc    Delete promo code
// @access  Private (Admin)
router.delete('/:id',
  authorize(['admin']),
  validatePromoCodeId,
  deletePromoCode
);

module.exports = router;

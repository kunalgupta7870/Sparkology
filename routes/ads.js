const express = require('express');
const router = express.Router();
const {
  uploadAd,
  getAds,
  getAd,
  updateAd,
  deleteAd,
  getAdCategories,
  getAdTags
} = require('../controllers/adController');
const { protect, authorize } = require('../middleware/auth');
const { uploadPhoto: uploadAdMiddleware, handleUploadError } = require('../utils/cloudinary');
const { body, param } = require('express-validator');

// Validation middleware
const validateAdUpload = [
  body('title')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('Title cannot exceed 200 characters'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Description cannot exceed 1000 characters'),
  body('category')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Category cannot exceed 100 characters'),
  body('tags')
    .optional()
    .custom((value) => {
      if (typeof value === 'string') {
        try {
          JSON.parse(value);
        } catch (e) {
          throw new Error('Tags must be a valid JSON array');
        }
      }
      return true;
    })
];

const validateAdUpdate = [
  body('title')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('Title cannot exceed 200 characters'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Description cannot exceed 1000 characters'),
  body('category')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Category cannot exceed 100 characters'),
  body('tags')
    .optional()
    .custom((value) => {
      if (Array.isArray(value)) {
        return value.every(tag => typeof tag === 'string' && tag.length <= 50);
      }
      return true;
    })
    .withMessage('Tags must be an array of strings, each max 50 characters'),
  body('isPublic')
    .optional()
    .isBoolean()
    .withMessage('isPublic must be a boolean')
];

const validateAdId = [
  param('id')
    .isMongoId()
    .withMessage('Invalid ad ID')
];

// All routes require authentication
router.use(protect);

// @route   POST /api/ads/upload
// @desc    Upload an ad
// @access  Private (Admin)
router.post('/upload', 
  authorize(['admin']),
  uploadAdMiddleware.single('file'),
  handleUploadError,
  uploadAd
);

// @route   GET /api/ads
// @desc    Get all ads
// @access  Private (Admin, Students, Teachers, Parents)
router.get('/', authorize(['admin', 'student', 'teacher', 'parent', 'school_admin']), getAds);

// @route   GET /api/ads/categories
// @desc    Get ad categories
// @access  Private (Admin)
router.get('/categories', authorize(['admin']), getAdCategories);

// @route   GET /api/ads/tags
// @desc    Get ad tags
// @access  Private (Admin)
router.get('/tags', authorize(['admin']), getAdTags);

// @route   GET /api/ads/:id
// @desc    Get ad by ID
// @access  Private (Admin)
router.get('/:id', 
  authorize(['admin']),
  validateAdId,
  getAd
);

// @route   PUT /api/ads/:id
// @desc    Update ad
// @access  Private (Admin)
router.put('/:id',
  authorize(['admin']),
  validateAdId,
  validateAdUpdate,
  updateAd
);

// @route   DELETE /api/ads/:id
// @desc    Delete ad
// @access  Private (Admin)
router.delete('/:id',
  authorize(['admin']),
  validateAdId,
  deleteAd
);

module.exports = router;

